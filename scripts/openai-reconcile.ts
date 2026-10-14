/** Operator-only recovery from an existing private usage receipt. Never invokes a provider. */
import { z } from 'zod';
import { postgresPool } from '../apps/api/src/persistence/postgres.js';
import { persistenceConfig } from '../apps/api/src/persistence/config.js';
import { createS3ObjectStore } from '../apps/api/src/persistence/objects.js';
import { accountingConfig } from '../apps/api/src/accounting/config.js';
import { RuntimeLedger } from '../apps/api/src/accounting/postgres.js';
import { parseReceipt, receiptKey } from '../apps/api/src/accounting/receipts.js';
async function main() {
  const id = z.string().uuid().parse(process.argv[2]);
  if (process.argv.slice(3).some((a) => a !== '--apply')) throw new Error();
  const c = persistenceConfig({
    ...process.env,
    PERSISTENCE_MODE: 'postgres',
    OBJECT_STORAGE_MODE: 's3',
  });
  const pool = postgresPool(c.databaseUrl!, c.databaseSslVerification, 'accounting');
  const objects = createS3ObjectStore(c.s3!);
  try {
    const raw = JSON.parse(
      Buffer.from(await objects.get(receiptKey(c.s3?.assetPrefix ?? '', id))).toString('utf8'),
    );
    const usage = parseReceipt(raw, id);
    const row = (
      await pool.query(
        "SELECT id,committed_at FROM runtime_usage WHERE provider='openai' AND id=$1",
        [id],
      )
    ).rows[0];
    if (!row) throw new Error();
    if (process.argv.includes('--apply')) {
      const ledger = new RuntimeLedger(pool, 'openai', accountingConfig(process.env).openai);
      await ledger.initialize();
      await ledger.commitAttempt(id, usage);
    }
    console.log(
      JSON.stringify({
        reservationId: id,
        usage,
        action: process.argv.includes('--apply') ? 'settled idempotently' : 'preview only',
        previouslySettled: !!row.committed_at,
      }),
    );
  } finally {
    objects.close();
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Reconciliation failed. Check receipt, reservation, budget configuration and access. No provider request was made.',
  );
  process.exitCode = 1;
});
