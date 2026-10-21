# Android v9 — explicit consent for queued try-on

October 21, 2026. Builds on backend correction `756bd98991cad809db92085b9b9fea9f282eb466` on `fix/never-submitted-queued-jobs`. No backend deployment or paid production operation is included.

## Consent boundary

Automatic controller scheduling accepts only `processing` jobs and rechecks that status immediately before advancement. A `queued` job is never advanced by boot, remount, refresh, navigation or foreground restoration, even when its request ID matches the durable journal. The existing request ID remains intact for explicit continuation after a lost creation acknowledgment.

Queued UI says **Ready for your approval**, provides **Start existing try-on**, and warns that starting may consume one YouCam render. The existing busy lock prevents overlapping taps. No timer can submit a queue; only the explicit `start()` action can do so. Processing jobs retain bounded polling. Their private task reference is not exposed to Android; the server's persisted claim and no-replay checks remain authoritative for uncertain submissions without a task. Terminal jobs cannot be restarted by `start()`.

No new protocol or credential/persistence format is introduced. Portrait recovery, same-task result reconciliation, image viewer and shopping decisions are unchanged. This is protection against accidental first submission by this client, not server-verifiable proof of a human tap: older clients or arbitrary authenticated callers can still invoke advance. Do not authorize deployment assuming v8 is safe; install and verify v9 for the dedicated workflow first. Enforcing consent across old/untrusted clients would require a separately reviewed server protocol.

## Automated acceptance

- Full local integration-enabled suite: **964 passed / 50 files, zero failed/skipped**.
- Lint and root/API/mobile TypeScript checks passed.
- Android export: **95 files**, seven credential sentinels, zero matches.
- Regression tests replace the v8 automatic-submission characterization with no-submission assertions for aged queues across restart, refresh, navigation and background/foreground, followed by one explicit submission using the same identity and duplicate-tap protection.
- Existing known-task/uncertain-submission, terminal outcomes, upload/result recovery, PostgreSQL restart/concurrency and accounting suites pass with isolated providers. No live provider calls were made.

The initial full run failed because local Docker services were stopped. After starting the isolated PostgreSQL/S3 fixtures, all integration tests passed. The initial APK build stopped because ANDROID_HOME was missing; the build was rerun with the installed SDK path.

Native/artifact acceptance is recorded below when verified. The backend fix must not be considered operationally accepted until the installed v9 client is checked. Production baseline observed before installation: OpenAI 25 requests / USD 0.33519680; YouCam 11 committed renders; original failed E01 and new queued E01 both preserved.

## Signed artifact and Samsung acceptance

APK: `artifacts/android/shopping-concierge-0.1.0-v9-arm64-release.apk` (ignored local artifact; not published).

SHA-256: `fbba58fa87792036f19f13e5f51a278e2964bf35562dfcfb4439a0a79c7307b1`.

Signature verification passed. Certificate SHA-256 `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34` matches prior releases. Package `com.youcam.shoppingconcierge`, version 0.1.0/code 9, minSDK24, targetSDK36, ARM64 only. Production HTTPS backend and both recovery controls plus explicit consent label/warning verified in the bundle. All 1,299 APK entries scanned against five configured sensitive values: zero matches. Changed source/documentation also passed the configured-secret scan.

Initial host ADB checks listed no devices; the owner subsequently connected the Samsung. On October 21 at approximately 17:14–17:16 WAT, `adb install -r` succeeded and installed version code 9 was confirmed. No uninstall or data clear was performed.

The existing E01 screen displayed **YouCam try-on · Ready for your approval**, **Start existing try-on**, and the one-render spending warning. Enabled button bounds were `[96,906][984,1030]`. It was never tapped. Initial deep-link restoration briefly showed the session-restoration screen; normal navigation allowed the existing session to restore without a new session or shopping refresh mutation. Leaving and reopening E01 preserved the queue, and the app was returned to shopping.

Before/after SELECT-only snapshots match exactly for session ID, portrait ID, semantic shopping state, both jobs, budgets, usage and reservations. Silver earrings/USD120, E01 unselected and E05 unrejected remain intact. The original failed task is preserved; the queued replacement still has no task or reservation. The sole stored JPEG remains byte-identical to the previously reviewed portrait (300×375), and owner/session association is valid. OpenAI remains 25 requests / USD 0.33519680; YouCam remains 11 committed renders. No paid action, upload or provider operation was performed.

**GO for separately authorized deployment of the reviewed queued-job backend fix for this verified v9 workflow**, subject to fresh deployment preflight. Deployment has not occurred. The eventual first paid advancement of the existing queued request still requires separate owner authorization after deployment; do not tap Start against the older backend, whose age gate remains in effect. Older clients remain outside the v9 consent guarantee.
