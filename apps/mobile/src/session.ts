import {
  agentRequestSchema,
  idSchema,
  type AgentRequest,
  type AgentResponse,
  type DecisionAction,
  type SessionView,
} from '@youcam/shared';
import { ClientError, type ShoppingAPI } from './client.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}
interface Journal {
  sessionId: string | null;
  messages: ChatMessage[];
  pending: { request: AgentRequest; label: string } | null;
}
export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
export interface ShoppingView {
  ready: boolean;
  busy: boolean;
  session: SessionView | null;
  response: AgentResponse | null;
  messages: ChatMessage[];
  error: string | null;
  expired: boolean;
  retryPending: boolean;
  needsRefresh: boolean;
}
function decode(value: string | null): Journal {
  if (!value) return { sessionId: null, messages: [], pending: null };
  const raw = JSON.parse(value) as Journal;
  if (
    !raw ||
    typeof raw !== 'object' ||
    Object.keys(raw).some((k) => !['sessionId', 'messages', 'pending'].includes(k))
  )
    throw new Error('Invalid journal');
  if (raw.sessionId !== null) idSchema.parse(raw.sessionId);
  if (
    !Array.isArray(raw.messages) ||
    raw.messages.length > 40 ||
    raw.messages.some(
      (m) =>
        !m ||
        typeof m.id !== 'string' ||
        !['user', 'assistant'].includes(m.role) ||
        typeof m.text !== 'string' ||
        m.text.length > 2000,
    )
  )
    throw new Error('Invalid history');
  if (raw.pending) {
    if (!raw.sessionId || typeof raw.pending.label !== 'string' || raw.pending.label.length > 2000)
      throw new Error('Invalid pending turn');
    raw.pending.request = agentRequestSchema.parse(raw.pending.request);
  } else if (raw.pending !== null) throw new Error('Invalid pending turn');
  return raw;
}
export function createShoppingSession(
  api: ShoppingAPI,
  storage: SessionStorage,
  requestId: () => string,
) {
  let journal: Journal = { sessionId: null, messages: [], pending: null };
  let view: ShoppingView = {
    ready: false,
    busy: false,
    session: null,
    response: null,
    messages: [],
    error: null,
    expired: false,
    retryPending: false,
    needsRefresh: false,
  };
  let journalLoaded = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ShoppingView>) => {
    view = { ...view, ...patch };
    listeners.forEach((listener) => listener());
  };
  const save = async () => {
    try {
      await storage.write(JSON.stringify(journal));
    } catch {
      throw new ClientError(
        'STORAGE',
        'Unable to save this session on your phone. Retry before sending another change.',
      );
    }
  };
  async function run(operation: () => Promise<void>) {
    if (view.busy) return;
    publish({ busy: true, error: null });
    try {
      await operation();
    } catch (error) {
      const e =
        error instanceof ClientError
          ? error
          : new ClientError(
              'INVALID_RESPONSE',
              'Unable to restore the session. Retry or deliberately start a new session.',
            );
      const expired = e.code === 'SESSION_NOT_FOUND';
      const definitive = [400, 401, 404, 409, 422].includes(e.status);
      if (definitive && journal.pending) {
        journal.pending = null;
        try {
          await save();
        } catch {
          /* keep UI blocked until refresh can persist the journal */
        }
      }
      publish({
        error: expired
          ? 'This session is unavailable for your guest identity. In memory mode, an API restart expires sessions. Start a new session only if you no longer need this session reference.'
          : e.message,
        expired,
        retryPending: !!journal.pending,
        needsRefresh:
          view.needsRefresh || definitive || e.code === 'STORAGE' || e.code === 'INVALID_RESPONSE',
        response: null,
      });
    } finally {
      publish({ busy: false, ready: true, messages: journal.messages });
    }
  }
  async function restoreJournal() {
    if (journalLoaded) return;
    try {
      journal = decode(await storage.read());
      journalLoaded = true;
    } catch {
      throw new ClientError(
        'STORAGE',
        'The saved session reference could not be read. Retry or deliberately start a new session.',
      );
    }
    publish({ messages: journal.messages, retryPending: !!journal.pending });
  }
  async function reconcile() {
    publish({ needsRefresh: true });
    await restoreJournal();
    await save();
    if (!journal.sessionId) {
      publish({ needsRefresh: false });
      return;
    }
    const current = await api.get(journal.sessionId);
    publish({ session: current, expired: false, needsRefresh: false });
  }
  async function deliver() {
    const pending = journal.pending;
    if (!pending || !journal.sessionId) return;
    // A durable request ID precedes every mutation, including retries after reload.
    await save();
    const response = await api.turn(journal.sessionId, pending.request);
    if (!journal.messages.some((m) => m.id === pending.request.requestId)) {
      journal.messages = [
        ...journal.messages,
        { id: pending.request.requestId, role: 'user', text: pending.label },
        { id: `${pending.request.requestId}-reply`, role: 'assistant', text: response.message },
      ].slice(-40) as ChatMessage[];
    }
    const prior = journal.pending;
    journal.pending = null;
    try {
      await save();
    } catch (error) {
      journal.pending = prior;
      throw error;
    }
    // A replayed response may predate another client's turn; never treat it as current truth.
    publish({ needsRefresh: true });
    const current = await api.get(journal.sessionId);
    publish({
      session: current,
      response: current.version === response.session.version ? response : null,
      messages: journal.messages,
      retryPending: false,
      needsRefresh: current.version !== response.session.version,
    });
  }
  async function submit(
    payload:
      | Omit<Extract<AgentRequest, { type: 'message' }>, 'requestId' | 'expectedVersion'>
      | Omit<Extract<AgentRequest, { type: 'action' }>, 'requestId' | 'expectedVersion'>
      | Omit<
          Extract<AgentRequest, { type: 'confirm_relaxation' }>,
          'requestId' | 'expectedVersion'
        >,
    label: string,
  ) {
    await restoreJournal();
    if (
      journal.pending ||
      view.needsRefresh ||
      view.expired ||
      (journal.sessionId && !view.session)
    )
      throw new ClientError(
        'PENDING',
        'Retry or refresh the session before sending another change.',
      );
    if (!view.session) {
      const created = await api.create();
      journal.sessionId = created.state.id;
      await save();
      publish({ session: created });
    }
    journal.pending = {
      request: agentRequestSchema.parse({
        ...payload,
        requestId: requestId(),
        expectedVersion: view.session!.version,
      }),
      label,
    };
    publish({ retryPending: true });
    await deliver();
  }
  return {
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async boot() {
      await run(async () => {
        await restoreJournal();
        if (journal.pending) await deliver();
        else if (journal.sessionId) {
          await reconcile();
          await submit({ type: 'message', message: 'search' }, 'Refresh results');
        }
      });
    },
    async message(text: string, productContext?: { productId: string }) {
      await run(() =>
        submit(
          { type: 'message', message: text.trim(), ...(productContext ? { productContext } : {}) },
          text.trim(),
        ),
      );
    },
    async action(action: DecisionAction, label: string) {
      await run(() => submit({ type: 'action', action }, label));
    },
    async confirm(proposalId: string) {
      await run(() =>
        submit(
          { type: 'confirm_relaxation', proposalId },
          'Confirm the displayed constraint changes',
        ),
      );
    },
    async retry() {
      await run(async () => {
        await restoreJournal();
        if (journal.pending) await deliver();
        else {
          await reconcile();
          if (view.session) await submit({ type: 'message', message: 'search' }, 'Refresh results');
        }
      });
    },
    async refresh() {
      await run(async () => {
        await restoreJournal();
        if (journal.pending) await deliver();
        await reconcile();
        if (view.session) await submit({ type: 'message', message: 'search' }, 'Refresh results');
      });
    },
    async newSession() {
      await run(async () => {
        const next: Journal = { sessionId: null, messages: [], pending: null };
        try {
          await storage.write(JSON.stringify(next));
        } catch {
          throw new ClientError(
            'STORAGE',
            'Unable to start a new session until local storage is available.',
          );
        }
        journal = next;
        journalLoaded = true;
        publish({
          session: null,
          response: null,
          messages: [],
          error: null,
          expired: false,
          retryPending: false,
          needsRefresh: false,
        });
      });
    },
  };
}
export type ShoppingSessionController = ReturnType<typeof createShoppingSession>;
