> Scope note — 2026-10-19: retain this reference for its technical decisions and dated implementation history. Earlier pending gates, deployment failures, test counts and budget figures are historical observations, not live status or balances. Current release/acceptance: [code 6, 836 tests](FINAL_PRODUCTION_ACCEPTANCE.md). Future recording: [final demo plan](FINAL_DEMO_PLAN.md), still not executed.

# Hackathon deployment infrastructure

Decision date: 2026-10-02. This is the intended hackathon/demo deployment, not a permanent production-cloud commitment. M4 is complete. M5 now implements local memory/PostgreSQL repositories, S3-compatible storage and guest ownership; see [PERSISTENCE.md](PERSISTENCE.md). Runtime AI services remain mocked. No cloud deployment or resources have been created by this decision.

| Concern        | Intended hackathon infrastructure         | Portability boundary                                                                                    |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Backend/API    | RumptyCloud managed app deployment        | Existing Node.js/Fastify API; deployment settings and environment configuration outside core packages   |
| Database       | RumptyCloud Managed PostgreSQL            | Standard PostgreSQL-compatible access and migrations behind server-side repository adapters             |
| Object storage | RumptyCloud S3-compatible storage         | S3-compatible operations behind a server-side object-storage adapter; configurable endpoint and bucket  |
| Mobile client  | Expo / React Native                       | API URL configuration; no direct database access or embedded infrastructure credentials                 |
| External AI    | YouCam APIs and the selected LLM provider | Server-side provider adapters returning shared normalized results; mocks remain the development default |

## Adapter and configuration boundaries

The API composes repositories, object storage and external-provider adapters. Infrastructure credentials, connection creation and deployment-specific settings belong in that server-side composition/configuration layer. The decision engine, catalog, agent and shared domain packages must not import RumptyCloud SDKs, read cloud configuration, or depend on its resource names, endpoints or deployment lifecycle. Existing deterministic decisions, catalog filtering/ranking, strict tools and explicit relaxation confirmation remain unchanged.

Database adapters use standard PostgreSQL-compatible queries, transactions and migrations. Preserve session version checks, atomic state/event writes and idempotency when persistent storage is implemented. Do not require proprietary database APIs for domain operations. JSONB remains acceptable for the documented structured state.

Object-storage adapters use S3-compatible operations with configurable endpoint, bucket, region/signing and addressing settings as required by the actual service. Do not assume AWS-only or unverified RumptyCloud features. Keep object keys and metadata independent of provider hostnames; resolve access URLs through the adapter. Upload authorization and any short-lived access URLs are issued by the API; never expose permanent storage credentials to mobile.

Provider migration should change adapters, connection configuration and deployment setup, not core domain or agent logic. This does not promise automatic data migration: transferring existing PostgreSQL data and stored objects remains an explicit operational task.

## Secrets and deployment configuration

Secrets remain server-side and environment-driven: database connection credentials, object-storage credentials, YouCam credentials and LLM credentials. Later implementation must validate configuration at API startup and avoid logging secrets. Mobile receives only public client configuration such as the API URL, never infrastructure or AI-provider secrets.

M5 environment variable names and local validation commands are documented in `.env.example` and [PERSISTENCE.md](PERSISTENCE.md). Actual deployment endpoints, TLS/signing settings and service connectivity still require verification in an authorized deployment milestone. This decision does not invent credentials, provision resources, or assert that connectivity has been verified. The original infrastructure decision was documentation-only; M5 subsequently implemented portable adapters and secure guest credentials without deploying them to RumptyCloud.

## M5 implications and execution gate

This decision supersedes the earlier Supabase-specific persistence/auth/storage assumption. M5 retains its existing scope: schema/migrations, guest sessions first, optional email auth, image storage and repository adapters. Acceptance still requires persisted sessions/products/feedback, authorization checks and no secrets in the mobile bundle. Authentication is a separate server-side concern; neither managed PostgreSQL nor S3 storage implies a hosted identity service. M5 implements optional owner-bound email proof through an EmailSender/SMTP adapter, disabled by default, with no RumptyCloud or Supabase identity-provider assumption.

Do not deploy or create cloud resources based on this documentation decision. Those actions require a later milestone that explicitly calls for them. Continue local/mock validation and consume no live YouCam or LLM credits for persistence work. M6 remains gated on full M5 validation.
