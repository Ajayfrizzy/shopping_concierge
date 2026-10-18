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

Final status (2026-10-07): **required live VTO rendering gate COMPLETE**. Necklace-only retry with the approved wider portrait passes full pendant visibility, Samsung display and cold restoration after the live API stopped. Earrings/rings/watches retain their prior passes. Final usage **5/8 renders, 5 observed units, one targeted retry, zero OpenAI calls**. Mock runtime restored; 452-test integration validation retained. Optional unused live analysis remains disabled/unvalidated and is not certified by this rendering gate. See latest `VALIDATION.md` and final evidence. M9 is unstarted. All OPEN/blocker entries below are historical.

Latest live update (2026-10-07): **OPEN — necklace framing retry required**. All four initial live tasks completed and restored on Samsung. Earrings/ring/watch outputs are usable; necklace pendant is cropped at the source-image boundary, so HTTP completion is not accepted as a visual pass. Supply a wider approved front-facing neck/chest portrait and rerun only necklaces. Usage: **4/8 renders, 4 observable units, zero retries/OpenAI calls**; preserve the ledger. Lint/typechecks, 452 tests and Android export/secret scan pass. Mock defaults restored; isolated live API stopped. See current `VALIDATION.md` and `evidence/youcam-live/`. M9 remains unstarted. Earlier prerequisite blockers below are historical.

Latest update (2026-10-07): **asset access resolved; gate OPEN**. Updated credentials permit listing and reading all seven project-prefixed assets. Original watch key is 404; its discovered replacement is readable. Exact old probe GET is 404, so no deletion was attempted. Preflight requires a side portrait with an unobstructed ear and a wrist image including all five fingers before paid validation. Temporary access/provider configuration and durable eight-render protection remain pending. Zero live calls; mocks unchanged; M9 unstarted. See latest `VALIDATION.md` and asset-discovery evidence. Earlier access-blocked entries below are historical.

Latest discovery (2026-10-07): bucket identifier verified; configured project prefix and direct supplied watch key return S3 HTTP 403. Prefix discovery adapter added; 447 tests and Android export/secret scan pass. Samsung is connected, but live rendering remains blocked by asset access. No live calls.

Asset discovery (2026-10-07): authenticated S3 listings return zero objects under all seven supplied asset groups and both parent prefixes, without truncation. Exact uploaded key/bucket confirmation requested. ADB shows no connected device. No renders submitted; gate remains OPEN.

Update (2026-10-07): PostgreSQL now connects over TLSv1.3 using the explicit database-only `sslmode=require` verification exception. S3 access passes; exact probe deletion returns 403. 444 tests and Android export/secret scan pass. Live gate still OPEN awaiting approved assets; no live calls. Earlier CA-blocker status is superseded.

Recheck (2026-10-07): S3 HEAD passes; PostgreSQL still fails trusted TLS (`DEPTH_ZERO_SELF_SIGNED_CERT`). Approved asset locations and provider host allowlists remain unavailable. Zero live calls; gate remains OPEN.

Status (2026-10-04): **OPEN / blocked on external prerequisites**. Four initial renders plus up to four targeted retries authorized (8 maximum). Backend key is now present; S3 write/read passes after path-style configuration. PostgreSQL remains blocked by an untrusted self-signed certificate; approved asset locations and host allowlists remain missing. No live calls made. Durable usage protection and temporary asset access must be implemented before submission. See the latest `VALIDATION.md` entry. M9 has not started.

## M9 — Polish + hackathon submission

Status (2026-10-07): **complete and validated**. All three acceptance criteria pass: clean dependency install and isolated fresh guest APK, documented credential-free local mock setup, and a **106.01-second (1m 46s)** continuous Samsung UI rehearsal including labeled prior live VTO evidence. Native build/install, shopping/dependency/comparison/no-match, cold shopping/job restore, keyboard, API timeout/idempotent retry and runtime checks pass. Final lint/typechecks and **455 tests across 20 files** pass; Android export/secret scan and **20/20 Expo Doctor** pass. README, judge guide, setup, measured demo script, API/use table, credit reporting and submission notes are maintained. Original app/guest data hashes are unchanged; no uninstall or data clear. **Zero M9 live calls.** See `VALIDATION.md` and `evidence/m9/`. Known dependency advisories and final public video/portal/publication review are documented; no external submission/deployment or later milestone was performed.

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

## Pre-deployment — Constraint-relaxation UX correction

Status (2026-10-07): **complete and validated**. Search adjustments are explicitly distinguished from products, buttons name proposed changes, kept constraints are separate and confirmation/rerun copy is clear. Deterministic relaxation, ranking, catalog, state and product-card behavior are unchanged. Lint/typechecks, 458 tests/21 files and Android bundle/secret scan pass. Samsung visual review, cancel/confirm/rerun with actual catalog images, keyboard/navigation/cold restore and runtime checks pass. See `VALIDATION.md` and `evidence/relaxation-ux/`. No live credits consumed. Stop before deployment.

## Judge runtime hardening — 2026-10-09

Backend readiness/accounting and VTO eligibility are implemented and tested. Migration 005 separates judge from validation accounting; migration 006 adds private approved product assets. This work is **not fully complete for the final judge APK**: only four existing isolated product assets are available; eight more matching approved assets, later backend/catalog activation and OpenAI budget review remain. No deployment or live credit use is authorized by this status entry. See PRODUCTION_READINESS.md and latest VALIDATION.md.

## Curated VTO selection and upload preparation

