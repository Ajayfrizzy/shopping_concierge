import { expect, it } from 'vitest';
import { startupFailure } from '../apps/api/src/startup.js';
it('identifies empty catalog and gives explicit seed guidance', () => {
  expect(startupFailure('catalog', { code: 'CATALOG_EMPTY' })).toEqual({
    stage: 'catalog',
    code: 'CATALOG_EMPTY',
    message: expect.stringContaining('--seed-fixtures'),
  });
});
it.each([
  '42P01',
  '42501',
  '28P01',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
])('identifies database failure %s without raw driver fields', (code) => {
  const result = startupFailure('catalog', {
    code,
    message: 'private-secret',
    detail: 'private-secret',
  });
  expect(result.code).toBe(code);
  expect(JSON.stringify(result)).not.toContain('private-secret');
});
it.each(['EADDRINUSE', 'EADDRNOTAVAIL', 'EACCES'])('identifies listener failure %s', (code) => {
  expect(startupFailure('listen', { code })).toMatchObject({ stage: 'listen', code });
});
it.each([null, new Error('private-secret'), { code: 'private-secret' }, { code: '__proto__' }])(
  'does not expose unknown error contents',
  (error) => {
    expect(startupFailure('catalog', error)).toMatchObject({ stage: 'catalog', code: 'UNKNOWN' });
    expect(JSON.stringify(startupFailure('catalog', error))).not.toContain('private-secret');
  },
);
