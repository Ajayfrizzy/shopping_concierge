import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createTryOnSession } from '../apps/mobile/src/try-on-session';
import { createVisualAPI } from '../apps/mobile/src/visual-client';
import { buildApp } from '../apps/api/src/app';
import { createMemoryRepository } from '../apps/api/src/persistence/memory';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects';
import { MockVisualProvider } from '../apps/api/src/youcam/mock';
import { fixtureProducts } from '../fixtures/catalog';
import type { VtoJob } from '@youcam/shared';
const cleanups: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.useRealTimers();
});
async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  // Fastify inject completes via real I/O callbacks, separate from the fake polling clock.
  for (let n = 0; n < 20; n++) await new Promise<void>((resolve) => setImmediate(resolve));
}
async function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const provider = new MockVisualProvider();
  const app = buildApp({
    shopping: {
      repository: createMemoryRepository(
        fixtureProducts.map((p) => ({ ...p, vtoEligible: p.id === 'E01' })),
      ),
      objects: createMemoryObjectStore(),
      visualProvider: provider,
    },
  });
  cleanups.push(() => app.close());
  const token = 'a'.repeat(64),
    headers = { authorization: `Bearer ${token}` };
  const id = (
    await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
  ).json().state.id;
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    const r = await app.inject({
      method: init?.method as 'POST' | 'GET',
      url: new URL(String(url)).pathname,
      headers: init?.headers as Record<string, string>,
      ...(init?.body ? { payload: JSON.parse(String(init.body)) } : {}),
    });
    return new Response(r.body, { status: r.statusCode });
  });
  const api = createVisualAPI('http://test', async () => token, transport);
  const data = (
    await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ddd' } })
      .png()
      .toBuffer()
  ).toString('base64');
  const asset = await api.upload(id, {
    requestId: randomUUID(),
    type: 'portrait',
    mimeType: 'image/png',
    data,
  });
  let stored: string | null = null;
  const storage = {
    read: async () => stored,
    write: async (s: string) => {
      stored = s;
    },
  };
  const controller = () => {
    const c = createTryOnSession(api, storage, id, 'E01', randomUUID, {
      intervalMs: 3000,
      maxPolls: 3,
    });
    cleanups.push(c.dispose);
    return c;
  };
  return { app, api, id, asset, provider, controller, storage, transport, headers };
}
async function ready() {
  const s = await setup();
  const c = s.controller();
  await c.boot();
  await c.photo(s.asset.id);
  return { ...s, c };
}
it('one explicit tap creates, renders, polls and presents a result; repeated taps spend once', async () => {
  const s = await ready();
  await Promise.all([s.c.start(), s.c.start(), s.c.start()]);
  expect(s.provider.starts).toBe(1);
  expect(s.c.getSnapshot().job?.status).toBe('processing');
  await tick(3000);
  expect(s.c.getSnapshot().job?.status).toBe('completed');
  expect(s.c.getSnapshot().waiting).toBe(false);
  await s.c.start();
  await s.c.refresh();
  expect(s.provider.starts).toBe(1);
  expect(await s.storage.read()).not.toMatch(/url|base64|Authorization/);
});
it.each(['navigation', 'background'])(
  'pauses polling during %s, resumes the existing job without resubmission',
  async () => {
    const s = await ready();
    await s.c.start();
    const calls = s.transport.mock.calls.length;
    s.c.visibility(false);
    await tick(12000);
    expect(s.transport).toHaveBeenCalledTimes(calls);
    s.c.visibility(true);
    await tick(3000);
    expect(s.c.getSnapshot().job?.status).toBe('completed');
    expect(s.provider.starts).toBe(1);
  },
);
it('restores processing and completed jobs after app restart without another creation', async () => {
  const s = await ready();
  await s.c.start();
  const jobId = s.c.getSnapshot().job!.id;
  s.c.dispose();
  const restored = s.controller();
  await restored.boot();
  expect(restored.getSnapshot().job?.id).toBe(jobId);
  await tick(3000);
  expect(restored.getSnapshot().job?.status).toBe('completed');
  restored.dispose();
  const again = s.controller();
  await again.boot();
  await tick(12000);
  expect(again.getSnapshot().job?.status).toBe('completed');
  expect(s.provider.starts).toBe(1);
});
it('restores an authorized queued job but does not auto-submit a legacy queued job', async () => {
  const s = await ready();
  const jobId = randomUUID();
  await s.api.create(s.id, { requestId: jobId, productId: 'E01', assetId: s.asset.id });
  s.c.dispose();
  const legacy = s.controller();
  await legacy.boot();
  await tick(6000);
  expect(s.provider.starts).toBe(0);
  await legacy.start();
  expect(s.provider.starts).toBe(1);
});
it('saves consent before creation and recovers a lost create response using the same request', async () => {
  const s = await ready();
  const create = s.api.create;
  let once = true;
  vi.spyOn(s.api, 'create').mockImplementation(async (...args) => {
    const result = await create(...args);
    if (once) {
      once = false;
      throw new Error('Response lost');
    }
    return result;
  });
  await s.c.start();
  expect(s.c.getSnapshot().error).toBe('Response lost');
  expect(s.provider.starts).toBe(0);
  const requestId = JSON.parse((await s.storage.read())!).requestId;
  s.c.dispose();
  const restored = s.controller();
  await restored.boot();
  await tick(3000);
  expect(restored.getSnapshot().job?.id).toBe(requestId);
  expect(s.provider.starts).toBe(1);
});
it('does not create on boot after an uncertain request with no server job; explicit resume retains ID', async () => {
  const s = await ready();
  const create = s.api.create;
  const spy = vi.spyOn(s.api, 'create').mockRejectedValueOnce(new Error('Offline'));
  await s.c.start();
  const pending = JSON.parse((await s.storage.read())!).requestId;
  s.c.dispose();
  const restored = s.controller();
  await restored.boot();
  await tick(9000);
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockImplementation(create);
  await restored.start();
  expect(restored.getSnapshot().job?.id).toBe(pending);
  expect(s.provider.starts).toBe(1);
});
it('lost advancement response pauses; refresh recovers the submitted job without another paid start', async () => {
  const s = await ready();
  const advance = s.api.advance;
  vi.spyOn(s.api, 'advance').mockImplementationOnce(async (...args) => {
    await advance(...args);
    throw new Error('Timeout: outcome unknown');
  });
  await s.c.start();
  expect(s.c.getSnapshot().waiting).toBe(false);
  expect(s.provider.starts).toBe(1);
  await s.c.refresh();
  await tick(3000);
  expect(s.c.getSnapshot().job?.status).toBe('completed');
  expect(s.provider.starts).toBe(1);
});
it('Stop waiting cancels local polls, never claims provider cancellation', async () => {
  const s = await ready();
  await s.c.start();
  s.c.pause();
  const calls = s.transport.mock.calls.length;
  await tick(30000);
  expect(s.transport).toHaveBeenCalledTimes(calls);
  expect(s.c.getSnapshot().notice).toContain('has not been cancelled');
  s.c.visibility(false);
  s.c.visibility(true);
  await tick(3000);
  expect(s.transport).toHaveBeenCalledTimes(calls);
  await s.c.refresh();
  await tick(3000);
  expect(s.c.getSnapshot().job?.status).toBe('completed');
});
it('polls are bounded, and a failed/expired result never starts a replacement render', async () => {
  const s = await ready();
  await s.c.start();
  const processing = s.c.getSnapshot().job!;
  vi.spyOn(s.api, 'advance').mockResolvedValue(processing);
  await tick(30000);
  expect(s.c.getSnapshot().waiting).toBe(false);
  expect(s.c.getSnapshot().notice).toContain('Still waiting');
  expect(s.provider.starts).toBe(1);
  for (const terminal of [
    {
      ...processing,
      status: 'failed',
      error: {
        code: 'PROVIDER_TIMEOUT',
        message: 'Unknown outcome. Check usage before trying again.',
        recoverable: true,
      },
    },
    {
      ...processing,
      mode: 'live',
      status: 'completed',
      result: { kind: 'image', url: 'https://example.test/expired', expiresAt: 1 },
    },
  ] as VtoJob[]) {
    vi.spyOn(s.api, 'list').mockResolvedValue([terminal]);
    await s.c.refresh();
    await s.c.start();
    await tick(12000);
    expect(s.provider.starts).toBe(1);
  }
});
it('a failed journal write blocks creation and paid execution', async () => {
  const s = await ready();
  vi.spyOn(s.storage, 'write').mockRejectedValue(new Error('Storage full'));
  await s.c.start();
  expect(s.c.getSnapshot().error).toBe('Storage full');
  expect(s.provider.starts).toBe(0);
  expect(await s.api.list(s.id)).toEqual([]);
});
it('corrupt or wrong-session recovery fails closed', async () => {
  const s = await setup();
  for (const raw of [
    'broken',
    JSON.stringify({
      version: 1,
      sessionId: 'wrong',
      productId: 'E01',
      assetId: null,
      requestId: null,
    }),
  ]) {
    await s.storage.write(raw);
    const c = s.controller();
    await c.boot();
    await c.start();
    expect(c.getSnapshot().ready).toBe(false);
    expect(s.provider.starts).toBe(0);
  }
});
it('unavailable products cannot create jobs or invoke a provider', async () => {
  const s = await setup();
  const response = await s.api.create(s.id, {
    requestId: randomUUID(),
    productId: 'E02',
    assetId: s.asset.id,
  });
  expect(response.type).toBe('unavailable');
  expect(s.provider.starts).toBe(0);
});
it('before image preserves Android array-source authentication and rejects another guest', async () => {
  const s = await setup();
  const sources = await s.api.originalSource(s.id, s.asset.id);
  expect(Array.isArray(sources)).toBe(true);
  expect(sources).toHaveLength(1);
  const source = sources[0]!;
  expect(source.headers.Authorization).toBe(s.headers.authorization);
  expect(source.cache).toBe('reload');
  const good = await s.app.inject({
    method: 'GET',
    url: new URL(source.uri).pathname,
    headers: source.headers,
  });
  expect(good.statusCode).toBe(200);
  expect(good.headers['cache-control']).toBe('private, no-store');
  const denied = await s.app.inject({
    method: 'GET',
    url: new URL(source.uri).pathname,
    headers: { authorization: `Bearer ${'b'.repeat(64)}` },
  });
  expect(denied.statusCode).toBe(404);
});
