# Proposed final demo — 150 seconds, not executed

This is the authoritative plan for future final recording; it supersedes the [historical M9 script](archive/demo/DEMO_SCRIPT.md). APK distribution is complete through [GitHub Releases](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android). The code-6 acceptance baseline is **836 tests passed, zero failed/skipped**; no recording is complete.

Status: **DRAFT / NO-GO until the acceptance gates below close.** No final recording, narration, provider submission or publication was performed for this plan. Deadline **November 2, 2026**, 1–3-minute format and judging criteria are supplied by the owner's current hackathon brief; confirm portal requirements before submission.

## Story and truthful boundaries

A shopper needs silver accessories on a budget. The concierge remembers constraints and rejection reasons, makes a deliberate selection the anchor for a necklace search, and uses YouCam evidence to help inspect an eligible accessory. Show the synthetic-catalog disclosure; do not imply real stock, checkout, merchant integration, measured conversion uplift or guaranteed fit.

Use E01 (silver, USD 35) as the selected/VTO candidate, E05 (silver, USD 110) for the `too_flashy` rejection, and N01/N02 for necklace comparison. E03 is gold and is not a substitute in a silver-only story. E18 from the old M9 script is not currently VTO-eligible. Production read-only audit reports 72 products / 12 eligible. `tests/final-demo-plan.test.ts` validates the proposed decision sequence with isolated fixtures and no visual job; it does not certify live language latency or a current real result.

## Required pre-recording gates

Installed code-6 identity and safe native checks passed during this audit after reconnection; recheck identity briefly on recording day. Current real-result viewing remains blocked by expiry.

1. Verify Samsung's installed production package, version code 6, release certificate and APK content against the acceptance report. Complete the native matrix. Never clear app storage, reinstall with a different signing identity, overwrite a private journal or extract SecureStore credentials.
2. Select one owner-approved non-personal source photo and a genuine E01 YouCam output from the **same job**. Confirm publication provenance. Every stored production result was expired at audit time; do not alter expiry, silently re-render, inject historical images into production state or pass mock output off as live.
3. Resolve the real-result shot before scheduling recording. Preferred future option: separately authorize **at most one** preparatory render in the target session, check completion once through normal idempotent flow, record its ledger/job reference privately, then record within the app's 110-minute result lifetime (also check provider URL availability). This task authorizes none of that spending. If no new render is approved, propose an explicitly labeled historical clip from approved existing evidence; that is an alternative to the current-app comparison/zoom shot, not proof those controls ran against that historical output.
4. Reconcile device/session selection with the chosen job. The recording script must not create a new session that loses access to the prepared result. An earlier selected/rejected state changes what the buttons show: establish and review a dedicated demo session through normal app controls in a separately authorized preparation step. Do not modify production records directly to force the script.
5. Three planned natural-language operations can invoke OpenAI: initial goal, necklace request, and comparison (including tapping the second Compare button). Authorize their bounded budget separately before any live rehearsal. Do not assume button-based comparison is free. Structured rejection, selection and VTO-filter actions bypass the planner. Recording authorization alone must not be interpreted as permission to render again.
6. Review the sequence and authorize recording explicitly. Keep credentials, guest identifiers, private URLs and personal gallery thumbnails out of footage. Enable Do Not Disturb manually and review the notification/status bar; do not silently change the phone's settings.

## Shot list

Total planned duration: **150 seconds**. Suggested narration is a draft, not generated audio. Allow clearly disclosed cuts for network waits; do not conceal errors, splice a different product's output into the story or call old evidence a new render.

| Time | Seconds | Device action and expected state | Suggested voiceover |
| --- | ---: | --- | --- |
| 0:00–0:10 | 10 | Open the verified standalone app on the consumer's initial shopping screen; retain catalog disclosure. | “Choosing accessories online means juggling budget, style and whether pieces work together. This concierge keeps those decisions in one place.” |
| 0:10–0:30 | 20 | Enter `Silver earrings under $120` in **Shopping message**, tap **Send to concierge** once; wait for exact cards. This is OpenAI operation 1 in a live session. | “I describe what I want naturally. These are clearly labeled sample products, and every price and material comes from the catalog.” |
| 0:30–0:43 | 13 | Show **What changed** / silver and USD 120 constraints, then the first appropriate cards. | “The budget and material become explicit state, so later refinements don't quietly discard them.” |
| 0:43–0:58 | 15 | Find **Reject E05**, select **Too flashy**, then **Reject product** once. Show rejection feedback/updated results. Use the structured reason, not Send rejection explanation. | “This pair is too flashy. That reason is remembered and informs later ranking; it isn't just another chat message.” |
| 0:58–1:10 | 12 | Find **Select E01**; confirm Selected. Tap **Show virtual try-on products**; confirm E01 remains eligible within constraints. | “I choose this silver pair. Try-on is offered only for products the backend has approved for the integration.” |
| 1:10–1:38 | 28 | **Try on E01** opens the already completed, still-valid genuine job. **Expand and compare photos** → **Original** → **Virtual try-on** → **Zoom in** twice → **Fit image** → Android Back. Never tap the inner render **Try on** button. | “YouCam runs server-side, using an approved product image and my chosen photo. This is the real, previously completed result. I can compare it with the original and zoom to inspect details. Zoom adds no new detail, and a preview doesn't guarantee physical fit.” |
| 1:38–2:00 | 22 | Back to shopping; disable the VTO-only filter via **Show all matching products**. Send `Now find a necklace that works with this under $100` once (OpenAI operation 2). Show the selected E01 dependency and necklace budget. | “Now the chosen earrings anchor a necklace search. The relationship is explicit, and the necklace has its own hundred-dollar budget.” |
| 2:00–2:18 | 18 | Send `Compare N01 and N02` once (OpenAI operation 3), or use their Compare controls once; do not do both. Show factual criteria/eligibility. | “The comparison uses prices, materials and my criteria, rather than inventing product facts or beauty scores.” |
| 2:18–2:30 | 12 | Open **Session summary**; show selected earrings, rejection memory and cross-category dependency. | “The result is a clearer shopping decision: remembered constraints, feedback, coordinated choices and visual evidence when it helps.” |

