> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Android v11 — private image reload

## Cause and scope

The completed E01 result remained accessible. A read-only request to its stored, unexpired signed URL returned HTTP 200 and 188,817 bytes. The same URL with an intentionally invalid diagnostic Authorization header returned HTTP 400 / `InvalidArgument`. No real credential was used in that diagnostic, no provider status polling or reconciliation occurred, and no private URL or image was logged.

The installed React Native 0.86.3 implementation explains the transition failure: `Image.android.js` forwards headers from array sources, while `ReactImageManager.setHeaders` ignores null. The v10 viewer reused a native Image between the authenticated Original array source and the provider result object source. Removing the headers prop therefore did not clear the native Authorization header. The inline preview also followed the modal comparison mode, and shared errors persisted without a successful-load reset.

The Android-only correction gives original/result images distinct native identities, supplies explicit empty headers through an array source for signed output, and keeps the inline preview on the result. No guest credential is added to provider-image requests. Image errors are scoped to their view and clear on successful load; an unresolved Original source is not rendered. Closed modal images are unmounted. Foreground transitions recheck the signed deadline. Forced cache reload is removed; cache behavior does not bypass expiry.

The backend stores the validated signed URL and expiration in the completed job. Listing jobs returns that stored reference; it does not renew it. There is no read-only completed-result renewal endpoint in the existing protocol. This change does not add one, invoke reconciliation, or automatically create/advance a job. Genuine expiry remains visible and requires a separately scoped decision.

## Verification

Six interactive fixture tests reproduce Android's retained-header semantics and exercise initial display, repeated Original/result switching, zoom/fit, collapse/Android Back, navigation/remount, original-access failure, image error/success recovery, and background/foreground expiry. Four fail against v10; all six pass with the fix. Test fixtures use only synthetic URLs and tokens. Existing job/controller/accounting tests retain paid-operation and shopping-state protection.

Full local integration suite: **983 passed, 51 files, zero skipped** using `M5_INTEGRATION=1 npm test -- --maxWorkers=2 --testTimeout=15000`. Local Docker had to be started. The initial default run hit an existing five-second test deadline equal to the database pool's five-second acquisition timeout; the passing run changes only the runner deadline, not assertions or backend code.

Lint and root/mobile TypeScript pass. Android export passes; 95 files scanned against seven server-secret sentinels with no matches. React test renderer and its types are development-only dependencies used for interaction tests. Release version code is 11; application ID, backend URL, signing identity and stored-session protocol are unchanged.

## Native acceptance

Signed ARM64 APK: `artifacts/android/shopping-concierge-0.1.0-v11-arm64-release.apk`.

SHA-256: `82f7efad6957d71a3778d127140d23009b6d9081b2675ec9c8ab8d63ec7f9ed0`.

Existing certificate SHA-256 verified: `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34`. Package remains `com.youcam.shoppingconcierge`, code11, ARM64, production HTTPS backend. APK scan: 1,299 entries, five configured sensitive values, zero matches. Changed-source scan: six files, five configured sensitive values, zero matches.

Signed build passed after setting the existing local SDK path. `adb install -r` succeeded; Samsung reports code11. No data clearing or uninstall occurred. Existing shopping session restored. Samsung acceptance passed at approximately 20:58 WAT on October 21: genuine E01 PNG visible, authenticated Original fully loaded, switch back to VTO visible without error, repeated comparison, expansion, zoom to 150%, Fit image to 100%, Android Back, modal reopening, shopping navigation and reopening, and background/foreground. Private screenshots were inspected locally and are not committed. The result shows a small round stud aligned with the visible earlobe; 300×375 resolution limits fine detail. Returned to shopping.

SELECT-only before/after snapshots match exactly for session ID, portrait ID, full shopping state, both jobs including original task references, reservations, usage and budgets. The historical failed job remains intact and the recovered job remains completed. Silver/USD120, E01 unselected and E05 unrejected are preserved. OpenAI remains **25 requests / USD 0.33519680**; YouCam remains **12 committed renders**.

The existing signed output expires **October 21, 2026 at 21:57:00 WAT**. At native acceptance, approximately 59 minutes remained. **GO for recording within that window**, allowing time to finish before expiry. No automatic renewal or post-expiry availability is promised. Zero new render, reconciliation, upload or OpenAI operations occurred. No merge, backend deployment, APK publication or recording is authorized by this implementation task.
