# Aged queued YouCam jobs — backend correction

Implementation evidence: October 21, 2026. No deployment, production database access, provider call, upload, Android rebuild or recording was performed for this implementation.

## Lifecycle

An old `queued` job with `taskId=null` and `lastPollAt=0` may claim its first submission through the existing owner-authenticated advance operation. Creation time, request ID, product and portrait bindings are preserved. Queue age alone is no longer a provider timeout.

The transaction persists `processing` and a claim timestamp before provider I/O. Concurrent advancement cannot claim it twice. A queued record with prior claim evidence or a task reference fails closed. A processing record without a task retains the existing uncertain-outcome behavior; it is never resubmitted. Known-task polling/reconciliation and terminal replay remain unchanged. A late task acknowledgment is still retained.

Before submission, the service rechecks owned portrait identity, session, image type, bytes/hash and current product/category eligibility. The existing live provider adapter still owns current ledger approval, ceilings and duplicate reservation enforcement before its paid task POST. No budget, reservation, accounting schema or job creation timestamp is rewritten. No replacement job or migration is introduced. Backend reads do not invoke provider advancement.

## Android v8 limitation and deployment gate

The client correction is now implemented in [Android v9](ANDROID_QUEUED_CONSENT_V9.md).
The v8 findings below remain historical evidence. Deployment remains gated on
verified v9 installation and native acceptance for the dedicated session.

**NO-GO for deployment to the current demo environment or advancement through the installed v8 app under a fresh-action-only policy.**

The API contract is compatible with v8: explicit Resume can use the existing request journal and advance the same job. However, v8's controller also schedules advancement of a journal-matched queued job after boot, refresh or becoming visible. The existing lost-creation-response test and new refresh/navigation characterization tests reproduce this with isolated providers. Consequently, deploying the relaxed queue-age rule while v8 can restore this queued job could permit its first paid submission without a new explicit tap.

This backend-only change does not claim to fix that client behavior. As requested, Android implementation scope was not expanded. A separately authorized client consent correction (and signed release) or separately reviewed server consent protocol is needed to enforce a fresh user action. Do not launch/refresh the affected workflow after deployment expecting it to be read-only. No APK update is needed for wire compatibility, but v8 alone does not satisfy the spending-safety acceptance criterion.

Once the consent boundary is addressed and separately accepted: deploy only the reviewed backend changes, with no migration, budget reset or record edits; repeat health, session, portrait, claim and ledger checks; separately authorize one advancement of the original queued request. Never substitute a new request or replay an uncertain submission. Rollback must retain the existing same-task reconciliation audit schema from dfe29ca9; this correction adds no persisted fields.

## Verification

- Full isolated integration suite: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`: **963 passed / 50 files, zero failed or skipped**.
- Lint, root/API and mobile TypeScript checks, API production build and diff whitespace checks passed.
- Tests cover aged first submission, identity preservation, simultaneous advances, claim-before-provider ordering, lost creation acknowledgment, no provider work from backend GET, uncertain histories, wrong ownership/session, missing/corrupt/wrong-type portrait, product eligibility, budget rejection and PostgreSQL restart/concurrency. Existing live-adapter reservation/budget tests and known-task recovery tests also pass, with injected HTTP only.
- Two Android characterization cases intentionally establish the existing unsafe automatic-advance limitation; passing them is evidence of the blocker, not acceptance of automatic spending.
- Initial integration run was blocked by sandbox loopback permissions/local services; after starting isolated PostgreSQL/S3 and running with local network access, the complete suite passed. Two fixture corrections supplied valid terminal state and pristine queue state; no production records were involved.

Historical production baseline supplied for this task: OpenAI 25 requests / USD 0.33519680 charged or held; YouCam 11 committed renders. These balances were not freshly queried during implementation.

Security checks: changed source/tests/report and the generated API bundle passed an exact-match scan against five configured sensitive values (zero matches). `npm audit --omit=dev` reported **28 existing production dependency advisories: 18 high, 10 moderate, zero critical**. No dependencies or lockfiles were changed; remediation is outside this narrowly scoped lifecycle correction. This is not a clean dependency-security acceptance.
