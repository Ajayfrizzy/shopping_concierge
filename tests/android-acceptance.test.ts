import { expect, it } from 'vitest';
import { createAgentService, interpretMockMessage } from '@youcam/agent';
import { createCatalog } from '@youcam/catalog';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { createSession, transition, getActiveConstraints } from '@youcam/decision-engine';
import { MockAgentPlanner } from '@youcam/testing';
import { authorizePlan } from '../packages/agent/src/authorization.ts';
import {
  productName,
  productAttributes,
  constraintLabel,
  changeLabel,
} from '../apps/mobile/src/presentation.ts';
const ids = ['E01', 'E03', 'E12', 'N01', 'N03', 'N12', 'R01', 'R03', 'R08', 'W03', 'W08', 'W11'];
// Eligibility is injected only into this isolated test catalog, never production fixtures.
const base = createFixtureCatalog();
const products = (['earrings', 'necklaces', 'rings', 'watches'] as const).flatMap((category) =>
  base
    .search(createSession({ id: category, goal: '', category }))
    .exactMatches.map((r) => r.product),
);
const catalog = createCatalog(products.map((p) => ({ ...p, vtoEligible: ids.includes(p.id) })));
const messages = [
  'Show me silver earrings under $200 for an evening event. I want elegant designs with virtual try-on available.',
  'Show me stylish watches under $300 that support virtual try-on.',
  'Find modern gold rings under USD 150 with virtual try-on available.',
];
async function setup() {
  const agent = createAgentService(catalog, new MockAgentPlanner());
  const id = agent.create({}).state.id;
  await agent.turn(id, {
    type: 'message',
    message: 'I need elegant silver earrings under $80 for an evening event.',
    requestId: 'a',
    expectedVersion: 0,
  });
  await agent.turn(id, {
    type: 'action',
    action: { type: 'feedback', feedback: { action: 'select', productId: 'E09' } },
    requestId: 'select',
    expectedVersion: 1,
  });
  await agent.turn(id, {
    type: 'message',
    message: 'Now find me a necklace that works with the earrings I chose.',
    requestId: 'c',
    expectedVersion: 2,
  });
  return { agent, id };
}
it.each(messages)(
  'authorizes bounded VTO discovery from selected-E09/necklaces state: %s',
  async (message) => {
    const { agent, id } = await setup();
    const before = agent.get(id)!;
    const result = await agent.turn(id, {
      type: 'message',
      message,
      requestId: 'discover',
      expectedVersion: 3,
    });
    expect(result.status).toBe('ok');
    expect(result.session.version).toBe(4);
    expect(result.session.state.decisions.earrings!.selected).toEqual(['E09']);
    expect(result.session.state.dependencies).toEqual(before.state.dependencies);
    const f = getActiveConstraints(result.session.state).fields;
    expect(f.vtoOnly?.preference.value).toBe(true);
    expect(f.vtoOnly?.class).toBe('hard');
    expect(f.budget?.preference.scope).toBe('global');
    if (message.includes('watches')) {
      expect(f.material?.preference.value).toBe('silver');
      expect(f.occasion?.preference.value).toBe('evening');
      expect(f.budget?.preference.value).toEqual({ amount: 300, currency: 'USD' });
    }
    if (result.ui.type === 'product_list')
      for (const { product } of result.ui.payload.exactMatches) {
        expect(ids).toContain(product.id);
        expect(product.vtoEligible).toBe(true);
        expect(product).toEqual(catalog.getProduct(product.id));
      }
    expect(agent.get(id)).toEqual(result.session);
  },
);
it('filter action preserves budget, material and rejections; no-match never bypasses them', async () => {
  const { agent, id } = await setup();
  const before = agent.get(id)!;
  const r = await agent.turn(id, {
    type: 'action',
    action: {
      type: 'update_constraints',
      updates: [{ field: 'vtoOnly', value: true, source: 'explicit', scope: 'global' }],
    },
    requestId: 'filter',
    expectedVersion: 3,
  });
  expect(r.session.state.constraints.slice(0, before.state.constraints.length)).toEqual(
    before.state.constraints,
  );
  expect(r.session.state.feedback).toEqual(before.state.feedback);
  let state = transition(
    r.session.state,
    {
      type: 'update_constraints',
      updates: [
        {
          field: 'budget',
          value: { amount: 1, currency: 'USD' },
          scope: 'global',
          source: 'explicit',
        },
      ],
    },
    catalog,
  ).state;
  expect(catalog.search(state).exactMatches).toEqual([]);
  state = transition(
    state,
    {
      type: 'update_constraints',
      updates: [{ field: 'vtoOnly', value: false, scope: 'global', source: 'explicit' }],
    },
    catalog,
  ).state;
  expect(catalog.search(state).exactMatches).toEqual([]);
});
it('rejects unrelated/partial mutations and unknown tails without committing state', async () => {
  const { agent, id } = await setup();
  const state = agent.get(id)!.state;
  const expected = interpretMockMessage(messages[0]!, state);
  for (const call of [
    { name: 'reset_constraint', args: { field: 'material', scope: 'global' } },
    { name: 'select_product', args: { productId: 'E12' } },
    { name: 'request_vto', args: { productId: 'E12' } },
  ]) {
    const plan = {
      ...expected,
      calls: [...expected.calls.slice(0, -1), call, expected.calls.at(-1)!],
    };
    expect(authorizePlan(plan as typeof expected, expected, state, catalog).allowed).toBe(false);
    const malicious = createAgentService(catalog, {
      mode: 'mock',
      plan: async () => plan as typeof expected,
    });
    malicious.restore(agent.snapshot(id));
    await expect(
      malicious.turn(id, {
        type: 'message',
        message: messages[0]!,
        requestId: 'bad',
        expectedVersion: 3,
      }),
    ).rejects.toThrow();
    expect(malicious.get(id)).toEqual(agent.get(id));
  }
  expect(
    interpretMockMessage(messages[1] + ' Also remove my silver requirement.', state).disposition,
  ).not.toBe('execute');
});
it('keeps shopper copy factual and removes internal fixture/state notation', () => {
  expect(productName('Fixture Ceremony Earrings')).toBe('Ceremony Earrings');
  expect(productAttributes({ material: 'silver', color: 'silver' })).toBe('silver');
  expect(
    constraintLabel({
      field: 'styleTags',
      value: ['lightweight'],
      scope: 'global',
      source: 'explicit',
    }),
  ).toContain('weight unverified');
  expect(changeLabel({ field: 'activeCategory', previous: null, current: 'earrings' })).toBe(
    'Now browsing earrings',
  );
});
it.each(['earrings', 'necklaces', 'rings', 'watches'] as const)(
  'discovers only server-eligible %s and preserves rejection exclusions',
  (category) => {
    let state = createSession({ id: 'discovery', goal: '', category });
    state = transition(
      state,
      {
        type: 'update_constraints',
        updates: [{ field: 'vtoOnly', value: true, scope: 'global', source: 'explicit' }],
      },
      catalog,
    ).state;
    const matches = catalog.search(state).exactMatches;
    expect(matches.map((r) => r.product.id).sort()).toEqual(
      ids.filter((id) => catalog.getProduct(id)?.category === category).sort(),
    );
    const rejected = matches[0]!.product.id;
    state = transition(
      state,
      {
        type: 'feedback',
        feedback: { action: 'reject', productId: rejected, reasonCode: 'too_plain' },
      },
      catalog,
    ).state;
    expect(catalog.search(state).exactMatches.map((r) => r.product.id)).not.toContain(rejected);
    expect(state.feedback.at(-1)?.input).toMatchObject({
      action: 'reject',
      reasonCode: 'too_plain',
    });
  },
);
