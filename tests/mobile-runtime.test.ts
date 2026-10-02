import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = createRequire(resolve('package.json'));
const mobile = createRequire(resolve('apps/mobile/package.json'));
const sdk = mobile('expo/bundledNativeModules.json') as Record<string, string>;
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { version?: string }>;
};

describe('mobile native runtime alignment', () => {
  it('shared source imports resolve without Node-only extension substitution', () => {
    const visited = new Set<string>();
    function check(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
        const target = resolve(dirname(file), specifier.text);
        expect(existsSync(target), `Metro needs an existing source file: ${target}`).toBe(true);
        check(target);
      }
    }
    check(resolve('packages/shared/src/index.ts'));
    check(resolve('packages/shared/domain.ts'));
  });
  it.each(['react', 'react-dom', 'react-native', 'react-native-reanimated', 'react-native-worklets'])('locks one SDK-compatible %s across the workspace', (name) => {
    const versions = Object.entries(lock.packages)
      .filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`)
      .map(([, entry]) => entry.version);
    expect(versions).toEqual([sdk[name]]);
    expect(mobile(`${name}/package.json`).version).toBe(sdk[name]);
    expect(root.resolve(`${name}/package.json`)).toBe(mobile.resolve(`${name}/package.json`));
  });
  it.each(['expo-router', 'react-native', 'expo'])('%s resolves the same React instance as the app', (name) => {
    const dependency = createRequire(mobile.resolve(`${name}/package.json`));
    expect(dependency.resolve('react')).toBe(mobile.resolve('react'));
  });
  it.skipIf(!existsSync('apps/mobile/android/gradle.properties'))('generated Android config matches the declared runtime', () => {
    const config = JSON.parse(readFileSync('apps/mobile/app.json', 'utf8')).expo;
    const properties = readFileSync('apps/mobile/android/gradle.properties', 'utf8');
    const gradle = readFileSync('apps/mobile/android/app/build.gradle', 'utf8');
    expect(properties).toContain('newArchEnabled=true');
    expect(properties).toContain('hermesEnabled=true');
    expect(gradle).toContain(`applicationId '${config.android.package}'`);
    const strings = readFileSync('apps/mobile/android/app/src/main/res/values/strings.xml', 'utf8');
    expect(strings).toContain(`<string name="app_name">${config.name}</string>`);
    const icon = readFileSync('apps/mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'utf8');
    expect(icon).toContain('@mipmap/ic_launcher_foreground');
    expect(icon).toContain('@mipmap/ic_launcher_monochrome');
  });
  it('has its own native identity and a mandatory New Architecture development client', () => {
    const config = JSON.parse(readFileSync('apps/mobile/app.json', 'utf8')).expo;
    const pkg = mobile('./package.json');
    expect(config.android.package).toBe('com.youcam.shoppingconcierge');
    expect(config.newArchEnabled).toBeUndefined();
    expect(Number(mobile('expo/package.json').version.split('.')[0])).toBeGreaterThanOrEqual(55);
    expect(pkg.dependencies['expo-dev-client']).toBe(sdk['expo-dev-client']);
    expect(pkg.scripts.android).toContain('expo prebuild --platform android');
    expect(pkg.scripts.android).toContain('expo run:android --device');
    expect(pkg.scripts.dev).toContain('--dev-client');
    expect(pkg.scripts['dev:clear']).toContain('--clear');
  });
});
