> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../archive/acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# Constraint-relaxation UX validation — 2026-10-07

Samsung SM-S908N / Android 16, isolated `com.youcam.shoppingconcierge.demo`, mock API and providers. No uninstall, live provider calls or deployment.

- `adjustments-overview.png`: adjustments, explicit proposed changes, kept constraints and descriptive review action; no product imagery.
- `review.png`: confirmation remains mandatory.
- `accepted-product-image.png`: actual E01 catalog card and illustration after acceptance/rerun.
- `accepted-summary.png`, `cold-summary.png`: scoped changes, unrelated preferences and restoration.
- Keyboard captures: short/multiline, scrolling and reopen behavior; direct Send and navigation also verified.
- `before-cancel.json`, `after-cancel.json`, `after-confirm.json`, `after-cold.json`, `state-assertions.json`: owned synthetic test session, cancel/confirmation/preservation checks. `journal.json` contains only its session reference and synthetic display messages, no bearer credential.
- `runtime.json`: final cold-launched app-process scan with zero error lines.
- `automated-check.txt`: lint, both typechecks and 458 tests / 21 files, PostgreSQL/S3 integration enabled.
- `android-export.txt`: Android bundle and 94-file seven-secret sentinel scan pass.

Complete; stop before deployment.
