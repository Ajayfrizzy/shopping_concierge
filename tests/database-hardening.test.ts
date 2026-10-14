import { randomUUID } from 'node:crypto';
import { expect, it, vi, describe } from 'vitest';
import { createSession } from '@youcam/decision-engine';
import { interpretMockMessage } from '@youcam/agent';
import { ReceiptBudget, parseReceipt, receiptKey } from '../apps/api/src/accounting/receipts.js';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects.js';
import { postgresPool } from '../apps/api/src/persistence/postgres.js';
import { OpenAIPlanner } from '../apps/api/src/llm/openai.js';
import { APPROVED_MODEL } from '../apps/api/src/llm/budget.js';
const usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 50 } };
const timeout = () =>
  Object.assign(new Error('Connection terminated due to connection timeout'), {
    code: 'ETIMEDOUT',
  });
const ctx = {
  state: createSession({ id: randomUUID(), goal: '' }),
  clientRequestId: randomUUID(),
  message: 'earrings',
  recentMessages: [],
  referencedProducts: [],
  tools: [],
};
const response = () =>
  Response.json({
    status: 'completed',
    usage: { ...usage, secret: 'do-not-persist' },
    output: [
      {
        type: 'function_call',
        name: 'submit_shopping_plan',
        arguments: JSON.stringify(interpretMockMessage(ctx.message, ctx.state)),
      },
    ],
  });
