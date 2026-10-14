import { ReceiptBudget } from './accounting/receipts.js';
import { initializeRuntimeAccounting } from './accounting/config.js';
import { runtimeState } from './runtime.js';
import { startupFailure } from './startup.js';
import { initializeYouCamLedger } from './youcam/ledger-config.js';
import { llmProvider } from './llm/config.js';
import { youcamProvider } from './youcam/config.js';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { persistenceConfig, persistenceServices } from './persistence/config.js';
const config = readConfig();
const storageConfig = persistenceConfig();
const accounting = await initializeRuntimeAccounting(process.env);
const usage = await initializeYouCamLedger(process.env);
const persistence = persistenceServices(storageConfig);
const openaiBudget = accounting?.openai
  ? new ReceiptBudget(accounting.openai, persistence.objects, storageConfig.s3?.assetPrefix)
  : undefined;
const app = buildApp({
  logger: true,
  runtime: runtimeState(process.env),
  readinessChecks: {
    configuration: () => {
      readConfig();
      persistenceConfig();
    },
    database: async () => {
      if (!(await persistence.repository.products()).length) throw new Error();
    },
    objectStorage: () => persistence.objects.ready?.(),
    ...accounting?.checks,
    ...(accounting?.checks.openaiLedger
      ? {
          openaiLedger: async () => {
            openaiBudget?.assertReady();
            await accounting.checks.openaiLedger!();
          },
        }
      : {}),
    ...(usage ? { youcamLedger: () => usage.ledger.initialize() } : {}),
  },
  shopping: {
    ...persistence,
    planner: llmProvider(
      process.env,
      openaiBudget,
      (event) => console.error(JSON.stringify({ service: 'openai', ...event })),
      accounting?.diagnostics,
    ),
    visualProvider: youcamProvider(
      process.env,
      (event) => console.info(JSON.stringify({ service: 'youcam', ...event })),
      accounting?.youcam ?? usage?.ledger,
    ),
  },
});
// Retry only retained receipt/settlement writes, never a provider call or reservation.
const recoveryTimer = openaiBudget
  ? setInterval(() => {
      void openaiBudget.reconcilePending().catch(() => {});
    }, 30000)
  : undefined;
recoveryTimer?.unref();
app.addHook('onClose', async () => {
  if (recoveryTimer) clearInterval(recoveryTimer);
  await accounting?.close();
  await usage?.close();
  await persistence.repository.close();
  persistence.objects.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
let stage: 'catalog' | 'listen' = 'catalog';
try {
  if (!(await persistence.repository.products()).length)
    throw Object.assign(new Error('Catalog is empty'), { code: 'CATALOG_EMPTY' });
  stage = 'listen';
  await app.listen(config);
} catch (error) {
  const failure = startupFailure(stage, error);
  app.log.error({ stage: failure.stage, code: failure.code }, failure.message);
  await app.close();
  process.exitCode = 1;
}
