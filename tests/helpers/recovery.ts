import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import sharp from 'sharp';
import { fixtureProducts } from '../../fixtures/catalog.js';
import { buildApp } from '../../apps/api/src/app.js';
import { createMemoryRepository } from '../../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../../apps/api/src/persistence/objects.js';
import { hashToken } from '../../apps/api/src/persistence/auth.js';
import type { ShoppingRepository } from '../../apps/api/src/persistence/repository.js';
import { visualService } from '../../apps/api/src/youcam/service.js';
import type { ProviderPoll, YouCamProvider } from '../../apps/api/src/youcam/provider.js';
import type { VisualState } from '../../apps/api/src/youcam/state.js';
export async function recoveryFixture(
  repository: ShoppingRepository = createMemoryRepository(
    fixtureProducts.map((p) => ({
      ...p,
      vtoEligible: true,
      vtoAssetUrl: 'https://assets.test/product',
    })),
  ),
) {
  const start = vi.fn(async () => 'original-fixture-task');
  const poll = vi.fn(
    async (): Promise<ProviderPoll> => ({
      status: 'completed',
      outputUrl: 'https://assets.test/output',
    }),
  );
  let clock = Date.now();
  const verified = {
    expiresAt: clock + 3600000,
    sha256: 'a'.repeat(64),
    mimeType: 'image/png' as const,
    byteLength: 100,
  };
  const validateOutput = vi.fn(async () => verified);
  const provider: YouCamProvider = { mode: 'live', start, poll, validateOutput };
  const objects = createMemoryObjectStore();
  const app = buildApp({ shopping: { repository, objects, visualProvider: provider } });
  const token = 'a'.repeat(64),
    owner = hashToken(token),
    headers = { authorization: `Bearer ${token}` };
  const session = (
    await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
  ).json();
  const id = session.state.id as string;
  const data = (
    await sharp({ create: { width: 32, height: 32, channels: 3, background: '#eee' } })
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
  const service = visualService(repository, objects, provider, () => clock);
  const request = { requestId: randomUUID(), productId: 'E01', assetId: asset.id };
  await service.create(owner, id, request);
  await service.advance(owner, id, request.requestId);
  const change = async (fn: (r: VisualState['jobs'][number]) => void) =>
    repository.visual(owner, id, (s) => {
      fn(s.jobs[0]!);
      return s;
    });
  clock += 660000;
  await change((r) => {
    r.job.status = 'failed';
    r.job.error = {
      code: 'PROVIDER_TIMEOUT',
      message: 'Historical local timeout',
      recoverable: true,
    };
    r.job.updatedAt = clock;
  });
  return {
    app,
    repository,
    objects,
    service,
    provider,
    start,
    poll,
    validateOutput,
    verified,
    session,
    id,
    owner,
    headers,
    request,
    change,
    clock: () => clock,
    recover: () => service.reconcile(owner, id, request.requestId),
    endpoint: `/v1/sessions/${id}/vto/${request.requestId}/reconcile`,
  };
}
