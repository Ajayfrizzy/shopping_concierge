# API

Fastify entry points: `src/app.ts` (injectable app factory) and `src/server.ts` (listener). Run `npm run dev:api` from the root. The root `.env` is optional. M0 supports only mock services and fails closed if live mode is requested.

`GET /health` is a credential-free liveness check. `POST /v1/foundation/messages` validates input and returns an explicit preview response; it does not claim to create shopping state. Both routes have integration tests using Fastify injection.
