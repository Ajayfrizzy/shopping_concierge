import { postgresConnectionOptions } from './postgres-ssl.js';
import { visualStateSchema } from '../youcam/state.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { AgentError, type AgentSessionRecord } from '@youcam/agent';
import { assetSchema, productSchema } from '@youcam/shared';
import { fixtureProducts } from '../../../../fixtures/catalog.ts';
import type { ShoppingRepository, StoredAsset } from './repository.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = () => new AgentError('SESSION_NOT_FOUND', 'Shopping session not found.', 404);
export function postgresPool(connectionString: string, verification?: string) {
  const pool = new Pool({
    ...postgresConnectionOptions(connectionString, verification),
    max: 8,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 30000,
  });
  // pg removes failed idle clients; active requests reject through the normalized API boundary.
  // Handle idle disconnects so a database restart does not crash the API process.
  pool.on('error', () => {});
  return pool;
}
export async function migrate(pool: Pool) {
  const sql = await readFile(
    new URL('../../migrations/001_persistence.sql', import.meta.url),
    'utf8',
  );
  const hash = createHash('sha256').update(sql).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(751505)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL)',
    );
    const old = await client.query('SELECT checksum FROM schema_migrations WHERE version=1');
    if (old.rows[0] && old.rows[0].checksum !== hash)
      throw new Error('Migration checksum mismatch');
    if (!old.rows.length) {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations VALUES (1,$1)', [hash]);
    }
    const visualSql = await readFile(
      new URL('../../migrations/002_visual.sql', import.meta.url),
      'utf8',
    );
    const visualHash = createHash('sha256').update(visualSql).digest('hex');
    const visualOld = await client.query('SELECT checksum FROM schema_migrations WHERE version=2');
    if (visualOld.rows[0] && visualOld.rows[0].checksum !== visualHash)
      throw new Error('Migration checksum mismatch');
    if (!visualOld.rows.length) {
      await client.query(visualSql);
      await client.query('INSERT INTO schema_migrations VALUES (2,$1)', [visualHash]);
    }
    const imageSql = await readFile(
      new URL('../../migrations/003_catalog_images.sql', import.meta.url),
      'utf8',
    );
    const imageHash = createHash('sha256').update(imageSql).digest('hex');
    const imageOld = await client.query('SELECT checksum FROM schema_migrations WHERE version=3');
    if (imageOld.rows[0] && imageOld.rows[0].checksum !== imageHash)
      throw new Error('Migration checksum mismatch');
    if (!imageOld.rows.length) {
      await client.query(imageSql);
      await client.query('INSERT INTO schema_migrations VALUES (3,$1)', [imageHash]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
/** Explicit fixture seed: insert missing IDs only, never overwrite persisted catalog facts at startup. */
export async function seedFixtures(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const raw of fixtureProducts) {
      const product = productSchema.parse(raw);
      await client.query(
        'INSERT INTO products(id,product) VALUES ($1,$2) ON CONFLICT(id) DO NOTHING',
        [product.id, JSON.stringify(product)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export function createPostgresRepository(pool: Pool): ShoppingRepository {
  const principal = async (db: Pool | PoolClient, owner: string) => {
    await db.query('INSERT INTO principals(id) VALUES ($1) ON CONFLICT DO NOTHING', [owner]);
  };
  const authorized = `s.owner_id=$2 OR EXISTS (SELECT 1 FROM principals a JOIN principals b ON a.email=b.email WHERE a.id=s.owner_id AND b.id=$2 AND a.email IS NOT NULL)`;
  async function load(
    db: Pool | PoolClient,
    owner: string,
    id: string,
    lock = false,
  ): Promise<AgentSessionRecord> {
    if (!uuid.test(id)) throw missing();
    const result = await db.query(
      `SELECT s.record FROM shopping_sessions s WHERE s.id=$1 AND (${authorized})${lock ? ' FOR UPDATE OF s' : ''}`,
      [id, owner],
    );
    if (!result.rows[0]) throw missing();
    return result.rows[0].record;
  }
  const products = async (db: Pool | PoolClient) =>
    (await db.query('SELECT product FROM products ORDER BY id')).rows.map((r) =>
      productSchema.parse(r.product),
    );
  async function transaction<T>(fn: (db: PoolClient) => Promise<T>) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const value = await fn(db);
      await db.query('COMMIT');
      return value;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  return {
    async create(owner, record) {
      await transaction(async (db) => {
        await principal(db, owner);
        await db.query(
          'INSERT INTO shopping_sessions(id,owner_id,version,record) VALUES ($1,$2,$3,$4)',
          [record.view.state.id, owner, record.view.version, JSON.stringify(record)],
        );
      });
    },
    async read(owner, id) {
      return load(pool, owner, id);
    },
    async list(owner) {
      return (
        await pool.query(
          `SELECT s.id FROM shopping_sessions s WHERE (${authorized.replaceAll('$2', '$1')}) ORDER BY s.created_at, s.id`,
          [owner],
        )
      ).rows.map((r) => r.id as string);
    },
    async products() {
      return products(pool);
    },
    async update(owner, id, operation) {
      return transaction(async (db) => {
        const before = await load(db, owner, id, true);
        const { record, response } = await operation(before, await products(db));
        if (record.view.version === before.view.version) return response; // durable idempotent replay
        if (record.view.version !== before.view.version + 1 || record.view.state.id !== id)
          throw new Error('Invalid repository transition');
        const updated = await db.query(
          'UPDATE shopping_sessions SET version=$2,record=$3,updated_at=now() WHERE id=$1 AND version=$4',
          [id, record.view.version, JSON.stringify(record), before.view.version],
        );
        if (updated.rowCount !== 1)
          throw new AgentError('STALE_SESSION', 'Refresh the session before retrying.', 409);
        for (const [sequence, feedback] of record.view.state.feedback.entries()) {
          await db.query(
            'INSERT INTO product_feedback(session_id,sequence,product_id,feedback) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [id, sequence, feedback.input.productId, JSON.stringify(feedback)],
          );
        }
        await db.query('DELETE FROM saved_products WHERE session_id=$1', [id]);
        for (const decision of Object.values(record.view.state.decisions))
          for (const productId of decision.saved)
            await db.query('INSERT INTO saved_products VALUES($1,$2)', [id, productId]);
        for (const event of response.events)
          await db.query('INSERT INTO agent_events VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [
            id,
            event.revision,
            JSON.stringify(event),
          ]);
        return response;
      });
    },
    async saveAsset(owner, value) {
      return transaction(async (db) => {
        await load(db, owner, value.asset.sessionId, true);
        await db.query(
          'INSERT INTO visual_assets(session_id,id,asset,object_key) VALUES($1,$2,$3,$4) ON CONFLICT(session_id,id) DO NOTHING',
          [value.asset.sessionId, value.asset.id, JSON.stringify(value.asset), value.key],
        );
        const row = (
          await db.query(
            'SELECT asset,object_key FROM visual_assets WHERE session_id=$1 AND id=$2',
            [value.asset.sessionId, value.asset.id],
          )
        ).rows[0];
        const stored: StoredAsset = { asset: assetSchema.parse(row.asset), key: row.object_key };
        if (
          stored.asset.sha256 !== value.asset.sha256 ||
          stored.asset.type !== value.asset.type ||
          stored.asset.mimeType !== value.asset.mimeType
        )
          throw new AgentError(
            'ASSET_CONFLICT',
            'This upload ID already identifies another image.',
            409,
          );
        return stored;
      });
    },
    async asset(owner, sessionId, id) {
      await load(pool, owner, sessionId);
      if (!uuid.test(id)) throw new AgentError('ASSET_NOT_FOUND', 'Image not found.', 404);
      const row = (
        await pool.query(
          'SELECT asset,object_key FROM visual_assets WHERE session_id=$1 AND id=$2',
          [sessionId, id],
        )
      ).rows[0];
      if (!row) throw new AgentError('ASSET_NOT_FOUND', 'Image not found.', 404);
      return { asset: assetSchema.parse(row.asset), key: row.object_key };
    },
    async visual(owner, sessionId, operation) {
      return transaction(async (db) => {
        await load(db, owner, sessionId, true);
        const row = (
          await db.query('SELECT state FROM visual_sessions WHERE session_id=$1', [sessionId])
        ).rows[0];
        const next = visualStateSchema.parse(
          operation(visualStateSchema.parse(row?.state ?? { jobs: [] })),
        );
        await db.query(
          'INSERT INTO visual_sessions VALUES($1,$2) ON CONFLICT(session_id) DO UPDATE SET state=EXCLUDED.state',
          [sessionId, JSON.stringify(next)],
        );
        return next;
      });
    },
    async email(owner) {
      return (
        (await pool.query('SELECT email FROM principals WHERE id=$1', [owner])).rows[0]?.email ??
        null
      );
    },
    async challenge(value) {
      await transaction(async (db) => {
        await principal(db, value.owner);
        await db.query('DELETE FROM email_challenges WHERE expires_at <= now()');
        const result = await db.query(
          'INSERT INTO email_challenges VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [value.hash, value.owner, value.email, new Date(value.expiresAt)],
        );
        if (result.rowCount !== 1)
          throw new AgentError(
            'RATE_LIMITED',
            'Wait for the current email code to expire before requesting another.',
            429,
          );
      });
    },
    async verify(owner, hash, now) {
      return transaction(async (db) => {
        await principal(db, owner);
        const identity = (
          await db.query('SELECT email FROM principals WHERE id=$1 FOR UPDATE', [owner])
        ).rows[0];
        const row = (
          await db.query(
            'SELECT * FROM email_challenges WHERE hash=$1 AND owner_id=$2 AND expires_at>$3 FOR UPDATE',
            [hash, owner, new Date(now)],
          )
        ).rows[0];
        if (!row || (identity.email && identity.email !== row.email))
          throw new AgentError('INVALID_TOKEN', 'This email code is invalid or expired.', 400);
        await db.query('UPDATE principals SET email=$2 WHERE id=$1', [owner, row.email]);
        await db.query('DELETE FROM email_challenges WHERE hash=$1', [hash]);
        return row.email as string;
      });
    },
    async close() {
      await pool.end();
    },
  };
}
