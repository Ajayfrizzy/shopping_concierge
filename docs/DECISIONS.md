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
