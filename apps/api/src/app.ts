import { runtimeState } from './runtime.js';
import { runtimeStateSchema } from '@youcam/shared';
import Fastify from 'fastify';
import { registerShopping, type ShoppingOptions } from './shopping.js';
import {
  foundationRequestSchema,
  foundationResponseSchema,
  healthSchema,
  providerErrorSchema,
} from '@youcam/shared';
import { MockLLMService, MockYouCamService } from '@youcam/testing';

export function buildApp(
  options: {
    logger?: boolean;
    runtime?: ReturnType<typeof runtimeState>;
    readiness?: () => Promise<void>;
    llm?: MockLLMService;
    youcam?: MockYouCamService;
    shopping?: ShoppingOptions;
    planner?: ShoppingOptions['planner'];
  } = {},
) {
  const app = Fastify({
    logger: options.logger ? { redact: ['req.headers.authorization'] } : false,
    bodyLimit: 16_384,
  });
  const providers = {
    llm: options.llm ?? new MockLLMService(),
    youcam: options.youcam ?? new MockYouCamService(),
  };
  app.decorate('providers', providers);
  app.get('/health', async () => healthSchema.parse({ status: 'ok', service: 'youcam-api' }));
  const runtime = runtimeStateSchema.parse(options.runtime ?? runtimeState({}));
  app.get('/ready', async (_request, reply) => {
    try {
      await options.readiness?.();
      return { status: 'ready', service: 'youcam-api', runtime };
    } catch {
      return reply.code(503).send({ status: 'unavailable', service: 'youcam-api', runtime });
    }
  });
  registerShopping(app, {
    ...options.shopping,
    planner: options.planner ?? options.shopping?.planner,
  });
  // M0 connectivity preview remains separate from the mock shopping session routes.
  app.post('/v1/foundation/messages', async (request, reply) => {
    const input = foundationRequestSchema.safeParse(request.body);
    if (!input.success)
      return reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Provide a message between 1 and 2000 characters.',
        },
      });
    const result = await providers.llm.respond();
    if (!result.ok) return reply.code(503).send({ error: providerErrorSchema.parse(result.error) });
    return foundationResponseSchema.parse(result.data);
  });
  return app;
}
