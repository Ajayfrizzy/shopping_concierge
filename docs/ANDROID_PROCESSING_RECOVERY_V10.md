# Android v10 — explicit processing-task recovery

October 21, 2026. Android-only correction on `fix/android-v10-processing-recovery`; no backend deployment or production reconciliation is part of acceptance.

Owned live processing jobs now expose **Check existing YouCam result**, alongside existing terminal PROVIDER_TIMEOUT recovery. Queued, completed, mock, mismatched and unrelated failed jobs remain excluded. Server ownership, stored-task eligibility, output validation and immutable bindings remain authoritative; the client does not receive or supply private provider task IDs or output URLs.

The existing authenticated client sends one empty-body reconciliation POST for the current job. Busy locking prevents concurrent taps. Recovery pauses scheduling before the call and stays paused afterward; network uncertainty triggers at most one authenticated list GET, never a repeated POST. Processing, completed, unavailable and error messages retain their normalized semantics.

Live processing jobs no longer schedule automatic `/advance` calls on boot, refresh or visibility changes. They use explicit recovery checks instead, and the old Resume checking result control is hidden for live processing jobs. This prevents native acceptance, restoration or a simultaneous timer from invoking production reconciliation before consent. Mock processing retains its existing polling behavior. First submission still requires explicit Start; v9 queued-job consent, request journals, portrait recovery, credentials and viewer remain unchanged.

## Verification

Full isolated integration-enabled suite: **967 passed / 50 files, zero failed/skipped**. Tests include processing control visibility, duplicate taps with a pending reconciliation, paused advancement across restart/navigation/refresh, still-processing results, one GET after network uncertainty, and all existing terminal recovery, identity, portrait, queued consent, PostgreSQL and accounting regressions. Providers are injected; no paid calls occur.

Lint, root/API/mobile TypeScript and Android export/secret checks are recorded with artifact/native acceptance below. Starting stopped Docker fixtures was necessary before the full run; no production infrastructure was changed.

## Operational boundary

No new backend protocol is required. Private task presence is verified by the deployed reconciler, not inferred on Android from status alone. Older clients can still call advancement; v10's explicit-only behavior does not enforce consent on arbitrary authenticated clients. The signed release preserves package and credential storage. No production button is tapped during implementation acceptance.

## Signed APK and Samsung acceptance

APK: `artifacts/android/shopping-concierge-0.1.0-v10-arm64-release.apk` (local ignored artifact, not published).

SHA-256: `b5d3614b77e04252d257e72c2f16244bcda51aea57e5490aa760d2e8749fa1af`.

Signature verifies with existing certificate SHA-256 `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34`. Package `com.youcam.shoppingconcierge`, version 0.1.0/code10, ARM64, minSDK24/targetSDK36. Production HTTPS backend and recovery/consent labels verified in bundle. APK scan: 1,299 entries, five configured sensitive values, zero matches. Export scan: 95 files, seven sentinels, zero matches. Changed-source scan, lint, TypeScript and whitespace checks pass.

`adb install -r` succeeded on Samsung SM-S908N; installed code10 confirmed. No clear-data/uninstall occurred. Native processing E01 screen showed Quiet Round Earrings, Creating your preview, and enabled **Check existing YouCam result** at `[96,776][984,900]`. The action was not tapped. It remained available after Back/reopening, with no Start/Resume action shown for this processing job. Returned to shopping.

Read-only before/after snapshots match exactly for session, portrait identity, shopping state, both jobs (including task bindings), reservations, usage and budgets. Approved JPEG 300×375 remains byte-identical, valid and associated with the dedicated session. E01 remains unselected, E05 unrejected, silver/USD120 intact. OpenAI remains 25 requests / USD 0.33519680; YouCam remains 12 committed renders. Zero production reconcile, advance, upload, planner or paid provider operations were executed. Backend was not redeployed.

**GO for separately authorized one-shot authenticated reconciliation**, subject to fresh identity/accounting/readiness checks and output availability. No result accessibility, quality, expiry or final-recording readiness is claimed by this implementation acceptance.
