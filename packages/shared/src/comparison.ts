import { z } from 'zod';
import { categorySchema, constraintInputSchema, idSchema, productSchema } from './domain.ts';
import { rankingEvidenceSchema } from './catalog.ts';
export const compareArgsSchema = z.object({ productIds: z.tuple([idSchema, idSchema]) }).strict();
export const comparisonSchema = z
  .object({
    category: categorySchema,
    criteria: z.array(constraintInputSchema),
    items: z.tuple([
      z
        .object({
          product: productSchema,
          eligible: z.boolean(),
          rejected: z.boolean(),
          violations: z.array(z.string()),
          evidence: z.array(rankingEvidenceSchema),
        })
        .strict(),
      z
        .object({
          product: productSchema,
          eligible: z.boolean(),
          rejected: z.boolean(),
          violations: z.array(z.string()),
          evidence: z.array(rankingEvidenceSchema),
        })
        .strict(),
    ]),
  })
  .strict();
export type Comparison = z.infer<typeof comparisonSchema>;
