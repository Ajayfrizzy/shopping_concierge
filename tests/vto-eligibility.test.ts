import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../apps/api/src/app.js';
import { fixtureProducts } from '../fixtures/catalog.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { createMemoryObjectStore } from '../apps/api/src/persistence/objects.js';
import { MockVisualProvider } from '../apps/api/src/youcam/mock.js';
it('ineligible products stay usable but neither typed requests nor direct VTO ask for photos', async () => {
  const visual = new MockVisualProvider();
  const app = buildApp({ shopping: { visualProvider: visual } });
  const headers = { authorization: `Bearer ${'a'.repeat(64)}` };
  try {
    const session = (
      await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
    ).json();
    const direct = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.state.id}/vto`,
      headers,
      payload: { requestId: randomUUID(), productId: 'E01' },
    });
    expect(direct.statusCode).toBe(200);
    expect(direct.json().type).toBe('unavailable');
    const typed = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.state.id}/messages`,
      headers,
      payload: {
        type: 'message',
        requestId: randomUUID(),
        expectedVersion: session.version,
        message: 'Try on E01',
      },
    });
    expect(typed.statusCode).toBe(200);
    expect(typed.json().ui.type).toBe('product_detail');
    expect(typed.json().message).toContain('not available');
    expect(visual.starts).toBe(0);
  } finally {
    await app.close();
  }
});
it('eligible product handoff works without exposing the private asset key', async () => {
  const repository = createMemoryRepository(
    fixtureProducts.map((p) => ({ ...p, vtoEligible: p.id === 'E03' })),
  );
  repository.vtoAssetKey = vi.fn(async () => 'private/product-key');
  const objects = createMemoryObjectStore();
  const app = buildApp({ shopping: { repository, objects } });
  const headers = { authorization: `Bearer ${'a'.repeat(64)}` };
  try {
    const session = (
      await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
    ).json();
    const result = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.state.id}/vto`,
      headers,
      payload: { requestId: randomUUID(), productId: 'E03' },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().type).toBe('request_image');
    expect(result.body).not.toContain('private/product-key');
  } finally {
    await app.close();
  }
});

it('signs approved private assets only at submission and keeps signed URLs out of the client response', async () => {
  const sharp = (await import('sharp')).default;
  const repository = createMemoryRepository(
    fixtureProducts.map((p) => ({ ...p, vtoEligible: p.id === 'E03' })),
  );
  repository.vtoAssetKey = async () => 'private/approved.png';
  const objects = createMemoryObjectStore();
  objects.signGet = vi.fn(async () => 'https://approved.test/product?signature=private');
  const start = vi.fn(async () => 'task');
  const app = buildApp({
    shopping: {
      repository,
      objects,
      visualProvider: { mode: 'live', start, poll: async () => ({ status: 'processing' }) },
    },
  });
  const headers = { authorization: `Bearer ${'a'.repeat(64)}` };
  try {
    const session = (
      await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
    ).json();
    const base = `/v1/sessions/${session.state.id}`;
    const bytes = await sharp({
      create: { width: 512, height: 512, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const asset = (
      await app.inject({
        method: 'POST',
        url: base + '/assets',
        headers,
        payload: {
          requestId: randomUUID(),
          type: 'portrait',
          mimeType: 'image/png',
          data: bytes.toString('base64'),
        },
      })
    ).json();
    const id = randomUUID();
    const queued = await app.inject({
      method: 'POST',
      url: base + '/vto',
      headers,
      payload: { requestId: id, productId: 'E03', assetId: asset.id },
    });
    expect(queued.statusCode).toBe(202);
    expect(objects.signGet).not.toHaveBeenCalled();
    const result = await app.inject({
      method: 'POST',
      url: base + '/vto/' + id + '/advance',
      headers,
      payload: {},
    });
    expect(result.statusCode).toBe(200);
    expect(objects.signGet).toHaveBeenCalledWith('private/approved.png');
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        productAssetUrl: 'https://approved.test/product?signature=private',
      }),
    );
    expect(result.body).not.toContain('signature');
    expect(result.body).not.toContain('private/approved');
  } finally {
    await app.close();
  }
});
