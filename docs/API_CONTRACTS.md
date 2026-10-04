# API Contracts

Initial routes; refine without changing semantics casually.

## Sessions

- POST `/v1/sessions`
- GET `/v1/sessions/:id`
- POST `/v1/sessions/:id/messages`
- POST `/v1/sessions/:id/reset`

## Products

- GET `/v1/products/:id`
- POST `/v1/sessions/:id/products/search`
- POST `/v1/sessions/:id/products/:productId/shortlist`
- POST `/v1/sessions/:id/products/:productId/select`
- POST `/v1/sessions/:id/products/:productId/reject`
- POST `/v1/sessions/:id/products/:productId/save`
- POST `/v1/sessions/:id/compare`

## Visual assets / VTO

- POST `/v1/sessions/:id/assets`
- GET `/v1/sessions/:id/visual-profile`
- POST `/v1/sessions/:id/visual-profile/analyze`
- POST `/v1/sessions/:id/vto`
- GET `/v1/sessions/:id/vto/:jobId`

## Health/debug for development

- GET `/health`
- GET `/v1/sessions/:id/events` (development/admin guarded)

All request/response bodies must be validated with shared Zod schemas.

## Implemented foundation endpoints (M0)

- `GET /health`: `{ status: "ok", service: "youcam-api", mode: "mock" }`. Liveness only; it does not claim live provider availability.
- `POST /v1/foundation/messages`: strict `{ message: string }`, trimmed, 1–2000 characters. Returns `{ message, mode: "mock", readyForShopping: false }`. Invalid input returns 400; a mock provider failure returns 503 with `{ error: { code, message, recoverable } }`. Bodies are capped at 16 KiB.

The M3 session endpoints implemented below supersede the corresponding planned entries; other search/action/reset/visual endpoints remain planned except the M4 product lookup below. The foundation route intentionally makes no persistence or shopping claims.

## Implemented mock shopping sessions (M3)

- `POST /v1/sessions`: strict `{ "goal": "optional description" }` (or `{}`), HTTP 201 with `{ state, version: 0, pendingRelaxations: [] }`. Goal is stored, not implicitly interpreted.
- `GET /v1/sessions/:id`: current validated session view. Unknown IDs return 404.
- `POST /v1/sessions/:id/messages`: one strict request variant below; HTTP 200 returns `AgentResponse`.

```json
{ "type": "message", "requestId": "turn-1", "expectedVersion": 0, "message": "Silver earrings for a wedding under $120, elegant but not too loud." }
```

```json
{ "type": "action", "requestId": "turn-2", "expectedVersion": 1, "action": { "type": "feedback", "feedback": { "action": "save", "productId": "E18" } } }
```

```json
{ "type": "confirm_relaxation", "requestId": "turn-3", "expectedVersion": 2, "proposalId": "COPY_FROM_CURRENT_SESSION_PENDING_RELAXATIONS" }
```

Use the actual returned version/offer ID, not the illustrative sequence above. Confirmation never accepts supplied updates/products. A new successful turn invalidates previous offer IDs. A plain yes only asks for explicit proposal selection. Client action updates require explicit provenance and are validated through the same M1/M2 tools.

Responses contain `mode: mock`, status (`ok`, `clarification`, `unsupported`), intent, backend-generated message, session view, actual state-change events, structured UI (product list/detail, empty state, or current constraints), and completed tool names. Search payloads preserve all M2 exact-match/evidence/relaxation fields. Only `exactMatches` are current recommendations; pending candidates require confirmation. Every product is from the synthetic fixture catalog.

Errors use shared `agentErrorResponseSchema`: `{ error: { code, message, recoverable } }`. Invalid input returns 400, missing session/detail 404, stale version/request-ID conflict/invalid confirmation 409, unauthorized plan or deterministic transition failure 422, invalid model plan 502, mock planner failure/timeout or session capacity 503. Unexpected turn failure returns normalized 500 without internal details. Existing body limit is 16 KiB; messages max 2,000 characters.

Sessions are local in-memory mock guest data, lost on process restart. Opaque IDs identify sessions; authenticated ownership/durable persistence is M5. Keep the default loopback API binding for local development. Retries reuse the same request ID and payload; the last 50 successful requests per session replay the original response. Distinct concurrent turns require refreshing after a 409. These endpoints do not alter the existing M0 foundation route. M4 mobile chat and quick actions use these same strict variants.

## Implemented catalog detail lookup (M4)

`GET /v1/products/:id` validates the ID with shared `idSchema` and returns a shared `productSchema` record from the same backend fixture catalog used by the agent. Invalid IDs return normalized 400; unknown IDs return normalized 404 `UNKNOWN_PRODUCT`. This read-only route supplies current facts for session-summary IDs; it neither recommends those historical choices nor changes state. Product image URLs are fixture placeholders, not available photos; VTO asset URLs remain null.

Mobile successful create/read/turn/product responses are schema-validated. Read/turn responses must belong to the requested session, turn events to that session, and product lookup to the requested product. Mobile actions do not send prices, stock, replacement state, or relaxation updates.

## M5 ownership and persistence (supersedes M3 in-memory-only transport assumptions)

All session/create/list/read/turn/confirmation and image routes now require `Authorization: Bearer <64-lowercase-hex guest credential>`. Mobile generates it with cryptographic randomness and persists it in SecureStore. Missing/malformed credentials return normalized 401 `UNAUTHORIZED`; a session owned by another identity is indistinguishable from an unknown session (404). Existing M3 body schemas and response shapes are unchanged. Authenticated clients must include this header with the example requests above. Product lookup and M0 health/foundation endpoints remain public.

