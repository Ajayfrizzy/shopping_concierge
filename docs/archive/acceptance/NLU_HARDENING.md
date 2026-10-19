> Historical record, archived 2026-10-19. Test counts, deployment failures, pending gates and budgets below describe their original observation dates, not current status. See [final acceptance](../../FINAL_PRODUCTION_ACCEPTANCE.md) for the code-6 / 836-test baseline and dated budget snapshot. Original findings are retained; later acceptance does not erase earlier failures.

# Natural-language and authorization hardening — 2026-10-18

## Findings and scope

Baseline: `fbb23216d0ded5336f264c0766a4a88b5b1ba1da`. Reproduced by running the baseline interpreter files against the same fresh session, without provider traffic. The latest Android request fails the fixed-order search grammar at its opening and preference clauses. The fallback then sees `try-on` and classifies it as an unsupported VTO action. A provider's legitimate search plan therefore cannot match the independently authorized instruction. The raw production plan was not retained in the supplied evidence and was not retrieved during this work: no claim is made about its exact arguments or ordering.

| Exact reported request                                                                                                                           | Baseline interpretation | New interpretation |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------ |
| I'm looking for elegant silver earrings under $200 for an evening event. I prefer noticeable, sophisticated designs that support virtual try-on. | Unsupported VTO         | Execute search     |
| Show me silver earrings under $200 for an evening event. I want elegant designs with virtual try-on available.                                   | Execute search          | Execute search     |
| Show me stylish watches under $300 that support virtual try-on.                                                                                  | Execute search          | Execute search     |
| Silver necklace for a wedding under $120, elegant but not too loud.                                                                              | Clarify category        | Execute search     |

These results distinguish the latest failure from previously fixed requests. Baseline authorization already permitted split/reordered exact updates and optional state reads; exact intent-label matching remained an unnecessary restriction. Independently constructed adapter responses now exercise both valid variations and material authorization failures. They do not establish live model accuracy.

## Interpretation and authorization

`shopping-instruction.ts` consumes a composition of bounded clauses at a cursor: polite intent openings, singular/plural category, currency-qualified budget, material, occasion, style, visual intensity and VTO eligibility. Clause order, casing, whitespace and punctuation can vary. Every input fragment must be consumed; unknown words, disjunctions, negations and contradictory values cannot authorize a partial search. The corpus is test data, never a runtime phrase lookup.

Explicit material/category and monetary limits remain hard requirements. `vtoOnly=true` filters server-owned capability and never requests a render. Elegant, sophisticated and lightweight are soft tags; unsupported catalog tags do not create product attributes or evidence. Noticeable/statement/bold map to high intensity; subtle/not too flashy map to low. Existing deterministic catalog ranking/filtering is unchanged.

Search authorization compares exact bounded updates including scope, source and value, then simulates transitions on detached state. Equivalent search intent labels, update ordering/grouping, and an optional state read are permitted. Every required update must occur exactly once before the sole search; unknown tools, extra changes, altered amounts/materials/scopes/provenance, missing constraints, duplicate updates and invented actions fail. A second canonical simulation compares resolved constraint effects to guard inherited precedence. Non-search operations retain exact authorization. Selected anchors, confirmation, catalog grounding, atomic commits, versions, successful replay, persistent provider accounting and request receipts retain their existing guards.

Combined searches explicitly naming a category update global constraints. Standalone budget changes retain active-category override semantics. Explicit new style lists replace that field according to existing domain rules; unmentioned fields are preserved. Stored decisions remain historical user choices even if changed filters make them ineligible for a new recommendation.

## Clarification and diagnostics

Unsupported or ambiguous interpretation returns before any planner call. Clarification turns advance the envelope version, retain domain state and emit no mutation events. Missing currency asks for currency; conflicting budgets ask for one maximum; material alternatives ask which material; conflicting intensity asks subtle or noticeable. Other missing information uses the existing category/instruction/anchor questions.

An unsafe provider plan still fails with `UNGROUNDED_PLAN` and HTTP 422, without a shopping commit. Shopper copy says the request could not safely be applied and choices are unchanged. Server-only diagnostics contain the fixed authorization rule and optional call index, never prompt text, provider bodies, secrets or product claims. Provider-unavailable and actual catalog-conflict behavior remain distinct. No failure is converted into successful shopping results.

## Evaluation and verification

`fixtures/agent/nlu-corpus.json` contains 80 labeled requests: 60 general variations across ten openings and six clause arrangements, plus 20 compound searches. All **80/80** pass interpreter, independently authored OpenAI wire response, authorization, persisted-constraint and catalog checks. Each replays with exactly one injected provider request/accounting reservation. The exact singular-necklace request also passes separately. Ten additional casing/whitespace/punctuation variants pass.

**15/15** existing-session modification requests pass independent adapter proposals after serialized snapshot restoration. Setup has active necklaces, selected E09, USD80 global budget, silver, evening, elegant/lightweight, high intensity, a complement dependency, and saved/shortlisted/rejected decisions. Unmentioned constraints and all existing decisions/dependencies survive category/budget/preference changes. **15/15** new adversarial proposals are rejected atomically, in addition to the preexisting authorization suites. Seven ambiguous/adversarial user instructions clarify without paid requests. A real Fastify route test verifies safe error presentation, precise code, no leaked diagnostic rule and unchanged readback.

Final checks:

- `M5_INTEGRATION=1 npm test -- --maxWorkers=1 --testTimeout=60000`: 815 tests in 37 files, zero skips. Includes API, mobile compatibility, local PostgreSQL/S3, accounting and diagnostics. All provider HTTP is injected.
- `npm run typecheck`, `npm run lint`, `npm run build:api`: pass.
- `npm run verify:mobile-secrets`: Android export passes; 95 files contain none of seven server credential sentinels. No APK was built.
- Changed-file credential-pattern scan and `git diff --check`: pass.
- Initial default-timeout integration runs failed the existing five-second pool-acquisition test because its wait equals Vitest's five-second deadline. The documented integration runner settings above pass without production/test-code changes to pool behavior.

`npm audit` reports 28 affected package entries (18 high, 10 moderate, zero critical), including Expo/React Native/Metro dependency chains, node-forge, braces/micromatch and router/query-string dependencies. Suggested fixes include major migrations or downgrades; no dependency versions were changed. GitHub-specific alert state was not fetched. These advisories remain a separate dependency maintenance task.

## Delivery and limitations

Backend deployment is required and was not performed. No mobile source, native dependency or shared wire schema changed; no new APK is required for these fixes. Android acceptance against the deployed backend and controlled live planner validation remain separate gates. `OPENAI_MAX_ATTEMPTS=1` remains the required deployed setting; no environment, provider budget, production session or ledger was changed. Zero live OpenAI/YouCam requests or VTO renders were made.

The interpreter supports compositional English within its vocabulary, not arbitrary language. Unknown attributes, unrecognized wording, alternatives and unsupported actions remain fail-closed. Sophisticated/lightweight remain preferences, not verified facts. Global/category budget semantics are unchanged rather than inferred from conversational intent. No video, voiceover or deployment was produced.

Changed implementation: `packages/agent/src/{shopping-instruction,interpreter,authorization,index}.ts`, `apps/api/src/llm/openai.ts`, `apps/api/src/shopping.ts`. Tests/fixtures: `tests/nlu-hardening.test.ts`, `fixtures/agent/nlu-corpus.json`. Documentation: this report, agent README, architecture/agent contract and validation log.
