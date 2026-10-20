import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  validateProviderOutput,
  signedOutputExpiry,
  outputMaxBytes,
} from '../apps/api/src/youcam/output.js';
const clock = Date.UTC(2026, 9, 20, 14);
function signed(changes: Record<string, string> = {}) {
  const q = new URLSearchParams({
    'X-Amz-Date': '20261020T140000Z',
    'X-Amz-Expires': '7200',
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Signature': 'a'.repeat(64),
    'X-Amz-Credential': 'fixture/scope',
    'X-Amz-SignedHeaders': 'host',
    ...changes,
  });
  return `https://assets.test/output?${q}`;
}
async function png() {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#eee' } })
    .png()
    .toBuffer();
}
function response(bytes: Uint8Array, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/png', ...headers },
  });
}
afterEach(() => vi.useRealTimers());
it('validates full image and signed expiry without forwarding API credentials or resetting the clock', async () => {
  const bytes = await png();
  const transport = vi.fn(async () => response(bytes));
  const result = await validateProviderOutput(
    signed(),
    ['assets.test'],
    transport,
    () => clock + 600000,
  );
  expect(result).toMatchObject({
    expiresAt: clock + 7140000,
    mimeType: 'image/png',
    byteLength: bytes.length,
  });
  expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(transport).toHaveBeenCalledWith(
    signed(),
    expect.objectContaining({ method: 'GET', redirect: 'error' }),
  );
  expect(JSON.stringify(transport.mock.calls)).not.toContain('Authorization');
});
it.each<Record<string, string>>([
  { 'X-Amz-Date': '20261020T120000Z' },
  { 'X-Amz-Date': '20261020T150000Z' },
  { 'X-Amz-Date': '20260230T140000Z' },
  { 'X-Amz-Expires': '0' },
  { 'X-Amz-Expires': 'NaN' },
  { 'X-Amz-Expires': '604801' },
  { 'X-Amz-Signature': '' },
  { 'X-Amz-Credential': '' },
  { 'X-Amz-Algorithm': 'unknown' },
  { 'X-Amz-SignedHeaders': 'host;authorization' },
])('rejects untrustworthy or expired signature metadata %j', (change) => {
  expect(() => signedOutputExpiry(signed(change), clock)).toThrow();
});
it('rejects missing or ambiguous expiry rather than granting a fresh lifetime', () => {
  expect(() => signedOutputExpiry('https://assets.test/output', clock)).toThrow();
  expect(() => signedOutputExpiry(signed() + '&X-Amz-Expires=10000', clock)).toThrow();
});
it.each([
  'http://assets.test/output',
  'https://evil.test/output',
  'https://user:password@assets.test/output',
  'https://assets.test:444/output',
])('blocks unsafe URL %s before any fetch', async (url) => {
  const transport = vi.fn();
  await expect(
    validateProviderOutput(url, ['assets.test'], transport, () => clock),
  ).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
it.each([301, 302, 307, 401, 403, 404, 500])(
  'rejects inaccessible/redirect HTTP %i without following it',
  async (status) => {
    const transport = vi.fn(
      async () => new Response(null, { status, headers: { location: 'https://evil.test' } }),
    );
    await expect(
      validateProviderOutput(signed(), ['assets.test'], transport, () => clock),
    ).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  },
);
it.each([
  'corrupt',
  'mime',
  'oversized-header',
  'oversized-stream',
  'length',
  'empty',
  'pixels',
  'redirected',
] as const)('rejects %s output', async (kind) => {
  let bytes = await png();
  let headers = {};
  let redirected = false;
  if (kind === 'corrupt') bytes = bytes.subarray(0, bytes.length - 25);
  if (kind === 'mime') headers = { 'content-type': 'image/jpeg' };
  if (kind === 'oversized-header') headers = { 'content-length': String(outputMaxBytes + 1) };
  if (kind === 'oversized-stream') bytes = Buffer.alloc(outputMaxBytes + 1);
  if (kind === 'length') headers = { 'content-length': String(bytes.length + 10) };
  if (kind === 'empty') bytes = Buffer.alloc(0);
  if (kind === 'pixels')
    bytes = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: '#eee' } })
      .png()
      .toBuffer();
  if (kind === 'redirected') redirected = true;
  const transport = vi.fn(async () => {
    const r = response(bytes, headers);
    if (redirected) Object.defineProperty(r, 'redirected', { value: true });
    return r;
  });
  await expect(
    validateProviderOutput(signed(), ['assets.test'], transport, () => clock),
  ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
});
it('does not retain a result that expires during image validation', async () => {
  const bytes = await png();
  let calls = 0;
  await expect(
    validateProviderOutput(
      signed(),
      ['assets.test'],
      async () => response(bytes),
      () => (calls++ ? clock + 7200000 : clock),
    ),
  ).rejects.toThrow();
});
it.each(['headers', 'stream'] as const)(
  'bounds stalled %s without leaking raw errors',
  async (kind) => {
    vi.useFakeTimers();
    const transport = vi.fn(async () =>
      kind === 'headers'
        ? await new Promise<Response>(() => {})
        : new Response(new ReadableStream({ start() {} }), {
            headers: { 'content-type': 'image/png' },
          }),
    );
    const work = validateProviderOutput(signed(), ['assets.test'], transport, () => clock);
    const check = expect(work).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await vi.advanceTimersByTimeAsync(15001);
    await check;
  },
);
it('caps longer signatures at the documented two-hour output lifetime minus a margin', () => {
  expect(signedOutputExpiry(signed({ 'X-Amz-Expires': '86400' }), clock)).toBe(clock + 7140000);
});
