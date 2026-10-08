/** Only fixed diagnostics are logged: driver messages can contain credentials or catalog data. */
export function startupFailure(stage: 'catalog' | 'listen', error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const reasons: Record<string, string> = {
    CATALOG_EMPTY:
      'Catalog is empty. Run the explicit migration command with --seed-fixtures against the deployment database.',
    '42P01': 'Required database table is missing. Apply migrations to the deployment database.',
    '42501': 'Database role lacks permission to read the catalog.',
    '28P01': 'Database authentication failed. Check the injected database credentials.',
    ECONNREFUSED: 'Database connection refused. Check database availability and network access.',
    ETIMEDOUT: 'Database connection timed out. Check network access.',
    ENOTFOUND: 'Configured hostname could not be resolved.',
    DEPTH_ZERO_SELF_SIGNED_CERT:
      'Database TLS certificate is not trusted. Check database-only TLS configuration.',
    EADDRINUSE: 'Configured listening port is already in use.',
    EADDRNOTAVAIL: 'Configured API_HOST is unavailable. Hosted containers should bind to 0.0.0.0.',
    EACCES: 'Permission denied while binding the listening address.',
  };
  const safeCode = typeof code === 'string' && Object.hasOwn(reasons, code) ? code : 'UNKNOWN';
  return {
    stage,
    code: safeCode,
    message:
      reasons[safeCode] ??
      (stage === 'catalog'
        ? 'Catalog loading failed. Check database connectivity, migrations and stored product schema.'
        : 'HTTP listener failed. Check API_HOST and the platform-injected PORT.'),
  };
}
