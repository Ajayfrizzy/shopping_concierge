import { taskReconciler } from './reconcile.js';
import { createHash } from 'node:crypto';
import { AgentError } from '@youcam/agent';
import {
  visualAnalysisRequestSchema,
  visualProfileResponseSchema,
  vtoJobSchema,
  vtoRequestSchema,
  vtoResponseSchema,
  type VtoJob,
} from '@youcam/shared';
import type { ShoppingRepository } from '../persistence/repository.js';
import type { ObjectStore } from '../persistence/objects.js';
import { requiredImage, validateImageType, VisualError, type YouCamProvider } from './provider.js';

export function visualService(
  repository: ShoppingRepository,
  objects: ObjectStore,
  provider: YouCamProvider,
  now = Date.now,
) {
  const reconcile = taskReconciler(
    repository,
    {
      mode: provider.mode,
      poll: provider.poll.bind(provider),
      validateOutput: provider.validateOutput?.bind(provider),
    },
    now,
  );
  const failed = (job: VtoJob, error: unknown) => {
    job.status = 'failed';
    job.result = null;
    job.updatedAt = now();
    job.error = (
      error instanceof VisualError
        ? error
        : new VisualError(
            'PROVIDER_UNAVAILABLE',
            'Try-on could not finish. Continue shopping or explicitly try again.',
          )
    ).normalized();
  };
  return {
    reconcile,
    async analyze(owner: string, sessionId: string, raw: unknown) {
      const input = visualAnalysisRequestSchema.parse(raw);
      const stored = await repository.asset(owner, sessionId, input.assetId);
      if (stored.asset.type !== 'portrait')
        throw new VisualError('IMAGE_REQUIRED', 'Face analysis requires a portrait image.');
      if (input.kind !== 'face' || !provider.analyzeFace)
        throw new VisualError(
          'ANALYSIS_UNAVAILABLE',
          'This analysis is not enabled for the configured provider. Explicit shopping preferences remain authoritative.',
        );
      const state = await repository.visual(owner, sessionId, (s) => s);
      const cached = state.profiles.find(
        (p) =>
          p.sha256 === stored.asset.sha256 &&
          p.kind === input.kind &&
          p.mode === provider.mode &&
          p.version === 1,
      );
      if (cached)
        return visualProfileResponseSchema.parse({
          profile: { ...cached, assetId: input.assetId },
          cached: true,
        });
      const result = await provider.analyzeFace(stored.asset);
      const profile = {
        assetId: input.assetId,
        sha256: stored.asset.sha256,
        mode: provider.mode,
        kind: input.kind,
        version: 1,
        faceShape: result.faceShape,
        createdAt: now(),
      } as const;
      await repository.visual(owner, sessionId, (s) => {
        s.profiles = [...s.profiles.filter((p) => p.sha256 !== profile.sha256), profile].slice(-10);
        return s;
      });
      return visualProfileResponseSchema.parse({ profile, cached: false });
    },
    async create(owner: string, sessionId: string, raw: unknown) {
      const input = vtoRequestSchema.parse(raw);
      await repository.read(owner, sessionId);
      const product = (await repository.products()).find((p) => p.id === input.productId);
      if (!product)
        throw new AgentError('UNKNOWN_PRODUCT', 'No catalog product exists for this ID.', 404);
      if (!product.vtoEligible)
        return vtoResponseSchema.parse({
          type: 'unavailable',
          message:
            'Try-on is not available for this product. You can still compare, save or select it.',
        });
      const approvedKey = await repository.vtoAssetKey?.(product.id);
      if (provider.mode === 'live' && !approvedKey && !product.vtoAssetUrl)
        return vtoResponseSchema.parse({
          type: 'unavailable',
          message: 'Try-on is not available for this product yet. You can continue shopping.',
        });
      if (!input.assetId)
        return vtoResponseSchema.parse({
          type: 'request_image',
          requiredType: requiredImage[product.category],
          message: `Provide a clear ${requiredImage[product.category]} image to try on this item. No image is requested for ordinary shopping.`,
        });
      const stored = await repository.asset(owner, sessionId, input.assetId);
      if (stored.asset.type !== requiredImage[product.category])
        return vtoResponseSchema.parse({
          type: 'request_image',
          requiredType: requiredImage[product.category],
          message: `This operation needs a ${requiredImage[product.category]} image.`,
        });
      validateImageType(product.category, stored.asset);
      if (provider.mode === 'live' && !approvedKey && !product.vtoAssetUrl)
        throw new VisualError(
          'PRODUCT_ASSET_MISSING',
          'This catalog item has no approved try-on image. Choose another product.',
        );
      let result: VtoJob | undefined;
      await repository.visual(owner, sessionId, (state) => {
        const replay = state.jobs.find((j) => j.job.id === input.requestId);
        if (replay) {
          if (replay.job.productId !== product.id || replay.job.assetId !== input.assetId)
            throw new AgentError(
              'REQUEST_ID_CONFLICT',
              'This request ID already identifies another try-on.',
              409,
            );
          result = replay.job;
          return state;
        }
        const cached = state.jobs.find(
          (j) =>
            (j.productAssetKey ?? null) === (approvedKey ?? null) &&
            j.productAssetUrl === product.vtoAssetUrl &&
            j.job.mode === provider.mode &&
            j.job.productId === product.id &&
            j.job.assetId === input.assetId &&
            j.job.status === 'completed' &&
            (j.job.result?.kind === 'mock' ||
              (j.job.result?.kind === 'image' && j.job.result.expiresAt > now())),
        );
        if (cached) {
          result = cached.job;
          return state;
        }
        if (state.jobs.some((j) => j.job.status === 'queued' || j.job.status === 'processing'))
          throw new AgentError(
            'RATE_LIMITED',
            'Finish the current try-on before requesting another.',
            429,
          );
        if (state.jobs.length >= 100)
          throw new AgentError('RATE_LIMITED', 'This session has reached its try-on limit.', 429);
        result = vtoJobSchema.parse({
          id: input.requestId,
          sessionId,
          productId: product.id,
          assetId: input.assetId,
          category: product.category,
          mode: provider.mode,
          status: 'queued',
          createdAt: now(),
          updatedAt: now(),
          result: null,
          error: null,
        });
        state.jobs.push({
          job: result,
          productAssetKey: approvedKey ?? null,
          productAssetUrl: product.vtoAssetUrl,
          taskId: null,
          lastPollAt: 0,
        });
        return state;
      });
      return vtoResponseSchema.parse({ type: 'job', job: result });
    },
    async read(owner: string, sessionId: string, id: string) {
      let selected: VtoJob | undefined;
      await repository.visual(owner, sessionId, (state) => {
        selected = state.jobs.find((j) => j.job.id === id)?.job;
        return state;
      });
      if (!selected) throw new AgentError('INVALID_REQUEST', 'Try-on job not found.', 404);
      return vtoJobSchema.parse(selected);
    },
    /** Explicit advancement: GET never consumes provider credits. A persisted submission claim prevents POST replay. */
    async advance(owner: string, sessionId: string, id: string) {
      let claim: { job: VtoJob; taskId: string | null } | undefined;
      let current: VtoJob | undefined;
      await repository.visual(owner, sessionId, (state) => {
        const record = state.jobs.find((j) => j.job.id === id);
        if (!record) throw new AgentError('INVALID_REQUEST', 'Try-on job not found.', 404);
        current = record.job;
        if (record.job.status === 'completed' || record.job.status === 'failed') return state;
        if (record.job.mode !== provider.mode) {
          failed(
            record.job,
            new VisualError(
              'PROVIDER_UNAVAILABLE',
              'Provider mode changed. Start a new try-on explicitly.',
            ),
          );
          return state;
        }
        if (record.job.status === 'processing' && now() - record.lastPollAt < 2000) return state;
        if (record.job.status === 'processing' && !record.taskId) {
          if (now() - record.lastPollAt > 60000)
            failed(
              record.job,
              new VisualError(
                'PROVIDER_TIMEOUT',
                'Submission outcome is unknown. No automatic resubmission was made; check provider usage before trying again.',
              ),
            );
          return state;
        }
        if (!record.taskId && now() - record.job.createdAt > 10 * 60_000) {
          failed(
            record.job,
            new VisualError(
              'PROVIDER_TIMEOUT',
              'Rendering exceeded its time limit. No automatic resubmission was made.',
            ),
          );
          return state;
        }
        record.lastPollAt = now();
        record.job.status = 'processing';
        record.job.updatedAt = now();
        claim = structuredClone({ job: record.job, taskId: record.taskId });
        return state;
      });
      if (!claim) return vtoJobSchema.parse(current);
      const work = claim;
      // All known live tasks use the poll-only validated path, including concurrent claims.
      if (work.taskId && work.job.mode === 'live') return reconcile(owner, sessionId, id);
      try {
        if (!work.taskId) {
          const stored = await repository.asset(owner, sessionId, work.job.assetId);
          const bytes = await objects.get(stored.key);
          if (
            bytes.length !== stored.asset.byteLength ||
            createHash('sha256').update(bytes).digest('hex') !== stored.asset.sha256
          )
            throw new VisualError(
              'INVALID_IMAGE',
              'Stored image could not be verified. Upload it again.',
            );
          const product = (await repository.products()).find((p) => p.id === work.job.productId);
          if (!product)
            throw new VisualError(
              'PRODUCT_ASSET_MISSING',
              'The catalog product is no longer available.',
            );
          if (!product.vtoEligible)
            throw new VisualError(
              'PRODUCT_ASSET_MISSING',
              'Try-on is no longer available for this product.',
            );
          const key = await repository.vtoAssetKey?.(product.id);
          const productAssetUrl =
            key && objects.signGet ? await objects.signGet(key) : product.vtoAssetUrl;
          const taskId = await provider.start({
            reservationId: work.job.id,
            category: product.category,
            asset: stored.asset,
            bytes,
            productAssetUrl,
          });
          await repository.visual(owner, sessionId, (state) => {
            const r = state.jobs.find((j) => j.job.id === id)!;
            // Retain a late acknowledgment even if local waiting already timed out.
            if (!r.taskId) r.taskId = taskId;
            current = r.job;
            return state;
          });
        } else {
          const result = await provider.poll(work.job.category, work.taskId);
          await repository.visual(owner, sessionId, (state) => {
            const r = state.jobs.find((j) => j.job.id === id)!;
            if (r.job.status !== 'processing') {
              current = r.job;
              return state;
            }
            r.job.updatedAt = now();
            if (result.status === 'failed') {
              r.job.status = 'failed';
              r.job.error = result.error;
            }
            if (result.status === 'completed') {
              r.job.status = 'completed';
              r.job.result =
                'mock' in result
                  ? {
                      kind: 'mock',
                      message: 'Mock try-on completed. No visual rendering was generated.',
                    }
                  : { kind: 'image', url: result.outputUrl, expiresAt: now() + 110 * 60_000 };
            }
            current = r.job;
            return state;
          });
        }
      } catch (error) {
        // A failed status check may be retried against the same task without another paid submission.
        if (
          work.taskId &&
          error instanceof VisualError &&
          ['PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE'].includes(error.code)
        )
          throw error;
        await repository.visual(owner, sessionId, (state) => {
          const r = state.jobs.find((j) => j.job.id === id)!;
          failed(r.job, error);
          current = r.job;
          return state;
        });
      }
      return vtoJobSchema.parse(current);
    },
  };
}
