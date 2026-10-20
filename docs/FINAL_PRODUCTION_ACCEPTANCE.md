# Final production acceptance — checks October 18; finalized October 19, 2026

**October 20 source-only update:** [YouCam same-task recovery](YOUCAM_TASK_RECOVERY_FIX.md) is implemented for deployment review. It has not been deployed or accepted against production; the earlier APK/test acceptance below remains a dated snapshot.

**Recommendation: NO-GO for automated final demo recording.** The release's build and automated checks pass. The installed production APK and safe native checks are verified. Every stored real result has expired in the app, preventing the requested current-app real-result comparison shot. Distribution was subsequently completed on October 19: [public release](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android) / [exact code-6 APK](https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v6-arm64-release.apk). No confirmed critical source defect was found. Do not interpret historical physical tests or the owner's manual-use report as a fresh acceptance pass.

This audit made no deployment, paid planning/render submission, deliberate production decision/accounting edits, final recording, narration or external submission. Read-only YouCam task/credit GETs were performed. Deadline November 2, 2026, the four judging criteria and 1–3-minute format are from the owner's brief, not a fresh portal verification.

## 1. Exact release identity

| Item | Verified value |
| --- | --- |
| Application source / remote main at audit start | `19526730cbedfacc90fa508a2903ed8682a8f085` |
| Delivered artifact | `artifacts/android/shopping-concierge-0.1.0-v6-arm64-release.apk` |
| Package / version | `com.youcam.shoppingconcierge` / 0.1.0 / **6** |
| APK size | 43,940,799 bytes |
| Delivered SHA-256 | `ac78021b033966c1a4dbceafded6a25e4806e8775787b64c27e361588db7e3f2` |
| Signing certificate SHA-256 | `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34` |
| Rebuilt APK SHA-256 | `582db406f3b674eac5c596c0072e1ad0978b7b910c999ec3eb999bf07ea0e1d9` |
| Embedded Hermes bundle SHA-256 | `a9d72eeedc59d09078c521fb1ecafd37de140c7ac5d635c32f8b6b8012c23e77` |
| Backend | `https://shoppingconcierge.rumptycloud.app` |
| Platform | ARM64, minSDK 24 / targetSDK 36; not an x86/32-bit or iOS deliverable |

The new Gradle release build succeeded from audited application source. All **1,299 uncompressed ZIP entries match byte-for-byte** between rebuilt and delivered APK, including manifest, native libraries and Hermes bundle. Outer APK hashes differ; this is content equivalence, not a claim of byte-identical reproducible packaging. Both APKs pass v2 verification with the same certificate. Keep the delivered APK and its original hash as the installation reference.

Manifest inspection finds no debuggable flag (Android default false), backup disabled and cleartext disabled. Embedded Hermes JavaScript and the production URL are present; tested emulator/loopback API URLs are absent. This is standalone packaging, requiring neither Metro nor Expo Go. Native standalone cold start passed on the installed Samsung release. The production backend does not expose a source commit in `/health` or `/ready`; its exact deployed revision was not attested by this audit.

**Installed build: VERIFIED on Samsung SM-S908N after reconnection.** The actual installed base APK was pulled read-only: version code 6, package/certificate above, and SHA-256 exactly equal to the delivered artifact. Package flags exclude DEBUGGABLE. Cold launch without Metro restored the production session. No uninstall, app data clear, production update or phone-settings change was performed. Normal app restoration can persist deterministic refresh/session metadata; no shopper decision was deliberately changed and no paid request was submitted.

## 2. Fresh automated validation

The initial Docker attempt failed because Docker Desktop was stopped. Started it and used `infra/compose.local.yml`: PostgreSQL on loopback 15432 and S3mock on loopback 19000. Integration tests use isolated test schemas/buckets, not production environment credentials.

- Fresh baseline: **835 passed, 0 failed, 0 skipped; 40 files**. Command: `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`. Includes the 52 tests skipped in the previous normal run.
- Added a deterministic demo-plan regression validating E05 rejection, E01 selection/eligibility, retained constraints, E01 → necklace dependency, N01/N02 eligibility and absence of a visual job. No mocked visual output is presented as live evidence. Final fresh integration run after this additional test: **836 passed, 0 failed, 0 skipped, 41 files**; lint and TypeScript checks also passed. Temporary audit probes initially caused lint errors outside application source; they were moved out of repository lint scope before the successful final run.
- Fresh ESLint, root/API/mobile TypeScript checks and API build passed.
- Android production export passed; **95 files**, seven server-only credential sentinels, **zero matches**.
- Delivered APK scan: **1,299 entries**, five actual configured server-secret values, **zero matches**. Values were passed in memory to the scanner and never printed or saved. This establishes absence of those configured values, not proof against every conceivable secret.
- Release rebuild, v2 signatures, entry/content comparison, manifest inspection and embedded backend/Hermes checks passed.

