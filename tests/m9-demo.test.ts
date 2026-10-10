import { fixtureProducts } from '../fixtures/catalog.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { getActiveConstraints } from '@youcam/decision-engine';
import { agentResponseSchema, sessionViewSchema } from '@youcam/shared';
import { buildApp } from '../apps/api/src/app.js';

const demo = JSON.parse(readFileSync('fixtures/m9-demo.json', 'utf8')) as Record<string, string>;

it('replays the published M9 demo through owned HTTP routes without paid providers', async () => {
  const app = buildApp({
    shopping: {
      repository: createMemoryRepository(
        fixtureProducts.map((p) => ({ ...p, vtoEligible: p.id === 'E18' })),
      ),
    },
  });
  const headers = { authorization: `Bearer ${'9'.repeat(64)}` };
  try {
    let view = sessionViewSchema.parse(
      (await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })).json(),
    );
    const send = async (key: string) => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${view.state.id}/messages`,
        headers,
        payload: {
          type: 'message',
          requestId: randomUUID(),
          expectedVersion: view.version,
          message: demo[key],
        },
      });
      expect(response.statusCode).toBe(200);
      const r = agentResponseSchema.parse(response.json());
      expect(r.mode).toBe('mock');
      expect(r.status).toBe('ok');
      view = r.session;
      return r;
    };
    const initial = await send('goal');
    expect(initial.ui.type).toBe('product_list');
    const rejected = await send('reject');
    expect(rejected.session.state.feedback).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({ productId: 'E05', reasonCode: 'too_flashy' }),
      }),
    );
    const cheaper = await send('cheaper');
    expect(getActiveConstraints(view.state).fields).toMatchObject({
      material: { preference: { value: 'silver' } },
      occasion: { preference: { value: 'wedding' } },
      budget: { preference: { value: { amount: 120, currency: 'USD' } } },
    });
    if (cheaper.ui.type !== 'product_list') throw new Error('Missing exact results');
    expect(
      cheaper.ui.payload.exactMatches.every(
        ({ product }) =>
          product.material === 'silver' && product.price <= 120 && product.id !== 'E05',
      ),
    ).toBe(true);
    expect((await send('tryOn')).ui).toMatchObject({
      type: 'request_image',
      payload: { productId: 'E18', requiredType: 'portrait' },
    });
    await send('select');
    const necklaces = await send('complement');
    expect(view.state.dependencies).toContainEqual({
      anchorProductId: 'E18',
      anchorCategory: 'earrings',
      targetCategory: 'necklaces',
      type: 'complement',
    });
    expect(getActiveConstraints(view.state).fields.budget?.preference.value).toEqual({
      amount: 100,
      currency: 'USD',
    });
    if (necklaces.ui.type !== 'product_list') throw new Error('Missing necklaces');
    expect(necklaces.session.state.feedback).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({ productId: 'E05', reasonCode: 'too_flashy' }),
      }),
    );
    const comparison = await send('compare');
    expect(comparison.ui.type).toBe('comparison');
    if (comparison.ui.type !== 'comparison') throw new Error('Missing comparison');
    expect(comparison.ui.payload.items.map((i) => i.product.id)).toEqual(['N01', 'N02']);
    expect(comparison.ui.payload.items.every((i) => i.eligible)).toBe(true);
    const restored = sessionViewSchema.parse(
      (await app.inject({ url: `/v1/sessions/${view.state.id}`, headers })).json(),
    );
    expect(restored).toEqual(view);
    await send('return');
    expect(view.state.decisions.earrings?.selected).toContain('E18');
    expect(getActiveConstraints(view.state).fields.budget?.preference.value).toEqual({
      amount: 120,
      currency: 'USD',
    });
    const empty = await send('noMatch');
    expect(empty.ui.type).toBe('empty_state');
    if (empty.ui.type !== 'empty_state') throw new Error('Missing no-match');
    expect(empty.ui.payload.exactMatches).toEqual([]);
    expect(view.pendingRelaxations.length).toBeGreaterThan(0);
    const before = structuredClone(view.state);
    const yes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${view.state.id}/messages`,
      headers,
      payload: {
        type: 'message',
        requestId: randomUUID(),
        expectedVersion: view.version,
        message: 'yes',
      },
    });
    expect(agentResponseSchema.parse(yes.json()).session.state).toEqual(before);
  } finally {
    await app.close();
  }
});
