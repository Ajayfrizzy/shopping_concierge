import { z } from 'zod';
import { categorySchema, type Product } from '@youcam/shared';
const assetSchema = z
  .object({
    productId: z.string().min(1),
    category: categorySchema,
    catalogName: z.string().min(1),
    filename: z.string().regex(/^[a-zA-Z0-9-]+\.png$/),
    assetPath: z.string(),
    objectKey: z.string().optional(),
    status: z.enum(['missing', 'uploaded', 'validated']),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    evidence: z.string().nullable(),
    rationale: z.string().min(1),
    requirements: z.array(z.string().min(1)).min(1),
  })
  .strict();
export const judgeAssetManifestSchema = z
  .object({
    version: z.literal(2),
    objectKeyRule: z.literal('S3_ASSET_PREFIX + assetPath'),
    assets: z.array(assetSchema).length(12),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    for (const field of ['productId', 'assetPath'] as const)
      if (new Set(manifest.assets.map((a) => a[field])).size !== 12)
        ctx.addIssue({ code: 'custom', message: `Duplicate ${field}` });
    for (const category of categorySchema.options)
      if (manifest.assets.filter((a) => a.category === category).length !== 3)
        ctx.addIssue({ code: 'custom', message: `Expected three ${category}` });
    for (const a of manifest.assets) {
      if (a.assetPath !== `vto-products/${a.category}/${a.filename}`)
        ctx.addIssue({ code: 'custom', message: 'Asset path/category/filename mismatch' });
      if (
        a.objectKey &&
        ((!a.objectKey.endsWith('/' + a.assetPath) && a.objectKey !== a.assetPath) ||
          a.objectKey.split('/').some((p) => p === '..' || p === '.'))
      )
        ctx.addIssue({ code: 'custom', message: 'Exact object key does not match asset path' });
      if (a.status === 'validated' && (!a.sha256 || !a.evidence?.trim()))
        ctx.addIssue({
          code: 'custom',
          message: 'Validated assets require hash and review evidence',
        });
      if (a.status === 'missing' && (a.sha256 !== null || a.evidence !== null))
        ctx.addIssue({
          code: 'custom',
          message: 'Missing assets cannot claim byte or approval evidence',
        });
    }
  });
export function parseJudgeAssets(raw: unknown, products: readonly Product[]) {
  const manifest = judgeAssetManifestSchema.parse(raw);
  for (const asset of manifest.assets) {
    const product = products.find((p) => p.id === asset.productId);
    if (!product || product.category !== asset.category || product.name !== asset.catalogName)
      throw new Error('Manifest does not match catalog metadata');
  }
  return manifest;
}
export function registrationCandidates(manifest: z.infer<typeof judgeAssetManifestSchema>) {
  return judgeAssetManifestSchema.parse(manifest).assets.filter((a) => a.status === 'validated');
}

export function resolveAssetKey(asset: z.infer<typeof assetSchema>, prefix: string) {
  const expected = prefix + asset.assetPath;
  if (asset.objectKey && asset.objectKey !== expected)
    throw new Error('Configured S3 prefix differs from inspected object key');
  return asset.objectKey ?? expected;
}