[Machine-readable summary](evidence/final-acceptance/summary.json). Local raw build/test logs remain outside tracked evidence. The earlier historical 835-test run is not used as this run's result.

## 3. Production dependencies and evidence

Production certificate-validated `/health` and `/ready` returned HTTP 200. Readiness reports PostgreSQL, S3, live OpenAI/YouCam, PostgreSQL ledgers and judge scope; configuration/database/storage/diagnostics/both ledgers are ready. It does not prove an available render, successful new planning call, exact deployment revision, remote secret values or a particular `OPENAI_MAX_ATTEMPTS` value.

Direct PostgreSQL initially failed to connect; a later SELECT and the completed audit succeeded with **`BEGIN READ ONLY` / transaction_read_only=on**. No database updates/migrations/reconciliation apply were run. Direct authenticated S3 HeadBucket passed. Receipt GET checks below are reads only; no new S3 probe object was created. Database catalog count is 72, with 12 eligible products.

Ten judge YouCam reservations match ten stored live completed jobs one-to-one; all are committed and all stored application result expiries are in the past. All ten have provider task references. Read-only provider status inspection reports four recent tasks completed and six unavailable; unavailability is consistent with historical task expiry but the cause is not established. No task ID, private image URL or output bytes are published by this audit. Local job references in [backend evidence](evidence/final-acceptance/backend.json) allow operator correlation.

The four presently confirmed provider records are E01 jobs `b675f806-e97f-4296-bfb8-d930d0ff0012`, `b68085a6-3c86-4631-b908-6171da5221ed`, and E12 jobs `1d3090dd-2ad0-417a-8bd8-7321b5df2843`, `1568fe9e-4076-4569-9fd6-64a230986773`. GET completion does not rewrite app expiry or attest image fidelity. Earlier all-category physical evidence is separately labeled in [the judge guide](JUDGE_GUIDE.md).

Mock completion is structurally `mode: mock`, `result.kind: mock` with an explicit no-render message. Production records audited here are `mode: live`, `result.kind: image`, linked to committed reservations/provider task references. The isolated native UI fixture used an explicitly labeled test bitmap with the existing image discriminator; that fixture is not real provider evidence.

## 4. Current budgets and reconciliation

Snapshot: 2026-10-18, approximately 22:42 WAT (21:42 UTC). These are dated observations, not live balances. The limits are enforceable application budgets, **not the same as provider account billing balances**.

| Budget | Used / held | Remaining | State |
| --- | --- | --- | --- |
| OpenAI judge requests | 24 / 200 | **176 requests** | approved, not blocked |
| OpenAI judge USD | **$0.32761480** charged-or-reserved / $3 | **$2.67238520** | 21 settled, 3 unsettled |
| YouCam judge requests/units | **10 / 50**, all committed | **40 renders / units** | approved, not blocked |
| YouCam account credit GET | 985 + 40 in two credit buckets | **1,025 credits total** | does not override the stricter 40-render judge cap |
| Historical YouCam validation ledger | 5 committed reservations | distinct 8-request validation scope | preserved; not combined with judge allowance |

OpenAI settled estimated token cost is **$0.12508880**; unresolved conservative holds total **$0.20252600**. Account-wide OpenAI prepaid balance was not available through the configured project-key/ledger workflow and is **unknown**, not inferred from the $3 cap. Diagnostics contain 21 successes (plan_schema / HTTP 200) and one historical HTTP 400 invalid_function_parameters failure; two older holds predate diagnostic coverage. No pending diagnostic outcome row was found, but that does not settle the older unknown reservations.

Three holds are dated October 10/12 and have no recoverable receipt at their expected S3 keys (GET 404 NoSuchKey): `d5b59f2e-c5fb-449b-bc6a-00ee1172aba8` ($0.067504), `b1f95cd8-2fb4-42c8-b473-05901b5a2d8d` ($0.067514), `0ec91982-56a2-4456-8608-1a6d0ae20325` ($0.067508). Preserve all three. Do not replay requests or release funds based on missing receipts. Reconciliation here means correlating existing evidence, not mutating ledger settlement. No `--apply` action was performed. See [detail evidence](evidence/final-acceptance/ledger-details.json).

