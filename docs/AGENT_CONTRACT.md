# Agent Contract

## Responsibilities

The agent may interpret, plan tool calls, request missing information, and explain normalized results. It may not fabricate products, prices, stock, API outputs, or visual facts.

## Intent taxonomy

- start_search
- refine_search
- switch_category
- select_product
- shortlist_product
- reject_product
- save_product
- request_vto
- compare_products
- request_alternatives
- request_similar
- request_cheaper
- request_more_premium
- create_cross_product_search
- ask_product_question
- reset_constraint
- start_new_session

## Tool set

- get_session_state
- update_constraints
- search_products
- get_product
- shortlist_product
- reject_product
- save_product
- select_product
- compare_products
- get_visual_profile
- analyze_visual_profile
- request_vto
- get_vto_result
- switch_category
- create_dependency

## Constraint classes

### Hard

Must never be silently violated: category, maximum budget, explicit material/color restrictions, explicit exclusions, stock availability.

### Soft

Ranking signals: elegant, understated, romantic, modern, unusual, work-appropriate, etc.

### Context

Occasion/use context: wedding, work, date, everyday, party, etc.

## Precedence

- Most recent explicit user instruction wins.
- Explicit user preference outranks inferred visual/style heuristic.
- Refinements modify only relevant fields and preserve unrelated active constraints.
- Category-specific constraints do not automatically bleed into other categories.

## Rejection learning

Capture reason codes when possible:

- too_expensive
- too_flashy
- too_plain
- too_large
- too_small
- wrong_material
- wrong_color
- wrong_style
- wrong_occasion
- dislikes_shape
- owns_similar
- other

Default feedback scope is session. Do not silently promote a session rejection to permanent profile preference.

## Product states

Distinguish:

- liked/positive feedback
- shortlisted
- saved
- selected
- rejected

Only `selected` products should automatically become anchors for cross-product dependencies.

## Dependency types

MVP:

- complement
- alternative_to
- match

## VTO rules

- Never call VTO for nonexistent products.
- Verify category support and required image type.
- Reuse valid cached analysis/results where appropriate.
- Never claim success until provider result is completed.
- If failure occurs, state that rendering failed; never interpret failure as a style judgment.

## No-match behavior

If no exact product satisfies all hard constraints, return no exact match and structured relaxation options. Never slip violating products into the main recommendation list.

## Explanation grounding

Every recommendation explanation must map to real catalog attributes, active constraints, feedback history, or normalized visual signals. Avoid objective beauty claims.

## Response shape

The agent should produce structured output equivalent to:

```ts
interface AgentResponse {
  message: string;
  ui?: {
    type: 'product_list'|'product_detail'|'comparison'|'vto_result'|'request_image'|'constraint_update'|'empty_state';
    payload: unknown;
  };
  stateChanges?: Array<{field:string; previous?:unknown; current?:unknown}>;
  suggestions?: Array<{label:string; action:string; payload?:unknown}>;
}
```

## M1 executable state contract

Shared `decisionActionSchema` supports constraint update/reset, category switch, and structured product feedback. Agent tool routing/language extraction remain M3 work. Tool execution must load the authoritative session and catalog records on the backend; it must not accept model-provided session snapshots, prices, stock, or lookup callbacks as truth.

“Cheaper” can be proposed as a current-category `pricePreference: lower` without inventing a new budget. Preserve explicit budget/currency until the user supplies a replacement. Scope/provenance must reflect the actual instruction; a model guess must never be mislabeled explicit. See the decision-engine README for transition, precedence, reset, idempotency, and error semantics.

## M2 catalog handoff

The backend catalog lookup/search now supplies validated existing products, deterministic ranking evidence, and no-match proposals. Consume only its `exactMatches` as current recommendations. `relaxations` require user confirmation before the backend applies their explicit scoped updates; do not silently execute them or label their candidates exact matches. A `category_required` result does not authorize inventing a category. Orchestration/tool routing remains M3. Fixture records are synthetic test data, not verified merchant inventory or live VTO evidence.

## M3 implemented trust boundary

The mock provider proposes only `agentPlanSchema` tool calls; it cannot return product facts, state replacements, confirmations, tool results or arbitrary answer prose. The backend independently matches effects to the supported current-message grammar and executes them on a working snapshot through M1/M2. Unsupported/negated/ambiguous phrases do not partially update state. This bounded grammar is not general live LLM interpretation; M7 must preserve the same authority checks when broadening it.

Typed client user actions require explicit update provenance. Relaxation acceptance is a separate `confirm_relaxation` request with a session-owned offer ID and current turn version; the backend retrieves/revalidates its own updates and reruns exact filtering. A model plan or plain yes cannot approve it. Failed/unknown tools, provider errors, invalid IDs and concurrent stale turns save no partial shopping changes. Structured responses expose actual M1 events and backend catalog facts only.

## M6 try-on handoff

The exact mock grammar `Try on <catalog ID>` supports `request_vto({productId})`. Backend catalog lookup validates the ID and returns `ui.type=request_image` with productId/requiredType. The tool does not accept photos, URLs, replacement state, provider parameters or results. It authorizes opening the same on-demand flow as a card action; image selection and explicit rendering remain separate owned API steps. Ambiguous try-on utterances remain unsupported rather than selecting a product from chat inference. No decision/constraint/rejection state changes and no provider call occur in this agent turn. Unknown IDs roll back. Comparison and dependencies were added in M8 below.

## M8 cross-product intelligence — 2026-10-04

M8 enables strict `create_dependency` and `compare_products` tools. Plans must match the authoritative bounded intent, including exact anchor/compared IDs; no invented facts, extra state mutations or silent relaxation. Comparison UI contains normalized catalog facts, active criteria and eligibility. See [decision intelligence](DECISION_INTELLIGENCE.md).

### VTO discovery language

Bounded combined shopping searches accept explicit `with virtual try-on available` or `that support virtual try-on` suffixes as the global `vtoOnly=true` constraint, not a render command. Material is optional; omission preserves existing constraints. Explicit combined-search budgets retain global update semantics. Unsupported clauses fail closed. UI discovery uses the existing typed constraint action and requires no model request.

### Compositional search authorization — 2026-10-18

Search clauses can now appear in varied order with common intent openings, singular categories and bounded preference synonyms. All text must be consumed, without contradictory values. Unsupported interpretation clarifies before a provider request. Search proposals must contain exactly the authorized explicit updates; equivalent ordering/grouping and search intent labels are accepted only after detached simulation and resolved-effect comparison. Other tool authorization and explicit relaxation confirmation remain unchanged. See [NLU hardening](archive/acceptance/NLU_HARDENING.md) for semantics, diagnostics, offline evaluation and limitations.
