# Single-attempt Flow A diagnostic — 2026-10-12

Flow A submitted exactly once after HTTP 200 health/readiness and unchanged accounting preflight. User-confirmed deployed OPENAI_MAX_ATTEMPTS=1 was verified through the actual configuration path with injected 429/502/503/504 responses (one provider attempt/reservation each), not inferred from readiness. The observed live delta was exactly one new reservation.

Result: **503 PLANNER_UNAVAILABLE**, no recommendations, persisted session version 0. No follow-up message/retry, Flow B/C, YouCam request, APK or demo script. Final readiness remains HTTP 200 ready with live OpenAI/YouCam, postgres persistence/ledgers and S3.

One new unresolved reservation **$0.067514**, no usage/settlement; old **$0.067504** reservation unchanged. Total 2 requests / **$0.135018 held**, remaining **198 requests / $2.864982**. Actual token usage/spend unknown; reservation is not proof of provider acceptance. No duplicate accounting or release.

Retrieve RumptyCloud logs for **2026-10-12 12:30:10–12:30:40 WAT**, equivalent **11:30:10–11:30:40 UTC**. Actual HTTP request window: 2026-10-12T11:30:16.651Z to 2026-10-12T11:30:25.569Z. Search `service=openai`, plus session `056c987d-5377-410a-b7ad-8886c8e76ac8` or messages route `/v1/sessions/056c987d-5377-410a-b7ad-8886c8e76ac8/messages`. Client request ID: `4b94e679-4a00-4039-bd97-18a3d9fdcd1a`. Ledger reservation ID: `b1f95cd8-2fb4-42c8-b473-05901b5a2d8d`. These are correlation identifiers, not an OpenAI request ID; callback logs may not include session/client IDs. The public response supplied no x-request-id.

Provide the sanitized diagnostic fields stage/status/errorCode/errorType/requestId/aborted. Provider response status, receipt/parsing state and exact root cause remain unknown until that entry is available. No error is inferred from the generic response. Evidence: `evidence/openai-diagnostic-retry-2026-10-12/attempt.json`, `attempt-cap.json`, `summary.json`.

---

# Single-reservation diagnostic retry preflight — 2026-10-11

Health and readiness both returned HTTP 200. Readiness confirms live OpenAI/YouCam, PostgreSQL persistence, S3 storage and PostgreSQL ledgers. The historical unresolved reservation remains unchanged: one request, USD 0.06750400, usage/settlement null; 199 requests / USD 2.93249600 available.

No Flow A request was submitted. Inspection found that the deployed-source adapter can automatically reserve and submit a second attempt after 429/502/503/504, contradicting the requested maximum of one new reservation. Prepared a local environment-driven OPENAI_MAX_ATTEMPTS setting (1 or 2, default 2 to preserve existing runtime behavior). Deploy this change with OPENAI_MAX_ATTEMPTS=1 before the diagnostic call; no model, provider or budget changes required. This setting is not present in the previously deployed observability fix. Public readiness does not expose/verify attempt count.

Runtime logs remain inaccessible from this session. Capture the sanitized service=openai entry in RumptyCloud after the future authorized diagnostic attempt; status/code/type/requestId/stage/aborted are internal-only by design. No new provider error or token usage exists for this preflight. No ledger changes, live calls, APK or demo script.

---

# OpenAI failure investigation — 2026-10-11

**Precise production root cause remains unknown; Flow A is not cleared for retry.** No OpenAI or YouCam request was submitted. This session has database/S3 and public endpoint access, not RumptyCloud runtime-log access. Sanitized deployed logs were requested; none were available during this investigation. The old adapter discards non-2xx response bodies and status before throwing; the agent discards underlying exceptions. Those values cannot be reconstructed from an unresolved ledger row.

Observed response was generic 503 PLANNER_UNAVAILABLE (“unavailable”), not the explicit planner timer's “timed out” response. An upstream HTTP rejection, transport failure, malformed response/usage or PostgreSQL settlement exception can all produce the generic error. One durable reservation proves reservation occurred, not that OpenAI received/accepted a request. Billable usage is unknown. HTTP status/error code/type/request ID from OpenAI are unavailable. No unsupported-model, key, quota, reasoning or schema diagnosis is claimed without provider evidence.

