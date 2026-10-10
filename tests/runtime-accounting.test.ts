import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../apps/api/src/persistence/postgres.js';
import { RuntimeLedger, PostgresOpenAIBudget } from '../apps/api/src/accounting/postgres.js';
import { APPROVED_MODEL } from '../apps/api/src/llm/budget.js';
import { buildApp } from '../apps/api/src/app.js';
import { runtimeState } from '../apps/api/src/runtime.js';
import { accountingConfig } from '../apps/api/src/accounting/config.js';

it('reports configuration without secrets and keeps liveness independent of readiness', async () => {
  const runtime = runtimeState({
    PERSISTENCE_MODE: 'postgres',
    OBJECT_STORAGE_MODE: 's3',
    USE_MOCK_LLM: 'false',
    USE_MOCK_YOUCAM: 'false',
    YOUCAM_LEDGER_MODE: 'postgres',
    OPENAI_LEDGER_MODE: 'postgres',
    YOUCAM_LEDGER_SCOPE: 'judge',
    OPENAI_API_KEY: 'secret',
    DATABASE_URL: 'secret',
  });
  let available = true;
  const app = buildApp({
    runtime,
    readiness: async () => {
      if (!available) throw new Error('secret');
    },
  });
  try {
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok', service: 'youcam-api' });
    const ready = await app.inject('/ready');
    expect(ready.statusCode).toBe(200);
    expect(ready.json().runtime).toMatchObject({
      llm: 'openai',
      youcam: 'live',
      persistence: 'postgres',
      objectStorage: 's3',
    });
    available = false;
    const failure = await app.inject('/ready');
    expect(failure.statusCode).toBe(503);
    expect(failure.body).not.toContain('secret');
    expect((await app.inject('/health')).statusCode).toBe(200);
    available = true;
    expect((await app.inject('/ready')).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
it.each(['0', '-1', 'NaN', '1.1'])('rejects invalid runtime request ceiling %s', (value) => {
  expect(() => accountingConfig({ OPENAI_JUDGE_MAX_REQUESTS: value })).toThrow();
});

describe.runIf(process.env.M5_INTEGRATION === '1')('fresh judge PostgreSQL accounting', () => {
  const connectionString =
    'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
  const schema = 'judge_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString });
  const options = { connectionString, options: `-c search_path=${schema}` };
  const pool = new Pool(options);
  const limits = { maxRequests: 200, maxUnits: 0, maxUsd: 3 };
  const openai = new RuntimeLedger(pool, 'openai', limits);
  const youcam = new RuntimeLedger(pool, 'youcam', { maxRequests: 50, maxUnits: 50, maxUsd: 0 });
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM runtime_usage');
    await pool.query("UPDATE runtime_budgets SET blocked=false,approved=(provider='youcam')");
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const approve = () =>
    pool.query("UPDATE runtime_budgets SET approved=true WHERE provider='openai'");
  it('preserves historical YouCam totals and refuses unreviewed OpenAI activation', async () => {
    await migrate(pool);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM youcam_usage_reservations')).rows[0].n,
    ).toBe(5);
    await openai.initialize(false);
    await expect(openai.initialize()).rejects.toThrow('approval');
    await expect(openai.reserveAttempt(randomUUID(), 0, 0.1)).rejects.toThrow();
    await youcam.initialize();
  });
  it('keeps judge usage separate from validation', async () => {
    await youcam.reserveAttempt(randomUUID(), 1, 0, 'earrings');
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM youcam_usage_reservations')).rows[0].n,
    ).toBe(5);
  });
  it('accounts tokens, cached usage and spend exactly once across restart', async () => {
    await approve();
    const b = new PostgresOpenAIBudget(openai);
    const id = await b.reserve(APPROVED_MODEL, 1000, 2048);
    const usage = {
      input_tokens: 1000,
      output_tokens: 100,
      input_tokens_details: { cached_tokens: 500 },
    };
    await b.settle(id, usage);
    const restartedPool = new Pool(options);
    try {
      const restarted = new RuntimeLedger(restartedPool, 'openai', limits);
      await restarted.initialize();
      await restarted.commitAttempt(id, usage);
      const row = (await restartedPool.query('SELECT * FROM runtime_usage WHERE id=$1', [id]))
        .rows[0];
      expect(row.usage).toEqual(usage);
      expect(Number(row.charged_usd)).toBeCloseTo(0.0023, 8);
      await expect(
        restarted.commitAttempt(id, { input_tokens: 1, output_tokens: 1 }),
      ).rejects.toThrow('Conflicting');
    } finally {
      await restartedPool.end();
    }
  });
  it('prevents concurrent duplicate reservations and conflicting payloads', async () => {
    await approve();
    const id = randomUUID();
    expect(
      (
        await Promise.all([openai.reserveAttempt(id, 0, 0.1), openai.reserveAttempt(id, 0, 0.1)])
      ).sort(),
    ).toEqual([false, true]);
    await expect(openai.reserveAttempt(id, 0, 0.2)).rejects.toThrow('conflict');
  });
  it('enforces the monetary cap with unresolved submissions', async () => {
    await approve();
    await openai.reserveAttempt(randomUUID(), 0, 2);
    await expect(openai.reserveAttempt(randomUUID(), 0, 1.01)).rejects.toThrow('exhausted');
  });
  it('enforces 50 concurrent YouCam reservations across workers', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 53 }, () => youcam.reserveAttempt(randomUUID(), 1, 0, 'rings')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(50);
  });
  it('enforces request ceiling separately from money', async () => {
    await approve();
    await pool.query("UPDATE runtime_budgets SET max_requests=1 WHERE provider='openai'");
    try {
      const small = new RuntimeLedger(pool, 'openai', { ...limits, maxRequests: 1 });
      await small.reserveAttempt(randomUUID(), 0, 0.01);
      await expect(small.reserveAttempt(randomUUID(), 0, 0.01)).rejects.toThrow('exhausted');
    } finally {
      await pool.query("UPDATE runtime_budgets SET max_requests=200 WHERE provider='openai'");
    }
  });
  it('retains uncertain usage on malformed responses and failed commits', async () => {
    await approve();
    const id = randomUUID();
    await openai.reserveAttempt(id, 0, 0.1);
    await expect(openai.commitAttempt(id, {})).rejects.toThrow();
    expect(
      Number(
        (await pool.query('SELECT charged_usd FROM runtime_usage WHERE id=$1', [id])).rows[0]
          .charged_usd,
      ),
    ).toBe(0.1);
    await pool.query(
      'ALTER TABLE runtime_usage ADD CONSTRAINT deny_commit CHECK(committed_at IS NULL)',
    );
    try {
      await expect(
        openai.commitAttempt(id, { input_tokens: 1, output_tokens: 1 }),
      ).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE runtime_usage DROP CONSTRAINT deny_commit');
    }
    await openai.commitAttempt(id, { input_tokens: 1, output_tokens: 1 });
  });
  it('blocks future requests after an unexpected reservation overrun', async () => {
    await approve();
    const id = randomUUID();
    await openai.reserveAttempt(id, 0, 0.00000001);
    await openai.commitAttempt(id, { input_tokens: 100, output_tokens: 100 });
    await expect(openai.initialize()).rejects.toThrow();
    await expect(openai.reserveAttempt(randomUUID(), 0, 0.01)).rejects.toThrow();
  });
  it('rejects missing schema, mismatched ceilings and unknown settlement IDs', async () => {
    await expect(
      new RuntimeLedger(pool, 'youcam', { maxRequests: 51, maxUnits: 51, maxUsd: 0 }).initialize(),
    ).rejects.toThrow();
    await expect(youcam.commitAttempt(randomUUID())).rejects.toThrow('Unknown');
    const p = new Pool({ connectionString, options: '-c search_path=absent_judge_schema' });
    try {
      await expect(new RuntimeLedger(p, 'openai', limits).initialize()).rejects.toThrow(
        'migration 005',
      );
    } finally {
      await p.end();
    }
  });
});

it('requires persistent ledgers for production live adapters without calling providers', async () => {
  const { llmProvider } = await import('../apps/api/src/llm/config.js');
  const { youcamProvider } = await import('../apps/api/src/youcam/config.js');
  expect(() =>
    llmProvider({
      NODE_ENV: 'production',
      USE_MOCK_LLM: 'false',
      LLM_PROVIDER: 'openai',
      LLM_MODEL: APPROVED_MODEL,
      OPENAI_API_KEY: 'unused',
    }),
  ).toThrow('OPENAI_LEDGER_MODE=postgres');
  expect(() =>
    youcamProvider({
      NODE_ENV: 'production',
      USE_MOCK_YOUCAM: 'false',
      YOUCAM_API_KEY: 'unused',
      YOUCAM_UPLOAD_HOSTS: 'upload.test',
      YOUCAM_ASSET_HOSTS: 'asset.test',
      YOUCAM_USAGE_LEDGER: 'unused',
    }),
  ).toThrow('PostgreSQL judge');
});
