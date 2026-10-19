> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](FINAL_DEMO_PLAN.md), still not executed.

# PostgreSQL transient-connectivity hardening — 2026-10-14

No production changes or provider calls were made. The earlier `DB_CONNECTION_TIMEOUT` is evidence of a connection failure, not evidence that pool count caused it. Production has not been observed passing ten consecutive ready checks for this change.

## Connection ownership and limits

The existing judge runtime has TWO pools, not four: catalog/session persistence owns one, while OpenAI ledger, OpenAI diagnostics and YouCam judge ledger share the second. Historical validation uses a separate ledger pool only outside judge scope. Pools are created once per process, reused, and closed at shutdown.

A single shared pool would be unsafe without changing transaction orchestration: shopping requests hold a repository transaction/row lock while the planner performs independent durable accounting. If all shared clients were held by shopping requests waiting for accounting, no accounting operation could acquire a client. Separate reserved accounting capacity also allows diagnostics to survive shopping rollback. Therefore this change retains two bounded pools.

| Setting | Before | Hardened |
| --- | --- | --- |
| Repository pool maximum | 8 | 4 |
| Shared judge accounting pool maximum | 8 | 2 |
| Combined judge maximum per process | 16 | 6 |
| Optional historical-validation pool | 8 | 2 (not created in judge scope) |
| Minimum | pg default 0 | explicit 0 |
| Connection/acquisition timeout | 5 seconds | 5 seconds |
| Idle timeout | pg default 10 seconds | explicit 30 seconds |
| Connection maximum lifetime | unlimited default | 300 seconds |
| TCP keepalive | implicit/default | enabled, initial delay 10 seconds |
| Server statement timeout | 10 seconds | 10 seconds |
| Server lock timeout | unset | 5 seconds |
| Client query timeout | unset | 12 seconds |
| Idle-in-transaction timeout | 30 seconds | 30 seconds |

`pg` uses `connectionTimeoutMillis` for both connection establishment and waiting for a pool slot; there is no separate acquire-timeout setting here. The server and client deadlines bound different failure paths. A client timeout can leave an ambiguous result; application code never treats it as proof that COMMIT failed. Transaction failures discard the client rather than reusing an uncertain connection. Idle client errors are handled; pg removes broken idle connections. Ordinary checkout paths release clients in finally blocks. No blanket transaction retry or provider retry was added. Limits multiply by deployed replica count; managed database capacity must cover all replicas, deployment overlap and operator connections.

## Readiness

The prior per-dependency monitor remains: 15-second reporting deadline, concurrent callers share one check, and timed-out underlying checks are not duplicated while still pending. DB acquisition/query/statement bounds permit stalled checks to eventually settle so later probes can recover. Up to two accounting clients and one repository client are used by an idle readiness round; the shared accounting pool bounds the three accounting/diagnostic checks. Clients are not created per HTTP probe. Readiness does not make paid provider calls.

Startup/readiness additionally refuses a recorded settlement-stage failure whose reservation remains unsettled. This check does not touch historical HTTP-failure reservations. Operator reconciliation or in-process recovery clears the unsettled condition by committing the original reservation; no old record is removed.

## Reservation and settlement safety

Before fetch, the adapter awaits durable diagnostic creation, successful reservation COMMIT, diagnostic reservation linking and the abort check. A timeout at any of these stages means no provider submission. An ambiguous reservation COMMIT is retained for operator inspection, never retried as a new reservation automatically.

Diagnostic creation serializes a `(session_id, client_request_id)` using a PostgreSQL transaction advisory lock. Any existing diagnostic blocks a new external execution for that same request ID, including failed/uncertain attempts; internal explicitly configured second attempts remain distinguishable via attempt index. Production remains `OPENAI_MAX_ATTEMPTS=1`. A successfully persisted session response is still replayed by the existing session layer. A failed response is not replayed as a new paid invocation just because the shopping transaction rolled back. This is intentionally conservative: a failed pre-provider diagnostic may require an explicitly authorized new request ID after inspection.

Production wraps the PostgreSQL OpenAI budget with `ReceiptBudget`. After a successful provider response with valid usage, it writes a private S3 receipt BEFORE settling PostgreSQL:

`<S3_ASSET_PREFIX>accounting/openai/receipts/<reservation UUID>.json`

The receipt contains only version, reservation ID and normalized input/output/cached token counts. No prompts, full response, provider key, user text or signed URL is stored. The existing private object-store adapter/credentials are reused; no bucket/schema change or extra object client is needed. The deployment's storage principal needs PutObject/GetObject permission for this prefix. Receipts are retained as accounting evidence; no automatic deletion.

If PostgreSQL settlement fails, the receipt survives process restart and the original conservative reservation stays held. The process retains pending usage, marks accounting unavailable, blocks new OpenAI reservations through the wrapper, and retries only S3 receipt/DB settlement writes every 30 seconds. Recovery is serialized and uses the original reservation ID; idempotent settlement handles COMMIT acknowledgement loss. It never invokes OpenAI or creates a reservation. The user-facing request still fails safely; state is not committed after a settlement failure.

If S3 also fails, normalized usage stays in memory and recovery retries writes; readiness stays unavailable. **A simultaneous DB/S3 outage followed by process loss cannot guarantee exact usage durability.** In that case the durable conservative reservation and pending diagnostic remain, but exact usage may require provider-side reconciliation. Do not restart a process with only in-memory pending evidence merely to clear readiness, and never release an unresolved reservation based on missing tokens. There is no container-local receipt file.

After a restart, inspect/reconcile a known durable receipt locally (preview first):

```sh
node --env-file=apps/api/.env --import tsx scripts/openai-reconcile.ts RESERVATION_UUID
# Only after reviewing the receipt and authorizing this reservation's reconciliation:
node --env-file=apps/api/.env --import tsx scripts/openai-reconcile.ts RESERVATION_UUID --apply
```

The CLI does not create reservations, release usage, change limits or invoke providers. It requires an existing matching reservation and validates tokens. Existing unresolved reservations have no new receipts and are NOT automatically reconciled. Pending in-process recovery will observe the same idempotent settlement if an operator reconciles first.

## Validation and deployment gate

Regression tests cover reservation gating, diagnostic insert/link timeouts, settlement timeout, S3 receipt failure, write recovery, restart receipt reconciliation, duplicate client request serialization, pool acquisition exhaustion, removal/replacement of a terminated idle local PostgreSQL backend, readiness timeout/recovery and no duplicate provider invocation/reservation. No production database sessions were terminated; pool fault tests use only local test-owned connections.

No new migration or environment variable is required. Deploy the backend changes; retain current provider modes, `OPENAI_MAX_ATTEMPTS=1`, budget approvals and 200 requests/$3 OpenAI and 50-render YouCam limits. Confirm private receipt-prefix write/read permissions before live use.

Exactly one controlled Flow A is conditionally safe after the corrected schema/diagnostic/pool/receipt code is deployed, ten consecutive uncached `/ready` checks report every dependency ready (space checks across at least several minutes), `/health` stays 200, the deployed attempt limit is verified as one, no settlement recovery remains pending, and existing reservations/budgets are unchanged. Ten successes reduce uncertainty but cannot guarantee future network availability. Do not auto-submit Flow A as part of these checks.

Final validation: **617 tests passed in 30 files**, including **18 new hardening cases**. Command: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`. Lint, typechecks, API build and seven-sentinel secret scan passed. The secret scan produced Android JavaScript export files, not an APK.
