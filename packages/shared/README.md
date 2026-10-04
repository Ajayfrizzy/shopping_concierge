# Shared

`@youcam/shared` exports Zod schemas and inferred TypeScript types. `src/domain.ts` owns categories, products, constraint values/provenance/scope, feedback/reasons, per-category decisions, dependencies, session snapshots, actions, and state-change events. `domain.ts` is a compatibility re-export, not a second set of manually maintained types.

`src/index.ts` also exports M0 health/foundation response contracts. Shared runtime imports use real `.ts` source paths so both Metro and the TypeScript/tsx server toolchain resolve them. Both no-emit TypeScript configurations allow TypeScript import extensions. Do not add a Node-only `.js` re-export for a source file that exists only as `.ts`; the mobile regression test and Android export protect this boundary.

Schemas are strict; malformed fields, invalid provenance, duplicate constraint slots/decision memberships, cross-category product contradictions, invalid dependency anchors, and revisions ahead of the snapshot fail validation. Currency is an uppercase three-letter code; the engine performs no foreign-exchange conversion. Null `vtoAssetUrl` means a catalog asset is unavailable, not a successful try-on.

See `docs/DATA_MODEL.md` and the decision-engine README for exact state semantics. These are domain snapshots, not implemented database migrations or authentication contracts.

M2 adds `src/catalog.ts`: unique catalog validation, scoring configuration, grounded ranking evidence, exact search results and confirmation-required relaxation proposals. Session/product schemas remain compatible; catalog data is owned by the backend.

M3 adds `src/agent.ts`: strict intent/tool plans, message/action/confirmation requests, authoritative session envelopes, grounded agent responses, and normalized errors. Planner output cannot carry replacement state, catalog facts, tool results or prose.
