import { PostgresDiagnosticStore } from '../llm/diagnostic-store.js';
import { postgresPool } from '../persistence/postgres.js';
import { RuntimeLedger, PostgresOpenAIBudget } from './postgres.js';
export function accountingConfig(env: NodeJS.ProcessEnv) {
  const openaiMode = env.OPENAI_LEDGER_MODE ?? 'file';
  const youcamScope = env.YOUCAM_LEDGER_SCOPE ?? 'validation';
  if (!['file', 'postgres'].includes(openaiMode))
    throw new Error('OPENAI_LEDGER_MODE must be file or postgres.');
  if (!['validation', 'judge'].includes(youcamScope))
    throw new Error('YOUCAM_LEDGER_SCOPE must be validation or judge.');
  function number(key: string, fallback: number, integer: boolean) {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 2147483647 ||
      (integer && !Number.isInteger(value)) ||
      (!integer && Math.round(value * 1e8) !== value * 1e8)
    )
      throw new Error(
        `${key} must be a positive ${integer ? 'integer' : 'USD amount with at most eight decimals'}.`,
      );
    return value;
  }
  return {
    openaiMode,
    youcamScope,
    openai: {
      maxRequests: number('OPENAI_JUDGE_MAX_REQUESTS', 200, true),
      maxUnits: 0,
      maxUsd: number('OPENAI_JUDGE_MAX_USD', 3, false),
    },
    youcam: {
      maxRequests: number('YOUCAM_JUDGE_MAX_RENDERS', 50, true),
      maxUnits: number('YOUCAM_JUDGE_MAX_RENDERS', 50, true),
      maxUsd: 0,
    },
  };
}
export async function initializeRuntimeAccounting(env: NodeJS.ProcessEnv) {
  const c = accountingConfig(env);
  const openai = c.openaiMode === 'postgres';
  const youcam = c.youcamScope === 'judge';
  if (!openai && !youcam) return undefined;
  if (env.PERSISTENCE_MODE !== 'postgres' || !env.DATABASE_URL)
    throw new Error('Judge accounting requires PostgreSQL persistence.');
  if (youcam && env.YOUCAM_LEDGER_MODE !== 'postgres')
    throw new Error('Judge YouCam requires YOUCAM_LEDGER_MODE=postgres.');
  const pool = postgresPool(env.DATABASE_URL, env.DATABASE_SSL_REJECT_UNAUTHORIZED);
  const diagnostics = openai ? new PostgresDiagnosticStore(pool) : undefined;
  const o = openai ? new RuntimeLedger(pool, 'openai', c.openai) : undefined;
  const y = youcam ? new RuntimeLedger(pool, 'youcam', c.youcam) : undefined;
  const check = async () => {
    await diagnostics?.initialize();
    await o?.initialize(env.USE_MOCK_LLM === 'false');
    await y?.initialize(env.USE_MOCK_YOUCAM === 'false');
  };
  try {
    await check();
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    diagnostics,
    openai: o ? new PostgresOpenAIBudget(o) : undefined,
    youcam: y
      ? {
          initialize: () => y.initialize(),
          reserve: (id: string, category: import('@youcam/shared').Category) =>
            y.reserveAttempt(id, 1, 0, category),
          commit: (id: string) => y.commitAttempt(id),
        }
      : undefined,
    check,
    close: () => pool.end(),
  };
}
