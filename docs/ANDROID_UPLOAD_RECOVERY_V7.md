# Android upload recovery — code 7 acceptance

The code-6 [upload recovery investigation](UPLOAD_RECOVERY.md) identified a persisted portrait whose acknowledgment never reached the phone. Code 7 adds owner-authenticated, explicit recovery without uploading image bytes again or starting a render. The existing public GitHub Release remains code 6; code 7 is a review artifact, not published.

## Implemented behavior

On an eligible product's photo screen, **Recover existing upload** offers a known-upload-ID lookup. A durable pending ID is filled in automatically when available. A legacy upload can be recovered by entering its exact ID from the private upload record; there is no guessed ID, cross-session search or automatic choice among images.

**Check existing upload** uses the existing authenticated metadata and content GET routes. It verifies session, asset ID, required portrait/hand/wrist type, byte length, SHA-256 and MIME signature. For pending uploads it also matches the original fingerprint. The app displays the authenticated original and requires **Use recovered photo** after the image loads. This updates only the normal local VTO photo association. The success message states that no upload or render occurred. The inner Try on action remains a separate explicit choice.

The new strict recovery journal stores only session/product IDs and the pending upload ID, type, MIME, byte length and SHA-256. Intent is saved before the upload POST. On timeout, navigation or restart, the app offers recovery instead of automatically repeating the POST. Credentials, image bytes and private URLs are never journaled. Duplicate taps are locked, missing/mismatched/corrupt/unavailable assets fail without association, and pending outcomes block a different upload. The existing render journal and paid-request identities are unchanged.

The current asset contract has no asset-expiration timestamp. Unavailable/expired-resource HTTP responses are rejected; the app does not invent a retention deadline or assume an old asset is accessible. Manual legacy lookup requires visual confirmation because code 6 did not retain its expected fingerprint on the phone.

## Scope and deployment

Changed application files: `apps/mobile/app/try-on.tsx`, `apps/mobile/src/upload-recovery.ts`, `apps/mobile/src/visual-client.ts`, the optional binary-response type in `apps/mobile/src/client.ts`, and release `versionCode: 7` in `apps/mobile/app.config.ts`. Regression coverage is in `tests/upload-recovery.test.ts`.

**No backend change or deployment is required.** The update uses existing owner-authenticated GET endpoints. A same-package, same-certificate Android update is required; uninstalling, clearing storage or resetting credentials is not part of acceptance. No OpenAI planning, shopping decision, render, production upload or direct database mutation is authorized by this acceptance task.

## Automated acceptance — October 20, 2026

- Full isolated integration-enabled suite: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000` — **849 passed, 43 files, zero failed/skipped** on the final source state.
- Twelve new recovery tests cover lost acknowledgment after persistence; navigation/cold restoration; authenticated known-ID recovery; cross-owner/session/product denial; missing/unavailable/expired resources; fingerprint/type/identity mismatch; multiple uploads and ambiguous input; corrupt bytes; duplicate taps; network and local-journal failures; normal upload success; no additional POST/PUT or provider start.
- Root/API and mobile TypeScript checks pass; repository lint passes. The API is included in root `tsconfig.json`; it has no separate `apps/api/tsconfig.json`.
- Android export succeeds: **95 files scanned, zero matches for seven server-secret sentinels**.
- The first Gradle attempt could not locate the SDK. The build was restarted with the installed `ANDROID_HOME`; no production setting changed.

## Native and artifact acceptance

The signed ARM64 APK is at ignored local path `artifacts/android/shopping-concierge-0.1.0-v7-arm64-release.apk`.

- SHA-256: `552b9147adac9d4f2e708ce0ae31fcdd70c80e03d57a91777264def0e9807da6`.
- Package `com.youcam.shoppingconcierge`, version 0.1.0, code **7**, minSDK24/targetSDK36.
- APK v2 signature verifies; certificate SHA-256 `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34` matches code 6.
- All **1,299 APK entries** scanned against **five configured server-secret values** in memory: zero matches. The production HTTPS backend and recovery UI are embedded; the sole native ABI is `arm64-v8a`.

**Native acceptance passed on Samsung SM-S908N, October 20.** Earlier ADB disconnections blocked installation; a later streamed install attempt also disconnected before its outcome could be confirmed. The owner then reported installing v7. Once ADB stabilized, read-only inspection verified installed version 0.1.0 / code 7 and the exact APK hash above. No uninstall, data clear or credential reset was performed by this workflow.

The preserved session opened normally. On E01, **Recover existing upload → Check existing upload** used the privately recorded existing asset ID. The authenticated metadata/content checks passed; the preview visibly matched the approved synthetic side portrait. **Use recovered photo** reported: “Existing photo recovered. No photo was uploaded and no try-on was started.” The photo association and explicit, untapped Try on control survived both returning to shopping/reopening E01 and a controlled process stop/cold launch. The app was left on shopping, displaying E01 with an empty composer.

No image was uploaded, no provider operation was submitted, and no backend deployment was needed. The original and sole stored JPEG remains byte-identical with its existing asset identity. A preview-only crop remains in ignored local artifacts; no private identifier, credential, original URL or full device screenshot was published. [Sanitized acceptance measurements](evidence/upload-recovery-v7/acceptance.json).

| Observation | Before native recovery (14:16 WAT) | After cold restart (14:22 WAT) |
| --- | ---: | ---: |
| OpenAI judge requests | 25 | 25 |
| OpenAI charged-or-held USD | 0.33519680 | 0.33519680 |
| YouCam judge committed renders | 10 | 10 |
| Portrait assets in dedicated session | 1 | 1 |
| Visual jobs in dedicated session | 0 | 0 |
| Shopping-state revision | 2 | 2 |
| Session persistence version | 4 | 6 |

The same dedicated session, category, silver/USD120 constraints, goal, decisions, feedback and dependencies were verified unchanged. E01 remains unselected and E05 unrejected. The persistence version increased through the app's existing deterministic category/result refresh on launch; history/reply metadata therefore is not byte-identical. This is not a new search, changed shopping decision or planner call. Initial preparation had persistence version 1; the owner's intervening app launches had already brought it to 4 before native acceptance. No direct database or journal patch occurred. All ten historical jobs remain completed and there are no pending OpenAI diagnostics.

**GO for the previously approved single E01 render attempt in a separate task.** It was not initiated here. Three filming planning operations remain reserved, no genuine new result or expiration deadline exists yet, and final recording is still not authorized. The public GitHub Release remains code 6; this acceptance did not publish or replace it.

## Recording implications

The 150-second story remains governed by [FINAL_DEMO_PLAN.md](FINAL_DEMO_PLAN.md). The existing recording controller still pins code 6; it must be reviewed for the accepted installed version before future recording. Recovery acceptance does not authorize filming or imply a genuine E01 result already exists. The one prior E01 render attempt remains unused until explicitly initiated in a separate task.
