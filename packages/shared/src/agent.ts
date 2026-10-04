import { z } from 'zod';
import { compareArgsSchema, comparisonSchema } from './comparison.ts';
import { dependencySchema } from './domain.ts';
import {
  categorySchema,
  constraintInputSchema,
  constraintFieldSchema,
  constraintScopeSchema,
  decisionActionSchema,
  feedbackReasonSchema,
  idSchema,
  productSchema,
  shoppingSessionSchema,
  stateChangeEventSchema,
} from './domain.ts';
import { catalogSearchResultSchema, relaxationSchema } from './catalog.ts';

export const intentSchema = z.enum([
  'start_search',
  'refine_search',
  'switch_category',
  'select_product',
  'shortlist_product',
  'reject_product',
  'save_product',
  'like_product',
  'request_vto',
  'compare_products',
  'request_alternatives',
  'request_similar',
  'request_cheaper',
  'request_more_premium',
  'create_cross_product_search',
  'ask_product_question',
  'reset_constraint',
  'start_new_session',
  'clarify',
]);
const empty = z.object({}).strict();
const productArgs = z.object({ productId: idSchema }).strict();
export const toolCallSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('compare_products'), args: compareArgsSchema }).strict(),
  z.object({ name: z.literal('create_dependency'), args: dependencySchema }).strict(),
  z.object({ name: z.literal('get_session_state'), args: empty }).strict(),
  z.object({ name: z.literal('search_products'), args: empty }).strict(),
  z.object({ name: z.literal('get_product'), args: productArgs }).strict(),
  z.object({ name: z.literal('request_vto'), args: productArgs }).strict(),
  z
    .object({
      name: z.literal('update_constraints'),
      args: z.object({ updates: z.array(constraintInputSchema).min(1).max(50) }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal('switch_category'),
      args: z.object({ category: categorySchema }).strict(),
    })
    .strict(),
  z
    .object({
      name: z.literal('reset_constraint'),
      args: z.object({ field: constraintFieldSchema, scope: constraintScopeSchema }).strict(),
    })
    .strict(),
  z.object({ name: z.literal('select_product'), args: productArgs }).strict(),
  z.object({ name: z.literal('shortlist_product'), args: productArgs }).strict(),
  z.object({ name: z.literal('save_product'), args: productArgs }).strict(),
  z.object({ name: z.literal('like_product'), args: productArgs }).strict(),
  z
    .object({
      name: z.literal('reject_product'),
      args: z
        .object({
          productId: idSchema,
          reasonCode: feedbackReasonSchema.optional(),
          reasonText: z.string().trim().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict(),
]);
export type ToolCall = z.infer<typeof toolCallSchema>;
export const agentPlanSchema = z
  .object({
    intent: intentSchema,
    calls: z.array(toolCallSchema).max(8),
    disposition: z.enum(['execute', 'clarify', 'unsupported']),
    question: z.enum(['category', 'instruction', 'currency', 'confirmation', 'anchor']).optional(),
  })
  .strict();
export type AgentPlan = z.infer<typeof agentPlanSchema>;
const base = { requestId: idSchema, expectedVersion: z.number().int().safe().nonnegative() };
export const agentRequestSchema = z.discriminatedUnion('type', [
  z
    .object({ ...base, type: z.literal('message'), message: z.string().trim().min(1).max(2000) })
    .strict(),
  z.object({ ...base, type: z.literal('action'), action: decisionActionSchema }).strict(),
  z.object({ ...base, type: z.literal('confirm_relaxation'), proposalId: idSchema }).strict(),
]);
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export const offeredRelaxationSchema = relaxationSchema.extend({ proposalId: idSchema }).strict();
export const sessionViewSchema = z
  .object({
    state: shoppingSessionSchema,
    version: z.number().int().safe().nonnegative(),
    pendingRelaxations: z.array(offeredRelaxationSchema),
  })
  .strict();
export type SessionView = z.infer<typeof sessionViewSchema>;
export const agentResponseSchema = z
  .object({
    mode: z.enum(['mock', 'live']),
    status: z.enum(['ok', 'clarification', 'unsupported']),
    intent: intentSchema,
    message: z.string().min(1),
    session: sessionViewSchema,
    events: z.array(stateChangeEventSchema),
    ui: z.discriminatedUnion('type', [
      z.object({ type: z.literal('comparison'), payload: comparisonSchema }).strict(),
      z.object({ type: z.literal('product_list'), payload: catalogSearchResultSchema }).strict(),
      z.object({ type: z.literal('empty_state'), payload: catalogSearchResultSchema }).strict(),
      z.object({ type: z.literal('product_detail'), payload: productSchema }).strict(),
      z
        .object({
          type: z.literal('request_image'),
          payload: z
            .object({ productId: idSchema, requiredType: z.enum(['portrait', 'hand', 'wrist']) })
            .strict(),
        })
        .strict(),
      z.object({ type: z.literal('constraint_update'), payload: shoppingSessionSchema }).strict(),
    ]),
    tools: z.array(
      z
        .object({
          name: z.enum([
            'compare_products',
            'create_dependency',
            'get_session_state',
            'search_products',
            'get_product',
            'request_vto',
            'update_constraints',
            'switch_category',
            'reset_constraint',
            'select_product',
            'shortlist_product',
            'save_product',
            'like_product',
            'reject_product',
          ]),
          outcome: z.literal('completed'),
        })
        .strict(),
    ),
  })
  .strict();
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export const createSessionRequestSchema = z
  .object({ goal: z.string().trim().max(2000).default('') })
  .strict();
export const agentErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          'UNAUTHORIZED',
          'AUTH_UNAVAILABLE',
          'INVALID_TOKEN',
          'RATE_LIMITED',
          'STORAGE_UNAVAILABLE',
          'ASSET_NOT_FOUND',
          'ASSET_CONFLICT',
          'INVALID_REQUEST',
          'SESSION_NOT_FOUND',
          'SESSION_CAPACITY',
          'REQUEST_ID_CONFLICT',
          'STALE_SESSION',
          'INVALID_CONFIRMATION',
          'STALE_CONFIRMATION',
          'INVALID_PROVENANCE',
          'PLANNER_UNAVAILABLE',
          'INVALID_PLAN',
          'UNGROUNDED_PLAN',
          'TOOL_FAILED',
          'UNKNOWN_PRODUCT',
          'CATEGORY_REQUIRED',
          'CATEGORY_MISMATCH',
          'CONSTRAINT_VIOLATION',
          'DUPLICATE_UPDATE',
          'INVALID_DEPENDENCY',
          'INVALID_COMPARISON',
          'INTERNAL_ERROR',
        ]),
        message: z.string().min(1),
        recoverable: z.boolean(),
      })
      .strict(),
  })
  .strict();