Git comparison: available M7/M8 source baseline f92003f versus hardened deployment commit 6d3ec05 shows the same Responses request construction, instructions, model setting, reasoning, input structure, strict function/tool choice and parser. Changes are async budget reserve/settle (PostgreSQL abstraction) and vtoEligible in projected product context. The baseline bundles M7/M8, so byte identity to every historical M7 execution cannot be proven from Git alone. Model remains gpt-5.6-terra; reasoning configuration unchanged. No remote deployment commit introspection is available.

Offline schema audit: 49 object schemas, no missing required fields or additional-properties allowance; literal const conversion and nullable optional fields remain intact. No structural regression identified. Keyword inventory/hash in schema-audit.json. Mocked request/response tests verify the Responses payload/parser, but cannot prove provider acceptance or account entitlement.

Implemented local observability fix: API adapter emits sanitized diagnostic stage (reservation, transport, http, response_json, settlement, response_shape, plan_schema), HTTP status when available, strictly formatted x-request-id, allowlisted provider error code/type, and abort state. Error-body inspection is bounded to 8 KiB. Unknown metadata becomes unrecognized; provider messages, parameters, raw errors, prompts, headers, secrets and full payloads are never logged. Production composition wires this callback to server stderr. Logging failures cannot change retries/accounting. Public API retains its generic safe failure. No model, reasoning, prompt/schema, budgets or deterministic validation were weakened. This code is local and **not deployed**; it cannot recover historical discarded errors.

Reservation d5b59f2e-c5fb-449b-bc6a-00ee1172aba8 remains unresolved, usage=null, committed_at=null, reserved/charged USD 0.06750400. Existing ledger has reserve/commit but no audited release/cancel mechanism. There is no evidence proving zero billable usage, so no reconciliation/write is justified. Remaining budget **199 requests / $2.93249600**; approval still enabled. Releasing or inventing a zero-token settlement would weaken accounting. The fresh read-only audit confirms HTTP 200 ready, OpenAI live, YouCam live, both ledgers PostgreSQL, persistence PostgreSQL and S3 storage.

Validation: **103 tests across five targeted/integration files passed**, including injected HTTP failures, transport/parsing/settlement stages, redaction/bounded bodies, logger failure isolation and local PostgreSQL accounting/persistence. Lint, typechecks, API build and secret scan pass. No APK or demo script. Next step is sanitized existing runtime/provider diagnostics for the original failure; deploy the observability fix before any separately authorized diagnostic retry if historical details cannot be recovered. No exact root-cause configuration fix was invented.


Evidence: [investigation](evidence/openai-diagnostics/INVESTIGATION.md), [ledger audit](evidence/openai-diagnostics/ledger-audit.json), [schema audit](evidence/openai-diagnostics/schema-audit.json).

---

# Production live OpenAI check — stopped on Flow A failure

Live activation is confirmed: `/health` and `/ready` HTTP 200; readiness is ready with llm=openai, youcam=live, persistence=postgres, objectStorage=s3, both ledgers postgres and YouCam scope judge. This proves initialization, not a successful OpenAI planning request.

A fresh session received the requested exact Flow A wording: “I need elegant silver earrings under $80 for an evening event. I prefer something noticeable but not too heavy.” The API returned **503 PLANNER_UNAVAILABLE**. Readback confirms session version/revision 0, empty constraints/decisions/feedback/dependencies, and no recommendations. No fabricated product was observed, but grounding and constraint extraction were not validated. Flows B/C were not run; no repeated paid retry was made.

Production ledger: **1 OpenAI reservation**, **0 settlements**, **$0.06750400 conservatively retained**. Input/output/cached token totals and actual estimated spend are **unknown**, not zero: usage is null and committed_at is null. Remaining enforced budget: **199 requests / $2.93249600**. No duplicate rows; unknown provider outcomes remain reserved by design. A new database connection verified persistence. Live replay safety and production process-restart persistence are not claimed for this failed interaction. YouCam remains at six judge renders / 44 remaining; no VTO calls occurred. Historical validation ledger remains separate.

