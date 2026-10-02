# Data Model

## Tables
### users
Managed by Supabase Auth.

### shopping_sessions
- id
- user_id nullable for guest
- goal
- status
- active_category
- constraints_json
- decision_state_json
- created_at
- updated_at

### chat_messages
- id
- session_id
- role
- content
- created_at

### products
- id
- category
- name
- brand
- price
- currency
- material
- color
- style_tags
- occasion_tags
- description
- image_url
- vto_asset_url
- in_stock

### product_feedback
- id
- session_id
- product_id
- action
- reason_code
- reason_text
- scope
- created_at

### saved_products
- id
- user_id/session_guest_id
- product_id
- created_at

### user_preferences
- user_id
- preferences_json
- updated_at

### visual_assets
- id
- user_id/session_id
- type: portrait|hand|wrist
- url
- hash
- created_at

### visual_profiles
- id
- visual_asset_id
- provider
- profile_json
- created_at

### vto_jobs
- id
- session_id
- product_id
- visual_asset_id
- category
- status: queued|processing|completed|failed
- provider_job_id
- output_url
- error_code
- created_at
- updated_at

### agent_events
- id
- session_id
- event_type
- payload_json
- created_at

## Domain state
Constraints should encode scope:
```ts
type ConstraintScope = 'global' | { category: Category };
```

Decision state should track shortlisted, selected, rejected, active category, dependencies, and recent state changes.

## M1 implemented domain contract

Runtime source of truth: `packages/shared/src/domain.ts`. Types are inferred from strict Zod schemas. `packages/shared/domain.ts` remains a compatibility entry point. Database tables above remain planned for M5; this domain implementation is not database persistence.

`ShoppingSession` contains `schemaVersion: 1`, `id`, monotonic integer `revision`, `goal`, nullable `activeCategory`, `constraints`, `decisions`, `feedback`, `dependencies`, and `recentChanges`. A snapshot is sufficient to resume deterministic transitions without chat history. There are no clocks, random IDs, provider calls, or database writes in a transition.

A constraint is `{ preference: { field, value, scope, source }, revision }`. Scope is `global` or `{ category }`. Fields have specific value schemas:

| Field | Value | Class |
| --- | --- | --- |
| `budget` | `{ amount: nonnegative number, currency: uppercase 3-letter code }` | Hard; explicit only |
| `material`, `color` | Nonempty string | Explicit hard; other sources soft |
| `excludedProductIds`, `excludedTags` | Unique string array | Hard; explicit only |
| `styleTags` | Unique string array | Soft |
| `occasion` | Nonempty string | Context |
| `visualIntensity` | `low`, `medium`, `high` | Soft |
| `pricePreference` | `lower`, `higher` | Soft; explicit only |

Category comes from `activeCategory`, not a second potentially conflicting constraint slot. Stock eligibility is always required. `excludedTags: ["dangling"]` scoped to earrings expresses the A05 `no_dangling` constraint. Material/color equality is case-insensitive exact attribute comparison, not inferred composition (e.g. silver-plated is not assumed solid silver).

Source precedence is explicit > saved preference > visual > heuristic. Equal-source precedence is newest transition revision, then category specificity for same-revision ties. Source and scope are explicit input contracts; language interpretation will assign them in M3. Stored losing signals remain available but never override active higher-priority instructions. Applicable exclusion arrays union across scopes; their resolved evidence lists every contributing record. Reset removes only the named field/scope, including its source records.

Per-category decisions each contain unique `liked`, `shortlisted`, `saved`, `selected`, and `rejected` product IDs. A product cannot belong to multiple categories or be rejected and simultaneously liked/shortlisted/selected. Saving is independent of rejection. Feedback records contain structured input, category, session scope, and revision; history remains even after a reversal. The schema defaults to no permanent profile promotion by accepting session scope only.

Dependencies contain `anchorProductId`, `anchorCategory`, `targetCategory`, and `type` (`complement`, `alternative_to`, `match`). Anchors must be selected, not merely liked/saved/shortlisted. M1 preserves these relationships and invalidates them on anchor rejection; creating cross-product searches/ranking is later work.

`StateChangeEvent` contains `sessionId`, `revision`, action type, and `{ field, previous, current }` changes. Values are JSON-safe; null represents absent/deleted state. Only actual changes produce a new revision/event. Consumers persist snapshots/events through a future repository adapter; concurrency/transaction enforcement is not implemented by this pure engine.

Product IDs supplied in actions are validated against a backend-owned lookup. The engine also validates the returned product shape/ID/category and checks hard constraints before new selections. Existing decisions are retained when constraints change as historical user choices, not implicitly reissued recommendations.

## M2 catalog search contract

`packages/shared/src/catalog.ts` defines catalog uniqueness validation, bounded scoring configuration, ranking evidence, ranked products, confirmation-required relaxation proposals, and search results. `CatalogSearchResult` includes status (`matches`, `no_exact_match`, `category_required`), exact matches with per-evidence-tier scores, full exact count before limiting, and a separate relaxation list. Evidence names actual matching attributes and preference provenance or a rejected catalog product ID. Relaxations carry typed constraint updates and supporting existing candidate IDs; they are not applied state or exact recommendations. The session schema is unchanged. Catalog fixture prices/stock are explicitly synthetic development data; no database or merchant synchronization is introduced.
