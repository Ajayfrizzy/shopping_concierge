import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { createSession } from '@youcam/decision-engine';
import { interpretMockMessage, type PlanningContext } from '@youcam/agent';
import { migrate } from '../apps/api/src/persistence/postgres.js';
import { PostgresDiagnosticStore } from '../apps/api/src/llm/diagnostic-store.js';
import { OpenAIPlanner } from '../apps/api/src/llm/openai.js';
import { APPROVED_MODEL } from '../apps/api/src/llm/budget.js';
import { RuntimeLedger, PostgresOpenAIBudget } from '../apps/api/src/accounting/postgres.js';

// All provider transports are injected; this suite can never consume live credits.
describe.runIf(process.env.M5_INTEGRATION === '1')('durable OpenAI diagnostics', () => {
  const connectionString =
    'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
  const schema = 'diagnostics_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString });
  const options = { connectionString, options: `-c search_path=${schema}` };
  const pool = new Pool(options);
  const store = new PostgresDiagnosticStore(pool);
  const budget = new PostgresOpenAIBudget(
    new RuntimeLedger(pool, 'openai', { maxRequests: 200, maxUnits: 0, maxUsd: 3 }),
  );
  const ctx: PlanningContext = {
    state: createSession({ id: randomUUID(), goal: '' }),
    clientRequestId: randomUUID(),
    message: 'earrings',
    recentMessages: [],
    referencedProducts: [],
    tools: [],
  };
  const usage = {
    input_tokens: 100,
    output_tokens: 20,
    input_tokens_details: { cached_tokens: 50 },
  };
  const success = () =>
    Response.json({
      status: 'completed',
      usage,
      output: [
        {
          type: 'function_call',
          name: 'submit_shopping_plan',
          arguments: JSON.stringify(interpretMockMessage(ctx.message, ctx.state)),
        },
      ],
    });
  function planner(fetch: typeof globalThis.fetch, maxAttempts: 1 | 2 = 1, diagnostics = store) {
    return new OpenAIPlanner({
      apiKey: 'private-fixture-key',
      model: APPROVED_MODEL,
      reasoning: 'low',
      budget,
      diagnostics,
      fetch,
      maxAttempts,
    });
  }
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(pool);
    await pool.query("UPDATE runtime_budgets SET approved=true WHERE provider='openai'");
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM openai_provider_diagnostics');
    await pool.query('DELETE FROM runtime_usage');
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  it('initializes and reapplies migrations without modifying unresolved usage', async () => {
    const id = await budget.reserve(APPROVED_MODEL, 100, 2048);
    const before = (await pool.query('SELECT * FROM runtime_usage')).rows;
    await migrate(pool);
    await store.initialize();
    expect((await pool.query('SELECT * FROM runtime_usage')).rows).toEqual(before);
    expect(before[0].id).toBe(id);
  });
  it('persists HTTP failure with correlation and no raw content or secrets', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          error: {
            code: 'invalid_json_schema',
            type: 'invalid_request_error',
            message: 'private-fixture-key private conversation',
          },
        },
        { status: 400, headers: { 'x-request-id': 'req_safe123' } },
      ),
    );
    await expect(planner(transport).plan(ctx, new AbortController().signal)).rejects.toThrow();
    const rows = await store.list({ clientRequestId: ctx.clientRequestId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      session_id: ctx.state.id,
      client_request_id: ctx.clientRequestId,
      stage: 'http',
      http_status: 400,
      error_code: 'invalid_json_schema',
      error_type: 'invalid_request_error',
      provider_request_id: 'req_safe123',
      outcome: 'failure',
      aborted: false,
    });
    expect(rows[0].ledger_reservation_id).toBe(
      (await pool.query('SELECT id FROM runtime_usage')).rows[0].id,
    );
    expect(JSON.stringify(rows)).not.toMatch(/private-fixture-key|private conversation/);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(
      (await pool.query('SELECT committed_at FROM runtime_usage')).rows[0].committed_at,
    ).toBeNull();
  });
  it.each(['network', 'abort', 'json', 'shape', 'schema'] as const)(
    'persists %s failure exactly once',
    async (kind) => {
      const controller = new AbortController();
      const transport = vi.fn<typeof fetch>(async () => {
        if (kind === 'network') throw new Error('private network URL');
        if (kind === 'abort') {
          controller.abort(new DOMException('Timeout', 'TimeoutError'));
          controller.signal.throwIfAborted();
        }
        if (kind === 'json') return new Response('invalid private JSON', { status: 200 });
        if (kind === 'shape') return Response.json({ usage, status: 'incomplete' });
        return Response.json({
          usage,
          status: 'completed',
          output: [{ type: 'function_call', name: 'submit_shopping_plan', arguments: '{}' }],
        });
      });
      await expect(planner(transport).plan(ctx, controller.signal)).rejects.toThrow();
      const rows = await store.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        stage: {
          network: 'transport',
          abort: 'transport',
          json: 'response_json',
          shape: 'response_shape',
          schema: 'plan_schema',
        }[kind],
        outcome: 'failure',
        aborted: kind === 'abort',
        http_status: ['network', 'abort'].includes(kind) ? null : 200,
      });
      expect(JSON.stringify(rows)).not.toContain('private');
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it('persists successful settlement across connection restart and refuses double finalization', async () => {
    await planner(async () => success()).plan(ctx, new AbortController().signal);
    const restart = new Pool(options);
    try {
      const rows = await new PostgresDiagnosticStore(restart).list({ sessionId: ctx.state.id });
      expect(rows).toHaveLength(1);
      expect(rows[0].outcome).toBe('success');
      expect((await restart.query('SELECT usage FROM runtime_usage')).rows[0].usage).toEqual(usage);
      await expect(
        store.finish(rows[0].id, { stage: 'transport', aborted: false }, false),
      ).rejects.toThrow('finalized');
    } finally {
      await restart.end();
    }
  });
  it('creates exactly one row and reservation per configured attempt', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementationOnce(async () => success());
    await planner(transport, 2).plan(ctx, new AbortController().signal);
    const rows = await store.list();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.outcome).sort()).toEqual(['failure', 'success']);
    expect(new Set(rows.map((r) => r.ledger_reservation_id)).size).toBe(2);
    expect((await pool.query('SELECT id FROM runtime_usage')).rows).toHaveLength(2);
  });
  it('fails before provider and reservation when diagnostic insertion is unavailable', async () => {
    await pool.query(
      "ALTER TABLE openai_provider_diagnostics ADD CONSTRAINT deny_start CHECK(outcome <> 'pending')",
    );
    const transport = vi.fn<typeof fetch>();
    try {
      await expect(planner(transport).plan(ctx, new AbortController().signal)).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE openai_provider_diagnostics DROP CONSTRAINT deny_start');
    }
    expect(transport).not.toHaveBeenCalled();
    expect((await pool.query('SELECT id FROM runtime_usage')).rows).toHaveLength(0);
  });
  it('retains pending evidence and prevents retry if finalization fails; supports recovery', async () => {
    await pool.query(
      "ALTER TABLE openai_provider_diagnostics ADD CONSTRAINT deny_finish CHECK(outcome='pending')",
    );
    const transport = vi.fn<typeof fetch>(async () => new Response('', { status: 503 }));
    try {
      await expect(planner(transport, 2).plan(ctx, new AbortController().signal)).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE openai_provider_diagnostics DROP CONSTRAINT deny_finish');
    }
    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('pending');
    expect(transport).toHaveBeenCalledTimes(1);
    await store.finish(rows[0].id, { stage: 'http', status: 503, aborted: false }, false);
    expect((await store.list())[0].outcome).toBe('failure');
  });
  it('sanitizes unknown metadata and drops extra fields', async () => {
    const id = await store.start(ctx.state.id);
    await store.finish(
      id,
      {
        stage: 'http',
        aborted: false,
        errorCode: 'private-key',
        errorType: 'private-key',
        requestId: 'Bearer private-key',
        ...{ message: 'private-key', raw: 'private-key' },
      },
      false,
    );
    const rows = await store.list();
    expect(JSON.stringify(rows)).not.toContain('private-key');
    expect(rows[0]).toMatchObject({
      error_code: 'unrecognized',
      error_type: 'unrecognized',
      provider_request_id: null,
    });
  });
});
