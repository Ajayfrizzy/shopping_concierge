import type { PoolConfig } from 'pg';

/** Explicit database-only TLS override. Never changes process/global TLS behavior. */
export function postgresConnectionOptions(
  connectionString: string,
  verification?: string,
): PoolConfig {
  if (verification === undefined) return { connectionString };
  if (!['true', 'false'].includes(verification))
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED must be true or false.');
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid PostgreSQL connection URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.searchParams.get('sslmode') !== 'require'
  )
    throw new Error(
      'Explicit DATABASE_SSL_REJECT_UNAUTHORIZED requires PostgreSQL sslmode=require.',
    );
  // pg reparses URL SSL parameters and would replace the explicit ssl object.
  // CA/client-certificate users should omit this override and use their verified URL configuration.
  if (
    ['ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].some((key) =>
      url.searchParams.has(key),
    )
  )
    throw new Error('Do not combine the database TLS override with other URL SSL options.');
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: verification === 'true' } };
}
