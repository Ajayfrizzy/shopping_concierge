import { AgentError } from '@youcam/agent';
import { vtoJobSchema } from '@youcam/shared';
import type { ShoppingRepository } from '../persistence/repository.js';
import type { VisualState } from './state.js';
import { validateImageType, VisualError, type YouCamProvider } from './provider.js';
type Record = VisualState['jobs'][number];
const conflict = () =>
  new AgentError('INVALID_REQUEST', 'This job is not eligible for same-task recovery.', 409);
const binding = (r: Record) =>
  JSON.stringify([
    r.job.id,
    r.job.sessionId,
    r.job.productId,
    r.job.assetId,
    r.job.category,
    r.job.mode,
    r.job.createdAt,
    r.taskId,
    r.productAssetKey ?? null,
    r.productAssetUrl,
  ]);
const eligible = (r: Record) =>
  r.job.mode === 'live' &&
  !!r.taskId &&
  (r.job.status === 'processing' ||
    (r.job.status === 'failed' && r.job.error?.code === 'PROVIDER_TIMEOUT'));
/** This service has no submission, object-store, planner or accounting capability. */
export function taskReconciler(
  repository: ShoppingRepository,
  provider: Pick<YouCamProvider, 'mode' | 'poll' | 'validateOutput'>,
  now = Date.now,
) {
  return async (owner: string, sessionId: string, id: string) => {
    const state = await repository.visual(owner, sessionId, (s) => s);
    const original = state.jobs.find((r) => r.job.id === id);
    if (!original) throw new AgentError('INVALID_REQUEST', 'Try-on job not found.', 404);
    if (original.job.sessionId !== sessionId) throw conflict();
    if (original.job.mode !== 'live' || provider.mode !== 'live') throw conflict();
    if (original.job.status === 'completed') return vtoJobSchema.parse(original.job);
    if (provider.mode !== 'live' || !eligible(original) || !provider.validateOutput)
      throw conflict();
    const asset = await repository.asset(owner, sessionId, original.job.assetId);
    const product = (await repository.products()).find((p) => p.id === original.job.productId);
    if (
      !product ||
      product.category !== original.job.category ||
      asset.asset.id !== original.job.assetId ||
      asset.asset.sessionId !== sessionId
    )
      throw conflict();
    validateImageType(original.job.category, asset.asset);
    const result = await provider.poll(original.job.category, original.taskId!);
    if (result.status === 'completed' && 'mock' in result)
      throw new VisualError(
        'PROVIDER_INVALID_RESPONSE',
        'A genuine output is required for this live task.',
      );
    const verified =
      result.status === 'completed' && 'outputUrl' in result
        ? await provider.validateOutput(result.outputUrl)
        : null;
    let current = original.job;
    await repository.visual(owner, sessionId, (s) => {
      const r = s.jobs.find((r) => r.job.id === id);
      if (!r || binding(r) !== binding(original)) throw conflict();
      current = r.job;
      if (r.job.status === 'completed') return s; // Concurrent winner; never refresh its expiry.
      if (!eligible(r) || (r.job.status !== 'processing' && r.job.status !== 'failed'))
        throw conflict();
      if (result.status === 'processing') return s; // Timeout is local history, not provider failure.
      if (result.status === 'completed' && 'outputUrl' in result && verified) {
        if (verified.expiresAt <= now())
          throw new VisualError('PROVIDER_UNAVAILABLE', 'Original output expired during recovery.');
        r.reconciliation = {
          at: now(),
          previousStatus: r.job.status,
          previousError: r.job.error,
          previousUpdatedAt: r.job.updatedAt,
          ...verified,
        };
        r.job.status = 'completed';
        r.job.error = null;
        r.job.result = { kind: 'image', url: result.outputUrl, expiresAt: verified.expiresAt };
      } else if (result.status === 'failed') {
        r.reconciliation = {
          at: now(),
          previousStatus: r.job.status,
          previousError: r.job.error,
          previousUpdatedAt: r.job.updatedAt,
        };
        r.job.status = 'failed';
        r.job.error = result.error;
        r.job.result = null;
      }
      r.job.updatedAt = now();
      return s;
    });
    return vtoJobSchema.parse(current);
  };
}
