import { llmProvider } from './llm/config.js';
import { youcamProvider } from './youcam/config.js';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  llmProvider(env); // Validate configuration without making requests.
  youcamProvider(env); // Validate explicit live configuration without making any calls.
  const portKey = env.PORT !== undefined ? 'PORT' : 'API_PORT';
  const port = Number(env.PORT ?? env.API_PORT ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`${portKey} must be an integer from 1 to 65535.`);
  return {
    port,
    host: env.API_HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  };
}
