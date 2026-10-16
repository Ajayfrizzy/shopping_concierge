import { expect, it } from 'vitest';
import { createCatalog } from '@youcam/catalog';
import { createAgentService } from '@youcam/agent';
import { MockAgentPlanner } from '@youcam/testing';
import { createSession, transition, getHardConstraintViolations } from '@youcam/decision-engine';
import type { ConstraintInput, Product } from '@youcam/shared';
import { fixtureProducts } from '../fixtures/catalog.ts';

function state(occasion: string, intensity: 'low' | 'high', styles: string[], amount = 80) {
  const updates: ConstraintInput[] = [
    { field: 'budget', value: { amount, currency: 'USD' }, source: 'explicit', scope: 'global' },
    { field: 'material', value: 'silver', source: 'explicit', scope: 'global' },
    { field: 'occasion', value: occasion, source: 'explicit', scope: 'global' },
    { field: 'visualIntensity', value: intensity, source: 'explicit', scope: 'global' },
    { field: 'styleTags', value: styles, source: 'explicit', scope: 'global' },
  ];
  return transition(createSession({ id: 'ranking', category: 'earrings' }), {
    type: 'update_constraints',
    updates,
  }).state;
}
const catalog = createCatalog(fixtureProducts);
const ids = (s: ReturnType<typeof state>) =>
  catalog.search(s).exactMatches.map((r) => r.product.id);
it.each([
  ['daytime', 'low', ['minimal'], 80, ['E01', 'E02', 'E09']],
  ['professional', 'low', ['minimal'], 80, ['E01', 'E02', 'E09']],
  ['evening', 'high', ['elegant', 'lightweight'], 80, ['E09', 'E02', 'E01']],
  ['evening', 'high', [], 200, ['E05', 'E12', 'E09']],
  ['evening', 'high', ['elegant'], 200, ['E12', 'E09', 'E14']],
] as const)(
  'ranks %s/%s from explicit preferences with hard guards',
  (occasion, intensity, styles, amount, top) => {
    const s = state(occasion, intensity, [...styles], amount);
    expect(ids(s).slice(0, 3)).toEqual(top);
    for (const r of catalog.search(s).exactMatches)
      expect(getHardConstraintViolations(s, r.product)).toEqual([]);
    expect(catalog.search(s).relaxations).toEqual([]);
    expect(createCatalog([...fixtureProducts].reverse()).search(s)).toEqual(catalog.search(s));
  },
);
it('does not invent an under-budget statement design or lightweight metadata', () => {
  const result = catalog.search(state('evening', 'high', ['elegant', 'lightweight']));
  expect(result.totalExactMatches).toBe(3);
  expect(result.exactMatches.flatMap((r) => r.evidence.flatMap((e) => e.attributes))).not.toContain(
    'lightweight',
  );
  expect(result.exactMatches.map((r) => r.product.id)).not.toContain('E12');
  expect(result.exactMatches.map((r) => r.product.id)).not.toContain('E05');
});
it('exact occasion beats compatibility; compatibility is not asserted as a product tag', () => {
  const base = fixtureProducts[8]!;
  const products: Product[] = ['evening', 'formal', 'wedding', 'unknown'].map((tag, i) => ({
    ...base,
    id: String(i),
    styleTags: [],
    occasionTags: tag === 'unknown' ? [] : [tag],
  }));
  const result = createCatalog(products).search(state('evening', 'high', []));
  expect(result.exactMatches.map((r) => r.scores.explicit)).toEqual([6, 3, 3, 0]);
  expect(result.exactMatches[1]!.evidence[0]!.attributes).toEqual(['formal']);
  expect(result.exactMatches[1]!.product.occasionTags).toEqual(['formal']);
});
it('only documented lightweight tags contribute; small does not imply light', () => {
  const base = fixtureProducts[0]!;
  const products: Product[] = [
    { ...base, id: 'known', styleTags: ['lightweight'] },
    { ...base, id: 'small', styleTags: ['small'] },
    { ...base, id: 'unknown', styleTags: [] },
  ];
  const result = createCatalog(products).search(state('unknown', 'high', ['lightweight']));
  expect(result.exactMatches.map((r) => r.scores.explicit)).toEqual([8, 0, 0]);
  expect(result.exactMatches[0]!.product.id).toBe('known');
});
it('statement evidence beats neutral and conflicting tags without filtering soft mismatches', () => {
  const base = fixtureProducts[0]!;
  const products: Product[] = [
    { ...base, id: 'statement', styleTags: ['statement'] },
    { ...base, id: 'neutral', styleTags: [] },
    { ...base, id: 'subtle', styleTags: ['understated'] },
  ];
  const result = createCatalog(products).search(state('unknown', 'high', []));
  expect(result.exactMatches.map((r) => r.product.id)).toEqual(['statement', 'neutral', 'subtle']);
  expect(result.exactMatches.map((r) => r.scores.explicit)).toEqual([5, 0, -2.5]);
});
it('replays Flow A through the mock agent and persists preferences with honest weight uncertainty', async () => {
  const agent = createAgentService(catalog, new MockAgentPlanner());
  const session = agent.create({});
  const reply = await agent.turn(session.state.id, {
    type: 'message',
    requestId: 'offline-flow-a',
    expectedVersion: 0,
    message:
      'I need elegant silver earrings under $80 for an evening event. I prefer something noticeable but not too heavy.',
  });
  expect(reply.status).toBe('ok');
  expect(reply.session.version).toBe(1);
  expect(agent.get(session.state.id)).toEqual(reply.session);
  expect(reply.message).toContain('catalog weight is not verified');
  expect(reply.ui.type).toBe('product_list');
  if (reply.ui.type === 'product_list')
    expect(reply.ui.payload.exactMatches.map((r) => r.product.id)).toEqual(['E09', 'E02', 'E01']);
});
it('treats unknown occasion names as neutral, including object-property names', () => {
  const result = catalog.search(state('constructor', 'high', []));
  expect(result.exactMatches.every((r) => r.evidence.every((e) => e.signal !== 'occasion'))).toBe(
    true,
  );
});
