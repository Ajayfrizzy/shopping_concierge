# Shopping Concierge

A mobile-first purchasing-decision agent for earrings, necklaces, rings, and watches. The planned concierge preserves constraints, learns from structured feedback, coordinates selected products, and uses YouCam visual evidence to help shoppers decide.

**Current state:** M0–M6 (mock-first validation), SDK 57 stabilization and the post-M5 keyboard fix are complete. Shopping, summary/navigation, explicit relaxation confirmation, guest credential storage, durable session restart and error/retry are validated on physical Android. PostgreSQL and private S3-compatible storage use portable server-side adapters; optional verified email is API-only and disabled by default. Deterministic filtering/ranking and structured session state remain authoritative. Products, prices and stock are synthetic fixtures; M8 adds criteria-grounded comparison and selected-anchor complement search. M6 adds on-demand photo selection and persistent mock try-on jobs; mock completion explicitly generates no rendering. A server-only live YouCam adapter is contract-tested, but live account access/product assets/rendering remain unverified. M7 implements a server-only OpenAI planning adapter and hard validation budget; M7 live/tool and physical-device checks are complete after the budget-scope fix, within the approved extension (29 requests, approximately $0.11061); M8 is complete with 345 passing tests and physical Samsung validation (mock-only); M9 has not started. See [M7 LLM configuration](docs/LLM.md). Real YouCam rendering/analysis remains an open final-submission gate. See [M5 persistence](docs/PERSISTENCE.md) for setup and boundaries.

## Local setup

Use Node.js 22.13+ (Node 22 LTS recommended) and npm 10+.

```sh
npm install
npm run check
npm run dev
```

No credentials are needed. `npm run dev` starts the API and Expo together; each can also run separately with `npm run dev:api` or `npm run dev:mobile`. Once a lockfile exists, use `npm ci` for a reproducible clean install.

The API listens on `127.0.0.1:4000`. `curl http://127.0.0.1:4000/health` returns `{"status":"ok","service":"youcam-api","mode":"mock"}`. A sample request:

```sh
curl http://127.0.0.1:4000/v1/foundation/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"Silver earrings for a wedding under $120"}'
```

Mock session API examples and version/confirmation semantics are in [API contracts](docs/API_CONTRACTS.md); supported demo utterances are in [the agent README](packages/agent/README.md). The app creates its guest credential automatically; session routes require it, while health/foundation routes remain public.

## Local durable persistence

With Docker Desktop running, start the local PostgreSQL/S3 test services and apply the explicit migration/fixture seed:

```sh
npm run infra:local
npm run db:local
npm run dev:persistent
```

Use this API process instead of `dev:api`, and start Metro separately. Public local-only test credentials are supplied in `infra/local.env.example`; never reuse them for deployment. See [persistence](docs/PERSISTENCE.md) for ownership, optional email and storage limits.

```sh
M5_INTEGRATION=1 npm run check
npm run verify:mobile-secrets
```

The full run passes 281 tests; ordinary `npm test` skips the ten explicit PostgreSQL/S3 integration tests. No live AI credits are used.

## Android development build

Use **Shopping Concierge's own development app**, package `com.youcam.shoppingconcierge`. A Recall development app or an Expo Go binary for a different SDK cannot run this project's native modules. Reloading Metro does not rebuild a native binary.

The project targets Expo SDK 57, React Native 0.86.3, React 19.2.3, and New Architecture. The root pins React/React DOM to prevent npm workspace peer hoisting from selecting a second version. Expo Doctor and runtime alignment tests check this setup.

Install JDK 17 and Android SDK platform 36, Build Tools 36.0.0, NDK 27.1.12297006, and CMake 3.22.1 using Android Studio or `sdkmanager`; set `ANDROID_HOME` to that SDK. Enable USB debugging on the phone, connect it, and accept its debugging authorization. From the repository root:

```sh
npm ci
npm run android:build
```

This runs Expo prebuild before compiling/installing the app. Generated `android/` and `ios/` directories are ignored; `app.json` and the dependency lockfile own native configuration. Native dependency/config changes require rebuilding the binary, not just a Metro reload. The Expo Doctor app-config sync heuristic is disabled because it relies on Git tracking and this starter directory has no Git metadata; the build script always runs prebuild instead. All dependency/duplicate/New Architecture checks remain enabled.

For USB connectivity, use separate terminals:

```sh
npm run dev:api
```

```sh
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8082 tcp:8082
NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 npm run dev:clear -w @youcam/mobile -- --localhost
```

On hosts where `localhost` resolves to IPv6 first, the `NODE_OPTIONS` above keeps Metro reachable through ADB's IPv4 USB forwarding.

Open **Shopping Concierge**, not Recall or Expo Go. Metro uses port 8082 to avoid an existing project on 8081. You can explicitly open the correct development client with:

```sh
adb shell am start -a android.intent.action.VIEW   -d 'exp+shopping-concierge://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082'   com.youcam.shoppingconcierge
```

Enter a goal (or tap **Use this example**) and tap **Send to concierge**. Expect fixture product cards and structured changes. Use card actions and **Session summary**, then return or reload to verify the same decisions. See the M5 device evidence in [validation](docs/VALIDATION.md) for error/retry and confirmation checks. `npm run export:android` checks bundling but does not prove native boot.

