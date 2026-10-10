# Skill: Testing

Use before claiming any milestone complete.

## Test pyramid

1. Unit: decision engine, constraint scope/merge, ranking.
2. Deterministic scenario: multi-turn agent flows with mocks.
3. Integration: API/storage/providers.
4. Live: minimal LLM/YouCam validation.

## Required fixtures

Implement A01–A18 from `docs/TEST_SCENARIOS.md`.

## Provider policy

MockLLMService and MockYouCamService must support success/failure/latency fixtures. Normal development must not consume live credits unnecessarily.

## Regression rule

Every discovered bug that could recur should gain a test/fixture before or with the fix.

## Completion report

For every milestone report: commands run, tests passed, known failures, live calls made, and unmet acceptance criteria.

## Judge runtime hardening

Use fresh isolated PostgreSQL schemas to test budget approval, independent request/spend limits, duplicate settlement, concurrent reservations, restart and failure recovery. Test readiness failure/recovery and secret redaction with injected failures; never use paid calls for readiness checks. VTO tests must explicitly supply eligible fixtures, and separately prove unsupported products do not request images or render. Run Android export plus credential-sentinel scan after shared/UI changes.
