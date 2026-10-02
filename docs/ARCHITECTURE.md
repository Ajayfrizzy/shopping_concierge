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
Use Supabase/PostgreSQL. JSONB is acceptable for hackathon-speed fields such as constraints, decision state, and normalized visual profile, while core relational identifiers remain explicit.

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

`@youcam/decision-engine` is a pure state-transition package using `@youcam/shared` schemas. It accepts a validated session snapshot, typed proposed action, and (for product feedback) a backend-owned catalog lookup; it returns a new snapshot and structured state-change events. It cannot write the database or call LLM/YouCam. API/session orchestration remains M3 and persistence remains M5. The M0 mobile preview continues to call only the foundation endpoint.

The hard-constraint eligibility guard is reusable by the future catalog implementation; search/scoring/no-match handling are not implemented in M1. Categories are centralized in the shared schema, and per-category state uses a map rather than separate category implementations.

## M2 catalog boundary

`@youcam/catalog` owns a validated private catalog snapshot and deterministic search/lookup. It depends on shared product/search schemas and the M1 decision engine's hard eligibility/transition contracts. Search returns grounded score evidence or explicit confirmation-required relaxation proposals without changing state. The opt-in fixture entry point supplies 72 synthetic development records; no network/provider calls occur. API tool orchestration remains M3, product UI remains M4, persistence M5, and dependency-aware scoring M8. See `packages/catalog/README.md` for the scoring hierarchy and no-match semantics.
