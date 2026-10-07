import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';

/** Deliberately excludes inherited provider, database and dotenv configuration. */
export function demoEnvironment(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const hostKeys = [
    'PATH',
    'HOME',
    'TMPDIR',
    'JAVA_HOME',
    'ANDROID_HOME',
    'ANDROID_SDK_ROOT',
    'LANG',
  ];
  return {
    ...Object.fromEntries(
      hostKeys.flatMap((key) => (inherited[key] ? [[key, inherited[key]]] : [])),
    ),
    ...parseEnv(readFileSync(new URL('../infra/local.env.example', import.meta.url), 'utf8')),
    USE_MOCK_LLM: 'true',
    USE_MOCK_YOUCAM: 'true',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_API_URL: 'http://127.0.0.1:4000',
    CONCIERGE_DEMO_APP: '1',
    NODE_OPTIONS: '--dns-result-order=ipv4first',
  };
}
