import { createHash, randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { buildApp } from '../apps/api/src/app';
import { createMemoryRepository } from '../apps/api/src/persistence/memory';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects';
import { MockVisualProvider } from '../apps/api/src/youcam/mock';
import { fixtureProducts } from '../fixtures/catalog';
import { createVisualAPI } from '../apps/mobile/src/visual-client';
import { createUploadRecovery } from '../apps/mobile/src/upload-recovery';
import type { VisualAsset } from '@youcam/shared';
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
});
const hash = async (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
async function setup() {
  const repository = createMemoryRepository(fixtureProducts);
  const objects = createMemoryObjectStore();
  const puts = vi.spyOn(objects, 'put');
  const provider = new MockVisualProvider();
  const app = buildApp({ shopping: { repository, objects, visualProvider: provider } });
  cleanups.push(() => app.close());
  const token = 'a'.repeat(64);
  const id = (
    await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
  ).json().state.id;
  let loseResponse = false;
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    const r = await app.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST',
      url: new URL(String(url)).pathname,
      headers: init?.headers as Record<string, string>,
      ...(init?.body ? { payload: JSON.parse(String(init.body)) } : {}),
    });
    if (loseResponse && init?.method === 'POST') throw Error('Response lost after persistence');
    return new Response(new Uint8Array(r.rawPayload), { status: r.statusCode });
  });
  const api = createVisualAPI('https://test', async () => token, transport);
  let raw: string | null = null;
  const storage = {
    read: async () => raw,
    write: vi.fn(async (value: string) => {
      raw = value;
    }),
  };
  const recovery = (session = id, product = 'E01', client = api) =>
    createUploadRecovery(client, storage, session, product, hash);
  const data = (
    await sharp({ create: { width: 30, height: 40, channels: 3, background: '#ccc' } })
      .png()
      .toBuffer()
  ).toString('base64');
  const input = { requestId: randomUUID(), type: 'portrait', mimeType: 'image/png', data };
  const associate = vi.fn<(asset: VisualAsset) => Promise<void>>(async () => {});
  const c = recovery();
  await c.boot();
  return {
    app,
    api,
    id,
    token,
    transport,
    objects,
    puts,
    provider,
    storage,
    recovery,
    c,
    input,
    associate,
    lose: () => {
      loseResponse = true;
    },
    raw: () => raw,
  };
}
it('persists before POST and recovers a lost response across navigation and cold restart using only authenticated GETs', async () => {
  const s = await setup();
  s.lose();
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  expect(s.puts).toHaveBeenCalledTimes(1);
  expect(s.associate).not.toHaveBeenCalled();
  expect(s.raw()).toContain(s.input.requestId);
  expect(s.raw()).not.toContain(s.input.data);
  expect(s.raw()).not.toContain(s.token);
  expect(s.raw()).not.toContain('https:');
  const cold = s.recovery();
  await cold.boot();
  expect(cold.getPending()?.id).toBe(s.input.requestId);
  await cold.inspect(s.input.requestId, 'portrait');
  expect(s.associate).not.toHaveBeenCalled();
  await cold.confirm(s.associate);
  expect(s.associate).toHaveBeenCalledTimes(1);
  expect(cold.getPending()).toBeNull();
  expect(s.transport.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  expect(s.puts).toHaveBeenCalledTimes(1);
  expect(s.provider.starts).toBe(0);
  const again = s.recovery();
  await again.boot();
  expect(again.getPending()).toBeNull();
});
it('keeps ordinary upload success and association unchanged', async () => {
  const s = await setup();
  await s.c.upload(s.input, s.associate);
  expect(s.associate).toHaveBeenCalledTimes(1);
  expect(s.c.getPending()).toBeNull();
  expect(s.puts).toHaveBeenCalledTimes(1);
  expect(s.provider.starts).toBe(0);
});
it('recovers a legacy known ID only after inspection and explicit confirmation', async () => {
  const s = await setup();
  await s.api.upload(s.id, s.input);
  await expect(s.c.confirm(s.associate)).rejects.toThrow();
  await s.c.inspect(s.input.requestId, 'portrait');
  expect(s.associate).not.toHaveBeenCalled();
  await s.c.confirm(s.associate);
  expect(s.associate).toHaveBeenCalledTimes(1);
  expect(s.puts).toHaveBeenCalledTimes(1);
  expect(s.provider.starts).toBe(0);
});
it('denies foreign owners and sessions through the actual authenticated routes', async () => {
  const s = await setup();
  await s.api.upload(s.id, s.input);
  const foreign = createVisualAPI('https://test', async () => 'b'.repeat(64), s.transport);
  const c = s.recovery(s.id, 'E01', foreign);
  await c.boot();
  await expect(c.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  const other = s.recovery(randomUUID());
  await other.boot();
  await expect(other.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  expect(s.associate).not.toHaveBeenCalled();
  expect(s.provider.starts).toBe(0);
});
it('refuses journals from another session/product and corrupt journals', async () => {
  const s = await setup();
  s.lose();
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  await expect(s.recovery(randomUUID()).boot()).rejects.toThrow();
  await expect(s.recovery(s.id, 'N01').boot()).rejects.toThrow();
  await s.storage.write('{bad');
  await expect(s.recovery().boot()).rejects.toThrow();
});
it('rejects missing assets and unavailable/expired resources without retrying', async () => {
  const s = await setup();
  await expect(s.c.inspect(randomUUID(), 'portrait')).rejects.toThrow();
  const unavailable = createVisualAPI(
    'https://test',
    async () => s.token,
    async () => new Response('{}', { status: 410 }),
  );
  const c = s.recovery(s.id, 'E01', unavailable);
  await c.boot();
  await expect(c.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  expect(s.puts).not.toHaveBeenCalled();
  expect(s.provider.starts).toBe(0);
});
it('rejects wrong required type, wrong identity and mismatched fingerprint', async () => {
  const s = await setup();
  s.lose();
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  await expect(s.c.inspect(s.input.requestId, 'hand')).rejects.toThrow();
  const original = await s.api.asset(s.id, s.input.requestId);
  const spy = vi.spyOn(s.api, 'asset').mockResolvedValue({ ...original, sha256: '0'.repeat(64) });
  await expect(s.c.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  spy.mockResolvedValue({ ...original, id: randomUUID() });
  await expect(s.c.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  expect(s.associate).not.toHaveBeenCalled();
});
it('does not infer a photo when multiple uploads exist or substitute for pending intent', async () => {
  const s = await setup();
  await s.api.upload(s.id, { ...s.input, requestId: randomUUID() });
  s.lose();
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  await expect(s.c.inspect(randomUUID(), 'portrait')).rejects.toThrow();
  await expect(s.c.inspect(s.input.requestId + ',' + randomUUID(), 'portrait')).rejects.toThrow();
  expect(s.associate).not.toHaveBeenCalled();
  expect(s.provider.starts).toBe(0);
});
it('detects corrupted bytes before association', async () => {
  const s = await setup();
  await s.api.upload(s.id, s.input);
  vi.spyOn(s.api, 'assetBytes').mockResolvedValue(new Uint8Array([255, 216, 255]));
  await expect(s.c.inspect(s.input.requestId, 'portrait')).rejects.toThrow('integrity');
  await expect(s.c.confirm(s.associate)).rejects.toThrow();
});
it('bounds duplicate upload/check/confirm taps and never repeats a POST after failure', async () => {
  const s = await setup();
  s.lose();
  const uploads = await Promise.allSettled([
    s.c.upload(s.input, s.associate),
    s.c.upload(s.input, s.associate),
  ]);
  expect(uploads.every((x) => x.status === 'rejected')).toBe(true);
  expect(s.puts).toHaveBeenCalledTimes(1);
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow('unresolved');
  const checks = await Promise.allSettled([
    s.c.inspect(s.input.requestId, 'portrait'),
    s.c.inspect(s.input.requestId, 'portrait'),
  ]);
  expect(checks.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  await Promise.allSettled([s.c.confirm(s.associate), s.c.confirm(s.associate)]);
  expect(s.associate).toHaveBeenCalledTimes(1);
  expect(s.provider.starts).toBe(0);
});
it('keeps unknown state on read network failure and local association failure', async () => {
  const s = await setup();
  s.lose();
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  const spy = vi.spyOn(s.api, 'asset').mockRejectedValueOnce(Error('Network unavailable'));
  await expect(s.c.inspect(s.input.requestId, 'portrait')).rejects.toThrow();
  spy.mockRestore();
  expect(s.c.getPending()).not.toBeNull();
  await s.c.inspect(s.input.requestId, 'portrait');
  await expect(
    s.c.confirm(async () => {
      throw Error('Journal write failed');
    }),
  ).rejects.toThrow();
  expect(s.c.getPending()).not.toBeNull();
  expect(s.puts).toHaveBeenCalledTimes(1);
});
it('failed durable-intent write prevents upload entirely', async () => {
  const s = await setup();
  s.storage.write.mockRejectedValueOnce(Error('Disk full'));
  await expect(s.c.upload(s.input, s.associate)).rejects.toThrow();
  expect(s.transport).not.toHaveBeenCalled();
  expect(s.puts).not.toHaveBeenCalled();
});
