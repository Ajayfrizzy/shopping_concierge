import { expect, it } from 'vitest';
import { createAgentService, interpretMockMessage } from '@youcam/agent';
import { createCatalog } from '@youcam/catalog';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { MockAgentPlanner } from '@youcam/testing';
import { agentRequestSchema } from '@youcam/shared';
import { buildLLMContext } from '../apps/api/src/llm/context.ts';
const catalog = createFixtureCatalog();
const a =
  'I need elegant silver earrings under $80 for an evening event. I prefer something noticeable but not too heavy.';
const b = "I don't like this one because it feels too minimal.";
const c = 'Now find me a necklace that works with the earrings I chose.';
async function setup() {
  const agent = createAgentService(catalog, new MockAgentPlanner());
  const id = agent.create({}).state.id;
  await agent.turn(id, { type: 'message', message: a, requestId: 'a', expectedVersion: 0 });
  return { agent, id };
}
it('executes contextual rejection, deliberate selection and exact continuation atomically and durably', async () => {
  const { agent, id } = await setup();
  const before = agent.get(id)!;
  const rb = await agent.turn(id, {
    type: 'message',
    message: b,
    productContext: { productId: 'E01' },
    requestId: 'b',
    expectedVersion: 1,
  });
  expect(rb.session.version).toBe(2);
  expect(rb.session.state.constraints).toEqual(before.state.constraints);
  expect(rb.session.state.feedback.at(-1)?.input).toEqual({
    action: 'reject',
    productId: 'E01',
    reasonCode: 'too_plain',
    reasonText: b,
  });
  expect(rb.session.state.decisions.earrings!.rejected).toEqual(['E01']);
  if (rb.ui.type === 'product_list')
    expect(rb.ui.payload.exactMatches.map((r) => r.product.id)).toEqual(['E09', 'E02']);
  const selected = await agent.turn(id, {
    type: 'action',
    action: { type: 'feedback', feedback: { action: 'select', productId: 'E09' } },
    requestId: 'select',
    expectedVersion: 2,
  });
  expect(selected.session.version).toBe(3);
  expect(selected.session.state.decisions.earrings!.selected).toEqual(['E09']);
  const restored = createAgentService(catalog, new MockAgentPlanner());
  restored.restore(JSON.parse(JSON.stringify(agent.snapshot(id))));
  const rc = await restored.turn(id, {
    type: 'message',
    message: c,
    requestId: 'c',
    expectedVersion: 3,
  });
  expect(rc.session.version).toBe(4);
  expect(rc.session.state.activeCategory).toBe('necklaces');
  expect(rc.session.state.constraints).toEqual(before.state.constraints);
  expect(rc.session.state.dependencies).toContainEqual({
    anchorProductId: 'E09',
    anchorCategory: 'earrings',
    targetCategory: 'necklaces',
    type: 'complement',
  });
  expect(rc.session.state.decisions.earrings!.selected).toEqual(['E09']);
  if (rc.ui.type === 'product_list')
    for (const { product } of rc.ui.payload.exactMatches) {
      expect(product).toEqual(catalog.getProduct(product.id));
      expect(product.category).toBe('necklaces');
      expect(product.material).toBe('silver');
      expect(product.price).toBeLessThanOrEqual(80);
    }
});
it('clarifies ambiguous pronouns without context and selected references without a choice', async () => {
  const { agent, id } = await setup();
  const s = agent.get(id)!.state;
  expect(interpretMockMessage(b, s).disposition).toBe('clarify');
  expect(interpretMockMessage(c, s).question).toBe('anchor');
  for (const kind of ['saved', 'shortlisted'] as const) {
    const copy = structuredClone(s);
    copy.decisions.earrings![kind] = ['E09'];
    expect(interpretMockMessage(c, copy).disposition).toBe('clarify');
  }
  const multiple = structuredClone(s);
  multiple.decisions.earrings!.selected = ['E09', 'E02'];
  expect(interpretMockMessage(c, multiple).question).toBe('anchor');
});
it('accepts one context only and rejects invented or wrong-category targets before invoking planner', async () => {
  expect(
    agentRequestSchema.safeParse({
      type: 'message',
      requestId: 'b',
      expectedVersion: 1,
      message: b,
      productContext: [{ productId: 'E01' }, { productId: 'E02' }],
    }).success,
  ).toBe(false);
  const { agent, id } = await setup();
  const before = agent.get(id);
  for (const productId of ['FAKE', 'N01'])
    await expect(
      agent.turn(id, {
        type: 'message',
        message: b,
        productContext: { productId },
        requestId: productId,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
  expect(agent.get(id)).toEqual(before);
});
it('does not authorize another target or unrelated mutation and commits nothing on rejection', async () => {
  const { agent, id } = await setup();
  const snap = agent.snapshot(id);
  for (const change of ['target', 'extra']) {
    const evil = createAgentService(catalog, {
      mode: 'live',
      async plan(ctx) {
        const p = interpretMockMessage(ctx.message, ctx.state, ctx.productContext);
        if (change === 'target' && p.calls[0]?.name === 'reject_product')
          p.calls[0].args.productId = 'E02';
        else p.calls.push({ name: 'save_product', args: { productId: 'E09' } });
        return p;
      },
    });
    evil.restore(snap);
    await expect(
      evil.turn(id, {
        type: 'message',
        message: b,
        productContext: { productId: 'E01' },
        requestId: change,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
    expect(evil.snapshot(id)).toEqual(snap);
  }
});
it('preserves raw reasons and maps only bounded phrases', async () => {
  const { agent, id } = await setup();
  const s = agent.get(id)!.state;
  for (const text of [b, b.replace('this one', 'that product')]) {
    const p = interpretMockMessage(text, s, { productId: 'E01' });
    expect(p.calls[0]).toMatchObject({
      name: 'reject_product',
      args: { productId: 'E01', reasonCode: 'too_plain', reasonText: text },
    });
  }
  expect(
    interpretMockMessage("I don't like this one because of the packaging.", s, { productId: 'E01' })
      .calls[0],
  ).toMatchObject({ args: { reasonCode: 'other' } });
});
it('carries exact contextual identity through the sanitized provider payload', async () => {
  const { agent, id } = await setup();
  const payload = buildLLMContext({
    message: b,
    state: agent.get(id)!.state,
    productContext: { productId: 'E01', category: 'earrings' },
    recentMessages: [],
    referencedProducts: [catalog.getProduct('E01')!],
    tools: [],
  });
  expect(payload.explicitProductContext).toEqual({ productId: 'E01', category: 'earrings' });
});
it('contextual too_plain feedback penalizes similar minimal designs without hard exclusion', async () => {
  const base = catalog.getProduct('E01')!;
  const local = createCatalog([
    base,
    { ...base, id: 'similar' },
    { ...base, id: 'neutral', styleTags: ['balanced'] },
  ]);
  const agent = createAgentService(local, new MockAgentPlanner());
  const id = agent.create({}).state.id;
  await agent.turn(id, {
    type: 'message',
    message: 'silver earrings under $80',
    requestId: 'start',
    expectedVersion: 0,
  });
  const reply = await agent.turn(id, {
    type: 'message',
    message: b,
    productContext: { productId: 'E01' },
    requestId: 'reject',
    expectedVersion: 1,
  });
  expect(reply.ui.type).toBe('product_list');
  if (reply.ui.type === 'product_list') {
    expect(reply.ui.payload.exactMatches.map((r) => r.product.id)).toEqual(['neutral', 'similar']);
    expect(reply.ui.payload.exactMatches[1]!.scores.feedback).toBe(-8);
  }
});
it('does not authorize an invented anchor or extra update in continuation', async () => {
  const { agent, id } = await setup();
  await agent.turn(id, {
    type: 'action',
    action: { type: 'feedback', feedback: { action: 'select', productId: 'E09' } },
    requestId: 'choose',
    expectedVersion: 1,
  });
  const snap = agent.snapshot(id);
  const evil = createAgentService(catalog, {
    mode: 'live',
    async plan(ctx) {
      const p = interpretMockMessage(ctx.message, ctx.state);
      p.calls.push({
        name: 'update_constraints',
        args: {
          updates: [{ field: 'material', value: 'gold', scope: 'global', source: 'explicit' }],
        },
      });
      return p;
    },
  });
  evil.restore(snap);
  await expect(
    evil.turn(id, { type: 'message', message: c, requestId: 'bad', expectedVersion: 2 }),
  ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
  expect(evil.snapshot(id)).toEqual(snap);
});
