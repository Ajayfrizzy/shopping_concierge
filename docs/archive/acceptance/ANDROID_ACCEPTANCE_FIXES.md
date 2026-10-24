> Historical record, archived 2026-10-19. Test counts, deployment failures, pending gates and budgets below describe their original observation dates, not current status. See [final acceptance](FINAL_PRODUCTION_ACCEPTANCE.md) for the code-6 / 836-test baseline and dated budget snapshot. Original findings are retained; later acceptance does not erase earlier failures.

# Android acceptance fixes — 2026-10-17

## Authorization diagnosis and fix

The deterministic interpreter handled `try-on` as an unsupported render keyword before reaching the shopping grammar. The bounded combined-search grammar also required a material and did not represent availability clauses. Therefore both reported sentences could not authorize a legitimate combined search. No physical-device provider plan was retained here; this diagnosis reproduces the actual interpreter/authorization path locally, not an invented reconstruction of a live model response.

Both exact sentences now produce a bounded search plan: switch category, update only explicit global preferences, then search. An anchored `with virtual try-on available` / `that support virtual try-on` clause adds explicit global boolean `vtoOnly`. `I want elegant designs` adds elegant style. `stylish` is stored as a soft preference; it is not converted into invented product attributes. An omitted material retains inherited silver. Combined searches with stated prices explicitly replace the global budget using existing update semantics. Unspecified occasion, decisions and dependencies persist. Conflicting leading/trailing style instructions fail closed. Unrecognized tails do not gain authorization.

The full-string shopping parser runs before the generic unsupported-VTO guard. Direct `try on ID` still uses the separate VTO handoff. Sequential simulated authorization and atomic commit are unchanged. Added tests reject render, selection and material-reset calls in a discovery plan, with no partial mutations.

## Server capability and mobile discovery

`vtoOnly` is an explicit-only hard filter in shared validation and the deterministic eligibility guard. It reads the server product's `vtoEligible`; it neither creates eligibility nor changes registrations. The 72 identities, prices and VTO assets are unchanged. Tests inject the 12 approved IDs only into a local test catalog. Rejected products, material and budget remain filters. The OpenAI strict transport fixture was regenerated and compatibility tests pass.

A labeled discovery control uses the existing deterministic constraint action, without invoking OpenAI or YouCam. It is available once a category exists, persists across refresh, and can be explicitly turned off. Empty results explain that requirements remain active and link to the preference summary with instructions to revise them. Only server-eligible cards link to try-on. No-match relaxations still require explicit confirmation and never remove the VTO requirement implicitly.

**Deploy the accompanying backend before testing the new APK against production.** An older backend does not understand the additive `vtoOnly` constraint. No SQL migration or registration/accounting change is required. This task does not deploy the backend or activate/change providers.

## Native VTO and shopper presentation

Gallery selection remains sufficient; no camera capture or camera permission was added. Screen guidance distinguishes exposed-ear portrait, neck/chest portrait, fingers/hand, and wrist with all five fingers. Uploaded private images now have an explicit ready confirmation. Existing queued/processing/completed/failed/expired states, explicit start/poll, normalized unavailable response, and idempotent server claims remain intact. Existing mock integration tests exercise MIME detection, private upload, jobs, recovery, unavailable capability, and no duplicate paid submission; they do not prove native picker behavior or live render quality.

Product names remove the display-only `Fixture` prefix without altering identity. Illustrative/synthetic disclosure remains; availability is described as sample-catalog availability, not merchant inventory. Duplicate material/color labels are collapsed on cards/comparison. Preference updates use readable budget, scope, and intensity descriptions; weight remains unverified. Summary copy distinguishes saved, shortlisted and selected. Feedback confirmations identify the exact product and recorded reason. Negative ranking evidence explains similarity to disliked details.

The rejection input has a border, padding, multiline support, placeholder contrast, accessible label and clear separation from reason buttons. The modal avoids the keyboard and retains free text on a failed submission. Existing fixed composer, scrollable history/cards, show-more controls and Android modal Back dismissal remain.

## Offline recovery

Timeout is distinct from network failure; server unavailability has a safe message. Session expiry remains explicit. Boot and refresh reconcile pending state but no longer automatically replay a pending operation. The user must tap Retry request, which retains the original journaled request/context/idempotency identifier. Successful recovery clears stale errors. Draft text remains on failed sends. Existing session, decisions and unknown outcomes are preserved; new changes are blocked while recovery is pending. Regression coverage verifies no replay on boot or refresh and exactly one explicit recovery with no duplicate transition.

## Acceptance scope

All provider validation in this task is mocked/injected. No live OpenAI/YouCam calls, personal-photo uploads, production accounting changes, VTO-registration changes or demo assets are authorized or performed. Physical-device acceptance must still verify keyboard geometry, rejection modal, picker, navigation, comparison and offline/reconnect on the updated build. Live render fidelity remains established only by prior approved evidence.

## Validation result

686 tests / 36 files passed, zero skipped, with local PostgreSQL and mock S3. Lint, API/mobile typechecks, API build, production Android export and Gradle release build passed. Export scan: 95 files, seven credential sentinels, no matches. Repository and unpacked APK scan: five configured server-secret values, no matches. APK v2 signature verified with the unchanged release certificate. The embedded Hermes bundle contains the production HTTPS URL and not the emulator API URL.

Artifact: `artifacts/android/shopping-concierge-0.1.0-v4-arm64-release.apk`, 43,920,875 bytes (41.89 MiB), application `com.youcam.shoppingconcierge`, version 0.1.0 / code 4. SHA256: `38aea284988dbcc655f028f5e82d855b228327d82db407084c1243015964bac3`.

No physical device was attached. The existing API37 ARM64 emulator exposed package/activity services but never reported boot completion; installation failed with `device is still booting`. The APK was not launched. This is an emulator readiness failure, not evidence of an app crash. **Major open acceptance gate:** deploy the backend and complete the updated APK's physical-device walkthrough, especially native gallery, keyboard/modal geometry and offline recovery. Automated mocks do not replace this. **Minor deferred:** previously recorded Expo patch updates and splash styling; no dependency migration was needed for this successful build. No known unresolved critical source/build failure; live planner compatibility remains unverified until separately authorized testing after deployment.
