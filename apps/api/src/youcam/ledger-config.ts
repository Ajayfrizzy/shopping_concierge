import { postgresPool } from '../persistence/postgres.js';
import { PostgresUsageLedger } from './ledger.js';
export function ledgerSettings(env: NodeJS.ProcessEnv) {
  const mode = env.YOUCAM_LEDGER_MODE ?? 'file';
  if (mode !== 'file' && mode !== 'postgres')
    throw new Error('YOUCAM_LEDGER_MODE must be file or postgres.');
  function ceiling(key: string) {
    const value = env[key] ?? '8';
    if (
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > 2147483647
    )
      throw new Error(`${key} must be a positive PostgreSQL integer.`);
    return Number(value);
  }
  const maxRequests = ceiling('YOUCAM_MAX_REQUESTS'),
    maxUnits = ceiling('YOUCAM_MAX_UNITS');
  if (mode === 'postgres' && (env.PERSISTENCE_MODE !== 'postgres' || !env.DATABASE_URL?.trim()))
    throw new Error(
      'PostgreSQL YouCam ledger requires PERSISTENCE_MODE=postgres and DATABASE_URL.',
    );
  if (mode === 'file' && !env.YOUCAM_USAGE_LEDGER)
    throw new Error('Live YouCam requires an initialized usage ledger.');
  if (mode === 'file' && (maxRequests !== 8 || maxUnits !== 8))
    throw new Error('File YouCam validation ledger uses fixed eight-render ceilings.');
  return { mode, maxRequests, maxUnits };
}
export async function initializeYouCamLedger(env: NodeJS.ProcessEnv) {
  if (env.USE_MOCK_YOUCAM !== 'false') return undefined;
  const settings = ledgerSettings(env);
  if (settings.mode === 'file') {
    const { validateFileLedger } = await import('./budget.js');
    validateFileLedger(env.YOUCAM_USAGE_LEDGER!);
    return undefined;
  }
  const pool = postgresPool(env.DATABASE_URL!, env.DATABASE_SSL_REJECT_UNAUTHORIZED);
  const ledger = new PostgresUsageLedger(pool, settings.maxRequests, settings.maxUnits);
  try {
    await ledger.initialize();
  } catch (error) {
    await pool.end();
    throw error;
  }
  return { ledger, close: () => pool.end() };
}
