# Regression Scenarios

The scenario catalog below includes original milestone acceptance notes. Historical pending M7/M8/live gates are not current blockers: use [implementation coverage](IMPLEMENTATION_COVERAGE.md) for delivered behavior and dated evidence. This reference is not a new authorization to execute live scenarios.

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

| Scenario | M1 coverage                                                                                        | Remaining later work                                 |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A01–A05  | Constraint capture representation, cheaper preference, material replacement, global/category scope | M3 natural-language extraction; M2 search/ranking    |
| A06      | Structured rejection reasons retained                                                              | M2/M8 reason-aware ranking                           |
| A07      | Shared hard-eligibility guard tested for new selections                                            | M2 exact-result filtering and relaxation suggestions |
| A08      | Not implemented                                                                                    | M8 criteria-grounded comparison                      |
| A09–A11  | Not implemented                                                                                    | M6 image/VTO lifecycle                               |
| A12      | Dependency schema/selected-anchor validation and rejection invalidation                            | M3/M8 dependency creation and complement ranking     |
| A13      | Category decision/constraint round trip and JSON restoration                                       | M4/M5 UI/storage integration                         |
| A14      | Session-only rejection scope; no profile promotion                                                 | M5 explicit profile persistence                      |
| A15      | Explicit beats visual/saved/heuristic signals in either order                                      | M3 extraction; M6 real visual signals                |
| A16      | Repeat save emits one relationship/event; no revision increment on no-op                           | M5 database uniqueness/concurrency                   |
| A17      | Empty category/budget remain empty in domain state                                                 | M3 focused clarification                             |
| A18      | Engine rejects unknown/mismatched product lookup IDs                                               | M3/M7 model/tool integration                         |

`tests/domain.test.ts` covers malformed values and corrupted snapshots. Runtime regressions also cover repeated explicit values across conflicting scopes, atomic invalid batches, immutable input/output boundaries, deterministic JSON-safe events, and shared source imports that must resolve in Metro. No live providers are used.

## M2 automated coverage boundary

`tests/catalog.test.ts` adds catalog search after each M1 structured scenario prefix, plus direct rejection/no-match regressions. A01–A05 now exercise catalog filtering after scoped refinements; A02 tests price preference ordering without changing budget. A06 verifies factual similarity penalties and removal of rejected IDs. A07 verifies zero violating exact matches and previews every proposal through M1 before checking eligibility. A13/A14 verify category round trips and session-only rejection effects. A15 protects explicit preferences against inference and contradictory feedback. A18 has strict catalog lookup/uniqueness and grounded result IDs; model tool execution remains M3/M7.

An independent predicate matrix checks all four categories over four budgets and three materials with global/category exclusions. Other tests cover malformed config, currency safety, unknown attributes, input/output isolation, deterministic ties/catalog permutations, result limits, feedback reversal/latest reason, and actionable multi-field/multi-scope relaxation. No natural-language extraction, dependency ranking (A12), comparison (A08), VTO (A09–A11), or persistence is claimed. All previous M0/M1 regression coverage remains.

## M3 automated coverage boundary

`fixtures/m3-scenarios.json` contains six full multi-turn fixtures, executed by `runAgentScenario` through the mock language interpreter, backend tool registry, M1 engine, and M2 catalog. Each turn round-trips JSON and asserts actual state/results:

- A01–A05/A13: initial constraints, cheaper, material replacement, scoped exclusion, category switch and selected-item round trip.
- A06/A14/A16: reason-based reranking, saved-item idempotency, session-scoped feedback and category return.
- A07: honest no-match and plain-yes clarification without applying changes. Separate tests explicitly confirm valid offers and reject stale, altered, cross-session or no-longer-feasible offers.
- A17: focused category/currency clarification with no invented values.
- Factual detail/state lookup and reset use actual stored catalog/constraints.
- Later-milestone fixture requests comparison/VTO/complements and asserts honest unsupported responses with unchanged domain state, not fabricated success.

Adversarial tests extend A18 to actual planner/tool boundaries: schema-valid unrequested edits, invented product IDs, facts/results/state/prose, unsupported executors, and excess tool calls are rejected. Other tests cover explicit constraints vs inference (A15 boundary), detached context/output, atomic failure, selection eligibility, client provenance, idempotency/CAS, bounded isolated history, provider timeout/failure, and HTTP create/read/turn/confirm contracts. All M0–M2 tests remain in the full suite.

