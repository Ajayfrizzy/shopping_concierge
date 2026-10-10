import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
import { foundationResponseSchema, healthSchema } from '@youcam/shared';
import { MockLLMService, MockYouCamService } from '@youcam/testing';

const apps: ReturnType<typeof buildApp>[] = [];
function app(options: Parameters<typeof buildApp>[0] = {}) {
  const instance = buildApp(options);
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
  vi.useRealTimers();
});
describe('foundation API', () => {
  it('serves a validated health response without credentials', async () => {
    const response = await app().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(healthSchema.parse(response.json())).toEqual({
      status: 'ok',
      service: 'youcam-api',
    });
  });
  it('wires both mock providers', async () => {
    const instance = app();
    const providers = instance.getDecorator<{ llm: MockLLMService; youcam: MockYouCamService }>(
      'providers',
    );
    expect(providers.llm.mode).toBe('mock');
    expect(await providers.youcam.checkConnection()).toEqual({
      ok: true,
      data: { mode: 'mock', available: true },
    });
  });
  it('returns an honest foundation response, with no invented recommendations', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/v1/foundation/messages',
      payload: { message: 'Silver earrings under $120' },
    });
    expect(response.statusCode).toBe(200);
    const body = foundationResponseSchema.parse(response.json());
    expect(body.readyForShopping).toBe(false);
    expect(body.message).toContain('not available yet');
  });
  it.each([
    {},
    { message: '' },
    { message: '   ' },
    { message: 123 },
    { message: 'a'.repeat(2001) },
    { message: 'hello', state: { selected: ['fake'] } },
  ])('rejects invalid input before calling a provider: %j', async (payload) => {
    const llm = new MockLLMService();
    const spy = vi.spyOn(llm, 'respond');
    const response = await app({ llm }).inject({
      method: 'POST',
      url: '/v1/foundation/messages',
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
  it('returns a recoverable normalized provider failure', async () => {
    const response = await app({ llm: new MockLLMService({ fail: true }) }).inject({
      method: 'POST',
      url: '/v1/foundation/messages',
      payload: { message: 'Hello' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'MOCK_FAILURE', recoverable: true } });
  });
  it('rejects oversized bodies', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/v1/foundation/messages',
      payload: { message: 'x'.repeat(17000) },
    });
    expect(response.statusCode).toBe(413);
  });
});
describe('mock fixtures', () => {
  it('supports controlled latency without live calls', async () => {
    vi.useFakeTimers();
    let complete = false;
    const pending = new MockLLMService({ latencyMs: 250 }).respond().then((result) => {
      complete = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(249);
    expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).ok).toBe(true);
  });
  it('normalizes visual service failure without claiming a VTO result', async () => {
    const result = await new MockYouCamService({ fail: true }).checkConnection();
    expect(result).toMatchObject({ ok: false, error: { code: 'MOCK_FAILURE', recoverable: true } });
    expect(result).not.toHaveProperty('outputUrl');
  });
});
describe('server configuration', () => {
  it('defaults to mock services and loopback', () => {
    expect(readConfig({})).toEqual({ port: 4000, host: '127.0.0.1' });
  });
  it('uses the platform port ahead of the API fallback in production', () => {
    expect(readConfig({ NODE_ENV: 'production', PORT: '8080', API_PORT: '4000' })).toEqual({
      port: 8080,
      host: '0.0.0.0',
    });
    expect(readConfig({ NODE_ENV: 'production', API_PORT: '5000' }).port).toBe(5000);
    expect(readConfig({ NODE_ENV: 'production' }).port).toBe(4000);
    expect(readConfig({ NODE_ENV: 'production', API_HOST: '127.0.0.1' }).host).toBe('127.0.0.1');
  });
  it.each(['', '0', '-1', '65536', '4000.5', 'oops'])(
    'rejects an invalid platform port without silently falling back: %s',
    (port) => {
      expect(() => readConfig({ PORT: port, API_PORT: '4000' })).toThrow('PORT');
    },
  );
  it.each(['USE_MOCK_LLM', 'USE_MOCK_YOUCAM'])(
    'fails closed for unsupported live mode: %s',
    (key) => {
      expect(() => readConfig({ [key]: 'false' })).toThrow();
    },
  );
  it.each(['0', '-1', '65536', '4000.5', 'oops'])('rejects invalid port %s', (port) => {
    expect(() => readConfig({ API_PORT: port })).toThrow('API_PORT');
  });
});
