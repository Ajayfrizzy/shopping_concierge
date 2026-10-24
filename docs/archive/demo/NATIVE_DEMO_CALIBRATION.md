> Historical report archived on 2026-10-24. Observations and instructions below are dated evidence, not current release status or authorization. Android v11 and the published demonstration are indexed in [current documentation](../../README.md).

# Native demo calibration — October 19, 2026

**Conditional GO for separately authorized controlled live preparation. NO-GO for final recording today.** The complete isolated mock journey passed twice on Samsung SM-S908N: **163.617 seconds** and **163.738 seconds**. This verifies controller navigation and state continuity, not live provider latency or image quality. No video was recorded, no personal photo uploaded and no production session or shopping decision changed.

## Device and isolation

Read-only inspection of the installed production APK confirmed `com.youcam.shoppingconcierge`, version **0.1.0 / code 6**, valid signature and SHA-256 `ac78021b033966c1a4dbceafded6a25e4806e8775787b64c27e361588db7e3f2`. Signing certificate SHA-256: `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34`. Production was not launched, cleared, reinstalled or navigated. The existing release and 836-test acceptance baseline are unchanged.

Calibration used only the already installed **com.youcam.shoppingconcierge.demo**, a credential-scrubbed Metro environment and loopback memory API on port 4000. The mock planner and fixture adapter have no paid provider client; outbound fetch is blocked. The geometric fixture contains no person and is labeled **OFFLINE MOCK FIXTURE / NOT A YOUCAM RENDER**. Existing viewer accessibility wording includes “Completed YouCam virtual try-on”; in this isolated fixture it is only a UI selector, never evidence of an actual YouCam result.

A separate preparation recipe established the search and one completed owned E01 fixture before each story. The measured preparation was approximately 26.2 seconds, outside the take. Repeat-run counter deltas were **3 messages, 4 structured actions, 0 fixture starts, 0 polls and 0 actual provider requests**. Local mock state confirmed E01 selected, E05 rejected and an explicit E01 earrings → necklaces complement dependency. No production credentials or session identifiers are published.

## Complete story and measurements

The [34-step recipe](../../../scripts/recording/full-story.recipe.json) repeats the initial search, displays preserved preferences, rejects E05 as too flashy, selects E01, filters for VTO, opens the prepared viewer, switches original/result, zooms to 150% and 200%, fits to 100%, uses Android Back, finds complementary necklaces, compares N01/N02 and displays the session summary. Both runs completed continuously with 23 swipes. The [sanitized native evidence](../../evidence/demo-calibration/native-run.json) includes all step timings and selector bounds.

Samsung portrait display: **1080×2316**. Measured full viewport: `(0,80,1080,2181)`; card viewport: `(0,357,1080,1784)`. Bounds are observations, not reusable absolute tap coordinates.

| Selector                          | Observed bounds (left, top, right, bottom) |
| --------------------------------- | ------------------------------------------ |
| Shopping message, keyboard closed | 33,1820,1047,2000                          |
| Send to concierge, keyboard open  | 34,1075,1046,1198                          |
| Reject E05 after scrolling        | 745,1558,937,1682                          |
| Select E01 before selection       | 537,916,722,1040                           |
| Try on E01 card navigation        | 783,1390,975,1514                          |
| Expand and compare photos         | 96,1897,984,2021                           |
| Zoom in                           | 427,330,641,453                            |

The initial Compare N01 reveal found a clipped 18px-high native node; it was **never tapped**. The later N01/N02 comparison headings were revealed independently. Presence checks do not certify that an entire product card fits on screen.

| Repeat-run milestone                       | Elapsed seconds |
| ------------------------------------------ | --------------: |
| Preserved preferences and return           |           14.83 |
| E05 rejection complete                     |           39.63 |
| E01 selected                               |           50.99 |
| Prepared VTO page                          |           65.03 |
| Viewer complete and Android Back           |           83.36 |
| Necklace request complete                  |           98.41 |
| Comparison submitted                       |          121.67 |
| N02 comparison heading                     |          149.14 |
| Summary including selected/rejected/anchor |         163.738 |

