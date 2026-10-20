import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { recoveryFixture } from './helpers/recovery.js';
import { VisualError } from '../apps/api/src/youcam/provider.js';
import { createVisualAPI } from '../apps/mobile/src/visual-client.js';
import { createTryOnSession } from '../apps/mobile/src/try-on-session.js';
const fixtures: Awaited<ReturnType<typeof recoveryFixture>>[] = [];
async function setup() {
  const f = await recoveryFixture();
  fixtures.push(f);
  return f;
}
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.app.close()));
});
it('recovers the original timeout job, preserves audit and all immutable state, and is idempotent', async () => {
  const f = await setup();
  const before = await f.repository.visual(f.owner, f.id, (s) => s);
  const upload = vi.spyOn(f.objects, 'put');
  const job = await f.recover();
  expect(job).toMatchObject({
    id: f.request.requestId,
    productId: 'E01',
    assetId: f.request.assetId,
    status: 'completed',
    error: null,
    result: { kind: 'image', expiresAt: f.verified.expiresAt },
  });
  expect(f.poll).toHaveBeenCalledWith('earrings', 'original-fixture-task');
  const after = await f.repository.visual(f.owner, f.id, (s) => s);
  expect(after.jobs[0]).toMatchObject({
    taskId: before.jobs[0]!.taskId,
    reconciliation: {
      previousStatus: 'failed',
      previousError: { code: 'PROVIDER_TIMEOUT' },
      previousUpdatedAt: before.jobs[0]!.job.updatedAt,
      sha256: f.verified.sha256,
    },
  });
  expect(job.createdAt).toBe(before.jobs[0]!.job.createdAt);
  expect(await f.recover()).toEqual(job);
  expect(f.poll).toHaveBeenCalledTimes(1);
  expect(f.start).toHaveBeenCalledTimes(1);
  expect(upload).not.toHaveBeenCalled();
  expect((await f.repository.read(f.owner, f.id)).view).toEqual(f.session);
});
it('keeps a provider-running task recoverable without inventing terminal failure', async () => {
  const f = await setup();
  f.poll.mockResolvedValue({ status: 'processing' });
  const before = await f.repository.visual(f.owner, f.id, (s) => s);
  expect((await f.recover()).status).toBe('failed');
  expect(await f.repository.visual(f.owner, f.id, (s) => s)).toEqual(before);
  await f.change((r) => {
    r.job.status = 'processing';
    r.job.error = null;
  });
  expect((await f.service.advance(f.owner, f.id, f.request.requestId)).status).toBe('processing');
  expect(f.validateOutput).not.toHaveBeenCalled();
  expect(f.start).toHaveBeenCalledTimes(1);
});
it('records a confirmed provider failure without another start', async () => {
  const f = await setup();
  f.poll.mockResolvedValue({
    status: 'failed',
    error: { code: 'RENDER_FAILED', message: 'Provider failed', recoverable: true },
  });
  expect(await f.recover()).toMatchObject({ status: 'failed', error: { code: 'RENDER_FAILED' } });
  await expect(f.recover()).rejects.toMatchObject({ statusCode: 409 });
  expect(f.start).toHaveBeenCalledTimes(1);
});
it.each(['task', 'unrelated', 'queued', 'mock'] as const)(
  'rejects ineligible %s job without polling',
  async (kind) => {
    const f = await setup();
    await f.change((r) => {
      if (kind === 'task') r.taskId = null;
      if (kind === 'unrelated') r.job.error!.code = 'RENDER_FAILED';
      if (kind === 'queued') {
        r.job.status = 'queued';
        r.job.error = null;
      }
      if (kind === 'mock') r.job.mode = 'mock';
    });
    await expect(f.recover()).rejects.toThrow();
    expect(f.poll).not.toHaveBeenCalled();
  },
);
it.each(['product', 'asset', 'category'] as const)(
  'rejects invalid %s association',
  async (kind) => {
    const f = await setup();
    await f.change((r) => {
      if (kind === 'product') r.job.productId = 'absent';
      if (kind === 'asset') r.job.assetId = randomUUID();
      if (kind === 'category') r.job.category = 'rings';
    });
    await expect(f.recover()).rejects.toThrow();
    expect(f.poll).not.toHaveBeenCalled();
  },
);
it('requires owner authentication and refuses every caller override', async () => {
  const f = await setup();
  for (const headers of [{}, { authorization: `Bearer ${'b'.repeat(64)}` }]) {
    const r = await f.app.inject({ method: 'POST', url: f.endpoint, headers, payload: {} });
    expect([401, 404]).toContain(r.statusCode);
  }
  const other = f.endpoint.replace(f.id, randomUUID());
  expect(
    (await f.app.inject({ method: 'POST', url: other, headers: f.headers, payload: {} }))
      .statusCode,
  ).toBe(404);
  for (const payload of [
    { taskId: 'other' },
    { productId: 'N01' },
    { assetId: randomUUID() },
    { url: 'https://evil.test' },
    [],
    null,
  ]) {
    const r = await f.app.inject({
      method: 'POST',
      url: f.endpoint,
      headers: { ...f.headers, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
    expect(r.statusCode).toBe(400);
  }
  expect(f.poll).not.toHaveBeenCalled();
  expect(
    (await f.app.inject({ method: 'POST', url: f.endpoint, headers: f.headers, payload: {} }))
      .statusCode,
  ).toBe(200);
});
it.each(['poll', 'validation', 'mock', 'expired'] as const)(
  'leaves job unchanged on %s failure',
  async (kind) => {
    const f = await setup();
    const before = await f.repository.visual(f.owner, f.id, (s) => s);
    if (kind === 'poll') f.poll.mockRejectedValue(new VisualError('PROVIDER_TIMEOUT', 'Injected'));
    if (kind === 'validation')
      f.validateOutput.mockRejectedValue(new VisualError('PROVIDER_UNAVAILABLE', 'Injected'));
    if (kind === 'mock') f.poll.mockResolvedValue({ status: 'completed', mock: true });
    if (kind === 'expired')
      f.validateOutput.mockResolvedValue({ ...f.verified, expiresAt: f.clock() - 1 });
    await expect(f.recover()).rejects.toThrow();
    expect(await f.repository.visual(f.owner, f.id, (s) => s)).toEqual(before);
    expect(f.start).toHaveBeenCalledTimes(1);
  },
);
it.each(['task', 'product', 'asset', 'created', 'productAsset'] as const)(
  'rechecks %s binding after external I/O',
  async (kind) => {
    const f = await setup();
    f.poll.mockImplementationOnce(async () => {
      await f.change((r) => {
        if (kind === 'task') r.taskId = 'changed';
        if (kind === 'product') r.job.productId = 'E02';
        if (kind === 'asset') r.job.assetId = randomUUID();
        if (kind === 'created') r.job.createdAt -= 1;
        if (kind === 'productAsset') r.productAssetUrl = 'https://assets.test/changed';
      });
      return { status: 'completed', outputUrl: 'https://assets.test/output' };
    });
    await expect(f.recover()).rejects.toThrow();
    expect((await f.repository.visual(f.owner, f.id, (s) => s)).jobs[0]!.job.status).toBe('failed');
  },
);
it('v7 refresh loads the completed original job through authenticated list without advance or create', async () => {
  const f = await setup();
  const api = createVisualAPI(
    'http://local',
    async () => 'a'.repeat(64),
    async (url, init) => {
      const r = await f.app.inject({
        method: init?.method as 'GET' | 'POST',
        url: new URL(url).pathname,
        headers: init?.headers,
      });
      return { ok: r.statusCode < 400, status: r.statusCode, json: async () => r.json() };
    },
  );
  const advance = vi.spyOn(api, 'advance'),
    create = vi.spyOn(api, 'create');
  const c = createTryOnSession(
    api,
    {
      read: async () =>
        JSON.stringify({
          version: 1,
          sessionId: f.id,
          productId: 'E01',
          assetId: f.request.assetId,
          requestId: f.request.requestId,
        }),
      write: async () => {},
    },
    f.id,
    'E01',
    randomUUID,
  );
  await c.boot();
  expect(c.getSnapshot().job?.status).toBe('failed');
  await f.recover();
  await c.refresh();
  expect(c.getSnapshot().job).toMatchObject({
    id: f.request.requestId,
    status: 'completed',
    result: { kind: 'image' },
  });
  expect(advance).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  c.dispose();
});
it('retains a late submission acknowledgment after a concurrent local timeout without resubmitting', async () => {
  const f = await setup();
  // Local fixture only: prepare another queued request to exercise the acknowledgment race.
  await f.change((r) => {
    r.job.status = 'queued';
    r.job.error = null;
    r.taskId = null;
    r.job.createdAt = f.clock();
  });
  f.start.mockImplementationOnce(async () => {
    await f.change((r) => {
      r.job.status = 'failed';
      r.job.error = { code: 'PROVIDER_TIMEOUT', message: 'Local wait ended', recoverable: true };
    });
    return 'late-original-task';
  });
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect((await f.repository.visual(f.owner, f.id, (s) => s)).jobs[0]).toMatchObject({
    taskId: 'late-original-task',
    job: { status: 'failed' },
  });
  await f.recover();
  expect(f.poll).toHaveBeenCalledWith('earrings', 'late-original-task');
  expect(f.start).toHaveBeenCalledTimes(2); // One fixture setup plus one intentionally simulated submission.
});
it('normal live advancement retains the two-second poll spacing', async () => {
  const f = await setup();
  await f.change((r) => {
    r.job.status = 'processing';
    r.job.error = null;
    r.lastPollAt = f.clock();
  });
  await f.service.advance(f.owner, f.id, f.request.requestId);
  expect(f.poll).not.toHaveBeenCalled();
});
it('reconciles through the real adapter using only authenticated status GET and signed image GET, with no ledger calls', async () => {
  const { LiveYouCamProvider } = await import('../apps/api/src/youcam/live.js');
  const { taskReconciler } = await import('../apps/api/src/youcam/reconcile.js');
  const sharp = (await import('sharp')).default;
  const f = await setup();
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#eee' } })
    .png()
    .toBuffer();
  const date = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const url = `https://assets.test/output?X-Amz-Date=${date}&X-Amz-Expires=7200&X-Amz-Signature=${'a'.repeat(64)}&X-Amz-Credential=fixture&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=host`;
  const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');
    if (String(input).startsWith('https://yce-api-01.makeupar.com/s2s/v2.0/task/')) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer fixture-only' });
      return Response.json({ status: 200, data: { task_status: 'success', results: { url } } });
    }
    expect(String(input)).toBe(url);
    expect(init?.headers).toBeUndefined();
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/png' } });
  });
  const ledger = { initialize: vi.fn(), reserve: vi.fn(), commit: vi.fn() };
  const provider = new LiveYouCamProvider({
    apiKey: 'fixture-only',
    uploadHosts: [],
    outputHosts: ['assets.test'],
    fetch: transport,
    ledger,
  });
  const start = vi.spyOn(provider, 'start');
  const job = await taskReconciler(f.repository, provider, f.clock)(
    f.owner,
    f.id,
    f.request.requestId,
  );
  expect(job.status).toBe('completed');
  expect(transport).toHaveBeenCalledTimes(2);
  expect(start).not.toHaveBeenCalled();
  expect(ledger.reserve).not.toHaveBeenCalled();
  expect(ledger.commit).not.toHaveBeenCalled();
  expect(ledger.initialize).not.toHaveBeenCalled();
});
