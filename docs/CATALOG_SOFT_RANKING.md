> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](FINAL_DEMO_PLAN.md), still not executed.

# Explicit soft-preference ranking — 2026-10-16

Flow A is grounded but inventory-constrained. This change is local only; no provider requests, database writes, deployment, product identity/price changes or VTO registration changes were performed.

## Root cause

Hard eligibility runs before ranking. Only E01 ($35), E02 ($65) and E09 ($50) satisfy in-stock silver earrings within USD80. E05 ($110), E12 ($180), E14 ($90) and E18 ($100) exceed the ceiling; E16 is out of stock, E17 is EUR, and other earrings have different materials. Stronger statement designs were filtered out correctly, not ranked below E01.

The fixture occasion vocabulary contains only everyday, work, wedding, date and party. Exact string matching gave zero occasion score to evening/daytime/professional. None of the 72 items has lightweight metadata. E02 and E09 each received 4 elegance points (one of two requested style tags), no intensity points, and tied; lexical ID ordering put E02 first. Conflicting understated/delicate tags did not lower high-intensity relevance.

## Changes

- Exact occasion metadata keeps the full configured bonus (default 6). A bounded directional compatibility map grants half (3): evening accepts formal/party/wedding/date; formal accepts evening/wedding; daytime accepts everyday/work; professional accepts work/business. This is a soft compatibility rule, not a claim that a wedding occurred at night or a new product attribute. Evidence retains actual source tags; multiple compatible tags do not stack.
- Visual intensity retains its supported-tag bonus (5). Opposing documented tags subtract half (2.5): high conflicts with minimal/understated/delicate; low conflicts with statement/oversized/ornate. Unknown or balanced metadata is neutral. Mixed support/conflict gets both contributions. Soft mismatches remain eligible.
- Existing explicit/feedback/saved/visual/heuristic precedence, config weights, hard filtering, deterministic ID tie-breaking and no-relaxation semantics remain intact.
- Lightweight scores only for an actual matching style tag. Neither small dimensions nor delicate styling establishes weight. No weight data or product metadata was invented. No fixture metadata changes were necessary for this bounded improvement.

## Flow A local replay

The exact prompt runs through MockAgentPlanner, authorization, deterministic tools and session persistence. Version advances to 1 and the response retains the unverified-weight disclosure.

| Product | Before explicit score | After | Fit and limitation |
| --- | ---: | ---: | --- |
| E09 | 4 | 7 | Silver, $50, elegant/balanced; wedding compatibility; not a statement design |
| E02 | 4 | 4.5 | Silver, $65, elegant, wedding/date compatibility; delicate/small conflicts with noticeable |
| E01 | 0 | -2.5 | Silver, $35; minimal/understated conflicts with noticeable and work/everyday offers no evening boost |

Before: E02, E09, E01. After: E09, E02, E01. The same three products remain because there are only three hard-eligible items. No claim is made that all now strongly match evening/statement intent. Genuine statement inventory within USD80 or an explicit shopper-approved higher budget would be needed for that. At USD200, bold evening ranks E05/E12 first; elegant high-intensity evening ranks E12 first. These are separate local test cases, not changes to Flow A's budget.

## Validation and deployment

Eleven new regressions cover subtle daytime, minimal professional, bold evening, elegant high-intensity budgets, exact vs compatible occasions, grounded weight evidence, opposing/unknown intensity, deterministic catalog permutations, hard guards, and end-to-end mock Flow A. See tests/catalog-soft-preferences.test.ts.

Production catalog seeding is insert-only, but this change needs no catalog reseed/migration: compatibility and scoring apply to existing metadata after backend deployment. No deployment was performed. Flow B/C remain separately controlled live validations after deployment/readiness/accounting checks; no new Flow A or live call is needed to prove the deterministic ranking behavior. Strong statement fit under USD80 remains unavailable and must not be represented as resolved.

Final verification: **664 tests / 33 files passed**, including local PostgreSQL/S3 integration; lint, API/mobile typechecks and API build passed. Initial local integration services were stopped and were started before the successful full run.