## Findings and safeguards

Earlier diagnostic attempts stopped on real native mismatches; they are not counted as completed rehearsals. Fixes included Samsung's `dumpsys window` foreground query, unique temporary UIAutomator XML files instead of `/dev/tty`, native placeholder recognition, authoritative `mInputShown` keyboard state, and the original-image boundary at y=2181. Send dismisses the keyboard; swipes refuse an open or unknown keyboard. Summary returns through **Back to conversation**. Repeating an unchanged goal does not produce a new What changed panel, so the recipe proves preserved preferences through summary instead.

Selection feedback shifts scroll position. The controller waits for the composer to become ready, then reveals the disabled Selected state without tapping it again. Scrolling is target-aware and bounded to 12 attempts per lookup, 650px/600ms per swipe. Individual waits are bounded to 45 seconds. Calibration has a 600-second diagnostic limit; later production recording retains its 170-second limit.

Every input requires the exact expected foreground package. Mock mode fixes the demo package, checks the local fixture identity and both ADB reverse mappings, and rejects recording/production authorization flags. Inner **Try on**, retry, resume, upload and session-reset controls are excluded from recipes. Only three reviewed messages and at most three Sends are accepted. Compare buttons are reveal-only; the comparison is typed once. A per-device lock prevents concurrent controller execution. The lock was unit-tested after the two native runs; the story behavior did not change.

These controls prevent the reviewed mock recipe from targeting production or issuing a paid inner-button action. They do not authorize future production use or replace a pending-job audit: normal app lifecycle can resume queued work. A genuine completed, owned, unexpired result and no uncertain/active provider request are mandatory before any later production navigation.

## Timing recommendation and remaining gates

The observed 163.7 seconds leaves only about **16 seconds** under three minutes, with no real planner latency or narration dwell. Treat 150 seconds as an editorial target. Use the three contiguous chapter recipes in order, in the same session, once each; disclose cuts for long waits and scrolling. Trim approximately 14 seconds from the mock sequence to reach 150 seconds, and budget additional cuts for live latency. Do not accelerate decision claims, hide failures or rerun paid steps to improve timing.

The [final demo plan](FINAL_DEMO_PLAN.md) remains authoritative. Before controlled live preparation, obtain the owner's session-handoff decision and explicit bounded spending authorization, prepare a genuine same-job E01 original/result, check expiry and image quality, and reconcile all pending requests. Previously stored production outputs were expired at the acceptance snapshot. Before final recording, separately authorize recording, review privacy/provenance and confirm the revised edit plan. No final video or hackathon submission is complete.

## Verification

- `python3 -m unittest discover -s scripts/recording -p 'test_*.py'`: **22 passed**.
- `npx vitest run tests/demo-calibration.test.ts tests/final-demo-plan.test.ts tests/try-on-session.test.ts tests/m9-demo.test.ts apps/mobile/src/__tests__/try-on-viewer-ui.test.ts`: **20 passed across 5 files**.
- Targeted ESLint and TypeScript `--noEmit` passed; no application code was changed or APK rebuilt.
- Fixture tests cover ownership, one completed image, repeated-list reuse, foreign-owner denial and no outbound fetch. Controller tests cover recipe restrictions, foreground isolation, keyboard/bounds behavior and locking.

Reproduction commands, cleanup and future recording safeguards are in the [controller README](../../../scripts/recording/README.md). Raw local traces and pulled APK remain ignored; public evidence contains only reviewed labels, bounds, timings and aggregate counters.

Documentation validation checked **83 Markdown files and 583 local links with zero errors**. Changed-content privacy/credential review found no real credentials, personal photographs or private session identifiers.

Cleanup: the phone disconnected after the successful rehearsals. Final ADB could not force-stop the demo app or confirm removal of the two reverse mappings; those device-side cleanup checks remain pending on reconnection. The owned local API and Metro services were stopped. This does not invalidate the completed traces, but connectivity must be restored before live preparation.
