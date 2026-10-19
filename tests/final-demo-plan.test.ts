import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildApp } from '../apps/api/src/app.js';
import { createMemoryRepository } from '../apps/api/src/persistence/memory.js';
import { fixtureProducts } from '../fixtures/catalog.js';
import { agentResponseSchema, sessionViewSchema } from '@youcam/shared';
import { getActiveConstraints } from '@youcam/decision-engine';

it('validates the proposed final demo decisions without generating a visual result or paid call', async () => {
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
  const app = buildApp({
    shopping: {
      repository: createMemoryRepository(
        fixtureProducts.map((p) => ({ ...p, vtoEligible: eligible.has(p.id) })),
      ),
    },
  });
  const headers = { authorization: `Bearer ${'8'.repeat(64)}` };
  try {
    let view = sessionViewSchema.parse(
      (await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })).json(),
    );
    const send = async (body: object) => {
      const r = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${view.state.id}/messages`,
        headers,
        payload: { ...body, requestId: randomUUID(), expectedVersion: view.version },
      });
      expect(r.statusCode).toBe(200);
      const result = agentResponseSchema.parse(r.json());
      expect(result.mode).toBe('mock');
      expect(result.status).toBe('ok');
      view = result.session;
      return result;
    };
    // Future preparation searches once, then recording repeats that search in the SAME session.
    const preparedSessionId = view.state.id;
    await send({ type: 'message', message: 'Silver earrings under $120' });
    const initial = await send({ type: 'message', message: 'Silver earrings under $120' });
    expect(view.state.id).toBe(preparedSessionId);
    if (initial.ui.type !== 'product_list') throw new Error('Missing initial cards');
    expect(initial.ui.payload.exactMatches.map((x) => x.product.id)).toMatchInlineSnapshot(`
      [
        "E01",
        "E02",
        "E05",
        "E09",
        "E14",
        "E18",
      ]
    `);
    expect(initial.ui.payload.exactMatches.map((x) => x.product.id)).toEqual(
      expect.arrayContaining(['E01', 'E05']),
    );
    await send({
      type: 'action',
      action: {
        type: 'feedback',
        feedback: { action: 'reject', productId: 'E05', reasonCode: 'too_flashy' },
      },
    });
    await send({
      type: 'action',
      action: { type: 'feedback', feedback: { action: 'select', productId: 'E01' } },
    });
    const filter = (value: boolean) =>
      send({
        type: 'action',
        action: {
          type: 'update_constraints',
          updates: [{ field: 'vtoOnly', value, scope: 'global', source: 'explicit' }],
        },
      });
    const discovery = await filter(true);
    if (discovery.ui.type !== 'product_list') throw new Error('Missing eligible cards');
    expect(discovery.ui.payload.exactMatches.map((x) => x.product.id)).toContain('E01');
    expect(
      discovery.ui.payload.exactMatches.every(
        (x) =>
          eligible.has(x.product.id) &&
          x.product.price <= 120 &&
          x.product.material === 'silver' &&
          x.product.id !== 'E05',
      ),
    ).toBe(true);
    // The planned real-result shot is a separate acceptance gate, never a fake fixture render.
    await filter(false);
    const necklaces = await send({
      type: 'message',
      message: 'Now find a necklace that works with this under $100',
    });
    if (necklaces.ui.type !== 'product_list') throw new Error('Missing necklace cards');
    expect(necklaces.ui.payload.exactMatches.map((x) => x.product.id)).toMatchInlineSnapshot(`
      [
        "N01",
        "N02",
        "N09",
      ]
    `);
    expect(necklaces.ui.payload.exactMatches.map((x) => x.product.id)).toEqual(
      expect.arrayContaining(['N01', 'N02']),
    );
    expect(view.state.dependencies).toContainEqual({
      anchorProductId: 'E01',
      anchorCategory: 'earrings',
      targetCategory: 'necklaces',
      type: 'complement',
    });
    expect(getActiveConstraints(view.state).fields.budget?.preference.value).toEqual({
      amount: 100,
      currency: 'USD',
    });
    expect(view.state.feedback).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({ productId: 'E05', reasonCode: 'too_flashy' }),
      }),
    );
    const comparison = await send({ type: 'message', message: 'Compare N01 and N02' });
    if (comparison.ui.type !== 'comparison') throw new Error('Missing comparison');
    expect(comparison.ui.payload.items.map((x) => x.product.id)).toEqual(['N01', 'N02']);
    expect(comparison.ui.payload.items.every((x) => x.eligible)).toBe(true);
    const jobs = await app.inject({ url: `/v1/sessions/${view.state.id}/vto`, headers });
    expect(jobs.statusCode).toBe(200);
    expect(jobs.json().jobs).toEqual([]);
  } finally {
    await app.close();
  }
});
