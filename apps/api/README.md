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
