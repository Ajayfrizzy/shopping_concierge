/** Local-only native calibration fixture; never import production composition/config. */
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { createMemoryRepository } from '../../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../../apps/api/src/persistence/objects.js';
import { hashToken } from '../../apps/api/src/persistence/auth.js';
import { visualService } from '../../apps/api/src/youcam/service.js';
import { MockAgentPlanner } from '../../packages/testing/src/index.js';
import { fixtureProducts } from '../../fixtures/catalog.js';

export async function calibrationApp() {
  const eligible = new Set([
    'E01',
    'E03',
    'E12',
    'N01',
    'N03',
    'N12',
    'R01',
    'R03',
    'R08',
    'W03',
    'W08',
    'W11',
  ]);
  const repository = createMemoryRepository(
    fixtureProducts.map((p) => ({
      ...p,
      vtoEligible: eligible.has(p.id),
      vtoAssetUrl: eligible.has(p.id) ? 'https://fixture.invalid/product.png' : null,
    })),
  );
  const objects = createMemoryObjectStore();
  let starts = 0,
    polls = 0,
    messages = 0,
    actions = 0;
  // Existing image-result discriminator ONLY; this provider never has an HTTP client.
  const provider = {
    mode: 'live' as const,
    async start() {
      starts++;
      return randomUUID();
    },
    // Only the generated, visibly labeled local fixture; no network/provider validation.
    async validateOutput(url: string) {
      if (url !== 'http://127.0.0.1:4000/calibration/image.png') throw Error('Unknown fixture');
      return {
        expiresAt: Date.now() + 3600000,
        sha256: createHash('sha256').update(png).digest('hex'),
        mimeType: 'image/png' as const,
        byteLength: png.length,
      };
    },
    async poll() {
      polls++;
      return {
        status: 'completed' as const,
        outputUrl: 'http://127.0.0.1:4000/calibration/image.png',
      };
    },
  };
  const png = await sharp(
    Buffer.from(
      '<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="900" fill="#e9eee5"/><text x="300" y="120" text-anchor="middle" font-size="36">OFFLINE MOCK FIXTURE</text><text x="300" y="180" text-anchor="middle" font-size="28">NOT A YOUCAM RENDER</text><circle cx="300" cy="420" r="120" fill="#244d3a"/><text x="300" y="650" text-anchor="middle" font-size="28">No person or product photo</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  const app = buildApp({
    shopping: { repository, objects, planner: new MockAgentPlanner(), visualProvider: provider },
  });
  const prepared = new Map<string, Promise<void>>();
  let latest: { owner: string; id: string } | undefined;
  app.addHook('onRequest', async (req) => {
    // Seed a completed owned E01 fixture only when this local test session opens its job list.
    const match = /^\/v1\/sessions\/([^/]+)\/vto$/.exec(req.url);
    if (req.method !== 'GET' || !match) return;
    const id = match[1]!;
    const authorization = req.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ')) return;
    const owner = hashToken(authorization.slice(7));
    await repository.read(owner, id); // Standard ownership gate, before any seeding.
    const key = `${owner}:${id}`;
    if (!prepared.has(key))
      prepared.set(
        key,
        (async () => {
          const r = await app.inject({
            method: 'POST',
            url: `/v1/sessions/${id}/assets`,
            headers: { authorization },
            payload: {
              requestId: randomUUID(),
              type: 'portrait',
              mimeType: 'image/png',
              data: png.toString('base64'),
            },
          });
          if (r.statusCode !== 201 && r.statusCode !== 200) throw Error('Fixture upload failed');
          let now = Date.now();
          const service = visualService(repository, objects, provider, () => now);
          const requestId = randomUUID();
          await service.create(owner, id, { requestId, productId: 'E01', assetId: r.json().id });
          await service.advance(owner, id, requestId);
          now += 3100;
          const job = await service.advance(owner, id, requestId);
          if (job.status !== 'completed') throw Error('Fixture did not complete');
        })(),
      );
    await prepared.get(key);
  });
  app.addHook('preHandler', async (req) => {
    const match = /^\/v1\/sessions\/([^/]+)\/messages$/.exec(req.url);
    if (req.method !== 'POST' || !match) return;
    const body = req.body as { type?: string };
    if (body.type === 'message') messages++;
    else actions++;
    latest = { owner: hashToken((req.headers.authorization ?? '').slice(7)), id: match[1]! };
  });
  app.get('/calibration/image.png', async (_, reply) => reply.type('image/png').send(png));
  app.get('/calibration/status', async () => ({
    calibration: 'isolated-native-mock-v1',
    actualProviderRequests: 0,
    starts,
    polls,
    messages,
    actions,
    ...(latest ? { state: (await repository.read(latest.owner, latest.id)).view.state } : {}),
  }));
  return app;
}
