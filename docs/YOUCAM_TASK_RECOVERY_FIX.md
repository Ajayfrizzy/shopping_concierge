# YouCam timeout and same-task recovery fix

Implementation acceptance: October 20, 2026. **Backend source is ready for separately authorized deployment. It has not been deployed or used to reconcile production.** No new APK is required for the existing v7 refresh/list path. Final recording remains blocked until a separately authorized recovery returns an accessible genuine result and native viewing is accepted.

## Implemented correction

The original E01 incident is preserved in [the live outcome](E01_LIVE_RENDER.md) and [the investigation](E01_TASK_RECOVERY_INVESTIGATION.md). The provider task reference was persisted, but the ten-minute application deadline ran before polling and left a terminal timeout. The exact Android transport failure remains unknown.

Known live tasks now use the validated poll-only reconciler during normal advancement, regardless of age. Normal advance retains its two-second poll spacing. Jobs without a task reference remain conservative; unknown submissions never automatically replay. A late task acknowledgment is retained even if local waiting has already timed out. Historical timeout-failed jobs require the explicit reconciliation endpoint. Actual provider failure remains distinct and is not eligible for timeout recovery.

## Endpoint and ownership

`POST /v1/sessions/:id/vto/:jobId/reconcile`

Requires the normal owning guest/session Bearer credential. Body must be absent or `{}`. Caller-supplied task IDs, URLs, products, assets and all other fields are rejected. Missing credentials return 401; inaccessible sessions/jobs return 404; ineligible jobs return 409; normalized output/provider validation errors return 422. Success returns the existing shared `VtoJob` shape.

Only live processing jobs or `PROVIDER_TIMEOUT` failures with a stored task reference can be reconciled. Existing live completed jobs replay unchanged, even if their result has since expired; replay does not refresh URLs or extend expiry. Running tasks do not become completed or provider-failed. A historical local timeout stays recorded until verified completion or an actual provider failure. No guessed task discovery is attempted.

[reconcile.ts](../apps/api/src/youcam/reconcile.ts) receives only status/validation provider methods and the repository. The production composition passes no `start` method. It has no object store, planner or accounting dependency. It cannot submit a task, upload an image, create a replacement job, or reserve/refund/settle credits. Concurrent callers may issue harmless status/image GETs, but only one completion/audit is persisted.

## Validation and persistence

1. Resolve the owned job, stored provider task, catalog category and owned original asset. Validate product/category and portrait/hand/wrist requirements.
2. Poll the exact stored task using the live adapter's authenticated official API, strict response schema and HTTPS hostname allowlist. Provider I/O takes place outside the database transaction.
3. Validate completion bytes using the provider-signed URL. The signature is the authorization for this server-side GET; app/guest/provider API credentials are never forwarded to the output host. The application owner is checked before any output access. This is not an unauthenticated caller-controlled URL fetch.
4. Refuse redirects, wrong hosts, non-200 responses, unsupported MIME, mismatched length/MIME, corrupt or animated images, more than 8 MiB streamed bytes, or more than 16 million pixels. Decode the whole PNG/JPEG. One 15-second wall-clock deadline bounds output validation; decoding also has a five-second sharp limit. Errors do not expose URLs or bytes.
5. Accept only unambiguous AWS SigV4 expiry metadata returned through authenticated task lookup and proven usable by the signed download. Unsupported/missing expiry fails closed. Expiry is signed issue time plus the lesser of signed lifetime and the documented two-hour output lifetime, minus 60 seconds. Reject future-issued, expired or malformed signatures; check expiry again before persistence. A fresh signed URL for the same task may be used only after successful validation. Never set expiry from recovery wall time alone.
6. Reacquire the owner-checked session lock and recheck job ID, session, original creation time, mode, task, product/category, original asset and product-reference bindings. Only status/error/result/update timestamp and internal reconciliation audit may change. Concurrent completed results win unchanged. Preserve the previous timeout/status/timestamp and validated content hash/MIME/length in internal audit metadata. No private audit fields are added to the public job response.

No SQL migration is required: the optional reconciliation audit is stored in existing `visual_sessions` JSONB and old records still parse. **Rollback caveat:** the previous backend's strict schema does not recognize the new audit field. After reconciliation records exist, do not roll back to that parser; use a compatible rollback/forward fix that retains audit evidence. Never delete production audit fields to force compatibility.

## Android v7 and operational limits

The unchanged v7 controller restores its original request journal and reads the same job through authenticated list/refresh. Automated compatibility coverage boots the failed job, reconciles on the server, and refreshes it to a genuine image-result contract with zero create/advance calls. The viewer contract and original portrait association are unchanged. This is code-level compatibility, not a new physical Samsung acceptance or proof that the historical output is currently accessible.

V7 does not itself invoke the new recovery endpoint for a terminal failed job. An authorized operator must reconcile through the supported owner-authenticated API first. No device-journal editing, credential reset or APK rebuild is required. If the original output is no longer accessible or its expiry cannot be verified, recovery fails without spending; no replacement render is authorized.

## Deployment and later recovery procedure

Deployment and production reconciliation are separate approval boundaries. This implementation task executed neither.

1. After explicit deployment authorization, deploy the reviewed backend revision with existing configuration and budgets. No migrations, image uploads, ledger initialization/reset or provider smoke render is part of this change. Standard startup checks remain unchanged.
2. After separate authorization to recover this job, verify the same owned session/job/task/portrait and baseline accounting through supported read-only checks. Use the existing owner's credential without printing, persisting in scripts or publishing it.
3. Issue the empty-body reconciliation POST for the original job. Never supply a replacement request/task/asset or call create/start. If the response is lost, read the same job first; repeated reconciliation is safe and cannot create a paid operation.
4. If completed, refresh v7 and inspect Original/result, expansion/zoom/Back, fidelity and actual remaining expiry. If running/unavailable/expired, stop and report; do not start another render or alter expiry. Confirm the original E01/E05 decisions, constraints and accounting remain unchanged.

## Verification evidence

Final source: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000` — **916 passed, 0 failed, 0 skipped, 47 files**, 32.37 seconds. Repository `npm run lint`, root/API and mobile `npm run typecheck`, and `npm run build:api` all passed. Markdown validation checked **89 files / 622 local links with zero errors**; `git diff --check` passed. Changed source/documentation and the production API bundle passed a scan against configured secret values and private incident identifiers/URLs. No APK build/export or production operation was performed. Tests use fixed loopback PostgreSQL/S3 fixtures and injected provider responses, including the real adapter with injected HTTP. No production environment is loaded by tests.

Coverage includes the historical timeout, lost acknowledgment, known/missing/late task references, running/provider-failed outcomes, wrong owner/session/product/asset, changed bindings during I/O, expired/malformed signature metadata, inaccessible/wrong-host/redirected/MIME-mismatched/corrupt/oversized images, stalled headers/body, poll failures, concurrent completion, interrupted recovery, restart persistence, no ledger mutations and v7 refresh compatibility. The existing failure-characterization tests now assert the corrected behavior.

The isolated mock recording fixture gained a validator for its exact generated, visibly labeled local image only. This does not relax production hostname/expiry/image checks. ESLint now excludes ignored build/evidence artifacts so local APK audit scripts are not mistaken for repository application source.

Production baseline is the prior October 20 observation: OpenAI 25 judge requests / USD 0.33519680 charged or held; YouCam 11 committed renders. No production calls or mutations were performed during implementation, so this is not a newly polled balance. The dedicated silver/USD120 session, E01 unselected and E05 unrejected were not accessed or changed.