Selection/manifest preparation complete: exactly two additional IDs per category (E01/E12, N01/N12, R01/R08, W11/W08). Catalog remains 72 products with unchanged ranking. Eight assets remain missing and ineligible; existing four approved references and validation ledgers are preserved. Version-2 status tracking and importer support later registration without schema changes. Remaining acceptance: obtain/upload/review eight matching assets, then separately authorized compatible-backend catalog activation. No deployment, budget activation or provider calls. See VTO_ASSET_PREPARATION.md and latest VALIDATION.md.

## Uploaded VTO assets — 2026-10-10

S3 discovery/read/MIME/hash inspection complete for all 12 objects. Eight additions recorded as uploaded; E01/E12 and W08/W11 filenames were visually swapped. E12/N12/R08/W11 require color/finish corrections. No new eligibility activated; migration 006 is not installed in the inspected database. Twelve-product readiness remains incomplete. See VTO_UPLOAD_REVIEW.md.

## VTO replacement recheck — 2026-10-10

Four corrected uploads found and verified readable with PNG MIME/decoding and hashes. E12/R08/W11 appearance mismatches resolved. N12 color resolved but top of chain cropped; one wider full-chain image still required. Seven of eight additions pass offline appearance review, none activated. Historical approved assets and budgets unchanged.


### Final N12 asset recheck — 2026-10-10

N12 full-chain replacement passes offline appearance review; all eight additions now pass this check. Exact key/hash recorded in judge manifest and n12-final evidence. Eight remain uploaded/ineligible; approval, compatible backend/schema and registration remain outstanding. No live provider calls or deployment.


## Production VTO registration and controlled live verification — 2026-10-10

All twelve curated assets registered; 12 eligible/60 ineligible. E12/N12/R08/W08 completed live rendering with decoded/displayed outputs and idempotent ledger checks. Four judge requests/units consumed, 46 remain; no OpenAI use. E12 output scale remains a quality caveat. N12 existing-task poll recovery used no extra render. 85 relevant tests pass plus lint/typechecks/build/secret scans. See VALIDATION.md and evidence/vto-judge-live/summary.json. No APK or final demo script created.


## E12 fidelity follow-up — 2026-10-10

Recorded offline diagnosis before a lossless pair-preserving tighter crop; exact v2 key/hash registered only for E12. One authorized live follow-up produced no material scale/fidelity improvement. Stop further paid iteration; E12 is not approved as a faithful statement-earring demo example. Technical registration remains active. Judge use 5/50; 45 remain. OpenAI untouched. See evidence/e12-fidelity/summary.json.


## E12 approved chandelier replacement — 2026-10-10

Explicit replacement design approved and registered; matching catalog description/display art updated. One controlled live render passed visual review with clear chandelier detail and appropriate scale. Six judge renders committed, 44 remain. Other 71 products unchanged. 162 relevant tests plus lint/types/build/export-secret scan pass. APK/demo-script work remains unstarted.

## Android acceptance fixes — 2026-10-17

Implemented bounded VTO discovery authorization, authoritative server capability filtering, shopper presentation and explicit pending-request recovery. Signed version-code-4 ARM64 APK built; 686 automated tests pass, with lint/types/build/export/signature/secret scans. Physical acceptance remains OPEN: available emulator refused installation while still booting and no phone was attached. Deploy the matching backend before the new APK's walkthrough. See ANDROID_ACCEPTANCE_FIXES.md. No live provider calls or final demo media/script.

## Final VTO UX / submission-readiness follow-up — 2026-10-18

Implementation and signed version-code-5 ARM64 APK complete; 835 automated tests pass with lint/types/API build/export/signature/secret scans. Single-action VTO, bounded polling/recovery and private expandable original/result viewing are implemented without backend/catalog/accounting changes. **Physical acceptance remains OPEN** because the connected Samsung repeatedly disappeared from USB during isolated mock-client installation. No milestone-complete or final-demo-readiness claim is made. See [VTO UX readiness audit](VTO_UX_READINESS.md) and its artifact evidence. No deployment or live provider requests.

## VTO connected-device follow-up — 2026-10-18

Samsung mock-client walkthrough now completed for the core VTO/photo/viewer/restart flow. Found and fixed React Native Android dropping original-image Authorization with object sources; array sources verified on device. Signed code-6 APK supersedes code 5. Lint/types and 783 normal tests passed (52 integration tests skipped); 17 targeted tests passed; export sentinel scan/build/signature checks passed. No live calls or production changes. Full production acceptance and remaining native failure/interruption paths stay open. See [follow-up audit](VTO_UX_READINESS.md#connected-device-follow-up--2026-10-18).

## Final production acceptance — finalized 2026-10-19

Fresh integration-enabled run: **836 passed, 0 failed, 0 skipped / 41 files**. Lint, types, API build, export/secret scans, APK signing and source-content comparison pass. Samsung installed production code 6 exactly matches the audited APK; safe native navigation/picker/expiry checks pass. Isolated native mock interruption/timeout/failure/recovery and viewer checks pass. Production budgets unchanged after device tests: OpenAI 24 requests, $0.32761480 charged-or-reserved; YouCam 10 committed renders. No paid submissions or final recording. **NO-GO for final recording:** all stored real outputs expired; approve a truthful real-result shot and the proposed sequence first. Judge APK download remains unpublished. See [full audit](FINAL_PRODUCTION_ACCEPTANCE.md) and [150-second recording plan](FINAL_DEMO_PLAN.md).
