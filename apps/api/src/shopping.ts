import { visualService } from './youcam/service.js';
import { MockVisualProvider } from './youcam/mock.js';
import { VisualError, type YouCamProvider } from './youcam/provider.js';
import sharp from 'sharp';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AgentError, createAgentService, type Planner } from '@youcam/agent';
import { CatalogError, createCatalog } from '@youcam/catalog';
import {
  vtoListSchema,
  compareArgsSchema,
  agentErrorResponseSchema,
  assetSchema,
  assetUploadSchema,
  authAcceptedSchema,
  authIdentitySchema,
  createSessionRequestSchema,
  emailRequestSchema,
  emailVerifySchema,
  idSchema,
  productSchema,
  sessionListSchema,
  sessionViewSchema,
} from '@youcam/shared';
import { MockAgentPlanner } from '@youcam/testing';
import type { ShoppingRepository } from './persistence/repository.js';
import { createMemoryRepository } from './persistence/memory.js';
import { createMemoryObjectStore, type ObjectStore } from './persistence/objects.js';
import { hashToken, ownerFromAuthorization, type EmailSender } from './persistence/auth.js';
export interface ShoppingOptions {
  visualProvider?: YouCamProvider;
  repository?: ShoppingRepository;
  objects?: ObjectStore;
  emailSender?: EmailSender;
  planner?: Planner;
}
const parse = <T>(schema: { parse(value: unknown): T }, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch {
    throw new AgentError('INVALID_REQUEST', 'Invalid request fields.');
  }
};
export function registerShopping(app: FastifyInstance, options: ShoppingOptions = {}) {
  const repository = options.repository ?? createMemoryRepository();
  const objects = options.objects ?? createMemoryObjectStore();
  const visual = visualService(
    repository,
    objects,
    options.visualProvider ?? new MockVisualProvider(),
  );
  const planner = options.planner ?? new MockAgentPlanner();
  void app.register(async (routes) => {
    routes.setErrorHandler((error, _request, reply) => {
      if (error instanceof CatalogError)
        return reply.code(422).send(
          agentErrorResponseSchema.parse({
            error: { code: error.code, message: error.message, recoverable: true },
          }),
        );
      if (error instanceof VisualError) return reply.code(422).send({ error: error.normalized() });
      if (error instanceof Error && error.name === 'ZodError')
        return reply.code(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid visual request fields.',
            recoverable: true,
          },
        });
      const tooLarge =
        !!error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413;
      const e =
        error instanceof AgentError
          ? error
          : new AgentError(
              tooLarge ? 'INVALID_REQUEST' : 'STORAGE_UNAVAILABLE',
              tooLarge
                ? 'Request is too large.'
                : 'The service could not complete this request. Retry safely with the same request ID.',
              tooLarge ? 413 : 503,
            );
      return reply.code(e.statusCode).send(
        agentErrorResponseSchema.parse({
          error: { code: e.code, message: e.message, recoverable: true },
        }),
      );
    });
    routes.post<{ Params: { id: string } }>(
      '/v1/sessions/:id/visual-profile/analyze',
      async (request) =>
        visual.analyze(
          ownerFromAuthorization(request.headers.authorization),
          request.params.id,
          request.body,
        ),
    );
    routes.get<{ Params: { id: string } }>('/v1/sessions/:id/visual-profile', async (request) => {
      const state = await repository.visual(
        ownerFromAuthorization(request.headers.authorization),
        request.params.id,
        (s) => s,
      );
      return { profiles: state.profiles };
    });
    routes.get<{ Params: { id: string } }>('/v1/sessions/:id/vto', async (request) => {
      const state = await repository.visual(
        ownerFromAuthorization(request.headers.authorization),
        request.params.id,
        (s) => s,
      );
      return vtoListSchema.parse({ jobs: state.jobs.map((r) => r.job) });
    });
    routes.post<{ Params: { id: string } }>('/v1/sessions/:id/vto', async (request, reply) => {
      const result = await visual.create(
        ownerFromAuthorization(request.headers.authorization),
        request.params.id,
        request.body,
      );
      return reply.code(result.type === 'job' ? 202 : 200).send(result);
    });
    routes.get<{ Params: { id: string; jobId: string } }>(
      '/v1/sessions/:id/vto/:jobId',
      async (request) =>
        visual.read(
          ownerFromAuthorization(request.headers.authorization),
          request.params.id,
          request.params.jobId,
        ),
    );
    routes.post<{ Params: { id: string; jobId: string } }>(
      '/v1/sessions/:id/vto/:jobId/advance',
      async (request) => {
        if (request.body !== undefined && JSON.stringify(request.body) !== '{}')
          throw new AgentError('INVALID_REQUEST', 'Advance accepts no provider parameters.');
        return visual.advance(
          ownerFromAuthorization(request.headers.authorization),
          request.params.id,
          request.params.jobId,
        );
      },
    );
    routes.get<{ Params: { id: string } }>('/v1/products/:id', async (request) => {
      const id = parse(idSchema, request.params.id);
      const product = createCatalog(await repository.products()).getProduct(id);
      if (!product)
        throw new AgentError('UNKNOWN_PRODUCT', 'No catalog product exists for this ID.', 404);
      return productSchema.parse(product);
    });
    routes.post('/v1/sessions', async (request, reply) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      const input = parse(createSessionRequestSchema, request.body ?? {});
      const service = createAgentService(createCatalog(await repository.products()), planner);
      const view = service.create(input);
      await repository.create(owner, service.snapshot(view.state.id));
      return reply.code(201).send(view);
    });
    routes.get('/v1/sessions', async (request) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      return sessionListSchema.parse({ sessionIds: await repository.list(owner) });
    });
    routes.get<{ Params: { id: string } }>('/v1/sessions/:id', async (request) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      return sessionViewSchema.parse((await repository.read(owner, request.params.id)).view);
    });
    routes.post<{ Params: { id: string } }>('/v1/sessions/:id/compare', async (request) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      const input = parse(compareArgsSchema, request.body);
      const record = await repository.read(owner, request.params.id);
      return createCatalog(await repository.products()).compare(
        record.view.state,
        input.productIds,
      );
    });
    routes.post<{ Params: { id: string } }>('/v1/sessions/:id/messages', async (request) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      return repository.update(owner, request.params.id, async (record, products) => {
        const service = createAgentService(createCatalog(products), planner);
        service.restore(record);
        const response = await service.turn(request.params.id, request.body);
        return { record: service.snapshot(request.params.id), response };
      });
    });
    routes.get('/v1/auth/identity', async (request) =>
      authIdentitySchema.parse({
        email: await repository.email(ownerFromAuthorization(request.headers.authorization)),
      }),
    );
    routes.post('/v1/auth/email/request', async (request, reply) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      const { email } = parse(emailRequestSchema, request.body);
      if (!options.emailSender)
        throw new AgentError(
          'AUTH_UNAVAILABLE',
          'Email sign-in is not configured. Continue as a guest.',
          503,
        );
      const token = randomBytes(32).toString('hex');
      await repository.challenge({
        hash: hashToken(token),
        owner,
        email,
        expiresAt: Date.now() + 600_000,
      });
      await options.emailSender.send(email, token);
      return reply.code(202).send(authAcceptedSchema.parse({ accepted: true }));
    });
    routes.post('/v1/auth/email/verify', async (request) => {
      const owner = ownerFromAuthorization(request.headers.authorization);
      const { token } = parse(emailVerifySchema, request.body);
      const email = await repository.verify(owner, hashToken(token), Date.now());
      return authIdentitySchema.parse({ email });
    });
    routes.post<{ Params: { id: string } }>(
      '/v1/sessions/:id/assets',
      { bodyLimit: 6 * 1024 * 1024 },
      async (request, reply) => {
        const owner = ownerFromAuthorization(request.headers.authorization);
        await repository.read(owner, request.params.id);
        const input = parse(assetUploadSchema, request.body);
        const bytes = Buffer.from(input.data, 'base64');
        if (bytes.length > 4_194_304 || bytes.toString('base64') !== input.data)
          throw new AgentError(
            'INVALID_REQUEST',
            'Provide a canonical base64 PNG or JPEG image of at most 4 MiB.',
          );
        try {
          const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' });
          const metadata = await image.metadata();
          if (metadata.format !== (input.mimeType === 'image/png' ? 'png' : 'jpeg'))
            throw new Error('MIME mismatch');
          await image.raw().toBuffer(); // Decode before accepting malformed or oversized pixel data.
        } catch {
          throw new AgentError(
            'INVALID_REQUEST',
            'Image could not be decoded as the specified PNG/JPEG (maximum 16 megapixels).',
          );
        }
        const asset = assetSchema.parse({
          id: input.requestId,
          sessionId: request.params.id,
          type: input.type,
          mimeType: input.mimeType,
          byteLength: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        // Content-addressed keys avoid overwriting a prior request's bytes on conflicting retries.
        const key = `sessions/${asset.sessionId}/${asset.id}/${asset.sha256}`;
        await objects.put(key, bytes, asset.mimeType);
        const stored = await repository.saveAsset(owner, { asset, key });
        return reply.code(201).send(assetSchema.parse(stored.asset));
      },
    );
    routes.get<{ Params: { id: string; assetId: string } }>(
      '/v1/sessions/:id/assets/:assetId',
      async (request) => {
        return assetSchema.parse(
          (
            await repository.asset(
              ownerFromAuthorization(request.headers.authorization),
              request.params.id,
              request.params.assetId,
            )
          ).asset,
        );
      },
    );
    routes.get<{ Params: { id: string; assetId: string } }>(
      '/v1/sessions/:id/assets/:assetId/content',
      async (request, reply) => {
        const stored = await repository.asset(
          ownerFromAuthorization(request.headers.authorization),
          request.params.id,
          request.params.assetId,
        );
        const bytes = await objects.get(stored.key);
        if (
          bytes.length !== stored.asset.byteLength ||
          createHash('sha256').update(bytes).digest('hex') !== stored.asset.sha256
        )
          throw new Error('Stored image integrity failure');
        return reply
          .header('Cache-Control', 'private, no-store')
          .header('X-Content-Type-Options', 'nosniff')
          .type(stored.asset.mimeType)
          .send(Buffer.from(bytes));
      },
    );
  });
}
