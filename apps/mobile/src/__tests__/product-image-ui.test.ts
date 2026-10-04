import { createRequire } from 'node:module';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
const { renderToStaticMarkup } = createRequire(`${process.cwd()}/package.json`)(
  'react-dom/server',
) as {
  renderToStaticMarkup: (element: ReactElement) => string;
};
vi.mock('../catalog-assets', () => ({
  catalogAssets: { 'catalog://demo/E01.png': 1 },
}));
vi.mock('react-native', () => {
  const host =
    (name: string) =>
    (p: {
      children?: ReactNode;
      style?: unknown;
      resizeMode?: string;
      accessibilityLabel?: string;
    }) =>
      createElement(
        'div',
        {
          'data-native': name,
          'data-style': JSON.stringify(p.style),
          'data-resize': p.resizeMode,
          'aria-label': p.accessibilityLabel,
        },
        p.children,
      );
  return {
    Image: host('Image'),
    View: host('View'),
    Text: host('Text'),
    ActivityIndicator: host('ActivityIndicator'),
    Pressable: host('Pressable'),
    StyleSheet: {
      create: (s: unknown) => s,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    },
  };
});
import { ProductImage } from '../product-image';
describe('catalog native image presentation contracts', () => {
  it('overrides intrinsic bundled dimensions inside a reserved square frame', () => {
    const markup = renderToStaticMarkup(
      createElement(ProductImage, { url: 'catalog://demo/E01.png', name: 'Earrings' }),
    );
    expect(markup).toContain('data-resize="contain"');
    expect(markup).toContain(
      '&quot;width&quot;:&quot;100%&quot;,&quot;height&quot;:&quot;100%&quot;',
    );
    expect(markup).toContain('&quot;aspectRatio&quot;:1');
    expect(markup).toContain('Loading image for Earrings');
  });
  it('reserves a 112px thumbnail even when the source is missing', () => {
    const markup = renderToStaticMarkup(
      createElement(ProductImage, { name: 'Earrings', compact: true }),
    );
    expect(markup).toContain('&quot;width&quot;:112,&quot;height&quot;:112');
    expect(markup).toContain('No catalog image');
    expect(markup).not.toContain('data-native="Image"');
    expect(markup).not.toContain('data-native="ActivityIndicator"');
  });
});