If E05 is not within the bounded card scroll, stop and re-review framing; do not reject a different item while narrating E05. If the stored result is expired/unavailable or the page offers only photo upload/render, stop the real-result shot. Do not tap through an unexpected state.

## Deterministic ADB recording workflow (planned only)

Reuse the established ADB/UIAutomator/`screenrecord` workflow from the M9 native rehearsal. That historical video's media duration was 103.8472 seconds; the 106.01-second figure includes surrounding overhead. Neither is timing evidence for this new plan.

**Preflight, without recording:** pin the exact serial and package; require exactly one selected authorized device; read `dumpsys package`, `pm path`, pull the installed base APK into ignored artifacts, verify version/signature/content. Require the foreground package before each action. Inspect the current screen and session before starting; never launch a try-on route whose queued job could resume a paid request. The server snapshot must show no active queued/processing real job for this workflow.

**Selector-driven taps:** dump UI hierarchy, parse `text`/`content-desc`, require a unique enabled matching node, intersect its bounds with the viewport, tap its center, then assert the expected next screen. Use accessibility labels `Shopping message`, `Send to concierge`, `Reject E05`, `Select E01`, `Try on E01`, `Expand virtual try-on image`, `Zoom in`, and `Back to try-on`. Determine the exact title-cased reason label from the current hierarchy. Ignore nodes whose reported bottom is above their top; native scroll containers can expose off-screen children.

**Scrolling:** swipe only inside the visible card viewport, excluding header/composer/keyboard. On the Samsung's previously observed 1080×2316 layout, the closed-keyboard card area was approximately y=357–1784; read current geometry instead of assuming it. Use 400 ms swipes, at most six per target, checking after each swipe. Do not accumulate blind taps or use coordinates copied from a keyboard-open screen. If a product cannot be reached without excessive scrolling, change the reviewed shot plan before recording.

**Typing and waits:** ASCII messages above can be sent with `adb shell input text`, converting spaces to `%s` and using proper shell quoting. Assert the entire visible draft before sending. Tap Send once, wait for pending state to clear and expected constraints/cards, bounded to 45 seconds. Never retry a paid operation automatically after timeout. Stop recording and reconcile the existing request with its original ID outside the take.

**Recorder commands to execute only after separate approval:**

```sh
# Replace SERIAL with the verified device. Do not execute during this audit.
adb -s SERIAL shell screenrecord --bit-rate 8000000 --time-limit 170 /sdcard/Download/concierge-final-take-01.mp4
# Run the reviewed selector-driven actions from a separate controller process.
# Stop the recorder gracefully once the 150-second sequence completes, then:
adb -s SERIAL pull /sdcard/Download/concierge-final-take-01.mp4 artifacts/final-demo/take-01.mp4
ffprobe -v error -show_entries format=duration -of json artifacts/final-demo/take-01.mp4
```

Launch `screenrecord` as a managed process and retain its PID/session; stop only that recorder gracefully, not every device recorder. Avoid shell separators or command interpolation in selector text. Keep recording, XML, screenshots and draft narration under ignored artifacts until privacy review. Android screenrecord produces silent footage; add approved narration later, without inventing live timing.

**Abort gates:** unexpected app/package, multiple/absent targets, locked/offline phone, unexpected permission/personal-gallery screen, stale session, expired real result, pending provider request, error/retry prompt, more than three approved planning attempts, or any render-start button in the result-viewing shot. No generic “tap Try on” selector: product navigation and paid render initiation share visible wording but have different accessibility/context.

**After each take:** compare request/YouCam ledger counts with preflight. Expected new renders during the take: **zero**. If any unexpected reservation appears, preserve it and stop. Review every frame, duration (60–180 seconds), labels, sound and personal information before export/publication. No automated retry of an entire live take. Keep a clearly labeled historical-evidence fallback as a separately reviewed edit, never an undisclosed mock substitution.
