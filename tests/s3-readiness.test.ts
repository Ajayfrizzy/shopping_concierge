import { afterEach, expect, it, vi } from 'vitest';
const { send, configs } = vi.hoisted(() => ({
  send: vi.fn(),
  configs: [] as Record<string, unknown>[],
}));
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    S3Client: class {
      constructor(config: Record<string, unknown>) {
        configs.push(config);
      }
      send = send;
      destroy() {}
    },
  };
});
import { createS3ObjectStore } from '../apps/api/src/persistence/objects.js';
const config = {
  endpoint: 'https://storage.test',
  region: 'test',
  bucket: 'private-test',
  accessKeyId: 'fixture',
  secretAccessKey: 'fixture',
  forcePathStyle: true,
};
afterEach(() => {
  vi.useRealTimers();
  send.mockReset();
  configs.length = 0;
});
it('enforces transport deadlines and bounds reused sockets without changing path style', () => {
  const store = createS3ObjectStore(config);
  const c = configs[0]!;
  expect(c).toMatchObject({
    forcePathStyle: true,
    maxAttempts: 2,
    requestHandler: {
      connectionTimeout: 5000,
      requestTimeout: 10000,
      throwOnRequestTimeout: true,
      socketTimeout: 10000,
    },
  });
  const h = c.requestHandler as {
    httpAgent: { maxSockets: number; maxFreeSockets: number; destroy: () => void };
    httpsAgent: { maxSockets: number; maxFreeSockets: number; destroy: () => void };
  };
  expect(h.httpAgent.maxSockets).toBe(8);
  expect(h.httpsAgent.maxFreeSockets).toBe(2);
  h.httpAgent.destroy();
  h.httpsAgent.destroy();
  store.close();
});
it('aborts a stalled HEAD and recovers without duplicate concurrent probes', async () => {
  vi.useFakeTimers();
  send
    .mockImplementationOnce(
      (_command, options) =>
        new Promise((_resolve, reject) =>
          options.abortSignal.addEventListener('abort', () =>
            reject(Object.assign(new Error(), { name: 'AbortError' })),
          ),
        ),
    )
    .mockResolvedValueOnce({});
  const store = createS3ObjectStore(config);
  const a = store.ready!(),
    b = store.ready!();
  expect(a).toBe(b);
  expect(send).toHaveBeenCalledTimes(1);
  const assertion = expect(a).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(12000);
  await assertion;
  await store.ready!();
  expect(send).toHaveBeenCalledTimes(2);
  store.close();
});
it('does not cache permission failure and makes no write/list calls for readiness', async () => {
  send
    .mockRejectedValueOnce(Object.assign(new Error('private'), { name: 'AccessDenied' }))
    .mockResolvedValueOnce({});
  const store = createS3ObjectStore(config);
  await expect(store.ready!()).rejects.toMatchObject({ name: 'AccessDenied' });
  await store.ready!();
  for (const [command] of send.mock.calls)
    expect(command.constructor.name).toBe('HeadBucketCommand');
  store.close();
});
