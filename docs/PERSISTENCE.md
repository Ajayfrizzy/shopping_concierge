# M5 persistence and guest access

The API supports explicit `memory` and `postgres` modes. Both use the same deterministic agent, decision engine and catalog. Local development defaults to credential-free memory repositories/object storage; durable mode uses standard PostgreSQL and S3-compatible adapters. RumptyCloud remains the intended demo hosting choice, not an implementation dependency. No cloud resources or live AI services are required for these checks.

## Run the local durable stack

Docker Desktop must be running. From the repository root:

```sh
npm run infra:local
npm run db:local
npm run dev:persistent
```

`infra/compose.local.yml` runs PostgreSQL 17 and Adobe S3Mock 4.11.0 on loopback ports 15432/19000 with named volumes. Health checks wait for the database and test bucket. S3Mock exercises S3 HTTP operations and disk retention, not a production cloud IAM implementation. The explicit local environment file contains public test credentials; never use those for deployment. `db:local` applies the checksum-tracked SQL migration and inserts the 72 synthetic fixture products only when their IDs are absent. It never overwrites existing catalog facts. Ordinary API startup does not migrate, seed or create buckets/resources.

Keep the local API process running, connect the rebuilt mobile development app with the README USB setup, and use the usual mock shopping grammar. AI mode remains mock regardless of storage mode. The M5 SecureStore/Crypto dependencies require rebuilding the app with `npm run android:build`; Metro reload alone is insufficient.

```sh
M5_INTEGRATION=1 npm run check
npm run verify:mobile-secrets
```

The full command includes the existing regression suite plus real PostgreSQL/S3 protocol tests. `npm run test:integration` runs just the isolated persistence integration suite. Integration tests use a uniquely named schema in the fixed loopback test database and drop only that schema afterward. S3 image fixtures remain in the local test bucket; no live service credentials are read. Ordinary `npm test` skips the explicit integration suite when `M5_INTEGRATION` is unset; that alone does not validate durable mode.

To stop local services without deleting their data:

```sh
docker compose -f infra/compose.local.yml stop
```

## Configuration and ownership

`.env.example` documents server-only variables. `PERSISTENCE_MODE=postgres` requires `OBJECT_STORAGE_MODE=s3`, `DATABASE_URL`, S3 endpoint/region/bucket/access credentials and explicit addressing configuration when needed. PostgreSQL connection/TLS settings use the standard connection URL; the adapter does not disable certificate verification. S3 endpoint, region, bucket and path-style behavior are configurable. Create/migrate actual deployment resources only when an authorized deployment milestone requires them; local validation does not assert RumptyCloud connectivity.

Mobile creates 32 cryptographically random bytes once, stores the 64-character hex credential in Expo SecureStore, and sends it as `Authorization: Bearer <credential>`. It is a runtime user credential, not an embedded infrastructure secret. A failed or corrupt SecureStore read never silently replaces it. The API derives a SHA-256 principal ID; raw credentials are not persisted in PostgreSQL or the session journal. Default HTTP logging redacts Authorization. Session IDs alone never grant access. Catalog facts and the M0 health/foundation routes remain public; session/list/action/confirmation/image routes require the guest credential.

Clearing app storage or losing the credential can lose guest access. Guest access is possession-based; there is no recovery promise without optional verified email. Existing pre-M5 in-memory records had no durable identity and are not silently claimed using their IDs. Their old local reference yields an unavailable-session message and requires deliberate new-session confirmation. Starting a new shopping session retains the device's identity but replaces its current session reference, not other database records.

## Transaction and replay semantics

The API owns the repository adapter. The portable agent executor restores a validated internal snapshot and executes exactly the M3 tools. No restoration/snapshot endpoint is exposed to clients or models. PostgreSQL locks the authorized session row while a bounded mock turn executes, then commits the new snapshot/version, bounded recent history, last 50 successful replay requests, product feedback, saved relationships and events in one transaction. Any failed write rolls back all of them. Distinct competing turns get a stale-version response; identical request IDs/payloads replay the committed result even after process restart. Pending relaxation IDs remain valid across restart until another successful turn supersedes them. No inferred or unconfirmed relaxation is applied by persistence.

