import { fixtureProducts } from '../fixtures/catalog.js';
import { createVisualAPI, pickedImageMime } from '../apps/mobile/src/visual-client.js';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { buildApp } from '../apps/api/src/app.js';
import { MockVisualProvider } from '../apps/api/src/youcam/mock.js';
import { LiveYouCamProvider, safeProviderUrl } from '../apps/api/src/youcam/live.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects.js';
import { visualService } from '../apps/api/src/youcam/service.js';
import { hashToken } from '../apps/api/src/persistence/auth.js';
import { operationPath, requiredImage, VisualError } from '../apps/api/src/youcam/provider.js';
import { youcamProvider } from '../apps/api/src/youcam/config.js';
import { vtoJobSchema, type Category, type VisualAsset } from '@youcam/shared';
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  vi.useRealTimers();
});
async function setup(provider = new MockVisualProvider()) {
  const repository = createMemoryRepository(
      fixtureProducts.map((p) => ({ ...p, vtoEligible: true })),
    ),
    objects = createMemoryObjectStore();
  const app = buildApp({ shopping: { repository, objects, visualProvider: provider } });
  apps.push(app);
  const headers = { authorization: `Bearer ${'d'.repeat(64)}` },
    owner = hashToken('d'.repeat(64));
  const session = (
    await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
  ).json();
  const id = session.state.id as string;
  const data = (
    await sharp({ create: { width: 512, height: 512, channels: 3, background: '#eee' } })
      .png()
      .toBuffer()
  ).toString('base64');
  const upload = async (type: VisualAsset['type']) =>
    (
      await app.inject({
        method: 'POST',
        url: `/v1/sessions/${id}/assets`,
        headers,
        payload: { requestId: randomUUID(), type, mimeType: 'image/png', data },
      })
    ).json() as VisualAsset;
  let clock = 100000;
  const service = visualService(repository, objects, provider, () => clock);
  return {
    app,
    id,
    owner,
    headers,
    session,
    repository,
    objects,
    provider,
    service,
    upload,
    tick: () => {
      clock += 3000;
    },
  };
}
describe('M6 owned mock lifecycle', () => {
  it.each([
    ['earrings', 'E01'],
    ['necklaces', 'N01'],
    ['rings', 'R01'],
    ['watches', 'W01'],
  ] as const)(
    '%s: missing image, queued, processing, completed; no fabricated image or decision change',
    async (category, productId) => {
      const s = await setup();
      expect(
        await s.service.create(s.owner, s.id, { requestId: randomUUID(), productId }),
      ).toMatchObject({ type: 'request_image', requiredType: requiredImage[category] });
      expect(s.provider.starts).toBe(0);
      const asset = await s.upload(requiredImage[category]);
      const input = { requestId: randomUUID(), productId, assetId: asset.id };
      const created = await s.service.create(s.owner, s.id, input);
      expect(created.type).toBe('job');
      expect((await s.service.read(s.owner, s.id, input.requestId)).status).toBe('queued');
      expect((await s.service.advance(s.owner, s.id, input.requestId)).status).toBe('processing');
      s.tick();
      const completed = await s.service.advance(s.owner, s.id, input.requestId);
      expect(completed).toMatchObject({
        status: 'completed',
        mode: 'mock',
        result: { kind: 'mock' },
      });
      expect(JSON.stringify(completed)).not.toContain('outputUrl');
      expect(await s.service.create(s.owner, s.id, input)).toEqual({ type: 'job', job: completed });
      expect(s.provider.starts).toBe(1);
      expect((await s.repository.read(s.owner, s.id)).view).toEqual(s.session);
    },
  );
  it('A09: portrait cannot satisfy ring image; nonexistent products and arbitrary provider parameters rejected', async () => {
    const s = await setup(),
      portrait = await s.upload('portrait');
    expect(
      await s.service.create(s.owner, s.id, {
        requestId: randomUUID(),
        productId: 'R01',
        assetId: portrait.id,
      }),
    ).toMatchObject({ type: 'request_image', requiredType: 'hand' });
    await expect(
      s.service.create(s.owner, s.id, { requestId: randomUUID(), productId: 'invented' }),
    ).rejects.toThrow('No catalog product');
    const response = await s.app.inject({
      method: 'POST',
      url: `/v1/sessions/${s.id}/vto`,
      headers: s.headers,
      payload: { requestId: randomUUID(), productId: 'E01', outputUrl: 'https://fake.test' },
    });
    expect(response.statusCode).toBe(400);
    expect(s.provider.starts).toBe(0);
  });
  it('A11: rendering failure is technical and recoverable with no visual/decision result', async () => {
    const s = await setup(new MockVisualProvider({ failure: true }));
    const asset = await s.upload('hand'),
      requestId = randomUUID();
    await s.service.create(s.owner, s.id, { requestId, productId: 'R01', assetId: asset.id });
    await s.service.advance(s.owner, s.id, requestId);
    s.tick();
    const result = await s.service.advance(s.owner, s.id, requestId);
    expect(result).toMatchObject({
      status: 'failed',
      result: null,
      error: { code: 'RENDER_FAILED', recoverable: true },
    });
    expect(result.error?.message).toContain('not a judgment');
    expect((await s.repository.read(s.owner, s.id)).view).toEqual(s.session);
  });
  it('authorizes every route, rate-limits active jobs, rejects conflicting IDs and submits once concurrently', async () => {
    const s = await setup();
    const asset = await s.upload('portrait'),
      requestId = randomUUID(),
      body = { requestId, productId: 'E01', assetId: asset.id };
    await s.service.create(s.owner, s.id, body);
    await expect(s.service.create(s.owner, s.id, { ...body, productId: 'E02' })).rejects.toThrow(
      'another try-on',
    );
    await expect(
      s.service.create(s.owner, s.id, { ...body, requestId: randomUUID() }),
    ).rejects.toThrow('Finish the current');
    await Promise.all([
      s.service.advance(s.owner, s.id, requestId),
      s.service.advance(s.owner, s.id, requestId),
    ]);
    expect(s.provider.starts).toBe(1);
    for (const suffix of [
      '/vto',
      `/vto/${requestId}`,
      `/vto/${requestId}/advance`,
      '/visual-profile',
      '/visual-profile/analyze',
    ]) {
      const response = await s.app.inject({
        method:
          suffix.endsWith('advance') || suffix.endsWith('analyze') || suffix === '/vto'
            ? 'POST'
            : 'GET',
        url: `/v1/sessions/${s.id}${suffix}`,
        headers: { authorization: `Bearer ${'e'.repeat(64)}` },
        payload:
          suffix === '/vto'
            ? body
            : suffix.endsWith('analyze')
              ? { assetId: asset.id, kind: 'face' }
              : undefined,
      });
      expect(response.statusCode).toBe(404);
    }
  });
  it('caches mock analysis by image hash/version without overriding explicit state; unavailable color is honest', async () => {
    const s = await setup();
    const asset = await s.upload('portrait');
    const a = await s.service.analyze(s.owner, s.id, { assetId: asset.id, kind: 'face' });
    const b = await s.service.analyze(s.owner, s.id, { assetId: asset.id, kind: 'face' });
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(b.profile).toEqual(a.profile);
    expect(s.provider.analyses).toBe(1);
    expect(a.profile).toMatchObject({ mode: 'mock', faceShape: null });
    await expect(
      s.service.analyze(s.owner, s.id, { assetId: asset.id, kind: 'color' }),
    ).rejects.toThrow('not enabled');
    expect((await s.repository.read(s.owner, s.id)).view).toEqual(s.session);
  });
  it('retries transient polling against the existing task and never resubmits rendering', async () => {
    const provider = new MockVisualProvider();
    const original = provider.poll.bind(provider);
    let fail = true;
    provider.poll = async () => {
      if (fail) throw new VisualError('PROVIDER_TIMEOUT', 'Try status again.');
      return original();
    };
    const s = await setup(provider),
      asset = await s.upload('portrait'),
      id = randomUUID();
    await s.service.create(s.owner, s.id, { requestId: id, productId: 'E01', assetId: asset.id });
    await s.service.advance(s.owner, s.id, id);
    s.tick();
    await expect(s.service.advance(s.owner, s.id, id)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
    });
    expect((await s.service.read(s.owner, s.id, id)).status).toBe('processing');
    fail = false;
    s.tick();
    expect((await s.service.advance(s.owner, s.id, id)).status).toBe('completed');
    expect(provider.starts).toBe(1);
  });
  it('typed try-on validates catalog ID, hands off only required image type and preserves domain state', async () => {
    const s = await setup();
    const response = await s.app.inject({
      method: 'POST',
      url: `/v1/sessions/${s.id}/messages`,
      headers: s.headers,
      payload: {
        type: 'message',
        requestId: 'typed-vto',
        expectedVersion: 0,
        message: 'Try on R01',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().ui).toEqual({
      type: 'request_image',
      payload: { productId: 'R01', requiredType: 'hand' },
    });
    expect(response.json().session.state).toEqual(s.session.state);
    expect(s.provider.starts).toBe(0);
    const invalid = await s.app.inject({
      method: 'POST',
      url: `/v1/sessions/${s.id}/messages`,
      headers: s.headers,
      payload: {
        type: 'message',
        requestId: 'unknown-vto',
        expectedVersion: 1,
        message: 'Try on INVENTED',
      },
    });
    expect(invalid.statusCode).toBe(404);
    expect((await s.repository.read(s.owner, s.id)).view.version).toBe(1);
  });
  it('contracts reject invented success, incomplete success and mismatched provenance', async () => {
    const s = await setup(),
      asset = await s.upload('portrait'),
      id = randomUUID();
    await s.service.create(s.owner, s.id, { requestId: id, productId: 'E01', assetId: asset.id });
    const job = await s.service.read(s.owner, s.id, id);
    expect(vtoJobSchema.safeParse({ ...job, status: 'completed' }).success).toBe(false);
    expect(
      vtoJobSchema.safeParse({
        ...job,
        status: 'completed',
        result: { kind: 'image', url: 'https://fake.test', expiresAt: 1 },
      }).success,
    ).toBe(false);
  });
});
describe('M6 live adapter contracts (injected HTTP; zero external calls)', () => {
  const asset: VisualAsset = {
    id: randomUUID(),
    sessionId: randomUUID(),
    type: 'portrait',
    mimeType: 'image/png',
    byteLength: 1,
    sha256: 'a'.repeat(64),
  };
  it.each(Object.keys(operationPath) as Category[])(
    '%s uses documented upload/submit/poll and never sends credentials to upload host',
    async (category) => {
      const responses = [
        {
          status: 200,
          data: {
            files: [
              {
                file_id: 'source-id',
                requests: [
                  {
                    method: 'PUT',
                    url: 'https://uploads.test/signed',
                    headers: { 'Content-Type': 'image/png' },
                  },
                ],
              },
            ],
          },
        },
        null,
        { status: 200, data: { task_id: 'task/id' } },
        { status: 200, data: { task_status: 'running' } },
        {
          status: 200,
          data: { task_status: 'success', results: { url: 'https://assets.test/result' } },
        },
      ];
      const transport = vi.fn(
        async () => new Response(JSON.stringify(responses.shift()), { status: 200 }),
      );
      const provider = new LiveYouCamProvider({
        apiKey: 'test-secret',
        uploadHosts: ['uploads.test'],
        outputHosts: ['assets.test'],
        fetch: transport,
      });
      const task = await provider.start({
        category,
        asset: { ...asset, type: requiredImage[category] },
        bytes: new Uint8Array([1]),
        productAssetUrl: 'https://assets.test/product',
      });
      expect(task).toBe('task/id');
      expect(await provider.poll(category, task)).toEqual({ status: 'processing' });
      expect(await provider.poll(category, task)).toEqual({
        status: 'completed',
        outputUrl: 'https://assets.test/result',
      });
      const calls = transport.mock.calls as unknown as [string, RequestInit][];
      expect(calls[0]![0]).toContain('/file/' + operationPath[category]);
      expect(calls[2]![0]).toContain('/task/' + operationPath[category]);
      expect(JSON.stringify(calls[1]![1])).not.toContain('test-secret');
      expect(calls[4]![0]).toContain('task%2Fid');
      expect(JSON.parse(calls[2]![1].body as string)).toEqual({
        src_file_id: 'source-id',
        ref_file_urls: ['https://assets.test/product'],
        source_info: { name: 'source-id' },
        object_infos: [{ name: 'https://assets.test/product' }],
      });
    },
  );
  it.each(['duplicate', 'unavailable', 'success', 'uncertain', 'commit-failure'] as const)(
    'awaits persistent accounting and handles %s without extra submissions',
    async (outcome) => {
      const ledger = {
        initialize: vi.fn(async () => {}),
        reserve: vi.fn(async () => {
          if (outcome === 'unavailable') throw new Error('ledger unavailable');
          return outcome !== 'duplicate';
        }),
        commit: vi.fn(async () => {
          if (outcome === 'commit-failure') throw new Error('commit failed');
        }),
      };
      const transport = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/task/')) {
          expect(ledger.reserve).toHaveBeenCalledTimes(1);
          if (outcome === 'uncertain') throw new Error('connection lost');
          return Response.json({ status: 200, data: { task_id: 'task' } });
        }
        return Response.json({
          status: 200,
          data: {
            files: [
              {
                file_id: 'file',
                requests: [{ method: 'PUT', url: 'https://uploads.test/x', headers: {} }],
              },
            ],
          },
        });
      });
      const provider = new LiveYouCamProvider({
        apiKey: 'test',
        uploadHosts: ['uploads.test'],
        outputHosts: ['assets.test'],
        fetch: transport,
        ledger,
      });
      const id = '11111111-1111-4111-8111-111111111111';
      const pending = provider.start({
        reservationId: id,
        category: 'earrings',
        asset,
        bytes: new Uint8Array([1]),
        productAssetUrl: 'https://assets.test/product',
      });
      if (outcome === 'success') await expect(pending).resolves.toBe('task');
      else await expect(pending).rejects.toThrow();
      expect(ledger.reserve).toHaveBeenCalledWith(id, 'earrings');
      expect(transport.mock.calls.filter(([url]) => String(url).includes('/task/'))).toHaveLength(
        ['duplicate', 'unavailable'].includes(outcome) ? 0 : 1,
      );
      expect(ledger.commit).toHaveBeenCalledTimes(
        ['success', 'commit-failure'].includes(outcome) ? 1 : 0,
      );
    },
  );
  it('blocks task submission when the durable reservation fails', async () => {
    const transport = vi.fn(async () =>
      Response.json({
        status: 200,
        data: {
          files: [
            {
              file_id: 'file',
              requests: [{ method: 'PUT', url: 'https://uploads.test/x', headers: {} }],
            },
          ],
        },
      }),
    );
    const provider = new LiveYouCamProvider({
      apiKey: 'secret',
      uploadHosts: ['uploads.test'],
      outputHosts: ['assets.test'],
      fetch: transport,
      reserveRender: () => {
        throw new Error('budget exhausted');
      },
    });
    await expect(
      provider.start({
        category: 'earrings',
        asset,
        bytes: new Uint8Array([1]),
        productAssetUrl: 'https://assets.test/product',
      }),
    ).rejects.toThrow('budget exhausted');
    expect(transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(transport.mock.calls)).not.toContain('/task/');
  });
  it('rejects unverified API origins before credentials can be sent', () => {
    expect(
      () =>
        new LiveYouCamProvider({
          apiKey: 'secret',
          apiOrigin: 'https://untrusted.test',
          uploadHosts: [],
          outputHosts: [],
        }),
    ).toThrow('verified official');
    expect(() =>
      youcamProvider({
        USE_MOCK_YOUCAM: 'false',
        YOUCAM_API_KEY: 'secret',
        YOUCAM_UPLOAD_HOSTS: 'uploads.test',
        YOUCAM_ASSET_HOSTS: 'assets.test',
      }),
    ).toThrow('usage ledger');
  });
  it.each([
    [401, 'PROVIDER_AUTH'],
    [429, 'PROVIDER_RATE_LIMIT'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ] as const)('normalizes HTTP %i without retrying paid POST', async (status, code) => {
    const transport = vi.fn(async () => new Response('private details', { status }));
    const provider = new LiveYouCamProvider({
      apiKey: 'secret',
      uploadHosts: [],
      outputHosts: ['assets.test'],
      fetch: transport,
    });
    await expect(
      provider.start({
        category: 'earrings',
        asset,
        bytes: new Uint8Array([1]),
        productAssetUrl: 'https://assets.test/product',
      }),
    ).rejects.toMatchObject({ code });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('fails closed for missing product assets, malformed completion and unsafe URLs', async () => {
    const transport = vi.fn(async () =>
      Response.json({ status: 200, data: { task_status: 'success' } }),
    );
    const provider = new LiveYouCamProvider({
      apiKey: 'secret',
      uploadHosts: [],
      outputHosts: [],
      fetch: transport,
    });
    await expect(
      provider.start({
        category: 'earrings',
        asset,
        bytes: new Uint8Array([1]),
        productAssetUrl: null,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_ASSET_MISSING' });
    expect(transport).not.toHaveBeenCalled();
    await expect(provider.poll('earrings', 'task')).rejects.toMatchObject({
      code: 'PROVIDER_INVALID_RESPONSE',
    });
    for (const url of [
      'http://assets.test/x',
      'https://user:secret@assets.test/x',
      'https://127.0.0.1/x',
      'https://assets.test:123/x',
    ])
      expect(() => safeProviderUrl(url, ['assets.test'])).toThrow();
  });
  it('mock default ignores present credentials; live switch requires complete server configuration', () => {
    expect(youcamProvider({ YOUCAM_API_KEY: 'unused' }).mode).toBe('mock');
    expect(() => youcamProvider({ USE_MOCK_YOUCAM: 'false' })).toThrow();
  });
});

describe('M6 mobile transport boundary', () => {
  it('uses guest credentials, validates image/job identity and restores jobs through the owned API', async () => {
    const s = await setup();
    const client = createVisualAPI(
      'http://local',
      async () => 'd'.repeat(64),
      async (url, init) => {
        const response = await s.app.inject({
          method: init?.method as 'GET' | 'POST',
          url: new URL(url).pathname,
          headers: init?.headers,
          ...(init?.body ? { payload: JSON.parse(init.body) } : {}),
        });
        return {
          ok: response.statusCode < 400,
          status: response.statusCode,
          json: async () => response.json(),
        };
      },
    );
    expect(await client.create(s.id, { requestId: randomUUID(), productId: 'W01' })).toMatchObject({
      type: 'request_image',
      requiredType: 'wrist',
    });
    const asset = await s.upload('wrist');
    const requestId = randomUUID();
    await client.create(s.id, { requestId, productId: 'W01', assetId: asset.id });
    expect((await client.list(s.id))[0]).toMatchObject({ id: requestId, status: 'queued' });
    expect((await client.advance(s.id, requestId)).status).toBe('processing');
  });
  it('rejects cross-session jobs and invalid output before rendering', async () => {
    const s = await setup();
    const asset = await s.upload('portrait');
    const requestId = randomUUID();
    const response = await s.service.create(s.owner, s.id, {
      requestId,
      productId: 'E01',
      assetId: asset.id,
    });
    if (response.type !== 'job') throw new Error('Expected job');
    const transport = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ jobs: [{ ...response.job, sessionId: randomUUID() }] }),
    }));
    await expect(
      createVisualAPI('http://local', async () => null, transport).list(s.id),
    ).rejects.toThrow('another request');
  });
  it('preserves normalized recoverable errors and rejects invented outgoing fields before network', async () => {
    const transport = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'Please retry later.', recoverable: true },
      }),
    }));
    const client = createVisualAPI('http://local', async () => null, transport);
    await expect(client.list(randomUUID())).rejects.toThrow('Please retry later.');
    transport.mockClear();
    await expect(
      client.create(randomUUID(), { requestId: randomUUID(), productId: 'E01', price: 1 }),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});

it('uses actual picker base64 format rather than stale original MIME metadata', async () => {
  const image = sharp({ create: { width: 16, height: 16, channels: 3, background: '#eee' } });
  const jpeg = (await image.jpeg().toBuffer()).toString('base64');
  const png = (await image.png().toBuffer()).toString('base64');
  expect(pickedImageMime(jpeg)).toBe('image/jpeg');
  expect(pickedImageMime(png)).toBe('image/png');
  expect(() => pickedImageMime('not an image')).toThrow('PNG or JPEG');
});
