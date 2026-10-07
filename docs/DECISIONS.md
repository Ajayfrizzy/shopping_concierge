# Product/Architecture Decisions

- Mobile-first: React Native/Expo.
- Android is primary hackathon test/demo target.
- MVP categories: earrings, necklaces, rings, watches.
- Broader category support is architectural, not MVP implementation scope.
- Backend owns truth; LLM does not directly mutate state.
- Catalog is real structured data; LLM cannot invent products.
- VTO is selectively invoked as visual decision evidence.
- Explicit user preference outranks styling heuristics.
- Cross-product context is first-class differentiation.
- Most development uses mocks to preserve API credits.
- Checkout/payments/merchant tooling are post-hackathon roadmap.

## Foundation decisions — 2026-10-01

- Use npm workspaces (permitted by M0), with a committed npm lockfile. npm is installed on the development host; pnpm is not. Run workspace commands from the root.
- Pin the mobile scaffold to Expo SDK 54 and its compatible React/React Native versions. Expo Router owns navigation. Native boot must be verified independently of bundle compilation.
- M0 exposes a clearly named `/v1/foundation/messages` connectivity route, not a simulated shopping session. It returns no products, decisions, or visual results. The M3 session routes will implement the actual agent contract.
- M0 provider fixtures are injectable server-side mocks with success/failure/latency controls. Visual connectivity is not VTO evidence. Live flags fail closed until adapters exist.
- Root `.env` is read only by the API. Mobile accepts only the public API URL, uses a ten-second request timeout, and validates API responses using shared schemas.
- Existing starter product types are retained; full runtime domain schemas and state transitions remain M1 work. Scenario fixtures A01–A18 are not claimed covered by foundation tests.

- Use patched Vitest 4.1.11 with its supported Vite 7 backend. Vite 8's native Rolldown binding failed to load on the development host; Vite 7 passes the same suite. The override keeps transitive Vitest dependencies on the tested backend.
- Expo SDK 54's transitive dependency audit is not clean. Track the remaining advisories in `VALIDATION.md`; do not claim production readiness or blindly apply cross-major dependency overrides that may break native tooling.

## Android runtime repair — 2026-10-01

- A development client is project-specific. The observed failure came from loading Shopping Concierge's JavaScript in the existing Recall native app. Shopping Concierge now uses `expo-dev-client` and its own `com.youcam.shoppingconcierge` binary and development URL scheme; Recall is not a test target.
- Explicitly use SDK 54's New Architecture/Hermes combination. Native config or dependency changes require a prebuild and reinstall; Metro cache clearing alone cannot repair native incompatibility.
- npm workspace peers selected root React 19.3.0 even though mobile declared 19.1.0. Anchor React/React DOM at the root and enforce singleton overrides, with lockfile and module-resolution regressions. React Native remains SDK-compatible 0.81.5; no internals are patched.
- Metro uses port 8082 to avoid another project's server on 8081. Physical-device API access uses USB reverse with localhost or a configured LAN address; the emulator-only 10.0.2.2 default is not suitable for a phone.
- Generated Android/iOS projects are ignored. The Android build command always runs prebuild to synchronize app configuration. Expo Doctor's Git-dependent app-config-sync heuristic is explicitly disabled for this Git-less workspace; all version, duplicate, and native-compatibility checks remain enabled.

## M1 domain decisions — 2026-10-02

