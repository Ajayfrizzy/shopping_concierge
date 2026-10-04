import { describe, expect, it } from 'vitest';
import {
  constraintInputSchema,
  decisionActionSchema,
  feedbackInputSchema,
  productSchema,
  shoppingSessionSchema,
  stateChangeEventSchema,
  type ShoppingSession,
  type Product,
} from '@youcam/shared';
import { createSession, transition } from '@youcam/decision-engine';

const baseProduct: Product = {
  id: 'test-product',
  name: 'Synthetic test earrings',
  category: 'earrings',
  price: 0,
  currency: 'USD',
  styleTags: [],
  occasionTags: [],
  imageUrl: 'https://fixtures.invalid/product.jpg',
  vtoAssetUrl: null,
  inStock: false,
};
const scopedMaterial = {
  field: 'material',
  value: 'silver',
  scope: { category: 'earrings' },
  source: 'explicit',
};

describe('domain boundary schemas', () => {
  it('models unavailable VTO assets honestly and permits free/out-of-stock catalog records', () => {
    expect(productSchema.parse(baseProduct)).toEqual(baseProduct);
  });
  it.each([
    { category: 'bags' },
    { price: -1 },
    { price: Infinity },
    { price: NaN },
    { price: '100' },
    { currency: 'usd' },
    { inStock: 'true' },
    { imageUrl: 'invented-url' },
    { styleTags: ['elegant', 'elegant'] },
    { unknown: 'invented fact' },
  ])('rejects malformed catalog facts: %j', (patch) => {
    expect(productSchema.safeParse({ ...baseProduct, ...patch }).success).toBe(false);
  });
  it.each([
    { field: 'category', value: 'necklaces' },
    { value: ['silver', 'gold'] },
    { source: 'model_guess' },
    { scope: 'earrings' },
    { scope: { category: 'bags' } },
    { value: '' },
    { strength: 'soft' },
    { scope: { category: 'earrings', global: true } },
  ])('rejects malformed or contradictory constraint data: %j', (patch) => {
    expect(constraintInputSchema.safeParse({ ...scopedMaterial, ...patch }).success).toBe(false);
  });
  it('cannot infer a budget or exclusion, or set an invalid monetary limit', () => {
    for (const preference of [
      {
        field: 'budget',
        value: { amount: 120, currency: 'USD' },
        source: 'visual',
        scope: 'global',
      },
      {
        field: 'budget',
        value: { amount: -1, currency: 'USD' },
        source: 'explicit',
        scope: 'global',
      },
      { field: 'excludedTags', value: ['dangling'], source: 'heuristic', scope: 'global' },
    ])
      expect(constraintInputSchema.safeParse(preference).success).toBe(false);
  });
  it('validates reason codes and distinguishes rejection reasons from positive feedback', () => {
    expect(
      feedbackInputSchema.safeParse({
        productId: 'test-product',
        action: 'reject',
        reasonCode: 'ugly',
      }).success,
    ).toBe(false);
    expect(
      feedbackInputSchema.safeParse({
        productId: 'test-product',
        action: 'save',
        reasonCode: 'too_flashy',
      }).success,
    ).toBe(false);
    expect(
      feedbackInputSchema.safeParse({ productId: 'test-product', action: 'reject' }).success,
    ).toBe(true);
  });
  it('rejects actions that try to overwrite state or supply product facts', () => {
    expect(
      decisionActionSchema.safeParse({
        type: 'feedback',
        feedback: { action: 'select', productId: 'test-product' },
        product: baseProduct,
      }).success,
    ).toBe(false);
    expect(
      decisionActionSchema.safeParse({ type: 'switch_category', category: 'earrings', state: {} })
        .success,
    ).toBe(false);
  });
  it('rejects non-JSON event values instead of losing them during persistence', () => {
    expect(
      stateChangeEventSchema.safeParse({
        sessionId: 's',
        revision: 1,
        action: 'feedback',
        changes: [{ field: 'x', previous: undefined, current: Infinity }],
      }).success,
    ).toBe(false);
  });
});

describe('restored state invariants', () => {
  const valid = () =>
    transition(
      createSession({ id: 's', category: 'earrings' }),
      { type: 'feedback', feedback: { productId: 'test-product', action: 'shortlist' } },
      { getProduct: () => baseProduct },
    ).state;
  it.each([
    (s: ShoppingSession) => {
      s.schemaVersion = 2 as 1;
    },
    (s: ShoppingSession) => {
      delete s.decisions.earrings;
    },
    (s: ShoppingSession) => {
      s.decisions.earrings!.shortlisted.push('test-product');
    },
    (s: ShoppingSession) => {
      s.decisions.earrings!.rejected.push('test-product');
    },
    (s: ShoppingSession) => {
      s.decisions.necklaces = {
        liked: ['test-product'],
        selected: [],
        shortlisted: [],
        saved: [],
        rejected: [],
      };
    },
    (s: ShoppingSession) => {
      s.feedback[0]!.revision = s.revision + 1;
    },
    (s: ShoppingSession) => {
      s.feedback[0]!.category = 'necklaces';
    },
    (s: ShoppingSession) => {
      s.constraints.push({
        preference: { field: 'color', value: 'white', source: 'explicit', scope: 'global' },
        revision: s.revision + 1,
      });
    },
  ])('fails closed for corrupted snapshots (%#)', (corrupt) => {
    const s = valid();
    corrupt(s);
    expect(shoppingSessionSchema.safeParse(s).success).toBe(false);
    expect(() => transition(s, { type: 'switch_category', category: 'necklaces' })).toThrow();
  });
  it('rejects duplicate constraint slots', () => {
    const state = transition(valid(), {
      type: 'update_constraints',
      updates: [scopedMaterial],
    }).state;
    state.constraints.push(state.constraints[0]!);
    expect(shoppingSessionSchema.safeParse(state).success).toBe(false);
  });
  it('requires a selected dependency anchor, not just liked/shortlisted/saved', () => {
    const state = valid();
    state.dependencies = [
      {
        anchorProductId: 'test-product',
        anchorCategory: 'earrings',
        targetCategory: 'necklaces',
        type: 'complement',
      },
    ];
    expect(shoppingSessionSchema.safeParse(state).success).toBe(false);
    state.decisions.earrings!.selected.push('test-product');
    expect(shoppingSessionSchema.safeParse(state).success).toBe(true);
    state.dependencies.push(state.dependencies[0]!);
    expect(shoppingSessionSchema.safeParse(state).success).toBe(false);
  });
  it('rejecting an anchor invalidates its dependency but preserves other state', () => {
    const state = valid();
    state.decisions.earrings!.selected.push('test-product');
    state.dependencies.push({
      anchorProductId: 'test-product',
      anchorCategory: 'earrings',
      targetCategory: 'necklaces',
      type: 'complement',
    });
    const result = transition(
      state,
      {
        type: 'feedback',
        feedback: { productId: 'test-product', action: 'reject', reasonCode: 'too_plain' },
      },
      { getProduct: () => baseProduct },
    );
    expect(result.state.dependencies).toEqual([]);
    expect(result.changes.some((c) => c.field === 'dependencies')).toBe(true);
    expect(state.dependencies).toHaveLength(1);
  });
});
