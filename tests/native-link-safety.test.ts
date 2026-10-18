import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redirectSystemPath } from '../apps/mobile/app/+native-intent';
it.each([true, false])('validates initial=%s external links before routing', (initial) => {
  for (const path of [
    'shopping-concierge://try-on?productId=E01',
    'shopping-concierge://summary',
    '/?q=silver%20earrings',
  ])
    expect(redirectSystemPath({ path, initial })).toBe(path);
  for (const path of ['/?q=%FF'.repeat(80), '/?q=%E0%A4%A', '/?q=%', '/?q=' + 'x'.repeat(2048)])
    expect(redirectSystemPath({ path, initial })).toBe('/');
});
it('installed Expo Router invokes the native intent hook for cold and warm external links', () => {
  expect(readFileSync('node_modules/expo-router/build/getLinkingConfig.js', 'utf8')).toContain(
    'nativeLinking.redirectSystemPath({ path:',
  );
  expect(readFileSync('node_modules/expo-router/build/link/linking.js', 'utf8')).toContain(
    'nativeLinking.redirectSystemPath({ path:',
  );
});
