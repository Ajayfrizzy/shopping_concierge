import { buildApp } from './app.js';
import { readConfig } from './config.js';
const config = readConfig();
const app = buildApp({ logger: true });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
try { await app.listen(config); }
catch (error) { app.log.error(error); process.exitCode = 1; }
