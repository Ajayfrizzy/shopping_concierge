# Production operation and readiness

Current documentation audit: October 24, 2026. Android v11 is the public beta; the [official demo](https://youtube.com/shorts/8SNE4YJEOBI?feature=share) is complete. This reference describes implemented safeguards, not a fresh production acceptance or authorization to operate providers. [Historical readiness reports](archive/acceptance/PRODUCTION_READINESS_HISTORY.md) retain the earlier investigations and test observations.

## Deployment and identity

The existing GitHub-to-RumptyCloud application hosts the API with managed PostgreSQL and private S3-compatible storage. See [infrastructure](INFRASTRUCTURE.md), [API startup](../apps/api/README.md) and [persistence](PERSISTENCE.md). Builds do not migrate, seed, reset budgets or provision resources automatically. A main push may trigger deployment; a documentation review branch is not deployment authorization.

`GET /health` is liveness. `GET /ready` reports allowlisted configured modes and dependency readiness, including PostgreSQL/S3 where configured; it makes no paid provider request. HTTP 200 does not identify the active Git revision or certify provider credits. Verify revision/status through the existing deployment dashboard. October 24 release checks recorded healthy endpoints; this audit did not repeat production checks. No exact current deployed SHA is asserted here.

Recovery-audit JSONB remains readable by the current strict parser. Never roll back to an incompatible parser or to code lacking queued-job safeguards. Preserve job history, reservations and immutable bindings. Migrations 001–007 are checked in; follow the migration runner's checksum tracking, never reinitialize production to bypass errors.

## Accounting and provider configuration

`apps/api/src/accounting/config.ts`, `apps/api/src/accounting/postgres.ts` and `apps/api/src/youcam/ledger-config.ts` own runtime accounting. Production live OpenAI requires PostgreSQL accounting and persisted budget approval; production live YouCam requires its PostgreSQL judge scope. Validation and judge ledgers are separate. Default judge ceilings (200 OpenAI requests / USD3; 50 YouCam requests/units) are configuration defaults, **not current balances or permission to spend**. Environment and persisted ceilings must agree; do not reset or silently increase either.

Reserve before external work. Successful acknowledged YouCam submissions commit a reservation; that does not prove a valid image was returned. Failed or uncertain operations do not automatically refund or retry. OpenAI settlement uses recorded usage; uncertainty retains the hold. Durable diagnostics and private receipt storage support review without exposing secrets. `OPENAI_MAX_ATTEMPTS=1` was operator-confirmed in historical acceptance, not remotely proven by readiness.

The final recording brief recorded 28 OpenAI requests / USD0.35196920 and 12 committed YouCam renders. These are historical recording figures, not a newly queried balance. Fresh authorization and read-only preflight are required before new paid work.

## Authentication, storage and recovery

Guest credentials remain on the device; session ownership is enforced server-side. Optional email verification is implemented but disabled without configuration and has no accepted live email/mobile-login flow. PostgreSQL persists structured state and replay identity. Private portrait bytes are served through owner-authenticated API routes. S3 credentials and provider keys stay server-side.

S3 runtime policy needs private read/write access. Historical write-probe preflight uses explicit PUT/GET and manual probe cleanup, not a paid provider call; it is not a read-only action and is not authorized merely by this document. Backend DeleteObject is neither required nor advertised.

[YouCam lifecycle](YOUCAM.md) distinguishes read-only restoration, explicit first submission and poll-only recovery. Android v11 preserves v7 photo recovery, v8 timeout recovery, v9 queued consent and v10 processing recovery. Client consent does not prevent an older authenticated caller from invoking `advance`. Completed output access expires and has no supported renewal endpoint. Preserve `recovery` audit metadata on rollback.

## Validation and unresolved limits

Accepted v11 source recorded **983 integration-enabled tests in 51 files, zero skipped, on October 21, 2026**. The October 22 default run recorded 927 passing tests and 56 integration skips when Docker was stopped, plus 22 Python recording tests. These counts describe those runs, not fresh validation during this audit. See [coverage](IMPLEMENTATION_COVERAGE.md) for source/test/evidence mapping.

The October 24 GitHub report listed five dependency vulnerabilities (two high, three moderate); this documentation task does not remediate or freshly rescan them. Earlier [dependency assessment](evidence/publication-review/dependency-assessment.md) covers a different dated inventory. No blanket security-clearance claim is justified.

Synthetic products, sample stock/prices, no merchant checkout, bounded language interpretation, session-scoped feedback, and expiring VTO output remain beta limitations. The Devpost rules could not be independently retrieved on October 24 (HTTP403); the owner must verify the event requirements and submission declarations in [submission preparation](FINAL_DEVPOST_SUBMISSION.md).
