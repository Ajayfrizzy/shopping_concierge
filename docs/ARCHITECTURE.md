# Architecture

## Principle

AI proposes actions; deterministic services own truth.

## Components

- `apps/mobile`: presentation layer, chat, product cards, image capture/upload, VTO viewer, compare, saved items.
- `apps/api`: authentication, session APIs, tool execution, YouCam/LLM credentials, persistence.
- `packages/agent`: intent interpretation, tool planning, structured agent response.
- `packages/decision-engine`: constraint merging, scopes, feedback propagation, session transitions.
- `packages/catalog`: deterministic filtering/ranking over real products.
- `packages/shared`: Zod schemas and shared TypeScript types.
- `packages/testing`: mock LLM/YouCam providers and scenario runner.

## High-level flow

Mobile -> API -> Agent Engine -> deterministic tools/services -> normalized results -> Agent explanation -> Mobile UI.

The LLM never directly writes database state. It proposes validated actions executed by backend services.

## Persistence

The intended hackathon database is RumptyCloud Managed PostgreSQL, accessed through server-side repository adapters using standard PostgreSQL-compatible queries and migrations. JSONB is acceptable for hackathon-speed fields such as constraints, decision state, and normalized visual profile, while core relational identifiers remain explicit.

## Hackathon infrastructure

Backend/API: RumptyCloud managed app deployment. Database: RumptyCloud Managed PostgreSQL. Object storage: RumptyCloud S3-compatible storage. Mobile remains Expo / React Native; external AI remains YouCam APIs and the selected LLM provider behind server-side adapters. This is a demo deployment choice, not a permanent production-cloud commitment.

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for configuration, portability and execution boundaries. API composition owns database/object-storage/provider adapters; infrastructure assumptions must not enter the decision engine, catalog, agent or shared domain packages. Use standard PostgreSQL and S3-compatible access with server-side environment-driven secrets. No deployment or cloud resource creation is authorized by this documentation change. Current mock runtime and M5 acceptance criteria are unchanged.

## Image types

- portrait: earrings/necklaces/face analysis
- hand: rings
- wrist: watches

Request an image only when required by the current operation.

## YouCam adapter

One server-side adapter normalizes all YouCam interactions:

- analyzeFace
- analyzeColor (if enabled/available)
- tryOnEarrings
- tryOnNecklace
- tryOnRing
- tryOnWatch

It owns auth, request validation, polling, error normalization, retries, credit-aware logging, and output mapping.

## VTO jobs

Represent VTO as jobs: queued -> processing -> completed|failed. Mobile must not assume synchronous completion.

## LLM context

Provide only:

- current session state
- recent relevant messages
- selected/rejected products
- structured preference summary
- visual-profile summary
- tool schemas

Do not send entire DB or rely on full chat transcript for state.

## Security

- secrets server-side only
- validate all product/session IDs
- validate upload MIME/size
- per-user authorization
- rate-limit expensive endpoints
- never trust model-produced IDs without backend validation

## M1 domain boundary

`@youcam/decision-engine` is a pure state-transition package using `@youcam/shared` schemas. It accepts a validated session snapshot, typed proposed action, and (for product feedback) a backend-owned catalog lookup; it returns a new snapshot and structured state-change events. It cannot write the database or call LLM/YouCam. API/session orchestration remains M3 and persistence remains M5. The foundation preview initially called only the foundation endpoint; M4 wiring is described below.

The hard-constraint eligibility guard is reusable by the future catalog implementation; search/scoring/no-match handling are not implemented in M1. Categories are centralized in the shared schema, and per-category state uses a map rather than separate category implementations.

## M2 catalog boundary

`@youcam/catalog` owns a validated private catalog snapshot and deterministic search/lookup. It depends on shared product/search schemas and the M1 decision engine's hard eligibility/transition contracts. Search returns grounded score evidence or explicit confirmation-required relaxation proposals without changing state. The opt-in fixture entry point supplies 72 synthetic development records; no network/provider calls occur. API tool orchestration remains M3, product UI remains M4, persistence M5, and dependency-aware scoring M8. See `packages/catalog/README.md` for the scoring hierarchy and no-match semantics.

## M3 executable orchestration boundary

`@youcam/agent` now owns mock planning contracts, strict tool registry, current-message authorization, atomic working-state execution and structured response mapping. It holds local in-memory guest sessions through a service interface; no database or authenticated persistence is claimed. `@youcam/testing` supplies `MockAgentPlanner` and the multi-turn scenario runner without calling providers. `apps/api/src/shopping.ts` wires create/read/message endpoints to this service and the synthetic fixture catalog. The M4 mobile integration is described below.

