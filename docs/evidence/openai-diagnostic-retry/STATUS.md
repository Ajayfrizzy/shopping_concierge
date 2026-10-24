> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../archive/acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# Single-reservation diagnostic retry preflight — 2026-10-11

Health and readiness both returned HTTP 200. Readiness confirms live OpenAI/YouCam, PostgreSQL persistence, S3 storage and PostgreSQL ledgers. The historical unresolved reservation remains unchanged: one request, USD 0.06750400, usage/settlement null; 199 requests / USD 2.93249600 available.

No Flow A request was submitted. Inspection found that the deployed-source adapter can automatically reserve and submit a second attempt after 429/502/503/504, contradicting the requested maximum of one new reservation. Prepared a local environment-driven OPENAI_MAX_ATTEMPTS setting (1 or 2, default 2 to preserve existing runtime behavior). Deploy this change with OPENAI_MAX_ATTEMPTS=1 before the diagnostic call; no model, provider or budget changes required. This setting is not present in the previously deployed observability fix. Public readiness does not expose/verify attempt count.

Runtime logs remain inaccessible from this session. Capture the sanitized service=openai entry in RumptyCloud after the future authorized diagnostic attempt; status/code/type/requestId/stage/aborted are internal-only by design. No new provider error or token usage exists for this preflight. No ledger changes, live calls, APK or demo script.
