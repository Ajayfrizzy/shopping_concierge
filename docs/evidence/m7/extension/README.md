> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../../archive/acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# Approved M7 extension — 2026-10-04

Samsung SM-S908N, SDK57 development client, live OpenAI/mock YouCam, persistent local PostgreSQL/S3. `results.json` records assertions and cumulative ledger usage. `budget.json`, `cancel.json`, `confirmed.json`, `reloaded.json` contain synthetic session views only. Screenshots show proposals, explicit confirmation and restored summary. Runtime error filter is app-PID scoped and empty after successful reload.

Requests26–29: error-state recovery refresh, corrected standalone category budget, correct-URL reconnection refresh, actual native reload refresh. Cancel and confirmation are deterministic with no paid calls. Initial reload failed to load a script; explicit/default Metro USB forwarding and correct dev URL restored it, and actual reload was retested successfully. Domain state is identical before/after successful reload. No source/native changes for the forwarding repair. All remaining M7 checks pass. M8 stopped; deferred live YouCam gate open.
