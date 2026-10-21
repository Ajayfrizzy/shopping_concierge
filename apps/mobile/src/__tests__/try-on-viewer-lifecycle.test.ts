import { createElement as h, useEffect, useRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { VtoJob } from '@youcam/shared';
const fixture = vi.hoisted(() => ({
  requests: [] as { uri: string; authenticated: boolean }[],
  listeners: new Set<(state: string) => void>(),
}));
vi.mock('react-native', () => ({
  Image: (props: {
    source?: { uri: string } | { uri: string; headers?: Record<string, string> }[];
    onError: () => void;
    onLoad?: () => void;
    accessibilityLabel: string;
  }) => {
    const headers = useRef<Record<string, string>>({});
    const value = Array.isArray(props.source) ? props.source[0] : props.source;
    // Faithful RN 0.86 Android behavior: null/absent headers do not clear native headers.
    if (Array.isArray(props.source) && props.source[0]?.headers != null)
      headers.current = props.source[0].headers;
    const authenticated = !!headers.current.Authorization;
    useEffect(() => {
      if (!value) return;
      fixture.requests.push({ uri: value.uri, authenticated });
      if (value.uri === 'https://provider.test/output' && authenticated) props.onError();
    }, [value?.uri, authenticated]);
    return h('image', { ...props, nativeHeaders: headers.current });
  },
  Modal: ({ visible, children, ...p }: { visible: boolean; children: React.ReactNode }) =>
    visible ? h('modal', p, children) : null,
  Pressable: 'pressable',
  ScrollView: 'scroll',
  Text: 'text',
  View: 'view',
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  AppState: {
    addEventListener: (_: string, cb: (s: string) => void) => {
      fixture.listeners.add(cb);
      return { remove: () => fixture.listeners.delete(cb) };
    },
  },
}));
vi.mock('../ui', () => ({ styles: {}, Button: (p: { title: string }) => h('button', p, p.title) }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'safe' }));
import { TryOnViewer } from '../try-on-viewer';
const job: VtoJob = {
  id: 'job',
  sessionId: 'session',
  assetId: 'portrait',
  productId: 'E01',
  category: 'earrings',
  mode: 'live',
  status: 'completed',
  createdAt: 1,
  updatedAt: 1,
  error: null,
  result: { kind: 'image', url: 'https://provider.test/output', expiresAt: Date.now() + 3600000 },
};
let view: ReactTestRenderer;
const original = vi.fn(async () => [
  { uri: 'https://api.test/original', headers: { Authorization: 'Bearer fixture' } },
]);
async function mount(j = job) {
  await act(async () => {
    view = create(h(TryOnViewer, { job: j, original }));
  });
}
async function tap(title: string) {
  await act(async () => {
    view.root
      .findAllByType('button')
      .find((x) => x.props.title === title)!
      .props.onPress();
  });
}
const alerts = () => view.root.findAllByProps({ accessibilityRole: 'alert' });
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fixture.requests.length = 0;
  original.mockClear();
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  vi.useRealTimers();
});
it('loads initial VTO and isolates original authentication over repeated switches and zoom', async () => {
  await mount();
  await tap('Expand and compare photos');
  for (let i = 0; i < 3; i++) {
    await tap('Original');
    expect(fixture.requests.some((r) => r.uri.includes('/original') && r.authenticated)).toBe(true);
    await tap('Virtual try-on');
    await tap('Zoom in');
    await tap('Fit image');
    expect(alerts()).toHaveLength(0);
  }
  expect(
    fixture.requests.filter((r) => r.uri.includes('/output')).every((r) => !r.authenticated),
  ).toBe(true);
  expect(job.status).toBe('completed');
  expect(job.sessionId).toBe('session');
});
it('collapse, Android Back, navigation and reopening never reuse original native headers', async () => {
  await mount();
  await tap('Expand and compare photos');
  await tap('Original');
  await act(async () => view.root.findByType('modal').props.onRequestClose());
  await tap('Expand and compare photos');
  expect(alerts()).toHaveLength(0);
  await tap('Back to try-on');
  await act(async () => view.unmount());
  await mount();
  await tap('Expand and compare photos');
  expect(
    fixture.requests.filter((r) => r.uri.includes('/output')).every((r) => !r.authenticated),
  ).toBe(true);
});
it('a genuine image error clears only after that image loads successfully', async () => {
  await mount();
  const image = view.root.findByType('image');
  await act(async () => image.props.onError());
  expect(alerts()).toHaveLength(1);
  await act(async () => image.props.onLoad());
  expect(alerts()).toHaveLength(0);
});
it('failed original access cannot poison the result or trigger a provider operation', async () => {
  original.mockRejectedValueOnce(new Error('unavailable'));
  await mount();
  await tap('Expand and compare photos');
  await tap('Original');
  expect(alerts().length).toBeGreaterThan(0);
  await tap('Virtual try-on');
  expect(alerts()).toHaveLength(0);
  expect(fixture.requests.every((r) => r.uri === 'https://provider.test/output')).toBe(true);
});
it('foreground checks expiry and removes expired output without attempting renewal or submission', async () => {
  vi.useFakeTimers();
  await mount();
  const count = fixture.requests.length;
  await act(async () => {
    vi.setSystemTime(Date.now() + 7200000);
    fixture.listeners.forEach((f) => f('active'));
  });
  expect(view.root.findAllByType('image')).toHaveLength(0);
  expect(fixture.requests).toHaveLength(count);
  expect(JSON.stringify(view.toJSON())).toContain('expired');
});
it('background and foreground before expiry retain the result and session without network operations', async () => {
  await mount();
  const count = fixture.requests.length;
  await act(async () => {
    fixture.listeners.forEach((f) => f('background'));
    fixture.listeners.forEach((f) => f('active'));
  });
  expect(fixture.requests).toHaveLength(count);
  expect(original).not.toHaveBeenCalled();
});
