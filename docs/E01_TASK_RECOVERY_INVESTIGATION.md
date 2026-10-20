# E01 completed-task recovery investigation — October 20, 2026

**Conditional GO to implement and review recovery of the original task; NO-GO to recover through current production interfaces or record the final video.** No production fix or recovery mutation was performed. The original task still reports completed and supplies a fresh output reference; image-byte accessibility and visual quality remain unverified.

This follows the [single-attempt outcome](E01_LIVE_RENDER.md). All times below are WAT (UTC+1). Private task/job/asset identifiers, credentials, object keys and signed URLs remain in ignored local evidence.

## Observations and root cause

Read-only PostgreSQL transactions at **15:26:52** and **15:29:37** correlated the sole session job, original request/job ID, stored provider task, recovered portrait and matching committed reservation. All identities are unchanged. Application status remains `failed / PROVIDER_TIMEOUT`, result null. The original request ID is the job ID and ledger reservation ID; it is not a provider-side idempotency key.

| Evidence | Finding |
| --- | --- |
| Job creation | 15:02:32.278 |
| Persisted submission claim / lastPollAt | 15:02:33.916 |
| Earlier private snapshot at 15:03:51 | Processing job already had provider task reference and committed reservation |
| First read-only provider completion observation | 15:12:55; actual completion time is unknown |
| Application terminal update | 15:13:35.146 |
| New authenticated provider status GET | 15:27:25.535: same task completed, output reference present |

**Confirmed application failure:** [service.ts](../apps/api/src/youcam/service.ts) checks ten minutes since job creation before calling `provider.poll`. It changes an overdue processing job to failed even when its task has completed externally. Its initial terminal-state guard subsequently prevents recovery. The unchanged `lastPollAt` supports that no later application poll was claimed after initial submission and before timeout. The external diagnostic provider GET does not advance application state.

**Acknowledgment distinction:** provider-to-backend acknowledgment and task-reference persistence succeeded in this case. The live adapter received a task ID, committed its reservation, and the service stored that ID. The phone did not receive a usable advancement response. [visual-client.ts](../apps/mobile/src/visual-client.ts) aborts requests after 20 seconds and maps transport/JSON failures to the same NETWORK message. The backend submission path includes object retrieval, upload preparation, upload, task submission and accounting. A client deadline expiring during that path is plausible, but no captured transport trace or hosting request-duration logs prove it. The precise network failure and actual provider completion time remain unknown.

[try-on-session.ts](../apps/mobile/src/try-on-session.ts) pauses polling on any operation error; refresh reconciles the same request and then schedules active-job advancement. There is no independent background poller in this path. The safety pause prevented replay, but the delayed refresh hit the server cutoff. Normal polling is bounded to 40 checks with a three-second interval and also pauses when hidden. None of those bounds establish provider failure.

## Output availability and privacy boundary

One authenticated GET through `LiveYouCamProvider.poll` was made during this investigation, constrained to GET only and the original stored task. The response passes the adapter's status schema and configured HTTPS host allowlist. It reports completion and returns an output reference whose signature metadata is dated **15:27:25**, with a 7,200-second lifetime: nominal deadline **17:27:25 WAT, October 20**.

This is signed-link metadata, **not proof that bytes exist or remain retrievable**, and does not establish a safe recording window. No anonymous GET/HEAD of the private output URL was performed; no image bytes were downloaded. The existing backend exposes no owner-authenticated result-content proxy for this failed job. Actual output accessibility, MIME/decoding and visual fidelity need a separately approved authenticated recovery/validation path. Do not treat a future status response as extending object retention without verification.

## Persistence, authorization and duplicate-charge analysis

The persisted claim is `status=processing` with `lastPollAt`; there is no separate submission-claim ID. PostgreSQL serializes visual updates under the owned shopping-session lock. The record retains task ID, product asset reference, original portrait ID and request/job ID. The dedicated shopping state remains unchanged.

The provider adapter supports lookup by **known task ID only**. No existing request-ID lookup or provider idempotency header is implemented. If an actual provider submission acknowledgment were lost, a null task reference would remain uncertain; guessing an ID or resubmitting cannot safely resolve that case. That is not the present incident.

Adjacent gaps found in source, not asserted as causes here: an acknowledgment followed by ledger-commit failure can prevent task ID return, and a late acknowledgment is stored only while the job is still processing. A concurrent 60-second unknown-submission timeout can therefore prevent retention of a late task reference. Future hardening should retain a received task reference durably without replay or silently overriding a terminal failure.

Known-task polling invokes no ledger reservation, commit or provider submission. Original-ID create replay returns the same job and validates product/asset identity. A **new** request ID can create another paid attempt after terminal failure, so it is prohibited. Existing reservations must remain untouched. A recovery handler must structurally lack access to `provider.start`, upload and accounting mutation functions; relying only on a UI warning is insufficient.

## Minimum proposed fix — not implemented