function setup() {
  const id = randomUUID(),
    objects = createMemoryObjectStore();
  const underlying = { reserve: vi.fn(async () => id), settle: vi.fn(async () => {}) };
  const budget = new ReceiptBudget(underlying, objects, 'private/');
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response());
  const diagnostics = {
    start: vi.fn(async () => randomUUID()),
    attach: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
  };
  const planner = new OpenAIPlanner({
    apiKey: 'fixture',
    model: APPROVED_MODEL,
    reasoning: 'low',
    maxAttempts: 1,
    budget,
    fetch,
    diagnostics,
  });
  return { id, objects, underlying, budget, fetch, diagnostics, planner };
}
it.each(['repository', 'accounting', 'validation'] as const)(
  'bounds %s pool and explicitly sets connection lifecycle',
  async (role) => {
    const pool = postgresPool('postgresql://unused:unused@localhost/unused', undefined, role);
    try {
      expect(pool.options).toMatchObject({
        max: role === 'repository' ? 4 : 2,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        query_timeout: 12000,
        statement_timeout: 10000,
        lock_timeout: 5000,
        keepAlive: true,
        maxLifetimeSeconds: 300,
      });
      expect(pool.totalCount).toBe(0);
    } finally {
      await pool.end();
    }
  },
);
it('does not invoke provider until reservation resolves durably', async () => {
  const s = setup();
  let release!: (id: ReturnType<typeof randomUUID>) => void;
  s.underlying.reserve.mockImplementationOnce(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const task = s.planner.plan(ctx, new AbortController().signal);
  await vi.waitFor(() => expect(s.underlying.reserve).toHaveBeenCalledTimes(1));
  expect(s.fetch).not.toHaveBeenCalled();
  release(s.id);
  await task;
  expect(s.fetch).toHaveBeenCalledTimes(1);
});
it('fails before provider on reservation timeout and recovers on a subsequent explicit request', async () => {
  const s = setup();
  s.underlying.reserve.mockRejectedValueOnce(timeout());
  await expect(s.planner.plan(ctx, new AbortController().signal)).rejects.toThrow();
  expect(s.fetch).not.toHaveBeenCalled();
  await s.planner.plan(ctx, new AbortController().signal);
  expect(s.fetch).toHaveBeenCalledTimes(1);
  expect(s.underlying.settle).toHaveBeenCalledTimes(1);
});
it.each(['start', 'attach'] as const)(
  'fails before provider on diagnostic %s timeout',
  async (stage) => {
    const s = setup();
    s.diagnostics[stage].mockRejectedValueOnce(timeout());
    await expect(s.planner.plan(ctx, new AbortController().signal)).rejects.toThrow();
    expect(s.fetch).not.toHaveBeenCalled();
    expect(s.underlying.reserve).toHaveBeenCalledTimes(stage === 'start' ? 0 : 1);
  },
);
it('persists only normalized token evidence before settlement timeout, then recovers without another paid call', async () => {
  const s = setup();
  s.underlying.settle.mockRejectedValueOnce(timeout());
  await expect(s.planner.plan(ctx, new AbortController().signal)).rejects.toThrow('reconciliation');
  const receipt = JSON.parse(
    Buffer.from(await s.objects.get(receiptKey('private/', s.id))).toString(),
  );
  expect(receipt).toEqual({ version: 1, reservationId: s.id, usage });
  expect(parseReceipt(receipt, s.id)).toEqual(usage);
  expect(() => s.budget.assertReady()).toThrow();
  expect(() => s.budget.reserve(APPROVED_MODEL, 1, 1)).toThrow();
  await Promise.all([s.budget.reconcilePending(), s.budget.reconcilePending()]);
  s.budget.assertReady();
  expect(s.fetch).toHaveBeenCalledTimes(1);
  expect(s.underlying.reserve).toHaveBeenCalledTimes(1);
  expect(s.underlying.settle).toHaveBeenCalledTimes(2);
});
it('retains pending tokens if S3 is unavailable and recovers writes without invoking the provider', async () => {
  const s = setup();
  vi.spyOn(s.objects, 'put').mockRejectedValueOnce(timeout());
  await expect(s.planner.plan(ctx, new AbortController().signal)).rejects.toThrow('reconciliation');
  expect(s.underlying.settle).not.toHaveBeenCalled();
  await s.budget.reconcilePending();
  expect(s.fetch).toHaveBeenCalledTimes(1);
  expect(s.underlying.reserve).toHaveBeenCalledTimes(1);
  expect(s.underlying.settle).toHaveBeenCalledTimes(1);
});
it('does not resend after diagnostic finalization fails following settled usage', async () => {
  const s = setup();
  s.diagnostics.finish.mockRejectedValueOnce(timeout());
  await expect(s.planner.plan(ctx, new AbortController().signal)).rejects.toThrow();
  expect(s.fetch).toHaveBeenCalledTimes(1);
  expect(s.underlying.settle).toHaveBeenCalledTimes(1);
  expect(
    parseReceipt(
      JSON.parse(Buffer.from(await s.objects.get(receiptKey('private/', s.id))).toString()),
      s.id,
    ),
  ).toEqual(usage);
});
it('rejects mismatched receipts and malformed usage', () => {
  const id = randomUUID();
  expect(() => parseReceipt({ version: 1, reservationId: randomUUID(), usage }, id)).toThrow();
  expect(() =>
    parseReceipt({ version: 1, reservationId: id, usage: { input_tokens: -1 } }, id),
  ).toThrow();
});

describe.runIf(process.env.M5_INTEGRATION === '1')('bounded real PostgreSQL pool recovery', () => {
  const url = 'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
  it('bounds acquisition when all clients are held and recovers without leaking clients', async () => {
    const pool = postgresPool(url, undefined, 'accounting');
    const a = await pool.connect(),
      b = await pool.connect();
    try {
      await expect(pool.connect()).rejects.toThrow(/timeout/i);
      expect(pool.waitingCount).toBe(0);
    } finally {
      a.release();
      b.release();
    }
    try {
      expect((await pool.query('SELECT 1 AS n')).rows[0].n).toBe(1);
      expect(pool.totalCount).toBeLessThanOrEqual(2);
      expect(pool.waitingCount).toBe(0);
    } finally {
      await pool.end();
    }
  });
  it('removes a broken idle connection and reconnects using the same pool', async () => {
    const pool = postgresPool(url, undefined, 'accounting'),
      admin = postgresPool(url);
    try {
      const client = await pool.connect();
      const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const disconnected = new Promise<void>((resolve) => pool.once('error', () => resolve()));
      client.release();
      await admin.query('SELECT pg_terminate_backend($1)', [pid]);
      await disconnected;
      const next = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      expect(next).not.toBe(pid);
      expect(pool.waitingCount).toBe(0);
    } finally {
      await pool.end();
      await admin.end();
    }
  });
});
