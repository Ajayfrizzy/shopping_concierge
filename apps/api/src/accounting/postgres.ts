import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Category } from '@youcam/shared';
import { z } from 'zod';
import { APPROVED_MODEL, usageCost } from '../llm/budget.js';
export interface RuntimeLimits {
  maxRequests: number;
  maxUnits: number;
  maxUsd: number;
}
/** A single locked budget row serializes all workers. Unknown submissions stay fully reserved. */
export class RuntimeLedger {
  constructor(
    readonly pool: Pool,
    readonly provider: 'openai' | 'youcam',
    readonly limits: RuntimeLimits,
  ) {}
  private matches(row: Record<string, unknown> | undefined) {
    return (
      row &&
      row.max_requests === this.limits.maxRequests &&
      row.max_units === this.limits.maxUnits &&
      Number(row.max_usd) === this.limits.maxUsd
    );
  }
  async initialize(requireApproval = true) {
    try {
      const row = (
        await this.pool.query('SELECT * FROM runtime_budgets WHERE provider=$1', [this.provider])
      ).rows[0];
      if (!this.matches(row) || (requireApproval && !row.approved) || row.blocked)
        throw new Error();
      await this.pool.query('UPDATE runtime_budgets SET blocked=blocked WHERE false');
      await this.pool.query('UPDATE runtime_usage SET committed_at=committed_at WHERE false');
      await this.pool.query(
        'INSERT INTO runtime_usage(provider,id,units,reserved_usd,charged_usd) SELECT $1,$2,0,0,0 WHERE false',
        [this.provider, randomUUID()],
      );
    } catch {
      throw new Error(
        `${this.provider} judge ledger unavailable: check migration 005, privileges, budget approval and matching limits.`,
      );
    }
  }
  async reserveAttempt(id: string, units: number, usd: number, category: Category | null = null) {
    z.string().uuid().parse(id);
    z.number().int().nonnegative().parse(units);
    z.number().finite().nonnegative().parse(usd);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const budget = (
        await db.query('SELECT * FROM runtime_budgets WHERE provider=$1 FOR UPDATE', [
          this.provider,
        ])
      ).rows[0];
      if (!this.matches(budget) || !budget.approved || budget.blocked)
        throw new Error('Budget unavailable');
      const old = (
        await db.query('SELECT * FROM runtime_usage WHERE provider=$1 AND id=$2', [
          this.provider,
          id,
        ])
      ).rows[0];
      if (old) {
        if (old.units !== units || Number(old.reserved_usd) !== usd || old.category !== category)
          throw new Error('Reservation conflict');
        await db.query('COMMIT');
        return false;
      }
      const totals = (
        await db.query(
          'SELECT count(*)::int AS requests,coalesce(sum(units),0)::int AS units,coalesce(sum(charged_usd),0) AS usd FROM runtime_usage WHERE provider=$1',
          [this.provider],
        )
      ).rows[0];
      if (
        totals.requests + 1 > budget.max_requests ||
        totals.units + units > budget.max_units ||
        Number(totals.usd) + usd > Number(budget.max_usd)
      )
        throw new Error('Judge budget exhausted');
      await db.query(
        'INSERT INTO runtime_usage(provider,id,category,units,reserved_usd,charged_usd) VALUES($1,$2,$3,$4,$5,$5)',
        [this.provider, id, category, units, usd],
      );
      await db.query('COMMIT');
      return true;
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      db.release();
    }
  }
  async commitAttempt(id: string, raw?: unknown) {
    const settlement = this.provider === 'openai' ? usageCost(raw) : null;
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT provider FROM runtime_budgets WHERE provider=$1 FOR UPDATE', [
        this.provider,
      ]);
      const entry = (
        await db.query('SELECT * FROM runtime_usage WHERE provider=$1 AND id=$2 FOR UPDATE', [
          this.provider,
          id,
        ])
      ).rows[0];
      if (!entry) throw new Error('Unknown reservation');
      if (entry.committed_at) {
        if (JSON.stringify(entry.usage) !== JSON.stringify(settlement?.usage ?? null)) {
          // JSONB key order differs; compare normalized parsed usage instead.
          if (
            !settlement ||
            JSON.stringify(usageCost(entry.usage).usage) !== JSON.stringify(settlement.usage)
          )
            throw new Error('Conflicting settlement');
        }
        await db.query('COMMIT');
        return;
      }
      await db.query(
        'UPDATE runtime_usage SET charged_usd=$3,usage=$4,committed_at=now() WHERE provider=$1 AND id=$2',
        [
          this.provider,
          id,
          settlement?.usd ?? 0,
          settlement ? JSON.stringify(settlement.usage) : null,
        ],
      );
      if (settlement && settlement.usd > Number(entry.reserved_usd))
        await db.query('UPDATE runtime_budgets SET blocked=true WHERE provider=$1', [
          this.provider,
        ]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      db.release();
    }
  }
}
export class PostgresOpenAIBudget {
  constructor(readonly ledger: RuntimeLedger) {}
  async reserve(model: string, bodyBytes: number, maxOutputTokens: number): Promise<string> {
    if (
      model !== APPROVED_MODEL ||
      !Number.isSafeInteger(bodyBytes) ||
      bodyBytes < 1 ||
      !Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 1
    )
      throw new Error('Unapproved OpenAI accounting parameters');
    const id = randomUUID();
    const usd =
      Math.ceil((((bodyBytes + 4096) * 2 + maxOutputTokens * 12) / 1_000_000) * 1e8) / 1e8;
    await this.ledger.reserveAttempt(id, 0, usd);
    return id;
  }
  settle(id: string | number, raw: unknown) {
    return this.ledger.commitAttempt(String(id), raw);
  }
}
