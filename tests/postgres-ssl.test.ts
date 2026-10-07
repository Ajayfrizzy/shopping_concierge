import { describe, expect, it } from 'vitest';
import { postgresConnectionOptions } from '../apps/api/src/persistence/postgres-ssl.js';
import { postgresPool } from '../apps/api/src/persistence/postgres.js';
const url = 'postgresql://demo:example@localhost/test?sslmode=require';
describe('database-only explicit encrypted TLS configuration', () => {
  it('keeps default/verified connection options untouched', () => {
    for (const connectionString of [
      'postgresql://localhost/test',
      url,
      url.replace('require', 'verify-full'),
    ])
      expect(postgresConnectionOptions(connectionString)).toEqual({ connectionString });
  });
  it.each(['true', 'false'])(
    'honors explicit verification=%s without URL override',
    async (verification) => {
      const options = postgresConnectionOptions(url, verification);
      expect(new URL(options.connectionString!).searchParams.has('sslmode')).toBe(false);
      expect(options.ssl).toEqual({ rejectUnauthorized: verification === 'true' });
      const pool = postgresPool(url, verification);
      expect(pool.options.ssl).toEqual(options.ssl);
      await pool.end();
    },
  );
  it.each([
    'postgresql://localhost/test',
    'postgresql://localhost/test?sslmode=disable',
    'postgresql://localhost/test?sslmode=verify-full',
    url + '&ssl=true',
    url + '&sslrootcert=ca.pem',
    url + '&uselibpqcompat=true',
  ])('refuses conflicting or unencrypted override %s', (value) => {
    expect(() => postgresConnectionOptions(value, 'false')).toThrow();
  });
  it('rejects malformed configuration without leaking the connection string', () => {
    expect(() => postgresConnectionOptions(url, 'off')).toThrow(
      'DATABASE_SSL_REJECT_UNAUTHORIZED must be true or false',
    );
    expect(() => postgresConnectionOptions('credential-secret', 'false')).toThrow(
      'Invalid PostgreSQL connection URL',
    );
  });
  it('does not change process TLS settings', () => {
    const before = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    postgresConnectionOptions(url, 'false');
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(before);
  });
});
