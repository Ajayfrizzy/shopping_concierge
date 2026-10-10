import { runtimeStateSchema } from '@youcam/shared';
import { accountingConfig } from './accounting/config.js';
/** Explicit allowlist only: never serialize process.env or adapter options. */
export function runtimeState(env: NodeJS.ProcessEnv) {
  const accounting = accountingConfig(env);
  return runtimeStateSchema.parse({
    persistence: env.PERSISTENCE_MODE ?? 'memory',
    objectStorage: env.OBJECT_STORAGE_MODE ?? 'memory',
    llm: env.USE_MOCK_LLM === 'false' ? 'openai' : 'mock',
    youcam: env.USE_MOCK_YOUCAM === 'false' ? 'live' : 'mock',
    youcamLedger: env.YOUCAM_LEDGER_MODE ?? 'file',
    openaiLedger: accounting.openaiMode,
    youcamLedgerScope: accounting.youcamScope,
  });
}
