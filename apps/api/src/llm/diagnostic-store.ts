import { readinessErrorCode } from '../readiness.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { sanitizeDiagnostic, type OpenAIDiagnostic } from './diagnostics.js';
export interface DiagnosticStore {
  start(sessionId: string, clientRequestId?: string, attempt?: number): Promise<string>;
  attach(id: string, reservation: string): Promise<void>;
  finish(id: string, event: OpenAIDiagnostic, success: boolean): Promise<void>;
}
const identifier = z.string().min(1).max(200);
export class PostgresDiagnosticStore implements DiagnosticStore {
  constructor(private readonly pool: Pool) {}
  async initialize() {
    try {
      await this.pool.query('SELECT id FROM openai_provider_diagnostics LIMIT 0');
      const r = await this.pool.query(
        "SELECT has_table_privilege(current_user,'openai_provider_diagnostics','INSERT') AND has_table_privilege(current_user,'openai_provider_diagnostics','UPDATE') AS allowed",
      );
      if (!r.rows[0]?.allowed) throw new Error();
    } catch (cause) {
      throw new Error('OpenAI diagnostics unavailable: check migration 007 and privileges.', {
        cause: { code: readinessErrorCode(cause) },
      });
    }
  }
  async start(sessionId: string, clientRequestId?: string, attempt = 0) {
    identifier.parse(sessionId);
    if (clientRequestId !== undefined) identifier.parse(clientRequestId);
    const id = randomUUID();
    const db = await this.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      if (clientRequestId) {
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          JSON.stringify([sessionId, clientRequestId]),
        ]);
        if (attempt === 0) {
          const prior = await db.query(
            'SELECT id FROM openai_provider_diagnostics WHERE session_id=$1 AND client_request_id=$2 LIMIT 1',
            [sessionId, clientRequestId],
          );
          if (prior.rowCount)
            throw new Error('OpenAI request already attempted; reconcile before resubmitting');
        }
      }
      await db.query(
        "INSERT INTO openai_provider_diagnostics(id,session_id,client_request_id,stage,outcome) VALUES($1,$2,$3,'reservation','pending')",
        [id, sessionId, clientRequestId ?? null],
      );
      await db.query('COMMIT');
      return id;
    } catch (error) {
      discard = true;
      await db.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      db.release(discard);
    }
  }
  async attach(id: string, reservation: string) {
    const result = await this.pool.query(
      "UPDATE openai_provider_diagnostics SET ledger_reservation_id=$2,stage='transport' WHERE id=$1 AND outcome='pending'",
      [z.string().uuid().parse(id), z.string().uuid().parse(reservation)],
    );
    if (result.rowCount !== 1) throw new Error('Diagnostic attempt missing');
  }
  async finish(id: string, event: OpenAIDiagnostic, success: boolean) {
    const d = sanitizeDiagnostic(event);
    const result = await this.pool.query(
      "UPDATE openai_provider_diagnostics SET finished_at=now(),stage=$2,http_status=$3,error_code=$4,error_type=$5,provider_request_id=$6,aborted=$7,outcome=$8 WHERE id=$1 AND outcome='pending'",
      [
        z.string().uuid().parse(id),
        d.stage,
        d.status ?? null,
        d.errorCode ?? null,
        d.errorType ?? null,
        d.requestId ?? null,
        d.aborted,
        success ? 'success' : 'failure',
      ],
    );
    if (result.rowCount !== 1) throw new Error('Diagnostic already finalized or missing');
  }
  async list(filter: { sessionId?: string; clientRequestId?: string; limit?: number } = {}) {
    const limit = z
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(filter.limit ?? 20);
    return (
      await this.pool.query(
        'SELECT id,created_at,finished_at,session_id,client_request_id,ledger_reservation_id,stage,http_status,error_code,error_type,provider_request_id,aborted,outcome FROM openai_provider_diagnostics WHERE ($1::text IS NULL OR session_id=$1) AND ($2::text IS NULL OR client_request_id=$2) ORDER BY created_at DESC,id LIMIT $3',
        [
          filter.sessionId ? identifier.parse(filter.sessionId) : null,
          filter.clientRequestId ? identifier.parse(filter.clientRequestId) : null,
          limit,
        ],
      )
    ).rows;
  }
}
