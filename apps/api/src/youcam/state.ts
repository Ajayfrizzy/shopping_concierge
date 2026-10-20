import { z } from 'zod';
import { vtoJobSchema, visualProfileSchema, visualErrorSchema } from '@youcam/shared';
export const visualStateSchema = z
  .object({
    profiles: z.array(visualProfileSchema).max(10).default([]),
    jobs: z
      .array(
        z
          .object({
            job: vtoJobSchema,
            productAssetKey: z.string().nullable().optional(),
            productAssetUrl: z.string().url().nullable(),
            taskId: z.string().nullable(),
            reconciliation: z
              .object({
                at: z.number().int(),
                previousStatus: z.enum(['processing', 'failed']),
                previousError: visualErrorSchema.nullable(),
                previousUpdatedAt: z.number().int(),
                expiresAt: z.number().int().optional(),
                sha256: z
                  .string()
                  .regex(/^[a-f0-9]{64}$/)
                  .optional(),
                mimeType: z.enum(['image/png', 'image/jpeg']).optional(),
                byteLength: z.number().int().positive().optional(),
              })
              .strict()
              .optional(),
            lastPollAt: z.number().int(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type VisualState = z.infer<typeof visualStateSchema>;
