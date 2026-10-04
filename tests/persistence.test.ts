import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { buildApp } from '../apps/api/src/app.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects.js';
import { hashToken } from '../apps/api/src/persistence/auth.js';
import { persistenceConfig } from '../apps/api/src/persistence/config.js';
import { createGuestCredential } from '../apps/mobile/src/credential.ts';
import { createAgentService } from '@youcam/agent';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { MockAgentPlanner } from '@youcam/testing';
import type { SessionView } from '@youcam/shared';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  vi.useRealTimers();
});
const tokenA = 'a'.repeat(64),
  tokenB = 'b'.repeat(64);
function fixture() {
  const repository = createMemoryRepository(),
    objects = createMemoryObjectStore();
  const outbox: { email: string; token: string }[] = [];
  const emailSender = {
    async send(email: string, token: string) {
      outbox.push({ email, token });
    },
  };
  const app = buildApp({ shopping: { repository, objects, emailSender } });
  apps.push(app);
  const send = (method: 'GET' | 'POST', url: string, payload?: unknown, token = tokenA) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload === undefined
        ? {}
        : {
            payload: JSON.stringify(payload),
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          }),
    });
  const create = async (token = tokenA) =>
    (await send('POST', '/v1/sessions', {}, token)).json() as SessionView;
  const turn = (v: SessionView, message: string, requestId: string = randomUUID()) =>
    send('POST', `/v1/sessions/${v.state.id}/messages`, {
      type: 'message',
      message,
      requestId,
      expectedVersion: v.version,
    });
  return { app, repository, objects, outbox, send, create, turn };
}
async function png() {
  return (
    await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abcdef' } })
      .png()
      .toBuffer()
  ).toString('base64');
}
describe('M5 ownership, persistence contracts and private images', () => {
  it('requires a valid guest credential for private routes; health/catalog stay public', async () => {
    const f = fixture();
    for (const headers of [{}, { authorization: 'Bearer short' }])
      expect(
        (await f.app.inject({ method: 'POST', url: '/v1/sessions', payload: {}, headers }))
          .statusCode,
      ).toBe(401);
    expect((await f.app.inject('/health')).statusCode).toBe(200);
    expect((await f.app.inject('/v1/products/E18')).statusCode).toBe(200);
    expect((await f.app.inject('/v1/sessions')).statusCode).toBe(401);
  });
  it('hides another guest session on read, turns, replay, list and image operations', async () => {
    const f = fixture();
    const v = await f.create();
    const input = { type: 'message', message: 'earrings', requestId: 'same', expectedVersion: 0 };
    expect((await f.send('POST', `/v1/sessions/${v.state.id}/messages`, input)).statusCode).toBe(
      200,
    );
    for (const [method, suffix, payload] of [
      ['GET', '', undefined],
      ['POST', '/messages', input],
      ['POST', '/assets', {}],
      ['GET', `/assets/${randomUUID()}/content`, undefined],
    ] as const)
      expect(
        (await f.send(method, `/v1/sessions/${v.state.id}${suffix}`, payload, tokenB)).statusCode,
      ).toBe(404);
    expect((await f.send('GET', '/v1/sessions', undefined, tokenB)).json()).toEqual({
      sessionIds: [],
    });
  });
  it('persists/replays through a replacement API instance without changing the agent tools', async () => {
    const f = fixture();
    const v = await f.create();
    const response = await f.turn(v, 'Silver earrings under $120', 'durable');
    const restarted = buildApp({ shopping: { repository: f.repository, objects: f.objects } });
    apps.push(restarted);
    const restored = await restarted.inject({
      url: `/v1/sessions/${v.state.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(restored.json()).toEqual(response.json().session);
    const replay = await restarted.inject({
      method: 'POST',
      url: `/v1/sessions/${v.state.id}/messages`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        type: 'message',
        message: 'Silver earrings under $120',
        requestId: 'durable',
        expectedVersion: 0,
      },
    });
    expect(replay.json()).toEqual(response.json());
  });
  it('serializes competing turns with stale-version protection and exact duplicate replay', async () => {
    const f = fixture();
    const v = await f.create();
    const result = await Promise.all([f.turn(v, 'earrings', 'a'), f.turn(v, 'rings', 'b')]);
    expect(result.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = result.find((r) => r.statusCode === 200)!.json().session as SessionView;
    const [one, two] = await Promise.all([
      f.turn(current, 'search', 'duplicate'),
      f.turn(current, 'search', 'duplicate'),
    ]);
    expect(one.json()).toEqual(two.json());
  });
  it('stores validated private bytes with idempotency and no fabricated VTO fields', async () => {
    const f = fixture();
    const v = await f.create();
    const requestId: string = randomUUID();
    const payload = { requestId, type: 'portrait', mimeType: 'image/png', data: await png() };
    const url = `/v1/sessions/${v.state.id}/assets`;
    const first = await f.send('POST', url, payload);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ id: requestId, sessionId: v.state.id, type: 'portrait' });
    expect(first.json()).not.toHaveProperty('outputUrl');
    expect((await f.send('POST', url, payload)).json()).toEqual(first.json());
    const content = await f.send('GET', `${url}/${requestId}/content`);
    expect(content.rawPayload).toEqual(Buffer.from(payload.data, 'base64'));
    expect(content.headers['cache-control']).toBe('private, no-store');
    expect((await f.send('POST', url, { ...payload, type: 'hand' })).statusCode).toBe(409);
    expect((await f.send('GET', `${url}/${requestId}`, undefined, tokenB)).statusCode).toBe(404);
    expect((await f.send('GET', `${url}/${requestId}/content`, undefined, tokenB)).statusCode).toBe(
      404,
    );
  });
  it('rejects invalid/oversized/mislabeled images and extra fields before object upload', async () => {
    const f = fixture();
    const v = await f.create();
    const upload = vi.spyOn(f.objects, 'put');
    const valid = {
      requestId: randomUUID(),
      type: 'hand',
      mimeType: 'image/png',
      data: await png(),
    };
    for (const body of [
      { ...valid, data: 'AAAA' },
      { ...valid, mimeType: 'image/jpeg' },
      { ...valid, outputUrl: 'fake' },
      { ...valid, data: Buffer.alloc(4_194_305).toString('base64') },
      {
        ...valid,
        mimeType: 'image/jpeg',
        data: Buffer.from([255, 216, 255, 217]).toString('base64'),
      },
    ])
      expect((await f.send('POST', `/v1/sessions/${v.state.id}/assets`, body)).statusCode).toBe(
        400,
      );
    expect(upload).not.toHaveBeenCalled();
  });
  it('fails honestly on upload/read failures, hiding infrastructure details and credentials', async () => {
    const f = fixture();
    const v = await f.create();
    vi.spyOn(f.objects, 'put').mockRejectedValue(new Error('SECRET database password and host'));
    const result = await f.send('POST', `/v1/sessions/${v.state.id}/assets`, {
      requestId: randomUUID(),
      type: 'hand',
      mimeType: 'image/png',
      data: await png(),
    });
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('SECRET');
  });
  it('checks stored byte integrity and never returns a mismatched image', async () => {
    const f = fixture();
    const v = await f.create();
    const id = randomUUID();
    await f.send('POST', `/v1/sessions/${v.state.id}/assets`, {
      requestId: id,
      type: 'wrist',
      mimeType: 'image/png',
      data: await png(),
    });
    vi.spyOn(f.objects, 'get').mockResolvedValue(Uint8Array.from([1, 2, 3]));
    expect(
      (await f.send('GET', `/v1/sessions/${v.state.id}/assets/${id}/content`)).statusCode,
    ).toBe(503);
  });
});
describe('M5 optional email proof, separate from shopping state', () => {
  it('requires delivered proof, single-use owner-bound codes, and preserves guest decisions', async () => {
    const f = fixture();
    const v = await f.create();
    await f.turn(v, 'earrings');
    const request = await f.send('POST', '/v1/auth/email/request', {
      email: ' Shopper@Example.com ',
    });
    expect(request.statusCode).toBe(202);
    expect(request.body).not.toContain(f.outbox[0]!.token);
    const code = f.outbox[0]!.token;
    expect(
      (await f.send('POST', '/v1/auth/email/verify', { token: code }, tokenB)).statusCode,
    ).toBe(400);
    expect((await f.send('POST', '/v1/auth/email/verify', { token: code })).json()).toEqual({
      email: 'shopper@example.com',
    });
    expect((await f.send('POST', '/v1/auth/email/verify', { token: code })).statusCode).toBe(400);
    expect((await f.send('GET', `/v1/sessions/${v.state.id}`)).json().state.activeCategory).toBe(
      'earrings',
    );
    // Another installation gains access only after independently proving the same mailbox.
    await f.send('POST', '/v1/auth/email/request', { email: 'shopper@example.com' }, tokenB);
    expect((await f.send('GET', `/v1/sessions/${v.state.id}`, undefined, tokenB)).statusCode).toBe(
      404,
    );
    await f.send('POST', '/v1/auth/email/verify', { token: f.outbox[1]!.token }, tokenB);
    expect((await f.send('GET', '/v1/sessions', undefined, tokenB)).json().sessionIds).toContain(
      v.state.id,
    );
    expect((await f.send('GET', `/v1/sessions/${v.state.id}`, undefined, tokenB)).statusCode).toBe(
      200,
    );
  });
  it('rejects expired proof and rate limits repeated issuance', async () => {
    const f = fixture();
    await f.send('POST', '/v1/auth/email/request', { email: 'a@example.com' });
    expect(
      (await f.send('POST', '/v1/auth/email/request', { email: 'a@example.com' })).statusCode,
    ).toBe(429);
    await expect(
      f.repository.verify(hashToken(tokenA), hashToken(f.outbox[0]!.token), Date.now() + 600_001),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });
  it('does not silently simulate configured email delivery', async () => {
    const a = buildApp();
    apps.push(a);
    const r = await a.inject({
      method: 'POST',
      url: '/v1/auth/email/request',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { email: 'a@example.com' },
    });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe('AUTH_UNAVAILABLE');
  });
});
describe('M5 secure guest credential and configuration', () => {
  it('persists one cryptographic credential before use and reuses it across reload', async () => {
    let stored: string | null = null;
    const storage = {
      read: async () => stored,
      write: async (token: string) => {
        stored = token;
      },
    };
    const random = vi.fn(async () => Uint8Array.from({ length: 32 }, (_, i) => i));
    const get = createGuestCredential(storage, random);
    const [a, b] = await Promise.all([get(), get()]);
    expect(a).toBe(b);
    expect(a).toBe(stored);
    expect(random).toHaveBeenCalledTimes(1);
    expect(await createGuestCredential(storage, random)()).toBe(a);
    expect(random).toHaveBeenCalledTimes(1);
  });
  it('fails closed on corrupt/unreadable secure storage without replacing the identity', async () => {
    const random = vi.fn(async () => new Uint8Array(32));
    const storage = { read: async () => 'corrupt', write: vi.fn(async () => {}) };
    await expect(createGuestCredential(storage, random)()).rejects.toMatchObject({
      code: 'STORAGE',
    });
    expect(random).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });
  it('never sends an identity before its secure write succeeds and retries storage failures', async () => {
    const storage = {
      read: async () => null,
      write: vi.fn().mockRejectedValueOnce(new Error('locked')).mockResolvedValue(undefined),
    };
    const get = createGuestCredential(storage, async () => new Uint8Array(32));
    await expect(get()).rejects.toMatchObject({ code: 'STORAGE' });
    expect(await get()).toHaveLength(64);
    expect(storage.write).toHaveBeenCalledTimes(2);
  });
  it('keeps credential-free mocks by default and fails closed on incomplete durable config', () => {
    expect(persistenceConfig({}).mode).toBe('memory');
    for (const env of [
      { PERSISTENCE_MODE: 'cloud' },
      { PERSISTENCE_MODE: 'postgres' },
      { OBJECT_STORAGE_MODE: 's3' },
      { EMAIL_AUTH_ENABLED: 'yes' },
      { EMAIL_AUTH_ENABLED: 'true' },
    ])
      expect(() => persistenceConfig(env)).toThrow();
    const configured = {
      PERSISTENCE_MODE: 'postgres',
      OBJECT_STORAGE_MODE: 's3',
      DATABASE_URL: 'postgres://user:secret@localhost/test',
      S3_ENDPOINT: 'http://localhost:19000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'private',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'true',
    };
    expect(persistenceConfig(configured).s3?.forcePathStyle).toBe(true);
    expect(() => persistenceConfig({ ...configured, S3_FORCE_PATH_STYLE: 'arbitrary' })).toThrow();
  });
  it('restores only validated portable agent snapshots; no replacement-state HTTP input', async () => {
    const service = createAgentService(createFixtureCatalog(), new MockAgentPlanner());
    const initial = service.create();
    await service.turn(initial.state.id, {
      type: 'message',
      message: 'earrings',
      requestId: 'request',
      expectedVersion: 0,
    });
    const snapshot = service.snapshot(initial.state.id);
    const target = createAgentService(createFixtureCatalog(), new MockAgentPlanner());
    target.restore(snapshot);
    snapshot.view.state.goal = 'tampered';
    expect(target.get(initial.state.id).state.goal).toBe('');
    const invalid = service.snapshot(initial.state.id);
    invalid.replies[0]!.id = 'different';
    expect(() => target.restore(invalid)).toThrow('Invalid stored replay');
  });
});
