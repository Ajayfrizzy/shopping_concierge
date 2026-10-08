# Shopping Concierge

Shopping Concierge helps shoppers choose accessories without losing their preferences between messages. Describe an occasion, budget and style; refine the results, explain rejections, and coordinate a selected item with another category. Explicit decision state keeps those choices consistent across turns and app restarts when durable persistence is enabled.

**Supported categories:** earrings, necklaces, rings and watches. The demo uses **72 synthetic catalog records and original bundled illustrations**, not merchant inventory. There is no checkout.

## Try the demo

Start with the [Android setup guide](docs/DEMO_SETUP.md), [judge guide](docs/JUDGE_GUIDE.md) and [three-minute demo script](docs/DEMO_SCRIPT.md). The repeatable demo uses local PostgreSQL/S3 and mock providers, needs no paid credentials, and installs a separate **Concierge Demo** app without removing the normal app's data.

1. Describe a goal, such as “Silver earrings for a wedding under $120”.
2. Review catalog cards; save, shortlist, select or reject with a structured reason.
3. Refine the search while preserving unrelated constraints. When no exact match exists, review a proposed search adjustment and explicitly confirm it before search reruns.
4. Use a selected accessory to anchor a coordinated search in another category, then compare actual catalog items against your criteria.
5. Optionally open **Try on** and supply the required portrait, hand or wrist image. Return to the session summary to review decisions.

M0–M9 and the subsequent constraint-relaxation UX fix are complete. The latest full automated baseline is **458 tests**; Samsung Android validation and a **106-second mock rehearsal** passed. See [validation evidence](docs/VALIDATION.md) and [submission notes](docs/SUBMISSION_NOTES.md). This is a local development demo requiring Metro and the API, not a hosted or standalone production release. Deployment and external submission have not been performed.

## AI and visual evidence

The server-side OpenAI adapter proposes structured plans through bounded tools. Deterministic services validate actions and own constraints, catalog facts, ranking and state transitions. The LLM cannot invent products or silently relax hard constraints. Default development uses a bounded mock interpreter; see [supported messages](packages/agent/README.md) and [LLM boundaries](docs/LLM.md).

YouCam is accessed only through a server-side adapter for on-demand virtual try-on. All four VTO categories passed a separate live validation gate. Mock completion is labeled and **does not render an image**. Optional live visual analysis remains disabled/unvalidated. Existing live evidence is linked in the judge guide; normal setup must not repeat paid validation. See [YouCam contracts](docs/YOUCAM.md).

## Local setup

Use Node.js **22.13+** (Node 22 LTS recommended) and npm **10+**. Run from the repository root:

```sh
npm ci
npm run check
```

No environment file or credentials are needed for the default in-memory, mock API:

```sh
npm run dev:api
```

In another terminal, start Expo:

```sh
npm run dev:mobile
```

`npm run dev` runs both processes together. API defaults to `http://127.0.0.1:4000`; Metro uses port 8082. Check connectivity with `curl http://127.0.0.1:4000/health`. Memory-mode sessions expire when the API restarts. The app creates its own guest credential; no shared account is required.

### Android device

Use the project's native development client, not Expo Go. Install JDK 17 and Android SDK platform 36, Build Tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1; configure `JAVA_HOME`, `ANDROID_HOME` and `adb` on PATH. Connect an authorized USB-debugging device, then:

```sh
npm run android:build
```

This generates native configuration and installs **Shopping Concierge** (`com.youcam.shoppingconcierge`). Native dependencies require a rebuild. For USB development, keep the API running and start Metro with:

```sh
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8082 tcp:8082
NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 npm run dev:clear -w @youcam/mobile -- --localhost
```

Use this Metro command instead of a second `dev:mobile` process. The isolated judge-demo installation and recovery steps are in [DEMO_SETUP.md](docs/DEMO_SETUP.md). Android bundling alone does not validate native boot or device layout.

### Durable local sessions

With Docker Desktop running:

```sh
npm run infra:local
npm run db:local
npm run dev:persistent
```

Use this API instead of `dev:api`, with Metro in another terminal. The explicit migration command seeds synthetic fixtures without deleting sessions. [infra/local.env.example](infra/local.env.example) contains public, loopback-only test credentials matching Compose; they are not deployment credentials. See [persistence](docs/PERSISTENCE.md) for ownership and storage behavior.

