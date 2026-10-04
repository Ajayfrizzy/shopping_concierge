import { z } from 'zod';
import { categorySchema, idSchema } from './domain.ts';
export const visualErrorSchema = z
  .object({ code: z.string().min(1), message: z.string().min(1), recoverable: z.literal(true) })
  .strict();
export const vtoRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    productId: idSchema,
    assetId: z.string().uuid().optional(),
  })
  .strict();
export const vtoJobSchema = z
  .object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    productId: idSchema,
    assetId: z.string().uuid(),
    category: categorySchema,
    mode: z.enum(['mock', 'live']),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    result: z
      .discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('mock'),
            message: z.literal('Mock try-on completed. No visual rendering was generated.'),
          })
          .strict(),
        z
          .object({ kind: z.literal('image'), url: z.string().url(), expiresAt: z.number().int() })
          .strict(),
      ])
      .nullable(),
    error: visualErrorSchema.nullable(),
  })
  .strict()
  .superRefine((job, ctx) => {
    if (
      (job.status === 'completed') !== (job.result !== null) ||
      (job.status === 'failed') !== (job.error !== null)
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid job outcome' });
    if (job.result && (job.mode === 'mock') !== (job.result.kind === 'mock'))
      ctx.addIssue({ code: 'custom', message: 'Invalid result provenance' });
  });
export type VtoJob = z.infer<typeof vtoJobSchema>;
export const vtoResponseSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('request_image'),
      requiredType: z.enum(['portrait', 'hand', 'wrist']),
      message: z.string(),
    })
    .strict(),
  z.object({ type: z.literal('job'), job: vtoJobSchema }).strict(),
]);
export type VtoResponse = z.infer<typeof vtoResponseSchema>;
export const visualAnalysisRequestSchema = z
  .object({ assetId: z.string().uuid(), kind: z.enum(['face', 'color']) })
  .strict();
export const visualProfileSchema = z
  .object({
    assetId: z.string().uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(['mock', 'live']),
    kind: z.enum(['face', 'color']),
    version: z.literal(1),
    faceShape: z.string().nullable(),
    createdAt: z.number().int(),
  })
  .strict();
export const visualProfileResponseSchema = z
  .object({ profile: visualProfileSchema, cached: z.boolean() })
  .strict();
export const vtoListSchema = z.object({ jobs: z.array(vtoJobSchema).max(100) }).strict();
