import { calibrationApp } from './mock-server.js';
// The child environment is scrubbed by start-mock; this extra guard prevents fetch egress.
globalThis.fetch = async () => {
  throw Error('Outbound fetch forbidden in calibration server');
};
const app = await calibrationApp();
await app.listen({ host: '127.0.0.1', port: 4000 });
console.log('Isolated native mock fixture on loopback 4000; no external provider adapters.');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close();
  });
