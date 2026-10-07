# Implementation Milestones

## M0 — Repository foundation

Status (2026-10-02): **complete**. Shopping Concierge’s dedicated development APK installed and launched on a physical Samsung SM-S908N with no red runtime screen. Mock API success, unavailable-API error, and retry recovery passed. Lint, typechecks, all 29 tests, Expo dependency checks, Android bundling, and native APK build pass. See `docs/VALIDATION.md` for evidence and known dependency advisories. M1 status is recorded below.
Deliverables:

- pnpm/npm workspace initialized
- mobile Expo app scaffold
- Fastify API scaffold
- shared package and Zod
- Vitest configured
- lint/typecheck/test scripts
- `.env.example`
- mock services wired

Acceptance:

- one command installs workspace
- mobile boots
- API `/health` works
- tests/typecheck pass

## M1 — Domain models + decision engine

Status (2026-10-02): **complete**. Shared runtime schemas, pure validated transitions, scoped constraint precedence, per-category decision memory, and structured events are implemented. All three acceptance criteria pass through automated domain regression scenarios. `npm run check` passes 103 tests plus lint/typechecks; Android export passes after correcting a shared source re-export. No live calls, required manual checks, or unresolved M1 blockers remain. M2 status is recorded below; see `docs/VALIDATION.md` and `docs/TEST_SCENARIOS.md` for exact coverage boundaries.
Deliverables:

- shared schemas/types
- constraint merge/scope logic
- session decision state
- state-change events
- unit tests

Acceptance:

- cheaper/material/category-switch scenarios preserve unrelated constraints
- category-specific constraints do not bleed
- explicit preference overrides inferred preference

## Pre-M2 stabilization gate

Status (2026-10-02): **complete**. Expo SDK 57 migration, Shopping Concierge name, and adaptive launcher icon verified. Lint/typechecks, all 105 tests, Android export/native build, dependency singleton checks, and 20/20 enabled Expo Doctor checks pass. Installed versionCode 2 on Samsung SM-S908N; visible launch, launcher label/icon, mock success/error/retry, and runtime-error checks pass. See `docs/VALIDATION.md` for evidence and tracked dependency advisories. The user subsequently authorized M2; its status follows.

## M2 — Catalog + ranking

Status (2026-10-02): **complete**. Implemented 72 synthetic fixture products (18/category), validated catalog lookup, deterministic hard filtering and weighted ranking, session rejection effects, and explicit no-match relaxation proposals. All acceptance criteria pass; lint/typechecks and **170 tests across 5 files** pass, along with Android export and workspace/native singleton checks. No live integrations, required manual checks, or unresolved M2 blockers. M3 status follows. See `docs/VALIDATION.md` for evidence and coverage boundaries.
Deliverables:

- 60–80 fixture products across 4 categories
- hard filtering
- soft weighted ranking
- no-match relaxation suggestions
- tests

Acceptance:

- hard constraints never violated in exact matches
- rejection signals affect ranking
- deterministic output for same inputs

## M3 — Agent orchestration with mock LLM

Status (2026-10-02): **complete**. Strict planning/tool/request/response schemas, bounded mock interpretation, backend-owned atomic sessions, deterministic tool execution, explicit relaxation confirmation, API create/read/turn routes, and a six-scenario/31-turn harness are implemented. All M0–M2 regressions remain: **210 tests across 6 files**, lint/typechecks, Android bundling and native singleton checks pass. Adversarial tests verify planner output cannot replace state, invent facts/results, authorize extra edits, or accept relaxations. No live API calls, required manual checks, or unresolved M3 blockers. Comparison/VTO/dependency intelligence remain in their assigned later milestones. M4 status follows. See `docs/VALIDATION.md`.
Deliverables:

- tool registry
- structured agent request/response
- intent extraction/planning abstraction
- mock LLM provider
- scenario harness

Acceptance:

- full multi-turn fixture scenarios pass without real LLM/YouCam
- model cannot directly mutate state

## M4 — Mobile shopping experience

Status (2026-10-02): **complete and fully validated**. Home/chat, fixture cards, scoped changes, save/shortlist/select/reject, explicit relaxation review/confirmation and session summary are implemented. Physical Samsung SM-S908N checks pass for shopping, category/navigation state, native-journal cold relaunch, cancel/plain-yes/explicit confirmation, interrupted API request/retry and absence of runtime errors. Backend state remains authoritative. Final validation: lint/typechecks, **231 tests across 7 files**, Android export, dependency alignment and 20/20 enabled Expo Doctor checks pass. Evidence is in `docs/VALIDATION.md` and `docs/evidence/m4/`. Zero live provider calls. M5 status follows.

Deliverables:

- home/chat
- product cards
- constraint-change UI
- shortlist/reject/save/select
- session summary

Acceptance:

- full mock shopping journey usable on Android
- state survives navigation/refresh as designed

## M5 — PostgreSQL persistence/auth/S3-compatible storage

