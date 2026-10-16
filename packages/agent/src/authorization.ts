import type { AgentPlan, ShoppingSession, ConstraintInput } from '@youcam/shared';
import { transition } from '@youcam/decision-engine';
import type { createCatalog } from '@youcam/catalog';
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
function key(update: ConstraintInput) {
  return stable(
    update.field === 'styleTags' ? { ...update, value: [...update.value].sort() } : update,
  );
}
export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; rule: string; callIndex?: number };
/** Allow bounded equivalent search plans; simulate on a clone, never commit partial effects. */
export function authorizePlan(
  plan: AgentPlan,
  expected: AgentPlan,
  state: ShoppingSession,
  catalog: ReturnType<typeof createCatalog>,
): AuthorizationDecision {
  const deny = (rule: string, callIndex?: number): AuthorizationDecision => ({
    allowed: false,
    rule,
    callIndex,
  });
  if (
    !['start_search', 'refine_search'].includes(expected.intent) ||
    expected.disposition !== 'execute' ||
    expected.calls.some(
      (c) => !['switch_category', 'update_constraints', 'search_products'].includes(c.name),
    )
  )
    return stable(plan) === stable(expected)
      ? { allowed: true }
      : deny('instruction_plan_mismatch');
  if (
    plan.intent !== expected.intent ||
    plan.disposition !== 'execute' ||
    plan.question !== undefined
  )
    return deny('instruction_intent_mismatch');
  const categoryCall = expected.calls.find((c) => c.name === 'switch_category');
  const target = categoryCall?.args.category ?? state.activeCategory;
  const authorized = expected.calls.flatMap((c) =>
    c.name === 'update_constraints' ? c.args.updates : [],
  );
  const remaining = new Set(authorized.map(key));
  if (remaining.size !== authorized.length) return deny('ambiguous_expected_updates');
  let simulated = structuredClone(state),
    switched = false,
    searched = false,
    read = false;
  for (const [index, call] of plan.calls.entries()) {
    try {
      if (call.name === 'get_session_state') {
        if (read) return deny('duplicate_state_read', index);
        read = true;
        continue;
      }
      if (searched) return deny('call_after_search', index);
      if (call.name === 'switch_category') {
        if (switched || call.args.category !== target) return deny('unauthorized_category', index);
        simulated = transition(
          simulated,
          { type: 'switch_category', category: call.args.category },
          catalog,
        ).state;
        switched = true;
      } else if (call.name === 'update_constraints') {
        for (const update of call.args.updates) {
          const k = key(update);
          if (!remaining.delete(k)) return deny('unauthorized_or_duplicate_constraint', index);
        }
        simulated = transition(
          simulated,
          { type: 'update_constraints', updates: call.args.updates },
          catalog,
        ).state;
      } else if (call.name === 'search_products') {
        if (simulated.activeCategory !== target || !target || remaining.size)
          return deny('search_before_required_context', index);
        searched = true;
      } else return deny('unrequested_tool', index);
    } catch {
      return deny('invalid_simulated_transition', index);
    }
  }
  if (!searched || remaining.size) return deny('missing_required_search_or_constraints');
  return { allowed: true };
}