## 5. Native acceptance matrix

The phone initially was absent from ADB, then reconnected. All rows below distinguish installed production code 6 from the separate demo client using the same mobile source and an isolated memory API. No final video was recorded; raw XML and offline-fixture screenshots remain under ignored `artifacts/final-acceptance`.

| Required scenario | Current-run result | Evidence / limit |
| --- | --- | --- |
| Installed code 6 / certificate / standalone cold start | **PASS — production** | Pulled APK exactly matches delivered hash; same signing certificate; launched without Metro |
| Navigation / session restoration / cards | **PASS — production** | Existing silver/evening/USD200 constraints restored; E12/E01 cards displayed; summary and Android Back work |
| Rejection input | **PASS — production, unsent** | Opened E12 rejection modal, typed an audit draft, verified keyboard/input controls, cancelled without submission |
| Selection controls | **PASS — visibility/enabled state only** | Select E12 visible/enabled; no decision changed. Actual selection transition validated in fresh offline tests |
| VTO discovery / try-on navigation | **PASS — existing production state** | Existing VTO-only filter and eligible cards displayed; E12 navigation loads terminal job. Discovery toggle mutation not exercised in production |
| Photo gallery picker | **PASS — production open/cancel** | N01 photo requirement opened Android Photo Picker; immediately cancelled. No production upload or gallery screenshot |
| Private original loading | **PASS — current native mock** | Authenticated fixture original visibly loads; production original viewer inaccessible behind expired-result flow |
| Completed real result | **BLOCKED — expired** | All ten production stored results expired; E12 page explicitly displays expiry without resubmission |
| Comparison / expansion / zoom / Android Back | **PASS — current native mock** | Original/result switching, 400% disabled upper limit, pan and modal Back checked using labeled offline bitmap; no live fidelity claim |
| Background/foreground | **PASS — production terminal and mock paused states** | Expired production job preserved; stopped mock waiting remained paused, poll counter unchanged at 7 |
| Offline/reconnection | **PASS — current native mock** | Removed only mock API reverse forwarding; saw network error and Refresh existing try-on; recovered same job |
| In-progress restart | **PASS — current native mock** | Force-stop/relaunch restored processing fixture job; submission count stayed one |
| Timeout / failed job | **PASS — current native mock** | Paused/resumed only local server, observed request timeout; injected terminal failure displayed no automatic resubmission |
| Expired result | **PASS — production safe state** | Explicit expiry warning; no automatic replacement render; real comparison/zoom remains blocked |

Mock counters: first intentional job stayed at **one submission** across duplicate taps, Stop waiting, background/foreground, disconnection, restart, timeout and terminal failure. A second explicit fixture request completed for viewer verification: final **2 starts / 13 polls / 0 actual provider requests**. The bitmap visibly says OFFLINE TEST IMAGE / NOT A YOUCAM RENDER. Temporary mock API/Metro were stopped and mock forwarding removed after tests.

A post-device read-only database snapshot confirms production totals unchanged: **24 OpenAI reservations, $0.32761480 charged-or-reserved, 10 YouCam committed requests/units, 10 completed jobs**. No production selection/rejection was submitted. Send, free-text rejection and the second Compare action can call OpenAI; inner Try on can start a render. None was exercised in production. See [post-device evidence](evidence/final-acceptance/post-device.json).

## 6. Spending and privacy safeguards

Fresh tests confirm client IDs are journaled before submission, duplicate taps are locked, retries retain appropriate request/job IDs, server claims precede provider work, ambiguous submissions do not automatically resubmit, and completed/failed/expired jobs do not start replacement renders. Durable reservations and receipts remain conservative across uncertainty. “Stop waiting” stops local polling only; it is not provider cancellation. Verify deployed `OPENAI_MAX_ATTEMPTS=1` through operator configuration before a later live rehearsal; readiness does not expose it.

Private original metadata/bytes require the owning guest/session authorization, are hash/MIME/size checked and return `private, no-store`. The Android array-source fix preserves Authorization; tests deny another guest. No provider/database/S3 credentials are in the scanned APK. The VTO journal contains IDs, not raw photos or private URLs; native image rendering can retain transient memory/cache.

