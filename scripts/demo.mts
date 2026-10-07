import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { demoEnvironment } from './demo-environment.mjs';

const env = demoEnvironment(process.env);
const cwd = fileURLToPath(new URL('..', import.meta.url));
async function run(command: string, args: string[], childEnv = env) {
  const child = spawn(command, args, { cwd, env: childEnv, stdio: 'inherit' });
  const forward = () => child.kill('SIGTERM');
  process.once('SIGINT', forward);
  process.once('SIGTERM', forward);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Demo command failed.')),
      );
    });
  } finally {
    process.removeListener('SIGINT', forward);
    process.removeListener('SIGTERM', forward);
  }
}
try {
  switch (process.argv[2]) {
    case 'prepare':
      await run('docker', ['compose', '-f', 'infra/compose.local.yml', 'up', '-d', '--wait']);
      await run(process.execPath, [
        '--import',
        'tsx',
        'apps/api/src/persistence/migrate.ts',
        '--seed-fixtures',
      ]);
      break;
    case 'api':
      console.info('Demo API: local PostgreSQL/S3; mock LLM and mock YouCam; zero live credits.');
      await run(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts']);
      break;
    case 'mobile':
      await run('adb', ['reverse', 'tcp:4000', 'tcp:4000']);
      await run('adb', ['reverse', 'tcp:8082', 'tcp:8082']);
      await run('npm', ['run', 'dev:clear', '-w', '@youcam/mobile', '--', '--localhost']);
      break;
    case 'android': {
      const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT;
      if (
        !sdk ||
        ![
          'platform-tools/adb',
          'platforms/android-36/android.jar',
          'build-tools/36.0.0/aapt2',
          'ndk/27.1.12297006/source.properties',
          'cmake/3.22.1/bin/cmake',
        ].every((file) => existsSync(join(sdk, file)))
      ) {
        throw new Error(
          'Android SDK is incomplete. Set ANDROID_HOME to a complete SDK (see docs/DEMO_SETUP.md).',
        );
      }
      const prebuild = [
        'exec',
        '-w',
        '@youcam/mobile',
        '--',
        'expo',
        'prebuild',
        '--platform',
        'android',
        '--no-install',
      ];
      try {
        await run('npm', prebuild);
        await run('npm', [
          'exec',
          '-w',
          '@youcam/mobile',
          '--',
          'expo',
          'run:android',
          '--no-bundler',
          ...process.argv.slice(3),
        ]);
      } finally {
        // Keep normal native alignment checks valid; this does not touch the installed app.
        await run('npm', prebuild, { ...env, CONCIERGE_DEMO_APP: '0' });
      }
      break;
    }
    default:
      throw new Error('Use demo:prepare, demo:api, demo:mobile or demo:android.');
  }
} catch (error) {
  if (error instanceof Error) console.error(error.message);
  console.error('Demo command stopped. Check the preceding output and docs/DEMO_SETUP.md.');
  process.exitCode = 1;
}
