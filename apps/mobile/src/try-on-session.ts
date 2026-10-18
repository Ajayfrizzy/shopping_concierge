import { z } from 'zod';
import type { VtoJob } from '@youcam/shared';
import type { createVisualAPI } from './visual-client';
const journalSchema = z
  .object({
    version: z.literal(1),
    sessionId: z.string(),
    productId: z.string(),
    assetId: z.string().uuid().nullable(),
    requestId: z.string().uuid().nullable(),
  })
  .strict();
type Journal = z.infer<typeof journalSchema>;
type View = {
  ready: boolean;
  busy: boolean;
  waiting: boolean;
  job: VtoJob | null;
  assetId: string | null;
  pending: boolean;
  error: string | null;
  notice: string | null;
};
export function createTryOnSession(
  api: Pick<ReturnType<typeof createVisualAPI>, 'list' | 'create' | 'advance'>,
  storage: { read(): Promise<string | null>; write(value: string): Promise<void> },
  sessionId: string,
  productId: string,
  uuid: () => string,
  options: { intervalMs?: number; maxPolls?: number } = {},
) {
  let journal: Journal = { version: 1, sessionId, productId, assetId: null, requestId: null };
  let view: View = {
    ready: false,
    busy: false,
    waiting: false,
    job: null,
    assetId: null,
    pending: false,
    error: null,
    notice: null,
  };
  let visible = true,
    paused = false,
    polls = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<View>) => {
    view = { ...view, ...patch };
    listeners.forEach((l) => l());
  };
  const save = async (next: Journal) => {
    await storage.write(JSON.stringify(next));
    journal = next;
    emit({ assetId: next.assetId, pending: !!next.requestId });
  };
  const active = () => view.job?.status === 'queued' || view.job?.status === 'processing';
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    emit({ waiting: false });
  };
  async function run(operation: () => Promise<void>) {
    if (view.busy) return;
    emit({ busy: true, error: null });
    try {
      await operation();
    } catch (e) {
      stop();
      paused = true;
      emit({
        error:
          e instanceof Error ? e.message : 'Try-on could not finish. Resume this request safely.',
      });
    } finally {
      emit({ busy: false });
      schedule();
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!visible || paused || !active() || view.busy) return;
    // A legacy queued job is not evidence of consent to a paid submission.
    if (view.job?.status === 'queued' && journal.requestId !== view.job.id) return;
    if (polls >= (options.maxPolls ?? 40)) {
      stop();
      paused = true;
      emit({
        notice: 'Still waiting. You can continue shopping or resume checking this same try-on.',
      });
      return;
    }
    emit({ waiting: true });
    timer = setTimeout(() => {
      void run(async () => {
        if (!visible || paused || !view.job) return;
        polls++;
        emit({ job: await api.advance(sessionId, view.job.id) });
        if (!active()) stop();
      });
    }, options.intervalMs ?? 3000);
  }
  async function reconcile() {
    const jobs = (await api.list(sessionId)).filter((j) => j.productId === productId);
    const job = journal.requestId
      ? (jobs.find((j) => j.id === journal.requestId) ??
        jobs.find((j) => j.assetId === journal.assetId && j.status === 'completed') ??
        null)
      : (jobs.filter((j) => !journal.assetId || j.assetId === journal.assetId).at(-1) ?? null);
    emit({ job, assetId: job?.assetId ?? journal.assetId, pending: !!journal.requestId });
    if (!job && journal.requestId)
      emit({
        notice:
          'Your request may not have reached the service. Resume uses the same request ID; it does not start a different render.',
      });
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => view,
    async boot() {
      await run(async () => {
        const raw = await storage.read();
        if (raw) {
          const parsed = journalSchema.parse(JSON.parse(raw));
          if (parsed.sessionId !== sessionId || parsed.productId !== productId)
            throw new Error('Try-on recovery belongs to another session. Return to shopping.');
          journal = parsed;
        }
        await reconcile();
        emit({ ready: true });
      });
    },
    async photo(assetId: string) {
      if (!view.ready || view.busy || active() || view.pending) return;
      await run(async () => {
        await save({ ...journal, assetId, requestId: null });
        emit({ job: null, notice: 'Photo uploaded privately. Tap Try on to start rendering.' });
      });
    },
    async start() {
      if (
        !view.ready ||
        view.busy ||
        view.job?.status === 'completed' ||
        view.job?.status === 'failed'
      )
        return;
      paused = false;
      polls = 0;
      await run(async () => {
        const assetId = view.assetId;
        if (!assetId) throw new Error('Choose and upload a photo first.');
        // Durable intent precedes both creation and paid advancement.
        await save({ ...journal, assetId, requestId: journal.requestId ?? view.job?.id ?? uuid() });
        if (!view.job) {
          const response = await api.create(sessionId, {
            requestId: journal.requestId,
            productId,
            assetId,
          });
          if (response.type !== 'job') throw new Error(response.message);
          emit({ job: response.job });
        }
        if (active() && visible && !paused) {
          polls++;
          emit({ job: await api.advance(sessionId, view.job!.id), notice: null });
        }
      });
    },
    async refresh() {
      if (!view.ready) return;
      paused = false;
      polls = 0;
      await run(reconcile);
    },
    pause() {
      paused = true;
      stop();
      emit({
        notice:
          'Waiting paused on this phone. A submitted render may continue; it has not been cancelled.',
      });
    },
    visibility(isVisible: boolean) {
      visible = isVisible;
      if (!visible) stop();
      else schedule();
    },
    async another() {
      if (view.busy || active()) return;
      await run(async () => {
        await save({ ...journal, assetId: null, requestId: null });
        emit({ job: null, notice: null });
      });
    },
    dispose() {
      visible = false;
      stop();
      listeners.clear();
    },
  };
}
