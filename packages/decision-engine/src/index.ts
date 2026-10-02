import {
  categorySchema, constraintKey, decisionActionSchema, productSchema, scopeKey,
  shoppingSessionSchema, stateChangeEventSchema,
  type Category, type CategoryDecision, type Constraint, type ConstraintClass,
  type ConstraintField, type ConstraintInput, type JsonValue, type PreferenceSource,
  type Product, type ShoppingSession, type StateChange, type StateChangeEvent,
} from '@youcam/shared';

export class DecisionError extends Error {
  constructor(readonly code: 'UNKNOWN_PRODUCT' | 'CATEGORY_REQUIRED' | 'CATEGORY_MISMATCH' | 'CONSTRAINT_VIOLATION' | 'DUPLICATE_UPDATE', message: string) {
    super(message); this.name = 'DecisionError';
  }
}
const sourcePriority: Record<PreferenceSource, number> = { explicit: 4, saved_preference: 3, visual: 2, heuristic: 1 };
const emptyDecision = (): CategoryDecision => ({ liked: [], shortlisted: [], saved: [], selected: [], rejected: [] });
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
const normalize = (value: string): string => value.toLowerCase();

export function createSession(input: { id: string; goal?: string; category?: Category }): ShoppingSession {
  return shoppingSessionSchema.parse({
    id: input.id, schemaVersion: 1, revision: 0, goal: input.goal ?? '', activeCategory: input.category ?? null,
    constraints: [], decisions: input.category ? { [input.category]: emptyDecision() } : {},
    feedback: [], dependencies: [], recentChanges: [],
  });
}
export function constraintClass(preference: ConstraintInput): ConstraintClass {
  if (preference.field === 'occasion') return 'context';
  return preference.source === 'explicit' && ['budget', 'material', 'color', 'excludedTags', 'excludedProductIds'].includes(preference.field) ? 'hard' : 'soft';
}
export interface ResolvedConstraint { preference: ConstraintInput; class: ConstraintClass; evidence: Constraint[] }
export interface ActiveConstraints { category: Category | null; fields: Partial<Record<ConstraintField, ResolvedConstraint>> }

/** Resolve from structured state, never from a chat transcript. No mutation. */
export function getActiveConstraints(rawState: unknown, category?: Category): ActiveConstraints {
  const state = shoppingSessionSchema.parse(rawState);
  const active = category === undefined ? state.activeCategory : categorySchema.parse(category);
  const applicable = state.constraints.filter(({ preference: p }) => p.scope === 'global' || p.scope.category === active);
  const fields: ActiveConstraints['fields'] = {};
  for (const constraint of applicable) {
    const p = constraint.preference;
    const previous = fields[p.field];
    const winner = previous?.evidence[0];
    if (!winner || sourcePriority[p.source] > sourcePriority[winner.preference.source]
      || (sourcePriority[p.source] === sourcePriority[winner.preference.source]
        && (constraint.revision > winner.revision
          || (constraint.revision === winner.revision && p.scope !== 'global')))) {
      fields[p.field] = { preference: p, class: constraintClass(p), evidence: [constraint] };
    }
  }
  // Exclusions accumulate across applicable scopes. A scoped update cannot silently
  // remove a global exclusion; reset/replace the originating scope explicitly.
  for (const field of ['excludedTags', 'excludedProductIds'] as const) {
    const evidence = applicable.filter((c) => c.preference.field === field);
    const first = evidence[0];
    if (first) {
      const values = evidence.flatMap((c) => c.preference.field === field ? c.preference.value : []);
      fields[field] = {
        preference: { field, source: 'explicit', scope: first.preference.scope, value: [...new Set(values)].sort() },
        class: 'hard', evidence,
      };
    }
  }
  return { category: active, fields };
}

/** Eligibility guard shared with catalog filtering; no scoring or search. */
export function getHardConstraintViolations(rawState: unknown, rawProduct: unknown): string[] {
  const product = productSchema.parse(rawProduct);
  const active = getActiveConstraints(rawState);
  const violations: string[] = [];
  if (!active.category || product.category !== active.category) violations.push('category');
  if (!product.inStock) violations.push('inStock');
  for (const item of Object.values(active.fields)) {
    if (item.class !== 'hard') continue;
    const p = item.preference;
    switch (p.field) {
      case 'budget':
        if (product.currency !== p.value.currency || product.price > p.value.amount) violations.push('budget');
        break;
      case 'material': case 'color':
        if (normalize(product[p.field] ?? '') !== normalize(p.value)) violations.push(p.field);
        break;
      case 'excludedProductIds': if (p.value.includes(product.id)) violations.push(p.field); break;
      case 'excludedTags': if (product.styleTags.some((t) => p.value.some((v) => normalize(v) === normalize(t)))) violations.push(p.field); break;
    }
  }
  return violations;
}

export interface TransitionContext {
  /** Backend-owned lookup. Do not populate this from model-provided product objects. */
  getProduct?: (id: string) => Product | undefined;
}
export interface TransitionResult { state: ShoppingSession; events: StateChangeEvent[]; changes: StateChange[] }

