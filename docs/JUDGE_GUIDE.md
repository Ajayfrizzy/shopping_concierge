# Judge guide

Shopping Concierge helps a shopper narrow an accessory purchase while remembering constraints, rejection reasons and relationships between selected products. AI proposes bounded actions; deterministic services own shopping truth. The integrated decision workflow is the contribution—not chat, recommendation, comparison or virtual try-on individually.

## Access

Use [the complete local Android setup](DEMO_SETUP.md) and [three-minute script](DEMO_SCRIPT.md). No shared account or private API key is needed. The app creates a guest identity and offers a visible new-session action. This is a development APK with a host API/Metro requirement; there is no claimed public deployment or standalone judge APK.

The catalog has 72 synthetic records (18/category), original bundled illustrations and deterministic USD fixture prices/stock. “Grounded” means every displayed fact comes from those records; it does not mean merchant inventory is connected. Live planning was validated in M7, while the reproducible walkthrough intentionally uses the bounded mock grammar.

## What to inspect

- Refine price without losing material, occasion or unrelated constraints.
- Reject a real item with a structured reason and see related ranking penalties.
- Select earrings, then create a necklace search anchored to that selection; inspect its dependency and category budget.
- Compare real catalog choices against active criteria.
- Request optional try-on only when needed; see image requirements and honest job status.
- Request an impossible combination; exact results stay empty and relaxation requires explicit confirmation.
- Restore a session after cold launch; state is retrieved from PostgreSQL, independent of chat text.

## Validated YouCam evidence

The required live VTO gate passed on Samsung SM-S908N on 2026-10-07. Captures below are historical validation evidence, separate from the mocked walkthrough. The necklace wide-portrait retry supersedes the earlier cropped result. Both visible portraits are owner-confirmed synthetic/generated; see [evidence image provenance](evidence/IMAGE_PROVENANCE.md).

| Category | Passing on-device capture                                                     |
| -------- | ----------------------------------------------------------------------------- |
| Earrings | [Cold-restored output](evidence/youcam-live/earrings-cold-restored.png)       |
| Necklace | [Wide-portrait retry, passed](evidence/youcam-live/necklace-retry-passed.png) |
| Ring     | [Cold-restored output](evidence/youcam-live/ring-cold-restored.png)           |
| Watch    | [Cold-restored output](evidence/youcam-live/watch-cold-restored.png)          |

Final gate usage: **5/8 renders, 5 observed YouCam units, 0 OpenAI calls during that gate**. M7's separate live LLM validation used 29/30 requests, approximately $0.1106142. No further live calls are needed for M9. Optional live visual analysis is disabled/unvalidated; VTO does not certify analysis, physical fit or purchase suitability. Raw photographs and signed provider links must not be redistributed without the relevant permission.

## Service/API use

| Component                    | Use                                                                      | Boundary / evidence                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Responses             | Proposes structured shopping tool plans when explicitly enabled          | Server-only adapter; backend checks IDs/actions and hard constraints; [M7 validation](LLM.md)                                       |
| YouCam accessory VTO         | Earrings/necklace/ring/watch image tasks                                 | Server-only validated REST adapter; owned assets, durable job claims, normalized status and bounded usage; [integration](YOUCAM.md) |
| PostgreSQL                   | Authoritative shopping state, feedback, events, owned visual jobs        | Portable API repositories; restarts/replay tested                                                                                   |
| S3-compatible storage        | Private validated input images                                           | API-owned adapter; MIME/hash/size/ownership checked                                                                                 |
| Mobile → Fastify             | Authenticated session turns, catalog facts, comparison and visual routes | [Implemented contracts](API_CONTRACTS.md); mobile never holds provider secrets                                                      |
| Deterministic engine/catalog | Scoped constraints, eligibility, ranking, dependencies, comparisons      | Unit and A01–A18 regression coverage                                                                                                |

See [architecture](ARCHITECTURE.md), [current validation](VALIDATION.md) and [submission notes](SUBMISSION_NOTES.md). Checkout, live merchant inventory, retailer integrations and production deployment are outside this MVP.
