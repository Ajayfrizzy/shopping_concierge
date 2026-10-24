> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](../acceptance/FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](../demo/FINAL_DEMO_PLAN.md), still not executed.

# Flow A authorization correction

The production request `3c675b76-cfb4-48c5-a87a-8e9f02aaaec3` received OpenAI HTTP 200 and passed `agentPlanSchema`, then returned application HTTP 422 `UNGROUNDED_PLAN`. Accounting settled correctly. This work made no production/provider requests and did not change budgets or reservations.

## What is known, and what cannot be recovered

The saved attempt contains status, correlation IDs, tokens and state, not the generated plan. PostgreSQL diagnostics explicitly store no provider payload; S3 receipts contain usage only; the Responses request sets `store:false`. No exact historical sequence, argument list or offending call index is available in the evidence. The fixture `fixtures/agent/flow-a-authorization.json` is explicitly labelled an **authored representative plan using the exact production prompt**, not a captured provider response. An exact provider-plan regression cannot honestly be supplied from the retained evidence.

The precise pre-fix rule was in `packages/agent/src/index.ts`:

```ts
const authorized = agentPlanSchema.parse(interpretMockMessage(request.message, state));
// provider plan is obtained and parsed
if (!equal(plan, authorized)) throw new AgentError('UNGROUNDED_PLAN', ...);
```

`equal` used JSON.stringify equality. This rejected the WHOLE plan before executing any tool; there was no individually failed authorized tool call.

For the exact Flow A prompt on a fresh state the interpreter fell through to:

```json
{"intent":"clarify","calls":[],"disposition":"clarify","question":"category"}
```

The old complete-string initial-search grammar permitted material before category, a short enumerated occasion clause before budget, then optional trailing style/intensity. Flow A has adjective-first `elegant silver earrings`, budget before occasion, `evening event` (absent from that occasion list), and a second preference sentence. These do not match, despite the explicit earrings category. Thus any meaningful executable shopping plan differs from the authorized clarification. The exact returned plan's further differences cannot be inferred from token counts or diagnostic success.

## Bounded fix

`shopping-instruction.ts` recognizes complete, explicit shopping clauses, including the exact Flow A sentence. It does not grant authority by finding isolated keywords inside otherwise unsupported text. Extra unrelated clauses still fail closed. Existing command grammars remain supported.

Flow A authorizes only:

1. Optionally read authoritative session state once.
2. Establish category `earrings` (required when no category is active).
3. Apply explicit global updates: material `silver`; occasion `evening`; budget `{amount:80,currency:"USD"}`; style tags `["elegant","lightweight"]`; visual intensity `high` for “noticeable”.
4. Search the grounded catalog after required context is present. Ranking remains the existing deterministic catalog service.

Material and budget remain hard constraints. Occasion is context. Style/intensity/weight-related preference are soft. The catalog has no verified physical weights: `lightweight` preserves the user's preference without inventing grams, filtering by unknown weight, or claiming confirmed comfort. Search responses disclose that catalog weight is unverified. No catalog entries, prices or ranking algorithm were changed.

The OpenAI instructions now specify the same bounded mappings. No new tool schema, broad tool grant or model/provider/budget change was introduced.

## Compound authorization and atomicity

`authorization.ts` compares proposed effects against independently interpreted explicit updates. For supported search plans only, it permits one session-state read, splitting/reordering the exact updates, and ordering category selection before the final search. It compares object fields structurally and style-tag sets without depending on ordering. All required updates must appear once; unrelated fields, source changes, scope changes, duplicate updates and omissions fail closed. Other plan families still require equivalent full expected plans.

The checker simulates category/constraint transitions on a cloned state. An update may precede category selection if its authorized global scope is valid, but search cannot occur until the category and every required update are established. A read/update/search plan without `switch_category` is accepted only if the correct category already exists. Missing category on a fresh session still fails; the agent does not silently invent a switch.

No actual catalog search or external tool runs during authorization. Search itself executes later in the existing tool loop, after the complete plan passes; infrastructure search failures retain their existing TOOL_FAILED behavior. The existing atomic commit/CAS boundary and PostgreSQL transaction remain intact. A rejected later call cannot partially mutate state. Unrelated hard constraints remain present, and no-match results still require explicit relaxation confirmation.

Sequential simulation was added to support equivalent compound plans; it was **not demonstrated to be the original cause**, since the original plan was never individually authorized at all.

## Verification

- **650 tests passed in 31 files**, including 32 exact-prompt/authorization cases and one PostgreSQL HTTP persistence/rollback integration case added for this change.
- Full local suite: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`.
- Lint, typechecks and API build passed.
- Secret scan passed: 95 Android JS-export files, seven server credential sentinels absent. No APK built.

Tests cover allowed read/category/update/search plans, split/reordered updates, sequential context, exact hard/soft preferences, persisted session version, catalog-only results, preservation of unrelated constraints, rejection of unauthorized save/shortlist/reject/VTO/compare/fabricated IDs/category changes, missing/raised budgets, scope/provenance changes, duplicates, premature search and malicious extra instruction text. The historical plan itself remains unavailable.

Locally ready for one controlled Flow A retry after deployment, healthy dependency readiness, unchanged budgets/reservations and verified `OPENAI_MAX_ATTEMPTS=1`. This is not evidence that the unknown historical provider plan now passes or that a future live response is guaranteed to pass. No Flow A/B/C or YouCam call was made; no deployment or demo script was created.
