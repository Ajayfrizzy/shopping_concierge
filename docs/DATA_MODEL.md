# Data Model

The planned persistence target is RumptyCloud Managed PostgreSQL for the hackathon, with standard PostgreSQL-compatible schemas/migrations and repository adapters. Object bytes belong in S3-compatible storage; relational records retain object identifiers/metadata rather than requiring provider-specific hostnames. This deployment choice does not change the domain contracts below. See [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## Tables

### users

Identity/ownership records for guest sessions and optional email authentication. The authentication mechanism is selected behind the server-side auth boundary in M5; do not assume a hosted Supabase or RumptyCloud identity service.

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

| Field                                | Value                                                               | Class                             |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| `budget`                             | `{ amount: nonnegative number, currency: uppercase 3-letter code }` | Hard; explicit only               |
| `material`, `color`                  | Nonempty string                                                     | Explicit hard; other sources soft |
| `excludedProductIds`, `excludedTags` | Unique string array                                                 | Hard; explicit only               |
| `styleTags`                          | Unique string array                                                 | Soft                              |
| `occasion`                           | Nonempty string                                                     | Context                           |
| `visualIntensity`                    | `low`, `medium`, `high`                                             | Soft                              |
| `pricePreference`                    | `lower`, `higher`                                                   | Soft; explicit only               |

Category comes from `activeCategory`, not a second potentially conflicting constraint slot. Stock eligibility is always required. `excludedTags: ["dangling"]` scoped to earrings expresses the A05 `no_dangling` constraint. Material/color equality is case-insensitive exact attribute comparison, not inferred composition (e.g. silver-plated is not assumed solid silver).

Source precedence is explicit > saved preference > visual > heuristic. Equal-source precedence is newest transition revision, then category specificity for same-revision ties. Source and scope are explicit input contracts; language interpretation will assign them in M3. Stored losing signals remain available but never override active higher-priority instructions. Applicable exclusion arrays union across scopes; their resolved evidence lists every contributing record. Reset removes only the named field/scope, including its source records.

Per-category decisions each contain unique `liked`, `shortlisted`, `saved`, `selected`, and `rejected` product IDs. A product cannot belong to multiple categories or be rejected and simultaneously liked/shortlisted/selected. Saving is independent of rejection. Feedback records contain structured input, category, session scope, and revision; history remains even after a reversal. The schema defaults to no permanent profile promotion by accepting session scope only.

Dependencies contain `anchorProductId`, `anchorCategory`, `targetCategory`, and `type` (`complement`, `alternative_to`, `match`). Anchors must be selected, not merely liked/saved/shortlisted. M1 preserves these relationships and invalidates them on anchor rejection; creating cross-product searches/ranking is later work.

`StateChangeEvent` contains `sessionId`, `revision`, action type, and `{ field, previous, current }` changes. Values are JSON-safe; null represents absent/deleted state. Only actual changes produce a new revision/event. Consumers persist snapshots/events through a future repository adapter; concurrency/transaction enforcement is not implemented by this pure engine.

Product IDs supplied in actions are validated against a backend-owned lookup. The engine also validates the returned product shape/ID/category and checks hard constraints before new selections. Existing decisions are retained when constraints change as historical user choices, not implicitly reissued recommendations.

## M2 catalog search contract

`packages/shared/src/catalog.ts` defines catalog uniqueness validation, bounded scoring configuration, ranking evidence, ranked products, confirmation-required relaxation proposals, and search results. `CatalogSearchResult` includes status (`matches`, `no_exact_match`, `category_required`), exact matches with per-evidence-tier scores, full exact count before limiting, and a separate relaxation list. Evidence names actual matching attributes and preference provenance or a rejected catalog product ID. Relaxations carry typed constraint updates and supporting existing candidate IDs; they are not applied state or exact recommendations. The session schema is unchanged. Catalog fixture prices/stock are explicitly synthetic development data; no database or merchant synchronization is introduced.

## M3 request/session envelope

Shared `src/agent.ts` defines strict plans/tool calls, intents, requests, session views, responses and error envelopes. The M1 shopping snapshot is unchanged. A server-owned M3 session view wraps `{ state, version, pendingRelaxations }`; its turn `version` is distinct from domain `revision`. Pending offers extend the M2 proposal with an opaque ID. Confirmations carry only that ID plus request/version, never replacement updates or catalog facts. Successful responses contain mock mode, status, intent, backend-generated message/UI payload, authoritative session and M1 events; tools report completed names without exposing hidden reasoning.

Internal in-memory records add at most 12 recent messages and 50 cached request/response pairs. State is committed only after validated tools/response succeed and the session record still matches the pre-planning version. Errors do not persist partial transitions. Process restart clears this mock storage; M5 remains responsible for durable authenticated records and transaction guarantees across processes.

## M5 executable database mapping

`apps/api/migrations/001_persistence.sql` is the implemented PostgreSQL source of truth; earlier table lists describe the broader MVP. `schema_migrations` tracks applied SQL checksums. `principals` stores hashed runtime guest credentials and optional verified email; `shopping_sessions` stores explicit owner/version plus validated agent record JSONB (structured domain state, current offers, recent history, last 50 request/reply pairs). `products` stores validated catalog facts. `product_feedback`, `saved_products` and `agent_events` are transactionally maintained relational projections with keys/FKs. `visual_assets` stores private object keys and validated metadata/hash; raw bytes live in S3-compatible storage. `email_challenges` stores only owner-bound code hashes/email/expiry.

This implements guest-first identity rather than relying on a hosted auth vendor. Same-email access requires independent code verification per installation. The broader user preferences, visual profiles and VTO job tables remain future work. No shared domain constraint/decision contract or ranking semantics changed. See [PERSISTENCE.md](PERSISTENCE.md) for transaction boundaries and retention limits.

## M6 implemented visual storage

Migration `002_visual.sql` adds `visual_sessions(session_id PRIMARY KEY REFERENCES shopping_sessions, state JSONB)`. The validated document holds at most 100 VTO jobs (normalized job, private provider task ID, reference-asset URL and last-poll timestamp) and ten normalized analysis-cache entries. This implements the planned vto_jobs/visual_profiles responsibilities through one portable session-scoped record, not two separately materialized tables. Existing catalog and shopping/feedback/event records are unchanged; visual operations never replace decision state. API views exclude provider task IDs and submission metadata. See `YOUCAM.md` for replay/expiry/cache limitations.

## M8 cross-product intelligence — 2026-10-04

M8 activates persisted complement dependencies: selected catalog anchor, distinct target category, one anchor per target. Anchor rejection invalidates its relationships. Shared comparison schemas return two factual items, active criteria and eligibility/evidence; comparisons are not replacement decision state. See [decision intelligence](DECISION_INTELLIGENCE.md).

## PostgreSQL YouCam accounting — 2026-10-08

Migration `004_youcam_usage.sql` adds a singleton `youcam_usage_budget` (request/unit ceilings) and `youcam_usage_reservations` (server job ID, category, one reserved unit, reservation/commit timestamps, historical flag). Commit means submission acknowledgement; all reservations count even when acknowledgement is unknown. Historical commit markers reuse the original recorded reservation timestamps, not independently measured acknowledgement times. These server-only records contain no keys, images, URLs or provider response bodies. They are independent of session deletion and remain charged across deployments.

## Judge runtime accounting and VTO capability

Migration 005 creates separate runtime_budgets/runtime_usage records for judge OpenAI and YouCam. No historical ledger is repurposed. OpenAI usage stores request reservations, normalized input/output/cached token totals, conservative reserved USD, settled USD and timestamps. Migration 006 creates private product_vto_assets references with SHA-256. Public products expose only vtoEligible, defaulting absent legacy fields to unavailable at the service boundary; they never contain private asset keys or presigned URLs.
