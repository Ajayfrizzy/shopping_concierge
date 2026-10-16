import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const require = createRequire(process.cwd() + '/tests/android-release.test.ts');
const plugin = require('../apps/mobile/plugins/with-release.cjs');
it('signs only the release build with private environment-driven credentials', async () => {
  const c = plugin({ name: 'test', slug: 'test' });
  const r = await c.mods.android.appBuildGradle({
    modRequest: { introspect: false },
    modResults: {
      contents:
        'signingConfigs { debug {} } buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug } }',
    },
  });
  expect(r.modResults.contents).toContain('debug { signingConfig signingConfigs.debug }');
  expect(r.modResults.contents).toContain('release { signingConfig signingConfigs.release }');
  expect(r.modResults.contents).toContain("System.getenv('CONCIERGE_KEY_PASSWORD')");
});
it('forbids release cleartext, backup and merged overlay/write-storage permissions', async () => {
  const c = plugin({ name: 'test', slug: 'test' });
  const r = await c.mods.android.manifest({
    modRequest: { introspect: false },
    modResults: { manifest: { application: [{ $: {} }], 'uses-permission': [] } },
  });
  expect(r.modResults.manifest.application[0].$).toMatchObject({
    'android:usesCleartextTraffic': 'false',
    'android:allowBackup': 'false',
  });
  expect(r.modResults.manifest['uses-permission']).toContainEqual({
    $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW', 'tools:node': 'remove' },
  });
});