- Runtime Zod schemas are the single source of domain types. Sessions have schema version/revision and can round-trip as JSON independently of chat. Database records/auth ownership remain M5 concerns.
- Keep one field/source/scope record and preserve losing signals. Resolve explicit > saved preference > visual > heuristic; within a source, newer instructions win across scopes, with category specificity breaking a same-revision tie. Repeating the same explicit value must still reassert it over a newer contradictory scope.
- Scoped/global exclusions union to avoid silently relaxing global bans. Reset/replace at the originating scope is required to remove one. Reset removes every source for that field/scope, preserving other scopes.
- “Cheaper” sets a current-category lower-price preference while preserving the explicit numeric budget. No arbitrary percentage/amount is invented. Catalog scoring of that preference belongs to M2.
- Active category and stock eligibility are hard. Explicit budget/material/color/exclusions remain deterministic. New selections use the same reusable hard-eligibility guard intended for M2 filtering. Historical selections survive constraint refinement as history, not renewed recommendations.
- Product feedback requires a backend-owned catalog lookup, uses session scope, records available rejection reasons, distinguishes save/shortlist/like/select/reject, and is idempotent for unchanged active relationships. Rejection removes positive decisions and invalid dependent anchors while preserving saved relationships and reason history.
- Dependency shapes/anchor invariants are part of domain state; cross-product search creation/ranking/comparison remain later milestones. No M2 catalog, M3 agent, M5 persistence, or live-provider implementation was added.
- Pure transitions emit one event per real revision, JSON-safe field changes, and no event for no-ops. The persistence/API layer must later enforce concurrency and event delivery; the pure engine does not pretend to do that.
- Shared runtime source exports use `.ts` paths, supported by both Metro and the no-emit TypeScript/tsx workflow. Android export caught a `.js`-to-`.ts` resolution mismatch missed by unit tests; a static import-boundary regression now protects it.

## SDK 57 stabilization — 2026-10-02

- Supersede the SDK 54 runtime pins with Expo 57.0.26, React/React DOM 19.2.3, React Native 0.86.3, Router 57.0.24, and dev-client 57.0.19. Follow official Expo install/fix/check and clean prebuild, never patch React Native internals. SDK 55+ removes the app-config New Architecture opt-out; generated Android remains New Architecture/Hermes.
- npm retained incompatible hoisted Reanimated/Worklets peers after install/dedupe. Anchor Expo-compatible Reanimated 4.5.1 and Worklets 0.10.1 at the root with overrides, and extend the lockfile singleton regressions to cover both.
- User-facing identity is Shopping Concierge. Keep the internal Android package `com.youcam.shoppingconcierge` for in-place upgrades and internal `@youcam/*` workspace identifiers to avoid unrelated package migration. The app slug/scheme is `shopping-concierge`; Android versionCode advances to 2. YouCam in product prose refers only to the integration/provider.
- Use replaceable shopping-bag artwork with opaque Expo icon, adaptive foreground/background, and monochrome Android mask. Source and reproduction instructions live under `apps/mobile/assets` and `scripts/generate-icons.py`.
- M2 remains gated on the complete stabilization checklist, including fresh native installation and physical success/error/retry verification. No live providers are used.

## M2 catalog decisions — 2026-10-02

- Use a pure `@youcam/catalog` snapshot service with shared Zod input/result contracts. Reuse M1 hard eligibility and state transitions; do not implement a competing filter or mutate shopping state while searching.
- Provide 72 clearly labeled synthetic fixture products, 18 per category, through an opt-in fixture subpath. Stable data records are the only result/price/stock source; no merchant, image, VTO, or live inventory claims. No credentials or paid calls are required.
- Filter hard violations and current rejected IDs before any weighted score. Compare evidence tiers lexicographically (explicit, feedback, saved, visual, heuristic), then stable product ID, so weaker evidence cannot override current instructions. Detailed weights/tag vocabulary and reason mapping live in `packages/catalog/README.md` and tests.
- M2 learns only factual same-category similarity from active session rejections, using each product's latest reason. Unknown reasons/facts never justify inferred dislikes. Positive reversal clears active rejection influence; saving alone does not. Cross-category/dependency intelligence remains M8.
- No-match proposals are shared structured explicit updates with existing candidate IDs and a confirmation requirement. Preview all updates through M1; return zero violating exact results. Preserve stock/category/currency and current rejections, and never apply proposals automatically. Multiple simultaneous changes can be necessary; global exclusion changes are visible in proposal scopes.
- Price preference ranks within each currency, without foreign exchange or an invented cap. Missing category returns `category_required`; language extraction/clarification and tool/API routing remain M3.

## M3 mock orchestration decisions — 2026-10-02