The generic public planner error does not reveal whether the cause was upstream access/model availability, transport, the 20-second planner deadline, or settlement failure. Local database connection timeouts also occurred and recovered, but cannot establish the deployed root cause. The first local timeout was before any shopping submission, preserved as pre-message evidence; the subsequent shopping POST is the only intended live interaction. Do not reset/release the unresolved reservation or retry to force a pass. Next diagnosis requires sanitized deployed runtime/OpenAI request-error evidence for this session, not additional paid calls.

91 relevant tests across five files passed (OpenAI/context/M8 and fresh isolated PostgreSQL accounting/persistence). Lint, typechecks, API build and Android export secret scan (95 files / 7 sentinels) passed. No APK, final demo script or configuration changes made during this validation. Evidence: `evidence/openai-judge/flow-a.json`, `final-audit.json`, `summary.json`. Earlier activation-pending/zero-usage notes below are historical and superseded.

---

# OpenAI judge approval — activation pending (2026-10-10)

Production preflight confirmed migrations 001–006, runtime_budgets/runtime_usage, zero OpenAI judge usage, exact 200-request/$3 ceilings and initial approved=false. The user explicitly authorized approval: only the OpenAI row's approved flag changed to true; limits and YouCam settings were untouched. PostgreSQL RuntimeLedger initialization requiring approval passed. Historical validation file remains unchanged from HEAD (29 requests, independent 30-request/$1 ceiling), with SHA-256 retained in evidence. Production live configuration rejects file accounting; the deployed readiness reports OpenAI ledger postgres.

Activation is **not complete**: the latest public `/ready` is HTTP 200 ready but still reports llm=mock, youcam=live, persistence=postgres, objectStorage=s3, both ledgers=postgres, YouCam scope=judge. This session has database/S3 access but no RumptyCloud deployment-management capability; production OPENAI_API_KEY presence cannot be inferred from local key presence or mock-mode readiness. Operator confirmation of the deployed key (never its value) and USE_MOCK_LLM=false is pending. Retain LLM_PROVIDER=openai, LLM_MODEL=gpt-5.6-terra, LLM_REASONING_EFFORT=low, OPENAI_LEDGER_MODE=postgres, OPENAI_JUDGE_MAX_REQUESTS=200, OPENAI_JUDGE_MAX_USD=3. Restart only if required for environment application.

No live OpenAI requests sent; input/output/cached tokens and spend are all zero. Remaining judge budget: 200 requests/$3. Flows A/B/C are untested, not passed. YouCam remains at six committed judge renders, 44 remaining; no VTO calls occurred. Existing structured rejection enum uses too_plain for the requested too-minimal meaning; verify behavior in the later live flow rather than inferring success from tests.

Validation: 91 tests across five relevant OpenAI/context/M8/PostgreSQL files passed, including fresh local integration schemas; lint, typechecks and API build passed. Android export sentinel scan passed for 95 files/7 sentinels; repository scan found no configured secrets. No APK or final demo script created. Evidence: `evidence/openai-judge/preflight.json`, `approval.json`, and `activation-status.json`. Approval was verified through a separate subsequent database connection; no production process restart was attempted and no live settlement/restart proof is claimed.

---

# E12 chandelier replacement approved — 2026-10-10

The user explicitly approved a new design for E12, superseding the earlier identity rejection. E12 now uses the silver single chandelier at `vto-products/earrings/e12-evening-vto-v3-single-f19910.png` under the existing project prefix; SHA-256 `fc85563834e740cfa65732d07f1a360a1a6768a395013885299f4b621daa3a8c`, PNG 1254×1254. Production registration and description were updated transactionally; eligibility remains true, all other product fields/registrations unchanged. There are still 72 products and 12 eligible products.

**Demo-approved on the tested synthetic portrait.** The one authorized new render completed, was retrieved/displayed, and shows a single upright chandelier attached near the lobe, with branching and dangling components visible. Scale is materially improved over the old E12 pair and broadly comparable in drop length to the historical E03 successful screenshot. Fine detail is limited by the 300×375 result; this is not a physical-size guarantee or new on-device validation.

