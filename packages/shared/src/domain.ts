import { z } from 'zod';

export const categorySchema = z.enum(['earrings', 'necklaces', 'rings', 'watches']);
export type Category = z.infer<typeof categorySchema>;
export const visualAssetTypeSchema = z.enum(['portrait', 'hand', 'wrist']);
export type VisualAssetType = z.infer<typeof visualAssetTypeSchema>;
export const idSchema = z.string().trim().min(1).max(128);
const tag = z.string().trim().min(1).max(100);
const tags = z
  .array(tag)
  .max(100)
  .refine((v) => new Set(v).size === v.length, 'Duplicate values');
const ids = z.array(idSchema).refine((v) => new Set(v).size === v.length, 'Duplicate IDs');
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const moneySchema = z
  .object({ amount: z.number().finite().nonnegative(), currency: currencySchema })
  .strict();
export const productSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1),
    category: categorySchema,
    price: z.number().finite().nonnegative(),
    currency: currencySchema,
    brand: tag.optional(),
    material: tag.optional(),
    color: tag.optional(),
    styleTags: tags,
    occasionTags: tags,
    description: z.string().optional(),
    imageUrl: z.string().url(),
    vtoEligible: z.boolean().optional(),
    vtoAssetUrl: z.string().url().nullable(),
    inStock: z.boolean(),
  })
  .strict();
export type Product = z.infer<typeof productSchema>;
export const feedbackReasonSchema = z.enum([
  'too_expensive',
  'too_flashy',
  'too_plain',
  'too_large',
  'too_small',
  'wrong_material',
  'wrong_color',
  'wrong_style',
  'wrong_occasion',
  'dislikes_shape',
  'owns_similar',
  'other',
]);
export type FeedbackReason = z.infer<typeof feedbackReasonSchema>;
export const constraintScopeSchema = z.union([
  z.literal('global'),
  z.object({ category: categorySchema }).strict(),
]);
export type ConstraintScope = z.infer<typeof constraintScopeSchema>;
export const preferenceSourceSchema = z.enum([
  'explicit',
  'saved_preference',
  'visual',
  'heuristic',
]);
export type PreferenceSource = z.infer<typeof preferenceSourceSchema>;
export const constraintFieldSchema = z.enum([
  'budget',
  'material',
  'color',
  'excludedProductIds',
  'excludedTags',
  'styleTags',
  'occasion',
  'visualIntensity',
  'pricePreference',
  'vtoOnly',
]);
export type ConstraintField = z.infer<typeof constraintFieldSchema>;
const provenance = { scope: constraintScopeSchema, source: preferenceSourceSchema };
const explicit = { scope: constraintScopeSchema, source: z.literal('explicit') };
// Field-specific values and provenance prevent malformed/inferred hard limits.
export const constraintInputSchema = z.discriminatedUnion('field', [
  z.object({ ...explicit, field: z.literal('vtoOnly'), value: z.boolean() }).strict(),
  z.object({ ...explicit, field: z.literal('budget'), value: moneySchema }).strict(),
  z.object({ ...provenance, field: z.literal('material'), value: tag }).strict(),
  z.object({ ...provenance, field: z.literal('color'), value: tag }).strict(),
  z.object({ ...explicit, field: z.literal('excludedProductIds'), value: ids }).strict(),
  z.object({ ...explicit, field: z.literal('excludedTags'), value: tags }).strict(),
  z.object({ ...provenance, field: z.literal('styleTags'), value: tags }).strict(),
  z.object({ ...provenance, field: z.literal('occasion'), value: tag }).strict(),
  z
    .object({
      ...provenance,
      field: z.literal('visualIntensity'),
      value: z.enum(['low', 'medium', 'high']),
    })
    .strict(),
  z
    .object({
      ...explicit,
      field: z.literal('pricePreference'),
      value: z.enum(['lower', 'higher']),
    })
    .strict(),
]);
export type ConstraintInput = z.infer<typeof constraintInputSchema>;
export const constraintSchema = z
  .object({ preference: constraintInputSchema, revision: z.number().int().safe().positive() })
  .strict();
export type Constraint = z.infer<typeof constraintSchema>;
export type ConstraintClass = 'hard' | 'soft' | 'context';

export const categoryDecisionSchema = z
  .object({
    liked: ids,
    shortlisted: ids,
    saved: ids,
    selected: ids,
    rejected: ids,
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      d.rejected.some(
        (id) => d.selected.includes(id) || d.liked.includes(id) || d.shortlisted.includes(id),
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Rejected products cannot also be selected, liked, or shortlisted',
      });
    }
  });
