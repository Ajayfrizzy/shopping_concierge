import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { recoveryFixture } from './helpers/recovery.js';
import { VisualError } from '../apps/api/src/youcam/provider.js';
const fixtures: Awaited<ReturnType<typeof recoveryFixture>>[] = [];
async function setup() {
  const f = await recoveryFixture(undefined, true);
  fixtures.push(f);
  return f;
}
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.app.close()));
});
it('old pristine queue retains identity, claims before invocation, and concurrent advances start once', async () => {
  const f = await setup();
  const before = await f.service.read(f.owner, f.id, f.request.requestId);
  expect(f.clock() - before.createdAt).toBeGreaterThan(600000);
  f.start.mockImplementation(async () => {
    const state = await f.repository.visual(f.owner, f.id, (s) => s);
    expect(state.jobs[0]).toMatchObject({
      lastPollAt: f.clock(),
      taskId: null,
      job: { status: 'processing', id: before.id },
    });
    return 'single-task';
  });
  await Promise.all([
    f.service.advance(f.owner, f.id, before.id),
    f.service.advance(f.owner, f.id, before.id),
  ]);
  expect(f.start).toHaveBeenCalledTimes(1);
  const state = await f.repository.visual(f.owner, f.id, (s) => s);
  expect(state.jobs).toHaveLength(1);
  expect(state.jobs[0]!.job.createdAt).toBe(before.createdAt);
  expect(state.jobs[0]!.taskId).toBe('single-task');
  expect((await f.repository.read(f.owner, f.id)).view).toEqual(f.session);
});
it.each(['claimed-queue', 'unknown-processing', 'task-in-queue', 'terminal'] as const)(
  'never replays %s',
  async (kind) => {
    const f = await setup();
    await f.change((r) => {
      if (kind === 'claimed-queue') r.lastPollAt = f.clock() - 70000;
      if (kind === 'unknown-processing') {
        r.job.status = 'processing';
        r.lastPollAt = f.clock() - 70000;
      }
      if (kind === 'task-in-queue') r.taskId = 'existing-task';
      if (kind === 'terminal') {
        r.job.status = 'failed';
        r.job.error = { code: 'PROVIDER_TIMEOUT', message: 'Terminal fixture', recoverable: true };
      }
    });
    await f.service.advance(f.owner, f.id, f.request.requestId);
    await f.service.advance(f.owner, f.id, f.request.requestId);
    expect(f.start).not.toHaveBeenCalled();
  },
);
it('lost creation acknowledgment can be read and explicitly advanced without replacing the job', async () => {
  const f = await setup();
  const replay = await f.service.create(f.owner, f.id, f.request);
  expect(replay).toMatchObject({ type: 'job', job: { id: f.request.requestId, status: 'queued' } });
  const r = await f.app.inject({
    method: 'GET',
    url: `/v1/sessions/${f.id}/vto`,
    headers: f.headers,
  });
  expect(r.statusCode).toBe(200);
  expect(f.start).not.toHaveBeenCalled();
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(f.start).toHaveBeenCalledTimes(1);
  expect((await f.repository.visual(f.owner, f.id, (s) => s)).jobs).toHaveLength(1);
});
it.each(['owner', 'session'] as const)('denies wrong %s before submission', async (kind) => {
  const f = await setup();
  await expect(
    f.service.advance(
      kind === 'owner' ? 'other-owner' : f.owner,
      kind === 'session' ? randomUUID() : f.id,
      f.request.requestId,
    ),
  ).rejects.toThrow();
  expect(f.start).not.toHaveBeenCalled();
});
it.each(['missing', 'corrupt', 'type', 'ineligible'] as const)(
  'rejects %s portrait/product before provider invocation',
  async (kind) => {
    const f = await setup();
    if (kind === 'missing') vi.spyOn(f.objects, 'get').mockRejectedValue(new Error('Unavailable'));
    if (kind === 'corrupt') vi.spyOn(f.objects, 'get').mockResolvedValue(Buffer.from('corrupt'));
    if (kind === 'type') {
      const stored = await f.repository.asset(f.owner, f.id, f.request.assetId);
      vi.spyOn(f.repository, 'asset').mockResolvedValue({
        ...stored,
        asset: { ...stored.asset, type: 'hand' },
      });
    }
    if (kind === 'ineligible') {
      const products = await f.repository.products();
      vi.spyOn(f.repository, 'products').mockResolvedValue(
        products.map((p) => ({ ...p, vtoEligible: false })),
      );
    }
    expect((await f.service.advance(f.owner, f.id, f.request.requestId)).status).toBe('failed');
    expect(f.start).not.toHaveBeenCalled();
  },
);
it('budget denial remains terminal and cannot be replayed', async () => {
  const f = await setup();
  f.start.mockRejectedValue(new VisualError('PROVIDER_UNAVAILABLE', 'Budget exhausted'));
  expect((await f.service.advance(f.owner, f.id, f.request.requestId)).status).toBe('failed');
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(f.start).toHaveBeenCalledTimes(1);
});