Catalog records load from PostgreSQL into the unchanged deterministic catalog service for each turn. Product facts never come from the model or client. SQL uses parameterized queries; the domain, agent and catalog have no PostgreSQL, S3 or RumptyCloud imports. JSONB stores validated structured snapshots alongside explicit ownership and relational feedback/save/event projections. Migrations and fixture seeding are explicit commands, not implicit application writes.

Row locks cover the mock planner deadline; this favors correct small-demo transactions over high-throughput scheduling. API repository failures are normalized and retryable; idle PostgreSQL disconnects are handled so the pool can reconnect. Replay retention remains 50 successful requests, as in M3.

## Optional verified email

Guest shopping requires no email. Optional API email access uses an injected `EmailSender`; SMTP delivery is enabled only with `EMAIL_AUTH_ENABLED=true`, `SMTP_URL` and `EMAIL_FROM`. No SMTP or live email was used in M5 validation; tests capture delivery in an in-process outbox.

Request a code from the authenticated installation, then submit the delivered code with the same guest credential. Codes contain 32 random bytes; only hashes are stored, expire after ten minutes, are single-use and bound to the requesting principal. Active issuance is limited to one code per email/principal for that expiry window. Email text alone never grants access. Verified installations for the same normalized email may access that account's sessions; list/read still enforce ownership. Verification does not merge or reinterpret shopping state. A verified installation cannot change to a different email through this flow.

The optional email feature is API-only in M5; a dedicated account-management UI, revocation and production email operations are not claimed. A delivery failure is reported honestly; the pending challenge remains until expiry to bound repeated sends. Optional email configuration is disabled by default and is separate from the hosting provider.

## Private image storage

M5 supplies authenticated upload/metadata/content APIs, not image capture UI or VTO. Uploads accept portrait/hand/wrist metadata and canonical base64 PNG/JPEG up to 4 MiB and 16 megapixels. The API decodes the image before storing it, checking MIME and pixel bounds. This validates file content, not whether it depicts the required anatomy; M6 owns operation-specific image checks and provider calls.

Object keys include session ID, upload ID and content hash, not provider hostnames. The S3 adapter uploads bytes before the repository commits metadata. Upload IDs are idempotent; conflicting content/type cannot replace an existing reference. Downloads require session ownership and verify byte length/hash before returning private/no-store content. No public bucket URL, object key or permanent storage credential is returned. S3 adapters do not create buckets or set public ACLs.

PostgreSQL and S3 cannot share an ACID transaction. An upload followed by a failed/uncertain metadata commit can leave an unreferenced private object; retry is safe and does not invent success. No automatic deletion runs after an uncertain commit, because another successful retry may reference those bytes. Orphan reconciliation and retention/deletion policy remain operational follow-up; M5 does not claim distributed atomicity or implement VTO jobs/visual analysis.

## Database-only TLS configuration

The PostgreSQL URL normally controls TLS verification (use `sslmode=verify-full` for a trusted provider). For the hackathon provider's user-approved self-signed connection, use `sslmode=require` together with server-only `DATABASE_SSL_REJECT_UNAUTHORIZED=false`. This preserves encrypted transport but skips server certificate verification **only for PostgreSQL**. It never changes global Node TLS, S3 or external AI HTTPS settings. Avoid this exception for providers supporting trusted certificates.

The override accepts only `true`/`false`, requires `sslmode=require`, and cannot be combined with URL `ssl`, `sslcert`, `sslkey`, `sslrootcert` or `uselibpqcompat`. The adapter converts it to an explicit driver SSL object so URL parsing cannot silently override the choice. Both API pools and migration CLI use it. To return to full verification, omit the override and configure the trusted provider's verified connection URL, or set the override to `true` with `sslmode=require`. Local credential-free PostgreSQL integration settings remain unchanged.

## Approved VTO asset prefix

`S3_ASSET_PREFIX` optionally supplies a relative project prefix ending in `/` for `createS3ObjectStore(...).listAssets(group)`. Supported groups are the four `vto-products/` categories and portrait/hand/wrist `vto-inputs/` groups. Discovery returns exact bucket keys and propagates denied access; it never treats a permission failure as an empty group. Stored uploads and direct get/put keys are not automatically prefixed. Configure project-scoped ListBucket/GetObject permissions privately; never embed generated provider project paths in domain or application code.