export type CategoryDecision = z.infer<typeof categoryDecisionSchema>;
export const feedbackActionSchema = z.enum(['like', 'shortlist', 'save', 'select', 'reject']);
const feedbackInputBase = { productId: idSchema };
export const feedbackInputSchema = z.discriminatedUnion('action', [
  z.object({ ...feedbackInputBase, action: z.literal('like') }).strict(),
  z.object({ ...feedbackInputBase, action: z.literal('shortlist') }).strict(),
  z.object({ ...feedbackInputBase, action: z.literal('save') }).strict(),
  z.object({ ...feedbackInputBase, action: z.literal('select') }).strict(),
  z
    .object({
      ...feedbackInputBase,
      action: z.literal('reject'),
      reasonCode: feedbackReasonSchema.optional(),
      reasonText: z.string().trim().min(1).max(1000).optional(),
    })
    .strict(),
]);
export const feedbackSchema = z
  .object({
    input: feedbackInputSchema,
    category: categorySchema,
    scope: z.literal('session'),
    revision: z.number().int().safe().positive(),
  })
  .strict();
export type Feedback = z.infer<typeof feedbackSchema>;
export const dependencySchema = z
  .object({
    anchorProductId: idSchema,
    anchorCategory: categorySchema,
    targetCategory: categorySchema,
    type: z.enum(['complement', 'alternative_to', 'match']),
  })
  .strict();
export type Dependency = z.infer<typeof dependencySchema>;
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);
export const stateChangeSchema = z
  .object({ field: z.string().min(1), previous: jsonValueSchema, current: jsonValueSchema })
  .strict();
export type StateChange = z.infer<typeof stateChangeSchema>;
export const decisionActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_dependency'), dependency: dependencySchema }).strict(),
  z
    .object({
      type: z.literal('update_constraints'),
      updates: z.array(constraintInputSchema).min(1).max(50),
    })
    .strict(),
  z
    .object({
      type: z.literal('reset_constraint'),
      field: constraintFieldSchema,
      scope: constraintScopeSchema,
    })
    .strict(),
  z.object({ type: z.literal('switch_category'), category: categorySchema }).strict(),
  z.object({ type: z.literal('feedback'), feedback: feedbackInputSchema }).strict(),
]);
export type DecisionAction = z.infer<typeof decisionActionSchema>;
export const stateChangeEventSchema = z
  .object({
    sessionId: idSchema,
    revision: z.number().int().safe().positive(),
    action: z.enum([
      'update_constraints',
      'reset_constraint',
      'switch_category',
      'feedback',
      'create_dependency',
    ]),
    changes: z.array(stateChangeSchema).min(1),
  })
  .strict();
export type StateChangeEvent = z.infer<typeof stateChangeEventSchema>;

export function scopeKey(scope: ConstraintScope): string {
  return scope === 'global' ? 'global' : scope.category;
}
export function constraintKey(c: ConstraintInput): string {
  return `${scopeKey(c.scope)}:${c.field}:${c.source}`;
}

export const shoppingSessionSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(1),
    revision: z.number().int().safe().nonnegative(),
    goal: z.string().trim().max(2000),
    activeCategory: categorySchema.nullable(),
    constraints: z.array(constraintSchema),
    decisions: z.record(categorySchema, categoryDecisionSchema),
    feedback: z.array(feedbackSchema),
    dependencies: z.array(dependencySchema),
    recentChanges: z.array(stateChangeSchema),
  })
  .strict()
  .superRefine((s, ctx) => {
    const keys = s.constraints.map((c) => constraintKey(c.preference));
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate constraint slot' });
    if (
      s.constraints.some((c) => c.revision > s.revision) ||
      s.feedback.some((f) => f.revision > s.revision)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Entry revision exceeds session revision' });
    }
    if (s.activeCategory !== null && !s.decisions[s.activeCategory])
      ctx.addIssue({ code: 'custom', message: 'Active category decision state is missing' });
    const productCategories = new Map<string, string>();
    for (const [category, decisions] of Object.entries(s.decisions)) {
      for (const id of Object.values(decisions).flat()) {
        if (productCategories.has(id) && productCategories.get(id) !== category)
          ctx.addIssue({ code: 'custom', message: 'Product assigned to multiple categories' });
        productCategories.set(id, category);
      }
    }
    for (const f of s.feedback) {
      if (productCategories.get(f.input.productId) !== f.category)
        ctx.addIssue({
          code: 'custom',
          message: 'Feedback product/category missing from decisions',
        });
    }
    const dependencies = s.dependencies.map(
      (d) => `${d.anchorCategory}:${d.anchorProductId}:${d.targetCategory}:${d.type}`,
    );
    if (new Set(dependencies).size !== dependencies.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate dependency' });
    for (const d of s.dependencies) {
      if (!s.decisions[d.anchorCategory]?.selected.includes(d.anchorProductId))
        ctx.addIssue({ code: 'custom', message: 'Dependency anchor must be selected' });
    }
  });
export type ShoppingSession = z.infer<typeof shoppingSessionSchema>;
