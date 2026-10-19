import { spawn } from 'node:child_process';
import { demoEnvironment } from '../demo-environment.mjs';
const mode = process.argv[2];
if (!['api', 'mobile'].includes(mode ?? '')) throw Error('Use api or mobile');
const env = { ...demoEnvironment(process.env), EXPO_OFFLINE: '1', CI: '1' };
const args =
  mode === 'api'
    ? ['--import', 'tsx', 'scripts/recording/serve-mock.mts']
    : ['../../node_modules/expo/bin/cli', 'start', '--dev-client', '--localhost', '--port', '8082'];
const child = spawn(process.execPath, args, {
  env,
  stdio: 'inherit',
  cwd: mode === 'api' ? process.cwd() : 'apps/mobile',
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
