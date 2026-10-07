import { expect, it } from 'vitest';
import { demoEnvironment } from '../scripts/demo-environment.mjs';

it('isolates demo startup from inherited live providers, cloud storage and dotenv', () => {
  const env = demoEnvironment({
    PATH: '/bin',
    USE_MOCK_LLM: 'false',
    USE_MOCK_YOUCAM: 'false',
    DATABASE_URL: 'postgresql://cloud.invalid/db',
    S3_ENDPOINT: 'https://cloud.invalid',
    OPENAI_API_KEY: 'private',
    YOUCAM_API_KEY: 'private',
    NODE_OPTIONS: '--require unexpected.js',
    EXPO_PUBLIC_API_URL: 'https://cloud.invalid',
  });
  expect(env.USE_MOCK_LLM).toBe('true');
  expect(env.USE_MOCK_YOUCAM).toBe('true');
  expect(env.OPENAI_API_KEY).toBeUndefined();
  expect(env.YOUCAM_API_KEY).toBeUndefined();
  expect(env.DATABASE_URL).toContain('@127.0.0.1:15432/');
  expect(env.S3_ENDPOINT).toBe('http://127.0.0.1:19000');
  expect(env.EXPO_PUBLIC_API_URL).toBe('http://127.0.0.1:4000');
  expect(env.EXPO_NO_DOTENV).toBe('1');
  expect(env.NODE_OPTIONS).toBe('--dns-result-order=ipv4first');
  expect(env.CONCIERGE_DEMO_APP).toBe('1');
});

it('the native launcher flags pass the installed Expo CLI bundler validation', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { dirname, resolve } = await import('node:path');
  const ts = await import('typescript');
  const source = ts.createSourceFile(
    'demo.mts',
    readFileSync('scripts/demo.mts', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let args: string[] = [];
  function visit(node: import('typescript').Node) {
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.filter(ts.isStringLiteral).map((n) => n.text);
      if (values.includes('run:android')) args = values;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(args).toContain('run:android');
  const fromExpo = createRequire(resolve('node_modules/expo/package.json'));
  const cli = dirname(fromExpo.resolve('@expo/cli/package.json'));
  const { resolveBundlerPropsAsync } = fromExpo(
    resolve(cli, 'build/src/run/resolveBundlerProps.js'),
  ) as {
    resolveBundlerPropsAsync: (
      root: string,
      options: { bundler: boolean; port?: number },
    ) => Promise<{ shouldStartBundler: boolean }>;
  };
  const portAt = args.indexOf('--port');
  await expect(
    resolveBundlerPropsAsync(resolve('apps/mobile'), {
      bundler: !args.includes('--no-bundler'),
      ...(portAt >= 0 ? { port: Number(args[portAt + 1]) } : {}),
    }),
  ).resolves.toMatchObject({ shouldStartBundler: false });
});