- `GET /v1/sessions` → strict `{ sessionIds: string[] }`, restricted to the current guest or independently verified same-email identities.
- `GET /v1/auth/identity` → `{ email: string | null }`.
- `POST /v1/auth/email/request`: strict `{ email }`, normalized lowercase; authenticated principal required. When configured, sends an owner-bound ten-minute one-time code and returns HTTP 202 `{ accepted: true }`. Code/credentials never appear in the response. Default disabled mode returns 503 `AUTH_UNAVAILABLE`; active duplicate issuance returns 429 `RATE_LIMITED`.
- `POST /v1/auth/email/verify`: strict `{ token: 64-character hex code }`, same requesting guest header; returns `{ email }`. Expired, reused, wrong-principal or incompatible-account codes return 400 `INVALID_TOKEN`.
- `POST /v1/sessions/:id/assets`: strict `{ requestId: UUID, type: portrait|hand|wrist, mimeType: image/png|image/jpeg, data: canonical base64 }`; authenticated ownership, max 4 MiB decoded/16 MP and 6 MiB route body limit. HTTP 201 returns shared `VisualAsset`: `{ id, sessionId, type, mimeType, byteLength, sha256 }`. Replaying identical input is idempotent; a conflicting upload ID returns 409 `ASSET_CONFLICT`. Invalid images/metadata return 400.
- `GET /v1/sessions/:id/assets/:assetId` → validated `VisualAsset`, owner-only. Unknown asset is 404 `ASSET_NOT_FOUND`.
- `GET /v1/sessions/:id/assets/:assetId/content` → verified PNG/JPEG bytes with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`, owner-only. No public object URL or VTO result is returned.

Infrastructure failures return normalized 503 `STORAGE_UNAVAILABLE` without connection details or secrets. Existing request-ID/version/CAS, confirmation, strict tools and catalog behavior remain. PostgreSQL mode persists data across API restarts; memory mode still expires it. See [PERSISTENCE.md](PERSISTENCE.md) for configuration, transactions, image orphan semantics and local validation. Comparison/VTO and other planned routes remain outside M5.

## M6 visual jobs and analysis

Every route below requires the M5 guest credential and session ownership. Shared strict Zod request/response contracts live in `packages/shared/src/visual.ts`; provider task IDs/credentials are never returned.

- POST `/v1/sessions/:id/vto`: `{ requestId: UUID, productId, assetId?: UUID }`. Unknown products fail. Missing/wrong image type returns 200 `{ type: "request_image", requiredType, message }` with no provider call. Valid input returns 202 `{ type: "job", job }`; new jobs are queued. Same request ID/payload replays; conflicting IDs return 409. Completed identical valid results may be reused under their original job ID.
- GET `/v1/sessions/:id/vto`: `{ jobs: VtoJob[] }`, owned normalized history, max 100, for reload recovery.
- GET `/v1/sessions/:id/vto/:jobId`: normalized job only; never starts/polls a provider task.
- POST `/v1/sessions/:id/vto/:jobId/advance`: empty body or `{}` only. Explicitly submits an already queued job or polls its existing task; submission claims are persisted before provider I/O. No caller-supplied provider arguments/results. One active job/session and minimum two seconds between polls; terminal results replay.
- POST `/v1/sessions/:id/visual-profile/analyze`: `{ assetId: UUID, kind: "face"|"color" }` → `{ profile, cached }`. Mock face analysis supplies no inferred shape; repeat matching hash/kind/mode/version uses the session cache. Unsupported live/color analysis returns normalized `ANALYSIS_UNAVAILABLE`.
- GET `/v1/sessions/:id/visual-profile`: `{ profiles }` from the owned validated cache; never triggers analysis.

A job includes id/sessionId/productId/assetId/category/mode/status/timestamps, nullable result and nullable error. Only completed jobs have results; only failed jobs have terminal errors. A mock result has `{ kind: "mock", message: "Mock try-on completed. No visual rendering was generated." }`; a real completed result has `{ kind: "image", url, expiresAt }`. Provider success without a validated output never becomes a completed image. Signed output links are short-lived and must not be logged.

Visual errors are `{ error: { code, message, recoverable: true } }`; technical failures include invalid/missing image, missing approved product asset, provider access/rate/timeout/invalid response, render failure and unavailable analysis. Transient poll failures retain the provider task for a safe subsequent check. Unknown submission outcomes are never automatically resubmitted. Existing deterministic shopping routes/version/relaxation semantics are unchanged. See [YouCam boundary](YOUCAM.md) for precise limitations and live activation prerequisites.

## M7 planning mode

`AgentResponse.mode` is now `mock | live`, identifying the configured shopping planner only. Catalog fixtures remain synthetic and VTO retains its separate mode/provenance. The default is mock. A live adapter never changes request, tool authorization, deterministic state or confirmation semantics. Planner failures return sanitized recoverable errors without provider response bodies or credentials. See `LLM.md` for explicit server configuration, deadline and global validation budget. M0 foundation/health remains a mock connectivity fixture, not an LLM readiness probe.

## M8 cross-product intelligence — 2026-10-04

POST `/v1/sessions/:id/compare` requires guest authentication/ownership and strict `{ productIds: [idA, idB] }`. Returns the shared Comparison schema with category, criteria and two items containing product, eligible, rejected, violations and evidence. IDs must be distinct and in the active category. Invalid bodies return 400; unknown products/invalid comparisons return normalized 422; unknown or foreign sessions return 404. This route is read-only and calls no LLM. Agent turns additionally support the strict dependency action and comparison UI; existing version/replay/confirmation contracts remain unchanged.
