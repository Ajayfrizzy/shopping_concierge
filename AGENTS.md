# AGENTS.md

## Mission

Build the Shopping Concierge: a mobile-first, stateful purchasing-decision agent for accessories. It helps shoppers describe a goal, preserves constraints across turns, learns from accept/reject feedback, coordinates related products across categories, and invokes YouCam visual analysis/VTO only when it helps resolve uncertainty.

## Product principles

1. AI proposes actions; deterministic services own truth.
2. Chat history is context, never the sole source of shopping state.
3. Never invent catalog products, prices, stock, visual analysis, or VTO outcomes.
4. Never silently violate hard constraints.
5. Preserve unrelated active constraints during refinement.
6. Explicit user preferences outrank inferred visual/style heuristics.
7. Rejection reasons must be structured when available.
8. Cross-product relationships must be explicit in state.
9. VTO is decision evidence, not the entire product.
10. Do not expose hidden chain-of-thought. Show structured state changes instead.

## MVP categories

- Earrings
- Necklaces
- Rings
- Watches

Architecture must support future categories without redesign: bracelets, bags, hats, shoes, apparel, etc.

## Stack

- Monorepo
- Mobile: React Native + Expo + Expo Router + TypeScript
- API: Node.js + Fastify + TypeScript
- Validation: Zod
- Hackathon backend hosting: RumptyCloud managed app deployment
- Database: RumptyCloud Managed PostgreSQL through standard PostgreSQL repository adapters
- Object storage: RumptyCloud S3-compatible storage through a server-side adapter
- Auth: guest/session mode first, optional email auth; provider choice remains separate from hosting
- Tests: Vitest + React Native Testing Library + API/integration tests
- LLM: provider with tool/function calling and structured outputs
- YouCam: server-side REST adapter only

## Infrastructure decision

The hackathon/demo target is documented in [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md); it is not a permanent production-cloud commitment. Keep deployment and provider configuration in API adapters/composition, never in the decision engine, catalog, agent or shared domain packages. Secrets stay server-side and environment-driven. This decision authorizes no deployment, cloud resource creation or live AI calls; those remain governed by later milestone scope.

## Repository rules

- Read `/docs/PRODUCT_SPEC.md`, `/docs/ARCHITECTURE.md`, `/docs/AGENT_CONTRACT.md`, `/docs/DATA_MODEL.md`, `/docs/MILESTONES.md`, and `/docs/TEST_SCENARIOS.md` before substantial implementation.
- Read the relevant `.codex/skills/*/SKILL.md` before editing that subsystem.
- Keep API keys server-side. Never place YouCam or LLM secrets in mobile code.
- Prefer shared domain types from `packages/shared`.
- Prefer deterministic business logic in `packages/decision-engine` and `packages/catalog`; do not bury it inside prompts.
- Every milestone must include tests and satisfy its acceptance criteria before moving on.
- Use mocks for most development. Live LLM/YouCam tests must be explicitly isolated and minimal to protect API credits.
- Do not add product scope beyond MVP unless required to unblock the core flow.

## Required workflow

1. Inspect current milestone and acceptance criteria.
2. Inspect relevant skills/docs.
3. Implement smallest coherent slice.
4. Run unit/regression tests.
5. Report what changed, tests run, failures, and next remaining acceptance criteria.
6. Do not claim a milestone complete while any acceptance criterion is unmet.

## Quality bar

- No fabricated data.
- No state loss across conversation turns.
- Hard constraints remain deterministic.
- Failed tool/API calls surface honestly.
- Mobile UX should remain usable on Android first.
- All tool results must be normalized before reaching the agent/UI.
