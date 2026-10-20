# API

**Same-task recovery:** See [the backend recovery fix](../../docs/YOUCAM_TASK_RECOVERY_FIX.md) for the owner-authenticated reconcile endpoint, output validation, no-migration deployment and rollback compatibility requirements. Deployment and production recovery require separate authorization.

Fastify entry points: `src/app.ts` (injectable app factory) and `src/server.ts` (listener). Run `npm run dev:api` from the root. The development and `db:migrate` commands optionally load `apps/api/.env`, then the root `.env`. Root-file values override API-file values; existing shell variables take precedence over both. Providers default to mocks; live modes require explicit validated server-side configuration.

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

No deployment credentials are needed for this default memory/mock run. Inject durable storage secrets at runtime only. Existing ledger counts are preserved in the image, but writable image storage is ephemeral: live provider use requires a durable continuation of those ledgers across redeployments, not a reset from an image layer. For live YouCam, use the PostgreSQL ledger described below. The LLM file ledger remains unchanged; keep USE_MOCK_LLM=true unless its separate durable accounting requirement is satisfied. Migrations remain explicit and are not run by the container command.

For a non-Docker builder, root `npm run build` now aliases `npm run build:api`; the previous explicit Build/Start Commands still apply, provided the builder retains `apps/api/dist/` in the runtime image.

## Live YouCam on RumptyCloud

Set these exact non-secret values in the hosting environment:

```dotenv
NODE_ENV=production
API_HOST=0.0.0.0
PERSISTENCE_MODE=postgres
OBJECT_STORAGE_MODE=s3
USE_MOCK_YOUCAM=false
YOUCAM_LEDGER_MODE=postgres
YOUCAM_MAX_REQUESTS=8
YOUCAM_MAX_UNITS=8
USE_MOCK_LLM=true
```

Keep your existing private `DATABASE_URL`, database TLS settings, S3 configuration, `YOUCAM_API_KEY`, `YOUCAM_UPLOAD_HOSTS` and `YOUCAM_ASSET_HOSTS`. Their account-specific values cannot be replaced with generic examples. Let RumptyCloud inject `PORT`. `YOUCAM_USAGE_LEDGER` is unnecessary in postgres mode; no container-local ledger path is used. For the previously configured database-only self-signed TLS exception, retain `DATABASE_SSL_REJECT_UNAUTHORIZED=false` with `sslmode=require`; trusted certificates should use verification as documented in PERSISTENCE.md.

Before restarting the live API, explicitly apply migrations from a checkout with dependencies and the target database environment injected:

```sh
npm run db:migrate
```

This command uses the existing migration runner and does not render, provision resources or deploy. For a new database, the existing explicit `--seed-fixtures` option seeds the synthetic catalog; approved VTO product image configuration remains a separate prerequisite. The production image contains SQL migrations but no TypeScript migration runner; run this command from the checkout/build environment, not the final image.

Migration `004_youcam_usage.sql` creates the account-wide budget and reservation tables and imports the five recorded validation renders exactly once via checksum-tracked migrations. Default ceilings remain eight requests/eight units, leaving three attempts. This change does not authorize additional credits. If file validation has continued beyond the five checked-in records, reconcile/import those additional reservations before enabling this deployment. Never erase records or initialize a second database to bypass the cap.

Every attempted paid task reserves one request and one unit atomically before POST. Reservations remain charged after failure, timeout or uncertain commit. An acknowledged task marks the reservation committed; this is submission acknowledgement, not proof of successful rendering. Historical five renders were observed consumed. No dollar price is invented: the existing YouCam ledger enforced render counts, and this implementation uses request/unit ceilings. LLM accounting is separate.

Duplicate job IDs do not re-submit a paid task; conflicting categories fail closed. PostgreSQL serializes reservations across instances, and restart/redeployment retains committed and uncertain usage. An uncertain provider response is never automatically retried or refunded. The ledger stores only IDs, category, timestamps, units and historical provenance, with no secrets or provider response bodies.

Startup validates schema/access and matching persisted ceilings before listening. Missing migration, unavailable database or mismatched limits produces a clear ledger initialization error. Runtime database failures block new task submissions. To change a reviewed operating ceiling, explicitly update both `youcam_usage_budget` columns in a database transaction and the matching environment values, preserving all reservations; coordinate workers during this change. Environment changes alone cannot silently raise a persisted limit.

Local validation may retain `YOUCAM_LEDGER_MODE=file` with an existing `YOUCAM_USAGE_LEDGER` and fixed eight-render cap. Never use file mode for the judge deployment. No automatic deployment is performed by these changes.

## Judge hardening (supersedes live settings above)

See [production readiness](../../docs/PRODUCTION_READINESS.md) for migration 005/006, separate judge accounting, exact mock-preserving runtime settings, the reviewed asset inventory and deployment order. Production live OpenAI now requires PostgreSQL accounting and persisted budget approval; production live YouCam requires PostgreSQL judge scope. `/health` reports liveness only; `/ready` reports actual configured modes and dependency readiness without secrets. Do not set the hosting probe to `/ready` until this backend version is deployed.
