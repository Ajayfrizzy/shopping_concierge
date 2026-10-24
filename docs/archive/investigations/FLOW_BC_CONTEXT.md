> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](../acceptance/FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](../demo/FINAL_DEMO_PLAN.md), still not executed.

# Flow B/C explicit references

Message requests now accept an optional, single `productContext: { productId: "E01" }`. Arrays, extra fields and caller-supplied categories are rejected by the strict request schema. Existing messages/actions need no change. The service looks up the product and derives its category; unknown products or a category different from the active category fail before planner invocation. Context supplies identity only, never authority for unrelated actions.

The rejection modal has a free-text explanation field and send button bound to that card's product ID. Existing structured reason buttons still use deterministic actions. The mobile journal includes context in retries. Context is not guessed from result ordering, prior chat or recommendation presence. Mobile changes require a future app update; backend deployment alone cannot add the card field to an installed app. Native interaction was not device-tested in this task.

Supported bounded rejection wording: “I don't/do not like this/that one/product [because …]”. A single valid explicit context is required. The complete trimmed sentence is stored as reasonText (maximum 1000 characters; longer contextual explanations clarify). “too minimal/plain”, optionally preceded by “it feels/is”, maps to too_plain. Other reasons are retained as raw text with reasonCode other; no unsupported preference is inferred. The planner receives the resolved context and documented reason rule but deterministic authorization requires the exact reject/search plan and rejects changed targets/reasons or unrelated actions atomically.

Selected/chosen means the existing deliberate `feedback: { action: "select", productId: "E09" }` decision. Recommendations are transient search results; shortlisted and saved are separate relationships; none constitutes selection. Rejected products are excluded from search and removed from selected/liked/shortlisted state, with dependent anchors invalidated by existing domain rules.

“Now find me a necklace that works with the earrings I chose” (or selected, and analogous supported categories) resolves only the named category's structured selected IDs. Exactly one is required. No selection, multiple choices or same-category continuation clarifies. It creates:

```json
{"anchorProductId":"E09","anchorCategory":"earrings","targetCategory":"necklaces","type":"complement"}
```

The existing selected-anchor validation then applies. The plan is create_dependency, switch_category, search_products, without constraint edits. Existing global budget/material and soft preferences stay global; nothing is silently copied to a new scope, removed or relaxed. Repeating the relationship uses existing domain idempotency. Exact deterministic plan authorization remains deliberately strict.

Local sequence: Flow A version 1; contextual E01 rejection version 2, reason too_plain and exact raw sentence; explicit E09 select version 3; Flow C version 4 with E09 dependency and grounded silver necklaces within the existing USD80 ceiling. Rejection removes E01; an isolated similarity regression proves a documented minimal candidate gets the existing -8 feedback penalty without hard exclusion. Flow C survives a serialized session snapshot/restore. Adversarial targets, missing/ambiguous references and extra actions fail closed with unchanged snapshots.

No production preflight or live provider calls are part of this change. Deploy the backend before controlled B/C validation and supply productContext through the updated client or an explicit request. Deployed OPENAI_MAX_ATTEMPTS=1 and the normal healthy-readiness/accounting gate remain required. No APK or automated demo script was created.

Validation: 673 tests across 34 files passed; lint, typechecks, API build and seven-sentinel Android export secret scan passed. No native device UI acceptance is claimed.
