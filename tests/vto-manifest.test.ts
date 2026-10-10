import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureProducts } from '../fixtures/catalog.ts';
import {
  parseJudgeAssets,
  registrationCandidates,
  resolveAssetKey,
} from '../apps/api/src/youcam/asset-manifest.js';
const raw = () => JSON.parse(readFileSync('fixtures/vto/judge-assets.json', 'utf8'));
describe('curated VTO manifest', () => {
  it('contains 12 catalog-grounded products, three per category, and eight uploaded/ineligible assets', () => {
    const m = parseJudgeAssets(raw(), fixtureProducts);
    expect(m.assets).toHaveLength(12);
    const missing = m.assets.filter((a) => a.status === 'uploaded');
    expect(missing.map((a) => a.productId)).toEqual([
      'E01',
      'E12',
      'N01',
      'N12',
      'R01',
      'R08',
      'W11',
      'W08',
    ]);
    for (const a of missing) {
      expect(fixtureProducts.find((p) => p.id === a.productId)?.vtoEligible).toBe(false);
      expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(a.objectKey).toContain(a.assetPath);
    }
    expect(fixtureProducts).toHaveLength(72);
  });
  it('preserves the four historical registration candidates', () => {
    const selected = registrationCandidates(parseJudgeAssets(raw(), fixtureProducts));
    expect(selected.map((a) => a.productId)).toEqual(['E03', 'N03', 'R03', 'W03']);
    expect(selected.map((a) => a.filename)).toEqual([
      'earring01-9493d1.png',
      'necklace01-9444a6.png',
      'ring01-5d89c0.png',
      'watch01-c7069f.png',
    ]);
  });
  it('supports later upload and validation without enabling uploaded-only assets', () => {
    const m = raw();
    const a = m.assets.find((x: { status: string }) => x.status === 'uploaded');
    a.status = 'uploaded';
    a.sha256 = 'a'.repeat(64);
    expect(registrationCandidates(parseJudgeAssets(m, fixtureProducts))).toHaveLength(4);
    a.status = 'validated';
    a.evidence = null;
    expect(() => parseJudgeAssets(m, fixtureProducts)).toThrow();
    a.evidence = 'Reviewed uploaded bytes and matching product appearance';
    expect(registrationCandidates(parseJudgeAssets(m, fixtureProducts))).toHaveLength(5);
  });
  it.each(['traversal', 'duplicate', 'category', 'name', 'false-evidence'])(
    'rejects invalid manifest %s',
    (kind) => {
      const m = raw();
      const a = m.assets[1];
      if (kind === 'traversal') a.assetPath = '../wrong.png';
      if (kind === 'duplicate') a.productId = m.assets[0].productId;
      if (kind === 'category') a.category = 'rings';
      if (kind === 'name') a.catalogName = 'Invented product';
      if (kind === 'false-evidence') {
        a.status = 'missing';
        a.sha256 = 'a'.repeat(64);
      }
      expect(() => parseJudgeAssets(m, fixtureProducts)).toThrow();
    },
  );
});

it('retains visually corrected mappings and refuses a different backend object prefix', () => {
  const m = parseJudgeAssets(raw(), fixtureProducts);
  for (const [id, starts] of [
    ['E01', 'e12-'],
    ['E12', 'e12-'],
    ['W08', 'w11-'],
    ['W11', 'w11-'],
  ]) {
    const a = m.assets.find((a) => a.productId === id)!;
    expect(a.filename.startsWith(starts!)).toBe(true);
    const prefix = a.objectKey!.slice(0, -a.assetPath.length);
    expect(resolveAssetKey(a, prefix)).toBe(a.objectKey);
    expect(() => resolveAssetKey(a, 'wrong/')).toThrow('prefix');
  }
});
