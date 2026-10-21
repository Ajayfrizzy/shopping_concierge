import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { createTryOnSession, canCheckExistingResult } from '../apps/mobile/src/try-on-session';
import { createVisualAPI } from '../apps/mobile/src/visual-client';
import { ClientError } from '../apps/mobile/src/client';
import type { VtoJob } from '@youcam/shared';
const disposals: (() => void)[] = [];
afterEach(() => {
  disposals.splice(0).forEach((f) => f());
  vi.useRealTimers();
});
async function setup(processing = false) {
  const job: VtoJob = {
    id: randomUUID(),
    sessionId: randomUUID(),
    productId: 'E01',
    assetId: randomUUID(),
    category: 'earrings',
    mode: 'live',
    status: processing ? 'processing' : 'failed',
    error: processing
      ? null
      : { code: 'PROVIDER_TIMEOUT', message: 'Local timeout', recoverable: true },
    result: null,
    createdAt: 1,
    updatedAt: 2,
  };
  const completed: VtoJob = {
    ...job,
    status: 'completed',
    error: null,
    result: { kind: 'image', url: 'https://assets.test/result', expiresAt: Date.now() + 600000 },
  };
  const api = {
    list: vi.fn(async () => [job]),
    reconcile: vi.fn(async () => completed),
    create: vi.fn(),
    advance: vi.fn(),
  };
  const journal = JSON.stringify({
    version: 1,
    sessionId: job.sessionId,
    productId: 'E01',
    assetId: job.assetId,
    requestId: job.id,
  });
  const storage = { read: vi.fn(async () => journal), write: vi.fn() };
  const make = () => {
    const c = createTryOnSession(api, storage, job.sessionId, 'E01', randomUUID);
    disposals.push(c.dispose);
    return c;
  };
  const c = make();
  await c.boot();
  return { job, completed, api, storage, c, make, journal };
}
it('uses the existing owner credential and sends only an empty body for the exact job', async () => {
  const f = await setup();
  const credential = vi.fn(async () => 'fixture-owner');
  const transport = vi.fn(async () => ({ ok: true, status: 200, json: async () => f.completed }));
  const api = createVisualAPI('https://backend.test', credential, transport);
  expect(await api.reconcile(f.job.sessionId, f.job.id)).toEqual(f.completed);
  expect(transport).toHaveBeenCalledWith(
    `https://backend.test/v1/sessions/${f.job.sessionId}/vto/${f.job.id}/reconcile`,
    expect.objectContaining({
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-owner' },
    }),
  );
  expect(credential).toHaveBeenCalledTimes(1);
});
it('locks duplicate taps, shows progress and restores result without changing journal or calling paid paths', async () => {
  const f = await setup();
  let release!: (j: VtoJob) => void;
  f.api.reconcile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const pending = f.c.checkExistingResult();
  await f.c.checkExistingResult();
  expect(f.c.getSnapshot()).toMatchObject({
    busy: true,
    notice: 'Checking existing provider task…',
  });
  release(f.completed);
  await pending;
  expect(f.c.getSnapshot()).toMatchObject({
    job: f.completed,
    busy: false,
    notice: 'Result recovered successfully. No additional render started.',
  });
  expect(f.api.reconcile).toHaveBeenCalledTimes(1);
  expect(f.api.create).not.toHaveBeenCalled();
  expect(f.api.advance).not.toHaveBeenCalled();
  expect(f.storage.write).not.toHaveBeenCalled();
});
it.each(['processing', 'timeout'] as const)(
  'does not label %s as completed or schedule follow-up POSTs',
  async (kind) => {
    vi.useFakeTimers();
    const f = await setup();
    f.api.reconcile.mockResolvedValue(
      kind === 'processing' ? { ...f.job, status: 'processing', error: null } : f.job,
    );
    await f.c.checkExistingResult();
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.c.getSnapshot().notice).toContain('still processing');
    expect(f.c.getSnapshot().job?.status).not.toBe('completed');
    expect(f.api.reconcile).toHaveBeenCalledTimes(1);
    expect(f.api.advance).not.toHaveBeenCalled();
  },
);
it.each(['PROVIDER_UNAVAILABLE', 'PROVIDER_AUTH', 'INVALID_REQUEST'])(
  'reports %s without starting anything else',
  async (code) => {
    const f = await setup();
    f.api.reconcile.mockRejectedValue(new ClientError(code, 'Private upstream details', 422));
    await f.c.checkExistingResult();
    expect(f.c.getSnapshot().error).toContain('No additional render started');
    expect(f.c.getSnapshot().error).not.toContain('Private');
    expect(f.c.getSnapshot().job).toEqual(f.job);
    expect(f.api.create).not.toHaveBeenCalled();
  },
);
it.each(['completed', 'unchanged', 'offline'] as const)(
  'lost acknowledgment uses one safe GET (%s), never another POST',
  async (kind) => {
    vi.useFakeTimers();
    const f = await setup();
    f.api.reconcile.mockRejectedValue(new ClientError('NETWORK', 'Timeout'));
    if (kind === 'completed') f.api.list.mockResolvedValue([f.completed]);
    if (kind === 'offline') f.api.list.mockRejectedValue(new Error('Offline'));
    await f.c.checkExistingResult();
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.api.reconcile).toHaveBeenCalledTimes(1);
    expect(f.api.list).toHaveBeenCalledTimes(2);
    expect(f.api.advance).not.toHaveBeenCalled();
    expect(f.api.create).not.toHaveBeenCalled();
    expect(f.c.getSnapshot().job?.status).toBe(kind === 'completed' ? 'completed' : 'failed');
    if (kind !== 'completed') expect(f.c.getSnapshot().error).toContain('confirmation');
  },
);
it.each(['sessionId', 'productId', 'assetId', 'id', 'mode', 'createdAt'] as const)(
  'rejects mismatched %s in recovery response',
  async (field) => {
    const f = await setup();
    f.api.reconcile.mockResolvedValue({
      ...f.completed,
      [field]: field === 'createdAt' ? 99 : field === 'mode' ? 'mock' : 'wrong',
    } as VtoJob);
    await f.c.checkExistingResult();
    expect(f.c.getSnapshot().job).toEqual(f.job);
    expect(f.c.getSnapshot().error).toContain('Recovery failed');
  },
);
it('navigation, remount and cold restart never reconcile automatically and retain failed-job recovery', async () => {
  vi.useFakeTimers();
  const f = await setup();
  f.c.visibility(false);
  await f.c.checkExistingResult();
  f.c.visibility(true);
  await vi.advanceTimersByTimeAsync(60000);
  f.c.dispose();
  const restored = f.make();
  await restored.boot();
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.api.reconcile).not.toHaveBeenCalled();
  expect(restored.getSnapshot().job).toEqual(f.job);
  expect(canCheckExistingResult(restored.getSnapshot().job, f.job.sessionId, 'E01')).toBe(true);
  expect(f.storage.write).not.toHaveBeenCalled();
});
it.each(['owner', 'product', 'mock', 'queued', 'completed', 'other-failure'] as const)(
  'rejects ineligible %s job',
  async (kind) => {
    const f = await setup();
    let j = { ...f.job };
    if (kind === 'owner') j.sessionId = randomUUID();
    if (kind === 'product') j.productId = 'N01';
    if (kind === 'mock') j.mode = 'mock';
    if (kind === 'queued') j = { ...j, status: 'queued', error: null };
    if (kind === 'completed') j = f.completed;
    if (kind === 'other-failure')
      j.error = { code: 'RENDER_FAILED', message: 'Failed', recoverable: true };
    expect(canCheckExistingResult(j, f.job.sessionId, 'E01')).toBe(false);
  },
);
it('transport refuses a response for another session or job', async () => {
  const f = await setup();
  const transport = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ...f.completed, sessionId: randomUUID() }),
  }));
  await expect(
    createVisualAPI('https://backend.test', async () => 'fixture-owner', transport).reconcile(
      f.job.sessionId,
      f.job.id,
    ),
  ).rejects.toThrow('another request');
});

