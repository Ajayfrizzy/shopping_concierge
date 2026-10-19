# Native demo controller

The [native calibration report](../../docs/NATIVE_DEMO_CALIBRATION.md) records real Samsung mock runs. The [final demo plan](../../docs/FINAL_DEMO_PLAN.md) remains the authoritative future recording story. No final video or live provider operation is performed by calibration.

## Offline tests

```sh
python3 -m unittest discover -s scripts/recording -p 'test_*.py'
python3 scripts/recording/controller.py scripts/recording/full-story.recipe.json
npx vitest run tests/demo-calibration.test.ts tests/final-demo-plan.test.ts tests/try-on-session.test.ts tests/m9-demo.test.ts apps/mobile/src/__tests__/try-on-viewer-ui.test.ts
```

Python 3.9+ uses only the standard library. Default invocation validates the recipe without ADB or recording. The mock-server test verifies owned fixture preparation, one completion, repeat-list idempotence, foreign-owner denial and no network calls.

## Reproduce native mock calibration

Use the already installed **`com.youcam.shoppingconcierge.demo`** development client. Do not rebuild or modify the production installation. From the repository root, start these in separate terminals:

```sh
node --import tsx scripts/recording/start-mock.mts api
node --import tsx scripts/recording/start-mock.mts mobile
```

The launcher discards inherited provider/database credentials, disables dotenv, forces mock settings and pins the mobile API to `http://127.0.0.1:4000`. The API binds only loopback, uses memory repositories/object storage and the mock planner, and blocks outbound fetch. The image fixture adapter has **no HTTP/provider client**. It uses the existing image-result schema discriminator solely to exercise the viewer; the bitmap visibly says **OFFLINE MOCK FIXTURE / NOT A YOUCAM RENDER**. It contains no person or product photograph. Never call this genuine YouCam evidence or deploy this fixture server.

Authorize one Samsung in `adb devices -l`, then replace `SERIAL` below with that device:

```sh
adb -s SERIAL reverse tcp:4000 tcp:4000
adb -s SERIAL reverse tcp:8082 tcp:8082
adb -s SERIAL shell am start -a android.intent.action.VIEW \
  -d 'exp+shopping-concierge-demo://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' \
  com.youcam.shoppingconcierge.demo
```

In **Concierge Demo only**, use **Start a new session → START NEW** if an old local session exists. Do not clear app data or reset the production session. Keep the phone unlocked. Prepare one mock search and the labeled E01 fixture, then run the story in that same session:

```sh
python3 scripts/recording/controller.py scripts/recording/mock-prepare.recipe.json \
  --calibrate-mock --serial SERIAL --viewport 0 80 1080 2181 --cards 0 357 1080 1784
python3 scripts/recording/controller.py scripts/recording/full-story.recipe.json \
  --calibrate-mock --serial SERIAL --viewport 0 80 1080 2181 --cards 0 357 1080 1784
```

These bounds were measured on the Samsung's 1080×2316 portrait display; remeasure for another device/layout. The content edge is **2181**, not 2180: the original-image node extends to that exact boundary. The card scroll area excludes the fixed header/composer. The keyboard is dismissed by Send; current `mInputShown` takes precedence over a retained IME client's `mIsInputViewShown`.

`--calibrate-mock` requires the local fixture identity/zero-provider marker and both loopback reverse mappings. It fixes the target package to the demo app and rejects production-authorization/record flags. Every input checks the exact foreground package. A per-device process lock rejects a second controller; never run separate UIAutomator inspection concurrently with an active take. It never launches production, records video, clears data, creates a production session or starts a real render. A 600-second hard calibration limit accommodates diagnosing failures; individual waits are capped at 45 seconds. Local timing/bounds traces go to ignored `artifacts/demo-calibration/` with an explicit completion flag. UI dumps use unique temporary device files and are removed after reading.

On the first owned E01 job-list request in a local test session, the fixture backend prepares one completed image job through the same validated asset/job services. Reopening it does not submit another fixture. The local-only `/calibration/status` endpoint exposes counters and synthetic test state; do not publish raw session identifiers. Stop the two owned terminal processes and remove only the two forwarding entries created for calibration when finished. Stop the demo app before removing its local services; leave production alone.

## Recipe and safety rules

The full story is 34 steps. The three chapter recipes concatenate exactly to it:

1. `01-decisions.recipe.json`: repeated goal, preserved preferences in summary, rejection, selection, VTO filter and E01 navigation.
2. `02-viewer.recipe.json`: original/result switching, 150%/200% zoom, fit and Android Back.
3. `03-necklaces-summary.recipe.json`: filter off, complementary search, visible N01/N02, comparison and saved decisions/anchor.

Recipes have 1–60 steps with exact `before`/`after` markers, an action (`tap`, `type`, `back`, `wait`, `reveal`, `hide_keyboard`), optional target and scroll direction. `reveal` only scrolls; it does not tap a disabled Selected control. At most 12 target-aware swipes/reveal attempts are allowed per lookup. Each swipe is 600ms, at most 650px, checked against a fresh hierarchy; clipped/inverted bounds never become tap coordinates. Repeated successful taps are never used to wait for an API response.

Only the three reviewed messages may be typed, into an empty composer, with the entire draft checked before Send. At most three Send taps occur in a story. Native placeholders are recognized as empty fields; arbitrary existing drafts are preserved. Comparison buttons are reveal-only: the recipe uses one typed comparison, preventing accidental extra planning calls. Wrong foreground, missing/ambiguous controls, expiry/recovery errors, unknown keyboard state and missing postconditions stop execution.

**Inner `Try on`, Resume, Retry, photo upload and Start new controls are forbidden in recipes.** `Try on E01` is exact card navigation, never a generic Try on text match. In later production use, the operator must first verify a completed, owned, unexpired E01 job and no queued/processing/uncertain work; normal lifecycle can otherwise resume a pending job. UI labels alone do not attest real-provider identity or successful image loading.

## Later recording — requires separate authorization

Do not use `--record` during calibration. Production recording still requires `--record --authorize-production-decisions --prepared-result-reviewed`, the pinned serial and measured viewports. These are acknowledgments, not self-granted authorization. Verify installed hash/certificate, owner-session handoff, genuine matching original/result, expiry, approved budget and one-attempt planner setting first. Production must already be foreground; this tool never launches it.

Prefer the three chapters if live waits threaten the three-minute final edit. Execute each chapter **once, in order, in the same session**; never rerun a failed chapter automatically. Across all chapters there are three filming planning operations and zero renders. The preparatory search/render remain separate. Reconcile uncertain requests before deciding what to do next.

Production recording retains a 170-second per-invocation deadline and unique MP4 path/exact recorder PID, SIGINT, bounded exit wait and local pull. It never kills another recorder. A failed pull leaves the remote file for inspection. No automatic upload, narration, take retry or publication occurs. Current native timings contain no live OpenAI latency or narration dwell; use disclosed cuts for long searches/scrolls while preserving the actual decision and result sequence.

The historical mock XML fixture exercises disabled buttons whose text children appear enabled. It contains only allowlisted labels, classes and bounds, no photos, guest credentials or private URLs.
