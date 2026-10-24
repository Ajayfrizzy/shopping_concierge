> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Android v8 — explicit same-task YouCam recovery

Version 0.1.0 / Android code 8 adds **Check existing YouCam result** for the current owned live job when it has failed with `PROVIDER_TIMEOUT`. This closes v7's invocation gap: v7 could display server-recovered results but had no control to initiate the supported authenticated reconciliation operation.

The existing credential provider supplies Authorization directly to the existing visual API client. The action posts `{}` to `/v1/sessions/:id/vto/:jobId/reconcile`, using only the current session/job identifiers. No task ID or output URL is accepted from the caller. The backend retains final task eligibility, ownership, output validation and expiry decisions; see [the backend fix](../recovery/YOUCAM_TASK_RECOVERY_FIX.md).

Duplicate taps are locked. Progress says the existing provider task is being checked. Completion is accepted only for matching job/session/product/asset/category/mode/creation identity. Running or still-timeout responses are not labeled success. Unavailable/expired responses and other failures explicitly state that no additional render started. A network error triggers one authenticated job-list GET, never another reconciliation POST. A failed GET leaves the uncertainty visible. The existing recovery button stays available for eligible failures.

Recovery is never invoked by mounting, navigation or cold restart. It does not write the render journal, change credentials, upload bytes, create jobs, call paid advancement or alter shopping decisions. The original v7 photo recovery remains unchanged. Normal paid Try on remains a separate action. No production reconciliation is part of this implementation acceptance.

## Automated verification

- Full isolated integration-enabled suite: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000` — **947 passed, 49 files, zero failed/skipped**.
- Repository ESLint and root/API plus mobile TypeScript checks passed.
- Android export and credential-sentinel scan passed: **95 files, seven sentinels, zero matches**.
- New controller/client/UI tests cover ownership/identity, eligible and hidden controls, explicit empty authenticated POST, duplicate taps, completion/running/unavailable outcomes, mismatched responses, uncertain acknowledgment with one GET, navigation and restart. Existing upload-recovery tests passed unchanged.

## Distribution boundary

Implementation is pushed on `fix/android-v8-task-recovery`, not main: the owner confirmed main Git pushes trigger RumptyCloud deployment, and this task prohibits backend deployment. No backend source or configuration changes are included. The public GitHub Release is not replaced, and no final video is recorded.

## Signed artifact and native acceptance — October 20, 2026

APK: `artifacts/android/shopping-concierge-0.1.0-v8-arm64-release.apk` (ignored local review artifact).

- SHA-256: `da52edcfdfd960811d4d5e96046d0406c2a63dc34ff2f89ba5aeb3202b937142`.
- Package `com.youcam.shoppingconcierge`; version 0.1.0 / code 8; ARM64 only, minSDK24 / targetSDK36.
- APK v2 signature verifies. Certificate SHA-256 `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34` matches v7 and prior releases.
- APK scan: 1,299 entries; five configured server secrets checked, zero matches. Production HTTPS backend, both photo and task recovery UI strings, and sole ARM64 ABI verified.
- `adb install -r` succeeded on Samsung SM-S908N. Installed version code 8 confirmed; no uninstall, data clear, credential extraction or credential reset.

The initial app restoration encountered a connection error. Device connectivity/DNS checks passed; one supported Refresh session restored the existing session. That existing flow may refresh deterministic result/history metadata; it is not an OpenAI search or a shopping-decision change. Read-only comparison confirms the same session and revision-2 shopping state, silver earrings/USD120, E01 unselected and E05 unrejected. The original E01 job, provider task reference and portrait association remain unchanged. The sole stored JPEG remains byte-identical to the approved portrait.

E01's native screen displayed Quiet Round Earrings, the original timeout error and the enabled **Check existing YouCam result** button at bounds `[96,898][984,1022]`. The button was **not tapped**. Choose another photo was also left untouched. The app was returned to shopping. No successful production recovery, result-quality assessment or new recording window is claimed.

Read-only accounting before installation (21:58 WAT) and after native navigation (22:08 WAT) remained OpenAI **25 requests / USD 0.33519680**, YouCam **11 committed renders**. No recovery endpoint, new upload, render, planner operation, backend change/deployment or final recording was executed. The existing historical failed job has no recovery audit/result added.

**GO for separately authorizing the explicit recovery action on v8**, subject to fresh health/accounting preflight and output availability. This acceptance does not authorize tapping it now or guarantee the old provider output remains accessible. The public release remains unchanged.

[Sanitized native acceptance evidence](../../evidence/task-recovery-v8/acceptance.json).
