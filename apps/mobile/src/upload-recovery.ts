import { z } from 'zod';
import {
  assetSchema,
  assetUploadSchema,
  type VisualAsset,
  type VisualAssetType,
} from '@youcam/shared';
import type { createVisualAPI } from './visual-client';

const pendingSchema = assetSchema.omit({ sessionId: true });
const journalSchema = z
  .object({
    version: z.literal(1),
    sessionId: z.string().uuid(),
    productId: z.string(),
    pending: pendingSchema.nullable(),
  })
  .strict();
type Pending = z.infer<typeof pendingSchema>;
export function decodeImage(data: string): Uint8Array {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}
/** Upload intent only: never stores credentials, URLs or image bytes; never creates a VTO job. */
export function createUploadRecovery(
  api: Pick<ReturnType<typeof createVisualAPI>, 'upload' | 'asset' | 'assetBytes'>,
  storage: { read(): Promise<string | null>; write(value: string): Promise<void> },
  sessionId: string,
  productId: string,
  hash: (bytes: Uint8Array) => Promise<string>,
) {
  let pending: Pending | null = null;
  let candidate: VisualAsset | null = null;
  let ready = false,
    busy = false;
  const save = async (next: Pending | null) => {
    await storage.write(JSON.stringify({ version: 1, sessionId, productId, pending: next }));
    pending = next;
  };
  const exclusive = async (action: () => Promise<void>) => {
    if (busy) throw new Error('Photo recovery is already in progress.');
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
    }
  };
  const validate = (raw: unknown, id: string, type: VisualAssetType, expected: Pending | null) => {
    const asset = assetSchema.parse(raw);
    if (asset.id !== id || asset.sessionId !== sessionId || asset.type !== type)
      throw new Error('This upload does not match this session or the required photo type.');
    if (
      expected &&
      (asset.id !== expected.id ||
        asset.sha256 !== expected.sha256 ||
        asset.byteLength !== expected.byteLength ||
        asset.mimeType !== expected.mimeType ||
        asset.type !== expected.type)
    )
      throw new Error('Stored upload does not match the original upload. Nothing was associated.');
    return asset;
  };
  const requireReady = () => {
    if (!ready) throw new Error('Upload recovery journal is unavailable. Do not upload again.');
  };
  return {
    getPending: () => pending,
    getCandidate: () => candidate,
    async boot() {
      await exclusive(async () => {
        ready = false;
        const raw = await storage.read();
        if (raw !== null) {
          const journal = journalSchema.parse(JSON.parse(raw));
          if (journal.sessionId !== sessionId || journal.productId !== productId)
            throw new Error('Upload recovery belongs to another session or product.');
          pending = journal.pending;
        }
        ready = true;
      });
    },
    async upload(raw: unknown, associate: (asset: VisualAsset) => Promise<void>) {
      await exclusive(async () => {
        requireReady();
        if (pending)
          throw new Error(
            'An upload has an unresolved outcome. Recover it before choosing another photo.',
          );
        const input = assetUploadSchema.parse(raw);
        const bytes = decodeImage(input.data);
        const intent = pendingSchema.parse({
          id: input.requestId,
          type: input.type,
          mimeType: input.mimeType,
          byteLength: bytes.length,
          sha256: await hash(bytes),
        });
        await save(intent); // Durable ID and fingerprint precede the only POST.
        const asset = validate(await api.upload(sessionId, input), intent.id, intent.type, intent);
        await associate(asset);
        await save(null);
        candidate = null;
      });
    },
    async inspect(id: string, type: VisualAssetType) {
      await exclusive(async () => {
        requireReady();
        candidate = null;
        const exact = z.string().uuid().parse(id.trim());
        if (pending && exact !== pending.id)
          throw new Error('Recover the pending upload ID; do not substitute another upload.');
        const asset = validate(await api.asset(sessionId, exact), exact, type, pending);
        const bytes = await api.assetBytes(sessionId, exact);
        const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (
          bytes.length !== asset.byteLength ||
          (await hash(bytes)) !== asset.sha256 ||
          !(asset.mimeType === 'image/png' ? png : jpeg)
        )
          throw new Error('Stored photo failed integrity checks. Nothing was associated.');
        const fingerprint = {
          id: asset.id,
          type: asset.type,
          mimeType: asset.mimeType,
          byteLength: asset.byteLength,
          sha256: asset.sha256,
        };
        await save(pendingSchema.parse(fingerprint));
        candidate = asset; // Explicit confirmation is still required.
      });
    },
    async confirm(associate: (asset: VisualAsset) => Promise<void>) {
      await exclusive(async () => {
        requireReady();
        if (!candidate) throw new Error('Inspect the existing upload before confirming it.');
        await associate(candidate);
        await save(null);
        candidate = null;
      });
    },
  };
}