Status (2026-10-02): **complete and fully validated**. Portable PostgreSQL repositories/migrations, SecureStore guest credentials, ownership checks, optional verified-email API and private S3-compatible images are implemented. Lint/typechecks, **256 tests across 9 files** including real local PostgreSQL/S3 protocol integration, Android export/secret scan, native rebuild/install and 20/20 enabled Expo Doctor checks pass. Physical Samsung guest creation, shopping, summary/navigation, app/API/database restart recovery, refresh, explicit relaxation confirmation and timeout/retry pass with no app runtime errors. See `docs/VALIDATION.md`, `docs/PERSISTENCE.md` and `docs/evidence/m5/`. RumptyCloud remains the intended hackathon target, not a tested cloud deployment. Zero live AI/email calls or cloud resources. M6 status follows.
Deliverables:

- schema/migrations
- guest/session mode first
- optional email auth
- image storage
- repository adapters

Acceptance:

- sessions/products/feedback persist
- authorization checks exist
- no secrets in mobile bundle

## Post-M5 keyboard stabilization

Status (2026-10-02): **complete and physically verified**. Android composer uses React Native keyboard avoidance with safe-area offset. Short/multiline input, repeated keyboard cycles, chat/card scrolling, direct Send, cold launch, navigation and timeout/retry pass on Samsung SM-S908N. Lint/typechecks, all 256 tests and Android bundling pass. No native/dependency change or live AI calls. See `docs/VALIDATION.md`; M6 status follows.

## M6 — YouCam integration

Status (2026-10-02): **complete for mock-first validation**. Strict catalog/image handoff, all-category normalized server adapters, persisted owned VTO lifecycle, cached mock analysis, conditional live configuration and on-demand mobile image/job flow are implemented. **281 tests across 10 files**, lint/typechecks, Android export/secret scan, 20/20 enabled Doctor checks and native rebuild/install pass. Physical Samsung upload/lifecycle/cold-job restore, state preservation, navigation and keyboard checks pass. A discovered Android picker MIME mismatch is fixed and covered. Live rendering/account entitlement/approved product imagery and optional live analysis remain disabled/unverified; no live credits consumed. See `docs/YOUCAM.md` and `docs/VALIDATION.md` for boundaries. M7 status follows; the final-submission live-YouCam gate remains open.
Deliverables:

- server adapter
- portrait/hand/wrist validation
- earrings/necklace/ring/watch VTO methods
- visual analysis adapter where available
- mock + live provider switch
- VTO job lifecycle

Acceptance:

- all 4 categories have normalized integration path
- repeated analysis can use cache
- failures return normalized recoverable errors
- live tests are isolated and minimal

## M7 — Live LLM integration

Status (2026-10-04): **complete and validated**. Corrected category-budget provider instructions pass live device revalidation; cancel/explicit confirmation and actual native reload preserve authoritative state. All live/device gates pass with prior chat/cards/retry/cold-launch/keyboard coverage. User-approved extension retained the ledger/$1 ceiling: final 29/30 requests, 74,655 input tokens (44,911 cached), 3,512 output tokens, approximately $0.1106142. Lint/typechecks, 315 tests, Android export/secret scan and final runtime checks pass. See `VALIDATION.md` for scope, infrastructure reload recovery and exact evidence. M8 has not started. Deferred live-YouCam rendering/analysis before final submission remains OPEN.
Deliverables:

- real tool/function calling provider
- structured outputs
- guardrails against hallucinated product IDs
- context builder

Acceptance:

- regression scenarios pass at acceptable consistency
- invalid IDs rejected backend-side
- no hard-constraint silent violations

## M8 — Cross-product decision intelligence

Status (2026-10-04): **complete and validated (mock mode)**. All three acceptance criteria pass through strict services and physical Samsung UI. Lint/typechecks, 345 tests (including PostgreSQL/S3 integration), Android export/secret scan and reload/cold-launch/keyboard/error recovery pass. See `VALIDATION.md` and `DECISION_INTELLIGENCE.md`. No M8 live calls; M7 ledger unchanged. Deferred live-YouCam gate remains OPEN. M9 has not started.

Deliverables:

- dependencies
- complement ranking
- compare service
- reason-aware feedback propagation

Acceptance:

- selected earrings can anchor necklace search
- prior rejection reasons influence later relevant recommendations
- comparison is criteria-grounded

## Post-M8 — Catalog-image stabilization

Status (2026-10-04): **complete and validated**. Original local illustrations cover all 72 fixtures; fixed frames, loading/failure/missing handling and Samsung card/comparison/summary/cold-launch checks pass. Lint/typechecks, 433 tests, Android export/secret scan pass. See `CATALOG_IMAGES.md` and `VALIDATION.md`. No live credits used; live-YouCam gate remains OPEN. Stop before M9.

## Deferred live YouCam gate — preflight

Status (2026-10-04): **OPEN / blocked on external prerequisites**. Four initial renders plus up to four targeted retries authorized (8 maximum). Backend key is now present; S3 write/read passes after path-style configuration. PostgreSQL remains blocked by an untrusted self-signed certificate; approved asset locations and host allowlists remain missing. No live calls made. Durable usage protection and temporary asset access must be implemented before submission. See the latest `VALIDATION.md` entry. M9 has not started.

## M9 — Polish + hackathon submission

Deliverables:

- loading/error/empty states
- API-credit counters/logs for development
- demo fixtures/account
- README architecture section
- judge guide
- demo script
- submission notes

Acceptance:

- clean fresh-install demo path
- no dependence on developer-only hidden steps
- 1–3 minute demo can show full differentiating workflow
