import { authorizePlan } from './authorization.ts';
import { randomUUID } from 'node:crypto';
import {
  agentPlanSchema,
  agentRequestSchema,
  agentResponseSchema,
  createSessionRequestSchema,
  sessionViewSchema,
  toolCallSchema,
  type SessionView,
  type AgentPlan,
  type AgentResponse,
  type DecisionAction,
  type Product,
  type ShoppingSession,
  type StateChangeEvent,
  type ToolCall,
  type Comparison,
} from '@youcam/shared';
import { createSession, DecisionError, transition } from '@youcam/decision-engine';
import type { createCatalog } from '@youcam/catalog';
import { actionCall, interpretMockMessage } from './interpreter.ts';
export { interpretMockMessage } from './interpreter.ts';

export interface PlanningContext {
  clientRequestId?: string;
  productContext?: { productId: string; category: Product['category'] };
  message: string;
  state: ShoppingSession;
  recentMessages: { role: 'user' | 'assistant'; text: string }[];
  referencedProducts: Product[];
  tools: { name: string; description: string }[];
}
export interface Planner {
  readonly mode: 'mock' | 'live';
  plan(context: PlanningContext, signal: AbortSignal): Promise<unknown>;
}
export class AgentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
const descriptions: Record<ToolCall['name'], string> = {
  compare_products:
    'Compare exactly two catalog IDs against authoritative current criteria. No invented facts or winner.',
  create_dependency:
    'Create an explicit complement relationship from a selected catalog anchor to another category.',
  get_session_state: 'Read authoritative structured shopping state.',
  search_products:
    'Run deterministic catalog search under current constraints; never accepts product facts or ranking overrides.',
  request_vto:
    'Validate an explicitly requested catalog product and request the required image. This tool does not render or authorize invented results.',
  get_product: 'Look up one existing catalog ID; do not invent missing records.',
  update_constraints: 'Apply only explicit grounded user updates via the decision engine.',
  switch_category: 'Change active category while preserving scoped state.',
  reset_constraint: 'Reset only the explicitly requested field/scope.',
  select_product: 'Select a known eligible product.',
  shortlist_product: 'Shortlist a known product.',
  save_product: 'Save a known product without promoting preferences.',
  like_product: 'Record a known product as liked.',
  reject_product: 'Record session-scoped rejection and an optional structured reason.',
};
/** Actual argument validators are shared with plan validation; no provider-supplied executors. */
export const toolRegistry = Object.freeze(
  Object.fromEntries(
    toolCallSchema.options.map((schema) => {
      const name = schema.shape.name.value;
      return [
        name,
        Object.freeze({ description: descriptions[name], parameters: schema.shape.args }),
      ];
    }),
  ),
);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const questions = {
  anchor: 'Which selected product should anchor this search? Select a product, then name its ID.',
  category: 'Which category would you like: earrings, necklaces, rings, or watches?',
  instruction: 'Which shopping constraint or product would you like to change?',
  currency: 'Which currency should the budget use: USD or EUR?',
  confirmation: 'Which displayed relaxation proposal would you like to confirm?',
};
function toAction(call: ToolCall): DecisionAction | undefined {
  switch (call.name) {
    case 'create_dependency':
      return { type: 'create_dependency', dependency: call.args };
    case 'update_constraints':
      return { type: call.name, ...call.args };
    case 'switch_category':
      return { type: call.name, ...call.args };
    case 'reset_constraint':
      return { type: call.name, ...call.args };
    case 'reject_product':
      return { type: 'feedback', feedback: { action: 'reject', ...call.args } };
    case 'select_product':
    case 'save_product':
    case 'shortlist_product':
    case 'like_product': {
      const action = {
        select_product: 'select',
        save_product: 'save',
        shortlist_product: 'shortlist',
        like_product: 'like',
      } as const;
      return { type: 'feedback', feedback: { action: action[call.name], ...call.args } };
    }
  }
}
async function getPlan(provider: Planner, context: PlanningContext, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.plan(structuredClone(context), controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new AgentError(
              'PLANNER_UNAVAILABLE',
              'The shopping planner timed out. Please retry.',
              503,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError(
      'PLANNER_UNAVAILABLE',
      'The shopping planner is unavailable. Please retry.',
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Portable snapshot for server-side repository adapters; never accepted from client/tool input. */
export interface AgentSessionRecord {
  view: SessionView;
  history: PlanningContext['recentMessages'];
  replies: { id: string; request: string; response: AgentResponse }[];
}
/** In-memory executor; M5 server adapters restore/commit its validated snapshots transactionally. */
export function createAgentService(
  catalog: ReturnType<typeof createCatalog>,
  provider: Planner,
  options: { plannerTimeoutMs?: number } = {},
) {
  const timeout = options.plannerTimeoutMs ?? (provider.mode === 'live' ? 20_000 : 5000);
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30_000)
    throw new AgentError('INVALID_TIMEOUT', 'Planner timeout must be 1–30000 ms.');
  type View = ReturnType<typeof sessionViewSchema.parse>;
  interface Record {
    view: View;
    history: PlanningContext['recentMessages'];
    replies: Map<string, { request: string; response: AgentResponse }>;
  }
  const sessions = new Map<string, Record>();
  const load = (id: string) => {
    const record = sessions.get(id);
    if (!record) throw new AgentError('SESSION_NOT_FOUND', 'Shopping session not found.', 404);
    return record;
  };
  return {
    restore(snapshot: AgentSessionRecord) {
      const view = sessionViewSchema.parse(snapshot.view);
      if (
        !Array.isArray(snapshot.history) ||
        snapshot.history.length > 12 ||
        snapshot.history.some(
          (m) => !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string',
        )
      )
        throw new Error('Invalid stored history');
      if (
        !Array.isArray(snapshot.replies) ||
        snapshot.replies.length > 50 ||
        new Set(snapshot.replies.map((r) => r.id)).size !== snapshot.replies.length
      )
        throw new Error('Invalid stored replies');
      const replies: Record['replies'] = new Map();
      for (const entry of snapshot.replies) {
        const request = agentRequestSchema.parse(JSON.parse(entry.request));
        const response = agentResponseSchema.parse(entry.response);
        if (
          request.requestId !== entry.id ||
          response.session.state.id !== view.state.id ||
          response.session.version > view.version ||
          response.session.version !== request.expectedVersion + 1 ||
          response.events.some((event) => event.sessionId !== view.state.id)
        )
          throw new Error('Invalid stored replay');
        replies.set(entry.id, { request: JSON.stringify(request), response });
      }
      sessions.set(view.state.id, structuredClone({ view, history: snapshot.history, replies }));
    },
    snapshot(id: string): AgentSessionRecord {
      const record = load(id);
      return structuredClone({
        view: record.view,
        history: record.history,
        replies: [...record.replies].map(([id, entry]) => ({ id, ...entry })),
      });
    },
    create(raw: unknown = {}): View {
      const input = createSessionRequestSchema.parse(raw);
      if (sessions.size >= 1000)
        throw new AgentError('SESSION_CAPACITY', 'Mock session capacity reached.', 503);
      const state = createSession({ id: randomUUID(), goal: input.goal });
      const view = sessionViewSchema.parse({ state, version: 0, pendingRelaxations: [] });
      sessions.set(state.id, { view, history: [], replies: new Map() });
      return structuredClone(view);
    },
    get(id: string): View {
      return structuredClone(load(id).view);
    },
    async turn(id: string, rawRequest: unknown): Promise<AgentResponse> {
      const parsed = agentRequestSchema.safeParse(rawRequest);
      if (!parsed.success) throw new AgentError('INVALID_REQUEST', 'Invalid shopping request.');
      const request = parsed.data;
      const record = load(id);
      const cached = record.replies.get(request.requestId);
      if (cached) {
        if (!equal(JSON.parse(cached.request), request))
          throw new AgentError(
            'REQUEST_ID_CONFLICT',
            'This request ID was already used for different input.',
            409,
          );
        return structuredClone(cached.response);
      }
      if (request.expectedVersion !== record.view.version)
        throw new AgentError(
          'STALE_SESSION',
          'Refresh the session before retrying this action.',
          409,
        );
      let state = structuredClone(record.view.state);
      let plan: AgentPlan;
      if (request.type === 'confirm_relaxation') {
        const offer = record.view.pendingRelaxations.find(
          (p) => p.proposalId === request.proposalId,
        );
        if (!offer)
          throw new AgentError(
            'INVALID_CONFIRMATION',
            'This relaxation was not offered for the current session.',
            409,
          );
        const fresh = catalog
          .search(state)
          .relaxations.find(
            (p) => equal(p.updates, offer.updates) && equal(p.candidateIds, offer.candidateIds),
          );
        if (!fresh)
          throw new AgentError(
            'STALE_CONFIRMATION',
            'This relaxation is no longer available.',
            409,
          );
        plan = {
          disposition: 'execute',
          intent: 'refine_search',
          calls: [
            actionCall({ type: 'update_constraints', updates: fresh.updates }),
            { name: 'search_products', args: {} },
          ],
        };
      } else if (request.type === 'action') {
        if (
          request.action.type === 'update_constraints' &&
          request.action.updates.some((p) => p.source !== 'explicit')
        )
          throw new AgentError(
            'INVALID_PROVENANCE',
            'Direct user actions must carry explicit provenance.',
          );
        plan = {
          disposition: 'execute',
          intent:
            request.action.type === 'create_dependency'
              ? 'create_cross_product_search'
              : request.action.type === 'switch_category'
                ? 'switch_category'
                : request.action.type === 'reset_constraint'
                  ? 'reset_constraint'
                  : request.action.type === 'feedback'
                    ? `${request.action.feedback.action}_product`
                    : 'refine_search',
          calls: [actionCall(request.action), { name: 'search_products', args: {} }],
        };
      } else {
        // Independently ground allowed effects in the current supported user instruction.
        // History/model inference can never authorize additional explicit edits or confirmation.
        const contextProduct = request.productContext
          ? catalog.getProduct(request.productContext.productId)
          : undefined;
        if (
          request.productContext &&
          (!contextProduct || contextProduct.category !== state.activeCategory)
        )
          throw new AgentError(
            'UNGROUNDED_PLAN',
            'Product context must identify a catalog product in the active category.',
            422,
          );
        const productContext = contextProduct
          ? { productId: contextProduct.id, category: contextProduct.category }
          : undefined;
        const authorized = agentPlanSchema.parse(
          interpretMockMessage(request.message, state, productContext),
        );
        const mentioned = request.message.match(/\b[A-Za-z][\w-]*\b/g) ?? [];
        const referencedIds = [
          ...new Set([
            ...(contextProduct ? [contextProduct.id] : []),
            ...mentioned,
            ...Object.values(state.decisions).flatMap((d) => [...d.selected, ...d.rejected]),
          ]),
        ].slice(0, 100);
        const context: PlanningContext = {
          clientRequestId: request.requestId,
          ...(productContext ? { productContext } : {}),
          message: request.message,
          state,
          recentMessages: record.history.slice(-12),
          referencedProducts: referencedIds
            .flatMap((key) => {
              const p = catalog.getProduct(key);
              return p ? [p] : [];
            })
            .slice(0, 20),
          tools: Object.entries(toolRegistry).map(([name, entry]) => ({
            name,
            description: entry.description,
          })),
        };
        const proposed = agentPlanSchema.safeParse(await getPlan(provider, context, timeout));
        if (!proposed.success)
          throw new AgentError('INVALID_PLAN', 'The planner returned an invalid tool plan.', 502);
        plan = proposed.data;
        if (!authorizePlan(plan, authorized, state, catalog).allowed)
          throw new AgentError(
            'UNGROUNDED_PLAN',
            'The tool plan is not authorized by the current supported instruction.',
            422,
          );
      }
      const events: StateChangeEvent[] = [];
      let detail: Product | undefined;
      let comparison: Comparison | undefined;
      let visualProduct: Product | undefined;
      let searched = false;
      try {
        for (const rawCall of plan.calls) {
          const call = toolCallSchema.parse(rawCall);
          const action = toAction(call);
          if (action) {
            const result = transition(state, action, catalog);
            state = result.state;
            events.push(...result.events);
          } else if (call.name === 'compare_products') {
            comparison = catalog.compare(state, call.args.productIds);
          } else if (call.name === 'request_vto') {
            visualProduct = catalog.getProduct(call.args.productId);
            if (!visualProduct)
              throw new AgentError(
                'UNKNOWN_PRODUCT',
                'No catalog product exists for this ID.',
                404,
              );
          } else if (call.name === 'get_product') {
            detail = catalog.getProduct(call.args.productId);
            if (!detail)
              throw new AgentError(
                'UNKNOWN_PRODUCT',
                'No catalog product exists for this ID.',
                404,
              );
          } else if (call.name === 'search_products') {
            catalog.search(state);
            searched = true;
          }
          // get_session_state returns the committed final state in the response.
        }
      } catch (error) {
        if (error instanceof AgentError) throw error;
        if (error instanceof Error && error.name === 'CatalogError')
          throw new AgentError((error as Error & { code: string }).code, error.message, 422);
        if (error instanceof DecisionError) throw new AgentError(error.code, error.message, 422);
        throw new AgentError(
          'TOOL_FAILED',
          'The shopping action failed; no changes were saved.',
          422,
        );
      }
      // CAS after async planning: simultaneous turns cannot overwrite each other.
      if (load(id) !== record) {
        const completed = load(id).replies.get(request.requestId);
        if (completed?.request === JSON.stringify(request))
          return structuredClone(completed.response);
        throw new AgentError(
          'STALE_SESSION',
          'The session changed while planning. Refresh before retrying.',
          409,
        );
      }
      const results = catalog.search(state);
      const view = sessionViewSchema.parse({
        state,
        version: record.view.version + 1,
        pendingRelaxations: results.relaxations.map((r) => ({ ...r, proposalId: randomUUID() })),
      });
      const clarification =
        plan.disposition === 'clarify' || (searched && results.status === 'category_required');
      const status =
        plan.disposition === 'unsupported' ? 'unsupported' : clarification ? 'clarification' : 'ok';
      const message =
        status === 'unsupported'
          ? 'That capability is not implemented in this mock milestone. Your shopping state has not changed.'
          : clarification
            ? questions[plan.question ?? 'category']
            : comparison
              ? 'Compare the stored catalog facts and current criteria below. Ineligible or rejected items are not recommendations.'
              : visualProduct
                ? !visualProduct.vtoEligible
                  ? 'Try-on is not available for this product. You can still compare, save or select it.'
                  : 'Open try-on to provide the required image and explicitly start rendering. Your shopping decisions are unchanged.'
                : detail
                  ? 'Here are the stored catalog facts for this product.'
                  : searched
                    ? results.status === 'no_exact_match'
                      ? 'No exact catalog matches satisfy your current constraints. Any displayed relaxation requires your confirmation.'
                      : 'Here are the exact fixture catalog matches, ranked against your current preferences.'
                    : 'Here is your current structured shopping state.';
      const response = agentResponseSchema.parse({
        mode: provider.mode,
        status,
        intent: plan.intent,
        message:
          message +
          (searched &&
          plan.calls.some(
            (c) =>
              c.name === 'update_constraints' &&
              c.args.updates.some(
                (u) => u.field === 'styleTags' && u.value.includes('lightweight'),
              ),
          )
            ? ' Your lightweight preference is saved, but catalog weight is not verified.'
            : ''),
        session: view,
        events,
        ui: comparison
          ? { type: 'comparison', payload: comparison }
          : visualProduct && !visualProduct.vtoEligible
            ? { type: 'product_detail', payload: visualProduct }
            : visualProduct
              ? {
                  type: 'request_image',
                  payload: {
                    productId: visualProduct.id,
                    requiredType: (
                      {
                        earrings: 'portrait',
                        necklaces: 'portrait',
                        rings: 'hand',
                        watches: 'wrist',
                      } as const
                    )[visualProduct.category],
                  },
                }
              : detail
                ? { type: 'product_detail', payload: detail }
                : searched && !clarification
                  ? {
                      type: results.status === 'matches' ? 'product_list' : 'empty_state',
                      payload: results,
                    }
                  : { type: 'constraint_update', payload: state },
        tools: plan.calls.map((call) => ({ name: call.name, outcome: 'completed' })),
      });
      const text =
        request.type === 'message'
          ? request.message
          : request.type === 'confirm_relaxation'
            ? 'Confirmed a displayed relaxation.'
            : 'Submitted an explicit shopping action.';
      const history: PlanningContext['recentMessages'] = [
        ...record.history,
        { role: 'user', text },
        { role: 'assistant', text: message },
      ].slice(-12) as PlanningContext['recentMessages'];
      const replies = new Map(record.replies);
      replies.set(request.requestId, { request: JSON.stringify(request), response });
      while (replies.size > 50) replies.delete(replies.keys().next().value!);
      sessions.set(id, { view, history, replies });
      return structuredClone(response);
    },
  };
}