One new committed request/unit, no duplicate accounting; judge usage **6/50**, **44 remaining**. A pre-submission database/check interruption consumed no render; resuming only followed confirmation of no job/submission and unchanged baseline. OpenAI remains mock and unused. Final readiness HTTP 200 ready.

Separate E12 catalog display PNG/SVG and its approved local source were updated, and regeneration preserves them. Existing installed apps need a later mobile build to show this bundled artwork; no APK or automatic deployment was performed. Price/style/ranking fields remain unchanged. The private VTO image is not used as a public catalog URL.

Storage cleanup: these old keys under `vto-products/earrings/` are no longer registered: `e12-evening-vto-v1-71a2f4.png` and `e12-evening-vto-v2-tight-pair-cbff6f35187b.png`. Production reference audit found only completed historical jobs. They are not required for current renders or terminal-job reads; the old source bytes/hashes are archived locally in reviewed evidence. The user may delete these two old bucket objects. **Keep `e12-evening-vto-v1-aa1d5a.png`: it belongs to E01. Keep v3-single-f19910.** No object was deleted by this task.

162 tests across four relevant catalog/image/manifest/eligibility files passed; lint, typechecks, API build and Android export secret scan (95 files, 7 sentinels) passed. Evidence: [summary](evidence/e12-chandelier/summary.json), [live result](evidence/e12-chandelier/result.png), [registration](evidence/e12-chandelier/activation.json), [reference audit](evidence/e12-chandelier/reference-audit.json). All earlier E12 exclusion/identity-failure notes below apply to the previous design and are superseded by this explicit replacement approval and live result.

---

# E12 v3 single-earring upload review — 2026-10-10

**Offline review failed: product identity mismatch. No v3 registration or live render.** The actual suffixed object was discovered by listing the private earrings prefix and read with backend S3 credentials. It reports image/png, fully decodes at 1254×1254, and shows one complete silver-colored earring on white without visible text, model, props or decorative frame. However, it changes the approved product: v1/v2 is a stone-set hoop with one teardrop pendant; v3 is a marquise-top branching chandelier with multiple drops. Shared color/category is insufficient to establish identity.

Exact candidate key: `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/earrings/e12-evening-vto-v3-single-f19910.png`.

SHA-256: `fc85563834e740cfa65732d07f1a360a1a6768a395013885299f4b621daa3a8c`.

E12 remains registered to v2 with unchanged eligibility. V1/v2 objects and historical evidence were preserved. The manifest references the rejected candidate evidence without replacing its approved key/hash. A valid replacement must isolate one complete earring from the approved E12 pair, preserving the hoop, connector and single teardrop, rather than redesigning it.

Comparison: E12 v2 remains materially too small with indistinct dangling detail. The historical E03 successful screenshot shows a clear vertical gold earring attached at the lobe with its round pendant visible below. V3 has no live result because its identity gate failed; no claims about its live scale, placement or fidelity are made. **Final recommendation: exclude E12 from the faithful final-demo showcase in its current state.** No further variant generated or tested, OpenAI use, APK or demo-script creation.

Evidence: [candidate review](evidence/e12-v3-review/candidate.json). Additional renders consumed: **0**. Read-only audit confirms 5 committed judge renders total, **45/50 remaining**, E12 still eligible on v2, and HTTP 200 ready with mock OpenAI. Manifest/eligibility regression: **12 tests passed**. See `evidence/e12-v3-review/audit.json`.

---

# E12 fidelity investigation — 2026-10-10

**E12 is not acceptable as a faithful statement-earring demo example.** One authorized tighter-framing follow-up completed successfully but produced no material visual improvement. No further renders were attempted. E12 remains technically registered/eligible; fidelity approval is explicitly withheld. All other product registrations and provider settings were preserved.

Offline source measurements: E03 original pair canvas 360×395, approximate product bounds 223×292 (61.9% width / 73.9% height), gap 24 px (6.7% width). E12 original canvas 1254×1254, bounds 822×932 (65.6% / 74.3%), gap 117 px (9.3%). E12 is a silver hanging teardrop design, not inherently a stud; physical dimensions are unknown. E03's historically successful live reference was a 123×327 single-front-earring crop, so comparing its success with a full-pair E12 reference is confounded. Whitespace alone was not the leading explanation; provider pair interpretation/scaling was suspected before mutation.

