# Judge guide

Shopping Concierge helps a shopper narrow an accessory purchase while remembering constraints, rejection reasons and relationships between selected products. AI proposes bounded actions; deterministic services own shopping truth. The integrated decision workflow is the contribution—not chat, recommendation, comparison or virtual try-on individually.

## Access

**[Watch the official demonstration](https://youtube.com/shorts/8SNE4YJEOBI?feature=share)** — 150 seconds, illustrative catalog and genuine previously completed YouCam output. Edited waits and same-session pickups are disclosed; the initial summary-loading failure is retained before the successful later reopen.

Download the [verified Android v11 APK](https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v11-arm64-release.apk) from the [public beta release](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android). Version 0.1.0 / code 11, package `com.youcam.shoppingconcierge`, ARM64, Android 7/API 24 or later. Internet and the live backend are required; no Metro, Expo Go, shared account or provider keys. The app creates a guest identity.

Allow installation from the trusted browser/file manager when prompted. An existing app with the same release certificate updates in place; do not uninstall or clear data to work around a signing conflict. SHA-256: `82f7efad6957d71a3778d127140d23009b6d9081b2675ec9c8ab8d63ec7f9ed0`. [Release verification](ANDROID_RELEASE.md) and [v11 acceptance](ANDROID_PRIVATE_IMAGE_RELOAD_V11.md) document identity and checks.

The accepted v11 suite recorded 983 passing integration-enabled tests. Natural-language sends and explicitly starting a try-on can consume provider usage; no paid request is needed to inspect the published demonstration. A new installation does not inherit the owner's private demo session. Completed image access expires and may no longer reopen; the video preserves the genuine result viewed during recording. [Local mock setup](DEMO_SETUP.md) remains available separately.

The catalog has 72 synthetic records (18/category), original bundled illustrations and deterministic USD fixture prices/stock. “Grounded” means every displayed fact comes from those records; it does not mean merchant inventory is connected. Live planning was validated in M7 and is shown in the final recorded journey. The separate local mock walkthrough uses a bounded interpreter.

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

Historical gate usage: **5/8 renders, 5 observed YouCam units, 0 OpenAI calls during that gate**. The October 18, 2026 budget/account-credit snapshot (not live balances) is separately documented in the [final audit](FINAL_PRODUCTION_ACCEPTANCE.md#4-current-budgets-and-reconciliation). M7's separate live LLM validation used 29/30 requests, approximately $0.1106142. No further live calls are needed for M9. Optional live visual analysis is disabled/unvalidated; VTO does not certify analysis, physical fit or purchase suitability. Raw photographs and signed provider links must not be redistributed without the relevant permission.

## Service/API use

| Component                    | Use                                                                      | Boundary / evidence                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Responses             | Proposes structured shopping tool plans when explicitly enabled          | Server-only adapter; backend checks IDs/actions and hard constraints; [M7 validation](LLM.md)                                       |
| YouCam accessory VTO         | Earrings/necklace/ring/watch image tasks                                 | Server-only validated REST adapter; owned assets, durable job claims, normalized status and bounded usage; [integration](YOUCAM.md) |
| PostgreSQL                   | Authoritative shopping state, feedback, events, owned visual jobs        | Portable API repositories; restarts/replay tested                                                                                   |
| S3-compatible storage        | Private validated input images                                           | API-owned adapter; MIME/hash/size/ownership checked                                                                                 |
| Mobile → Fastify             | Authenticated session turns, catalog facts, comparison and visual routes | [Implemented contracts](API_CONTRACTS.md); mobile never holds provider secrets                                                      |
| Deterministic engine/catalog | Scoped constraints, eligibility, ranking, dependencies, comparisons      | Unit and A01–A18 regression coverage                                                                                                |

See [architecture](ARCHITECTURE.md), [historical validation](archive/milestones/VALIDATION.md) and [final submission material](FINAL_DEVPOST_SUBMISSION.md). Checkout, live merchant inventory and retailer integrations are outside this MVP. The published demo and public v11 download are ready for owner submission review.
