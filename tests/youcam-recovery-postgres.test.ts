import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  migrate,
  seedFixtures,
  createPostgresRepository,
} from '../apps/api/src/persistence/postgres.js';
import { taskReconciler } from '../apps/api/src/youcam/reconcile.js';
import { visualService } from '../apps/api/src/youcam/service.js';
import { recoveryFixture } from './helpers/recovery.js';
// Fixed loopback target, separate disposable schema; never load deployment env.
describe.runIf(process.env.M5_INTEGRATION === '1')('durable same-task recovery', () => {
  const connectionString =
    'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
  const schema = `recovery_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString });
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 5 });
  const repository = createPostgresRepository(pool);
  const fixtures: Awaited<ReturnType<typeof recoveryFixture>>[] = [];
  async function fixture(queuedOnly = false) {
    const f = await recoveryFixture(repository, queuedOnly);
    fixtures.push(f);
    return f;
  }
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(pool);
    await seedFixtures(pool);
    await pool.query(
      'UPDATE products SET product=product || \'{"vtoEligible":true,"vtoAssetUrl":"https://assets.test/product"}\'::jsonb WHERE id=\'E01\'',
    );
  }, 30000);
  afterAll(async () => {
    await Promise.all(fixtures.map((f) => f.app.close()));
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });
  it('restores an aged pristine queue on a new connection and serializes its first submission', async () => {
    const f = await fixture(true);
    const before = await repository.visual(f.owner, f.id, (s) => s);
    const secondPool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    try {
      const restored = createPostgresRepository(secondPool);
      const service = visualService(restored, f.objects, f.provider, f.clock);
      f.start.mockImplementation(async () => {
        const state = await restored.visual(f.owner, f.id, (s) => s);
        expect(state.jobs[0]).toMatchObject({
          lastPollAt: f.clock(),
          job: { status: 'processing' },
        });
        return 'once-after-restart';
      });
      await service.read(f.owner, f.id, f.request.requestId);
      expect(f.start).not.toHaveBeenCalled();
      await Promise.all([
        service.advance(f.owner, f.id, f.request.requestId),
        f.service.advance(f.owner, f.id, f.request.requestId),
      ]);
      expect(f.start).toHaveBeenCalledTimes(1);
      const after = await restored.visual(f.owner, f.id, (s) => s);
      expect(after.jobs).toHaveLength(1);
      expect(after.jobs[0]!.job.createdAt).toBe(before.jobs[0]!.job.createdAt);
      expect(after.jobs[0]!.job.id).toBe(f.request.requestId);
      expect((await restored.read(f.owner, f.id)).view).toEqual(f.session);
    } finally {
      await secondPool.end();
    }
  });
  it('concurrent callers persist one completion/audit, preserve ledgers, and restore after connection restart', async () => {
    const f = await fixture();
    await pool.query(
      "INSERT INTO runtime_usage(provider,id,category,units,reserved_usd,charged_usd,committed_at) VALUES('youcam',$1,'earrings',1,0,0,now())",
      [f.request.requestId],
    );
    const usage = (await pool.query('SELECT * FROM runtime_usage ORDER BY provider,id')).rows;
    const budgets = (await pool.query('SELECT * FROM runtime_budgets ORDER BY provider')).rows;
    let count = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.poll.mockImplementation(async () => {
      if (++count === 2) release();
      await barrier;
      return { status: 'completed', outputUrl: 'https://assets.test/original' };
    });
    let validations = 0;
    f.validateOutput.mockImplementation(async () => ({
      ...f.verified,
      expiresAt: f.verified.expiresAt + ++validations * 1000,
    }));
    const upload = vi.spyOn(f.objects, 'put');
    const results = await Promise.all([f.recover(), f.recover()]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]!.status).toBe('completed');
    expect(f.start).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect((await pool.query('SELECT * FROM runtime_usage ORDER BY provider,id')).rows).toEqual(
      usage,
    );
    expect((await pool.query('SELECT * FROM runtime_budgets ORDER BY provider')).rows).toEqual(
      budgets,
    );
    expect((await repository.read(f.owner, f.id)).view).toEqual(f.session);
    const secondPool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    try {
      const restored = createPostgresRepository(secondPool);
      const poll = vi.fn();
      expect(
        await taskReconciler(restored, { mode: 'live', poll }, f.clock)(
          f.owner,
          f.id,
          f.request.requestId,
        ),
      ).toEqual(results[0]);
      expect(poll).not.toHaveBeenCalled();
      const state = await restored.visual(f.owner, f.id, (s) => s);
      expect(state.jobs[0]).toMatchObject({
        taskId: 'original-fixture-task',
        reconciliation: { previousStatus: 'failed', previousError: { code: 'PROVIDER_TIMEOUT' } },
      });
    } finally {
      await secondPool.end();
    }
  });
  it('I/O holds no session lock, interruption persists no completion, and restart can recover', async () => {
    const f = await fixture();
    const before = await repository.visual(f.owner, f.id, (s) => s);
    f.poll.mockImplementationOnce(async () => {
      // This would deadlock if external polling ran under the owned-session lock.
      const state = await repository.visual(f.owner, f.id, (s) => s);
      expect(state).toEqual(before);
      throw new Error('Injected interrupted request');
    });
    await expect(f.recover()).rejects.toThrow();
    expect(await repository.visual(f.owner, f.id, (s) => s)).toEqual(before);
    const secondPool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    try {
      expect(
        (
          await taskReconciler(createPostgresRepository(secondPool), f.provider, f.clock)(
            f.owner,
            f.id,
            f.request.requestId,
          )
        ).status,
      ).toBe('completed');
    } finally {
      await secondPool.end();
    }
    expect(f.start).toHaveBeenCalledTimes(1);
  });
  it('revalidates ownership at persistence after provider I/O', async () => {
    const f = await fixture();
    // Ownership access is rechecked by the repository, not trusted from the first read.
    const visual = repository.visual.bind(repository);
    let calls = 0;
    const wrapped = {
      ...repository,
      visual: vi.fn(async (...args: Parameters<typeof repository.visual>) => {
        if (++calls === 2) return visual('unrelated-owner', args[1], args[2]);
        return visual(...args);
      }),
    };
    await expect(
      taskReconciler(wrapped, f.provider, f.clock)(f.owner, f.id, f.request.requestId),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    expect((await repository.visual(f.owner, f.id, (s) => s)).jobs[0]!.job.status).toBe('failed');
  });
});
