import { z } from 'zod';
import { vtoJobSchema, visualProfileSchema } from '@youcam/shared';
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
            lastPollAt: z.number().int(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type VisualState = z.infer<typeof visualStateSchema>;