## Configuration

[.env.example](.env.example) lists safe defaults and empty credential placeholders. Copy it to root `.env` only to override API defaults; the normal API scripts load that file. They do not automatically load `apps/api/.env`. Existing shell variables take precedence. Mobile configuration belongs in `apps/mobile/.env` or the shell and contains only `EXPO_PUBLIC_API_URL`; see [the mobile example](apps/mobile/.env.example).

| Configuration         | Implemented environment variables                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| API / runtime         | `NODE_ENV`, `API_HOST`, `API_PORT`, `PERSISTENCE_MODE`, `OBJECT_STORAGE_MODE`                                                          |
| PostgreSQL            | `DATABASE_URL`, optional `DATABASE_SSL_REJECT_UNAUTHORIZED`                                                                            |
| S3-compatible storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, optional `S3_ASSET_PREFIX` |
| OpenAI planning       | `USE_MOCK_LLM`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_REASONING_EFFORT`, `OPENAI_API_KEY`                                                  |
| YouCam                | `USE_MOCK_YOUCAM`, `YOUCAM_API_KEY`, optional `YOUCAM_BASE_URL`, `YOUCAM_UPLOAD_HOSTS`, `YOUCAM_ASSET_HOSTS`, `YOUCAM_USAGE_LEDGER`    |
| Optional email API    | `EMAIL_AUTH_ENABLED`, `SMTP_URL`, `EMAIL_FROM`                                                                                         |

`PERSISTENCE_MODE=memory` requires `OBJECT_STORAGE_MODE=memory`; `postgres` requires `s3` and database/storage settings. `S3_ASSET_PREFIX`, when set, is a relative object prefix ending in `/`. Email is disabled by default. Leave both `USE_MOCK_*` flags `true` for development and tests. Live providers require reviewed configuration and retained usage ledgers; do not reset the ledgers. Provider secrets must never enter mobile configuration. Detailed mode requirements: [persistence](docs/PERSISTENCE.md), [OpenAI](docs/LLM.md), [YouCam](docs/YOUCAM.md).

## Validation commands

| Command                          | Purpose                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`                   | ESLint                                                                             |
| `npm run typecheck`              | Root/API and mobile TypeScript checks                                              |
| `npm test`                       | Offline unit, scenario, API and portable UI tests; local integration tests skipped |
| `npm run check`                  | Lint, typechecks and tests together                                                |
| `M5_INTEGRATION=1 npm run check` | Full suite including local PostgreSQL/S3; start `infra:local` first                |
| `npm run export:android`         | Expo Android export                                                                |
| `npm run verify:mobile-secrets`  | Android export plus server-credential sentinel scan                                |
| `npm run format:check`           | Prettier check                                                                     |
| `npm run credits:report`         | Read historical ledgers locally; no provider calls                                 |

The normal test suite uses mocks/injected HTTP and consumes no live credits. Live regression scripts are separate and intentionally not part of these commands. [Regression scenarios](docs/TEST_SCENARIOS.md) and [validation](docs/VALIDATION.md) distinguish automated coverage from physical checks.

## Architecture

| Location                                | Responsibility                                                          |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `apps/mobile`                           | Expo Router / React Native UI, guest credential and session reference   |
| `apps/api`                              | Fastify API, authorization, orchestration and provider/storage adapters |
| `packages/shared`                       | Shared Zod contracts and domain types                                   |
| `packages/agent`                        | Bounded planning, strict tools and grounded responses                   |
| `packages/decision-engine`              | Deterministic scoped constraints, decisions and state transitions       |
| `packages/catalog`                      | Catalog validation, hard filtering, ranking and relaxation proposals    |
| `packages/testing`, `fixtures`, `tests` | Mocks and regression coverage                                           |

Shopping state is authoritative on the backend, independent of chat history. PostgreSQL and S3 use portable adapters. RumptyCloud is the intended hackathon infrastructure, not a currently deployed service. See [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API_CONTRACTS.md), [infrastructure decision](docs/INFRASTRUCTURE.md), and [catalog artwork provenance](docs/CATALOG_IMAGES.md).

For publication scope, retained evidence and cleanup findings, see [the repository audit](docs/REPOSITORY_AUDIT.md). [LICENSE](LICENSE) covers the repository; photo-publication permissions are tracked separately from code licensing in the submission notes.
