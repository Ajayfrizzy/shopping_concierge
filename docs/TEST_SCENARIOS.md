# Regression Scenarios

These must become automated fixtures where practical.

## A01 initial constraints
Input: "Silver earrings for a wedding under $120, elegant but not too loud."
Expect: category earrings; occasion wedding; material silver; max 120; elegant soft preference; low visual intensity signal.

## A02 cheaper preserves state
Given A01, input: "Show me cheaper ones."
Expect: only price target changes; category/occasion/material/style remain.

## A03 material replacement
Given silver, input: "Actually gold."
Expect: material becomes gold, not gold+silver.

## A04 category switch
Given wedding/gold/max budget, input: "Show me necklaces instead."
Expect: active category necklace; relevant global constraints retained.

## A05 scoped constraint
Given earrings constraint no_dangling, switch to necklace.
Expect: no_dangling not applied to necklaces.

## A06 rejection learning
Reject product tagged statement/oversized with reason too_flashy.
Expect: subsequent ranking penalizes similar soft attributes within session.

## A07 no exact match
Given impossible hard constraints.
Expect: zero exact matches + relaxation options; no violating product in exact list.

## A08 compare
Compare two valid catalog products.
Expect: deterministic factual matrix; explanation grounded in stated criteria.

## A09 VTO missing image
Request ring VTO with portrait only.
Expect: request hand image; no provider call.

## A10 VTO success
Mock provider success.
Expect: job completed and output surfaced only after success.

## A11 VTO failure
Mock provider failure.
Expect: honest failure + recovery guidance; no aesthetic interpretation.

## A12 cross-category dependency
Select E18; "find necklace that works with it."
Expect: complement dependency E18 -> necklaces and dependency-aware ranking.

## A13 return to previous category
Switch earrings -> necklace -> earrings.
Expect: earlier earrings decision state remains available.

## A14 session vs global preference
Reject flashy for work session.
Expect: session signal only unless explicitly saved/promoted.

## A15 explicit beats visual inference
Visual heuristic prefers gold; user says silver only.
Expect: silver hard preference wins.

## A16 idempotency
Submit save action twice.
Expect: one saved relationship/event semantics.

## A17 ambiguity
Input: "Something nice for Saturday."
Expect: one focused clarification, no invented category/budget.

## A18 hallucination prevention
LLM proposes unknown product ID.
Expect: backend rejects tool call/product; agent cannot display fabricated product.

## M1 automated coverage boundary

`fixtures/m1-scenarios.json` pairs utterance labels with structured actions. `tests/decision-engine.test.ts` replays each scenario prefix independently with a JSON state round trip between turns. Language interpretation is deliberately not simulated or claimed.

| Scenario | M1 coverage | Remaining later work |
| --- | --- | --- |
| A01–A05 | Constraint capture representation, cheaper preference, material replacement, global/category scope | M3 natural-language extraction; M2 search/ranking |
| A06 | Structured rejection reasons retained | M2/M8 reason-aware ranking |
| A07 | Shared hard-eligibility guard tested for new selections | M2 exact-result filtering and relaxation suggestions |
| A08 | Not implemented | M8 criteria-grounded comparison |
| A09–A11 | Not implemented | M6 image/VTO lifecycle |
| A12 | Dependency schema/selected-anchor validation and rejection invalidation | M3/M8 dependency creation and complement ranking |
| A13 | Category decision/constraint round trip and JSON restoration | M4/M5 UI/storage integration |
| A14 | Session-only rejection scope; no profile promotion | M5 explicit profile persistence |
| A15 | Explicit beats visual/saved/heuristic signals in either order | M3 extraction; M6 real visual signals |
| A16 | Repeat save emits one relationship/event; no revision increment on no-op | M5 database uniqueness/concurrency |
| A17 | Empty category/budget remain empty in domain state | M3 focused clarification |
| A18 | Engine rejects unknown/mismatched product lookup IDs | M3/M7 model/tool integration |

`tests/domain.test.ts` covers malformed values and corrupted snapshots. Runtime regressions also cover repeated explicit values across conflicting scopes, atomic invalid batches, immutable input/output boundaries, deterministic JSON-safe events, and shared source imports that must resolve in Metro. No live providers are used.

## M2 automated coverage boundary

`tests/catalog.test.ts` adds catalog search after each M1 structured scenario prefix, plus direct rejection/no-match regressions. A01–A05 now exercise catalog filtering after scoped refinements; A02 tests price preference ordering without changing budget. A06 verifies factual similarity penalties and removal of rejected IDs. A07 verifies zero violating exact matches and previews every proposal through M1 before checking eligibility. A13/A14 verify category round trips and session-only rejection effects. A15 protects explicit preferences against inference and contradictory feedback. A18 has strict catalog lookup/uniqueness and grounded result IDs; model tool execution remains M3/M7.

An independent predicate matrix checks all four categories over four budgets and three materials with global/category exclusions. Other tests cover malformed config, currency safety, unknown attributes, input/output isolation, deterministic ties/catalog permutations, result limits, feedback reversal/latest reason, and actionable multi-field/multi-scope relaxation. No natural-language extraction, dependency ranking (A12), comparison (A08), VTO (A09–A11), or persistence is claimed. All previous M0/M1 regression coverage remains.