A single lossless crop removed E12's faint outside frame and unnecessary margins while preserving all product pixels, proportions, finish and pair spacing. New canvas 862×972; the same bounds occupy 95.4% width / 95.9% height. Both complete earrings remain visible and separated on the original white background. No design generation/substitution or original-object overwrite occurred. New object and SHA-256: [replacement record](evidence/e12-fidelity/replacement.json); this record retains the full previous manifest entry/hash/evidence.

The same approved side-profile input was reused. Both old and new results put a tiny ornament at the lobe, approximately 8–12 pixels high versus an approximately 65–75-pixel ear. Placement is near the lobe and broadly upright, but full pendant/hoop identity is not discernible; the defect is scale plus fidelity, not output-frame clipping. Only 140 of 337,500 RGB channel values differ between results (mean absolute difference 0.00106/255). This strongly suggests remaining provider/category pair interpretation or scaling, rather than outer canvas whitespace, without proving the provider's internal cause.

**Additional consumption: 1 render; judge total 5/50, 45 remaining.** Exactly one new committed reservation; duplicate queue/terminal replay checks passed without additional usage. OpenAI remained mocked and unused. Final readiness HTTP 200 / ready. Historical validation accounting remains separate. Twelve manifest/eligibility tests pass; lint and typechecks pass. No APK or demo script created.

[Diagnosis recorded before changes](evidence/e12-fidelity/DIAGNOSIS.md), [comparison](evidence/e12-fidelity/output-comparison.json), [summary](evidence/e12-fidelity/summary.json), [new output](evidence/e12-fidelity/result-v2.png). Earlier 46-remaining and initial E12-key references below are historical and superseded only for E12 by this investigation.

---

# Production VTO registration and controlled live verification — 2026-10-10

Migrations 001–006 are applied. All twelve exact manifest key/hash mappings were registered transactionally and activated after authenticated S3 reads, image/png MIME checks, full PNG decoding, hash verification and catalog metadata/offline-review checks. E03/N03/R03/W03 retain their complete original manifest entries, including approval evidence. The database and all 72 public product responses agree: **E01, E03, E12, N01, N03, N12, R01, R03, R08, W03, W08, W11** are eligible; the remaining **60** are ineligible. All other catalog fields were unchanged. No ranking code changed.

| Category | Product | Live result | Review |
| --- | --- | --- | --- |
| Earrings | E12 | Completed; image retrieved/displayed | Earring appears very small; technical pipeline passed, statement/dangling fidelity needs review. |
| Necklaces | N12 | Completed; image retrieved/displayed | Complete necklace/pendant visible. Client submission operation interrupted; recovered only by polling the existing stored task. |
| Rings | R08 | Completed; image retrieved/displayed | Black square ring visible on finger. |
| Watches | W08 | Completed; image retrieved/displayed | Black square watch visible on wrist. |

**Exactly 4 YouCam judge requests/units consumed; 4 committed; 46 of 50 remain.** Queue and terminal replays did not create duplicate reservations/charges. N12 recovery did not submit another render; the initial client error was suppressed so its precise transport cause is not proven. No corrective render or OpenAI call occurred. OpenAI remains mocked and its PostgreSQL budget unapproved. Other four additions are registered/offline-validated but were deliberately not live-tested.

Final `/ready`: HTTP 200, status ready; postgres persistence, s3 storage, mock LLM, live YouCam, postgres ledgers, judge YouCam scope. No operational registration blockers remain. E12 has a visual-scale limitation; do not claim high-fidelity output based on terminal success alone. The provider result CDN uses binary/octet-stream, but all four downloaded results decode as PNG and display successfully. This is not a fresh physical-device UI test.

Validation: **85 tests / 6 files passed**, including fresh isolated PostgreSQL accounting and persistence integrations; lint, typechecks, API build and whitespace checks passed. Android export credential scan passed across 94 files / 7 sentinels. Repository scan for configured secret values passed. No APK, deployment, provider-mode change or final demo script was created.

