import { readFile } from 'node:fs/promises';
import { visualService } from '../apps/api/src/youcam/service.js';
import { MockVisualProvider } from '../apps/api/src/youcam/mock.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import sharp from 'sharp';
import { buildApp } from '../apps/api/src/app.js';
import {
  createPostgresRepository,
  migrate,
  postgresPool,
  seedFixtures,
} from '../apps/api/src/persistence/postgres.js';
import { createS3ObjectStore } from '../apps/api/src/persistence/objects.js';
import { hashToken } from '../apps/api/src/persistence/auth.js';
import { createAgentService } from '@youcam/agent';
import { createCatalog } from '@youcam/catalog';
import { MockAgentPlanner } from '@youcam/testing';
import type { AgentResponse, SessionView } from '@youcam/shared';

// Explicit opt-in, fixed loopback development services: never target a deployment database.
describe.runIf(process.env.M5_INTEGRATION === '1')(
  'M5 real PostgreSQL and local S3 protocol integration',
  () => {
    const connectionString =
      'postgresql://concierge_test:local_test_only@127.0.0.1:15432/concierge_test';
    const schema = `m5_test_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 5 });
    const repo = createPostgresRepository(pool);
    const objectConfig = {
      endpoint: 'http://127.0.0.1:19000',
      region: 'us-east-1',
      bucket: 'concierge-test',
      accessKeyId: 'concierge_test',
      secretAccessKey: 'local_test_only',
      forcePathStyle: true,
    };
    const objects = createS3ObjectStore(objectConfig);
    const apps: ReturnType<typeof buildApp>[] = [];
    const headers = { authorization: `Bearer ${'c'.repeat(64)}` };
    const owner = hashToken('c'.repeat(64));
    const app = () => {
      const a = buildApp({ shopping: { repository: repo, objects } });
      apps.push(a);
      return a;
    };
    const create = async (a: ReturnType<typeof buildApp>) =>
      (
        await a.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
      ).json() as SessionView;
    const turn = async (
      a: ReturnType<typeof buildApp>,
      view: SessionView,
      message: string,
      id: string = randomUUID(),
    ) =>
      a.inject({
        method: 'POST',
        url: `/v1/sessions/${view.state.id}/messages`,
        headers,
        payload: { type: 'message', requestId: id, expectedVersion: view.version, message },
      });
    beforeAll(async () => {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(pool);
      await seedFixtures(pool);
    }, 30_000);
    afterAll(async () => {
      await Promise.all(apps.map((a) => a.close()));
      objects.close();
      await repo.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    it('restores M8 dependencies and factual comparisons across API instances', async () => {
      const a = app();
      let view = await create(a);
      for (const message of [
        'Silver earrings under $120',
        'Select E18',
        'Reject E05 because too flashy',
        'Find necklaces that works with E18 under $100',
      ]) {
        const response = await turn(a, view, message);
        expect(response.statusCode).toBe(200);
        view = response.json().session;
      }
      expect(view.state.dependencies).toHaveLength(1);
      const b = app();
      expect(
        (await b.inject({ method: 'GET', url: `/v1/sessions/${view.state.id}`, headers })).json(),
      ).toEqual(view);
      const c = await b.inject({
        method: 'POST',
        url: `/v1/sessions/${view.state.id}/compare`,
        headers,
        payload: { productIds: ['N01', 'N18'] },
      });
      expect(c.statusCode).toBe(200);
      expect(c.json().criteria).toContainEqual(
        expect.objectContaining({ field: 'budget', value: { amount: 100, currency: 'USD' } }),
      );
      const response = await turn(b, view, 'Compare N01 and N18', 'm8-replay');
      expect(response.statusCode).toBe(200);
      expect((await turn(app(), view, 'Compare N01 and N18', 'm8-replay')).json()).toEqual(
        response.json(),
      );
    });
    it('persists M6 jobs, replay and analysis across API instances without changing decisions', async () => {
      const a = app(),
        view = await create(a),
        id = view.state.id;
      const bytes = await sharp({
        create: { width: 512, height: 512, channels: 3, background: '#ddd' },
      })
        .png()
        .toBuffer();
      const upload = await a.inject({
        method: 'POST',
        url: `/v1/sessions/${id}/assets`,
        headers,
        payload: {
          requestId: randomUUID(),
          type: 'portrait',
          mimeType: 'image/png',
          data: bytes.toString('base64'),
        },
      });
      expect(upload.statusCode).toBe(201);
      const asset = upload.json();
      const requestId = randomUUID();
      let now = 100000;
      const provider = new MockVisualProvider();
      const service = visualService(repo, objects, provider, () => now);
      await service.create(owner, id, { requestId, productId: 'E01', assetId: asset.id });
      await Promise.all([
        service.advance(owner, id, requestId),
        service.advance(owner, id, requestId),
      ]);
      expect(provider.starts).toBe(1);
      const independent = new Pool({ connectionString, options: `-c search_path=${schema}` });
      try {
        const freshProvider = new MockVisualProvider(),
          fresh = visualService(
            createPostgresRepository(independent),
            objects,
            freshProvider,
            () => now,
          );
        expect((await fresh.read(owner, id, requestId)).status).toBe('processing');
        now += 3000;
        expect((await fresh.advance(owner, id, requestId)).status).toBe('completed');
        expect(freshProvider.starts).toBe(0);
        await service.analyze(owner, id, { assetId: asset.id, kind: 'face' });
        expect((await fresh.analyze(owner, id, { assetId: asset.id, kind: 'face' })).cached).toBe(
          true,
        );
        expect(freshProvider.analyses).toBe(0);
        await expect(fresh.read(hashToken('f'.repeat(64)), id, requestId)).rejects.toThrow(
          'not found',
        );
        expect((await repo.read(owner, id)).view).toEqual(view);
      } finally {
        await independent.end();
      }
    });
    it('repairs legacy catalog image URLs without changing facts or approved sources', async () => {
      const before = await repo.products();
      await pool.query(
        "UPDATE products SET product=jsonb_set(product,'{imageUrl}',to_jsonb('https://fixtures.invalid/catalog/' || id || '.png'))",
      );
      await pool.query(
        "UPDATE products SET product=jsonb_set(product,'{imageUrl}','\"https://approved.example/E01.png\"'::jsonb) WHERE id='E01'",
      );
      const sql = await readFile('apps/api/migrations/003_catalog_images.sql', 'utf8');
      await pool.query(sql);
      await pool.query(sql);
      const after = await repo.products();
      for (const p of after) {
        const original = before.find((v) => v.id === p.id)!;
        expect(p).toEqual({
          ...original,
          imageUrl: p.id === 'E01' ? 'https://approved.example/E01.png' : original.imageUrl,
        });
      }
      await pool.query(
        "UPDATE products SET product=jsonb_set(product,'{imageUrl}','\"catalog://demo/E01.png\"'::jsonb) WHERE id='E01'",
      );
    });
    it('migrates twice without losing data and seeds without replacing stored catalog facts', async () => {
      await migrate(pool);
      await seedFixtures(pool);
      expect(await repo.products()).toHaveLength(72);
      await pool.query(
        "UPDATE products SET product=jsonb_set(product,'{price}','99'::jsonb) WHERE id='E18'",
      );
      await seedFixtures(pool);
      expect((await repo.products()).find((p) => p.id === 'E18')!.price).toBe(99);
      await pool.query(
        "UPDATE products SET product=jsonb_set(product,'{price}','100'::jsonb) WHERE id='E18'",
      );
    });
    it('persists session, feedback, saves, events and replay across new connections and API instances', async () => {
      const a = app();
      let view = await create(a);
      view = (
        await turn(a, view, 'Silver earrings for a wedding under $120, elegant but not too loud.')
      ).json().session;
      view = (await turn(a, view, 'Save E18')).json().session;
      const before = view;
      const response = (
        await turn(a, view, 'Select E18', 'persisted-request')
      ).json() as AgentResponse;
      const independentPool = new Pool({ connectionString, options: `-c search_path=${schema}` });
      const freshRepo = createPostgresRepository(independentPool);
      try {
        const fresh = buildApp({ shopping: { repository: freshRepo, objects } });
        const read = await fresh.inject({ url: `/v1/sessions/${view.state.id}`, headers });
        expect(read.json()).toEqual(response.session);
        expect((await turn(fresh, before, 'Select E18', 'persisted-request')).json()).toEqual(
          response,
        );
        await fresh.close();
        expect(
          (await pool.query('SELECT * FROM product_feedback WHERE session_id=$1', [view.state.id]))
            .rows,
        ).toHaveLength(2);
        expect(
          (
            await pool.query('SELECT product_id FROM saved_products WHERE session_id=$1', [
              view.state.id,
            ])
          ).rows,
        ).toEqual([{ product_id: 'E18' }]);
        expect(
          (await pool.query('SELECT * FROM agent_events WHERE session_id=$1', [view.state.id])).rows
            .length,
        ).toBeGreaterThan(0);
      } finally {
        await freshRepo.close();
      }
    });
    it('persists current relaxation proposals and applies only explicitly confirmed updates after restoration', async () => {
      const a = app();
      const v = await create(a);
      const result = (await turn(a, v, 'Platinum earrings under $1')).json() as AgentResponse;
      const current = await repo.read(owner, v.state.id);
      expect(current.view.pendingRelaxations).toEqual(result.session.pendingRelaxations);
      const b = app();
      const confirm = await b.inject({
        method: 'POST',
        url: `/v1/sessions/${v.state.id}/messages`,
        headers,
        payload: {
          type: 'confirm_relaxation',
          requestId: 'confirmed',
          expectedVersion: current.view.version,
          proposalId: current.view.pendingRelaxations[0]!.proposalId,
        },
      });
      expect(confirm.statusCode).toBe(200);
      expect(confirm.json().ui.type).toBe('product_list');
    });
    it('serializes cross-instance updates and duplicate retries without lost updates or duplicate feedback', async () => {
      const a = app(),
        b = app();
      let v = await create(a);
      v = (await turn(a, v, 'earrings')).json().session;
      const results = await Promise.all([
        turn(a, v, 'Save E18', 'concurrent'),
        turn(b, v, 'Save E18', 'concurrent'),
      ]);
      expect(results[0]!.statusCode).toBe(200);
      expect(results[1]!.json()).toEqual(results[0]!.json());
      expect(
        (await pool.query('SELECT * FROM product_feedback WHERE session_id=$1', [v.state.id])).rows,
      ).toHaveLength(1);
      v = results[0]!.json().session;
      const different = await Promise.all([
        turn(a, v, 'Actually silver'),
        turn(b, v, 'Actually gold'),
      ]);
      expect(different.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    });
    it('rolls back all related writes if a transaction fails after the session update', async () => {
      const a = app();
      const initial = await create(a);
      const view = (await turn(a, initial, 'earrings')).json().session as SessionView;
      const before = await repo.read(owner, view.state.id);
      await expect(
        repo.update(owner, view.state.id, async (record, products) => {
          const service = createAgentService(createCatalog(products), new MockAgentPlanner());
          service.restore(record);
          const response = await service.turn(view.state.id, {
            type: 'message',
            message: 'Save E18',
            requestId: 'rollback',
            expectedVersion: view.version,
          });
          const next = service.snapshot(view.state.id);
          next.view.state.feedback[0]!.input.productId = 'does-not-exist'; // force real FK failure after UPDATE
          return { record: next, response };
        }),
      ).rejects.toThrow();
      expect(await repo.read(owner, view.state.id)).toEqual(before);
      expect(
        (await pool.query('SELECT * FROM saved_products WHERE session_id=$1', [view.state.id]))
          .rows,
      ).toHaveLength(0);
    });
    it('enforces database-backed guest ownership on read/update/list/image metadata', async () => {
      const a = app();
      const v = await create(a);
      const other = hashToken('d'.repeat(64));
      await expect(repo.read(other, v.state.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        repo.update(other, v.state.id, async () => {
          throw new Error('must not execute');
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await repo.list(other)).not.toContain(v.state.id);
      await expect(repo.asset(other, v.state.id, randomUUID())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
    it('stores private images over S3 protocol and retrieves exact bytes through a new adapter', async () => {
      const a = app();
      const v = await create(a);
      const bytes = await sharp({
        create: { width: 3, height: 3, channels: 3, background: '#246' },
      })
        .png()
        .toBuffer();
      const id = randomUUID();
      const upload = await a.inject({
        method: 'POST',
        url: `/v1/sessions/${v.state.id}/assets`,
        headers,
        payload: {
          requestId: id,
          type: 'portrait',
          mimeType: 'image/png',
          data: bytes.toString('base64'),
        },
      });
      expect(upload.statusCode).toBe(201);
      const freshObjects = createS3ObjectStore(objectConfig);
      try {
        const stored = await repo.asset(owner, v.state.id, id);
        expect(Buffer.from(await freshObjects.get(stored.key))).toEqual(bytes);
      } finally {
        freshObjects.close();
      }
      expect(
        (await a.inject({ url: `/v1/sessions/${v.state.id}/assets/${id}/content`, headers }))
          .rawPayload,
      ).toEqual(bytes);
    });
    it('recovers its pool after an idle PostgreSQL connection is terminated', async () => {
      const resilient = postgresPool(connectionString);
      try {
        const pid = (await resilient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const disconnected = new Promise<void>((resolve) =>
          resilient.once('error', () => resolve()),
        );
        await admin.query('SELECT pg_terminate_backend($1)', [pid]);
        await disconnected;
        expect((await resilient.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
      } finally {
        await resilient.end();
      }
    });
    it('persists verified identity and consumes proof atomically, without treating email text as auth', async () => {
      const a = app();
      const v = await create(a);
      const second = hashToken('d'.repeat(64));
      const now = Date.now();
      await repo.challenge({
        hash: hashToken('1'.repeat(64)),
        owner,
        email: 'test@example.com',
        expiresAt: now + 600000,
      });
      expect(await repo.verify(owner, hashToken('1'.repeat(64)), now)).toBe('test@example.com');
      await expect(repo.verify(owner, hashToken('1'.repeat(64)), now)).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
      await repo.challenge({
        hash: hashToken('2'.repeat(64)),
        owner: second,
        email: 'test@example.com',
        expiresAt: now + 600000,
      });
      await expect(repo.read(second, v.state.id)).rejects.toMatchObject({ statusCode: 404 });
      await repo.verify(second, hashToken('2'.repeat(64)), now);
      expect((await repo.read(second, v.state.id)).view.state.id).toBe(v.state.id);
    });
  },
);
