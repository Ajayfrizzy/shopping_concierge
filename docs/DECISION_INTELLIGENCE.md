> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](FINAL_DEMO_PLAN.md), still not executed.

# M8 decision intelligence

M8 runs with mock planning and mock YouCam by default. No live calls are required or authorized for this milestone. M7's OpenAI adapter and budget ledger remain intact; the additional M8 prompt/tool vocabulary is covered by mock contracts, not a new live quality claim. Live YouCam rendering/analysis remains an OPEN final-submission gate.

## Selected anchors

`create_dependency` accepts a strict dependency with type `complement`, a real selected anchor ID/category and a different target category. Saved/shortlisted products alone are insufficient. One anchor per target is replaced explicitly; other relationships and constraints are preserved. Repeating an identical action is idempotent. Rejecting an anchor removes its dependencies. The action alone does not switch categories; a coordinated search uses dependency creation, category switch, optional category-scoped explicit budget and search in one validated atomic turn.

Supported bounded example: select E18, then `Now find a necklace that works with this under $100`. `this`/`it` requires exactly one selected product outside the target category; otherwise clarification is required. An explicit selected ID resolves ambiguity. Summary buttons use that explicit ID.

## Deterministic evidence

Hard filtering precedes scoring. Shared material, color, style and occasion with the anchor contribute only to the lowest (heuristic) tier. Explicit preferences and relevant feedback therefore retain precedence regardless of heuristic weight. Evidence names the anchor and exact shared catalog attributes; it makes no visual compatibility claim.

Rejection feedback travels only through explicit selected-anchor relationships. Matching style/intensity, occasion, material and color reasons can influence the target category. Price, size, shape, missing/other and ownership reasons do not cross categories. Only the latest active rejection is used; positive reversal removes the penalty. Unlinked categories and other sessions remain unaffected. Feedback never silently creates a hard exclusion or permanent preference.

## Comparison

Two distinct actual catalog IDs from the active category return detached catalog facts, active scoped criteria, hard-rule violations, rejection status and ranking evidence. Out-of-budget, out-of-stock and rejected products can be inspected but are clearly marked ineligible, never recommended. Unknown attributes stay unknown. There is no invented overall winner, exchange-rate conversion or visual analysis.

Chat `Compare N01 and N02`, the two-card Compare controls and owned POST `/v1/sessions/:id/compare` share this deterministic catalog service. Comparison does not mutate domain state. An agent comparison still participates in normal transport versioning/replay. The direct endpoint is read-only and invokes no planner. Dependencies persist in the existing PostgreSQL session JSON; no schema migration or provider-specific infrastructure change is needed.

## Validation

`tests/m8.test.ts` covers anchors, ranking precedence/determinism, relevant propagation, comparisons, strict ownership, planner tampering and confirmation. `tests/persistence-postgres.test.ts` includes dependency/comparison restoration and replay across API instances. Full M0–M7 regressions remain enabled. See `archive/milestones/VALIDATION.md` for physical-device evidence and the final gate status.