it('processing restoration/refresh never advances; explicit recovery is single-shot and stays paused', async () => {
  vi.useFakeTimers();
  const f = await setup(true);
  await f.c.refresh();
  f.c.visibility(false);
  f.c.visibility(true);
  await vi.advanceTimersByTimeAsync(60000);
  f.c.dispose();
  const c = f.make();
  await c.boot();
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.api.advance).not.toHaveBeenCalled();
  expect(f.api.reconcile).not.toHaveBeenCalled();
  let release!: (j: VtoJob) => void;
  f.api.reconcile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const pending = c.checkExistingResult();
  await c.checkExistingResult();
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.api.reconcile).toHaveBeenCalledTimes(1);
  expect(f.api.advance).not.toHaveBeenCalled();
  release(f.job);
  await pending;
  expect(c.getSnapshot().notice).toContain('still processing');
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.api.advance).not.toHaveBeenCalled();
  expect(f.api.create).not.toHaveBeenCalled();
  expect(f.storage.write).not.toHaveBeenCalled();
});
it('processing recovery uncertainty performs one GET and never repeats POST or advancement', async () => {
  vi.useFakeTimers();
  const f = await setup(true);
  f.api.reconcile.mockRejectedValue(new ClientError('NETWORK', 'Timeout'));
  await f.c.checkExistingResult();
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.api.reconcile).toHaveBeenCalledTimes(1);
  expect(f.api.list).toHaveBeenCalledTimes(2);
  expect(f.c.getSnapshot().job).toEqual(f.job);
  expect(f.c.getSnapshot().error).toContain('confirmation');
  expect(f.api.advance).not.toHaveBeenCalled();
});