Plans cannot contain replacement session state, product facts, tool results, or freeform response text. The backend uses the bounded mock grammar to authorize edits independently of planner history/inference, then executes M1 transitions and M2 search with trusted lookups. API user actions and opaque-ID relaxation confirmations are distinct from model plans. Session version checks prevent overlapping async turns from overwriting state; retry IDs return cached responses. Live model interpretation/auth/storage and distributed concurrency remain later work.

## M4 mobile boundary

The root `ShoppingProvider` owns a testable session controller shared across Expo Router home and summary screens. A typed HTTP client parses shared response schemas and sends strict M3 message/action/confirmation requests. No catalog scoring, constraint merging, inferred preference authority or provider calls run on the phone. The summary reads existing product facts through the M4 product endpoint.

A private Expo FileSystem journal contains only the session ID, bounded display history and pending request (including the original idempotency token). Journal writes precede mutations; unknown outcomes replay that request. Backend GET reconciliation prevents old cached responses from replacing newer state. An unreadable journal or offline restoration blocks new changes until recovery or deliberate reset. App reload fetches the authoritative in-memory API state; API restart expires it explicitly. This local recovery mechanism is not M5 durable authenticated persistence.

Cards show only exact results, in server order, with synthetic-data disclosure and no invented imagery. Relaxations stay separate and require a review/confirm modal. Comparison/VTO are honestly unavailable until their assigned milestones.

## M5 executable persistence boundary

`apps/api/src/persistence` implements injectable memory/PostgreSQL repositories, memory/S3 object stores, guest-credential ownership and optional SMTP email verification. The API composes these from validated server environment configuration. `packages/agent` exposes validated internal snapshot restore/export for the repository without importing database/storage SDKs or changing tool authorization. PostgreSQL transactions commit the snapshot/replay state and relational feedback/save/events together under an ownership-checked session lock. Catalog facts load from the repository into the unchanged deterministic search implementation.

Mobile uses Expo Crypto and SecureStore for its runtime guest credential; the existing FileSystem journal still stores only session reference, display history and pending request. PostgreSQL restores structured decisions across app/API/database restarts, independent of chat. Optional email authentication and private image storage are API facilities; VTO/image-capture UI remain M6. See [PERSISTENCE.md](PERSISTENCE.md) and [API_CONTRACTS.md](API_CONTRACTS.md). No cloud deployment or live AI integration is introduced.

## M6 visual boundary

The API composes a mock/live YouCam adapter behind owner-checked visual routes. `request_vto` in the agent is a strict catalog-ID/image-requirement handoff, not a provider executor. Mobile uses the same visual routes for typed requests and card actions, validates returned identities/provenance, and restores job history from the session repository. The existing shopping controller, SecureStore credential and keyboard-avoiding chat layout remain authoritative and unchanged in behavior.

A separate validated `visual_sessions` JSONB record stores jobs/internal task references/cache under the existing owned-session lock. Provider I/O runs outside database transactions; persisted claims prevent automatic duplicate submissions after uncertain outcomes. PostgreSQL and S3 portability is preserved. See [YOUCAM.md](YOUCAM.md) for protocol, mock disclosure, state/credit boundaries, conditional analysis and unverified live prerequisites.

## M7 live planning adapter

The API composes an environment-selected mock or OpenAI Responses planner behind the existing domain-neutral `Planner` boundary. `apps/api/src/llm` owns context projection, provider HTTP/schema conversion, server credentials and credit accounting; core packages contain no OpenAI or hosting configuration. See [LLM.md](LLM.md). Deterministic state/catalog authorization and explicit relaxation confirmation remain independent of model output.

## M8 cross-product intelligence — 2026-10-04

M8 adds deterministic dependency transitions to the decision engine and complement evidence/comparison to the catalog. Strict agent plans compose those services; mobile presents their normalized results. PostgreSQL stores existing session JSON without a migration. See [decision intelligence](DECISION_INTELLIGENCE.md).

## Judge runtime preparation

API-only accounting adapters provide PostgreSQL judge ledgers behind existing provider interfaces. Historical validation remains separate. Production composition supplies an allowlisted runtime description to /ready, with catalog/S3/ledger dependency checks; /health remains basic liveness. Provider credentials are never probed by readiness. Private catalog VTO references are resolved and signed server-side at submission, while product eligibility drives the agent/UI. See PRODUCTION_READINESS.md for limits, activation order and outstanding assets.

## Compositional instruction authorization — 2026-10-18

The agent now consumes bounded shopping clauses in varied order and independently authorizes exact requested effects. Search plans may differ in grouping/order and search intent label, but must pass sequential simulation, complete-update checks and resolved-effect comparison. Unsupported/ambiguous instructions clarify before provider invocation. API logging receives only a fixed authorization rule and call index; shopper errors remain safe plain language. Persistence/accounting/confirmation boundaries are unchanged. See [NLU hardening](NLU_HARDENING.md).
