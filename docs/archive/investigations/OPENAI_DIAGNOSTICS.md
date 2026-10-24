> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Durable OpenAI diagnostics

Migration `007_openai_diagnostics.sql` adds `openai_provider_diagnostics`. Apply migrations before starting the updated API; PostgreSQL OpenAI accounting now checks diagnostic table access during initialization and readiness. There is no new diagnostic mode or public endpoint. File-backed historical validation is unaffected.

The table contains only attempt metadata: UUID `id`, `created_at`, nullable `finished_at`, `session_id`, nullable `client_request_id`, nullable unique UUID `ledger_reservation_id`, `stage`, nullable `http_status`, allowlisted `error_code`/`error_type`, validated `provider_request_id`, `aborted`, and `outcome` (`pending`, `success`, `failure`). No message/body column exists. Unknown provider error codes/types become `unrecognized`; provider messages, user conversation, raw responses, headers and credentials are never copied to the table.

A row is inserted before reserving budget and linked to its reservation before HTTP submission. Each attempt finalizes that same row, including HTTP, transport, abort, JSON decoding, settlement, response shape and plan schema failures. Retries, when configured, have separate rows/reservations. A pre-provider failure may also have a row; do not interpret row count alone as paid usage. Accounting remains authoritative. Successful provider usage may already be settled when subsequent plan parsing fails.

The diagnostic pool is independent of the shopping-state transaction; rollback cannot erase diagnostics. A failed insertion prevents provider submission. A failed finalization stops the attempt loop. A process crash or database outage can leave a durable `pending` row; that means outcome unknown, not safe to release a reservation. There is no automatic reconciliation, cancellation or deletion of reservations. Existing unresolved reservations and validation ledgers are unchanged by this migration.

## Deployment and inspection

Using an operator environment with the intended PostgreSQL credentials (never paste connection strings into command arguments):

```sh
node --env-file=apps/api/.env --import tsx apps/api/src/persistence/migrate.ts
```

Do not pass `--seed-fixtures` in production. Deploy the updated API after migration 007. Keep `USE_MOCK_LLM=false`, `OPENAI_LEDGER_MODE=postgres`, `OPENAI_MAX_ATTEMPTS=1`, `OPENAI_JUDGE_MAX_REQUESTS=200` and `OPENAI_JUDGE_MAX_USD=3`; preserve existing model, approval and YouCam settings. Check `/health` and `/ready` before an independently authorized live request. Readiness alone does not prove the configured attempt count.

After the next authorized request, query directly from PostgreSQL:

```sh
node --env-file=apps/api/.env --import tsx scripts/openai-diagnostics.ts --request CLIENT_REQUEST_ID
node --env-file=apps/api/.env --import tsx scripts/openai-diagnostics.ts --session SESSION_ID --limit 20
```

Omit filters to read the newest 20 rows (maximum limit 100). This CLI runs only SELECT queries and emits explicit metadata columns. It makes no provider calls and returns a generic error if inspection fails. A read-only database role with SELECT permission is sufficient for inspection. API startup requires SELECT/INSERT/UPDATE on the table.

A non-null HTTP status proves response headers were received; status 200 with `response_json`, `response_shape` or `plan_schema` failure distinguishes downstream parsing failures from transport failures. `aborted=true` records cancellation, including deadline aborts; transport errors do not preserve arbitrary exception text. Provider request IDs are retained only when they match the safe identifier format. Use ledger usage/settlement separately to assess billing; diagnostic failure does not prove zero billable usage.

## Offline verification — 2026-10-12

`M5_INTEGRATION=1 npm test`: **556 tests passed in 27 files**, including **12 fresh PostgreSQL diagnostic cases**. Tests use isolated local schemas and injected HTTP only. Coverage includes additive migration/reapplication with unresolved usage preserved, correlation, HTTP/network/abort/JSON/shape/schema failures, successful settlement, restart persistence, one row per attempt, redaction, failed insert, failed finalization and recovery.

`npm run lint`, `npm run typecheck`, `npm run build:api` passed. `npm run verify:mobile-secrets` passed: 95 Android export files, seven server credential sentinels absent. This scan creates an Android JS export, not an APK.

This work did not apply production migrations, deploy, alter production settings, modify existing reservations or call OpenAI/YouCam. Exactly one diagnostic Flow A retry remains gated on deployment of this change, migration 007, healthy readiness and verification that deployed `OPENAI_MAX_ATTEMPTS=1` resolves through the adapter configuration. No retry was submitted.

## Startup regression correction — 2026-10-12

The first deployment crashed with `OpenAI PostgreSQL diagnostics are not initialized.` because `readConfig()` constructed the provider before `initializeRuntimeAccounting()` could create its diagnostic store. This was a code initialization-order bug, not evidence that migration 007 was missing. Environment validation now uses a separate pure `readLLMConfig()` function; provider construction still requires diagnostics after accounting initialization. No persistence safeguard was removed. The production startup regression test verifies both phases and resolution of `OPENAI_MAX_ATTEMPTS=1`. Regression suite: 557 tests passed, including local PostgreSQL integration tests. Lint, typechecks and API build passed. No production deployment or live provider calls were performed for this correction.
