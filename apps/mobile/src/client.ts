import {
  agentErrorResponseSchema,
  agentRequestSchema,
  agentResponseSchema,
  idSchema,
  productSchema,
  sessionViewSchema,
  type AgentRequest,
  type AgentResponse,
  type Product,
  type SessionView,
} from '@youcam/shared';

export class ClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}
export interface Transport {
  (
    url: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}
export interface ShoppingAPI {
  create(): Promise<SessionView>;
  get(id: string): Promise<SessionView>;
  turn(id: string, request: AgentRequest): Promise<AgentResponse>;
  product(id: string): Promise<Product>;
}
export function createShoppingAPI(
  base: string,
  transport: Transport = fetch,
  timeoutMs = 10_000,
  credential: () => Promise<string | null> = async () => null,
): ShoppingAPI {
  async function call(path: string, body?: unknown) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await credential();
      const response = await transport(`${base.replace(/\/$/, '')}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const value = await response.json();
      if (!response.ok) {
        const error = agentErrorResponseSchema.safeParse(value);
        throw new ClientError(
          error.success ? error.data.error.code : 'REQUEST_FAILED',
          error.success
            ? error.data.error.message
            : 'The concierge could not complete this request.',
          response.status,
        );
      }
      return value;
    } catch (error) {
      if (error instanceof ClientError) throw error;
      throw new ClientError(
        'NETWORK',
        'Unable to reach the concierge. Check your connection and retry.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  function validate<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw new ClientError(
        'INVALID_RESPONSE',
        'The concierge returned an invalid response. Retry to recover this request.',
      );
    }
  }
  return {
    async create() {
      const data = await call('/v1/sessions', {});
      return validate(() => sessionViewSchema.parse(data));
    },
    async get(id) {
      idSchema.parse(id);
      const data = await call(`/v1/sessions/${encodeURIComponent(id)}`);
      const session = validate(() => sessionViewSchema.parse(data));
      if (session.state.id !== id)
        throw new ClientError('INVALID_RESPONSE', 'The response belongs to a different session.');
      return session;
    },
    async turn(id, request) {
      idSchema.parse(id);
      const parsed = agentRequestSchema.parse(request);
      const data = await call(`/v1/sessions/${encodeURIComponent(id)}/messages`, parsed);
      const response = validate(() => agentResponseSchema.parse(data));
      if (
        response.session.state.id !== id ||
        response.session.version <= parsed.expectedVersion ||
        response.events.some((e) => e.sessionId !== id)
      )
        throw new ClientError(
          'INVALID_RESPONSE',
          'The response does not match this shopping request.',
        );
      return response;
    },
    async product(id) {
      idSchema.parse(id);
      const data = await call(`/v1/products/${encodeURIComponent(id)}`);
      const product = validate(() => productSchema.parse(data));
      if (product.id !== id)
        throw new ClientError('INVALID_RESPONSE', 'The catalog returned a different product.');
      return product;
    },
  };
}
