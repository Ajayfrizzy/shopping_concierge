# Post-M5 keyboard stabilization — 2026-10-02

Samsung SM-S908N / Android 16, dedicated SDK57 M5 development binary, cache-cleared Metro, local persistent API and mock AI.

- `before-fix.png`: reproduced keyboard covering the composer before the corrected bundle was loaded.
- `short-text.png`, `multiline.png`: input and Send visible above keyboard, including wrapped text and four explicit newlines.
- `closed-0.png` through `reopened-2.png`: three close/open cycles restore consistent composer positions.
- `scroll-open.png` / `.xml`: actual chat-region swipes reach E13 product card with keyboard open and draft unchanged. Initial automation swiped the composer or used an outer full-screen ScrollView; the final repeated check used the visible chat viewport and replaced this screenshot/XML.
- `ready-send.png`, `sent.png`: direct Send tap with keyboard open commits once and dismisses keyboard.
- `cold-launch.png`, `cold-launch-keyboard.png`: same persisted session after force-stop/relaunch; keyboard avoidance still works.
- `summary.png`, `returned.png`: summary/back navigation preserved.
- `error.png`, `retry.png`: local API timeout and recovery; original request commits once, journal clears and decisions remain.
- JSON snapshots corroborate session equality/decision preservation; `geometry.json` records composer/Send bounds versus keyboard top. `runtime.txt` retains current app-process logs, with no app runtime error observed.

Only synthetic fixture state is retained. No guest credentials, infrastructure secrets or live provider calls. The reusable physical regression fixture is in `docs/TEST_SCENARIOS.md`; portable controller tests do not claim to validate native layout.
