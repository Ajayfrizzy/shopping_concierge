/** Operator S3 probe; creates only its unique access-check object; cleanup is manual. No AI or ledger I/O. */
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:tls';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { persistenceConfig } from '../apps/api/src/persistence/config.js';
const safeCodes = new Set([
  'TimeoutError',
  'AbortError',
  'AccessDenied',
  'Forbidden',
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'NoSuchBucket',
  'PermanentRedirect',
  'AuthorizationHeaderMalformed',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);
function failure(error: unknown) {
  const e = error as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number; requestId?: string; attempts?: number };
    $retryable?: unknown;
  };
  const code = [e.code, e.name].find((c) => c && safeCodes.has(c)) ?? 'unclassified';
  const httpStatus = e.$metadata?.httpStatusCode;
  return {
    code,
    httpStatus,
    requestId: /^[A-Za-z0-9_-]{1,200}$/.test(e.$metadata?.requestId ?? '')
      ? e.$metadata?.requestId
      : undefined,
    attempts: e.$metadata?.attempts,
    category: ['TimeoutError', 'AbortError', 'ETIMEDOUT'].includes(code)
      ? 'timeout'
      : httpStatus === 401 || ['InvalidAccessKeyId', 'SignatureDoesNotMatch'].includes(code)
        ? 'authentication'
        : httpStatus === 403
          ? 'authorization'
          : ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
            ? 'network'
            : 'other',
    retryable:
      !!e.$retryable ||
      [429, 500, 502, 503, 504].includes(httpStatus ?? 0) ||
      ['TimeoutError', 'AbortError', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code),
  };
}
async function main() {
  const c = persistenceConfig({
    ...process.env,
    PERSISTENCE_MODE: 'postgres',
    OBJECT_STORAGE_MODE: 's3',
  }).s3!;
  const endpoint = new URL(c.endpoint);
  const options = {
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 10000 },
  };
  const shared = new S3Client(options);
  const key =
    (c.assetPrefix ?? '') + 'accounting/openai/receipts/access-check-' + randomUUID() + '.json';
  const body = Buffer.from(
    JSON.stringify({ purpose: 's3-diagnostic-access-check', nonce: randomUUID() }),
  );
  const evidence: { config: unknown; checks: unknown[]; rounds: unknown[]; cleanup?: unknown } = {
    config: {
      source:
        'local backend credentials with documented production storage modes; remote environment not introspected',
      https: endpoint.protocol === 'https:',
      forcePathStyle: c.forcePathStyle,
      regionConfigured: !!c.region,
      maxAttempts: 2,
    },
    checks: [],
    rounds: [],
  };
  const save = () => {
    if (process.env.S3_EVIDENCE_PATH)
      writeFileSync(process.env.S3_EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n');
  };
  async function probe(stage: string, fn: () => Promise<unknown>) {
    const start = Date.now();
    try {
      const result = await fn();
      const httpStatus = (result as { httpStatus?: number } | undefined)?.httpStatus;
      return {
        stage,
        status: httpStatus !== undefined && httpStatus >= 400 ? 'unavailable' : 'ready',
        durationMs: Date.now() - start,
        result,
      };
    } catch (e) {
      return { stage, status: 'unavailable', durationMs: Date.now() - start, ...failure(e) };
    }
  }
  try {
    evidence.checks.push(
      await probe('dns', async () => {
        const r = await Promise.race([
          lookup(endpoint.hostname, { all: true }),
          delay(8000).then(() => {
            throw Object.assign(new Error(), { name: 'TimeoutError' });
          }),
        ]);
        return { addresses: r.length };
      }),
    );
    evidence.checks.push(
      await probe(
        'tls',
        () =>
          new Promise((resolve, reject) => {
            const s = connect({
              host: endpoint.hostname,
              port: Number(endpoint.port || 443),
              servername: endpoint.hostname,
              rejectUnauthorized: true,
            });
            const timer = setTimeout(() => {
              s.destroy();
              reject(Object.assign(new Error(), { name: 'TimeoutError' }));
            }, 8000);
            s.once('secureConnect', () => {
              clearTimeout(timer);
              resolve({ authorized: s.authorized, protocol: s.getProtocol() });
              s.destroy();
            });
            s.once('error', (e) => {
              clearTimeout(timer);
              s.destroy();
              reject(e);
            });
          }),
      ),
    );
    shared.middlewareStack.add(
      (next) => async (args) => {
        const req = args.request as { hostname: string; path: string };
        if (req.hostname !== endpoint.hostname || !req.path.includes('/' + c.bucket))
          throw new Error('Addressing mismatch');
        return next(args);
      },
      { step: 'build', name: 'verifyPathAddressing' },
    );
    evidence.checks.push(
      await probe('authenticatedHeadBucket', async () => {
        const r = await shared.send(new HeadBucketCommand({ Bucket: c.bucket }), {
          abortSignal: AbortSignal.timeout(12000),
        });
        return { httpStatus: r.$metadata.httpStatusCode, pathStyleVerified: true };
      }),
    );
    evidence.checks.push(
      await probe('listReceiptPrefix', async () => {
        const r = await shared.send(
          new ListObjectsV2Command({
            Bucket: c.bucket,
            Prefix: (c.assetPrefix ?? '') + 'accounting/openai/receipts/',
            MaxKeys: 1,
          }),
          { abortSignal: AbortSignal.timeout(12000) },
        );
        return { httpStatus: r.$metadata.httpStatusCode, count: r.KeyCount };
      }),
    );
    evidence.checks.push(
      await probe('writeReadProbe', async () => {
        await shared.send(
          new PutObjectCommand({
            Bucket: c.bucket,
            Key: key,
            Body: body,
            ContentType: 'application/json',
          }),
          { abortSignal: AbortSignal.timeout(12000) },
        );
        const r = await shared.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }), {
          abortSignal: AbortSignal.timeout(12000),
        });
        if (!Buffer.from(await r.Body!.transformToByteArray()).equals(body))
          throw new Error('Mismatch');
        return { httpStatus: r.$metadata.httpStatusCode, bytesMatch: true };
      }),
    );
    save();
    console.log(JSON.stringify({ checks: evidence.checks, config: evidence.config }));
    for (let i = 0; i < 8; i++) {
      if (i) await delay(30000);
      const checks = [
        await probe('reusedClientHeadBucket', async () => {
          const r = await shared.send(new HeadBucketCommand({ Bucket: c.bucket }), {
            abortSignal: AbortSignal.timeout(12000),
          });
          return { httpStatus: r.$metadata.httpStatusCode, attempts: r.$metadata.attempts };
        }),
      ];
      const fresh = new S3Client(options);
      try {
        checks.push(
          await probe('freshClientHeadBucket', async () => {
            const r = await fresh.send(new HeadBucketCommand({ Bucket: c.bucket }), {
              abortSignal: AbortSignal.timeout(12000),
            });
            return { httpStatus: r.$metadata.httpStatusCode, attempts: r.$metadata.attempts };
          }),
        );
      } finally {
        fresh.destroy();
      }
      checks.push(
        await probe('publicReadiness', async () => {
          const r = await fetch('https://shoppingconcierge.rumptycloud.app/ready', {
            signal: AbortSignal.timeout(25000),
            cache: 'no-store',
          });
          const b = await r.json();
          return { httpStatus: r.status, dependencies: b.dependencies };
        }),
      );
      const round = { number: i + 1, at: new Date().toISOString(), checks };
      evidence.rounds.push(round);
      save();
      console.log(JSON.stringify(round));
    }
  } finally {
    evidence.cleanup = { mode: 'manual through RumptyCloud', probeKey: key, deletionAttempted: false };
    save();
    shared.destroy();
  }
}
main().catch(() => {
  console.error('S3 inspection stopped; no raw error or credential emitted.');
  process.exitCode = 1;
});
