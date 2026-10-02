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

All session/product/visual endpoints above remain planned, not implemented. The foundation route intentionally makes no persistence or shopping claims.
