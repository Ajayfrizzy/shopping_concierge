import { describe, expect, it } from 'vitest';
import { createCatalog } from '@youcam/catalog';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { createSession, getActiveConstraints, getHardConstraintViolations, transition } from '@youcam/decision-engine';
import { catalogSchema, catalogSearchResultSchema, categorySchema, type ConstraintInput, type Product, type ShoppingSession } from '@youcam/shared';
import { fixtureProducts } from '../fixtures/catalog.ts';
import { readFileSync } from 'node:fs';

const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  id, name: `Test ${id}`, category: 'earrings', price: 80, currency: 'USD', material: 'silver', color: 'silver',
  styleTags: ['elegant', 'understated'], occasionTags: ['wedding'], imageUrl: 'https://fixtures.invalid/test.png', vtoAssetUrl: null, inStock: true, ...overrides,
});
const initial = () => createSession({ id: 'catalog-test', category: 'earrings' });
const update = (state: ShoppingSession, ...updates: ConstraintInput[]) => transition(state, { type: 'update_constraints', updates }).state;
const material = (value: string): ConstraintInput => ({ field: 'material', value, source: 'explicit', scope: 'global' });
const budget = (amount: number, currency = 'USD'): ConstraintInput => ({ field: 'budget', value: { amount, currency }, source: 'explicit', scope: 'global' });
const ids = (result: ReturnType<ReturnType<typeof createCatalog>['search']>) => result.exactMatches.map((v) => v.product.id);
const fixture = createFixtureCatalog();
function feedback(catalog: ReturnType<typeof createCatalog>, state: ShoppingSession, input: unknown) {
  return transition(state, { type: 'feedback', feedback: input }, catalog).state;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

describe('M2 fixture and lookup boundary', () => {
  it('has 72 validated unique synthetic products, balanced across four categories', () => {
    expect(catalogSchema.parse(fixtureProducts)).toHaveLength(72);
    for (const category of categorySchema.options) {
      const products = fixtureProducts.filter((p) => p.category === category);
      expect(products).toHaveLength(18);
      expect(new Set(products.map((p) => p.price)).size).toBeGreaterThan(10);
      expect(new Set(products.map((p) => p.material)).size).toBeGreaterThanOrEqual(4);
      expect(products.some((p) => !p.inStock)).toBe(true);
      expect(products.every((p) => p.name.startsWith('Fixture ') && p.vtoAssetUrl === null)).toBe(true);
    }
    expect(fixture.getProduct('E18')?.category).toBe('earrings');
    expect(fixture.getProduct('unknown')).toBeUndefined();
  });
  it('rejects duplicate IDs and malformed catalog records', () => {
    expect(() => createCatalog([product('x'), product('x')])).toThrow(/Duplicate/);
    expect(() => createCatalog([product('x', { price: NaN })])).toThrow();
    expect(() => createCatalog([{ ...product('x'), invented: true }])).toThrow();
  });
  it('owns a private snapshot and returns detached products/results', () => {
    const input = [product('x')];
    const catalog = createCatalog(input);
    input[0]!.price = 999;
    catalog.getProduct('x')!.price = 1000;
    const result = catalog.search(initial());
    result.exactMatches[0]!.product.styleTags.push('corrupted');
    expect(catalog.getProduct('x')).toEqual(product('x'));
  });
  it('requires a category without inventing one from free text', () => {
    expect(fixture.search(createSession({ id: 'ambiguous', goal: 'Something nice for Saturday' }))).toEqual({ status: 'category_required', exactMatches: [], totalExactMatches: 0, relaxations: [] });
  });
});

describe('M2 exact matches obey every hard rule', () => {
  const cases: [string, Partial<Product>, ConstraintInput[]][] = [
    ['category', { category: 'rings' }, []],
    ['stock', { inStock: false }, []],
    ['maximum budget', { price: 81 }, [budget(80)]],
    ['currency mismatch', { currency: 'EUR' }, [budget(120)]],
    ['material', { material: 'gold' }, [material('silver')]],
    ['unknown material', { material: undefined }, [material('silver')]],
    ['plated is not solid', { material: 'silver plated' }, [material('silver')]],
    ['color', { color: 'gold' }, [{ field: 'color', value: 'silver', source: 'explicit', scope: 'global' }]],
    ['excluded ID', {}, [{ field: 'excludedProductIds', value: ['bad'], source: 'explicit', scope: 'global' }]],
    ['excluded tag', { styleTags: ['DANGLING'] }, [{ field: 'excludedTags', value: ['dangling'], source: 'explicit', scope: 'global' }]],
  ];
  it.each(cases)('filters %s before all scoring', (_, overrides, constraints) => {
    const state = constraints.length ? update(initial(), ...constraints) : initial();
    const result = createCatalog([product('bad', overrides), product('good')]).search(state);
    expect(ids(result)).toEqual(['good']);
    expect(result.relaxations).toEqual([]);
  });
  it('includes exact boundary prices and case-insensitive known attributes', () => {
    const state = update(initial(), budget(80), material('SILVER'));
    expect(ids(createCatalog([product('x')]).search(state))).toEqual(['x']);
  });
  it('exhaustively checks fixture results against independent hard predicates across scopes', () => {
    for (const category of categorySchema.options) for (const amount of [0, 55, 100, 250]) for (const mat of ['silver', 'gold', 'steel']) {
      const state = update(createSession({ id: 'matrix', category }), budget(amount), material(mat),
        { field: 'excludedTags', value: ['statement'], source: 'explicit', scope: 'global' },
        { field: 'excludedTags', value: ['dangling'], source: 'explicit', scope: { category: 'earrings' } });
      const actual = fixture.search(state, {}, { limit: 100 });
      const expected = fixtureProducts.filter((p) => p.category === category && p.inStock && p.currency === 'USD' && p.price <= amount && p.material === mat && !p.styleTags.includes('statement') && !(category === 'earrings' && p.styleTags.includes('dangling')));
      expect(ids(actual).sort()).toEqual(expected.map((p) => p.id).sort());
      expect(actual.totalExactMatches).toBe(expected.length);
    }
  });
  it('A15 explicit hard material wins even over extreme inferred scoring', () => {
    const state = update(initial(), material('silver'), { field: 'material', value: 'gold', source: 'visual', scope: { category: 'earrings' } });
    const result = fixture.search(state, { attribute: 1000 });
    expect(result.totalExactMatches).toBeGreaterThan(0);
    expect(result.exactMatches.every((p) => p.product.material === 'silver')).toBe(true);
  });
});

describe('weighted ranking and determinism', () => {
  it('style/occasion weights change ranking and expose grounded evidence', () => {
    const catalog = createCatalog([product('style', { styleTags: ['modern'], occasionTags: [] }), product('occasion', { styleTags: [], occasionTags: ['work'] })]);
    const state = update(initial(), { field: 'styleTags', value: ['modern'], source: 'explicit', scope: 'global' }, { field: 'occasion', value: 'work', source: 'explicit', scope: 'global' });
    expect(ids(catalog.search(state))).toEqual(['style', 'occasion']);
    expect(ids(catalog.search(state, { occasion: 20 }))).toEqual(['occasion', 'style']);
    expect(catalog.search(state).exactMatches[0]!.evidence).toContainEqual({ signal: 'styleTags', tier: 'explicit', source: 'explicit', contribution: 8, attributes: ['modern'] });
  });
  it('A02 cheaper ranks lower same-currency prices without changing budget/state', () => {
    const state = update(initial(), budget(120), material('silver'), { field: 'pricePreference', value: 'lower', source: 'explicit', scope: { category: 'earrings' } });
    const before = JSON.stringify(state);
    const result = fixture.search(freeze(state));
    const prices = result.exactMatches.map((p) => p.product.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(JSON.stringify(state)).toBe(before);
  });
  it('higher price preference is soft and cannot exceed the explicit cap', () => {
    const state = update(initial(), budget(90), { field: 'pricePreference', value: 'higher', source: 'explicit', scope: 'global' });
    expect(ids(createCatalog([product('a', { price: 20 }), product('b', { price: 90 }), product('c', { price: 100 })]).search(state))).toEqual(['b', 'a']);
  });
  it('never compares numerical prices between currencies', () => {
    const state = update(initial(), { field: 'pricePreference', value: 'lower', source: 'explicit', scope: 'global' });
    const result = createCatalog([product('a', { price: 1, currency: 'EUR' }), product('b', { price: 100, currency: 'USD' })]).search(state);
    expect(result.exactMatches.every((p) => p.scores.explicit === 0)).toBe(true);
  });
  it('scores visual intensity only from documented catalog tags', () => {
    const state = update(initial(), { field: 'visualIntensity', value: 'low', source: 'explicit', scope: 'global' });
    const result = createCatalog([product('a', { styleTags: ['statement'] }), product('b', { styleTags: ['minimal'] })]).search(state);
    expect(ids(result)).toEqual(['b', 'a']);
    expect(result.exactMatches[0]!.evidence[0]!.attributes).toEqual(['minimal']);
  });
  it('saved preference outranks visual/heuristic scores regardless of weights', () => {
    const state = update(initial(), { field: 'styleTags', value: ['modern'], source: 'saved_preference', scope: 'global' }, { field: 'color', value: 'gold', source: 'visual', scope: 'global' });
    expect(ids(createCatalog([product('a', { styleTags: [], color: 'gold' }), product('b', { styleTags: ['modern'] })]).search(state, { attribute: 1000, style: 1 }))).toEqual(['b', 'a']);
  });
  it('is deterministic across repeats, catalog permutations, JSON restoration and ties', () => {
    const state = update(initial(), { field: 'styleTags', value: ['elegant'], source: 'explicit', scope: 'global' });
    const expected = fixture.search(state);
    expect(createCatalog([...fixtureProducts].reverse()).search(JSON.parse(JSON.stringify(state)))).toEqual(expected);
    expect(fixture.search(state)).toEqual(expected);
    expect(ids(createCatalog([product('z'), product('A'), product('a')]).search(initial()))).toEqual(['A', 'a', 'z']);
  });
  it('limits results after ranking and reports the untruncated total', () => {
    const result = fixture.search(initial(), {}, { limit: 2 });
    expect(result.exactMatches).toHaveLength(2);
    expect(result.totalExactMatches).toBe(17);
    expect(result.relaxations).toEqual([]);
  });
  it.each([{ style: -1 }, { price: Infinity }, { rejection: NaN }, { occasion: 0.2 }, { unknown: 1 }])('rejects invalid scoring config %j', (config) => {
    expect(() => fixture.search(initial(), config)).toThrow();
  });
  it('rejects invalid state and result limits', () => {
    expect(() => fixture.search({})).toThrow();
    expect(() => fixture.search(initial(), {}, { limit: 0 })).toThrow();
    expect(() => fixture.search(initial(), {}, { maxRelaxations: -1 })).toThrow();
  });
});

describe('A06/A14 rejection ranking remains session-scoped', () => {
  const catalog = createCatalog([
    product('rejected', { styleTags: ['statement', 'oversized'] }),
    product('a-similar', { styleTags: ['statement', 'oversized'] }),
    product('z-quiet', { styleTags: ['minimal'] }),
    product('n', { category: 'necklaces', styleTags: ['statement'] }),
  ]);
  const reject = (state = initial(), reasonCode = 'too_flashy') => feedback(catalog, state, { action: 'reject', productId: 'rejected', reasonCode });
  it('penalizes similar tags, excludes the rejected item, and keeps factual evidence', () => {
    expect(ids(catalog.search(initial()))[0]).toBe('a-similar');
    const result = catalog.search(reject());
    expect(ids(result)).toEqual(['z-quiet', 'a-similar']);
    expect(result.exactMatches[1]!.evidence).toContainEqual({ signal: 'rejection', tier: 'feedback', contribution: -8, attributes: ['oversized', 'statement'], feedbackProductId: 'rejected' });
  });
  it('explicit current style preferences outrank contradictory feedback', () => {
    const state = update(reject(), { field: 'styleTags', value: ['statement'], source: 'explicit', scope: 'global' });
    expect(ids(catalog.search(state, { rejection: 1000, style: 1 }))[0]).toBe('a-similar');
  });
  it('does not leak rejection into another session or category', () => {
    const state = reject();
    const switched = transition(state, { type: 'switch_category', category: 'necklaces' }).state;
    expect(catalog.search(switched).exactMatches[0]!.scores.feedback).toBe(0);
    expect(ids(catalog.search(initial()))[0]).toBe('a-similar');
    expect(ids(catalog.search(transition(switched, { type: 'switch_category', category: 'earrings' }).state))).toEqual(['z-quiet', 'a-similar']);
  });
  it('uses only the latest active rejection reason, not every historical event', () => {
    const updated = reject(reject(), 'other');
    expect(ids(catalog.search(updated))).toEqual(['a-similar', 'z-quiet']);
    expect(catalog.search(updated).exactMatches.every((p) => p.scores.feedback === 0)).toBe(true);
  });
  it('positive reversal removes old penalties, while saving alone does not', () => {
    const saved = feedback(catalog, reject(), { action: 'save', productId: 'rejected' });
    expect(ids(catalog.search(saved))).toEqual(['z-quiet', 'a-similar']);
    const liked = feedback(catalog, saved, { action: 'like', productId: 'rejected' });
    expect(catalog.search(liked).exactMatches.every((p) => p.scores.feedback === 0)).toBe(true);
    expect(ids(catalog.search(liked))).toContain('rejected');
  });
  it.each(['other', 'owns_similar', undefined])('does not infer attribute dislikes from reason %s', (reasonCode) => {
    const state = feedback(catalog, initial(), { action: 'reject', productId: 'rejected', ...(reasonCode ? { reasonCode } : {}) });
    expect(catalog.search(state).exactMatches.every((p) => !p.evidence.length)).toBe(true);
  });
  it.each([
    ['too_plain', { styleTags: ['minimal'] }], ['too_large', { styleTags: ['large'] }], ['too_small', { styleTags: ['small'] }],
    ['wrong_style', { styleTags: ['modern'] }], ['wrong_occasion', { occasionTags: ['work'] }], ['dislikes_shape', { styleTags: ['square'] }],
    ['wrong_material', { material: 'gold' }], ['wrong_color', { color: 'black' }], ['too_expensive', { price: 120 }],
  ] as [string, Partial<Product>][])('grounds %s in catalog facts', (reasonCode, attributes) => {
    const local = createCatalog([product('r', attributes), product('similar', attributes)]);
    const state = feedback(local, initial(), { action: 'reject', productId: 'r', reasonCode });
    expect(local.search(state).exactMatches[0]!.scores.feedback).toBe(-8);
  });
  it('missing catalog feedback records cannot fabricate scoring facts', () => {
    const state = reject();
    expect(createCatalog([product('a-similar')]).search(state).exactMatches[0]!.evidence).toEqual([]);
  });
});

describe('A07 honest no-match and actionable relaxation proposals', () => {
  it('returns no violating exact matches; every proposal requires confirmation and is feasible', () => {
    const state = update(initial(), material('platinum'), budget(1));
    const before = JSON.stringify(state);
    const result = fixture.search(state);
    expect(result.status).toBe('no_exact_match');
    expect(result.exactMatches).toEqual([]);
    expect(result.relaxations.length).toBeGreaterThan(0);
    for (const option of result.relaxations) {
      expect(option.requiresConfirmation).toBe(true);
      const accepted = update(state, ...option.updates);
      for (const id of option.candidateIds) expect(getHardConstraintViolations(accepted, fixture.getProduct(id))).toEqual([]);
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(createCatalog([...fixtureProducts].reverse()).search(state)).toEqual(result);
    expect(catalogSearchResultSchema.parse(result)).toEqual(result);
  });
  it('proposes an exact catalog budget, preserving unrelated constraints', () => {
    const catalog = createCatalog([product('x', { price: 80 })]);
    const state = update(initial(), material('silver'), budget(20));
    const proposal = catalog.search(state).relaxations[0]!;
    expect(proposal.updates).toEqual([{ field: 'budget', value: { amount: 80, currency: 'USD' }, source: 'explicit', scope: { category: 'earrings' } }]);
    expect(getActiveConstraints(update(state, ...proposal.updates)).fields.material!.preference.value).toBe('silver');
  });
  it('removes only blocking exclusions from all contributing scopes', () => {
    const state = update(initial(),
      { field: 'excludedTags', value: ['dangling', 'oversized'], source: 'explicit', scope: 'global' },
      { field: 'excludedTags', value: ['dangling', 'plain'], source: 'explicit', scope: { category: 'earrings' } },
      { field: 'excludedProductIds', value: ['x', 'unrelated'], source: 'explicit', scope: 'global' });
    const catalog = createCatalog([product('x', { styleTags: ['dangling'] })]);
    const result = catalog.search(state);
    expect(result.exactMatches).toEqual([]);
    const next = update(state, ...result.relaxations[0]!.updates);
    expect(getActiveConstraints(next).fields.excludedTags!.preference.value).toEqual(['oversized', 'plain']);
    expect(getActiveConstraints(next).fields.excludedProductIds!.preference.value).toEqual(['unrelated']);
    expect(ids(catalog.search(next))).toEqual(['x']);
  });
  it.each([
    ['stock', { inStock: false }], ['category', { category: 'watches' }], ['currency', { currency: 'EUR' }], ['unknown material', { material: undefined }],
  ] as [string, Partial<Product>][])('never silently relaxes %s', (_, override) => {
    const result = createCatalog([product('x', override)]).search(update(initial(), material('silver'), budget(1)));
    expect(result).toEqual({ status: 'no_exact_match', exactMatches: [], totalExactMatches: 0, relaxations: [] });
  });
  it('does not suggest resurrecting rejected products or fabricate empty-catalog results', () => {
    const catalog = createCatalog([product('x')]);
    const state = feedback(catalog, initial(), { action: 'reject', productId: 'x' });
    expect(catalog.search(state).relaxations).toEqual([]);
    expect(catalog.search(state).exactMatches).toEqual([]);
    expect(createCatalog([]).search(initial()).status).toBe('no_exact_match');
  });
  it('honors relaxation limits and groups equivalent proposals', () => {
    const catalog = createCatalog([product('a'), product('b')]);
    const state = update(initial(), budget(1));
    expect(catalog.search(state).relaxations[0]!.candidateIds).toEqual(['a', 'b']);
    expect(catalog.search(state, {}, { maxRelaxations: 0 }).relaxations).toEqual([]);
  });
});

describe('M1 structured scenarios integrated with the M2 catalog', () => {
  const scenarios = JSON.parse(readFileSync('fixtures/m1-scenarios.json', 'utf8')) as { id: string; actions: unknown[] }[];
  for (const [index, scenario] of scenarios.entries()) it(`${scenario.id} retains safe catalog eligibility after state restoration`, () => {
    let state = createSession({ id: 'scenario-catalog' });
    for (const step of scenarios.slice(0, index + 1)) for (const action of step.actions) state = transition(state, action).state;
    const restored = JSON.parse(JSON.stringify(state)) as ShoppingSession;
    const results = fixture.search(restored);
    expect(results).toEqual(fixture.search(state));
    for (const match of results.exactMatches) {
      expect(getHardConstraintViolations(restored, match.product)).toEqual([]);
      expect(fixture.getProduct(match.product.id)).toEqual(match.product);
    }
  });
});
