// Characterization of the existing bug, not acceptance of a recovery fix.
// All state is in memory; provider responses are injected, with no external calls.
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { fixtureProducts } from '../fixtures/catalog.js';
import { buildApp } from '../apps/api/src/app.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects.js';
import { hashToken } from '../apps/api/src/persistence/auth.js';
import { visualService } from '../apps/api/src/youcam/service.js';
import { VisualError, type YouCamProvider } from '../apps/api/src/youcam/provider.js';
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function fixture() {
  const start = vi.fn(async () => 'fixture-original-task');
  const poll = vi.fn(async () => ({
    status: 'completed' as const,
    outputUrl: 'https://assets.test/original-output',
  }));
  const provider: YouCamProvider = { mode: 'live', start, poll };
  const repository = createMemoryRepository(
    fixtureProducts.map((p) => ({
      ...p,
      vtoEligible: true,
      vtoAssetUrl: 'https://assets.test/product',
    })),
  );
  const objects = createMemoryObjectStore();
  const app = buildApp({ shopping: { repository, objects, visualProvider: provider } });
  apps.push(app);
  const token = 'd'.repeat(64),
    owner = hashToken(token),
    headers = { authorization: `Bearer ${token}` };
  const session = (
    await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
  ).json();
  const id = session.state.id as string;
  const data = (
    await sharp({ create: { width: 64, height: 64, channels: 3, background: '#eee' } })
      .png()
      .toBuffer()
  ).toString('base64');
  const asset = (
    await app.inject({
      method: 'POST',
      url: `/v1/sessions/${id}/assets`,
      headers,
      payload: { requestId: randomUUID(), type: 'portrait', mimeType: 'image/png', data },
    })
  ).json();
  let time = 100000;
  const service = visualService(repository, objects, provider, () => time);
  const request = { requestId: randomUUID(), productId: 'E01', assetId: asset.id };
  await service.create(owner, id, request);
  return {
    service,
    repository,
    owner,
    id,
    request,
    session,
    start,
    poll,
    tick: (ms: number) => {
      time += ms;
    },
  };
}
it('reproduces completed provider output being discarded by the ten-minute cutoff, then terminal lockout', async () => {
  const f = await fixture();
  await f.service.advance(f.owner, f.id, f.request.requestId);
  f.tick(600001);
  const job = await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(job).toMatchObject({
    status: 'failed',
    result: null,
    error: { code: 'PROVIDER_TIMEOUT' },
  });
  expect(f.poll).not.toHaveBeenCalled();
  const stored = await f.repository.visual(f.owner, f.id, (s) => s);
  expect(stored.jobs[0]?.taskId).toBe('fixture-original-task');
  f.tick(3000);
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(await f.service.create(f.owner, f.id, f.request)).toEqual({ type: 'job', job });
  expect(f.poll).not.toHaveBeenCalled();
  expect(f.start).toHaveBeenCalledTimes(1);
  expect((await f.repository.read(f.owner, f.id)).view).toEqual(f.session);
});
it('lost client acknowledgment can reconcile the persisted original task before the cutoff without resubmitting', async () => {
  const f = await fixture();
  // Server finishes advancement; simulate the caller discarding its response.
  await f.service.advance(f.owner, f.id, f.request.requestId);
  f.tick(3000);
  const job = await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(job).toMatchObject({
    id: f.request.requestId,
    assetId: f.request.assetId,
    status: 'completed',
    result: { kind: 'image' },
  });
  expect(f.poll).toHaveBeenCalledWith('earrings', 'fixture-original-task');
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(f.start).toHaveBeenCalledTimes(1);
  expect(f.poll).toHaveBeenCalledTimes(1);
});
it('unknown provider acknowledgment retains the original request and never automatically replays start', async () => {
  const f = await fixture();
  f.start.mockRejectedValueOnce(
    new VisualError('PROVIDER_TIMEOUT', 'Injected lost acknowledgment'),
  );
  await f.service.advance(f.owner, f.id, f.request.requestId);
  f.tick(70000);
  await f.service.advance(f.owner, f.id, f.request.requestId);
  const state = await f.repository.visual(f.owner, f.id, (s) => s);
  expect(state.jobs[0]).toMatchObject({
    taskId: null,
    job: { id: f.request.requestId, status: 'failed' },
  });
  expect(f.start).toHaveBeenCalledTimes(1);
  expect(f.poll).not.toHaveBeenCalled();
});
it('denies another owner and another session before polling the existing task', async () => {
  const f = await fixture();
  await f.service.advance(f.owner, f.id, f.request.requestId);
  f.tick(3000);
  await expect(
    f.service.advance(hashToken('e'.repeat(64)), f.id, f.request.requestId),
  ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  await expect(f.service.advance(f.owner, randomUUID(), f.request.requestId)).rejects.toMatchObject(
    { code: 'SESSION_NOT_FOUND' },
  );
  expect(f.poll).not.toHaveBeenCalled();
  expect(f.start).toHaveBeenCalledTimes(1);
});
it('transient status failure can retry only the same task before the deadline', async () => {
  const f = await fixture();
  await f.service.advance(f.owner, f.id, f.request.requestId);
  f.tick(3000);
  f.poll.mockRejectedValueOnce(new VisualError('PROVIDER_TIMEOUT', 'Injected status timeout'));
  await expect(f.service.advance(f.owner, f.id, f.request.requestId)).rejects.toMatchObject({
    code: 'PROVIDER_TIMEOUT',
  });
  f.tick(3000);
  expect((await f.service.advance(f.owner, f.id, f.request.requestId)).status).toBe('completed');
  expect(f.poll.mock.calls).toEqual([
    ['earrings', 'fixture-original-task'],
    ['earrings', 'fixture-original-task'],
  ]);
  expect(f.start).toHaveBeenCalledTimes(1);
});
