import {
  assetSchema,
  assetUploadSchema,
  vtoJobSchema,
  vtoListSchema,
  vtoRequestSchema,
  vtoResponseSchema,
  visualErrorSchema,
  type VtoJob,
  type VtoResponse,
  type VisualAsset,
} from '@youcam/shared';
import { ClientError, type Transport } from './client';
export function createVisualAPI(
  base: string,
  credential: () => Promise<string | null>,
  transport: Transport = fetch,
) {
  async function call(path: string, body?: unknown) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const token = await credential();
      const response = await transport(base.replace(/\/$/, '') + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        const parsed = visualErrorSchema.safeParse((data as { error?: unknown })?.error);
        throw new ClientError(
          parsed.success ? parsed.data.code : 'VISUAL_ERROR',
          parsed.success ? parsed.data.message : 'Try-on could not be completed. Retry safely.',
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ClientError) throw error;
      throw new ClientError(
        'NETWORK',
        'Unable to reach try-on service. Refresh the job before starting another request.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  const path = (id: string) => `/v1/sessions/${encodeURIComponent(id)}`;
  const job = (raw: unknown, sessionId: string, jobId?: string): VtoJob => {
    const value = vtoJobSchema.parse(raw);
    if (value.sessionId !== sessionId || (jobId && value.id !== jobId))
      throw new ClientError('INVALID_RESPONSE', 'Try-on result belongs to another request.');
    return value;
  };
  return {
    async originalSource(id: string, assetId: string) {
      const asset = assetSchema.parse(
        await call(path(id) + '/assets/' + encodeURIComponent(assetId)),
      );
      if (asset.sessionId !== id || asset.id !== assetId)
        throw new ClientError('INVALID_RESPONSE', 'Original image belongs to another request.');
      const token = await credential();
      if (!token)
        throw new ClientError('UNAUTHORIZED', 'Restore your shopping session to view this photo.');
      // React Native 0.86 Android forwards image headers only for array sources.
      return [
        {
          uri:
            base.replace(/\/$/, '') +
            path(id) +
            '/assets/' +
            encodeURIComponent(assetId) +
            '/content',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'reload' as const,
        },
      ];
    },
    async list(id: string) {
      const result = vtoListSchema.parse(await call(path(id) + '/vto'));
      return result.jobs.map((j) => job(j, id));
    },
    async upload(id: string, input: unknown): Promise<VisualAsset> {
      const parsed = assetUploadSchema.parse(input);
      const result = assetSchema.parse(await call(path(id) + '/assets', parsed));
      if (result.sessionId !== id || result.id !== parsed.requestId || result.type !== parsed.type)
        throw new ClientError('INVALID_RESPONSE', 'Upload response belongs to another image.');
      return result;
    },
    async create(id: string, input: unknown): Promise<VtoResponse> {
      const parsed = vtoRequestSchema.parse(input);
      const result = vtoResponseSchema.parse(await call(path(id) + '/vto', parsed));
      if (
        result.type === 'job' &&
        (job(result.job, id).productId !== parsed.productId ||
          result.job.assetId !== parsed.assetId)
      )
        throw new ClientError(
          'INVALID_RESPONSE',
          'Try-on response belongs to another product/image.',
        );
      return result;
    },
    async advance(id: string, jobId: string) {
      return job(
        await call(path(id) + '/vto/' + encodeURIComponent(jobId) + '/advance', {}),
        id,
        jobId,
      );
    },
  };
}
/** Android's picker can return JPEG base64 with the original PNG MIME metadata. Server still fully decodes it. */
export function pickedImageMime(data: string): 'image/png' | 'image/jpeg' {
  if (data.startsWith('iVBORw0KGgo')) return 'image/png';
  if (data.startsWith('/9j/')) return 'image/jpeg';
  throw new ClientError('INVALID_IMAGE', 'Choose an image that can be read as PNG or JPEG.');
}
