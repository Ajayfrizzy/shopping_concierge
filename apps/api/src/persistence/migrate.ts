import { migrate, postgresPool, seedFixtures } from './postgres.js';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');
const pool = postgresPool(url, process.env.DATABASE_SSL_REJECT_UNAUTHORIZED);
try {
  await migrate(pool);
  if (process.argv.includes('--seed-fixtures')) await seedFixtures(pool);
  console.log('PostgreSQL migration complete.');
} catch {
  console.error('Migration failed. Check server-side configuration and database availability.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
