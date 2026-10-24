> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../archive/acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# M4 physical Android evidence — 2026-10-02

Samsung SM-S908N / Android 16, serial DEVICE_SERIAL. Dedicated Shopping Concierge development build, package `com.youcam.shoppingconcierge`, versionCode 2 / versionName 0.1.0. Used the existing SDK57 binary and cache-cleared Metro on 8082 with mock API on 4000; USB reverse for both ports. No source/native changes or paid provider calls during this pass.

Screenshots: `home.png`, `search.png`, `rejection-review.png`, `summary.png`, `category-summary.png`, `restored-summary.png`, `no-match.png`, `relaxation-review.png`, `confirmed.png`, `error.png`, `retry.png`. Screenshots were captured via `adb exec-out screencap -p`; visible controls were driven with ADB taps/input and inspected using UIAutomator and images.

JSON snapshots were read from the mock API using the session ID read from the app-private native file journal (`adb shell run-as com.youcam.shoppingconcierge cat files/shopping-session-v1.json`). They corroborate device-driven actions; no HTTP POST was used to drive the shopping journey. Data is synthetic guest test data, not a live user's shopping history.

- `decisions-state.json`: E02 saved/shortlisted, E14 selected, E09 rejected as too_flashy.
- `necklaces-state.json`: scoped earrings preferences retained while necklaces are active.
- `before-reload.json` / `after-reload.json`: full `state` deep equality after `am force-stop` and development-client relaunch, same ID, version 9 → 10 from results refresh.
- `before-confirm.json` / `after-confirm.json`: explicit current offer applied, version 14 → 15. Only earrings-scoped budget USD35 and material silver added; prior constraints/decisions preserved. Cancel previously preserved the whole session view; plain yes preserved domain state.
- `before-retry.json` / `pending-retry.json` / `after-retry.json`: API process paused with SIGSTOP, message timed out visibly, original request persisted, process resumed with SIGCONT, Retry tapped. Exactly one turn committed, decisions preserved, pending journal cleared, request appears once in display history.
- `verification.json`: assertion summary. Initial full logcat capture ended early with a logging EOF; the final retained ReactNativeJS/AndroidRuntime and crash buffers were therefore read separately. Both launch records are retained in `runtime.txt`; no Shopping Concierge errors/exceptions or fatal crash records were found. Historical unrelated-app crash records were excluded. No red runtime screen appeared during any step. The full device-wide log is intentionally not committed because unrelated apps may log private data.

Automation navigation retries only scrolled to offscreen controls; these were not app failures. An initial ADB text entry expanded the dollar sign and produced an honest clarification; it was resent with literal shell quoting. No product behavior was patched to complete this validation.
