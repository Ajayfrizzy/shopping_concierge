export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  for (const key of ['USE_MOCK_LLM', 'USE_MOCK_YOUCAM']) {
    if (env[key] !== undefined && env[key] !== 'true') throw new Error(`${key} must be true until live adapters are implemented.`);
  }
  const port = Number(env.API_PORT ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be an integer from 1 to 65535.');
  return { port, host: env.API_HOST ?? '127.0.0.1' };
}
