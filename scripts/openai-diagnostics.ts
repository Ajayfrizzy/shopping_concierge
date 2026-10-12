/** Operator-only PostgreSQL read; never invokes a provider. */
import { postgresPool } from '../apps/api/src/persistence/postgres.js';
import { PostgresDiagnosticStore } from '../apps/api/src/llm/diagnostic-store.js';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error();
  const args = process.argv.slice(2);
  const filter: { sessionId?: string; clientRequestId?: string; limit?: number } = {};
  while (args.length) {
    const flag = args.shift(),
      value = args.shift();
    if (!value) throw new Error();
    if (flag === '--session') filter.sessionId = value;
    else if (flag === '--request') filter.clientRequestId = value;
    else if (flag === '--limit') filter.limit = Number(value);
    else throw new Error();
  }
  const pool = postgresPool(process.env.DATABASE_URL, process.env.DATABASE_SSL_REJECT_UNAUTHORIZED);
  try {
    console.log(JSON.stringify(await new PostgresDiagnosticStore(pool).list(filter), null, 2));
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Diagnostic query failed. Check database access, migration 007 and --session/--request/--limit arguments.',
  );
  process.exitCode = 1;
});
