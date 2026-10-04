import { z } from 'zod';
import {
  operationPath,
  validateImageType,
  VisualError,
  renderFailure,
  type TryOnInput,
  type ProviderPoll,
  type YouCamProvider,
} from './provider.js';
import type { Category } from '@youcam/shared';
const apiOrigin = 'https://yce-api-01.makeupar.com';
const identifier = z.string().min(1).max(1024);
const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ status: z.literal(200), data });
const started = envelope(z.object({ task_id: identifier }));
const uploaded = envelope(
  z.object({
    files: z
      .array(
        z.object({
          file_id: identifier,
          requests: z
            .array(
              z.object({
                url: z.string().url(),
                method: z.literal('PUT'),
                headers: z.record(z.string(), z.union([z.string(), z.number()])),
              }),
            )
            .length(1),
        }),
      )
      .length(1),
  }),
);
const polled = envelope(
  z.object({
    task_status: z.enum(['running', 'success', 'error']),
    results: z.object({ url: z.string().url() }).optional(),
    error: z.string().nullable().optional(),
  }),
);
/** Provider URL hosts are configured by the operator, not by clients/model output. Redirects are refused. */
export function safeProviderUrl(raw: string, hosts: readonly string[]) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new VisualError('PROVIDER_INVALID_RESPONSE', 'Provider returned an invalid URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    throw new VisualError(
      'PROVIDER_INVALID_RESPONSE',
      'Provider URL is outside the configured HTTPS host allowlist.',
    );
  return url.toString();
}
export class LiveYouCamProvider implements YouCamProvider {
  readonly mode = 'live' as const;
  constructor(
    private readonly options: {
      apiKey: string;
      uploadHosts: string[];
      outputHosts: string[];
      fetch?: typeof fetch;
      timeoutMs?: number;
      log?: (event: {
        method: string;
        operation: string;
        status: number | 'network_error';
      }) => void;
    },
  ) {
    if (!options.apiKey.trim()) throw new Error('Server-side YouCam API key is required.');
  }
  private async request(url: string, init: RequestInit, operation: string): Promise<Response> {
    try {
      const response = await (this.options.fetch ?? fetch)(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 15000),
      });
      this.options.log?.({ method: init.method ?? 'GET', operation, status: response.status });
      if (response.status === 401 || response.status === 403)
        throw new VisualError(
          'PROVIDER_AUTH',
          'Try-on service access is unavailable. Continue shopping while the service is configured.',
        );
      if (response.status === 429)
        throw new VisualError(
          'PROVIDER_RATE_LIMIT',
          'Try-on service is busy. Wait before checking again.',
        );
      if (!response.ok)
        throw new VisualError(
          'PROVIDER_UNAVAILABLE',
          'Try-on service could not complete this operation.',
        );
      return response;
    } catch (error) {
      if (error instanceof VisualError) throw error;
      this.options.log?.({ method: init.method ?? 'GET', operation, status: 'network_error' });
      throw new VisualError(
        'PROVIDER_TIMEOUT',
        'The provider response was not received. Do not automatically resubmit a rendering request.',
      );
    }
  }
  private async json<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    const response = await this.request(
      apiOrigin + path,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      path.split('/').slice(0, 6).join('/'),
    );
    try {
      return schema.parse(await response.json());
    } catch {
      throw new VisualError(
        'PROVIDER_INVALID_RESPONSE',
        'Try-on service returned an invalid response.',
      );
    }
  }
  async start(input: TryOnInput): Promise<string> {
    validateImageType(input.category, input.asset);
    if (!input.productAssetUrl)
      throw new VisualError(
        'PRODUCT_ASSET_MISSING',
        'This product has no approved try-on image. Choose another product.',
      );
    const productUrl = safeProviderUrl(input.productAssetUrl, this.options.outputHosts);
    const path = operationPath[input.category];
    const upload = await this.json(`/s2s/v2.0/file/${path}`, uploaded, {
      files: [
        {
          content_type: input.asset.mimeType === 'image/jpeg' ? 'image/jpg' : 'image/png',
          file_name: 'source.' + (input.asset.mimeType === 'image/jpeg' ? 'jpg' : 'png'),
          file_size: input.bytes.length,
        },
      ],
    });
    const file = upload.data.files[0]!;
    const request = file.requests[0]!;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (
        !['content-type', 'content-length', 'x-amz-acl', 'x-amz-server-side-encryption'].includes(
          key.toLowerCase(),
        )
      )
        throw new VisualError(
          'PROVIDER_INVALID_RESPONSE',
          'Upload service requested unsupported headers.',
        );
      headers[key] = String(value);
    }
    await this.request(
      safeProviderUrl(request.url, this.options.uploadHosts),
      { method: 'PUT', headers, body: new Uint8Array(input.bytes) },
      'upload',
    );
    // No automatic POST retry: an uncertain response may already have consumed credits.
    const task = await this.json(`/s2s/v2.0/task/${path}`, started, {
      src_file_id: file.file_id,
      ref_file_urls: [productUrl],
      source_info: { name: file.file_id },
      object_infos: [{ name: productUrl }],
    });
    return task.data.task_id;
  }
  async poll(category: Category, taskId: string): Promise<ProviderPoll> {
    const result = await this.json(
      `/s2s/v2.0/task/${operationPath[category]}/${encodeURIComponent(identifier.parse(taskId))}`,
      polled,
    );
    if (result.data.task_status === 'running') return { status: 'processing' };
    if (result.data.task_status === 'error')
      return { status: 'failed', error: renderFailure().normalized() };
    if (!result.data.results)
      throw new VisualError('PROVIDER_INVALID_RESPONSE', 'Completed rendering has no output.');
    return {
      status: 'completed',
      outputUrl: safeProviderUrl(result.data.results.url, this.options.outputHosts),
    };
  }
  tryOnEarrings(input: Omit<TryOnInput, 'category'>) {
    return this.start({ ...input, category: 'earrings' });
  }
  tryOnNecklace(input: Omit<TryOnInput, 'category'>) {
    return this.start({ ...input, category: 'necklaces' });
  }
  tryOnRing(input: Omit<TryOnInput, 'category'>) {
    return this.start({ ...input, category: 'rings' });
  }
  tryOnWatch(input: Omit<TryOnInput, 'category'>) {
    return this.start({ ...input, category: 'watches' });
  }
}
