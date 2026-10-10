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
const app = buildApp({
  logger: true,
  runtime: runtimeState(process.env),
  readiness: async () => {
    if (!(await persistence.repository.products()).length) throw new Error();
    await persistence.objects.ready?.();
    await accounting?.check();
    await usage?.ledger.initialize();
  },
  shopping: {
    ...persistence,
    planner: llmProvider(process.env, accounting?.openai),
    visualProvider: youcamProvider(
      process.env,
      (event) => console.info(JSON.stringify({ service: 'youcam', ...event })),
      accounting?.youcam ?? usage?.ledger,
    ),
  },
});
app.addHook('onClose', async () => {
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
