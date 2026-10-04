import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { fixtureProducts } from '../fixtures/catalog.ts';
import { productSchema } from '@youcam/shared';
import { imageStatus, productImageSource } from '../apps/mobile/src/product-image-state.ts';
const manifest = readFileSync('apps/mobile/src/catalog-assets.ts', 'utf8');
describe('catalog demo image completeness and portability', () => {
  it.each(fixtureProducts)(
    '$id has a decodable square bundled illustration and source artwork',
    async (p) => {
      expect(productSchema.parse(p)).toEqual(p);
      expect(p.imageUrl).toBe(`catalog://demo/${p.id}.png`);
      expect(manifest).toContain(`'${p.imageUrl}': require('../assets/catalog/${p.id}.png')`);
      expect(existsSync(`apps/mobile/assets/catalog/${p.id}.svg`)).toBe(true);
      const image = sharp(`apps/mobile/assets/catalog/${p.id}.png`);
      expect(await image.metadata()).toMatchObject({ width: 512, height: 512, format: 'png' });
      const stats = await image.stats();
      expect(stats.channels[0]!.max - stats.channels[0]!.min).toBeGreaterThan(50);
      expect(p.vtoAssetUrl).toBeNull();
    },
  );
  it('covers all four categories without fetching retailer assets', () => {
    for (const c of ['earrings', 'necklaces', 'rings', 'watches'])
      expect(fixtureProducts.filter((p) => p.category === c)).toHaveLength(18);
    expect(readFileSync('scripts/generate-catalog-art.mts', 'utf8')).not.toMatch(
      /fetch\(|https:\/\//,
    );
  });
});
describe('image resolution and native lifecycle', () => {
  const assets = { 'catalog://demo/E01.png': 1 };
  it('resolves current and legacy persisted fixture sources to the same offline asset', () => {
    expect(productImageSource('catalog://demo/E01.png', assets)).toBe(1);
    expect(productImageSource('https://fixtures.invalid/catalog/E01.png', assets)).toBe(1);
  });
  it.each([
    undefined,
    '',
    'broken',
    'file:///secret',
    'content://photo',
    'data:image/png;base64,abc',
    'catalog://demo/unknown.png',
    'https://fixtures.invalid/catalog/unknown.png',
    'https://fixtures.invalid/catalog/E01.png?other=1',
  ])('fails safely for missing or unsupported source %s', (url) => {
    expect(productImageSource(url, assets)).toBeUndefined();
  });
  it('loads an explicit HTTPS source without treating it as VTO output', () => {
    expect(productImageSource('https://approved.example/demo.png', assets)).toEqual({
      uri: 'https://approved.example/demo.png',
    });
  });
  it('tracks loading success and holds failure despite late native load callback', () => {
    expect(imageStatus('loading', 'load')).toBe('loaded');
    expect(imageStatus('loading', 'error')).toBe('failed');
    expect(imageStatus('failed', 'load')).toBe('failed');
    expect(imageStatus('loaded', 'error')).toBe('failed');
  });
});
