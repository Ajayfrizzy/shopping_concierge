/** Operator-only dependency probes. Never submits shopping messages or AI calls. */
import { writeFileSync } from 'node:fs';
import { initializeRuntimeAccounting } from '../apps/api/src/accounting/config.js';
import { initializeYouCamLedger } from '../apps/api/src/youcam/ledger-config.js';
import { persistenceConfig, persistenceServices } from '../apps/api/src/persistence/config.js';
import { readConfig } from '../apps/api/src/config.js';
import {
  readinessMonitor,
  readinessErrorCode,
  type ReadinessChecks,
} from '../apps/api/src/readiness.js';
import { buildApp } from '../apps/api/src/app.js';
import { runtimeState } from '../apps/api/src/runtime.js';
let stage = 'configuration';
async function main() {
  const args = process.argv.slice(2);
  if (args.some((a) => !['--judge-profile'].includes(a))) throw new Error();
  // Explicit operator option: reuse backend credentials with the documented deployed judge modes.
  // This does not inspect or modify remote environment settings.
  const env = args.includes('--judge-profile')
    ? {
        ...process.env,
        NODE_ENV: 'production',
        USE_MOCK_LLM: 'false',
        USE_MOCK_YOUCAM: 'false',
        PERSISTENCE_MODE: 'postgres',
        OBJECT_STORAGE_MODE: 's3',
        OPENAI_LEDGER_MODE: 'postgres',
        YOUCAM_LEDGER_MODE: 'postgres',
        YOUCAM_LEDGER_SCOPE: 'judge',
        OPENAI_MAX_ATTEMPTS: '1',
      }
    : process.env;
  readConfig(env);
  const persistence = persistenceServices(persistenceConfig(env));
  let accounting: Awaited<ReturnType<typeof initializeRuntimeAccounting>>;
  let usage: Awaited<ReturnType<typeof initializeYouCamLedger>>;
  try {
    stage = 'accountingInitialization';
    accounting = await initializeRuntimeAccounting(env);
    stage = 'youcamValidationInitialization';
    usage = await initializeYouCamLedger(env);
    stage = 'readiness';
    const checks: ReadinessChecks = {
      configuration: () => {
        readConfig(env);
        persistenceConfig(env);
      },
      database: async () => {
        if (!(await persistence.repository.products()).length) throw new Error();
      },
      objectStorage: () => persistence.objects.ready?.(),
      ...accounting?.checks,
      ...(usage ? { youcamLedger: () => usage!.ledger.initialize() } : {}),
    };
    // Readiness-only harness: providers are never invoked. Pools and clients created once above.
    const app = buildApp({ runtime: runtimeState(env), readinessChecks: checks });
    const inspect = readinessMonitor(checks);
    const rounds = [];
    try {
      for (let i = 0; i < 5; i++) {
        const details = await inspect();
        const health = await app.inject('/health');
        const ready = await app.inject('/ready');
        const row = {
          at: new Date().toISOString(),
          details,
          healthStatus: health.statusCode,
          readyStatus: ready.statusCode,
          ready: ready.json(),
        };
        rounds.push(row);
        if (process.env.READINESS_EVIDENCE_PATH)
          writeFileSync(
            process.env.READINESS_EVIDENCE_PATH,
            JSON.stringify({ rounds }, null, 2) + '\n',
          );
        console.log(JSON.stringify(row));
      }
    } finally {
      await app.close();
    }
    if (process.env.READINESS_EVIDENCE_PATH)
      writeFileSync(
        process.env.READINESS_EVIDENCE_PATH,
        JSON.stringify(
          {
            profile: args.includes('--judge-profile')
              ? 'documented judge profile, not remote environment introspection'
              : 'local environment',
            rounds,
          },
          null,
          2,
        ) + '\n',
      );
  } finally {
    await accounting?.close();
    await usage?.close();
    persistence.objects.close();
    await persistence.repository.close();
  }
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ stage, code: readinessErrorCode(error) }));
  console.error(
    'Readiness inspection failed during initialization. Check configuration and database access; no raw errors are printed.',
  );
  process.exitCode = 1;
});
