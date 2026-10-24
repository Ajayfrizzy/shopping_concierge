> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../archive/acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# M5 physical-device evidence — 2026-10-02

Rebuilt Shopping Concierge installed on Samsung SM-S908N (Android 16). All AI services remained mock. PostgreSQL 17 and Adobe S3Mock ran locally; no cloud deployment or live email.

- `legacy-session-unavailable.png`: old unowned M4 session rejected honestly; new session explicitly created.
- `created-state.json`, `persisted-summary.png`, `before-restart.png`: guest shopping, save/shortlist E02, select E18, reject E05 (`too_flashy`), scoped refinement and category navigation.
- `before-restart.json`, `after-restart.json`, `after-restart.png`: app force-stop, API stop, PostgreSQL/S3 restart and cold app launch preserve the same domain state and session ID. SecureStore file existence was checked without exposing its credential.
- `after-refresh.json`: explicit refresh preserves domain state; search refresh advances only the turn version/current offers.
- `relaxation-review.png`, `before-confirm.json`, `after-confirm.json`, `confirmed.png`: cancel preserves the full view; explicit confirmation applies the offered earrings USD65/silver updates and preserves decisions.
- `before-retry.json`, `pending-retry.json`, `after-retry.json`, `error.png`, `retry.png`: paused API causes visible timeout; resumed API and Retry commit once. Driver checked one original request in history and cleared pending journal.
- `object-restart.json`: synthetic PNG bytes/hash retained after local service restart.
- `verification.json`: repeated assertions over retained snapshots; `runtime.txt`: app process log records. No app runtime error/red screen observed. Two overlapping UIAutomator helper processes failed; affected checks were repeated serially successfully. The entire device crash buffer was not empty.

Screenshots/UIAutomator establish visible interactions; backend snapshots corroborate structured state. Extra exploratory screenshots are not acceptance evidence. No raw guest or infrastructure credentials are included.
