import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../apps/api/src/persistence/postgres.js';
import { PostgresUsageLedger } from '../apps/api/src/youcam/ledger.js';
import { initializeYouCamLedger, ledgerSettings } from '../apps/api/src/youcam/ledger-config.js';

describe('YouCam ledger configuration', () => {
  it('keeps mock startup independent of database availability', async () => {
    expect(await initializeYouCamLedger({ USE_MOCK_YOUCAM: 'true' })).toBeUndefined();
  });
  it('requires persistent database configuration', () => {
    expect(() => ledgerSettings({ YOUCAM_LEDGER_MODE: 'postgres' })).toThrow('DATABASE_URL');
    expect(() => ledgerSettings({ YOUCAM_LEDGER_MODE: 'unknown' })).toThrow('YOUCAM_LEDGER_MODE');
  });
  it('validates ceilings and retains fixed file limits', () => {
    expect(() =>
      ledgerSettings({ YOUCAM_USAGE_LEDGER: 'unused', YOUCAM_MAX_REQUESTS: '0' }),
    ).toThrow();
    expect(() => ledgerSettings({ YOUCAM_USAGE_LEDGER: 'unused', YOUCAM_MAX_UNITS: '9' })).toThrow(
      'fixed',
    );
  });
  it('fails file startup for missing history', async () => {
    await expect(
      initializeYouCamLedger({
        USE_MOCK_YOUCAM: 'false',
        YOUCAM_USAGE_LEDGER: '/nonexistent/ledger',
      }),
    ).rejects.toThrow('initialization failed');
  });
});

describe.runIf(process.env.M5_INTEGRATION === '1')('PostgreSQL YouCam ledger', () => {
  const connectionString =
    'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
  const schema = `ledger_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString });
  const options = { connectionString, options: `-c search_path=${schema}` };
  const pool = new Pool(options);
  const ledger = new PostgresUsageLedger(pool);
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM youcam_usage_reservations WHERE NOT historical');
    await pool.query('UPDATE youcam_usage_budget SET max_requests=8,max_units=8');
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  it('initializes and imports history exactly once across migrations', async () => {
    await ledger.initialize();
    await migrate(pool);
    const result = await pool.query('SELECT * FROM youcam_usage_reservations');
    expect(result.rows).toHaveLength(5);
    expect(result.rows.every((r) => r.units === 1 && r.committed_at && r.historical)).toBe(true);
  });
  it('reserves and commits once without double accounting', async () => {
    const id = randomUUID();
    expect(await ledger.reserve(id, 'rings')).toBe(true);
    await ledger.commit(id);
    await ledger.commit(id);
    expect(await ledger.reserve(id, 'rings')).toBe(false);
    const result = await pool.query(
      'SELECT count(*)::int AS requests,sum(units)::int AS units FROM youcam_usage_reservations',
    );
    expect(result.rows[0]).toEqual({ requests: 6, units: 6 });
  });
  it('rejects duplicate payload changes and unknown commits', async () => {
    const id = randomUUID();
    await ledger.reserve(id, 'rings');
    await expect(ledger.reserve(id, 'watches')).rejects.toThrow();
    await expect(ledger.commit(randomUUID())).rejects.toThrow();
  });
  it('serializes simultaneous duplicate reservations', async () => {
    const id = randomUUID();
    expect(
      (await Promise.all([ledger.reserve(id, 'rings'), ledger.reserve(id, 'rings')])).sort(),
    ).toEqual([false, true]);
  });
  it('enforces ceilings across concurrent workers including uncommitted attempts', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => ledger.reserve(randomUUID(), 'rings')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });
  it('persists reservation and commit state across new connections', async () => {
    const id = randomUUID();
    await ledger.reserve(id, 'watches');
    const restartedPool = new Pool(options);
    try {
      const restarted = new PostgresUsageLedger(restartedPool);
      await restarted.initialize();
      expect(await restarted.reserve(id, 'watches')).toBe(false);
      await restarted.commit(id);
      expect(
        (
          await restartedPool.query(
            'SELECT committed_at FROM youcam_usage_reservations WHERE id=$1',
            [id],
          )
        ).rows[0].committed_at,
      ).toBeTruthy();
    } finally {
      await restartedPool.end();
    }
  });
  it('enforces independently configured request and unit ceilings', async () => {
    await pool.query('UPDATE youcam_usage_budget SET max_requests=6,max_units=9');
    const limited = new PostgresUsageLedger(pool, 6, 9);
    await limited.initialize();
    await limited.reserve(randomUUID(), 'rings');
    await expect(limited.reserve(randomUUID(), 'rings')).rejects.toThrow();
    await pool.query('UPDATE youcam_usage_budget SET max_requests=9,max_units=6');
    await expect(
      new PostgresUsageLedger(pool, 9, 6).reserve(randomUUID(), 'rings'),
    ).rejects.toThrow();
  });
  it('fails initialization on mismatched limits and missing schema', async () => {
    await expect(new PostgresUsageLedger(pool, 9, 9).initialize()).rejects.toThrow(
      'initialization failed',
    );
    const missing = new Pool({
      connectionString,
      options: '-c search_path=nonexistent_ledger_schema',
    });
    try {
      await expect(new PostgresUsageLedger(missing).initialize()).rejects.toThrow('migration 004');
    } finally {
      await missing.end();
    }
  });
  it('fails closed and recovers after a database statement failure', async () => {
    await pool.query(
      'ALTER TABLE youcam_usage_reservations ADD CONSTRAINT reject_new CHECK (historical)',
    );
    const id = randomUUID();
    try {
      await expect(ledger.reserve(id, 'rings')).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE youcam_usage_reservations DROP CONSTRAINT reject_new');
    }
    expect(await ledger.reserve(id, 'rings')).toBe(true);
  });
  it('retains charged reservation when commit fails and recovers idempotently', async () => {
    const id = randomUUID();
    await ledger.reserve(id, 'rings');
    await pool.query(
      'ALTER TABLE youcam_usage_reservations ADD CONSTRAINT reject_commit CHECK (historical OR committed_at IS NULL)',
    );
    try {
      await expect(ledger.commit(id)).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE youcam_usage_reservations DROP CONSTRAINT reject_commit');
    }
    expect(await ledger.reserve(id, 'rings')).toBe(false);
    await ledger.commit(id);
  });
});