For LAN use, start the API with `API_HOST=0.0.0.0 npm run dev:api` and Metro with `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000 npm run dev:mobile`. Use a trusted shared network. `10.0.2.2` is an emulator-only host alias, not the physical phone's host address.

## Intended hackathon deployment

The demo target is **RumptyCloud managed app deployment** for the API, **RumptyCloud Managed PostgreSQL** for the database, and **RumptyCloud S3-compatible storage** for objects. Mobile remains Expo / React Native; external AI services remain YouCam APIs and the selected LLM provider. This is not a permanent production-cloud commitment.

Use portable PostgreSQL/S3 adapters and server-side environment-driven secrets; keep infrastructure assumptions outside the core domain and agent logic. See [infrastructure](docs/INFRASTRUCTURE.md) for boundaries and the M5 implications. M5 implements and validates these adapter boundaries locally. No cloud resources are provisioned and RumptyCloud connectivity is not yet validated.

## Configuration

Copy `.env.example` to `.env` only if changing server defaults. API scripts read the root `.env`. Expo public configuration belongs in `apps/mobile/.env` or the shell; see `apps/mobile/.env.example`. Only `EXPO_PUBLIC_API_URL` belongs in the mobile environment. Do not place server credentials there.

Mocks remain the default AI providers. `USE_MOCK_LLM=false` still fails closed; M6 permits explicit live YouCam configuration only with server credentials and host allowlists, and a render requires an approved catalog asset. Current fixture assets are null and cannot produce live VTO. See [YouCam integration](docs/YOUCAM.md) for activation limits and the isolated smoke script. No live calls were used in validation.

## Commands

- `npm run check`: lint, typecheck, and unit/API tests.
- `npm test`: deterministic Vitest tests with Fastify injection, no listening port required.
- `npm run export:android`: compile the Expo Android bundle.
- `npm run dev`: concurrent API and mobile development servers.

## Architecture

- `apps/mobile`: Expo Router + React Native presentation and input.
- `apps/api`: Fastify server, validated requests and normalized responses.
- `packages/shared`: Zod contracts and shared domain types.
- `packages/testing`: configurable success/failure/latency mock services and a full multi-turn agent scenario runner.
- `packages/decision-engine`: validated deterministic constraint/state transitions, scoped decision memory, and state-change events.
- `packages/catalog`: validated catalog lookup, hard filtering, deterministic evidence-based ranking, and explicit relaxation proposals; 72 opt-in synthetic fixture records.
- `packages/agent`: bounded mock intent/planning, strict tool registry, atomic session orchestration, and grounded structured responses.
- `fixtures`: regression scenarios.
- `.codex/skills` and `docs`: persistent implementation instructions and decisions.

AI proposes actions; deterministic services own truth. Shopping state is explicit, independent of chat history. See [milestones](docs/MILESTONES.md), [validation log](docs/VALIDATION.md), and [architecture](docs/ARCHITECTURE.md) before continuing implementation.

## Mobile session behavior (M5)

The phone stores a session ID, up to 40 local chat entries (the screen shows the latest eight), and any pending request with its original retry ID. It does not persist a competing decision-state snapshot. Navigation keeps the root controller; app reload retrieves the authoritative API session and searches again. That refresh advances the turn version/offer IDs but does not change domain constraints or decisions. Successful requests are reconciled against current backend state before showing results.

The phone creates a cryptographically random guest credential and retains it in Expo SecureStore. Rebuild the native app for M5 SecureStore/Crypto modules; Metro reload alone is insufficient. In default **memory** mode, API restart still expires sessions. In **postgres** mode, sessions and decisions survive API/database/app restarts. Lost guest credentials can lose access; old unowned M4 sessions require deliberate new-session recovery. Storage/network failures block unresolved changes and expose retry/refresh. A new session replaces this phone's reference, not the server record.

Use supported messages from `packages/agent/README.md`, such as “Actually gold”, “No dangling earrings”, “Show me necklaces instead”, and “Back to earrings”. “Platinum earrings under $1” demonstrates no-match review: cancel preserves constraints; **Confirm changes** sends only the current proposal ID. Plain “yes” never confirms.

## Optional try-on (M6)

Tap **Try on** on a card or type **Try on E13** with an actual catalog ID. Open try-on, choose/upload the required portrait/hand/wrist image, request a job, then explicitly start/check it. Photo selection happens only here. Mock completion is clearly labeled and does not generate a composite image. Jobs restore from the backend after reload; shopping constraints and decisions are unchanged. The SDK57 image-picker addition requires the rebuilt M6 native binary. See [YouCam contracts and limits](docs/YOUCAM.md).

## Formatting

Run `npm run format` to format supported source, configuration, fixtures and documentation, or `npm run format:check` to check formatting without writing files. The repository pins Prettier and keeps its options in `.prettierrc.json`. Formatting excludes generated files, dependency lockfiles, secrets, captured device evidence and checksum-protected database migrations. Python and environment files are outside Prettier’s supported formats.

## Catalog demo images

All 72 fixtures now have original bundled accessory illustrations with loading/error/missing states. See [catalog image strategy](docs/CATALOG_IMAGES.md) for sources, licensing, regeneration and the existing-database migration. Catalog artwork is separate from YouCam rendering. This stabilization is validated; M9 remains unstarted.
