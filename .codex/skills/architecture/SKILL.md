---
name: architecture
description: Apply repository architecture boundaries when changing backend structure, domain interfaces, persistence adapters, or infrastructure documentation.
---

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

## Hackathon infrastructure

Read [the infrastructure decision](../../../docs/INFRASTRUCTURE.md) for persistence/deployment work. The intended demo target is RumptyCloud managed app deployment, Managed PostgreSQL and S3-compatible storage; mobile stays Expo / React Native and external AI stays behind server-side YouCam/LLM adapters. This is not a permanent production-cloud choice.

Keep database access PostgreSQL-compatible and object access S3-compatible. API adapters/composition and environment configuration own provider details and secrets. Do not put RumptyCloud dependencies, endpoints or resource assumptions in decision-engine, catalog, agent or shared domain packages. Authentication remains separate from the hosting choice. The documentation decision authorizes no deployment, cloud resource creation or live AI calls; later milestone scope must explicitly require external actions.

## Forbidden

- Persisting application truth only in chat text.
- LLM writing DB records directly.
- Mobile calling YouCam/LLM with embedded secrets.
- Provider-specific response shapes leaking across the app.

## Persistence implementation

Read [M5 persistence](../../../docs/PERSISTENCE.md) for repository, ownership, transaction/replay, image-storage and local-integration contracts. Preserve atomic PostgreSQL writes and server-side authorization; agent snapshot restore/export is internal, never a client or model tool. M5 uses local PostgreSQL/S3 mocks for validation, not a cloud deployment.

## Change discipline

When changing a contract, update shared schema + tests + docs together.

## Judge runtime hardening

Provider accounting belongs in API adapters (src/accounting), never domain state. Preserve validation ledgers; judge limits use separate PostgreSQL records. Read docs/PRODUCTION_READINESS.md before changing deployment settings. /health is liveness and /ready exposes only allowlisted runtime modes and dependency status. Never serialize environment/options/raw driver errors. Do not activate budget approval or provider modes as a migration side effect.
