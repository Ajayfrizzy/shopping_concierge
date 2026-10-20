import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { safeProviderUrl } from './url.js';
import { VisualError } from './provider.js';
const unavailable = () =>
  new VisualError(
    'PROVIDER_UNAVAILABLE',
    'The original output cannot be verified or has expired. No new render was submitted.',
  );
export const outputMaxBytes = 8 * 1024 * 1024;
/** Only signed expiry supplied by the authenticated task response is accepted. */
export function signedOutputExpiry(raw: string, now: number) {
  const q = new URL(raw).searchParams;
  const one = (key: string) => (q.getAll(key).length === 1 ? q.get(key)! : '');
  const date = one('X-Amz-Date');
  const ttl = one('X-Amz-Expires');
  if (
    !/^\d{8}T\d{6}Z$/.test(date) ||
    !/^\d+$/.test(ttl) ||
    Number(ttl) < 1 ||
    Number(ttl) > 604800 ||
    one('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
    !/^[a-fA-F0-9]{64}$/.test(one('X-Amz-Signature')) ||
    !one('X-Amz-Credential') ||
    one('X-Amz-SignedHeaders') !== 'host'
  )
    throw unavailable();
  const issued = Date.parse(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
  );
  if (
    !Number.isFinite(issued) ||
    new Date(issued).toISOString().replace(/[-:]/g, '').replace('.000', '') !== date ||
    issued > now + 60000
  )
    throw unavailable();
  const expiresAt = issued + Math.min(Number(ttl), 7200) * 1000 - 60000;
  if (expiresAt <= now) throw unavailable();
  return expiresAt;
}
/** Called only after owner authorization and authenticated task polling. The URL's
 * signature authorizes this bounded GET; API/guest credentials never leave the API host. */
async function validateOutput(
  raw: string,
  hosts: readonly string[],
  transport: typeof fetch = fetch,
  now = Date.now,
  signal: AbortSignal,
) {
  try {
    const url = safeProviderUrl(raw, hosts);
    const expiresAt = signedOutputExpiry(url, now());
    const response = await transport(url, {
      method: 'GET',
      redirect: 'error',
      signal,
    });
    if (response.status !== 200 || response.redirected || !response.body) throw unavailable();
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    const length = response.headers.get('content-length');
    if (
      !['image/png', 'image/jpeg'].includes(mime ?? '') ||
      (length !== null && (!/^\d+$/.test(length) || Number(length) > outputMaxBytes))
    ) {
      await response.body.cancel();
      throw unavailable();
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > outputMaxBytes) throw unavailable();
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    if (!size || (length !== null && Number(length) !== size)) throw unavailable();
    const bytes = Buffer.concat(chunks);
    const image = sharp(bytes, { limitInputPixels: 16000000, failOn: 'warning' }).timeout({
      seconds: 5,
    });
    const metadata = await image.metadata();
    if (metadata.pages && metadata.pages !== 1) throw unavailable();
    if (
      (mime === 'image/png' && metadata.format !== 'png') ||
      (mime === 'image/jpeg' && metadata.format !== 'jpeg')
    )
      throw unavailable();
    await image.raw().toBuffer(); // Decode all pixels, not merely the file header.
    if (expiresAt <= now()) throw unavailable();
    return {
      expiresAt,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      mimeType: mime as 'image/png' | 'image/jpeg',
      byteLength: size,
    };
  } catch {
    throw unavailable();
  }
}

/** A single wall-clock bound covers headers, streamed body and decoding. */
export async function validateProviderOutput(
  raw: string,
  hosts: readonly string[],
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(unavailable());
    }, 15000);
  });
  try {
    return await Promise.race([
      validateOutput(raw, hosts, transport, now, controller.signal),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
