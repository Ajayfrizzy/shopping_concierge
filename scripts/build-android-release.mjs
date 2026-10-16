/* global process */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const secrets = resolve(root, 'artifacts/android/signing');
mkdirSync(secrets, { recursive: true, mode: 0o700 });
const passFile = resolve(secrets, 'password');
if (!existsSync(passFile))
  writeFileSync(passFile, randomBytes(32).toString('hex'), { mode: 0o600 });
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) => !/OPENAI|YOUCAM|DATABASE|S3_|EXPO_PUBLIC_|CONCIERGE_/.test(k),
  ),
);
Object.assign(env, {
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  CONCIERGE_RELEASE: '1',
  EXPO_PUBLIC_API_URL: 'https://shoppingconcierge.rumptycloud.app',
  CONCIERGE_KEYSTORE: resolve(secrets, 'release.jks'),
  CONCIERGE_KEY_PASSWORD: readFileSync(passFile, 'utf8'),
  EX_DEV_CLIENT_NETWORK_INSPECTOR: 'false',
});
function run(command, args, cwd = root) {
  const r = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (!existsSync(env.CONCIERGE_KEYSTORE))
  run('keytool', [
    '-genkeypair',
    '-keystore',
    env.CONCIERGE_KEYSTORE,
    '-storepass:env',
    'CONCIERGE_KEY_PASSWORD',
    '-keypass:env',
    'CONCIERGE_KEY_PASSWORD',
    '-alias',
    'concierge-release',
    '-keyalg',
    'RSA',
    '-keysize',
    '3072',
    '-validity',
    '10000',
    '-dname',
    'CN=Shopping Concierge, OU=Hackathon, O=Shopping Concierge, C=NG',
  ]);
run(
  'npx',
  ['expo', 'prebuild', '--platform', 'android', '--no-install'],
  resolve(root, 'apps/mobile'),
);
const gradle = readFileSync(resolve(root, 'apps/mobile/android/app/build.gradle'), 'utf8');
if (!/buildTypes \{[\s\S]*?release \{[\s\S]*?signingConfig signingConfigs.release/.test(gradle)) {
  throw new Error('Release signing configuration was not applied.');
}
run(
  './gradlew',
  ['assembleRelease', '--no-daemon', '--max-workers=2', '-PreactNativeArchitectures=arm64-v8a'],
  resolve(root, 'apps/mobile/android'),
);
