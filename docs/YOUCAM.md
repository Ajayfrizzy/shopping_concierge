# M6 YouCam integration boundary

The server supports mock VTO by default and an explicit live REST adapter. Normal development/tests never consume YouCam or LLM credits. Mobile, the agent, catalog and decision engine do not hold provider credentials. PostgreSQL/S3 remain portable API adapters; nothing was deployed to RumptyCloud.

## Verified provider contract

Reviewed the public [YouCam API documentation](https://yce.perfectcorp.com/document/index.html), embedded OpenAPI version v1.9, on 2026-10-02. API origin: `https://yce-api-01.makeupar.com`. This was public documentation retrieval, not an authenticated API call.

| Category  | Required declared image   | API operation suffix |
| --------- | ------------------------- | -------------------- |
| Earrings  | portrait                  | `2d-vto/earring`     |
| Necklaces | portrait/visible neckline | `2d-vto/necklace`    |
| Rings     | hand                      | `2d-vto/ring`        |
| Watches   | wrist                     | `2d-vto/watch`       |

The adapter requests a file using `POST /s2s/v2.0/file/{suffix}`, uploads bytes through the returned PUT request, then creates one task through `POST /s2s/v2.0/task/{suffix}`. Source file ID and the catalog's approved reference image URL populate `src_file_id`, `ref_file_urls`, `source_info.name` and `object_infos[].name`. Optional masks/anchors use provider defaults; none are invented. `GET /s2s/v2.0/task/{suffix}/{task_id}` maps running/success/error to normalized job states. Completed results must contain a valid HTTPS output URL. Provider output links are documented as valid for two hours; the application uses a conservative shorter expiry and bounds total job processing time.

Provider upload/output URLs require exact configured HTTPS hostname allowlists. Redirects and unexpected upload headers are rejected; the API key is never forwarded to a file upload host. API requests have bounded timeouts and log operation/method/status only, not images, keys, task IDs, signed URLs or raw provider errors. Paid POSTs are never automatically retried after an uncertain outcome. A transient status-check error can retry the existing task without another render.

## State and credit boundaries

Typed `Try on E13` and product-card Try on both lead to the image/job screen. The strict agent `request_vto` tool validates the catalog ID and hands off the required image type; it does not supply product facts, image IDs, provider parameters or results. The API independently validates ownership, catalog IDs, stored image type and bytes. Visual jobs never modify shopping decisions, rejection memory, constraints or relaxation offers.

`visual_sessions` is a PostgreSQL-compatible per-session JSONB record, separate from the authoritative shopping record. Repository operations lock the owned shopping-session row while validating/committing visual metadata; provider I/O happens outside that transaction. Jobs and analysis-cache entries survive process/database restarts. Raw provider task IDs stay server-side; API responses contain only normalized jobs. Memory mode has the same interface but is intentionally process-local.

- Create persists a queued job; GET only reads it. Explicit POST advance claims queued submission before I/O, then stores the provider task ID. Later advance calls poll it. This simple request-driven lifecycle has no background worker requirement.
- One active job per session and a two-second status-check interval bound requests. Sessions retain at most 100 job records. Terminal jobs replay by request ID; conflicting payloads are rejected. Completed results for the same asset/product/provider/reference URL can be reused while valid.
- A crash/uncertain submission cannot silently create another paid task. A persisted claim with no task ID expires to an honest unknown-outcome failure; the user/operator must check usage before explicitly starting another request. No exactly-once guarantee is claimed across an external provider and PostgreSQL.
- Changing provider mode does not reinterpret old jobs. Polling/render failure never means the product is aesthetically unsuitable.

## Images and analysis

M5's owner-only PNG/JPEG upload validation (4 MiB / 16 MP, actual server decode and content hash) remains intact. M6 enforces the declared portrait/hand/wrist type before provider invocation and requests the appropriate type when missing. These checks do **not** pretend to detect anatomy. Actual face/pose suitability is delegated to provider detection/errors; mock mode deliberately does not infer anatomy from a synthetic fixture.

The mobile photo picker is invoked only on the explicit try-on screen. Camera/microphone permissions are disabled because this slice selects existing images. Android can supply JPEG base64 while retaining the original PNG MIME metadata; the client checks the returned signature, and the server still fully decodes/validates the image. Cancelling the picker creates no render. Failed uploads and unknown outcomes expose recovery instead of fake success.

Analysis is capability-gated. The mock face-analysis adapter returns a clearly marked mock profile with **no inferred face shape**. Its cache is session-owned and keyed by image hash, kind, provider mode and schema version; ten entries are retained. It does not write inferred preferences into decision state. Color analysis and live analysis return `ANALYSIS_UNAVAILABLE` until participant access and the useful normalized feature contract are confirmed. Public `face-attr-analysis` availability alone is not proof of account entitlement, nor authorization to infer additional personal attributes. No age/gender analysis is requested.

Mock VTO completion explicitly says **“Mock try-on completed. No visual rendering was generated.”** It never fabricates a user/product composite or a provider URL. Real anatomy detection, rendering quality, optional live analysis and account entitlement are not established by mock/contract tests.

## Local validation

```sh
npm run infra:local
npm run db:local
M5_INTEGRATION=1 npm run check
npm run verify:mobile-secrets
npm run dev:persistent
```

Rebuild/install the mobile binary after adding `expo-image-picker` using the README Android setup; reload alone cannot add a native module. Use the post-M5 keyboard fixture after any mobile layout change.

All existing regressions remain. M6 adds all-category missing-image/success/failure, ownership, strict request/provenance, idempotency/concurrency, cache, persisted job restart, credit-safe polling recovery, mobile identity/error handling, Android MIME conversion and injected-HTTP provider contract tests. These tests never call a live provider.

## Live activation is separate and unverified

The current 72 synthetic products have null `vtoAssetUrl`; live requests fail before upload/task submission for these items. No genuine product assets are substituted automatically. Live activation requires approved corresponding product images, an enabled YouCam account/API key and verified host allowlists, all configured server-side:

- `USE_MOCK_YOUCAM=false`
- `YOUCAM_API_KEY`
- `YOUCAM_UPLOAD_HOSTS` (comma-separated exact upload hostnames)
- `YOUCAM_ASSET_HOSTS` (comma-separated exact approved product/output hostnames)

`USE_MOCK_LLM` remains true through M6. The optional standalone `scripts/youcam-live-smoke.ts` is **not** part of npm test/startup. An authorized operator can set `RUN_YOUCAM_LIVE_SMOKE=one-render`, `YOUCAM_SMOKE_CATEGORY`, `YOUCAM_SMOKE_IMAGE` (approved local file) and `YOUCAM_SMOKE_PRODUCT_ASSET_URL`, along with live config, then run `node --import tsx scripts/youcam-live-smoke.ts`. It submits at most one task, polls at most 20 times, and never prints a signed output URL. It must not be automatically rerun after a timeout. No live smoke was run in this validation.

## Open deferred final-submission validation gate

- [ ] Obtain approved account entitlement/credits and suitable, approved category-specific product/image assets. Live rendering and optional analysis stay disabled until these prerequisites are satisfied.
- [ ] Validate actual live rendering paths and normalized success/failure/output handling for supported demo categories; record account/API behavior and evidence. Mock completion is not real rendering evidence.
- [ ] Validate available optional live analysis, or record an explicitly approved unsupported-analysis scope decision before submission. Do not infer anatomy/visual signals from mock profiles.
- [ ] Record real evidence, actual call count/spend and remaining limitations in `VALIDATION.md` before final submission.

This gate remains **open** through M7 and is independent of live LLM validation. No YouCam calls are authorized by the M7 OpenAI budget.

## 2026-10-07 live validation controls and status

The first real four-category run completed upload/task/poll/image display and Samsung cold restoration. Earrings/rings/watches pass visual review. Necklaces remain gated because the pendant falls below the source portrait: a wider approved neck/chest image and one targeted retry are required. See `VALIDATION.md`; this gate is **not complete**. Four render reservations and four observed units are consumed; mocks are restored. Optional analysis remains disabled.

Live configuration additionally requires `YOUCAM_USAGE_LEDGER`, pointing to the existing append-only ledger (`docs/evidence/youcam-live/render-reservations.jsonl` for this gate). Keep the same absolute server path across API and smoke invocations; never reset it or create another ledger to bypass the cap. Missing, corrupt or locked ledgers fail closed. The provider reserves before every paid task POST; max eight reservations, including unknown outcomes. A stale lock needs explicit accounting review. This guards one validation host, not distributed deployment.

`YOUCAM_BASE_URL` selects the verified official HTTPS origin (blank uses the documented default); other origins are rejected before credentials are sent. Account-returned upload/result hostname verified in this run: `yce-us.s3-accelerate.amazonaws.com`. Approved private product URLs also require the configured S3 host in the product/output allowlist. The S3 adapter can issue exact-key temporary GET URLs (default 15 minutes, maximum one hour); URLs/signatures must not be logged or committed. Temporary references for this run did not permanently populate the 72 source fixtures.

Live unit measurement used account balance and feature-cost endpoints, counted separately from paid render submissions. Provider protocol operations and balance deltas are in sanitized evidence. No user credentials, signed URLs, raw task identifiers or raw provider bodies are part of that evidence.

## Final required rendering validation — 2026-10-07

All four required VTO categories now pass live Samsung output review and cold restoration. The necklace-only retry used the new wide portrait and resolved pendant clipping. Final totals: five rendering submissions, five observed units, one targeted retry; preserved eight-render ledger, no OpenAI calls. Live server stopped and mock defaults restored. See the newest `VALIDATION.md` entry for evidence, connectivity recovery and temporary-output limitations. Earlier OPEN rendering status above is historical. Optional analysis is unused/disabled and remains unvalidated; the completed rendering gate does not certify that separate capability. M9 has not started.
