# Decision engine

M1 implements pure, validated transitions over structured shopping state. It does not interpret chat, call providers, search/rank a catalog, or persist to a database.

```ts
import { createSession, transition, getActiveConstraints } from '@youcam/decision-engine';

let state = createSession({ id: 'session-1', goal: 'Wedding accessories', category: 'earrings' });
const result = transition(state, {
  type: 'update_constraints',
  updates: [
    { field: 'material', value: 'silver', scope: 'global', source: 'explicit' },
    { field: 'budget', value: { amount: 120, currency: 'USD' }, scope: 'global', source: 'explicit' },
  ],
});
state = result.state;
const active = getActiveConstraints(state);
```

## Public API

- `createSession({ id, goal?, category? })`: versioned JSON-safe state; unspecified category stays null. No inferred budget or preferences.
- `transition(state, action, context?)`: returns `{ state, events, changes }`. Validates/clones inputs before applying an atomic action. Schema failures throw Zod errors; business failures throw `DecisionError` with a stable `code`.
- `getActiveConstraints(state, category?)`: resolve only global and requested/active-category preferences. Each effective field includes its class and source evidence.
- `getHardConstraintViolations(state, product)`: deterministic category, stock, budget/currency, material/color, and exclusion guard. M2 should reuse this guard for filtering rather than duplicate it. It does not score products or suggest relaxations.
- `constraintClass(preference)`: derives hard/soft/context classification; callers cannot weaken a hard rule by supplying a class.

## Actions and trust boundary

`update_constraints`, `reset_constraint`, `switch_category`, and `feedback` are strict shared-schema actions. Source/scope must be assigned by the trusted orchestration layer after interpreting the user's instruction; the engine is not an LLM intent classifier. Model proposals must not be used as trusted catalog facts or restored session snapshots.

Product feedback (`like`, `shortlist`, `save`, `select`, `reject`) requires a backend-owned `context.getProduct(id)` lookup. Missing IDs, lookup mismatches, and wrong-category products fail closed. New selections must satisfy active hard constraints. No provider integrations are needed; tests use clearly synthetic catalog records.

## State semantics

- One constraint record per `(scope, field, source)`; scalar/list updates replace that slot. Unrelated records and category decisions survive.
- Source priority: explicit > saved preference > visual > heuristic. At equal priority, latest revision wins across applicable scopes; a category-specific record wins a same-revision tie. Reasserting an identical value can still supersede a newer contradictory scope.
- Explicit budget/material/color/exclusions are hard. Budget/exclusions accept only explicit provenance. Inferred material/color are soft. Occasion is context; style, visual intensity, and price preference are soft. Category and in-stock eligibility are always hard.
- Global and category exclusions are combined. Replace/reset the originating scope to remove an exclusion; a scoped update cannot silently drop a global one.
- “Cheaper” is represented as `pricePreference: lower` scoped to the current category. It preserves the explicit budget, currency, material, occasion, and style. Do not invent a percentage reduction. A numeric user budget uses the separate `budget` field.
- `reset_constraint` removes all source records for the named field at the named scope. Other scopes remain, so a global fallback can become active again.
- Decision lists are keyed by category and distinguish liked, shortlisted, saved, selected, rejected. Rejecting removes selected/liked/shortlisted membership and dependent anchors; saved is independent. Later positive feedback can clear rejection membership without deleting history.
- Rejection reason code/text are retained when supplied. Feedback is session-only; the engine never writes permanent user preferences. Ranking from feedback is M2/M8 work.
- Dependencies have explicit selected-product anchors. M1 validates/preserves them and removes invalidated anchors on rejection; dependency creation is orchestrated by the agent and complement ranking is implemented in the catalog package.
- Refining constraints retains prior decisions as history. Those historical selections are not guaranteed recommendations under new constraints; subsequent recommendations/comparison/VTO must revalidate current facts and hard constraints.
- Actual changes increment the revision once and emit one structured event. No-op saves/refinements/switches emit no event and keep the revision. `recentChanges` describes the last real transition; use returned `changes`/`events` for the current operation to avoid replaying stale UI messages.
- JSON round trips preserve state. Database storage, optimistic concurrency, authenticated ownership, and event delivery/deduplication are implemented in the repository/API adapter layer, outside this pure package. Session ID + revision identifies an event within a serialized session; this is not a concurrency implementation.

## Verification

`npm run check` runs the domain/engine regressions and existing M0 checks. `fixtures/m1-scenarios.json` contains structured actions paired with A01–A05/A13/A15 utterance labels. Tests replay prefixes independently with serialization between turns; they do not pretend to validate natural-language extraction. See `docs/TEST_SCENARIOS.md` for exact coverage boundaries.
