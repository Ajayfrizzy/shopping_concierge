# Shopping Concierge

A mobile-first purchasing-decision agent for earrings, necklaces, rings, and watches. The planned concierge preserves constraints, learns from structured feedback, coordinates selected products, and uses YouCam visual evidence to help shoppers decide.

**Current state:** M0, M1, SDK 57 stabilization, and M2 are complete. Shared domain schemas and the deterministic decision engine preserve scoped constraints, per-category decisions, feedback, and state-change events. The catalog package now searches 72 clearly synthetic fixture products with hard filtering, weighted ranking, and confirmation-required no-match proposals. The Expo screen still connects to the M0 mock foundation endpoint; conversational shopping, catalog search, database persistence, authentication, and rendering are not wired yet. The preview says so explicitly; it never returns invented products or visual outcomes.

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

Enter a goal and tap **Send to concierge**. Expect the honest foundation response. Stop the API and retry to check the recoverable error state. `npm run export:android` checks bundling but does not prove native boot.

For LAN use, start the API with `API_HOST=0.0.0.0 npm run dev:api` and Metro with `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000 npm run dev:mobile`. Use a trusted shared network. `10.0.2.2` is an emulator-only host alias, not the physical phone's host address.

## Configuration

Copy `.env.example` to `.env` only if changing server defaults. API scripts read the root `.env`. Expo public configuration belongs in `apps/mobile/.env` or the shell; see `apps/mobile/.env.example`. Only `EXPO_PUBLIC_API_URL` belongs in the mobile environment. Do not place server credentials there.

Mocks are the only implemented providers. Setting either mock flag to `false` fails at server startup instead of silently pretending to use a live provider. No live LLM or YouCam calls are made.

## Commands

- `npm run check`: lint, typecheck, and unit/API tests.
- `npm test`: deterministic Vitest tests with Fastify injection, no listening port required.
- `npm run export:android`: compile the Expo Android bundle.
- `npm run dev`: concurrent API and mobile development servers.

## Architecture

- `apps/mobile`: Expo Router + React Native presentation and input.
- `apps/api`: Fastify server, validated requests and normalized responses.
- `packages/shared`: Zod contracts and shared domain types.
- `packages/testing`: configurable success/failure/latency mock services.
- `packages/decision-engine`: validated deterministic constraint/state transitions, scoped decision memory, and state-change events.
- `packages/catalog`: validated catalog lookup, hard filtering, deterministic evidence-based ranking, and explicit relaxation proposals; 72 opt-in synthetic fixture records.
- `packages/agent`: planned validated tool planning and orchestration.
- `fixtures`: regression scenarios.
- `.codex/skills` and `docs`: persistent implementation instructions and decisions.

AI proposes actions; deterministic services own truth. Shopping state will be explicit, independent of chat history. See [milestones](docs/MILESTONES.md), [validation log](docs/VALIDATION.md), and [architecture](docs/ARCHITECTURE.md) before continuing implementation.
