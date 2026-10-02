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

Status (2026-10-02): **complete**. Implemented 72 synthetic fixture products (18/category), validated catalog lookup, deterministic hard filtering and weighted ranking, session rejection effects, and explicit no-match relaxation proposals. All acceptance criteria pass; lint/typechecks and **170 tests across 5 files** pass, along with Android export and workspace/native singleton checks. No live integrations, required manual checks, or unresolved M2 blockers. M3 is not started. See `docs/VALIDATION.md` for evidence and coverage boundaries.
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
Deliverables:
- home/chat
- product cards
- constraint-change UI
- shortlist/reject/save/select
- session summary

Acceptance:
- full mock shopping journey usable on Android
- state survives navigation/refresh as designed

## M5 — Supabase persistence/auth/storage
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

## M6 — YouCam integration
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
Deliverables:
- dependencies
- complement ranking
- compare service
- reason-aware feedback propagation

Acceptance:
- selected earrings can anchor necklace search
- prior rejection reasons influence later relevant recommendations
- comparison is criteria-grounded

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
