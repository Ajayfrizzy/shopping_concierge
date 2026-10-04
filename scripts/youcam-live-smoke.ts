/** Explicit operator-run smoke only. Never imported by tests/server and never retries task creation. */
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { categorySchema, assetSchema } from '@youcam/shared';
import { youcamProvider } from '../apps/api/src/youcam/config.js';
import { requiredImage } from '../apps/api/src/youcam/provider.js';
if (process.env.RUN_YOUCAM_LIVE_SMOKE !== 'one-render')
  throw new Error('Set RUN_YOUCAM_LIVE_SMOKE=one-render only for an authorized one-render smoke.');
const category = categorySchema.parse(process.env.YOUCAM_SMOKE_CATEGORY);
const file = process.env.YOUCAM_SMOKE_IMAGE,
  productAssetUrl = process.env.YOUCAM_SMOKE_PRODUCT_ASSET_URL;
if (!file || !productAssetUrl)
  throw new Error('Provide an approved local image and matching catalog product asset URL.');
const bytes = await readFile(file);
if (bytes.length > 4_194_304) throw new Error('Image exceeds 4 MiB.');
const decoder = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' });
const metadata = await decoder.metadata();
await decoder.raw().toBuffer();
if (metadata.format !== 'jpeg' && metadata.format !== 'png') throw new Error('Use PNG/JPEG.');
const provider = youcamProvider(process.env, (event) => console.info(JSON.stringify(event)));
if (provider.mode !== 'live') throw new Error('Explicit live provider configuration required.');
const task = await provider.start({
  category,
  bytes,
  productAssetUrl,
  asset: assetSchema.parse({
    id: randomUUID(),
    sessionId: randomUUID(),
    type: requiredImage[category],
    mimeType: metadata.format === 'jpeg' ? 'image/jpeg' : 'image/png',
    byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }),
});
for (let i = 0; i < 20; i++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const result = await provider.poll(category, task);
  if (result.status !== 'processing') {
    console.info(
      JSON.stringify({
        status: result.status,
        category,
        ...(result.status === 'failed' ? { error: result.error } : {}),
      }),
    );
    if (result.status !== 'completed') process.exitCode = 1;
    break;
  }
  if (i === 19)
    throw new Error(
      'Polling deadline reached. Do not automatically rerun this script; task may still complete.',
    );
}
