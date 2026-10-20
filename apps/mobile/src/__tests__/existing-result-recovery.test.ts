import { createRequire } from 'node:module';
import { createElement, type ReactElement } from 'react';
import { expect, it, vi } from 'vitest';
import type { VtoJob } from '@youcam/shared';
const { renderToStaticMarkup } = createRequire(`${process.cwd()}/package.json`)(
  'react-dom/server',
) as { renderToStaticMarkup(e: ReactElement): string };
vi.mock('../ui', () => ({
  Button: ({ title, disabled }: { title: string; disabled: boolean }) =>
    createElement('button', { disabled }, title),
}));
import { ExistingResultRecovery } from '../existing-result-recovery';
const job = {
  id: 'job',
  sessionId: 'owned',
  productId: 'E01',
  assetId: 'portrait',
  category: 'earrings',
  mode: 'live',
  status: 'failed',
  error: { code: 'PROVIDER_TIMEOUT', message: 'Timeout', recoverable: true },
  result: null,
  createdAt: 1,
  updatedAt: 2,
} as VtoJob;
const render = (j: VtoJob | null, busy = false) =>
  renderToStaticMarkup(
    createElement(ExistingResultRecovery, {
      job: j,
      sessionId: 'owned',
      productId: 'E01',
      busy,
      onPress: vi.fn(),
    }),
  );
it('shows the explicit recovery action only for the eligible owned timeout', () => {
  expect(render(job)).toContain('Check existing YouCam result');
  expect(render(job, true)).toContain('disabled');
});
it.each([
  null,
  { ...job, sessionId: 'other' },
  { ...job, productId: 'N01' },
  { ...job, mode: 'mock' },
  { ...job, status: 'completed' },
  { ...job, error: { ...job.error, code: 'RENDER_FAILED' } },
])('hides recovery for ineligible jobs', (j) => {
  expect(render(j as VtoJob | null)).toBe('');
});