Completed outputs use provider HTTPS URLs with signed query parameters in all ten inspected records. They are not an unrestricted public catalog endpoint, **but anyone holding a still-valid signed URL can use it until expiry**; the provider download itself does not enforce the app's session header. Do not claim that output URLs are inherently non-shareable, log them or include them in recordings. This audit did not anonymously fetch or publish private image bytes.

Result expiry is not deletion. Originals, receipts and historical accounting remain subject to manual RumptyCloud retention/cleanup. Backend DeleteObject is unavailable; no automatic erasure or cancellation feature is promised. Existing four dependency alerts remain open as documented in [the dependency audit](archive/acceptance/VTO_UX_READINESS.md); no broad upgrades or new vulnerability-free claim.

## 7. Blockers and judge access

| Severity | Finding | Resolution / practical impact |
| --- | --- | --- |
| Critical | **None confirmed in tested source/build** | Not equivalent to complete native certification |
| Resolved acceptance gate | Installed production package and safe native checks | Actual code-6 APK hash/signature and cold restoration verified; real-result viewing remains blocked by expiry |
| Major | All stored real results expired in app | Review historical-evidence fallback or separately authorize one preparatory render; do not refresh by changing production records |
| Resolved October 19 | Public APK distribution | [GitHub Release](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android) publishes the exact audited code-6 APK; the README links directly to it |
| Major validation gap | Exact deployed backend revision and live end-to-end timing not attested | Confirm hosting revision/settings; separately authorize bounded live rehearsal if desired |
| Minor / operational | Three historical OpenAI holds without receipts | Conservatively retained; current budgets approved/unblocked with adequate remaining cap |
| Minor / maintenance | Four existing upstream advisories, ARM64-only package, manual object cleanup | Documented limits; no forced dependency upgrade or deletion claim |
| Resolved documentation defect | README/judge/submission pages still said no hosted/standalone release | Updated current access/status while retaining historical evidence |

Repository: public `Ajayfrizzy/shopping_concierge`, default `main`, MIT license. Photo provenance permissions are separate from code licensing; [image provenance](evidence/IMAGE_PROVENANCE.md) identifies approved synthetic historical portraits. Setup requires Node 22.13+, npm 10+, Docker for integration, and Android SDK/JDK only when building locally. Standalone judges need a compatible ARM64 Android phone (API24+) and internet to the hosted backend, plus sideload permission. They do not need API keys, Metro, a shared login or a local database. Signing mismatch with a debug build must be handled without silently deleting a user's session.

Hosting depends on managed PostgreSQL, S3 read/write permissions and initialized/approved provider ledgers. Secrets stay server-side. Connectivity/readiness may change after this snapshot; preserve enough remaining budget through the November 2 deadline. No measured adoption, revenue, merchant inventory or consumer outcome is claimed.

## 8. Judging-criteria evidence

| Criterion from owner brief | Defensible implemented evidence | Demo proof / qualification |
| --- | --- | --- |
| Technological Implementation | Stateful scoped constraints; deterministic authorization; PostgreSQL persistence; idempotent paid jobs; private uploads; OpenAI/YouCam adapters | Fresh integration tests, audited APK and ledger correlation. Explain backend integration; don't claim new live success this run |
| Design | Conversation-first Android interface, structured decisions, on-demand photo picker, explicit progress, comparison/zoom and error states | Current production safe-native and isolated mock-viewer checks; genuine production result comparison remains blocked by expiry |
| Potential Impact | Addresses repeated preference entry, inconsistent accessory decisions and cross-category coordination | Show concrete user workflow. No conversion/revenue/fit-accuracy metrics, retailer adoption or user-study claim |
| Quality of the Idea | Integration of explicit decision state, rejection memory, selected-item relationships and selective visual evidence | Explain why this combined workflow helps a choice; do not claim novelty for chat, VTO or recommendation individually |

## 9–11. Demo plan, automation and decision

[Proposed 150-second script and ADB automation plan](FINAL_DEMO_PLAN.md) includes exact utterances/products, selectors, bounded scrolling, state assertions, narration, approved-image checks, spend gates and abort rules. It prioritizes actual device footage. A current-app real comparison/zoom shot cannot be fabricated from expired records; its replacement/preparation requires review.

**NO-GO for automated final recording now.** Build/test health is good; a truthful accessible real-result shot and approval of the proposed sequence remain unresolved. Installed-release verification and safe native checks passed. No final video was recorded. The later APK publication is separate from this audit. No final video or hackathon submission is complete.
