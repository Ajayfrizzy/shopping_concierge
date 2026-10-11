import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentService, interpretMockMessage, type PlanningContext } from '@youcam/agent';
import { createSession, getActiveConstraints } from '@youcam/decision-engine';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { LiveBudget, APPROVED_MODEL, usageCost } from '../apps/api/src/llm/budget.js';
import { OpenAIPlanner, planParameters } from '../apps/api/src/llm/openai.js';
import { llmProvider } from '../apps/api/src/llm/config.js';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'm7-budget-'));
  dirs.push(dir);
  const path = join(dir, 'ledger.json');
  return { path, budget: new LiveBudget(path) };
}
const usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 50 } };
const context = (): PlanningContext => ({
  message: 'earrings',
  state: createSession({ id: 'llm-test', goal: '' }),
  recentMessages: [],
  referencedProducts: [],
  tools: [],
});
function wire(plan: unknown, extra = {}) {
  return Response.json({
    status: 'completed',
    usage,
    output: [
      { type: 'function_call', name: 'submit_shopping_plan', arguments: JSON.stringify(plan) },
    ],
    ...extra,
  });
}
function provider(transport: typeof fetch, budget = setup().budget) {
  return new OpenAIPlanner({
    apiKey: 'transport-fixture-not-a-key',
    model: APPROVED_MODEL,
    reasoning: 'low',
    budget,
    fetch: transport,
  });
}
describe('M7 budget guard (no live calls)', () => {
  it('counts every attempt durably and refuses the 31st across instances', () => {
    const { budget, path } = setup();
    for (let i = 0; i < 30; i++) {
      const n = budget.reserve(APPROVED_MODEL, 1, 1);
      budget.settle(n, usage);
    }
    expect(new LiveBudget(path).summary().requests).toBe(30);
    expect(() => new LiveBudget(path).reserve(APPROVED_MODEL, 1, 1)).toThrow('exhausted');
  });
  it('reserves unknown usage and refuses an attempt that might exceed $1', () => {
    const { budget } = setup();
    budget.reserve(APPROVED_MODEL, 450_000, 1);
    expect(() => budget.reserve(APPROVED_MODEL, 50_000, 1)).toThrow('exhausted');
    expect(budget.summary().unknownUsageRequests).toBe(1);
  });
  it('accounts for cached input and output including reasoning', () => {
    expect(usageCost(usage).usd).toBeCloseTo(0.00035);
    expect(() => usageCost({ ...usage, input_tokens_details: { cached_tokens: 101 } })).toThrow();
    expect(() => usageCost({ input_tokens: -1, output_tokens: 1 })).toThrow();
  });
  it('fails closed on a corrupt ledger or unknown pricing', () => {
    const { path, budget } = setup();
    writeFileSync(path, '{}');
    expect(() => budget.reserve(APPROVED_MODEL, 1, 1)).toThrow('invalid');
    expect(() => setup().budget.reserve('unpriced-model', 1, 1)).toThrow('pricing');
  });
  it('prevents double settlement and retains usage if a bound is unexpectedly exceeded', () => {
    const { budget } = setup();
    const n = budget.reserve(APPROVED_MODEL, 1, 1);
    budget.settle(n, { input_tokens: 1_000_000, output_tokens: 1 });
    expect(() => budget.reserve(APPROVED_MODEL, 1, 1)).toThrow('exhausted');
    expect(() => budget.settle(n, usage)).toThrow('settled');
  });
});
describe('M7 OpenAI transport and tool boundary (injected HTTP only)', () => {
  it('uses Responses strict tools, low reasoning, no storage and no chat credentials', async () => {
    const ctx = context(),
      expected = interpretMockMessage(ctx.message, ctx.state);
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: APPROVED_MODEL,
        reasoning: { effort: 'low' },
        store: false,
        service_tier: 'default',
        parallel_tool_calls: false,
      });
      expect(body.tools[0]).toMatchObject({
        type: 'function',
        strict: true,
        name: 'submit_shopping_plan',
      });
      expect(init?.body).not.toContain('transport-fixture-not-a-key');
      expect(init?.redirect).toBe('error');
      return wire({ ...expected, question: null });
    });
    const { budget } = setup();
    expect(await provider(transport, budget).plan(ctx, new AbortController().signal)).toEqual(
      expected,
    );
    expect(budget.summary()).toMatchObject({
      requests: 1,
      inputTokens: 100,
      outputTokens: 20,
      unknownUsageRequests: 0,
    });
  });
  it('derived strict schema requires all properties and forbids additional fields recursively', () => {
    function check(node: unknown) {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      expect(n).not.toHaveProperty('const');
      if (n.properties && typeof n.properties === 'object') {
        const keys = Object.keys(n.properties);
        const discriminator = keys.find((key) => key === 'name' || key === 'field');
        if (discriminator) expect(keys[0]).toBe(discriminator);
      }
      if (n.type === 'object') {
        expect(n.additionalProperties).toBe(false);
        expect(n.required ?? []).toEqual(Object.keys(n.properties as object));
      }
      for (const value of Object.values(n))
        if (Array.isArray(value)) value.forEach(check);
        else check(value);
    }
    check(planParameters);
  });
  it.each([401, 403, 400])('does not retry permanent HTTP %s', async (status) => {
    const transport = vi.fn<typeof fetch>(async () => new Response(null, { status }));
    const { budget } = setup();
    await expect(
      provider(transport, budget).plan(context(), new AbortController().signal),
    ).rejects.toThrow('failed');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(budget.summary().unknownUsageRequests).toBe(1);
  });
  it('retries transient HTTP once, counting and reserving both attempts', async () => {
    const ctx = context();
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(wire(interpretMockMessage(ctx.message, ctx.state)));
    const { budget } = setup();
    await provider(transport, budget).plan(ctx, new AbortController().signal);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(budget.summary()).toMatchObject({ requests: 2, unknownUsageRequests: 1 });
  });
  it('does not retry ambiguous network failures or exceed two transient attempts', async () => {
    const transport = vi.fn<typeof fetch>(async () => {
      throw new Error('network');
    });
    await expect(
      provider(transport).plan(context(), new AbortController().signal),
    ).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
    const transient = vi.fn<typeof fetch>(async () => new Response(null, { status: 429 }));
    await expect(
      provider(transient).plan(context(), new AbortController().signal),
    ).rejects.toThrow();
    expect(transient).toHaveBeenCalledTimes(2);
  });
  it('does not spend on an already aborted request', async () => {
    const transport = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    await expect(provider(transport).plan(context(), controller.signal)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'incomplete' },
    { output: [{ type: 'message', content: 'untrusted invented result' }] },
    { output: [{ type: 'function_call', name: 'confirm_relaxation', arguments: '{}' }] },
    { output: [{ type: 'function_call', name: 'submit_shopping_plan', arguments: '{bad' }] },
    { usage: undefined },
  ])('rejects incomplete, non-tool, malformed or unmetered responses', async (extra) => {
    await expect(
      provider(async () => wire({}, extra)).plan(context(), new AbortController().signal),
    ).rejects.toThrow();
  });
  it('preserves authorization and atomic state with a schema-valid malicious live plan', async () => {
    const malicious = {
      intent: 'select_product',
      disposition: 'execute',
      calls: [{ name: 'select_product', args: { productId: 'fabricated' } }],
    };
    const service = createAgentService(
      createFixtureCatalog(),
      provider(async () => wire(malicious)),
    );
    const view = service.create();
    await expect(
      service.turn(view.state.id, {
        type: 'message',
        message: 'earrings',
        expectedVersion: 0,
        requestId: 'attack',
      }),
    ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
    expect(service.get(view.state.id)).toEqual(view);
  });
  it('rejects a user-referenced nonexistent ID in deterministic catalog lookup', async () => {
    const ctx = context();
    ctx.message = 'Tell me about NONEXISTENT';
    const service = createAgentService(
      createFixtureCatalog(),
      provider(async () => wire(interpretMockMessage(ctx.message, ctx.state))),
    );
    const view = service.create();
    await expect(
      service.turn(view.state.id, {
        type: 'message',
        message: ctx.message,
        expectedVersion: 0,
        requestId: 'unknown',
      }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_PRODUCT' });
    expect(service.get(view.state.id)).toEqual(view);
  });
  it('executes grounded live plans and preserves replay/typed-action behavior without additional requests', async () => {
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const ctx = JSON.parse(body.input[0].content);
      return wire(interpretMockMessage(ctx.currentMessage, ctx.authoritativeState));
    });
    const service = createAgentService(createFixtureCatalog(), provider(transport));
    const view = service.create();
    const request = {
      type: 'message' as const,
      message: 'Silver earrings under $120',
      expectedVersion: 0,
      requestId: 'grounded',
    };
    const result = await service.turn(view.state.id, request);
    expect(result.mode).toBe('live');
    expect(result.ui.type).toBe('product_list');
    expect(result.tools.map((t) => t.name)).toEqual([
      'switch_category',
      'update_constraints',
      'search_products',
    ]);
    expect(await service.turn(view.state.id, request)).toEqual(result);
    await service.turn(view.state.id, {
      type: 'action',
      expectedVersion: 1,
      requestId: 'typed',
      action: { type: 'switch_category', category: 'rings' },
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(service.get(view.state.id).state.constraints).toEqual(result.session.state.constraints);
  });
  it('never reaches transport when approved requests are exhausted', async () => {
    const { budget } = setup();
    for (let i = 0; i < 30; i++) budget.settle(budget.reserve(APPROVED_MODEL, 1, 1), usage);
    const transport = vi.fn<typeof fetch>();
    await expect(
      provider(transport, budget).plan(context(), new AbortController().signal),
    ).rejects.toThrow('exhausted');
    expect(transport).not.toHaveBeenCalled();
  });
  it('forwards abort deadlines without swallowing cancellation or retrying', async () => {
    const controller = new AbortController();
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      init?.signal?.throwIfAborted();
      return wire({});
    });
    await expect(provider(transport).plan(context(), controller.signal)).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('live runner loads in the root CommonJS package and fails closed without approval', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/llm-live-regression.ts'],
      {
        encoding: 'utf8',
        env: { ...process.env, M7_LIVE_APPROVED: 'false' },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Live validation setup failed');
    expect(result.stderr).not.toContain('Transform failed');
  });
  it.each(['omitted-budget', 'duplicate-updates', 'noncanonical-material'])(
    'rejects observed live failure %s without state changes',
    async (failure) => {
      const ctx = context();
      ctx.message = 'Silver earrings for a wedding under $120, elegant but not too loud.';
      const plan = interpretMockMessage(ctx.message, ctx.state);
      const call = plan.calls.find((c) => c.name === 'update_constraints');
      if (!call || call.name !== 'update_constraints')
        throw new Error('Missing fixture constraints');
      if (failure === 'omitted-budget')
        call.args.updates = call.args.updates.filter((u) => u.field !== 'budget');
      if (failure === 'duplicate-updates')
        call.args.updates.push(structuredClone(call.args.updates[0]!));
      if (failure === 'noncanonical-material') {
        const material = call.args.updates.find((u) => u.field === 'material');
        if (material?.field === 'material') material.value = 'Silver';
      }
      const service = createAgentService(
        createFixtureCatalog(),
        provider(async () => wire(plan)),
      );
      const before = service.create();
      await expect(
        service.turn(before.state.id, {
          type: 'message',
          message: ctx.message,
          requestId: 'live-regression',
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ code: 'UNGROUNDED_PLAN' });
      expect(service.get(before.state.id)).toEqual(before);
    },
  );
  it('requires standalone budget refinement to preserve the global limit and scope to the active category', async () => {
    const catalog = createFixtureCatalog();
    let wrongScope = true;
    const service = createAgentService(
      catalog,
      provider(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const ctx = JSON.parse(body.input[0].content);
        const plan = interpretMockMessage(ctx.currentMessage, ctx.authoritativeState);
        if (wrongScope) {
          for (const call of plan.calls)
            if (call.name === 'update_constraints') {
              for (const update of call.args.updates) update.scope = 'global';
            }
        }
        return wire(plan);
      }),
    );
    let view = service.create();
    view = (
      await service.turn(view.state.id, {
        type: 'action',
        requestId: 'category',
        expectedVersion: 0,
        action: { type: 'switch_category', category: 'earrings' },
      })
    ).session;
    view = (
      await service.turn(view.state.id, {
        type: 'action',
        requestId: 'global-budget',
        expectedVersion: 1,
        action: {
          type: 'update_constraints',
          updates: [
            {
              field: 'budget',
              scope: 'global',
              source: 'explicit',
              value: { amount: 120, currency: 'USD' },
            },
          ],
        },
      })
    ).session;
    const before = structuredClone(view);
    const request = {
      type: 'message' as const,
      requestId: 'scoped-budget',
      expectedVersion: 2,
      message: 'under USD 1',
    };
    await expect(service.turn(view.state.id, request)).rejects.toMatchObject({
      code: 'UNGROUNDED_PLAN',
    });
    expect(service.get(view.state.id)).toEqual(before);
    wrongScope = false;
    const response = await service.turn(view.state.id, request);
    expect(response.ui.type).toBe('empty_state');
    expect(response.session.pendingRelaxations.length).toBeGreaterThan(0);
    expect(response.session.state.constraints).toContainEqual(before.state.constraints[0]);
    expect(getActiveConstraints(response.session.state).fields.budget?.preference).toMatchObject({
      scope: { category: 'earrings' },
      value: { amount: 1, currency: 'USD' },
    });
  });
  it('keeps mock selection default and live configuration explicit/server-only', () => {
    expect(llmProvider({}).mode).toBe('mock');
    expect(() => llmProvider({ USE_MOCK_LLM: 'false' })).toThrow();
    expect(() => llmProvider({ USE_MOCK_LLM: 'oops' })).toThrow();
    expect(
      llmProvider({
        USE_MOCK_LLM: 'false',
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'not-a-real-key',
        LLM_MODEL: APPROVED_MODEL,
      }).mode,
    ).toBe('live');
  });
});

describe('sanitized internal OpenAI diagnostics', () => {
  it.each([
    [400, 'invalid_function_parameters', 'invalid_request_error'],
    [401, 'invalid_api_key', 'authentication_error'],
    [403, 'permission_denied', 'permission_error'],
    [404, 'model_not_found', 'invalid_request_error'],
  ])(
    'records safe metadata for HTTP %s without provider messages or secrets',
    async (status, code, type) => {
      const events: unknown[] = [];
      const budget = setup().budget;
      const planner = new OpenAIPlanner({
        apiKey: 'secret-fixture',
        model: APPROVED_MODEL,
        reasoning: 'low',
        budget,
        onDiagnostic: (event) => events.push(event),
        fetch: async () =>
          Response.json(
            {
              error: {
                code,
                type,
                message: 'secret-fixture sensitive prompt',
                param: 'sensitive prompt',
              },
            },
            { status: Number(status), headers: { 'x-request-id': 'req_safe123' } },
          ),
      });
      await expect(planner.plan(context(), new AbortController().signal)).rejects.toThrow('failed');
      expect(events).toEqual([
        {
          stage: 'http',
          status,
          requestId: 'req_safe123',
          errorCode: code,
          errorType: type,
          aborted: false,
        },
      ]);
      expect(JSON.stringify(events)).not.toMatch(/secret-fixture|sensitive prompt/);
      expect(budget.summary().unknownUsageRequests).toBe(1);
    },
  );
  it('redacts arbitrary metadata and bounds error bodies', async () => {
    const { providerErrorMetadata, diagnosticRequestId } = await import(
      '../apps/api/src/llm/diagnostics.js'
    );
    expect(
      await providerErrorMetadata(
        Response.json({ error: { code: 'secret-value', type: 'user-text' } }),
      ),
    ).toEqual({ errorCode: 'unrecognized', errorType: 'unrecognized' });
    expect(await providerErrorMetadata(new Response('x'.repeat(9000)))).toEqual({});
    expect(
      diagnosticRequestId(
        new Response(null, { headers: { 'x-request-id': 'Bearer secret' } }),
        'secret',
      ),
    ).toBeUndefined();
  });
  it.each([
    'reservation',
    'transport',
    'response_json',
    'settlement',
    'response_shape',
    'plan_schema',
  ] as const)('identifies %s failures without raw errors', async (stage) => {
    const events: { stage: string }[] = [];
    const planner = new OpenAIPlanner({
      apiKey: 'secret-fixture',
      model: APPROVED_MODEL,
      reasoning: 'low',
      budget: {
        reserve: () => {
          if (stage === 'reservation') throw new Error('secret');
          return 'reservation';
        },
        settle: () => {
          if (stage === 'settlement') throw new Error('secret');
        },
      },
      onDiagnostic: (e) => events.push(e),
      fetch: async () => {
        if (stage === 'transport') throw new Error('secret');
        if (stage === 'response_json') return new Response('not json');
        if (stage === 'response_shape') return Response.json({ status: 'incomplete', usage });
        return wire({ invalid: 'secret' });
      },
    });
    await expect(planner.plan(context(), new AbortController().signal)).rejects.toThrow();
    expect(events).toHaveLength(1);
    expect(events[0]?.stage).toBe(stage);
    expect(JSON.stringify(events)).not.toContain('secret');
  });
  it('does not let a failing logger cause retries or interrupt settlement', async () => {
    const budget = setup().budget;
    const transport = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    const planner = new OpenAIPlanner({
      apiKey: 'fixture',
      model: APPROVED_MODEL,
      reasoning: 'low',
      budget,
      fetch: transport,
      onDiagnostic: () => {
        throw new Error('logger failure');
      },
    });
    await expect(planner.plan(context(), new AbortController().signal)).rejects.toThrow(
      'OpenAI planning request failed',
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
