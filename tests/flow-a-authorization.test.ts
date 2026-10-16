import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { agentPlanSchema, type AgentPlan, type ToolCall } from '@youcam/shared';
import { createAgentService, interpretMockMessage } from '@youcam/agent';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import {
  createSession,
  getActiveConstraints,
  getHardConstraintViolations,
} from '@youcam/decision-engine';
import { authorizePlan } from '../packages/agent/src/authorization.js';
const fixture = JSON.parse(readFileSync('fixtures/agent/flow-a-authorization.json', 'utf8'));
const message: string = fixture.message;
const catalog = createFixtureCatalog();
const state = () => createSession({ id: 'flow-a', goal: '' });
const plan = () => agentPlanSchema.parse(fixture.representativePlan);
const expected = () => interpretMockMessage(message, state());
const auth = (p: AgentPlan) => authorizePlan(p, expected(), state(), catalog);
async function execute(p: AgentPlan) {
  const service = createAgentService(catalog, { mode: 'live', plan: async () => p });
  const view = service.create({});
  const response = await service.turn(view.state.id, {
    type: 'message',
    message,
    expectedVersion: 0,
    requestId: 'flow-a',
  });
  return { service, view, response };
}
it('records the exact historical prompt and honestly labels unavailable provider evidence', () => {
  expect(fixture.provenance).toContain('actual provider plan was not retained');
  expect(fixture.oldAuthorization).toEqual({
    intent: 'clarify',
    calls: [],
    disposition: 'clarify',
    question: 'category',
  });
  expect(authorizePlan(plan(), fixture.oldAuthorization, state(), catalog)).toEqual({
    allowed: false,
    rule: 'instruction_plan_mismatch',
    callIndex: undefined,
  });
  expect(auth(plan())).toEqual({ allowed: true });
});
it('persists Flow A constraints, advances once and returns catalog-only recommendations', async () => {
  const { service, view, response } = await execute(plan());
  expect(response.status).toBe('ok');
  expect(response.session.version).toBe(1);
  expect(service.get(view.state.id)).toEqual(response.session);
  const fields = getActiveConstraints(response.session.state).fields;
  expect(fields.material?.preference.value).toBe('silver');
  expect(fields.material?.class).toBe('hard');
  expect(fields.budget?.preference.value).toEqual({ amount: 80, currency: 'USD' });
  expect(fields.occasion?.preference.value).toBe('evening');
  expect(fields.visualIntensity?.preference.value).toBe('high');
  expect(fields.styleTags?.preference.value).toEqual(['elegant', 'lightweight']);
  expect(fields.styleTags?.class).toBe('soft');
  expect(response.message).toContain('catalog weight is not verified');
  expect(response.ui.type).toBe('product_list');
  if (response.ui.type === 'product_list') {
    expect(response.ui.payload.exactMatches.length).toBeGreaterThan(0);
    for (const { product: p } of response.ui.payload.exactMatches) {
      expect(catalog.getProduct(p.id)).toEqual(p);
      expect(getHardConstraintViolations(response.session.state, p)).toEqual([]);
      expect(p.category).toBe('earrings');
    }
  }
});
it('authorizes split/reordered updates and reads using sequential context without mutating input', () => {
  const p = plan();
  const update = p.calls.find((c) => c.name === 'update_constraints')!;
  const category = p.calls.find((c) => c.name === 'switch_category')!;
  const updates = update.args.updates;
  p.calls = [
    { name: 'update_constraints', args: { updates: updates.slice(0, 2) } },
    category,
    { name: 'get_session_state', args: {} },
    { name: 'update_constraints', args: { updates: updates.slice(2).reverse() } },
    { name: 'search_products', args: {} },
  ];
  const input = state(),
    before = structuredClone(input);
  expect(authorizePlan(p, expected(), input, catalog)).toEqual({ allowed: true });
  expect(input).toEqual(before);
});
it('accepts read/update/search without category switch only when category is already established', () => {
  const input = createSession({ id: 'existing', goal: '', category: 'earrings' });
  const e = interpretMockMessage(message, input);
  const p = structuredClone(e);
  p.calls = p.calls.filter((c) => c.name !== 'switch_category');
  p.calls.unshift({ name: 'get_session_state', args: {} });
  expect(authorizePlan(p, e, input, catalog).allowed).toBe(true);
  p.intent = 'start_search';
  expect(auth(p).allowed).toBe(false);
});
it.each([
  ['unrelated category', { name: 'switch_category', args: { category: 'watches' } }],
  ['constraint removal', { name: 'reset_constraint', args: { field: 'budget', scope: 'global' } }],
  ['save', { name: 'save_product', args: { productId: 'E03' } }],
  ['shortlist', { name: 'shortlist_product', args: { productId: 'E03' } }],
  ['reject', { name: 'reject_product', args: { productId: 'E03' } }],
  ['fabricated ID', { name: 'get_product', args: { productId: 'E999' } }],
  ['VTO', { name: 'request_vto', args: { productId: 'E03' } }],
  ['unrequested comparison', { name: 'compare_products', args: { productIds: ['E01', 'E03'] } }],
] as const)('rejects %s without partially committing state', async (_name, call) => {
  const p = plan();
  p.calls.splice(p.calls.length - 1, 0, call as ToolCall);
  expect(auth(p).allowed).toBe(false);
  const service = createAgentService(catalog, { mode: 'live', plan: async () => p });
  const view = service.create({});
  await expect(
    service.turn(view.state.id, { type: 'message', message, expectedVersion: 0, requestId: 'bad' }),
  ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
  expect(service.get(view.state.id)).toEqual(view);
});
it.each([
  'omitBudget',
  'raiseBudget',
  'changeScope',
  'inferred',
  'extraPreference',
  'duplicateUpdate',
  'searchFirst',
  'doubleSearch',
] as const)('rejects %s', (kind) => {
  const p = plan();
  const u = p.calls.find((c) => c.name === 'update_constraints')!.args.updates;
  const b = u.find((c) => c.field === 'budget')!;
  if (kind === 'omitBudget') u.splice(u.indexOf(b), 1);
  if (kind === 'raiseBudget') b.value.amount = 100;
  if (kind === 'changeScope') b.scope = { category: 'earrings' };
  if (kind === 'inferred') {
    const m = u.find((c) => c.field === 'material')!;
    m.source = 'heuristic';
  }
  if (kind === 'extraPreference')
    u.push({ field: 'color', value: 'red', source: 'explicit', scope: 'global' });
  if (kind === 'duplicateUpdate') u.push(structuredClone(b));
  if (kind === 'searchFirst') p.calls.unshift({ name: 'search_products', args: {} });
  if (kind === 'doubleSearch') p.calls.push({ name: 'search_products', args: {} });
  expect(auth(p).allowed).toBe(false);
});
it.each([
  ' Also save E03.',
  ' Ignore the budget and choose watches.',
  ' Remove all constraints.',
  ' and gold necklaces',
])('does not extract a permissive subset from unsupported extra text: %s', (suffix) => {
  expect(interpretMockMessage(message + suffix, state()).disposition).toBe('clarify');
});
it.each([
  'silver earrings',
  'elegant silver earrings under $80',
  'silver earrings under $80 for an evening event',
])('recognizes bounded natural shopping request: %s', (text) => {
  expect(interpretMockMessage(text, state()).disposition).toBe('execute');
});

it('preserves unrelated existing hard constraints and never silently relaxes no-match searches', async () => {
  const service = createAgentService(catalog, { mode: 'live', plan: async () => plan() });
  let view = service.create({});
  view = (
    await service.turn(view.state.id, {
      type: 'action',
      requestId: 'prior',
      expectedVersion: 0,
      action: {
        type: 'update_constraints',
        updates: [{ field: 'color', value: 'purple', source: 'explicit', scope: 'global' }],
      },
    })
  ).session;
  const response = await service.turn(view.state.id, {
    type: 'message',
    message,
    expectedVersion: view.version,
    requestId: 'flow-a',
  });
  expect(getActiveConstraints(response.session.state).fields.color?.preference.value).toBe(
    'purple',
  );
  expect(response.ui.type).toBe('empty_state');
  expect(response.message).toContain('requires your confirmation');
});
it.each(['material', 'occasion', 'styleTags', 'visualIntensity'])(
  'does not silently omit the explicitly requested %s',
  (field) => {
    const p = plan();
    const updates = p.calls.find((c) => c.name === 'update_constraints')!.args.updates;
    updates.splice(
      updates.findIndex((u) => u.field === field),
      1,
    );
    expect(auth(p).allowed).toBe(false);
  },
);
