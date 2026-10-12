import { expect, it } from 'vitest';
import { startupFailure } from '../apps/api/src/startup.js';
it('identifies empty catalog and gives explicit seed guidance', () => {
  expect(startupFailure('catalog', { code: 'CATALOG_EMPTY' })).toEqual({
    stage: 'catalog',
    code: 'CATALOG_EMPTY',
    message: expect.stringContaining('--seed-fixtures'),
  });
});
it.each([
  '42P01',
  '42501',
  '28P01',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
])('identifies database failure %s without raw driver fields', (code) => {
  const result = startupFailure('catalog', {
    code,
    message: 'private-secret',
    detail: 'private-secret',
  });
  expect(result.code).toBe(code);
  expect(JSON.stringify(result)).not.toContain('private-secret');
});
it.each(['EADDRINUSE', 'EADDRNOTAVAIL', 'EACCES'])('identifies listener failure %s', (code) => {
  expect(startupFailure('listen', { code })).toMatchObject({ stage: 'listen', code });
});
it.each([null, new Error('private-secret'), { code: 'private-secret' }, { code: '__proto__' }])(
  'does not expose unknown error contents',
  (error) => {
    expect(startupFailure('catalog', error)).toMatchObject({ stage: 'catalog', code: 'UNKNOWN' });
    expect(JSON.stringify(startupFailure('catalog', error))).not.toContain('private-secret');
  },
);

it('validates production OpenAI settings before diagnostics are initialized, then requires the store for construction', async () => {
  const { readConfig } = await import('../apps/api/src/config.js');
  const { readLLMConfig, llmProvider } = await import('../apps/api/src/llm/config.js');
  const { APPROVED_MODEL } = await import('../apps/api/src/llm/budget.js');
  const env = {
    NODE_ENV: 'production',
    USE_MOCK_LLM: 'false',
    LLM_PROVIDER: 'openai',
    LLM_MODEL: APPROVED_MODEL,
    OPENAI_API_KEY: 'unused-test-key',
    LLM_REASONING_EFFORT: 'low',
    OPENAI_MAX_ATTEMPTS: '1',
    OPENAI_LEDGER_MODE: 'postgres',
    PERSISTENCE_MODE: 'postgres',
    DATABASE_URL: 'postgresql://unused',
    USE_MOCK_YOUCAM: 'true',
  };
  expect(readConfig(env)).toEqual({ host: '0.0.0.0', port: 4000 });
  expect(readLLMConfig(env)?.maxAttempts).toBe(1);
  expect(() => readConfig({ ...env, OPENAI_MAX_ATTEMPTS: '0' })).toThrow('OPENAI_MAX_ATTEMPTS');
  expect(() => llmProvider(env)).toThrow('diagnostics are not initialized');
  const unexpected = () => {
    throw new Error('Startup must not make provider/accounting calls');
  };
  expect(
    llmProvider(env, { reserve: unexpected, settle: unexpected }, undefined, {
      start: unexpected,
      attach: unexpected,
      finish: unexpected,
    }).mode,
  ).toBe('live');
});
