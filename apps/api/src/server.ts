import { startupFailure } from './startup.js';
import { initializeYouCamLedger } from './youcam/ledger-config.js';
import { llmProvider } from './llm/config.js';
import { youcamProvider } from './youcam/config.js';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { persistenceConfig, persistenceServices } from './persistence/config.js';
const config = readConfig();
const storageConfig = persistenceConfig();
const usage = await initializeYouCamLedger(process.env);
const persistence = persistenceServices(storageConfig);
const app = buildApp({
  logger: true,
  shopping: {
    ...persistence,
    planner: llmProvider(),
    visualProvider: youcamProvider(
      process.env,
      (event) => console.info(JSON.stringify({ service: 'youcam', ...event })),
      usage?.ledger,
    ),
  },
});
app.addHook('onClose', async () => {
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