- Keep M0 foundation routes/providers intact. Add backend in-memory session create/read/turn routes using the M1 engine and unmodified M2 catalog. M4 will connect the mobile shopping experience; M5 owns persistent authenticated storage.
- Use an explicitly bounded full-string mock grammar for current-message interpretation. The mock planner proposes a strict plan, and the backend independently grounds the whole plan against that grammar/current state before tool execution. Do not promote conversational/model inference into explicit constraints. Arbitrary live-language authorization remains an M7 design responsibility, not a capability claimed by this mock.
- Planner input is detached and chat history bounded; planner output has no state, product/result facts, response prose, confirmation tool, or execution capability. Render deterministic response text and shared normalized payloads from actual backend tools. Unknown products/plans fail closed.
- Execute a turn atomically on a working state snapshot; compare session version after async planning before commit. Last 50 request IDs support replay/conflict detection. Store at most 1,000 mock sessions, 12 history messages per session, and 20 product records per planning context. Normalize provider failure/timeout without saving partial edits.
- Confirm a relaxation only by explicit client request identifying a current session-owned opaque proposal and expected version. Recompute the offered changes against current catalog/state; do not accept model approval, plain yes, or client replacement facts/updates. Any successful turn replaces old offers. Confirmation and typed actions bypass planning and use the same deterministic services.
- Existing M1/M2 state semantics and ranking weights remain unchanged. Unsupported comparison/VTO/dependency tools return honest unavailable responses; implement their full behavior in their designated milestones rather than fabricating results or expanding M3.

## M4 mobile decisions — 2026-10-02

- Keep conversational input primary. Display real normalized mock responses, exact fixture cards, scoped previous/current changes, structured rejection reasons and a separate summary route. Quick actions call the same strict M3 backend semantics.
- Persist only a session reference, last 40 display messages, and pending idempotent request in Expo FileSystem. Require a successful write before mutation and re-fetch backend truth after delivery. Replay the exact request after connection loss/reload; stale versions require refresh, never silent reapplication. This is local guest recovery, not M5 persistence/auth.
- Expo FileSystem 57.0.7 is now a direct SDK-aligned dependency via `npx expo install expo-file-system`; it was already transitive and its modern/legacy modules appear in the existing SDK57 native package list. No SDK upgrade, native-internal patch, or new paid service is introduced.
- Review relaxation scopes before explicit confirmation, sending only the opaque proposal ID/version. Cancel or plain yes does not confirm. Existing selections are historical choices, not necessarily matches after a constraint change.
- Fixture photos do not exist: say “No product photo” rather than fetching placeholder URLs or inventing images. Comparison and VTO remain honestly unavailable. No permissions/uploads or fake VTO lifecycle are added in M4.
- API restart expires the in-memory backend session; report it and require deliberate new-session confirmation. App storage clearing loses the local pointer. A new session replaces this phone's pointer only, leaving old mock records to process lifetime/capacity policy.

## Hackathon infrastructure decision — 2026-10-02 (after M4, before M5)

