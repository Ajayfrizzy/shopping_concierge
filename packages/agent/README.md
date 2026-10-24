# Shopping agent

`createAgentService(catalog, planner)` orchestrates backend-owned sessions, validated tool plans, M1 transitions and unchanged M2 catalog search. `MockAgentPlanner` and `runAgentScenario` live in `@youcam/testing`. Package tests use synthetic catalog fixtures and mocked providers. Runtime composition also supports the live OpenAI planner; validated plans remain subject to deterministic authorization and transitions.

## Boundary and tools

`Planner.plan(context, signal)` returns unknown data. Shared `agentPlanSchema` accepts only a bounded intent/disposition and at most eight strict tool calls. It accepts no state replacement, product facts, tool results, generated response text, or hidden reasoning. `toolRegistry` exposes the actual argument validators and descriptions for state lookup, catalog search/lookup, constraint update/reset, category switching, and like/shortlist/save/select/reject. Unsupported tools fail validation.

The language path uses a **bounded compositional clause interpreter**, not unrestricted keyword extraction. It consumes the whole current instruction and uses authoritative state only for inherited context. Search plans may reorder/split the exact authorized updates and use equivalent search intent labels; detached simulation verifies complete effects before execution. Unknown or ambiguous instructions clarify without invoking the provider. Non-search actions retain exact matching. See [NLU hardening](../../docs/archive/acceptance/NLU_HARDENING.md) for coverage, scope semantics and limitations.

The planner receives a detached snapshot, at most 12 recent user/assistant messages, up to 20 known referenced/selected/rejected products, and tool names/descriptions. Schemas are shared code contracts, not provider-specific prompts. History is context, never shopping truth. Mutating any context object cannot change the session, catalog, or another session. Provider exceptions are normalized; the default five-second deadline aborts cooperative mocks, and late output cannot commit state.

Only backend code executes tools. Transitions run against a working snapshot with the trusted catalog lookup; all tools and response schemas must succeed before one commit. The session version is checked again after asynchronous planning. A failed tool or competing turn saves nothing. Search uses M2's unchanged default filtering/ranking and returns only backend-generated facts/evidence. Response text is a small deterministic mapping over normalized results; arbitrary planner prose cannot invent prices, stock, VTO, or confidence claims.

## Session API

- `create({ goal? })`: new opaque session ID, empty M1 state, version 0. Goal text is retained but is not parsed implicitly.
- `get(id)`: detached state, version, pending relaxation offers.
- `turn(id, request)`: strict message, direct user action, or explicit relaxation confirmation. See `docs/API_CONTRACTS.md` for HTTP examples.

`expectedVersion` is a turn version distinct from M1 state revision. Clarifications, read-only and unsupported turns increment the turn version; unchanged domain state retains its revision and produces no events. State-changing turns expose actual M1 events and field changes. Every successful turn replaces old proposal IDs; a subsequent confirmation must use the latest displayed offer and version.

Request IDs deduplicate the last 50 successful turns per session. Identical retries return the original detached response, including after the session advances; changed payload reuse returns a conflict. Concurrent duplicate requests replay one committed response, while competing different requests return a stale-session conflict. Older request IDs outside the cache still require the current version. In-memory capacity is 1,000 sessions; exhaustion is explicit. Process restart loses sessions. This is a local mock guest workflow using opaque IDs, not authenticated durable storage; M5 owns authentication, persistence, distributed transactions and retention.

## Supported mock utterances

Matching is case-insensitive, with optional final period/exclamation mark; product IDs retain exact case.

- `Silver earrings for a wedding under $120, elegant but not too loud.` Initial searches accept the four plural categories, optional silver/gold/rose gold/steel/titanium/platinum, wedding/work/party/date/everyday, USD (`$` or `USD`) or EUR (`€` or `EUR`) caps, elegant/modern/romantic/minimal, and low intensity. Clauses follow that order. Only present clauses update state.
- `Show me cheaper ones`, `More premium ones`: category-scoped price preference, never an invented cap.
- `Actually gold`, `Silver only`: explicit global material replacement, preserving other fields.
- `No dangling earrings`: unions a dangling exclusion into the earrings scope, retaining previous exclusions.
- `Show me necklaces instead`, `Back to earrings`: category switch with preserved scoped state/decisions.
- `Under $100`: active-category cap (global only before a category is known). Specify currency explicitly; the mock does not infer exchange rates or currency. Unrepresentably large amounts fail to clarification rather than rounding/inventing a cap.
- `Reset budget/material/color/occasion`: reset the active winning record's scope. A global fallback may remain; the response reports actual state.
- `Select E18`, `Shortlist E18`, `Save E18`, `Like E18`, `Reject E05 as too flashy`: product actions through trusted lookup. Rejection phrases map to the shared reason codes (spaces replace underscores). Selection revalidates current hard eligibility.
- `Tell me about E18`, `Show details for E18`, `Show my state`, `Show my constraints`, `Search`, `Show products`, `Show alternatives`.

Unknown, partially supported, ambiguous and negated inputs do not partially edit constraints. They ask one focused question. To resolve an unsupported budget phrase, resubmit the amount with currency (e.g. `Under USD 100`). This grammar does not infer pronoun product IDs or pretend to understand arbitrary language. Strict typed user actions cover M1 fields/scopes beyond these demo phrases and use the same transitions/catalog; direct updates must have explicit provenance and bypass the planner.

## Relaxation confirmation

No-match exact results remain empty. `session.pendingRelaxations` contains opaque `proposalId`, `requiresConfirmation: true`, proposed updates and supporting catalog IDs. The model has no confirmation tool. A plain `yes` asks which displayed proposal to confirm and changes no domain state.

The client must send `type: confirm_relaxation`, the displayed proposal ID, request ID, and current version. It cannot supply replacement updates or candidates. The backend checks that the offer belongs to this session/version, regenerates catalog proposals, verifies exact updates/candidates are still offered, applies the stored changes through M1, then reruns deterministic filtering. Cross-session, guessed, expired or altered proposals fail closed. Typed explicit user constraint edits remain independently valid; they are user instructions, not model acceptance of a suggestion.

## Historical M3 capabilities and validation

Comparison, visual analysis/VTO jobs and outputs, dependency/complement ranking, similar-to search and start-over through chat return honest unsupported responses with unchanged domain state. New sessions can be created through the session endpoint. Comparison/dependency intelligence belongs to M8, image/provider lifecycle M6, and live models M7. No fake implementation or fabricated tool result is used to make a demo pass.

`fixtures/m3-scenarios.json` drives complete supported multi-turn journeys through the mock planner and real engine/catalog, with JSON request/response round trips. `tests/agent.test.ts` also covers model tampering, unknown IDs, invalid facts/provenance, atomic failure, stale/altered confirmation, idempotency/concurrency, session isolation, history bounds, timeout and HTTP integration. Run `npm run check` and `npm run export:android`. Mobile remains the M0 connectivity preview until M4; M3 introduces no native changes or manual device acceptance criterion.

## M8

Comparison and selected-anchor complement search are now implemented with strict tools and deterministic services. M6 supplies the visual job lifecycle. Similar-to/start-over chat remain unsupported. See [decision intelligence](../../docs/DECISION_INTELLIGENCE.md) for current grammar, state and validation boundaries.
