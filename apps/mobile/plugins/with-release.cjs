/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, module */
const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) => {
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$['android:usesCleartextTraffic'] = 'false';
    app.$['android:allowBackup'] = 'false';
    c.modResults.manifest['uses-permission'] = (
      c.modResults.manifest['uses-permission'] || []
    ).filter(
      (p) =>
        ![
          'android.permission.SYSTEM_ALERT_WINDOW',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ].includes(p.$['android:name']),
    );
    for (const name of [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]) {
      c.modResults.manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }
    return c;
  });
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = c.modResults.contents.replace(
      'signingConfigs {',
      `signingConfigs {
        release {
            def keyPath = System.getenv('CONCIERGE_KEYSTORE')
            if (keyPath) {
                storeFile file(keyPath)
                storePassword System.getenv('CONCIERGE_KEY_PASSWORD')
                keyAlias 'concierge-release'
                keyPassword System.getenv('CONCIERGE_KEY_PASSWORD')
            }
        }`,
    );
    c.modResults.contents = c.modResults.contents.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs.debug/,
      '$1signingConfig signingConfigs.release',
    );
    return c;
  });
};
