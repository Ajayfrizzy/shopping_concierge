# API

Fastify entry points: `src/app.ts` (injectable app factory) and `src/server.ts` (listener). Run `npm run dev:api` from the root. The development command optionally loads the root `.env`. Providers default to mocks; live modes require explicit validated server-side configuration.

`GET /health` is a credential-free liveness check. `POST /v1/foundation/messages` validates input and returns an explicit preview response; it does not claim to create shopping state. Both routes have integration tests using Fastify injection.

## Compiled production startup

From the repository root, use these managed-host settings:

- **Build Command:** `npm ci --include=dev && npm run build:api`
- **Start Command:** `npm start`
- **Environment:** `NODE_ENV=production`, `API_HOST=0.0.0.0`. Let the platform inject `PORT`; `API_PORT` (default 4000) is only a fallback when `PORT` is absent.

Root `start` delegates to this workspace's `node dist/runtime/server.js`; it starts no Expo process or TypeScript watcher/loader. Root `build:api` delegates to `node build.mjs`, which compiles the backend and internal TypeScript workspace dependencies with esbuild. External npm dependencies, including native `sharp`, remain in `node_modules` and must be installed for the deployment platform. Build dependencies are needed during the build even if the host sets `NODE_ENV=production`.

The nested `dist/runtime/` output deliberately preserves the directory depth used by existing module-relative migration and usage-ledger paths. Keep the repository layout, `apps/api/migrations/` and existing usage ledgers; never reset/copy a fresh ledger to bypass limits. The mobile workspace exports remain unchanged.

Production startup reads injected environment variables, not local `.env` files. Configure existing database/storage/provider variables in the host's secret settings. Both AI providers still default to mocks. Memory persistence remains the default; durable PostgreSQL/S3 requires the existing explicit configuration and prior migration/seed. Startup does not migrate, seed, provision infrastructure or make a validation render. See [persistence](../../docs/PERSISTENCE.md).

The default development command is unchanged. These settings prepare deployment but do not perform it.

## Docker deployment (recommended)

If hosting starts successfully configured Node but reports a missing `dist/runtime/server.js`, the image lacks the compiled artifact. That does not establish whether the build command was skipped or its output was discarded; inspect the expanded hosting logs for that distinction. Do not commit `dist` or switch production to a TypeScript watcher.

Use the root `Dockerfile` with **repository root `.` as build context**. Select Dockerfile mode if the hosting UI offers a build-method selector. Let the image's `CMD` supply startup; clear any conflicting dashboard build/start overrides. If an explicit start override is mandatory, use `node apps/api/dist/runtime/server.js` from `/app`.

The Docker build installs the API workspace, compiles the server, verifies that the file exists and explicitly copies it into the final stage. Its final image contains production dependencies and no Expo app, TypeScript loader, private `.env`, source API directory or validation screenshots. `.dockerignore` uses an allowlist. The image runs as a non-root user with `NODE_ENV=production` and `API_HOST=0.0.0.0`; keep those host settings if dashboard environment variables override image defaults. Inject `PORT` normally; `API_PORT` remains a fallback.

For local verification only:

```sh
docker build -t shopping-concierge-api:local .
docker run --rm -p 4000:4000 -e PORT=4000 shopping-concierge-api:local
```

No deployment credentials are needed for this default memory/mock run. Inject durable storage secrets at runtime only. Existing ledger counts are preserved in the image, but writable image storage is ephemeral: live provider use requires a durable continuation of those ledgers across redeployments, not a reset from an image layer. Keep providers mocked until that separate operational requirement is satisfied. Migrations remain explicit and are not run by the container command.

For a non-Docker builder, root `npm run build` now aliases `npm run build:api`; the previous explicit Build/Start Commands still apply, provided the builder retains `apps/api/dist/` in the runtime image.
