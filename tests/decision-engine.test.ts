import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createSession,
  getActiveConstraints,
  getHardConstraintViolations,
  transition,
} from '@youcam/decision-engine';
import {
  shoppingSessionSchema,
  stateChangeEventSchema,
  type ConstraintInput,
  type Product,
  type ShoppingSession,
} from '@youcam/shared';

// Synthetic records for unit tests only, never a shopper-facing catalog.
const products: Product[] = [
  {
    id: 'test-E18',
    name: 'Test silver earrings',
    category: 'earrings',
    price: 80,
    currency: 'USD',
    material: 'silver',
    color: 'white',
    styleTags: ['elegant'],
    occasionTags: ['wedding'],
    imageUrl: 'https://fixtures.invalid/e18.jpg',
    vtoAssetUrl: null,
    inStock: true,
  },
  {
    id: 'test-E19',
    name: 'Test statement earrings',
    category: 'earrings',
    price: 100,
    currency: 'USD',
    material: 'gold',
    color: 'yellow',
    styleTags: ['statement', 'oversized', 'dangling'],
    occasionTags: ['party'],
    imageUrl: 'https://fixtures.invalid/e19.jpg',
    vtoAssetUrl: null,
    inStock: true,
  },
  {
    id: 'test-N1',
    name: 'Test necklace',
    category: 'necklaces',
    price: 90,
    currency: 'USD',
    material: 'silver',
    color: 'white',
    styleTags: ['elegant'],
    occasionTags: ['wedding'],
    imageUrl: 'https://fixtures.invalid/n1.jpg',
    vtoAssetUrl: null,
    inStock: true,
  },
];
const lookup = { getProduct: (id: string) => products.find((p) => p.id === id) };
const initial = () =>
  createSession({ id: 'session-test', goal: 'Wedding accessories', category: 'earrings' });
function update(state: ShoppingSession, ...updates: ConstraintInput[]) {
  return transition(state, { type: 'update_constraints', updates }).state;
}
const material = (
  value: string,
  scope: ConstraintInput['scope'] = 'global',
  source: ConstraintInput['source'] = 'explicit',
): ConstraintInput => ({ field: 'material', value, scope, source });
const values = (state: ShoppingSession) =>
  Object.fromEntries(
    Object.entries(getActiveConstraints(state).fields).map(([field, c]) => [
      field,
      c.preference.value,
    ]),
  );
const feedback = (state: ShoppingSession, action: string, productId = 'test-E18', more = {}) =>
  transition(state, { type: 'feedback', feedback: { action, productId, ...more } }, lookup);
function deepFreeze<T>(input: T): T {
  if (input && typeof input === 'object') {
    Object.freeze(input);
    for (const value of Object.values(input)) deepFreeze(value);
  }
  return input;
}

describe('M1 multi-turn structured regression fixtures', () => {
  const scenarios = JSON.parse(readFileSync('fixtures/m1-scenarios.json', 'utf8')) as {
    id: string;
    message: string;
    actions: unknown[];
    expected: { category: string; values: unknown };
  }[];
  // Each case replays the prefix independently, including a persistence round trip
  // between every turn. Text labels are not interpreted by a pretend LLM.
  for (const [index, scenario] of scenarios.entries()) {
    it(`${scenario.id}: ${scenario.message}`, () => {
      let state = createSession({ id: 'fixture-session' });
      for (const step of scenarios.slice(0, index + 1)) {
        for (const action of step.actions) state = transition(state, action).state;
        state = shoppingSessionSchema.parse(JSON.parse(JSON.stringify(state)));
      }
      expect(state.activeCategory).toBe(scenario.expected.category);
      expect(values(state)).toEqual(scenario.expected.values);
    });
  }
});

