> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# M6 physical Samsung evidence — 2026-10-02

Dedicated rebuilt SDK57 app on Samsung SM-S908N / Android 16. Local PostgreSQL/S3 and mock AI only. Selected one synthetic labeled test image, not a personal photograph.

- `request-portrait.png`: typed Try on E13 validates the catalog ID and opens the on-demand portrait flow.
- `picker-mime-error.png`: backend correctly rejects the initial Android picker MIME mismatch. Client signature normalization was then fixed; repeated upload succeeds.
- `queued.png`, `processing.png`, `completed.png`: explicit mock lifecycle; completed text says no rendering was generated.
- `before-try-on.json`, `after-try-on.json`: exact equality of the complete shopping view across the visual flow.
- `restored-job.png`, `after-cold.json`: completed job restored from PostgreSQL after app process death; domain state unchanged.
- `keyboard-multiline.png`, `verification.json`: bounded multiline draft and three open/close cycles with input/Send above the IME; keyboard close restores bottom composer position.
- `card-entry.png`: product-card entry restores the completed job; `verification.json` also asserts direct Send with keyboard open commits once and preserves decisions.
- `summary.png`: persisted decisions and navigation remain usable.
- `runtime.txt`: retained current app-process records; no app runtime errors or red screen observed. This is not a device-wide crash-buffer assertion.

Provider failures, all category mappings, strict ownership/identity, persistent concurrency/replay and cache behavior are also covered by the 281-test enabled suite. Live account access, approved real catalog assets and rendering quality remain unverified; no live smoke was run. Initial exploratory picker attempts were repeated after explicit Done confirmation and the MIME fix. Gallery screenshots/private photos were not retained.
