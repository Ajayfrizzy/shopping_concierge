# Catalog

M2 provides a validated, deterministic catalog snapshot, hard filtering, weighted soft ranking, and explicit no-match proposals. No provider calls, model interpretation, database writes, or mobile/API orchestration occur here. Dependency-aware complement scoring remains M8.

```ts
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { createSession, transition } from '@youcam/decision-engine';

const catalog = createFixtureCatalog();
let state = createSession({ id: 'demo', category: 'earrings' });
state = transition(state, {
  type: 'update_constraints',
  updates: [{ field: 'budget', value: { amount: 120, currency: 'USD' }, scope: 'global', source: 'explicit' }],
}).state;
const result = catalog.search(state);
const product = catalog.getProduct('E18');
```

## Catalog data and trust

`createCatalog(unknown)` parses shared product schemas, rejects duplicate IDs, and owns a detached snapshot. Use backend-controlled records, never model-supplied prices/stock. `getProduct(id)` returns a fresh copy or undefined; it also supplies M1's trusted feedback lookup interface. Search validates/clones state and returns detached shared-schema results. Caller changes cannot mutate the catalog or session.

The opt-in `@youcam/catalog/fixtures` subpath loads **72 explicitly synthetic records** from `fixtures/catalog.ts`, 18 per MVP category. Stable IDs E01–E18, N01–N18, R01–R18, W01–W18 include varied material, color, price, style and occasion tags, an out-of-stock item and an EUR item per category. All names/descriptions identify fixture data; no retailer inventory or price verification is claimed. `fixtures.invalid` image URLs deliberately do not pretend to be product photography; `vtoAssetUrl` is null. Replace with verified assets before shopper-facing product cards/VTO. Core search has no implicit fixture/default catalog or network fetch.

## Search contract

`catalog.search(state, scoringConfig = {}, options = {})` returns `{ status, exactMatches, totalExactMatches, relaxations }`:

- `category_required`: no active category; no guessed category, products, or proposals.
- `matches`: exact products ranked with evidence and per-tier scores; no relaxation proposals.
- `no_exact_match`: exact list and total are zero, with feasible proposals if any. Empty proposals are honest when no eligible stock/category/currency facts support a relaxation.

Options: `limit` 1–100 (default 20), `maxRelaxations` 0–20 (default 5). Results are limited after ranking; `totalExactMatches` reports the full count. Invalid state/config/options fail validation rather than silently weakening rules.

The M1 `getHardConstraintViolations` guard runs before scoring: active category, stock, explicit budget/currency, exact case-insensitive material/color, IDs and style-tag exclusions. Missing required attributes fail closed. There is no implicit currency conversion or material composition inference. Global/category exclusions union using M1 resolution. Currently rejected products are excluded from recommendations and proposals. A later positive reversal can restore them; saving alone cannot.

## Weighted scoring policy

Ranking compares **explicit current preference → active session rejection feedback → saved preference → visual signal → heuristic** scores lexicographically, then product ID by code-point order. A lower evidence tier cannot overwhelm a higher one through weight or number of signals. Hard filtering precedes every tier. Scores are ranking signals, not confidence or aesthetic judgments.

Within each tier, sum the contributions below. Config keys are strict finite integers from 0 to 1000; zero disables a contribution. The same catalog/state/config/options always produce the same result, including after catalog reordering and JSON restoration.

| Signal/config key | Default | Rule |
| --- | --- | --- |
| `style` | 8 | Fraction of requested unique style tags present |
| `occasion` | 6 | Exact case-insensitive occasion tag match |
| `intensity` | 5 | Low: minimal/understated/delicate; medium: balanced; high: statement/oversized/ornate. Unknown tags give no signal |
| `attribute` | 4 | Matching soft material/color; explicit material/color already filter |
| `price` | 10 | Requested lower/higher preference gives normalized ordinal price position among eligible distinct prices **within the same currency**; singleton currency groups score zero |
| `rejection` | 8 | Negative contribution per currently rejected same-category product with matching factual attributes |

Evidence contains signal, tier, contribution, matching attributes, and preference provenance or rejected-product ID. Positive decisions are preserved but do not invent a general style preference. Cross-product dependencies are preserved in state but do not affect M2 scoring. Price is a weighted soft preference; it does not replace budget or automatically dominate other explicit preferences.

### Rejection mapping

Only the latest reject event by revision for each **currently rejected** product in the active category contributes. Repeated distinct rejected items can accumulate evidence; one item's historical events do not double-count. Nothing is promoted to permanent preference or another session/category.

- `too_flashy`: overlapping statement/oversized/ornate tags.
- `too_plain`: overlapping minimal/understated/delicate tags.
- `too_large` / `too_small`: overlapping oversized/large or small/delicate tags.
- `wrong_style` / `wrong_occasion`: overlapping style/occasion tags.
- `dislikes_shape`: overlapping round/geometric/heart/oval/square tags only.
- `wrong_material` / `wrong_color`: same known catalog attribute.
- `too_expensive`: same currency and candidate price at least the rejected price; no invented budget.
- Missing reason, `other`, `owns_similar`, free text, or unavailable catalog facts: exclude the rejected ID, but infer no attribute penalty.

## No-match proposals

Each relaxation contains `requiresConfirmation: true`, explicit `updates`, and existing `candidateIds`. Updates are **proposals**, never applied during search or represented as exact matches. A trusted caller must obtain user confirmation before executing the atomic `update_constraints` action. Revalidate against current state/catalog when confirming later.

For each in-stock, non-rejected product of the active category, propose all necessary hard-field changes: raise the budget to that product's actual price in the existing currency; use known material/color; remove only the blocking exclusion entries from every originating scope. Budget/material/color changes target the active category so other categories' records remain intact. Exclusion updates explicitly identify their original scope, including global when necessary. No stock, category, currency, rejected-state, or unknown-attribute relaxation is invented. Other exclusion values remain unchanged.

Every proposal is previewed through M1's transition engine and eligibility guard. Equivalent updates group supporting IDs. Order is fewest update records, then first candidate ID; this is reproducible, not a claim of optimal tradeoffs. Multiple-field proposals are permitted for impossible combinations. Users can decline all proposals. No-match search leaves input state unchanged.

## Verification

`tests/catalog.test.ts` covers all M2 acceptance criteria, independent hard-filter matrix checks, A06/A07/A14/A15 behavior, M1 scenario-prefix replay with catalog search, evidence grounding, currency boundaries, immutability, invalid input, proposal application, and deterministic output. `npm run check` also retains all M0/M1/native regressions; `npm run export:android` checks the shared contract import boundary. M2 adds no native/mobile interaction or required live/manual acceptance check.
