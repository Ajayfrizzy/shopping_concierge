# Judge guide

Shopping Concierge helps a shopper narrow an accessory purchase while remembering constraints, rejection reasons and relationships between selected products. AI proposes bounded actions; deterministic services own shopping truth. The integrated decision workflow is the contribution—not chat, recommendation, comparison or virtual try-on individually.

## Access

The current signed standalone Android APK is **0.1.0 / code 6**, package `com.youcam.shoppingconcierge`, ARM64, Android 7/API24 or later. It targets https://shoppingconcierge.rumptycloud.app and needs internet, but no Metro, Expo Go, shared account or provider keys. The app creates a guest identity. **A public APK download is not yet available**: the owner must supply the reviewed file identified in the [final acceptance report](FINAL_PRODUCTION_ACCEPTANCE.md). Do not treat the ignored local artifact path as a public download.

Download the [verified APK](https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v6-arm64-release.apk) from the [public release](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android). Install the downloaded signed APK through Android's package installer (allow installation from that trusted source), or use `adb install -r <reviewed-code-6.apk>`. Preserve existing app data; a signing-certificate conflict with a development build requires a reviewed migration, not an automatic uninstall. Confirm SHA-256 against the acceptance report. [Local mock setup](DEMO_SETUP.md) remains available for developers; that path requires a host API and Metro.

Build acceptance includes **836 passed tests, zero failed/skipped**. Final recording is **NO-GO pending real-result access and recording-plan review**. [The proposed 150-second final script](FINAL_DEMO_PLAN.md) supersedes the historical M9 script for final recording planning. Natural-language sends and some buttons can incur provider usage; do not rerun paid validation as an installation check.

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

See [architecture](ARCHITECTURE.md), [historical validation](archive/milestones/VALIDATION.md) and [submission notes](SUBMISSION_NOTES.md). Checkout, live merchant inventory and retailer integrations are outside this MVP. Hosted deployment exists; safe production native checks passed; genuine-result comparison acceptance and final recording remain open. The [public code-6 APK](https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v6-arm64-release.apk) is available.
