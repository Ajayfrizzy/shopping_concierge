# Production readiness investigation — 2026-10-12

The latest reproduced failure is **PostgreSQL connection timeout during runtime accounting initialization**, safely classified as `DB_CONNECTION_TIMEOUT`. The historical `/ready` 503 at 18:05:38 UTC cannot be attributed conclusively: the deployed handler discarded dependency identity. Do not equate a later reproduced timeout with proof of that historical cause.

## Checks traced

The original deployed handler sequentially reads/parses the catalog (`products`, requiring at least one), runs S3 `HeadBucket`, initializes diagnostic-table access, initializes OpenAI judge accounting, then initializes YouCam judge accounting. In judge scope the separate historical YouCam validation-ledger initializer is skipped. Provider configuration is validated at startup; no OpenAI or YouCam network probes are part of readiness.

Diagnostic initialization reads the table and checks INSERT/UPDATE privileges. Ledger initialization verifies matching ceilings, approval and blocked state and executes zero-row write statements to verify permissions. It does not reserve or settle usage. Readiness does not run migrations or check every migration checksum; the operator probe separately confirmed versions 001–007.

## Observations

| Component | Five initial production-credential rounds |
| --- | --- |
| Configuration (documented judge profile) | 5/5 pass |
| PostgreSQL catalog access | 5/5 pass |
| Migrations 001–007 | 5/5 pass |
| S3 HeadBucket | 5/5 pass |
| OpenAI diagnostics and privileges | 5/5 pass |
| OpenAI judge budget/ledger | 5/5 pass |
| YouCam judge budget/ledger | 5/5 pass |

Those checks reused the same pool/client, and before/after ledger snapshots were identical. Subsequent public checks reproduced 503, followed by transport/non-JSON failures, eventually also affecting `/health`. These client-side observations cannot distinguish deployment infrastructure from local network/scheduling problems.

A production-style local app harness using separately initialized repository/accounting clients completed one full healthy round, then stalled. It was stopped. A later harness run failed before readiness at `accountingInitialization` with `DB_CONNECTION_TIMEOUT`. Thus sustained readiness after startup has **not** been established. No missing migration, privilege denial, S3 denial, deterministic diagnostic-schema regression or budget mismatch was reproduced. Stale-pool behavior was not proven. Database/network reachability is intermittent from this workstation; the exact infrastructure cause and historical failing dependency remain unproven.

## Implemented changes (not deployed)

- `/ready` reports allowlisted `dependencies` with `ready`/`unavailable`: configuration, database, objectStorage, openaiDiagnostics, openaiLedger, youcamLedger when configured.
- Independent checks run concurrently; failure in one does not hide the others.
- Each check has a 15-second reporting deadline. It reports unavailable if the underlying operation does not settle. This does not cancel database operations or prove they completed.
- Concurrent readiness calls share probes; a timed-out underlying probe is not repeatedly replaced while still running. Completed readiness is never cached over a subsequent failure.
- Pools and clients are created at startup, not for every health request. Readiness rechecks access/approval without reconstructing dependencies.
- Local inspection includes timings and allowlisted error codes only. Sanitized accounting/diagnostic wrappers preserve only a safe underlying code, never raw driver messages, secrets or stack traces.
- Public output contains no raw errors, exception causes, keys, URLs, bucket names or connection strings. `/health` remains basic liveness.

Run the internal five-round harness:

```sh
READINESS_EVIDENCE_PATH=/tmp/readiness.json \
node --env-file=apps/api/.env --import tsx scripts/readiness-diagnostics.ts --judge-profile
```

`--judge-profile` combines local backend credentials with the documented production modes/limits; it is **not** remote environment introspection and changes no deployed settings. Omit the flag when the operator environment already holds the intended modes. The script never invokes a shopping message or AI provider. There is no migration needed for these changes.

## Verification and gate

Final regression/integration run: **599 tests passed in 29 files**, including 11 readiness regression tests (named failure/recovery, independent results, concurrent probes, no leakage, safe error causes and hanging dependency deadlines). Command: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`. Earlier 5s/15s test-runner limits encountered unrelated scheduling timeouts; production provider settings/timeouts were not changed to accommodate tests. Lint, typechecks and API build passed. Secret scan passed (95 Android JS-export files, seven sentinels); no APK built.

Redeployment is required to expose the improved public dependency statuses. Do not reset/reconcile ledger rows, change provider modes, raise limits, reseed data or relax TLS as a workaround. If connection timeouts persist, the operator should inspect managed PostgreSQL availability, connection capacity and app-to-database networking. S3 repair or a database migration is not supported by current evidence.

Before Flow A: deployed corrected code; `/health` 200; repeated `/ready` 200 with every configured dependency ready; durable diagnostics readable/writable; expected judge limits/approval and existing reservations intact; deployed `OPENAI_MAX_ATTEMPTS=1` verified; schema-compatible planner deployed. The current evidence does **not** clear this gate. No AI requests were made during this investigation.
