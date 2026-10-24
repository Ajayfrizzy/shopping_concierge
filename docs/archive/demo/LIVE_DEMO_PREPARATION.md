> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Authorized live preparation — October 20, 2026

**Latest outcome:** [The single authorized E01 render attempt](../recovery/E01_LIVE_RENDER.md) is now consumed: provider completed, but the app timed out and has no viewable result. YouCam is at 11 committed renders; OpenAI is unchanged. No further render is authorized.

**NO-GO for final recording: initial search succeeded, but the portrait upload was not acknowledged on the phone. No YouCam render was submitted.** This report supersedes the earlier preparation status while preserving the [native mock calibration](NATIVE_DEMO_CALIBRATION.md) and [final recording plan](FINAL_DEMO_PLAN.md).

Follow-up: [Upload recovery investigation](../recovery/UPLOAD_RECOVERY.md) confirms a valid stored portrait but no supported no-reupload recovery in code 6; the subsequently authorized [code-7 correction](../acceptance/ANDROID_UPLOAD_RECOVERY_V7.md) passed Samsung recovery and cold-restart acceptance; the existing portrait association is restored without reupload. No render has been initiated.

## Authorization and preflight

The owner approved one dedicated production session, one preparation planning operation (three more reserved for filming), and at most one E01 render attempt. No automatic retries or recording were authorized. The owner confirmed the current deployed `OPENAI_MAX_ATTEMPTS=1` setting; this was operator confirmation, not inferred from readiness.

Samsung SM-S908N was connected through ADB. Installed `com.youcam.shoppingconcierge` was version 0.1.0 / code 6 and matched audited SHA-256 `ac78021b033966c1a4dbceafded6a25e4806e8775787b64c27e361588db7e3f2`. The separate demo app was stopped, reverse mappings absent, and ports 4000/8082 had no listeners. Production health/readiness returned HTTP 200 with live providers and PostgreSQL judge ledgers.

Initial phone connectivity was absent. The operator connected it; Android then reported an active network and backend DNS/ping succeeded. A supported Refresh session recovered the existing shopping screen without a paid retry. The app's Start a new session → Start new flow was then confirmed once. No database/session/journal/credential edits were made directly.

Read-only accounting found no pending diagnostics and ten completed historical live jobs. Three unresolved OpenAI holds exactly matched the documented October 10/12 historical set; they were preserved, not replayed or released.

## Search and preserved state

`Silver earrings under $120` was sent exactly once. One successful HTTP 200 / plan_schema diagnostic and one settled OpenAI reservation were recorded. The dedicated session has:

- Active category: earrings.
- Exactly two explicit global constraints: silver material and USD 120 budget.
- No selected, rejected, saved, shortlisted or liked products; no feedback or dependencies.
- E01 and E05 available in the native results; E05 was only revealed, not rejected.
- No necklace search or comparison.

Final native inspection shows the shopping screen, E01's enabled Select/Try on controls and an empty composer. Returning from the upload screen preserved the same session and version. No additional search was sent.

## Approved portrait and upload blocker

The approved synthetic side portrait was verified against the [provenance record](../../evidence/IMAGE_PROVENANCE.md) and [preparation metadata](DEMO_PREPARATION.md#portrait-and-provenance). The 300×375, 279,487-byte metadata-free PNG has SHA-256 `f5cb4fda87fb79fcfda6f4f85739c823207adaf0f90e41af7cbfd08b3743b8d9`. The identical file was transferred to `Pictures/ConciergeDemo/approved-synthetic-portrait.png` and its on-device hash verified.

Through Android's normal picker, Collections → From this device → ConciergeDemo located the dedicated folder. Only its sole verified portrait was selected and confirmed with Done. Personal gallery images were not captured or displayed in evidence.

The existing app picker configuration (`quality: 0.8`) converted the selected PNG to JPEG. Read-only server/storage inspection confirmed one owned portrait asset, JPEG 300×375, SHA-256 `de2768d378ed7773a40dddb83e65b31ea9d04bab6f903037da47a2e6da9d3cbd`, with no EXIF/XMP/IPTC. Visual review confirms the same exposed-ear portrait; average absolute decoded channel difference from the PNG is 2.66/255, consistent with lossy encoding. No alternate portrait was substituted.

Despite server persistence, the phone displayed **Unable to reach try-on service. Refresh the job before starting another request.** and **Retry photo upload**. The app did not expose the render-ready uploaded-photo state. Its transport has a 20-second timeout, but the generic network error does not establish whether timeout or another transport failure caused the lost acknowledgment.

No upload retry, replacement upload, inner Try on tap, journal patch or job/accounting edit was performed. The server asset alone cannot safely establish the phone's local association. Private session/asset identifiers and raw snapshots remain in ignored local artifacts. Supported upload recovery needs a deliberate follow-up instruction; it must preserve the existing session and must not repeat the planning search. The app was returned to shopping as requested.

## Accounting and decision

Snapshots: before **03:52 WAT**, after **04:14 WAT**, October 20, 2026. These are application judge limits, not provider account balances.

| Measure                           |     Before |      After | Preparation delta |
| --------------------------------- | ---------: | ---------: | ----------------: |
| OpenAI requests                   |   24 / 200 |   25 / 200 |                 1 |
| OpenAI settled reservations       |         21 |         22 |                 1 |
| OpenAI charged-or-held USD        | 0.32761480 | 0.33519680 |        0.00758200 |
| YouCam requests / committed units |    10 / 50 |    10 / 50 |                 0 |
| New E01 visual jobs               |          0 |          0 |                 0 |

Remaining application allowance: **175 OpenAI requests / USD 2.66480320**, **40 YouCam units**. The owner's narrower envelope remains binding: **zero further preparation planning operations**, **three planning operations reserved for separately authorized filming**, and **one unused preparation render attempt**. No new YouCam reservation exists to reconcile; there is no queued, processing or uncertain paid job from this preparation.

There is **no new result, result-quality assessment or expiration deadline**. Genuine original/result switching, zoom, Fit image, Android Back and completed-job reopening remain untested against a newly prepared live result. Earlier mock passes are not substitutes.

No APK rebuild/publication, deployment, provider-setting change, final recording or submission occurred. Documentation-only follow-up validation checks local links and whitespace; no application code or tests changed. Final recording remains blocked on supported upload recovery, successful authorized E01 rendering and genuine-result verification.
