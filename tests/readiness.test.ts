import { expect, it, vi } from 'vitest';
import { buildApp } from '../apps/api/src/app.js';
import {
  inspectReadiness,
  readinessMonitor,
  readinessNames,
  type ReadinessChecks,
} from '../apps/api/src/readiness.js';
it.each(readinessNames)(
  'identifies %s failure, checks all dependencies, and recovers without restart',
  async (name) => {
    let fail = true;
    const checks = Object.fromEntries(
      readinessNames.map((key) => [
        key,
        vi.fn(async () => {
          if (key === name && fail)
            throw Object.assign(new Error('secret connection string'), {
              code: 'ECONNRESET',
              stack: 'private stack',
            });
        }),
      ]),
    ) as ReadinessChecks;
    const app = buildApp({ readinessChecks: checks });
    try {
      const response = await app.inject('/ready');
      expect(response.statusCode).toBe(503);
      expect(response.json().dependencies).toEqual(
        Object.fromEntries(
          readinessNames.map((key) => [key, key === name ? 'unavailable' : 'ready']),
        ),
      );
      for (const check of Object.values(checks)) expect(check).toHaveBeenCalledTimes(1);
      expect(response.body).not.toMatch(/secret|private|ECONNRESET/);
      expect((await app.inject('/health')).statusCode).toBe(200);
      fail = false;
      for (let i = 0; i < 5; i++) expect((await app.inject('/ready')).statusCode).toBe(200);
      fail = true;
      expect((await app.inject('/ready')).statusCode).toBe(503);
    } finally {
      await app.close();
    }
  },
);
it('coalesces overlapping requests but does not cache stale health', async () => {
  let resolve!: () => void;
  const check = vi.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const monitor = readinessMonitor({ database: check });
  const a = monitor(),
    b = monitor();
  expect(a).toBe(b);
  await Promise.resolve();
  await Promise.resolve();
  expect(check).toHaveBeenCalledTimes(1);
  resolve();
  await a;
  const c = monitor();
  await Promise.resolve();
  await Promise.resolve();
  expect(check).toHaveBeenCalledTimes(2);
  resolve();
  await c;
});
it('only emits allowlisted dependency names and error codes for local diagnostics', async () => {
  const result = await inspectReadiness({
    database: () => {
      throw { code: 'postgres://private', name: 'secret', message: 'API_KEY' };
    },
    ...{
      secretSetting: () => {
        throw Error();
      },
    },
  });
  expect(Object.keys(result)).toEqual(['database']);
  expect(result.database).toMatchObject({ status: 'unavailable', code: 'unclassified' });
  expect(JSON.stringify(result)).not.toMatch(/private|API_KEY|secret/);
});
it('captures timeout metadata locally without losing other dependency results', async () => {
  const result = await inspectReadiness({
    objectStorage: () => {
      throw { name: 'TimeoutError' };
    },
    database: async () => {},
  });
  expect(result.objectStorage).toMatchObject({ status: 'unavailable', code: 'TimeoutError' });
  expect(result.database?.status).toBe('ready');
});

it('preserves safe underlying database timeout classification through sanitized wrappers', async () => {
  const { readinessErrorCode } = await import('../apps/api/src/readiness.js');
  const error = new Error('Generic ledger unavailable', {
    cause: new Error('Connection terminated due to connection timeout'),
  });
  expect(readinessErrorCode(error)).toBe('DB_CONNECTION_TIMEOUT');
  expect(
    readinessErrorCode(new Error('Generic', { cause: { code: '42P01', message: 'private' } })),
  ).toBe('42P01');
  expect(readinessErrorCode({ cause: { cause: { message: 'private connection' } } })).toBe(
    'unclassified',
  );
});

it('bounds a hung dependency without piling up replacement probes', async () => {
  vi.useFakeTimers();
  try {
    const hung = vi.fn(() => new Promise<void>(() => {}));
    const monitor = readinessMonitor({ objectStorage: hung, database: async () => {} });
    const first = monitor();
    await vi.advanceTimersByTimeAsync(15000);
    expect((await first).objectStorage).toMatchObject({
      status: 'unavailable',
      code: 'READINESS_TIMEOUT',
    });
    const second = monitor();
    await vi.advanceTimersByTimeAsync(15000);
    expect((await second).database?.status).toBe('ready');
    expect(hung).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
