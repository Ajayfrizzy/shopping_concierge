import { createMemoryRepository } from './memory.js';
import { createPostgresRepository, postgresPool } from './postgres.js';
import { createMemoryObjectStore, createS3ObjectStore } from './objects.js';
import { smtpEmailSender } from './auth.js';
export function persistenceConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.PERSISTENCE_MODE ?? 'memory';
  const storage = env.OBJECT_STORAGE_MODE ?? 'memory';
  if (!['memory', 'postgres'].includes(mode))
    throw new Error('PERSISTENCE_MODE must be memory or postgres.');
  if (!['memory', 's3'].includes(storage))
    throw new Error('OBJECT_STORAGE_MODE must be memory or s3.');
  if (mode === 'postgres' && storage !== 's3')
    throw new Error('Durable PostgreSQL mode requires S3-compatible object storage.');
  if (mode === 'memory' && storage !== 'memory')
    throw new Error('Memory mode must use memory object storage.');
  function required(key: string) {
    const value = env[key]?.trim();
    if (!value) throw new Error(`${key} is required.`);
    return value;
  }
  const databaseUrl = mode === 'postgres' ? required('DATABASE_URL') : undefined;
  if (databaseUrl) {
    let valid = false;
    try {
      valid = ['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol);
    } catch {
      /* only expose the key, never its value */
    }
    if (!valid) throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  let s3;
  if (storage === 's3') {
    const endpoint = required('S3_ENDPOINT');
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error();
    } catch {
      throw new Error('S3_ENDPOINT must be an HTTP(S) URL without embedded credentials.');
    }
    if (
      env.S3_FORCE_PATH_STYLE !== undefined &&
      !['true', 'false'].includes(env.S3_FORCE_PATH_STYLE)
    )
      throw new Error('S3_FORCE_PATH_STYLE must be true or false.');
    s3 = {
      endpoint,
      region: required('S3_REGION'),
      bucket: required('S3_BUCKET'),
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    };
  }
  const email = env.EMAIL_AUTH_ENABLED ?? 'false';
  if (!['true', 'false'].includes(email))
    throw new Error('EMAIL_AUTH_ENABLED must be true or false.');
  const smtp =
    email === 'true' ? { url: required('SMTP_URL'), from: required('EMAIL_FROM') } : undefined;
  if (smtp) {
    try {
      if (!['smtp:', 'smtps:'].includes(new URL(smtp.url).protocol)) throw new Error();
    } catch {
      throw new Error('SMTP_URL must use smtp or smtps.');
    }
  }
  return { mode, databaseUrl, s3, smtp };
}
export function persistenceServices(config: ReturnType<typeof persistenceConfig>) {
  return {
    repository: config.databaseUrl
      ? createPostgresRepository(postgresPool(config.databaseUrl))
      : createMemoryRepository(),
    objects: config.s3 ? createS3ObjectStore(config.s3) : createMemoryObjectStore(),
    emailSender: config.smtp ? smtpEmailSender(config.smtp.url, config.smtp.from) : undefined,
  };
}
