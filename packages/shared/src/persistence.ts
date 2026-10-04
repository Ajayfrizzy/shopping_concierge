import { z } from 'zod';
export const guestTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const emailRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();
export const emailVerifySchema = z.object({ token: guestTokenSchema }).strict();
export const authAcceptedSchema = z.object({ accepted: z.literal(true) }).strict();
export const authIdentitySchema = z.object({ email: z.string().email().nullable() }).strict();
export const assetUploadSchema = z
  .object({
    requestId: z.string().uuid(),
    type: z.enum(['portrait', 'hand', 'wrist']),
    mimeType: z.enum(['image/png', 'image/jpeg']),
    data: z.string().min(4).max(5_592_408),
  })
  .strict();
export const assetSchema = z
  .object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    type: z.enum(['portrait', 'hand', 'wrist']),
    mimeType: z.enum(['image/png', 'image/jpeg']),
    byteLength: z.number().int().positive().max(4_194_304),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type VisualAsset = z.infer<typeof assetSchema>;
export const sessionListSchema = z.object({ sessionIds: z.array(z.string().uuid()) }).strict();