- Use RumptyCloud managed app deployment for the backend/API, RumptyCloud Managed PostgreSQL for the database, and RumptyCloud S3-compatible storage for objects as the intended hackathon/demo target. Mobile remains Expo / React Native; external AI services remain YouCam APIs and the selected LLM provider.
- This supersedes the earlier Supabase-specific infrastructure/auth assumption and is not a permanent production-cloud commitment. No identity provider is selected by choosing database or storage hosting. M5 still starts with guest sessions and retains optional email auth and its existing persistence/authorization acceptance criteria.
- Keep PostgreSQL-compatible database access and S3-compatible object access behind server-side adapters. Configure endpoints/credentials through the server environment. Provider migration must not require changes to core decision, catalog, agent or shared domain logic. No RumptyCloud-specific assumptions enter those packages.
- Secrets remain server-side; no infrastructure/AI credentials in mobile. Exact service settings will be verified in the milestone that implements the adapters, not guessed in this decision.
- This pass changes documentation and the architecture skill only. It does not implement M5, deploy, create cloud resources or use live YouCam/LLM credits. The full intended infrastructure and execution boundary are in [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## M5 portable persistence decisions — 2026-10-02

- Implement PostgreSQL/S3 adapters in the API, with explicit memory defaults. Durable mode requires both services; no fallback to ephemeral data after a storage failure. Local Docker PostgreSQL and Adobe S3Mock provide tests without cloud resources or AI credits. Deployment provider remains configuration only.
- Retain the synchronous pure/in-memory agent executor for existing scenarios; expose validated internal snapshot restore/export to server repositories. API transactions hold the authorized session lock during bounded execution and atomically write structured state/replay data and feedback/save/event projections. No restore endpoint, model database access or altered ranking/tool semantics.
- Mobile generates a 32-byte guest bearer credential with Expo Crypto and saves it in SecureStore before use. Store only its SHA-256 principal ID on the backend. Session IDs are not credentials. Unowned old M4 records are not silently migrated/claimed; unavailable-session recovery is explicit.
- Optional email verification is provider-neutral API functionality through an EmailSender/SMTP adapter; disabled by default. Owner-bound random hashed codes are single-use with ten-minute expiry and issuance bounds. Verified same-email installations can access sessions without rewriting their decisions. Tests use an in-process outbox, not live email.
- Store private PNG/JPEG bytes through S3 with bounded decode/MIME/size validation and content-addressed keys; metadata and access authorization live in PostgreSQL. Image upload does not call YouCam or invent visual results. A failed cross-service write may leave a private orphan; safe retries take priority over deleting objects after an uncertain commit.
- Migrate/seed explicitly with checksums and insert-only fixtures. Existing catalog facts are never overwritten on startup. Local fixture setup is documented in `PERSISTENCE.md`; no RumptyCloud resource was created or deployment performed.

## 2026-10-02 — M6 visual integration

Use the documented YouCam v2 category-specific file/task REST contract behind a server-only adapter, with injected HTTP tests and mock runtime by default. Use request-driven persisted visual jobs: create queues, explicit advance submits/polls, GET only reads. Persist a claim before provider I/O; do not retry uncertain paid submissions. One active job/session, bounded polling and result reuse protect credits. Keep visual metadata separate from shopping state in portable PostgreSQL JSONB.

Mock completion must disclose that no image was generated. Image-type checks and file decoding must not be represented as anatomical detection. Optional live analysis remains unavailable without confirmed participant access and a useful feature contract; cached mock profiles contain no invented personal attributes. No live rendering/account entitlement is claimed from contract tests. Approved product assets and provider credentials remain prerequisites for activating live mode.

Mobile uses SDK57 expo-image-picker for explicit photo selection only, with camera/microphone permissions disabled. Preserve the verified composer layout. Normalize the actual returned base64 format because Android picker metadata can describe the original PNG while returning JPEG bytes; retain server decoding as the final validator.

## 2026-10-03 — M7 OpenAI validation decision

User selected OpenAI Responses, configurable `gpt-5.6-terra`, low reasoning, server-only credentials, and a maximum 25 live attempts/$1 estimated spend. Mock regression remains default; the shared durable ledger also covers physical-device requests. Keep existing deterministic plan authorization rather than expanding natural-language permissions. No YouCam credits or deployment are authorized; real YouCam rendering/analysis remains an open final-submission gate. Details/rates/validation commands: `LLM.md`.

## M8 cross-product intelligence — 2026-10-04

M8 uses explicit selected-anchor dependencies and deterministic shared-attribute complement evidence at heuristic priority. Relevant feedback transfers only along these links; size/shape/price do not transfer across accessory categories. Comparisons expose catalog facts and scoped criteria without an overall winner. This completes existing A08/A12 scope, adds no cloud/provider dependency and spends no live credits. See [decision intelligence](DECISION_INTELLIGENCE.md).

## 2026-10-07 — Scoped hackathon PostgreSQL TLS exception

Per explicit user authorization and their supplied RumptyCloud guidance, the backend may use encrypted `sslmode=require` with `DATABASE_SSL_REJECT_UNAUTHORIZED=false` for this provider's self-signed connection. Keep this exception inside the PostgreSQL adapter and migration composition, environment-driven and removable for a trusted-CA provider. Never disable TLS globally. Actual connection verified as TLSv1.3; this is an encryption check, not server certificate authentication. No domain/provider-specific logic or live AI calls are introduced.
