> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Production upload recovery investigation — October 20, 2026

**NO-GO for the single E01 render attempt.** The existing portrait is valid, but installed Android code 6 cannot restore its local upload association through a supported no-reupload interface. No upload, provider operation, render, production data edit, app launch, build or deployment was performed during this investigation.

Follow-up implementation and acceptance: [Android code 7 recovery](../acceptance/ANDROID_UPLOAD_RECOVERY_V7.md). This investigation records the earlier code-6 limitation.

## Confirmed findings and uncertainty

The [authorized preparation](../demo/LIVE_DEMO_PREPARATION.md) persisted one portrait in the dedicated session, then displayed a generic network error instead of upload confirmation. Fresh read-only PostgreSQL/S3 checks at **13:33 WAT on October 20** confirmed one valid asset belonging to that session, with valid schema, exact stored byte length/hash, successful image decode and bytes identical to the previously reviewed JPEG. It is 300×375, `image/jpeg`, with no EXIF/XMP/IPTC. Its SHA-256 is `de2768d378ed7773a40dddb83e65b31ea9d04bab6f903037da47a2e6da9d3cbd`.

The approved original derivative remains the PNG with SHA-256 `f5cb4fda87fb79fcfda6f4f85739c823207adaf0f90e41af7cbfd08b3743b8d9`. The app's normal Android picker converted it to JPEG at quality 0.8 during preparation. The current asset is exactly that reviewed conversion, not a different portrait. Its database asset/session relationship and the backend's owner-checked upload transaction establish ownership; this investigation did not extract a guest credential or issue an impersonated owner API request.

Successful persistence followed by missing client confirmation is established. The precise transport failure is **not** established: `visual-client.ts` maps timeout, network and response-decoding failures to the same NETWORK message. It aborts after 20 seconds, but that alone does not prove a timeout occurred. No accessible hosting request logs were available through the configured tools, no upload-log table exists, and the production process was no longer running when checked. Historical handset log output was not available from a current app PID. The server may have sent a response that was lost, or the client may have aborted before it arrived; no claim of a confirmed HTTP 201 delivery is made.

## Why code 6 cannot recover without reupload

- [Upload UI](../../../apps/mobile/app/try-on.tsx) creates the upload request ID in a component `useRef`, alongside image data. It does not persist that pending ID before POST. `controller.photo(uploaded.id)` runs only after the upload response is received and validated. Component cleanup explicitly clears the pending upload; it also disappears on process exit.
- [Try-on journal](../../../apps/mobile/src/try-on-session.ts) persists `assetId` only through `photo()`. Its `requestId` is a render-request ID, not a durable pending-upload ID. `boot()`/`refresh()` reconcile existing jobs, not independently stored assets. The dedicated session has zero jobs.
- [Authenticated asset routes](../../../apps/api/src/shopping.ts) support GET metadata at `/v1/sessions/:id/assets/:assetId` and GET content under `/content`, with session ownership enforced. They do not list session assets or associate an existing asset with the phone's local journal.
- [Mobile API](../../../apps/mobile/src/visual-client.ts) uses the metadata GET for an existing job's original image. No exposed recovery screen/deep-link parameter lets the owner adopt a known asset for E01. Calling metadata GET outside the app would not restore the phone's association.
- The visible **Retry photo upload** action re-sends POST. Although the stored metadata is idempotent, the server calls `objects.put` before the existing-record check. That is an upload retry/object-store write, expressly outside this task. No such action was taken.

The request identifier remains recoverable privately as the server asset ID because the upload route assigns `asset.id = input.requestId`. It is no longer retained in the failed component's memory. The release does not expose a supported journal-inspection interface; journals/SecureStore were not read, patched or reset. UI evidence from preparation showed no render-ready photo, and current source explains why ordinary refresh cannot restore it.

**Recovery outcome:** stopped at inspection. Fresh owner-authenticated HTTP access and Android recognition were not claimed as successful. Extracting credentials, injecting app state, creating a queued job as a shortcut or replaying POST would not satisfy the requested supported recovery boundaries.

## Preservation and accounting

The fresh session record and version match the preparation snapshot exactly: earrings, explicit silver and USD 120 constraints, E01 unselected, E05 unrejected, no feedback/dependencies, and no necklace/comparison operation. One portrait exists; no E01 job exists. The Samsung remained connected, but the production app was not foreground/running; it was left that way rather than launched solely to reach an unavailable recovery control.

| Judge ledger                      | Prior preparation snapshot | Fresh recovery audit |
| --------------------------------- | -------------------------: | -------------------: |
| OpenAI requests                   |                         25 |                   25 |
| OpenAI charged-or-held USD        |                 0.33519680 |           0.33519680 |
| OpenAI committed reservations     |                         22 |                   22 |
| YouCam requests / committed units |                         10 |                   10 |
| Dedicated-session visual jobs     |                          0 |                    0 |

A second read-only audit at **13:35 WAT** confirmed the same counts, unchanged session/version and identical asset. No pending OpenAI diagnostics or active visual jobs were found; all ten historical jobs remain completed. Three filming planning operations remain reserved and the one E01 preparation render attempt remains unused. No historical reservation was released or changed. Public health/readiness returned HTTP 200. Initial direct database connection/query failures resolved on later bounded read-only inspection; readiness was not used as a substitute for ledger inspection.

## Minimum proposed correction — not implemented

A mobile correction is required to recover this existing orphaned association **without reuploading**:

1. Add an explicit owner-facing **Recover existing upload** path accepting the known upload ID privately. GET its metadata using the app's existing owner credential; validate returned session/ID/type and show the authenticated original for explicit confirmation. For E01, require a portrait. Only then call the existing `controller.photo(asset.id)` association function. Do not create/advance a VTO job, POST an asset or alter shopping decisions. This can use the existing backend GET routes; no new backend deployment is inherently required.
2. To prevent recurrence, durably journal pending upload ID, session/product and expected type/MIME/hash before future uploads. After an acknowledgment failure or restart, resolve that ID through authenticated GET and validate the expected metadata before confirming association. A 404, ownership error, mismatch or unavailable response must leave an explicit unresolved state, never silently upload again. Do not persist image bytes or credentials in this journal.

Proposed regression coverage: response lost after persistence then GET recovery with no second POST/PUT; process restart retaining pending upload ID; legacy known-ID recovery with explicit confirmation; foreign-owner and wrong-session denial; wrong hash/MIME/type or missing asset rejection; failed local journal writes; E01 selection/E05 rejection/constraints unchanged; zero planner calls and zero job creation/advancement during recovery. Increasing the timeout alone would not close the lost-acknowledgment recovery gap.

A **new signed Android release** would be required for this UI/journal change. A same-application-ID update with the existing signing identity should preserve the dedicated session and credentials; migration/preservation must be tested before distribution. Do not uninstall/clear data. The existing server asset remains usable for a deliberate known-ID recovery; a new session/search/photo is unnecessary. Implementation, signing, installation and deployment require separate authorization and were not performed.

## Validation

Existing offline suites: `npx vitest run tests/persistence.test.ts tests/try-on-session.test.ts tests/s3-assets.test.ts` — **34 passed across 3 files**. These verify existing ownership, asset integrity/idempotency and job recovery behavior; they do **not** establish a missing-upload recovery capability. Proposed new tests above have not been implemented. No production provider calls were made.
