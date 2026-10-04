# M7 OpenAI planning boundary

Mock planning remains the default. The server-only OpenAI Responses adapter uses a configurable `LLM_MODEL` (approved model: `gpt-5.6-terra`) and `LLM_REASONING_EFFORT=low`. Enable only with `USE_MOCK_LLM=false`, `LLM_PROVIDER=openai`, and server-side `OPENAI_API_KEY`. Keep `USE_MOCK_YOUCAM=true`. Never put credentials in mobile, fixtures, logs, documentation or chat. No cloud resources are required.

The isolated runner loads ignored `apps/api/.env` first, then root `.env` if present; root values override file duplicates and shell variables retain precedence.

The adapter submits a strict `submit_shopping_plan` function schema derived from the shared Zod plan/tool contracts. Literal discriminators use singleton enums and precede common properties in the provider schema; this preserves the shared schema’s allowed values while making variant selection explicit during constrained decoding. Instructions require unique updates, complete budget extraction and canonical lowercase material/tag values. This function proposes ordered domain calls, not results or database writes. All fields are required in the OpenAI schema; optional question/rejection fields use nullable representations and are normalized before shared validation. Only a completed response containing exactly that tool call is accepted; text, refusals, incomplete output, malformed arguments and unavailable usage fail closed. There is no second model call to narrate tool results: backend prose and catalog facts remain authoritative.

The existing independent bounded instruction grammar still authorizes every proposed plan before executing any tool. M7 does **not** broaden arbitrary natural-language editing permissions. Unsupported language may require clarification or return `UNGROUNDED_PLAN`; live quality/consistency must be measured, not assumed from transport tests. Existing typed decision actions and opaque relaxation confirmations bypass the model. Unknown product IDs remain subject to backend catalog lookup. No automatic relaxation, state replacement, product fabrication, or live visual inference is permitted.

Context includes full structured state, current input, at most twelve recent messages (2,000 characters each), and at most twenty referenced catalog fact records without image URLs/private fields. Optional history/facts are pruned to a 64,000-byte budget; oversized authoritative state fails rather than being truncated. No repository content, credentials or image bytes are sent. Requests set `store:false`, default processing tier and 2,048 max output tokens. The agent deadline is 20 seconds for live planning; mock timeout behavior remains unchanged. Network/ambiguous failures are not retried. Only HTTP 429/502/503/504 may retry once, after a bounded 250ms wait within the original abort deadline.

## Approved validation budget

Every actual HTTP attempt, including retries and physical-device use, reserves budget in `artifacts/m7-live-budget.json`. All app/runner instances resolve this same repository-relative path. The hard ceiling is **30 attempts and $1 estimated/reserved total** (original25 plus user-approved five-request extension on2026-10-04), whichever is reached first. Do not delete/reset the ledger to continue validation. Concurrent ledger updates use an exclusive filesystem lock; corrupt ledgers/interrupted locks fail closed and require inspection.

Official model rates retrieved 2026-10-03: input $2/M, cached input $0.20/M, output $12/M. Output usage includes reasoning tokens, not an additional charge. Preflight uses one token per serialized request byte plus 4,096 overhead tokens and the maximum output allocation, with no assumed cache discount. Known usage replaces its reservation; missing/invalid usage, HTTP errors and network failures retain the reservation. Unexpected usage exceeding the reservation blocks further attempts. Model changes require a corresponding verified pricing/approval update; a different unpriced model fails closed rather than guessing rates.

```sh
# Requires an ignored server .env with credentials, never inline keys.
M7_LIVE_APPROVED=true USE_MOCK_LLM=false USE_MOCK_YOUCAM=true npm run test:llm:live
# Rerun only the failed case after a fix; same durable budget ledger.
M7_LIVE_APPROVED=true USE_MOCK_LLM=false USE_MOCK_YOUCAM=true npm run test:llm:live -- constraints
```

Cases: `constraints`, `feedback`, `relaxation`, `invalid-id`, `ambiguity`, `budget-scope`. Default uses fifteen successful-planning requests without retries, leaving some budget for minimal reruns/device checks. It stops at the first failed case and writes case outcomes, counts/tokens/cost and model (plus strict synthetic fixture plans and a sanitized failure code when a case fails) to `artifacts/m7/live-*.json`. It checks actual structured actions, grounded exact matches, preserved constraints/scope, rejection/save memory, explicit confirmation without a paid call, missing-ID rejection and focused ambiguity. It imports no YouCam adapter. Full automated regression remains injected/mock only.

Sources actually fetched:

- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/pricing

Live account/model access and all five bounded regression groups passed on 2026-10-03 after the documented fixes: 17 total requests, approximately $0.06897. This establishes the tested supported grammar, not unrestricted language consistency. Device testing subsequently exposed a stale standalone-budget scope instruction. It is corrected offline to use the active category and preserve global limits. The named `budget-scope` case requires one request with deterministic setup. The original 25-request allowance is exhausted ($0.0947126 estimated); live fix/reload/confirmation verification remains blocked pending explicit additional capacity. Do not reset the ledger. See `VALIDATION.md`.

## Final M7 validation

Completed 2026-10-04: corrected budget-scope instructions verified on-device, explicit confirmation/cancel and actual native reload passed. Final cumulative29 requests, 74,655 input tokens (44,911 cached), 3,512 output tokens and estimated $0.1106142. The earlier cap-blocker paragraphs are historical; the approved extension preserved the ledger. No broad reruns or live YouCam calls. Default services remain mocked; M8 has not started. See `VALIDATION.md` and `evidence/m7/extension/results.json`.
