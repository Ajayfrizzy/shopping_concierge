# Skill: Architecture

Use for structural/backend/domain changes.

## Core invariant
AI proposes actions; deterministic services own truth.

## Boundaries
- Mobile = presentation/input only.
- API = auth, persistence, provider secrets, orchestration entry points.
- Agent = interpret/plan/explain.
- Decision engine = state transitions and constraint semantics.
- Catalog = deterministic filtering/ranking.
- YouCam adapter = provider-specific API behavior.
- Shared = schemas/types.

## Forbidden
- Persisting application truth only in chat text.
- LLM writing DB records directly.
- Mobile calling YouCam/LLM with embedded secrets.
- Provider-specific response shapes leaking across the app.

## Change discipline
When changing a contract, update shared schema + tests + docs together.
