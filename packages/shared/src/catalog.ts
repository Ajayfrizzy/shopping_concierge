import { z } from 'zod';
import {
  constraintInputSchema,
  idSchema,
  preferenceSourceSchema,
  productSchema,
} from './domain.ts';

export const catalogSchema = z.array(productSchema).superRefine((products, ctx) => {
  if (new Set(products.map((p) => p.id)).size !== products.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate catalog product ID' });
});
const weight = z.number().finite().int().min(0).max(1000);
export const scoringConfigSchema = z
  .object({
    style: weight.default(8),
    occasion: weight.default(6),
    intensity: weight.default(5),
    attribute: weight.default(4),
    price: weight.default(10),
    rejection: weight.default(8),
    complement: weight.default(4),
  })
  .strict();
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;
export const scoreTierSchema = z.enum([
  'explicit',
  'feedback',
  'saved_preference',
  'visual',
  'heuristic',
]);
export type ScoreTier = z.infer<typeof scoreTierSchema>;
export const rankingEvidenceSchema = z
  .object({
    signal: z.enum([
      'styleTags',
      'occasion',
      'visualIntensity',
      'material',
      'color',
      'pricePreference',
      'rejection',
      'complement',
    ]),
    tier: scoreTierSchema,
    contribution: z.number().finite(),
    attributes: z.array(z.string()),
    source: preferenceSourceSchema.optional(),
    feedbackProductId: idSchema.optional(),
    anchorProductId: idSchema.optional(),
  })
  .strict();
export type RankingEvidence = z.infer<typeof rankingEvidenceSchema>;
export const rankedProductSchema = z
  .object({
    product: productSchema,
    scores: z
      .object({
        explicit: z.number().finite(),
        feedback: z.number().finite(),
        saved_preference: z.number().finite(),
        visual: z.number().finite(),
        heuristic: z.number().finite(),
      })
      .strict(),
    evidence: z.array(rankingEvidenceSchema),
  })
  .strict();
export type RankedProduct = z.infer<typeof rankedProductSchema>;
export const relaxationSchema = z
  .object({
    requiresConfirmation: z.literal(true),
    updates: z.array(constraintInputSchema).min(1),
    candidateIds: z.array(idSchema).min(1),
  })
  .strict();
export type Relaxation = z.infer<typeof relaxationSchema>;
export const catalogSearchResultSchema = z
  .object({
    status: z.enum(['matches', 'no_exact_match', 'category_required']),
    exactMatches: z.array(rankedProductSchema),
    totalExactMatches: z.number().int().nonnegative(),
    relaxations: z.array(relaxationSchema),
  })
  .strict();
export type CatalogSearchResult = z.infer<typeof catalogSearchResultSchema>;
