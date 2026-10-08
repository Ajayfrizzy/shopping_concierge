import type { Category } from '@youcam/shared';
import type { Pool } from 'pg';
import { categorySchema } from '@youcam/shared';
import { z } from 'zod';
import { VisualError } from './provider.js';

/** Reservations remain charged even when submission/commit outcomes are unknown. */
export interface UsageLedger {
  initialize(): Promise<void>;
  reserve(id: string, category: Category): Promise<boolean>;
  commit(id: string): Promise<void>;
}
const unavailable = () =>
  new VisualError(
    'PROVIDER_UNAVAILABLE',
    'Live try-on budget is exhausted or unavailable. No automatic rendering retry will be made.',
  );
export class PostgresUsageLedger implements UsageLedger {
  constructor(
    private readonly pool: Pool,
    private readonly maxRequests = 8,
    private readonly maxUnits = 8,
  ) {
    z.number().int().positive().safe().parse(maxRequests);
    z.number().int().positive().safe().parse(maxUnits);
  }
  async initialize() {
    try {
      const result = await this.pool.query(
        'SELECT max_requests, max_units FROM youcam_usage_budget WHERE id=1',
      );
      if (
        result.rows.length !== 1 ||
        result.rows[0].max_requests !== this.maxRequests ||
        result.rows[0].max_units !== this.maxUnits
      )
        throw new Error();
      // Verify read and write access without changing historical accounting.
      await this.pool.query(
        'UPDATE youcam_usage_reservations SET committed_at=committed_at WHERE false',
      );
      await this.pool.query(
        'INSERT INTO youcam_usage_reservations (id,category) SELECT $1,$2 WHERE false',
        ['startup-check', 'rings'],
      );
      await this.pool.query('UPDATE youcam_usage_budget SET max_requests=max_requests WHERE false');
    } catch {
      throw new Error(
        'Live YouCam PostgreSQL ledger initialization failed: check migration 004, database access and matching YOUCAM_MAX_REQUESTS/YOUCAM_MAX_UNITS ceilings.',
      );
    }
  }
  async reserve(id: string, category: Category): Promise<boolean> {
    z.string().uuid().parse(id);
    categorySchema.parse(category);
    const client = await this.pool.connect().catch(() => {
      throw unavailable();
    });
    try {
      await client.query('BEGIN');
      const budget = (
        await client.query(
          'SELECT max_requests, max_units FROM youcam_usage_budget WHERE id=1 FOR UPDATE',
        )
      ).rows[0];
      if (!budget || budget.max_requests !== this.maxRequests || budget.max_units !== this.maxUnits)
        throw unavailable();
      const old = (
        await client.query('SELECT category FROM youcam_usage_reservations WHERE id=$1', [id])
      ).rows[0];
      if (old) {
        if (old.category !== category) throw unavailable();
        await client.query('COMMIT');
        return false;
      }
      const usage = (
        await client.query(
          'SELECT count(*)::int AS requests, coalesce(sum(units),0)::int AS units FROM youcam_usage_reservations',
        )
      ).rows[0];
      if (usage.requests >= budget.max_requests || usage.units + 1 > budget.max_units)
        throw unavailable();
      await client.query('INSERT INTO youcam_usage_reservations (id,category) VALUES ($1,$2)', [
        id,
        category,
      ]);
      await client.query('COMMIT');
      return true;
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw unavailable();
    } finally {
      client.release();
    }
  }
  async commit(id: string) {
    z.string().uuid().parse(id);
    try {
      const result = await this.pool.query(
        'UPDATE youcam_usage_reservations SET committed_at=coalesce(committed_at,now()) WHERE id=$1 RETURNING id',
        [id],
      );
      if (result.rowCount !== 1) throw unavailable();
    } catch {
      throw unavailable();
    }
  }
}
