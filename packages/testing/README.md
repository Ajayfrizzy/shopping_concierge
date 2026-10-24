# Testing

`MockLLMService` and `MockYouCamService` accept `{ fail, latencyMs }` fixtures. M0 exposes assistant connectivity and visual-service connectivity only; it never fabricates catalog or VTO results. M3 planner fixtures are described below; VTO lifecycle fixtures are implemented separately in the API test infrastructure.

Run `npm test` from the repository root. The default suite uses injected mocks and local fixtures. Separately named live validation scripts require explicit authorization; do not equate a mock test pass with live acceptance.

M3 adds `MockAgentPlanner` with controlled failure/latency and an injectable adversarial response function. It implements the bounded intent/planning interface from `@youcam/agent`; normal plans follow the supported mock grammar. `runAgentScenario` sends complete sequential user turns through the real service, restores request/response JSON, and runs per-turn assertions. See `fixtures/m3-scenarios.json` and `tests/agent.test.ts`. This is not live LLM accuracy testing or a VTO lifecycle implementation.
