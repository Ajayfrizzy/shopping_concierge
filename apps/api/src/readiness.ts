/** No provider probes and no raw errors; only these dependency names may be reported. */
export const readinessNames = [
  'configuration',
  'database',
  'objectStorage',
  'openaiDiagnostics',
  'openaiLedger',
  'youcamLedger',
] as const;
export type ReadinessName = (typeof readinessNames)[number];
export type ReadinessChecks = Partial<Record<ReadinessName, () => unknown | Promise<unknown>>>;
export type ReadinessResults = Partial<
  Record<ReadinessName, { status: 'ready' | 'unavailable'; durationMs: number; code?: string }>
>;
const codes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'TimeoutError',
  'AccessDenied',
  'Forbidden',
  'NoSuchBucket',
  '42P01',
  '42501',
  'READINESS_TIMEOUT',
  'DB_CONNECTION_TIMEOUT',
]);
export function readinessErrorCode(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const e = current as { code?: unknown; name?: unknown; cause?: unknown; message?: unknown };
    const code = e.code ?? e.name;
    if (typeof code === 'string' && codes.has(code)) return code;
    if (
      e.message === 'Connection terminated due to connection timeout' ||
      e.message === 'timeout exceeded when trying to connect'
    )
      return 'DB_CONNECTION_TIMEOUT';
    current = e.cause;
  }
  return 'unclassified';
}
export async function inspectReadiness(checks: ReadinessChecks): Promise<ReadinessResults> {
  const entries = await Promise.all(
    readinessNames
      .filter((name) => checks[name])
      .map(async (name) => {
        const start = Date.now();
        try {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              Promise.resolve().then(() => checks[name]!()),
              new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject({ code: 'READINESS_TIMEOUT' }), 15000);
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
          return [name, { status: 'ready', durationMs: Date.now() - start }] as const;
        } catch (error) {
          return [
            name,
            {
              status: 'unavailable',
              durationMs: Date.now() - start,
              code: readinessErrorCode(error),
            },
          ] as const;
        }
      }),
  );
  return Object.fromEntries(entries);
}
/** Share concurrent probes, but never cache a completed successful check over a failure. */
export function readinessMonitor(checks: ReadinessChecks) {
  let pending: Promise<ReadinessResults> | undefined;
  const outstanding = new Map<ReadinessName, Promise<unknown>>();
  const guarded = Object.fromEntries(
    readinessNames
      .filter((name) => checks[name])
      .map((name) => [
        name,
        () => {
          let task = outstanding.get(name);
          if (!task) {
            task = Promise.resolve()
              .then(() => checks[name]!())
              .finally(() => {
                outstanding.delete(name);
              });
            outstanding.set(name, task);
          }
          return task;
        },
      ]),
  ) as ReadinessChecks;
  return () => {
    pending ??= inspectReadiness(guarded).finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
