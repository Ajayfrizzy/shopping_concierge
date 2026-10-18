import { createRequire } from 'node:module';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import type { VtoJob } from '@youcam/shared';
const { renderToStaticMarkup } = createRequire(`${process.cwd()}/package.json`)(
  'react-dom/server',
) as { renderToStaticMarkup(element: ReactElement): string };
vi.mock('react-native', () => {
  const host =
    (name: string) =>
    (p: {
      children?: ReactNode;
      accessibilityLabel?: string;
      source?: unknown;
      resizeMode?: string;
    }) =>
      createElement(
        'div',
        {
          'data-native': name,
          'aria-label': p.accessibilityLabel,
          'data-source': JSON.stringify(p.source),
          'data-resize': p.resizeMode,
        },
        p.children,
      );
  return {
    Image: host('Image'),
    Modal: host('Modal'),
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    Text: host('Text'),
    View: host('View'),
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    StyleSheet: { create: (x: unknown) => x },
  };
});
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => createElement('main', {}, children),
}));
import { TryOnViewer } from '../try-on-viewer';
const base: VtoJob = {
  id: 'job',
  sessionId: 'session',
  productId: 'E01',
  assetId: 'asset',
  category: 'earrings',
  mode: 'live',
  status: 'completed',
  createdAt: 0,
  updatedAt: 0,
  result: {
    kind: 'image',
    url: 'https://example.test/genuine-output',
    expiresAt: Date.now() + 60000,
  },
  error: null,
};
it('offers expansion, labeled comparison, full-image fit, accessible zoom and a return control', () => {
  const html = renderToStaticMarkup(
    createElement(TryOnViewer, { job: base, original: async () => ({ uri: 'private-original' }) }),
  );
  for (const text of [
    'Expand virtual try-on image',
    'Original',
    'Virtual try-on',
    'Zoom in',
    'Zoom out',
    'Fit image',
    'Back to try-on',
    'Digital zoom does not add image detail',
  ])
    expect(html).toContain(text);
  expect(html).toContain('data-resize="contain"');
  expect(html).toContain('https://example.test/genuine-output');
  expect(html).not.toContain('private-original');
});
it('expired output is not loaded and never offers an automatic render', () => {
  const html = renderToStaticMarkup(
    createElement(TryOnViewer, {
      job: {
        ...base,
        result: { kind: 'image', url: 'https://example.test/expired', expiresAt: 1 },
      },
      original: async () => ({ uri: 'original' }),
    }),
  );
  expect(html).toContain('expired');
  expect(html).not.toContain('https://example.test/expired');
  expect(html).not.toContain('data-native="Image"');
});
it('mock completion never invents an image or a before/after result', () => {
  const html = renderToStaticMarkup(
    createElement(TryOnViewer, {
      job: {
        ...base,
        mode: 'mock',
        result: {
          kind: 'mock',
          message: 'Mock try-on completed. No visual rendering was generated.',
        },
      },
      original: async () => ({ uri: 'original' }),
    }),
  );
  expect(html).toContain('No visual rendering was generated');
  expect(html).not.toContain('data-native="Image"');
  expect(html).not.toContain('Expand');
});
