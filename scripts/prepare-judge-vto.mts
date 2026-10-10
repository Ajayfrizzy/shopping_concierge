/** Read-only by default. Explicit --apply updates eligibility only after asset integrity validation.
 * Run against a backend version that supports vtoEligible; legacy strict schemas reject it.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  parseJudgeAssets,
  registrationCandidates,
  resolveAssetKey,
} from '../apps/api/src/youcam/asset-manifest.js';
import { fixtureProducts } from '../fixtures/catalog.ts';
import { persistenceConfig } from '../apps/api/src/persistence/config.js';
import { postgresPool } from '../apps/api/src/persistence/postgres.js';
import { createS3ObjectStore } from '../apps/api/src/persistence/objects.js';
const manifest = parseJudgeAssets(
  JSON.parse(await readFile('fixtures/vto/judge-assets.json', 'utf8')),
  fixtureProducts,
);
const config = persistenceConfig({
  ...process.env,
  PERSISTENCE_MODE: 'postgres',
  OBJECT_STORAGE_MODE: 's3',
});
const pool = postgresPool(config.databaseUrl!, config.databaseSslVerification);
const objects = createS3ObjectStore(config.s3!);
try {
  const approved = [];
  for (const asset of registrationCandidates(manifest)) {
    if (
      !asset.assetPath.startsWith(`vto-products/${asset.category}/`) ||
      asset.assetPath.includes('..')
    )
      throw new Error('Invalid asset path');
    const key = resolveAssetKey(asset, config.s3!.assetPrefix ?? '');
    const bytes = await objects.get(key);
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
      throw new Error('Approved asset integrity changed');
    const row = (await pool.query('SELECT product FROM products WHERE id=$1', [asset.productId]))
      .rows[0];
    if (row?.product.category !== asset.category || row.product.name !== asset.catalogName)
      throw new Error('Catalog category mismatch');
    approved.push({ ...asset, key });
  }
  if (process.argv.includes('--apply')) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const asset of approved) {
        await db.query(
          'INSERT INTO product_vto_assets(product_id,object_key,sha256) VALUES($1,$2,$3) ON CONFLICT(product_id) DO UPDATE SET object_key=excluded.object_key,sha256=excluded.sha256,approved_at=now()',
          [asset.productId, asset.key, asset.sha256],
        );
        await db.query(
          "UPDATE products SET product=jsonb_set(jsonb_set(product,'{vtoEligible}','true'),'{vtoAssetUrl}','null') WHERE id=$1",
          [asset.productId],
        );
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  console.log(
    JSON.stringify({
      applied: process.argv.includes('--apply'),
      approved: approved.map((a) => a.productId),
      pending: manifest.assets
        .filter((a) => a.status !== 'validated')
        .map((a) => ({ productId: a.productId, status: a.status })),
    }),
  );
} catch {
  console.error(
    'Judge VTO preparation failed. Check manifest, approved assets, database schema and access. No raw credentials or URLs logged.',
  );
  process.exitCode = 1;
} finally {
  objects.close();
  await pool.end();
}
