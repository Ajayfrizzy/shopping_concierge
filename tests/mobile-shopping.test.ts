import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../apps/api/src/app.js';
import { ClientError, createShoppingAPI, type Transport } from '../apps/mobile/src/client.ts';
import { createShoppingSession, type SessionStorage } from '../apps/mobile/src/session.ts';
import type { AgentRequest } from '@youcam/shared';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.useRealTimers();
});
function setup() {
  const app = buildApp();
  apps.push(app);
  const requests: { url: string; body?: string }[] = [];
  let offline = false,
    loseResponse = false,
    value: string | null = null,
    failWrite = false,
    failRead = false;
  const transport: Transport = async (url, init) => {
    requests.push({ url, body: init?.body });
    if (offline) throw new Error('offline');
    const response = await app.inject({
      method: init?.method === 'POST' ? 'POST' : 'GET',
      url: new URL(url).pathname,
      headers: init?.headers,
      ...(init?.body ? { payload: JSON.parse(init.body) } : {}),
    });
    if (loseResponse && url.endsWith('/messages')) {
      loseResponse = false;
      throw new Error('lost response after commit');
    }
    return {
      ok: response.statusCode < 400,
      status: response.statusCode,
      json: async () => response.json() as unknown,
    };
  };
  const storage: SessionStorage = {
    read: async () => {
      if (failRead) throw new Error('read failure');
      return value;
    },
    write: async (next) => {
      if (failWrite) throw new Error('disk full');
      value = next;
    },
  };
  let sequence = 0;
  const api = createShoppingAPI('http://mock', transport, 10_000, async () => 'a'.repeat(64));
  const controller = () => createShoppingSession(api, storage, () => `mobile-${++sequence}`);
  return {
    app,
    api,
    controller,
    requests,
    storage,
    transport,
    setOffline(v: boolean) {
      offline = v;
    },
    loseNextResponse() {
      loseResponse = true;
    },
    setFailWrite(v: boolean) {
      failWrite = v;
    },
    setFailRead(v: boolean) {
      failRead = v;
    },
    stored: () => value,
    corrupt() {
      value = '{bad';
    },
  };
}
const goal = 'Silver earrings for a wedding under $120, elegant but not too loud.';
describe('M4 mobile HTTP boundary', () => {
  it('gets actual catalog facts and normalizes unknown products', async () => {
    const f = setup();
    expect(await f.api.product('E18')).toMatchObject({ id: 'E18', category: 'earrings' });
    await expect(f.api.product('invented')).rejects.toMatchObject({
      code: 'UNKNOWN_PRODUCT',
      status: 404,
    });
  });
  it('rejects malformed response envelopes and cross-session responses', async () => {
    const f = setup();
    const view = await f.api.create();
    const api = createShoppingAPI('http://mock', async () => ({
      ok: true,
      status: 200,
      json: async () => view,
    }));
    await expect(api.get('different-session')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(api.product('E18')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      api.turn(view.state.id, {
        type: 'message',
        message: 'earrings',
        requestId: 'a',
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('validates outgoing requests before transport and fails closed on injected state', async () => {
    const f = setup();
    await expect(
      f.api.turn('id', {
        type: 'message',
        message: 'earrings',
        requestId: 'a',
        expectedVersion: 0,
        state: {},
      } as unknown as AgentRequest),
    ).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
  });
  it('rejects a valid product belonging to a different requested ID', async () => {
    const f = setup();
    const product = await f.api.product('E18');
    const api = createShoppingAPI('http://mock', async () => ({
      ok: true,
      status: 200,
      json: async () => product,
    }));
    await expect(api.product('E01')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('aborts stalled requests with a recoverable network error', async () => {
    vi.useFakeTimers();
    const api = createShoppingAPI(
      'http://mock',
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      10,
    );
    const pending = expect(api.create()).rejects.toMatchObject({ code: 'NETWORK' });
    await vi.advanceTimersByTimeAsync(10);
    await pending;
  });
});
describe('M4 shopping controller using the real mock API', () => {
  it('completes search, cheaper, save, shortlist, selection, rejection and category return', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const initial = c.getSnapshot().session!;
    expect(c.getSnapshot().response?.ui.type).toBe('product_list');
    await c.message('Show me cheaper ones');
    expect(c.getSnapshot().session!.state.constraints).toEqual(
      expect.arrayContaining(initial.state.constraints),
    );
    for (const action of ['save', 'shortlist', 'select'] as const)
      await c.action({ type: 'feedback', feedback: { action, productId: 'E18' } }, `${action} E18`);
    expect(c.getSnapshot().error).toBeNull();
    expect(c.getSnapshot().session!.state.decisions.earrings).toMatchObject({
      saved: ['E18'],
      shortlisted: ['E18'],
      selected: ['E18'],
    });
    await c.action(
      {
        type: 'feedback',
        feedback: { action: 'reject', productId: 'E05', reasonCode: 'too_flashy' },
      },
      'Reject E05: too flashy',
    );
    expect(c.getSnapshot().session!.state.feedback.at(-1)).toMatchObject({
      input: { reasonCode: 'too_flashy' },
      scope: 'session',
    });
    const ui = c.getSnapshot().response!.ui;
    expect(ui.type).toBe('product_list');
    if (ui.type === 'product_list')
      expect(ui.payload.exactMatches.some((p) => p.product.id === 'E05')).toBe(false);
    await c.message('Show me necklaces instead');
    await c.message('Back to earrings');
    expect(c.getSnapshot().session!.state.decisions.earrings?.selected).toEqual(['E18']);
    expect(c.getSnapshot().error).toBeNull();
  });
  it('requires an explicit current proposal ID; plain yes cannot relax constraints', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message('Platinum earrings under $1');
    const before = c.getSnapshot().session!.state;
    expect(c.getSnapshot().response?.ui.type).toBe('empty_state');
    await c.message('yes');
    expect(c.getSnapshot().session!.state).toEqual(before);
    await c.message('search');
    const offer = c.getSnapshot().session!.pendingRelaxations[0]!;
    await c.confirm(offer.proposalId);
    expect(c.getSnapshot().response?.ui.type).toBe('product_list');
    expect(c.getSnapshot().error).toBeNull();
  });
  it('restores decisions from backend on app reload without deriving truth from chat', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    await c.action(
      { type: 'feedback', feedback: { action: 'select', productId: 'E18' } },
      'Select E18',
    );
    const before = c.getSnapshot().session!;
    const stored = JSON.parse(f.stored()!) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['messages', 'pending', 'sessionId']);
    stored.messages = [];
    await f.storage.write(JSON.stringify(stored));
    const reloaded = f.controller();
    await reloaded.boot();
    expect(reloaded.getSnapshot().session!.state).toEqual(before.state);
    expect(reloaded.getSnapshot().response?.ui.type).toBe('product_list');
  });
  it('retries a lost committed response after reload with the same ID and no duplicate transition', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    f.loseNextResponse();
    await c.action(
      { type: 'feedback', feedback: { action: 'save', productId: 'E18' } },
      'Save E18',
    );
    expect(c.getSnapshot().retryPending).toBe(true);
    const pending = JSON.parse(f.stored()!).pending.request as AgentRequest;
    const committed = await f.api.get(c.getSnapshot().session!.state.id);
    const reloaded = f.controller();
    await reloaded.boot();
    expect(reloaded.getSnapshot().session).toEqual(committed);
    expect(reloaded.getSnapshot().messages.filter((m) => m.id === pending.requestId)).toHaveLength(
      1,
    );
    expect(f.requests.filter((r) => r.body === JSON.stringify(pending))).toHaveLength(2);
  });
  it('recovers offline create and pending turn failures without dropping decisions', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    f.setOffline(true);
    await c.message(goal);
    expect(c.getSnapshot().error).toContain('connection');
    f.setOffline(false);
    await c.message(goal);
    const before = c.getSnapshot().session!;
    f.setOffline(true);
    await c.message('Actually gold');
    expect(c.getSnapshot().retryPending).toBe(true);
    expect(c.getSnapshot().session).toEqual(before);
    f.setOffline(false);
    await c.retry();
    expect(c.getSnapshot().error).toBeNull();
    expect(c.getSnapshot().retryPending).toBe(false);
  });
  it('durably journals every mutation and refuses to send when storage is unavailable', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const count = f.requests.length;
    f.setFailWrite(true);
    await c.message('Actually gold');
    expect(f.requests).toHaveLength(count);
    expect(c.getSnapshot().retryPending).toBe(true);
    f.setFailWrite(false);
    await c.retry();
    expect(c.getSnapshot().error).toBeNull();
  });
  it('retains a post-commit storage failure for idempotent retry', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const original = f.storage.write;
    let writes = 0;
    f.storage.write = async (value) => {
      if (++writes === 2) throw new Error('post-response disk failure');
      await original(value);
    };
    await c.message('Actually gold');
    expect(c.getSnapshot().retryPending).toBe(true);
    const committed = await f.api.get(c.getSnapshot().session!.state.id);
    await c.retry();
    expect(c.getSnapshot().session).toEqual(committed);
    expect(c.getSnapshot().error).toBeNull();
  });
  it('recovers a session pointer write failure before sending the original shopping turn', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    f.setFailWrite(true);
    await c.message(goal);
    expect(f.requests.filter((r) => r.url.endsWith('/messages'))).toHaveLength(0);
    f.setFailWrite(false);
    await c.refresh();
    await c.message(goal);
    expect(f.requests.filter((r) => r.url.endsWith('/sessions'))).toHaveLength(1);
    expect(c.getSnapshot().error).toBeNull();
  });
  it('re-reads an unreadable journal on retry instead of silently losing the session', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const id = c.getSnapshot().session!.state.id;
    f.setFailRead(true);
    const restored = f.controller();
    await restored.boot();
    expect(restored.getSnapshot().needsRefresh).toBe(true);
    f.setFailRead(false);
    await restored.refresh();
    expect(restored.getSnapshot().session!.state.id).toBe(id);
    expect(restored.getSnapshot().error).toBeNull();
  });
  it('never replaces an existing session when the app reloads offline', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const id = c.getSnapshot().session!.state.id;
    f.setOffline(true);
    const restored = f.controller();
    await restored.boot();
    expect(restored.getSnapshot().needsRefresh).toBe(true);
    f.setOffline(false);
    const count = f.requests.length;
    await restored.message('rings');
    expect(f.requests).toHaveLength(count);
    expect(JSON.parse(f.stored()!).sessionId).toBe(id);
    await restored.refresh();
    expect(restored.getSnapshot().session!.state.id).toBe(id);
    expect(restored.getSnapshot().session!.state.activeCategory).toBe('earrings');
  });
  it('only discards a corrupt journal on deliberate new session', async () => {
    const f = setup();
    f.corrupt();
    const c = f.controller();
    await c.boot();
    await c.refresh();
    expect(c.getSnapshot().error).toBeTruthy();
    expect(f.stored()).toBe('{bad');
    expect(f.requests).toHaveLength(0);
    await c.newSession();
    await c.message(goal);
    expect(c.getSnapshot().error).toBeNull();
  });
  it('refreshes stale versions without auto-applying the rejected action', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const old = c.getSnapshot().session!;
    await f.api.turn(old.state.id, {
      type: 'message',
      requestId: 'other-client',
      expectedVersion: old.version,
      message: 'Actually gold',
    });
    await c.message('Under $50');
    expect(c.getSnapshot().needsRefresh).toBe(true);
    expect(c.getSnapshot().retryPending).toBe(false);
    await c.refresh();
    expect(c.getSnapshot().error).toBeNull();
    const budget = c
      .getSnapshot()
      .session!.state.constraints.find((r) => r.preference.field === 'budget');
    expect(budget?.preference.value).toEqual({ amount: 120, currency: 'USD' });
  });
  it('suppresses obsolete replay results after another client advances the session', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    f.loseNextResponse();
    await c.message('Actually gold');
    const latest = await f.api.get(c.getSnapshot().session!.state.id);
    const next = await f.api.turn(latest.state.id, {
      type: 'message',
      requestId: 'other-client',
      expectedVersion: latest.version,
      message: 'Actually silver',
    });
    await c.retry();
    expect(c.getSnapshot().session).toEqual(next.session);
    expect(c.getSnapshot().response).toBeNull();
    expect(c.getSnapshot().needsRefresh).toBe(true);
    await c.refresh();
    expect(c.getSnapshot().needsRefresh).toBe(false);
  });
  it('blocks changes when post-commit reconciliation fails until a refresh succeeds', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const original = f.api.get;
    f.api.get = async () => {
      throw new ClientError('NETWORK', 'offline');
    };
    await c.message('Actually gold');
    expect(c.getSnapshot().needsRefresh).toBe(true);
    expect(c.getSnapshot().retryPending).toBe(false);
    const count = f.requests.length;
    await c.message('Under $1');
    expect(f.requests).toHaveLength(count);
    f.api.get = original;
    await c.refresh();
    expect(c.getSnapshot().error).toBeNull();
  });
  it('surfaces expired backend sessions and requires deliberate replacement', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const other = setup();
    const reloaded = createShoppingSession(other.api, f.storage, () => 'new-id');
    await reloaded.boot();
    expect(reloaded.getSnapshot().expired).toBe(true);
    expect(reloaded.getSnapshot().error).toContain('unavailable');
    await reloaded.newSession();
    await reloaded.message('rings');
    expect(reloaded.getSnapshot().session!.state.activeCategory).toBe('rings');
  });
  it('serializes concurrent UI actions and emits loading updates', async () => {
    const f = setup();
    const c = f.controller();
    await c.boot();
    await c.message(goal);
    const states: boolean[] = [];
    const unsubscribe = c.subscribe(() => states.push(c.getSnapshot().busy));
    const before = c.getSnapshot().session!.version;
    await Promise.all([c.message('Actually gold'), c.message('Under $1')]);
    unsubscribe();
    expect(c.getSnapshot().session!.version).toBe(before + 1);
    expect(states).toContain(true);
    expect(states.at(-1)).toBe(false);
  });
});
