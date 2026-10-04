import { visualStateSchema, type VisualState } from '../youcam/state.js';
import { AgentError, type AgentSessionRecord } from '@youcam/agent';
import { fixtureProducts } from '../../../../fixtures/catalog.ts';
import type { EmailChallenge, ShoppingRepository, StoredAsset } from './repository.js';
/** Injectable local mock. The server selects PostgreSQL explicitly for durable operation. */
export function createMemoryRepository(): ShoppingRepository {
  const records = new Map<string, { owner: string; record: AgentSessionRecord }>();
  const visuals = new Map<string, VisualState>();
  const emails = new Map<string, string>();
  const challenges = new Map<string, EmailChallenge>();
  const assets = new Map<string, StoredAsset>();
  const queues = new Map<string, Promise<unknown>>();
  const owns = (a: string, b: string) =>
    a === b || (!!emails.get(a) && emails.get(a) === emails.get(b));
  const load = (owner: string, id: string) => {
    const r = records.get(id);
    if (!r || !owns(owner, r.owner))
      throw new AgentError('SESSION_NOT_FOUND', 'Shopping session not found.', 404);
    return r;
  };
  return {
    async create(owner, record) {
      if (records.size >= 1000)
        throw new AgentError('SESSION_CAPACITY', 'Mock session capacity reached.', 503);
      if (records.has(record.view.state.id)) throw new Error('Duplicate session');
      records.set(record.view.state.id, { owner, record: structuredClone(record) });
    },
    async read(owner, id) {
      return structuredClone(load(owner, id).record);
    },
    async list(owner) {
      return [...records]
        .filter(([, r]) => owns(owner, r.owner))
        .map(([id]) => id)
        .sort();
    },
    async products() {
      return structuredClone(fixtureProducts);
    },
    async update(owner, id, operation) {
      const previous = queues.get(id) ?? Promise.resolve();
      const next = previous
        .catch(() => {})
        .then(async () => {
          const row = load(owner, id);
          const result = await operation(
            structuredClone(row.record),
            structuredClone(fixtureProducts),
          );
          records.set(id, { owner: row.owner, record: structuredClone(result.record) });
          return structuredClone(result.response);
        });
      queues.set(id, next);
      try {
        return await next;
      } finally {
        if (queues.get(id) === next) queues.delete(id);
      }
    },
    async saveAsset(owner, value) {
      load(owner, value.asset.sessionId);
      const key = `${value.asset.sessionId}/${value.asset.id}`;
      const existing = assets.get(key);
      if (existing && JSON.stringify(existing) !== JSON.stringify(value))
        throw new AgentError(
          'ASSET_CONFLICT',
          'This upload ID already identifies another image.',
          409,
        );
      assets.set(key, structuredClone(value));
      return structuredClone(value);
    },
    async asset(owner, sessionId, id) {
      load(owner, sessionId);
      const value = assets.get(`${sessionId}/${id}`);
      if (!value) throw new AgentError('ASSET_NOT_FOUND', 'Image not found.', 404);
      return structuredClone(value);
    },
    async visual(owner, sessionId, operation) {
      load(owner, sessionId);
      const next = visualStateSchema.parse(
        operation(structuredClone(visuals.get(sessionId) ?? { jobs: [], profiles: [] })),
      );
      visuals.set(sessionId, structuredClone(next));
      return structuredClone(next);
    },
    async email(owner) {
      return emails.get(owner) ?? null;
    },
    async challenge(value) {
      const now = Date.now();
      for (const [key, c] of challenges) if (c.expiresAt <= now) challenges.delete(key);
      if ([...challenges.values()].some((c) => c.owner === value.owner || c.email === value.email))
        throw new AgentError(
          'RATE_LIMITED',
          'Wait for the current email code to expire before requesting another.',
          429,
        );
      challenges.set(value.hash, { ...value });
    },
    async verify(owner, hash, now) {
      const c = challenges.get(hash);
      if (
        !c ||
        c.owner !== owner ||
        c.expiresAt <= now ||
        (emails.has(owner) && emails.get(owner) !== c.email)
      )
        throw new AgentError('INVALID_TOKEN', 'This email code is invalid or expired.', 400);
      challenges.delete(hash);
      emails.set(owner, c.email);
      return c.email;
    },
    async close() {},
  };
}