describe('constraint scope and precedence', () => {
  it('creates no invented category, budget, or style for an ambiguous goal', () => {
    const state = createSession({ id: 'new', goal: 'Something nice for Saturday' });
    expect(getActiveConstraints(state)).toEqual({ category: null, fields: {} });
  });
  it('replaces material without touching unrelated constraint records', () => {
    const before = update(initial(), material('silver'), {
      field: 'occasion',
      value: 'wedding',
      scope: 'global',
      source: 'explicit',
    });
    const result = transition(before, { type: 'update_constraints', updates: [material('gold')] });
    expect(result.state.constraints.filter((c) => c.preference.field === 'material')).toHaveLength(
      1,
    );
    expect(result.state.constraints.find((c) => c.preference.field === 'occasion')).toEqual(
      before.constraints.find((c) => c.preference.field === 'occasion'),
    );
    expect(result.changes.map((c) => c.field)).toEqual(['constraints.global:material:explicit']);
  });
  it('keeps category-specific budget changes out of other categories', () => {
    let state = update(initial(), {
      field: 'budget',
      value: { amount: 120, currency: 'USD' },
      source: 'explicit',
      scope: 'global',
    });
    state = update(state, {
      field: 'budget',
      value: { amount: 50, currency: 'USD' },
      source: 'explicit',
      scope: { category: 'earrings' },
    });
    expect(values(state).budget).toEqual({ amount: 50, currency: 'USD' });
    state = transition(state, { type: 'switch_category', category: 'necklaces' }).state;
    expect(values(state).budget).toEqual({ amount: 120, currency: 'USD' });
  });
  it('honors the latest explicit instruction across global and category scopes', () => {
    let state = update(initial(), material('silver', { category: 'earrings' }));
    state = update(state, material('gold'));
    expect(values(state).material).toBe('gold');
    state = update(state, material('silver', { category: 'earrings' }));
    expect(values(state).material).toBe('silver');
  });
  it('can reassert the same global preference over a newer category preference', () => {
    let state = update(initial(), material('silver'));
    state = update(state, material('gold', { category: 'earrings' }));
    state = update(state, material('silver'));
    expect(values(state).material).toBe('silver');
  });
  it.each(['saved_preference', 'visual', 'heuristic'] as const)(
    'explicit beats %s regardless of order or specificity',
    (source) => {
      for (const ordered of [
        [material('silver'), material('gold', { category: 'earrings' }, source)],
        [material('gold', { category: 'earrings' }, source), material('silver')],
      ]) {
        let state = initial();
        for (const p of ordered) state = update(state, p);
        expect(values(state).material).toBe('silver');
        expect(getActiveConstraints(state).fields.material?.class).toBe('hard');
      }
    },
  );
  it('never turns visual inference into a hard requirement', () => {
    const state = update(initial(), material('gold', 'global', 'visual'));
    expect(getActiveConstraints(state).fields.material?.class).toBe('soft');
    expect(getHardConstraintViolations(state, products[0])).toEqual([]);
  });
  it('resolves saved preferences above visual above heuristic signals', () => {
    let state = update(initial(), material('silver', 'global', 'visual'));
    state = update(state, material('gold', 'global', 'heuristic'));
    expect(values(state).material).toBe('silver');
    state = update(state, material('platinum', 'global', 'saved_preference'));
    expect(values(state).material).toBe('platinum');
  });
  it('unions global/scoped exclusions; reset only clears the named scope', () => {
    let state = update(
      initial(),
      { field: 'excludedTags', value: ['dangling'], scope: 'global', source: 'explicit' },
      {
        field: 'excludedTags',
        value: ['oversized'],
        scope: { category: 'earrings' },
        source: 'explicit',
      },
      material('silver'),
    );
    expect(values(state).excludedTags).toEqual(['dangling', 'oversized']);
    state = transition(state, {
      type: 'reset_constraint',
      field: 'excludedTags',
      scope: { category: 'earrings' },
    }).state;
    expect(values(state)).toEqual({ excludedTags: ['dangling'], material: 'silver' });
  });
  it('reset restores global fallback and preserves unrelated constraints', () => {
    let state = update(initial(), material('silver'), material('gold', { category: 'earrings' }));
    state = transition(state, {
      type: 'reset_constraint',
      field: 'material',
      scope: { category: 'earrings' },
    }).state;
    expect(values(state).material).toBe('silver');
  });
  it('rejects duplicate updates atomically and cannot partially apply invalid input', () => {
    const before = initial();
    const snapshot = JSON.stringify(before);
    expect(() =>
      transition(before, {
        type: 'update_constraints',
        updates: [material('silver'), material('gold')],
      }),
    ).toThrow('at most once');
    expect(() =>
      transition(before, {
        type: 'update_constraints',
        updates: [
          material('silver'),
          { field: 'budget', value: -1, scope: 'global', source: 'explicit' },
        ],
      }),
    ).toThrow();
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('decision memory and grounded transitions', () => {
  it('A13 retains independent category decisions across navigation and serialization', () => {
    let state = feedback(initial(), 'shortlist').state;
    state = feedback(state, 'select').state;
    state = transition(state, { type: 'switch_category', category: 'necklaces' }).state;
    state = feedback(state, 'save', 'test-N1').state;
    state = shoppingSessionSchema.parse(JSON.parse(JSON.stringify(state)));
    state = transition(state, { type: 'switch_category', category: 'earrings' }).state;
    expect(state.decisions.earrings?.selected).toEqual(['test-E18']);
    expect(state.decisions.earrings?.shortlisted).toEqual(['test-E18']);
    expect(state.decisions.necklaces?.saved).toEqual(['test-N1']);
  });
  it('A14 keeps structured rejection feedback session-only', () => {
    const state = feedback(initial(), 'reject', 'test-E19', {
      reasonCode: 'too_flashy',
      reasonText: 'Too much for work',
    }).state;
    expect(state.feedback[0]).toMatchObject({
      scope: 'session',
      input: { reasonCode: 'too_flashy', reasonText: 'Too much for work' },
    });
    expect(state.constraints).toEqual([]);
    expect(initial().feedback).toEqual([]);
    expect(() =>
      feedback(initial(), 'reject', 'test-E19', { reasonCode: 'too_flashy', scope: 'global' }),
    ).toThrow();
  });
  it('A16 saves twice with one relationship and one event', () => {
    const first = feedback(initial(), 'save');
    const second = feedback(first.state, 'save');
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual([]);
    expect(second.changes).toEqual([]);
    expect(second.state.feedback).toHaveLength(1);
    expect(second.state.decisions.earrings?.saved).toEqual(['test-E18']);
  });
  it('rejecting removes positive decisions but keeps the independent save and reason history', () => {
    let state = initial();
    for (const action of ['like', 'shortlist', 'select', 'save'])
      state = feedback(state, action).state;
    state = feedback(state, 'reject', 'test-E18', { reasonCode: 'too_plain' }).state;
    expect(state.decisions.earrings).toEqual({
      liked: [],
      shortlisted: [],
      selected: [],
      saved: ['test-E18'],
      rejected: ['test-E18'],
    });
    state = feedback(state, 'select').state;
    expect(state.decisions.earrings?.rejected).toEqual([]);
    expect(state.feedback.some((f) => f.input.action === 'reject')).toBe(true);
  });
  it('distinguishes likes, shortlist, save and selection', () => {
    for (const [action, field] of [
      ['like', 'liked'],
      ['shortlist', 'shortlisted'],
      ['save', 'saved'],
      ['select', 'selected'],
    ] as const) {
      const state = feedback(initial(), action).state;
      expect(state.decisions.earrings?.[field]).toEqual(['test-E18']);
      expect(Object.values(state.decisions.earrings!).flat()).toEqual(['test-E18']);
      expect(state.dependencies).toEqual([]);
    }
  });
  it('updates rejection reasons without duplicating rejected membership', () => {
    const one = feedback(initial(), 'reject', 'test-E18', { reasonCode: 'too_plain' });
    expect(feedback(one.state, 'reject', 'test-E18', { reasonCode: 'too_plain' }).events).toEqual(
      [],
    );
    const two = feedback(one.state, 'reject', 'test-E18', { reasonCode: 'wrong_style' });
    expect(two.state.decisions.earrings?.rejected).toEqual(['test-E18']);
    expect(two.state.feedback).toHaveLength(2);
  });
  it('rejects unknown/model-invented IDs and mismatched lookup results', () => {
    expect(() => feedback(initial(), 'select', 'invented')).toThrow('No catalog product');
    expect(() =>
      transition(initial(), {
        type: 'feedback',
        feedback: { action: 'save', productId: 'test-E18' },
      }),
    ).toThrow('No catalog product');
    expect(() =>
      transition(
        initial(),
        { type: 'feedback', feedback: { action: 'save', productId: 'test-E18' } },
        { getProduct: () => products[1] },
      ),
    ).toThrow('different product ID');
  });
  it('requires a matching active category for product decisions', () => {
    expect(() => feedback(initial(), 'select', 'test-N1')).toThrow('active category');
    expect(() => feedback(createSession({ id: 'empty' }), 'save')).toThrow('Choose a category');
  });
  it.each([
    { price: 121 },
    { currency: 'EUR' },
    { material: 'gold' },
    { material: undefined },
    { inStock: false },
    { color: 'yellow' },
    { styleTags: ['dangling'] },
  ])('cannot newly select a product that violates hard constraints: %j', (patch) => {
    const state = update(
      initial(),
      material('silver'),
      {
        field: 'budget',
        value: { amount: 120, currency: 'USD' },
        scope: 'global',
        source: 'explicit',
      },
      { field: 'color', value: 'white', scope: 'global', source: 'explicit' },
      { field: 'excludedTags', value: ['dangling'], scope: 'global', source: 'explicit' },
    );
    expect(() =>
      transition(
        state,
        { type: 'feedback', feedback: { action: 'select', productId: 'test-E18' } },
        { getProduct: () => ({ ...products[0]!, ...patch }) },
      ),
    ).toThrow('Selection violates');
    expect(getHardConstraintViolations(state, products[0])).toEqual([]);
  });
  it('rejects explicitly excluded product IDs', () => {
    const state = update(initial(), {
      field: 'excludedProductIds',
      value: ['test-E18'],
      scope: 'global',
      source: 'explicit',
    });
    expect(() => feedback(state, 'select')).toThrow('excludedProductIds');
  });
});

describe('events, immutability, and no-op semantics', () => {
  it('produces deterministic JSON-safe state and events without mutating inputs', () => {
    const before = deepFreeze(initial());
    const action = deepFreeze({ type: 'update_constraints', updates: [material('silver')] });
    const a = transition(before, action);
    const b = transition(before, action);
    expect(a).toEqual(b);
    expect(a.events).toHaveLength(1);
    expect(stateChangeEventSchema.parse(JSON.parse(JSON.stringify(a.events[0])))).toEqual(
      a.events[0],
    );
    expect(a.events[0]).toMatchObject({
      sessionId: before.id,
      revision: 1,
      changes: [
        {
          field: 'constraints.global:material:explicit',
          previous: null,
          current: { preference: material('silver'), revision: 1 },
        },
      ],
    });
    expect(before.constraints).toEqual([]);
    a.changes[0]!.field = 'changed by consumer';
    expect(a.state.recentChanges[0]!.field).toBe('constraints.global:material:explicit');
  });
  it('no-op actions do not increment revisions or emit events', () => {
    const state = update(initial(), material('silver'));
    for (const action of [
      { type: 'update_constraints', updates: [material('silver')] },
      { type: 'switch_category', category: 'earrings' },
      { type: 'reset_constraint', field: 'color', scope: 'global' },
    ]) {
      const result = transition(state, action);
      expect(result.state).toEqual(state);
      expect(result.events).toEqual([]);
      expect(result.changes).toEqual([]);
    }
  });
  it('records deletion with null and preserves unrelated slots', () => {
    const state = update(initial(), material('silver'));
    const result = transition(state, {
      type: 'reset_constraint',
      field: 'material',
      scope: 'global',
    });
    expect(result.changes[0]).toMatchObject({
      field: 'constraints.global:material:explicit',
      current: null,
    });
    expect(result.events[0]?.revision).toBe(2);
  });
});
