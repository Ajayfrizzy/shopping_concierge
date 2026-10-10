> Latest N12 recheck (2026-10-10): the new `n12-evening-vto-v1-241860.png` passes offline appearance review with complete chain/clasp and pendant. All eight additions now pass offline appearance review and remain uploaded/ineligible pending approval and registration. Live rendering remains untested. See [VTO upload review](VTO_UPLOAD_REVIEW.md).

# Judge runtime preparation

This change is deployment preparation. Neither deployed provider mode nor cloud catalog has been changed. No paid provider calls are required to run checks.

## Exact RumptyCloud non-secret configuration

After applying migrations 005/006, use these settings for the new backend. They intentionally keep both providers mocked:

```dotenv
NODE_ENV=production
API_HOST=0.0.0.0
PORT=8080
PERSISTENCE_MODE=postgres
OBJECT_STORAGE_MODE=s3
S3_FORCE_PATH_STYLE=true
EMAIL_AUTH_ENABLED=false
USE_MOCK_LLM=true
USE_MOCK_YOUCAM=true
OPENAI_LEDGER_MODE=postgres
OPENAI_JUDGE_MAX_REQUESTS=200
OPENAI_JUDGE_MAX_USD=3
YOUCAM_LEDGER_MODE=postgres
YOUCAM_LEDGER_SCOPE=judge
YOUCAM_JUDGE_MAX_RENDERS=50
YOUCAM_MAX_REQUESTS=8
YOUCAM_MAX_UNITS=8
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.6-terra
LLM_REASONING_EFFORT=low
YOUCAM_BASE_URL=https://yce-api-01.makeupar.com
```

The platform injects PORT from its 8080 port setting. Set its readiness path to `/ready` once this version is deployed; `/health` remains a basic liveness endpoint and `/` remains 404. Keep existing DATABASE_URL, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ASSET_PREFIX, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, OPENAI_API_KEY, YOUCAM_API_KEY, YOUCAM_UPLOAD_HOSTS and YOUCAM_ASSET_HOSTS privately configured. Retain the existing database-only TLS exception (`DATABASE_SSL_REJECT_UNAUTHORIZED=false` with `sslmode=require`) only for the approved self-signed database; otherwise verify TLS normally. No file ledger path is needed in judge mode.

## Health contracts

`GET /health`: `{ "status":"ok", "service":"youcam-api" }`. The misleading constant `mode` field is removed.

`GET /ready`: HTTP 200 with `status=ready` and `runtime` containing persistence, objectStorage, llm, youcam, youcamLedger, openaiLedger and youcamLedgerScope. HTTP 503 uses `status=unavailable` and the same non-secret configuration allowlist. Dependency error messages/keys/URLs are never returned. Production composition checks validated catalog loading, S3 HeadBucket and configured database ledgers. S3 HeadBucket does not certify object write permissions. Readiness does not make provider calls, prove API-key entitlement, or certify visual output quality. Mock mode does not require approval of the inactive OpenAI budget.

## Accounting and review

Migration 005 creates `runtime_budgets` and `runtime_usage`, separate from validation tables/files. YouCam judge capacity is 50 requests/50 units. OpenAI judge capacity is proposed at 200 requests/$3, with `approved=false` in PostgreSQL. The 29-request validation ledger remains untouched, and migration 004's five reservations/eight-request/eight-unit ceilings remain unchanged.

The validated OpenAI profile was $0.1106142 for 29 requests (about $0.00381/request). At that average, 200 requests cost about $0.76. The proposed $3 ceiling provides room for longer turns while bounding spend. Each attempt reserves a conservative byte/token upper estimate before network I/O; actual usage settles input/output/cached tokens and estimated USD. Unknown/malformed responses retain the reservation. A transient HTTP retry is a separate charged attempt, and uncertain network failures are not retried. Concurrent workers serialize on the budget row; settlement replays are idempotent, conflicting settlements fail. Unexpected usage above its reserved bound blocks further requests. Usage is an estimate from the validated model rate, not a provider invoice.

OpenAI budget approval is deliberately not environment-only: after explicit review, an operator must approve the `openai` row in `runtime_budgets`. Do not do so during this preparation. Changing environment limits requires matching persisted limits and never deletes history. Production live OpenAI rejects file accounting. Production live YouCam requires PostgreSQL judge scope. Existing file/validation adapters remain for local evidence only.

## Deployment order (not executed automatically)

1. Run `npm run db:migrate` from a checkout with the target database environment injected. New migrations are additive; they do not activate providers or change existing product JSON.
2. Deploy the new backend with the mock settings above; verify `/health` and `/ready`.
3. Verify the curated manifest read-only: `node --env-file=apps/api/.env --import tsx scripts/prepare-judge-vto.mts`.
4. Only against a backend version supporting `vtoEligible`, use the same command with `--apply` to atomically insert private asset references and enable the four approved products. This avoids breaking the old deployed backend's strict product schema. It does not change display images or provider modes.
5. Obtain and approve the eight missing matching product assets. Update the manifest, verify bytes and category mapping, and activate only genuinely supported products.
6. Review OpenAI judge budget and privately verify provider host allowlists/asset accessibility before separately authorizing live modes. No such activation is part of this change.
7. Build the final APK against the deployed API only after these gates and native UI review pass.

Startup fails closed for missing migrations/access, inconsistent limits, unapproved live OpenAI budget, unsupported provider/model configuration or invalid persistence/TLS/S3 configuration. Exhausted budgets block further submissions rather than reset. Fresh presigned S3 URLs are created on the server immediately before YouCam task submission; permanent private keys and signed URLs do not reach the agent or UI.

## Curated asset inventory

The private S3 review found one existing approved isolated product image per category. Their previous live validation mapped them to E03/N03/R03/W03. Hashes and relative object paths are recorded in `fixtures/vto/judge-assets.json`; S3_ASSET_PREFIX supplies the private project prefix.

| Product | Existing private asset relative path         |
| ------- | -------------------------------------------- |
| E03     | vto-products/earrings/earring01-9493d1.png   |
| N03     | vto-products/necklaces/necklace01-9444a6.png |
| R03     | vto-products/rings/ring01-5d89c0.png         |
| W03     | vto-products/watches/watch01-c7069f.png      |

These four assets already reside in the private bucket; no redundant uploads or fabricated variants were made. Decorative `imageUrl` catalog assets remain separate. The twelve-product target is **not complete**: E01/E12, N01/N12, R01/R08 and W11/W08 are the selected missing slots, not VTO-ready products. No matching isolated assets are available for them. The manifest importer verifies SHA-256 and catalog category before any catalog write; it defaults to read-only.

Existing fixture catalogs default to `vtoEligible=false`; old records missing the field are treated as false. The four products are prepared but remain inactive in the deployed catalog until step 4. Card buttons, typed agent requests and direct VTO routes honor eligibility. Unsupported items return a normal unavailable message and remain available for recommendation, comparison, saving and selection. Mock lifecycle tests inject explicit eligible test products; test eligibility is not evidence of production asset availability.

## Completed subset selection

The 12-product selection and version-2 status manifest are complete; asset readiness remains four validated/eight missing. See [VTO asset preparation](VTO_ASSET_PREPARATION.md) for exact filenames, prefix-relative S3 keys, per-product briefs and endpoint constraints. The importer accepts later uploaded/validated entries without schema changes and registers only validated entries whose actual bytes match their reviewed hash. No eligibility or production state was changed.
