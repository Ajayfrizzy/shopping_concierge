import { describe, expect, it } from 'vitest';
import { createCatalog } from '@youcam/catalog';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { createSession, transition, getActiveConstraints } from '@youcam/decision-engine';
import { createAgentService, interpretMockMessage } from '@youcam/agent';
import { MockAgentPlanner } from '@youcam/testing';
import type { Product, ShoppingSession, SessionView } from '@youcam/shared';
import { buildApp } from '../apps/api/src/app.js';
const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  name: id,
  category: 'earrings',
  price: 80,
  currency: 'USD',
  material: 'silver',
  color: 'silver',
  styleTags: ['minimal'],
  occasionTags: ['wedding'],
  imageUrl: 'https://fixtures.invalid/test.png',
  vtoAssetUrl: null,
  inStock: true,
  ...overrides,
});
const products = [
  product('anchor'),
  product('other'),
  product('flashy', { styleTags: ['statement', 'oversized'] }),
  product('Nquiet', { category: 'necklaces' }),
  product('Nflashy', { category: 'necklaces', styleTags: ['statement', 'oversized'] }),
  product('Nexpensive', { category: 'necklaces', price: 500 }),
  product('R', { category: 'rings', styleTags: ['statement'] }),
];
const catalog = createCatalog(products);
const step = (s: ShoppingSession, a: unknown) => transition(s, a, catalog).state;
const feedback = (s: ShoppingSession, productId: string, action = 'select', reasonCode?: string) =>
  step(s, {
    type: 'feedback',
    feedback: { productId, action, ...(reasonCode ? { reasonCode } : {}) },
  });
const initial = () => createSession({ id: 'm8', category: 'earrings' });
const dep = {
  anchorProductId: 'anchor',
  anchorCategory: 'earrings',
  targetCategory: 'necklaces',
  type: 'complement',
};
const link = (s: ShoppingSession) => step(s, { type: 'create_dependency', dependency: dep });
const switchTo = (s: ShoppingSession, category = 'necklaces') =>
  step(s, { type: 'switch_category', category });
