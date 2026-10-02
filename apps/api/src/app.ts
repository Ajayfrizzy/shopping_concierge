import Fastify from 'fastify';
import { foundationRequestSchema, foundationResponseSchema, healthSchema, providerErrorSchema } from '@youcam/shared';
import { MockLLMService, MockYouCamService } from '@youcam/testing';

export function buildApp(options: { logger?: boolean; llm?: MockLLMService; youcam?: MockYouCamService } = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 16_384 });
  const providers = { llm: options.llm ?? new MockLLMService(), youcam: options.youcam ?? new MockYouCamService() };
  app.decorate('providers', providers);
  app.get('/health', async () => healthSchema.parse({ status: 'ok', service: 'youcam-api', mode: 'mock' }));
  // Explicit foundation route; session shopping semantics arrive in M3.
  app.post('/v1/foundation/messages', async (request, reply) => {
    const input = foundationRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a message between 1 and 2000 characters.' } });
    const result = await providers.llm.respond();
    if (!result.ok) return reply.code(503).send({ error: providerErrorSchema.parse(result.error) });
    return foundationResponseSchema.parse(result.data);
  });
  return app;
}