A08 comparison, A09–A11 image/VTO lifecycle and A12 dependency-aware ranking remain assigned to M6/M8; M3 tests their unavailable boundary only. No live language-model quality, VTO result, authenticated persistence, or mobile shopping journey is claimed.

## M4 automated coverage and physical gate

`tests/mobile-shopping.test.ts` adds 21 mobile-client/controller integration tests against the real Fastify mock API. It covers the shopping sequence (A01/A02/A06/A13/A14/A16), explicit no-match confirmation vs plain yes (A07), catalog fact lookups/schema and identity validation (A18), saved-reference restoration without chat, lost committed responses with exact request replay, concurrent taps, stale versions/replays, offline reload without session replacement, storage failures before/after commit, corrupt journals, timeout/offline recovery, and explicit backend expiry/new session. All 210 M0–M3 tests remain.

These tests exercise portable mobile logic, not native layout, touch targets, file moves or navigation rendering. The physical Android checklist in `archive/milestones/VALIDATION.md` passed on Samsung SM-S908N on 2026-10-02; screenshots and state assertions in `docs/evidence/m4` establish the native journey, navigation, cold reload, explicit confirmation and error/retry behavior. M4 is complete. A08, A09–A11 and A12 still belong to M6/M8; no visual outcomes or comparisons are simulated here.

## M5 persistence coverage

`tests/persistence.test.ts` adds 16 portable boundary tests: guest ownership on read/write/replay/list/images, app-instance restoration, concurrency/idempotency, private decoded image storage, upload conflicts/MIME/size/integrity failures, normalized errors, optional owner-bound/single-use email proof, issuance/expiry, secure device credential creation/reuse/failure and configuration/snapshot validation.

`tests/persistence-postgres.test.ts` adds nine explicit local-integration tests (`M5_INTEGRATION=1`): migration checksums/idempotency, insert-only catalog seed, durable snapshots/feedback/save/events/replay across connections/API instances, persisted explicit relaxation confirmation, competing/duplicate transactions, real FK-triggered rollback after a session write, database ownership, S3-protocol byte retention, verified identities and idle PostgreSQL disconnect recovery. Both suites preserve all 231 M0–M4 tests. See `PERSISTENCE.md` for local services and isolation; an ordinary run without the opt-in skips the nine integration tests and does not prove durable acceptance.

The mobile secret-boundary check exports Android with six server credential sentinels and scans every exported file. Physical M5 checks additionally verify SecureStore/native compatibility and unchanged decisions after cold launch and API/database restart. Image capture, visual analysis/VTO (A09–A11), comparison (A08) and dependency-aware ranking (A12) remain M6/M8; stored bytes are not visual results.

## Post-M5 keyboard regression fixture (physical Android)

Use the dedicated SDK57 development app, mock AI and a session containing chat and product cards. Cold-launch from cache-cleared Metro before checking layout changes. Native geometry must be checked on-device; portable controller tests do not establish keyboard avoidance.

1. Focus Shopping message and enter short text. Verify the entire input and Send button are above the keyboard and tappable.
2. Enter long wrapped text plus at least four explicit newlines. Input height stays bounded, text remains editable/scrollable, and Send remains visible.
3. Close/reopen the keyboard three times. The composer returns to its bottom safe-area position on close without accumulating a gap.
4. Swipe **inside the visible chat viewport**, excluding composer/keyboard/header, until a fixture product card is visible. Keyboard remains open, draft stays unchanged and composer stays fixed. Do not use the outer UIAutomator ScrollView bounds: the Expo container can report full-screen bounds.
5. Tap Send directly with the keyboard open. One turn commits, pending request clears and existing decisions remain. Verify summary and back navigation.
6. Force-stop/cold-launch; session state restores. Open the keyboard and type again; composer stays visible.
7. Pause the local API, send a supported message, observe timeout and Retry, resume and retry. Confirm exactly one turn and no lost decisions. Always resume the API in cleanup.
8. Inspect screenshots and app-process runtime logs. Do not treat device-wide helper crashes as app crashes or infer layout success from bundling.

Passed on Samsung SM-S908N / Android 16; see `evidence/post-m5-keyboard/` and the current validation entry. No live AI services.

## M6 automated and physical coverage

`tests/youcam.test.ts` adds 24 tests: A09 image requirements for all categories; A10 queued/processing/completed mock provenance; A11 honest failure and credit-safe status retry; A18 unknown IDs/strict inputs and typed catalog handoff; ownership/conflicts/concurrent submission, analysis-cache reuse, immutable shopping view, exact injected-HTTP upload/task/poll mapping for all four live categories, HTTP error/URL validation, live config fail-closed behavior, mobile response/session/image identity and Android picker MIME conversion. The existing M3 VTO unsupported fixture is advanced to the implemented grounded handoff; comparison/dependency boundaries remain unchanged.

