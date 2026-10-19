# Bounded recording controller

This controller is preparation tooling, not an unattended production bot. No final video has been recorded. The [demo plan](../../docs/FINAL_DEMO_PLAN.md) and [preparation report](../../docs/DEMO_PREPARATION.md) define the workflow and outstanding gates.

## Offline validation (safe now)

```sh
python3 -m unittest discover -s scripts/recording -p 'test_*.py'
python3 scripts/recording/controller.py scripts/recording/viewer-recipe.example.json
```

The default command validates JSON only: no ADB invocation, device input, provider operation or recording. Python 3.9+ uses only the standard library. The example is the seven-step result-viewer segment, **not a validated complete 150-second take**. It must start on the completed, unexpired E01 result page. It cannot create that result.

Recipes have 1–60 sequential steps with `action`, optional `target`, `before`, `after`, and optional `scroll` (`up` or `down`). Each step requires exact visible screen/postcondition labels. Allowed actions are `tap`, `type`, `back`, and `wait`. `type` accepts only the three reviewed shopping messages, requires an empty composer and verifies the entire draft before Send. Every successful tap executes once; postcondition waits never retry it. At most three sends are allowed. A lost response must be reconciled outside the take, not resent by restarting the recipe.

Controls are matched by exact accessibility description/text, enabled state and complete visibility inside a measured viewport. Duplicate actionable matches, invalid/clipped bounds, wrong foreground app, expiry/error screens, missing postconditions and unexpected keyboard state stop execution. Card search uses at most six swipes or Show more matches taps. Measure card bounds per device, excluding headers, keyboard, composer and system bars; do not reuse old coordinates blindly. Close the keyboard manually before scrolling. Disabled Selected controls are assertions, not tap targets.

**No recipe may tap inner `Try on`, Resume, Retry, Choose photo, Start new, or arbitrary controls.** `Try on E01` means card navigation only; before allowing that navigation, the operator must verify the same session/product has a completed unexpired job and no queued/processing/pending request. A queued job can otherwise resume work through normal app lifecycle. UI labels cannot attest provider identity: separately inspect the prepared genuine result and its provenance. An Image node alone also does not prove that its pixels loaded successfully; the operator must visually review both images.

## Recording capability — later authorization only

Do not run recording commands during preparation. A later authorized invocation supplies all of:

- `--record` and `--authorize-production-decisions` (the latter permits the reviewed shopping turns; never renders).
- `--prepared-result-reviewed`, after verifying genuine E01 result/ownership/expiry, matching original, no pending work, same session, code-6 signature/hash, operator-confirmed one-attempt server setting and approved budget.
- `--serial DEVICE`, `--viewport LEFT TOP RIGHT BOTTOM`, `--cards LEFT TOP RIGHT BOTTOM` measured on the actual target screen.

The flags are operator acknowledgments, not evidence that consent or readiness exists. They must not be supplied automatically by another script. The production app must already be foreground; this tool never launches it, installs/uninstalls it, clears data, changes settings or creates a session. A reviewed full-story recipe and physical mock calibration are still required before unattended recording; this repository intentionally supplies only the viewer example until those conditions are measured.

Recording uses a unique MP4 path, the exact remote recorder PID, SIGINT and bounded exit polling before pulling to ignored `artifacts/final-demo/`. It never kills other recorders. Remote footage is retained if pull/cleanup fails; inspect it manually. There is a hard 170-second controller/recorder bound and 45-second per-postcondition limit. No automatic take retry, upload or publication occurs. Partial footage may contain errors: label/review it privately, never present it as a successful final take.

The controller has no narration dwell/production timing guarantee. UIAutomator dumping, scrolling and three network waits add overhead. Use the plan's shot allocation as an editorial target; finish below three minutes with disclosed cuts if necessary. A full continuous 150-second native run has **not** been demonstrated by offline unit tests.

The sanitized `fixtures/historical-mock-zoom.xml` retains only allowlisted viewer labels, enabled/clickable states, classes and bounds from the October 18 isolated native mock acceptance capture. No photos, signed URLs, session IDs or private fields are included. Its disabled Zoom/Virtual try-on buttons and enabled text children exercise a real Android selector ambiguity; it is historical geometry, not a fresh device pass.