/** Validates and clones both inputs; emits one event per actual atomic transition. */
export function transition(rawState: unknown, rawAction: unknown, context: TransitionContext = {}): TransitionResult {
  const before = shoppingSessionSchema.parse(rawState);
  const state = shoppingSessionSchema.parse(before);
  const action = decisionActionSchema.parse(rawAction);
  const revision = state.revision + 1;
  switch (action.type) {
    case 'update_constraints': {
      const keys = action.updates.map(constraintKey);
      if (new Set(keys).size !== keys.length) throw new DecisionError('DUPLICATE_UPDATE', 'Update each field/source/scope at most once per action.');
      for (const preference of action.updates) {
        const index = state.constraints.findIndex((c) => constraintKey(c.preference) === constraintKey(preference));
        const previous = state.constraints[index];
        const reassertsOverNewerScope = previous && state.constraints.some((c) =>
          c.preference.field === preference.field && c.preference.source === preference.source
          && c.revision > previous.revision && !equal(c.preference.value, preference.value)
          && (c.preference.scope === 'global' || preference.scope === 'global'
            || scopeKey(c.preference.scope) === scopeKey(preference.scope)));
        if (previous && equal(previous.preference, preference) && !reassertsOverNewerScope) continue;
        const next = { preference, revision };
        if (index === -1) state.constraints.push(next); else state.constraints[index] = next;
      }
      break;
    }
    case 'reset_constraint':
      state.constraints = state.constraints.filter(({ preference }) => preference.field !== action.field || scopeKey(preference.scope) !== scopeKey(action.scope));
      break;
    case 'switch_category':
      state.activeCategory = action.category;
      state.decisions[action.category] ??= emptyDecision();
      break;
    case 'feedback': {
      const input = action.feedback;
      const found = context.getProduct?.(input.productId);
      if (!found) throw new DecisionError('UNKNOWN_PRODUCT', `No catalog product exists for ${input.productId}.`);
      const product = productSchema.parse(found);
      if (product.id !== input.productId) throw new DecisionError('UNKNOWN_PRODUCT', 'Catalog lookup returned a different product ID.');
      if (!state.activeCategory) throw new DecisionError('CATEGORY_REQUIRED', 'Choose a category before recording product feedback.');
      if (product.category !== state.activeCategory) throw new DecisionError('CATEGORY_MISMATCH', 'Product does not belong to the active category.');
      if (input.action === 'select') {
        const violations = getHardConstraintViolations(state, product);
        if (violations.length) throw new DecisionError('CONSTRAINT_VIOLATION', `Selection violates: ${violations.join(', ')}.`);
      }
      const decisions = state.decisions[product.category]!;
      const field = { like: 'liked', shortlist: 'shortlisted', save: 'saved', select: 'selected', reject: 'rejected' } as const;
      const target = decisions[field[input.action]];
      const latest = [...state.feedback].reverse().find((f) => f.input.productId === product.id && f.input.action === input.action);
      // Saving is an independent relationship. Identical active feedback is idempotent.
      if (target.includes(product.id) && (input.action !== 'reject' || equal(latest?.input, input))) break;
      if (input.action === 'reject') {
        for (const key of ['liked', 'shortlisted', 'selected'] as const) decisions[key] = decisions[key].filter((id) => id !== product.id);
        state.dependencies = state.dependencies.filter((d) => d.anchorProductId !== product.id);
      } else if (input.action !== 'save') {
        decisions.rejected = decisions.rejected.filter((id) => id !== product.id);
      }
      if (!target.includes(product.id)) target.push(product.id);
      state.feedback.push({ input, category: product.category, scope: 'session', revision });
      break;
    }
  }
  const changes: StateChange[] = [];
  const change = (field: string, previous: unknown, current: unknown) => {
    if (!equal(previous, current)) changes.push({ field, previous: json(previous), current: json(current) });
  };
  change('activeCategory', before.activeCategory, state.activeCategory);
  // Emit field-level constraint changes, including provenance; no hidden reasoning.
  const slots = [...new Set([...before.constraints, ...state.constraints].map((c) => constraintKey(c.preference)))].sort();
  for (const slot of slots) change(`constraints.${slot}`,
    before.constraints.find((c) => constraintKey(c.preference) === slot) ?? null,
    state.constraints.find((c) => constraintKey(c.preference) === slot) ?? null);
  for (const category of categorySchema.options) change(`decisions.${category}`, before.decisions[category] ?? null, state.decisions[category] ?? null);
  change('feedback', before.feedback, state.feedback);
  change('dependencies', before.dependencies, state.dependencies);
  if (!changes.length) return { state: before, events: [], changes: [] };
  state.revision = revision;
  state.recentChanges = changes;
  const event = stateChangeEventSchema.parse({ sessionId: state.id, revision, action: action.type, changes });
  return { state: shoppingSessionSchema.parse(state), events: [event], changes: event.changes };
}