Evidence: [live results and ledger summary](evidence/vto-judge-live/summary.json), [final production audit](evidence/vto-judge-live/final-audit.json), [exact registration mappings](evidence/vto-uploads/judge-registration-2026-10-10.json). Retrieved images: [E12](evidence/vto-judge-live/E12.png), [N12](evidence/vto-judge-live/N12.png), [R08](evidence/vto-judge-live/R08.png), [W08](evidence/vto-judge-live/W08.png). Historical validation ledgers remain separate and unchanged. Earlier preflight/pending status entries below are historical and superseded by this result.

---

## Judge registration preflight — 2026-10-10

Production database preflight confirms migrations 001–006, 72 products, required registration/accounting columns and privileges, zero VTO registration rows and zero eligible products. YouCam judge usage is 0/50; OpenAI budget remains unapproved. All 12 manifest assets passed authenticated S3 reads, PNG decoding, exact hash and catalog metadata checks; approved synthetic inputs are available. No registration or live renders have occurred in this preflight. Deployment readiness verification awaits its public base URL, and the missing historical four registrations need reconciliation before claiming a 12-product eligible catalog.

Lint, typechecks, API build and 85 relevant tests across six files pass, including local PostgreSQL integrations. Credential-sentinel scan passes across 94 Android export files (7 sentinels); no APK built. Initial sandbox localhost denial was resolved for the local integration rerun. See `evidence/vto-uploads/judge-registration-preflight-2026-10-10.json`.

---

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

All twelve approved assets now reside in the private bucket and are registered in production. Decorative `imageUrl` catalog assets remain separate. The eight additions use their inspected suffixed keys; the historical four retain their exact original keys and hashes. The manifest importer verifies SHA-256 and catalog category before any catalog write; it defaults to read-only.

Existing fixture catalogs default to `vtoEligible=false`; old records missing the field are treated as false. The four products are prepared but remain inactive in the deployed catalog until step 4. Card buttons, typed agent requests and direct VTO routes honor eligibility. Unsupported items return a normal unavailable message and remain available for recommendation, comparison, saving and selection. Mock lifecycle tests inject explicit eligible test products; test eligibility is not evidence of production asset availability.

## Completed subset selection

The 12-product selection, version-2 manifest and production registration are complete. See [VTO asset preparation](VTO_ASSET_PREPARATION.md) for exact filenames, prefix-relative S3 keys, per-product briefs and endpoint constraints. The importer accepts later uploaded/validated entries without schema changes and registers only validated entries whose actual bytes match their reviewed hash. Production eligibility was activated only by the separately authorized 2026-10-10 registration; other catalog fields were preserved.

## Durable OpenAI diagnostic persistence — 2026-10-12

Migration 007 and the internal PostgreSQL inspection CLI are implemented; see [OpenAI diagnostics](OPENAI_DIAGNOSTICS.md) for schema, failure semantics and operator commands. New code fails closed if PostgreSQL diagnostics cannot initialize. Existing unresolved reservations, provider settings and budgets are preserved. No production migration/deployment or live retry was performed. Production retry is gated on deploying this change, applying 007, healthy readiness and verified `OPENAI_MAX_ATTEMPTS=1`.

Validation: **556 tests passed**, including fresh PostgreSQL integration and migration tests; lint, typechecks, API build and the seven-sentinel Android secret scan passed. No live provider credits consumed; no APK built.

## OpenAI strict-schema correction — 2026-10-12

The `submit_shopping_plan` transport contained tuple-style `compare_products.productIds.items`. It now uses one string items schema with exact length two; empty args now explicitly require `[]`. A recursive checker and exact wire fixtures guard compatibility while authoritative domain validation remains unchanged. See [schema audit](OPENAI_TOOL_SCHEMA_AUDIT.md) for exact paths, official documentation comparison and limitations. **588 tests passed**, plus lint, typechecks, API build and secret scan. No live calls or deployment; one retry is gated on deploying this fix and checking readiness/`OPENAI_MAX_ATTEMPTS=1`.
