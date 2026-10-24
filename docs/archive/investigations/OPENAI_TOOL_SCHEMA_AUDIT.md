> Historical record, archived 2026-10-19. Test counts, deployment failures, pending gates and budgets below describe their original observation dates, not current status. See [final acceptance](../acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the code-6 / 836-test baseline and dated budget snapshot. Original findings are retained; later acceptance does not erase earlier failures.

# OpenAI strict function-schema audit — 2026-10-12

The planner sends exactly one Responses function tool: `submit_shopping_plan`. Its `calls` array carries the internal domain operations as discriminated `anyOf` branches. OpenAI validates the whole function schema before inference, including operations not requested by the shopper.

The production evidence showed HTTP 400 / `invalid_function_parameters` / `invalid_request_error`. It did not retain the provider's message or rejected JSON pointer. This audit identifies local incompatibilities; it cannot prove which pointer the provider rejected first.

## Exact structural findings

Paths below are relative to `tools[0].parameters` in the frozen pre-fix fixture `fixtures/llm/openai-tools-rejected.json`.

| JSON pointer                                                                  | Before                                                    | After                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/properties/calls/items/anyOf/0/properties/args/properties/productIds/items` | Tuple-style array of two schemas, from `compare_products` | One `{ "type": "string" }` schema; `minItems: 2`, `maxItems: 2` retained |
| `/properties/calls/items/anyOf/2/properties/args/required`                    | Missing on empty `get_session_state` args                 | Explicit `[]`                                                            |
| `/properties/calls/items/anyOf/3/properties/args/required`                    | Missing on empty `search_products` args                   | Explicit `[]`                                                            |

All 49 objects already had `additionalProperties: false`. All non-empty objects already required all properties. Optional `question`, rejection `reasonCode` and `reasonText` already traveled as required nullable fields; this remains unchanged. The previous regression test used `required ?? []`, masking the two missing empty arrays, and never rejected tuple-style `items`.

The conservative transport policy additionally removes 34 `minLength`/`maxLength` occurrences and root `$schema` dialect metadata. These are policy exclusions, not a claim that all 35 caused this provider rejection. The current official documentation lists pattern/format as supported string constraints and separately describes additional restrictions for fine-tuned models; it does not establish which length keyword this account/model accepts. The tuple is a concrete incompatible array representation. Every exact policy/structural finding is captured in [issues.json](../../evidence/openai-schema-audit-2026-10-12/issues.json).

## Contract comparison and implementation

Official sources fetched for this audit:

- [Function calling: strict mode](https://developers.openai.com/api/docs/guides/function-calling#strict-mode): objects disallow additional properties; every property is required; optional values use nullable schemas.
- [Structured Outputs: supported schemas](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas): object root, supported nested `anyOf`, single-schema array items, local definitions/references, restricted keyword vocabulary.

The Responses envelope remains `{type: "function", name, description, parameters, strict: true}`, with explicit function `tool_choice` and `parallel_tool_calls: false`. No Chat Completions nested `function` envelope is used.

`apps/api/src/llm/tool-schema.ts` supplies an OpenAI-compatible transport projection and a separate recursive compatibility checker. The existing projection was strengthened, not replaced with a weaker domain schema. Identical tuple item schemas become one item schema with their existing bounds preserved; heterogeneous tuples fail closed and require deliberate design. Singleton literals remain enums. Unexpected schema keywords fail locally. Definitions, references, array items and `anyOf` branches are checked; invalid references are rejected and recursive local definitions do not loop indefinitely. This is a local compatibility policy, not a substitute for provider acceptance testing.

The internal `agentPlanSchema`, comparison two-ID tuple, length limits, budget bounds, enum constraints, catalog grounding, tool authorization and atomic state semantics are unchanged. Nullable optional fields are still normalized before authoritative Zod parsing. Successful usage is still settled before domain rejection, preserving billing correctness.

The exact production `tools` fixture is `fixtures/llm/openai-tools.json`. An injected transport captures the actual serialized Responses body and compares its complete `tools` field against this fixture. Negative tests cover tuple items, nested object required/additionalProperties rules, definitions, references, unsupported keywords and post-response domain rejection. The final schema has zero local compatibility issues.

## Validation and retry gate

- `M5_INTEGRATION=1 npm test`: **588 passed in 28 files**, including **31 new schema tests**, planner tests, migrations and PostgreSQL integrations.
- Lint, typechecks and API build passed.
- Secret scan passed: 95 Android JS-export files contain none of seven server credential sentinels. No APK was built.

No live OpenAI/YouCam calls, deployment, production database changes or budget/reservation reconciliation occurred. `OPENAI_MAX_ATTEMPTS=1`, provider modes, PostgreSQL diagnostics/accounting and judge ceilings remain unchanged. Last observed allowance remains 197 requests / $2.797474 with three unsettled reservations; this audit did not refresh production usage.

The fix is locally ready for exactly one controlled Flow A retry **after deployment and readiness/single-attempt configuration checks**. Provider acceptance is not yet proven. Do not retry the currently deployed pre-fix payload, and do not proceed to Flow B/C without an explicit subsequent instruction.