1. Add an explicit owner-authenticated, poll-only reconciliation operation, for example `POST /v1/sessions/:id/vto/:jobId/reconcile` with empty body. Resolve the task exclusively from server storage; accept no task ID, URL, product or portrait override. Allow only live processing jobs or timeout failures with a nonempty known task reference. Missing/ambiguous references stop without submission.
2. Verify owned session/asset, E01/category/portrait compatibility, immutable task/product/asset bindings and the matching existing committed reservation. Poll that task outside the database lock with a bounded timeout. Authenticate to the official provider only; do not forward credentials to an output host. Validate genuine completion and allowed output location. Validate content through an owner-authorized server path before declaring output accessible, refusing redirects, oversized/non-image/corrupt or expired output.
3. Under the owned session lock, recheck that task/job/asset identities and expected timeout state have not changed. Atomically replace only that job's `status`, `error`, `result` and `updatedAt` on verified completion, with an audit event preserving the previous timeout and reconciliation provenance. Concurrent/repeated calls return the existing valid completion without replacing identity or extending expiry. No new job, upload, reservation or shopping decision is created.
4. Use verified output expiration metadata with a safety margin, bounded by known provider retention; do not reuse `now + 110 minutes` blindly for an old result. If expiry cannot be established conservatively, or output has expired/missing bytes, report unavailable and preserve the failed job. Never fabricate completion or automatically create a replacement render. A running task or transient status error remains unresolved and is explicitly rechecked within bounds, without paid replay.
5. For future normal operation, separate a local waiting deadline from provider terminal failure. Known-task jobs need a bounded status-only reconciliation path after local timeout. Preserve the existing client request journal and conservative pause on ambiguous responses. A future mobile improvement can expose explicit same-job recovery and distinguish waiting from failure; increasing the client timeout alone does not fix the terminal-state problem.

**Deployment scope:** backend service/route and tests, plus any output-validation support and audited reconciliation metadata selected at implementation review. No catalog, shopping engine, ledger or provider-budget change. Backend implementation and deployment require separate approval. A new APK is not inherently needed to recover this incident: after an approved owner-authenticated operation persists a valid result, v7's existing refresh/list flow can load the same job. A new visible recovery control would require a separately scoped client change and signed release. No APK/build/deployment was performed here.

## Exact production mutation requiring separate approval

After review and deployment, authorize **one owner-authenticated reconciliation of the original existing E01 job**, using only its stored provider task and existing portrait. On verified genuine completion, the application may atomically transition this specific timeout job to completed, clear its timeout error, persist the validated result with a non-fabricated expiry, update its timestamp, and record the previous failure/recovery audit evidence. The job ID, task ID, original creation time, owner/session, product/portrait bindings, shopping state and committed ledger reservation must remain identical.

This is a proposed supported service mutation, **not permission to patch database rows, device journals, provider states or expiry manually**. Approval must cover implementation/deployment and the subsequent authenticated recovery/content validation separately from this investigation. If validation fails, no completed result may be persisted. Additional renders, uploads or OpenAI calls remain outside scope.

## Isolated tests and checks

Added [e01-timeout-investigation.test.ts](../tests/e01-timeout-investigation.test.ts), five characterization tests using in-memory storage and injected provider responses:

- Known completed task beyond ten minutes becomes failed without polling; terminal replay stays blocked and never submits twice.
- Lost client acknowledgment before the cutoff recovers the original task with one start.
- Unknown provider acknowledgment retains the request and never automatically resubmits.
- Cross-owner and cross-session checks deny polling.
- Transient status failure retries only the same task before the deadline.

These tests document current behavior, including the bug; they do not certify a fix. Ran `npx vitest run tests/e01-timeout-investigation.test.ts tests/youcam.test.ts` (**36 passed**) and `npx vitest run tests/try-on-session.test.ts tests/youcam-budget.test.ts` (**16 passed**): **52 passed in four files**. Targeted ESLint and root `tsc --noEmit` passed. No integration database writes or external calls were made by these tests.

Before accepting a fix, add isolated PostgreSQL concurrency/restart tests for duplicate reconciliation, changed bindings, wrong-owner access, late acknowledgment retention, malformed/wrong-host/expired/corrupt output, unavailable expiry, failed-task eligibility, read-only poll timeout and no reservation/start/upload invocation. Verify v7 refresh recognizes the recovered same job without a paid submission. Current tests are not evidence that those proposed changes work.

## Final accounting and state

Read-only before/after snapshots match exactly for jobs, reservations, budgets, usage and shopping state. OpenAI remains **25 requests / USD 0.33519680 charged or held**; YouCam remains **11 committed judge renders**. The three OpenAI filming operations remain reserved. Earrings/silver/USD120, E01 unselected and E05 unrejected are preserved in the same session. No phone interaction was needed during this investigation.

Only tests and documentation were changed; private evidence is ignored. No production write, paid submission, upload, session creation, accounting adjustment, rebuild, deployment or recording occurred. Documentation/tests remain local and uncommitted.