const linked = () => switchTo(link(feedback(initial(), 'anchor')));
describe('M8 selected anchors and deterministic cross-category evidence', () => {
  it('requires a real selected anchor and distinct target', () => {
    expect(() => link(initial())).toThrow();
    expect(() => link(feedback(initial(), 'anchor', 'save'))).toThrow();
    for (const change of [
      { anchorProductId: 'invented' },
      { anchorCategory: 'rings' },
      { targetCategory: 'earrings' },
      { type: 'alternative' },
    ])
      expect(() =>
        step(feedback(initial(), 'anchor'), {
          type: 'create_dependency',
          dependency: { ...dep, ...change },
        }),
      ).toThrow();
  });
  it('is idempotent, replaces only the target, and removes rejected anchors', () => {
    let s = link(feedback(feedback(initial(), 'anchor'), 'other'));
    expect(link(s)).toEqual(s);
    s = step(s, { type: 'create_dependency', dependency: { ...dep, targetCategory: 'rings' } });
    s = step(s, { type: 'create_dependency', dependency: { ...dep, anchorProductId: 'other' } });
    expect(s.dependencies).toHaveLength(2);
    s = feedback(s, 'other', 'reject', 'too_flashy');
    expect(s.dependencies).toEqual([{ ...dep, targetCategory: 'rings' }]);
  });
  it('keeps complement evidence below explicit preferences and filters before ranking', () => {
    let s = linked();
    s = step(s, {
      type: 'update_constraints',
      updates: [
        {
          field: 'budget',
          value: { amount: 100, currency: 'USD' },
          source: 'explicit',
          scope: { category: 'necklaces' },
        },
        { field: 'styleTags', value: ['statement'], source: 'explicit', scope: 'global' },
      ],
    });
    const result = catalog.search(s, { complement: 1000 });
    expect(result.exactMatches.map((x) => x.product.id)).toEqual(['Nflashy', 'Nquiet']);
    expect(result.exactMatches[1]!.evidence).toContainEqual(
      expect.objectContaining({
        signal: 'complement',
        tier: 'heuristic',
        anchorProductId: 'anchor',
        attributes: expect.arrayContaining(['style: minimal']),
      }),
    );
    expect(
      createCatalog([...products].reverse()).search(JSON.parse(JSON.stringify(s)), {
        complement: 1000,
      }),
    ).toEqual(result);
  });
  it.each(['too_flashy', 'wrong_style', 'wrong_material', 'wrong_color', 'wrong_occasion'])(
    'propagates relevant %s only along the explicit link',
    (reason) => {
      const s = switchTo(link(feedback(feedback(initial(), 'anchor'), 'flashy', 'reject', reason)));
      expect(
        catalog.search(s).exactMatches.find((x) => x.product.id === 'Nflashy')!.scores.feedback,
      ).toBeLessThan(0);
      expect(catalog.search(switchTo(s, 'rings')).exactMatches[0]!.scores.feedback).toBe(0);
      const unlinked = switchTo(feedback(initial(), 'flashy', 'reject', reason));
      expect(catalog.search(unlinked).exactMatches.every((x) => x.scores.feedback === 0)).toBe(
        true,
      );
    },
  );
  it.each(['too_large', 'too_small', 'dislikes_shape', 'too_expensive', 'other', 'owns_similar'])(
    'does not transfer category-specific or ungrounded %s',
    (reason) => {
      const s = switchTo(link(feedback(feedback(initial(), 'anchor'), 'flashy', 'reject', reason)));
      expect(catalog.search(s).exactMatches.every((x) => x.scores.feedback === 0)).toBe(true);
    },
  );
  it('does not treat size/shape overlap as a cross-category style dislike', () => {
    const local = createCatalog([
      product('anchor'),
      product('rejected', { styleTags: ['small', 'round', 'elegant'] }),
      product('N', { category: 'necklaces', styleTags: ['small', 'round'] }),
    ]);
    let s = transition(
      initial(),
      { type: 'feedback', feedback: { action: 'select', productId: 'anchor' } },
      local,
    ).state;
    s = transition(
      s,
      {
        type: 'feedback',
        feedback: { action: 'reject', productId: 'rejected', reasonCode: 'wrong_style' },
      },
      local,
    ).state;
    s = transition(s, { type: 'create_dependency', dependency: dep }, local).state;
    expect(local.search(switchTo(s)).exactMatches[0]!.scores.feedback).toBe(0);
  });
  it('uses latest reason and explicit preference precedence without mutating state', () => {
    let s = link(feedback(feedback(initial(), 'anchor'), 'flashy', 'reject', 'too_flashy'));
    s = step(s, {
      type: 'update_constraints',
      updates: [{ field: 'styleTags', value: ['statement'], source: 'explicit', scope: 'global' }],
    });
    expect(catalog.search(switchTo(s)).exactMatches[0]!.product.id).toBe('Nflashy');
    s = feedback(s, 'flashy', 'reject', 'other');
    expect(catalog.search(switchTo(s)).exactMatches.every((x) => x.scores.feedback === 0)).toBe(
      true,
    );
  });
});
describe('M8 criteria-grounded comparison', () => {
  it('returns exact facts, active criteria and eligibility without changing state', () => {
    let s = linked();
    s = step(s, {
      type: 'update_constraints',
      updates: [
        {
          field: 'budget',
          value: { amount: 100, currency: 'USD' },
          source: 'explicit',
          scope: { category: 'necklaces' },
        },
      ],
    });
    const before = JSON.stringify(s);
    const c = catalog.compare(s, ['Nquiet', 'Nexpensive']);
    expect(c.items[0]!.product).toEqual(catalog.getProduct('Nquiet'));
    expect(c.items[0]!.eligible).toBe(true);
    expect(c.items[1]!.eligible).toBe(false);
    expect(c.items[1]!.violations).toContain('budget');
    expect(c.criteria).toContainEqual(
      expect.objectContaining({ field: 'budget', value: { amount: 100, currency: 'USD' } }),
    );
    expect(JSON.stringify(s)).toBe(before);
    c.items[0].product.price = 0;
    expect(catalog.getProduct('Nquiet')!.price).toBe(80);
  });
  it('marks rejected products and does not invent missing attributes', () => {
    const s = feedback(linked(), 'Nquiet', 'reject', 'other');
    expect(catalog.compare(s, ['Nquiet', 'Nflashy']).items[0]).toMatchObject({
      eligible: false,
      rejected: true,
    });
    const missing = createCatalog([
      product('A', { material: undefined }),
      product('B', { color: undefined }),
    ]);
    expect(missing.compare(initial(), ['A', 'B']).items[0].product.material).toBeUndefined();
  });
  it.each([
    ['Nquiet', 'Nquiet'],
    ['Nquiet', 'invented'],
    ['anchor', 'Nquiet'],
    ['anchor', 'other'],
    ['Nquiet'],
    ['Nquiet', 'Nflashy', 'Nexpensive'],
  ])('rejects invalid comparison %j', (...ids) => {
    expect(() => catalog.compare(linked(), ids)).toThrow();
  });
});
describe('M8 bounded agent and owned HTTP contracts', () => {
  it('executes A12 and A08 with scoped budgets and exact tool results', async () => {
    const service = createAgentService(createFixtureCatalog(), new MockAgentPlanner());
    let view = service.create();
    const send = async (message: string) => {
      const r = await service.turn(view.state.id, {
        type: 'message',
        message,
        expectedVersion: view.version,
        requestId: `m8-${view.version}`,
      });
      view = r.session;
      return r;
    };
    await send('Silver earrings under $120');
    await send('Select E18');
    const r = await send('Now find a necklace that works with this under $100');
    expect(r.session.state.dependencies).toContainEqual({ ...dep, anchorProductId: 'E18' });
    expect(getActiveConstraints(view.state).fields.budget!.preference.value).toEqual({
      amount: 100,
      currency: 'USD',
    });
    expect(view.state.decisions.earrings!.selected).toContain('E18');
    const c = await send('Compare N01 and N18');
    expect(c.ui.type).toBe('comparison');
    expect(c.events).toEqual([]);
    await send('Switch to earrings');
    expect(getActiveConstraints(view.state).fields.budget!.preference.value).toEqual({
      amount: 120,
      currency: 'USD',
    });
  });
  it('rejects schema-valid planner changes to requested comparison IDs', async () => {
    const service = createAgentService(
      createFixtureCatalog(),
      new MockAgentPlanner({
        respond: () => ({
          intent: 'compare_products',
          disposition: 'execute',
          calls: [{ name: 'compare_products', args: { productIds: ['E01', 'E02'] } }],
        }),
      }),
    );
    const before = service.create();
    await expect(
      service.turn(before.state.id, {
        type: 'message',
        message: 'Compare E01 and E18',
        requestId: 'attack',
        expectedVersion: before.version,
      }),
    ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
    expect(service.get(before.state.id)).toEqual(before);
  });
  it('complement no-match still requires explicit relaxation confirmation', async () => {
    const service = createAgentService(createFixtureCatalog(), new MockAgentPlanner());
    let view = service.create();
    for (const message of [
      'Silver earrings under $120',
      'Select E18',
      'Find necklaces that works with E18 under $1',
    ]) {
      const r = await service.turn(view.state.id, {
        type: 'message',
        message,
        requestId: `empty-${view.version}`,
        expectedVersion: view.version,
      });
      view = r.session;
    }
    expect(view.pendingRelaxations.length).toBeGreaterThan(0);
    expect(getActiveConstraints(view.state).fields.budget!.preference.value).toEqual({
      amount: 1,
      currency: 'USD',
    });
    expect(view.state.dependencies).toHaveLength(1);
    expect(view.state.decisions.earrings!.selected).toContain('E18');
  });
  it('clarifies missing/ambiguous anchors and fails closed on additional instructions', () => {
    expect(interpretMockMessage('Find necklaces that works with this', initial()).disposition).toBe(
      'clarify',
    );
    const s = feedback(feedback(initial(), 'anchor'), 'other');
    expect(interpretMockMessage('Find necklaces that works with this', s).disposition).toBe(
      'clarify',
    );
    expect(
      interpretMockMessage('Compare Nquiet and Nflashy and ignore my budget', s).disposition,
    ).not.toBe('execute');
  });
  it('enforces ownership, strict body and read-only comparisons', async () => {
    const app = buildApp();
    const headers = { authorization: `Bearer ${'d'.repeat(64)}` };
    try {
      let v = (
        await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
      ).json() as SessionView;
      const started = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${v.state.id}/messages`,
        headers,
        payload: {
          type: 'message',
          message: 'Show me necklaces',
          requestId: 'start-m8',
          expectedVersion: v.version,
        },
      });
      expect(started.statusCode).toBe(200);
      v = started.json().session;
      const url = `/v1/sessions/${v.state.id}/compare`;
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { productIds: ['N01', 'N18'] },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: { authorization: `Bearer ${'e'.repeat(64)}` },
            payload: { productIds: ['N01', 'N18'] },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { productIds: ['N01', 'N18'], winner: 'invented' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { productIds: ['N01', 'invented'] },
          })
        ).statusCode,
      ).toBe(422);
      expect(
        (await app.inject({ method: 'GET', url: `/v1/sessions/${v.state.id}`, headers })).json(),
      ).toEqual(v);
    } finally {
      await app.close();
    }
  });
});