The PostgreSQL suite adds durable job/replay/analysis-cache validation across new connections, concurrent claims and ownership checks, retaining every prior persistence test. Final enabled suite: 281 tests/10 files (ten explicit local integration tests). No live API calls occur. The separately guarded one-render smoke script is never included in normal tests.

Physical Samsung M6 checks cover typed/card entry, on-demand system picker with labeled synthetic input, normalized upload rejection/recovery, mock lifecycle, unchanged shopping state, restored job after cold launch, summary/back navigation and repeated multiline keyboard cycles. See `evidence/m6/` and `archive/milestones/VALIDATION.md`. No live anatomy analysis, actual VTO output quality or account entitlement is claimed. A08/A12 remain M8; M7 is not started.

## M7 offline/live coverage boundary

`tests/llm-context.test.ts` protects complete authoritative state, bounded history/facts, UTF-8 limits and private product-field projection. `tests/llm-openai.test.ts` tests strict shared-schema conversion, Responses request shape, cached/reasoning-inclusive usage, persistent attempt/spend caps, fail-closed corrupt/unknown accounting, one bounded transient retry, cancellation, malformed/non-tool responses, live-mode authorization/unknown-ID rejection, real deterministic execution and replay/typed actions without extra model calls. All HTTP is injected; these tests consume no credits and do not establish model quality.

The explicitly isolated runner in `scripts/llm-live-regression.ts` tests actual live A01–A07/A13/A14/A16/A17/A18 behavior in fourteen requests before retries. It stops on first failure, allows named minimal case reruns and shares the fixed 25-attempt/$1 budget with device/API validation. See `LLM.md`. M7 live consistency remains pending credentials/results. A08/A12 remain M8; live YouCam rendering/analysis remains an open final-submission gate.

## M8 cross-product intelligence — 2026-10-04

A08 now compares actual catalog products against active criteria with explicit ineligibility. A12 selects E18, creates its necklace dependency under USD100, propagates only relevant rejection feedback and preserves earrings scope. Automated coverage: `tests/m8.test.ts` and PostgreSQL restart/replay case. Device checklist: select/reject anchor-category products; coordinated search; two-card comparison; summary action; reload/cold restoration; error/retry; keyboard; runtime scan. Live YouCam validation remains deferred and OPEN.

## M9 published demo regression — 2026-10-07

`fixtures/m9-demo.json` and `tests/m9-demo.test.ts` replay the published mock goal, reasoned rejection, cheaper refinement, grounded VTO image handoff, selected anchor, scoped necklace budget, eligible comparison, earrings return and honest no-match through authenticated HTTP routes. They verify state readback and plain-yes non-confirmation. `tests/demo-environment.test.ts` verifies that demo startup excludes inherited live credentials/cloud targets and forces local mocks. Existing A01–A18 coverage remains intact. These tests do not establish native installation, layout, photo picking or three-minute timing; those M9 checks subsequently passed on Samsung, with a 106.01-second recorded rehearsal and evidence in `archive/milestones/VALIDATION.md`. A native-launcher regression also checks the actual flags against the installed Expo CLI bundler resolver.

## PostgreSQL YouCam ledger — 2026-10-08

`tests/youcam-ledger.test.ts` covers configuration, initialization, once-only migration/history import, atomic reservation, idempotent commit, conflicting/parallel duplicates, concurrent ceilings, independent request/unit limits, restart persistence, missing schema, limit mismatch, database failure rollback and commit recovery. Real PostgreSQL cases require `M5_INTEGRATION=1`. `tests/youcam.test.ts` additionally verifies that persistent reservation rejection/duplicates prevent paid POST, acknowledgement commits once, and uncertain provider/commit outcomes never trigger an automatic resubmission. All provider HTTP is injected; no paid calls occur.

## Judge runtime hardening

Runtime accounting tests apply migrations to fresh isolated PostgreSQL schemas, preserve validation history, and verify approval gating, concurrent caps, duplicate/conflicting settlement, cached-token spend, restart, missing schema, malformed usage and failure recovery. Eligibility tests verify normal unavailable responses and typed agent fallback, private signing at submission, and absence of private references in responses. Readiness tests inject dependency failure/recovery and secret-bearing errors; live provider calls are never made.
