> Historical record, archived 2026-10-19. Test counts, deployment failures, pending gates and budgets below describe their original observation dates, not current status. See [final acceptance](../acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the code-6 / 836-test baseline and dated budget snapshot. Original findings are retained; later acceptance does not erase earlier failures.

## Hackathon S3 capability policy — 2026-10-16

Backend S3 permissions require private read/write access, not DeleteObject. Receipt preflight must PUT a unique probe and GET identical bytes; it must not attempt backend deletion. Probe cleanup is manual through RumptyCloud. Durable receipts and VTO assets stay private. Backend/API file deletion is neither supported nor advertised. A denied DeleteObject is not a judge/runtime blocker. Keep deployed `OPENAI_MAX_ATTEMPTS=1`; this remains an operator-confirmed setting, not a field inferred from `/ready`.

# S3 readiness investigation — 2026-10-16

Production is blocked by S3 access denial. No Flow A, OpenAI or YouCam request was submitted. No budgets, reservations or VTO registrations were modified.

## Evidence and limits

Sanitized observations are in [probe.json](../../evidence/s3-readiness-2026-10-16/probe.json). Direct S3 probes use backend credentials from the local API environment with documented production storage modes. The deployed environment cannot be independently introspected here; its public readiness independently reports only object storage unavailable. Do not mistake local credential inspection for proof of identical remote credential values.

DNS resolves and certificate-verified TLS 1.3 connects. Authenticated HeadBucket returns HTTP 403; receipt-prefix listing and probe PUT return HTTP 403 `AccessDenied`. No timeout occurred on these failures and they were nonretryable, one SDK attempt each. GET cannot verify bytes because PUT was denied. Cleanup attempts DELETE only for the uniquely generated probe key, never existing receipts/assets.

Seven rounds of fresh and reused clients received 403, starting 01:19:48 UTC. Rounds are separated by at least 30 seconds. Public readiness returned 503 with only storage unavailable in the first six rounds; round seven timed out. Round eight ended at 01:29:26 UTC with a reused-client abort, fresh-client ENOTFOUND and public readiness timeout. Cleanup also failed ENOTFOUND. PUT had returned 403 and no successful creation was observed, but deletion/absence cannot be confirmed. Thus access denial was persistent during the first seven S3 rounds, followed by a separate unresolved network failure; the entire window cannot be classified as purely deterministic. Some elapsed abort durations exceeded configured deadlines (88 seconds); host scheduling/event-loop suspension versus network cause was not established. JavaScript timers cannot enforce wall-clock deadlines while the host/event loop is suspended. It does not identify the underlying policy change: disabled/revoked credentials, bucket policy/ownership, project access or storage service restrictions require operator inspection. The original 02:17:08 WAT failure had no detailed S3 error attached; current probes corroborate the failing dependency, not its exact original service-side event.

HTTPS and configured region are present, `S3_FORCE_PATH_STYLE=true`, and a request middleware verifies the endpoint hostname and bucket path before sending. No virtual-host fallback or credential transmission to another host was attempted. HeadBucket omits a useful error code; object operations supply `AccessDenied` and request IDs. One PUT correlation ID for RumptyCloud support is `tx00000f8e093a4dc7bee1d-006ad17bb0-41899361-rumpty-object`.

Final public recheck after the network failures: `/health` HTTP 200; `/ready` HTTP 503 with only objectStorage unavailable. Recovery is not established.

## Hardening prepared, not deployed

The existing S3 client is reused. The installed Smithy handler treats requestTimeout as warning-only unless throwOnRequestTimeout is enabled. The adapter now enables it, retaining 5-second connection and 10-second request limits, adding a 10-second socket limit, and bounding keepalive agents to 8 sockets/2 free sockets with a 30-second idle timeout. S3 maxAttempts stays 2; this does not change OpenAI attempts.

Readiness remains read-only HeadBucket. A shared in-flight promise prevents concurrent duplicate probes; an AbortController cancels at 12 seconds, including retries. Completion/failure clears the pending promise and timer so later checks can recover. This is resilience hardening, **not a fix for HTTP 403**. Deploy it separately after review; restore storage access through RumptyCloud first. No environment/provider settings were changed.

## Operator action and retry gate

Check the intended bucket/project, key enabled state, bucket ownership/policy and permissions using RumptyCloud storage administration. The backend requires bucket HEAD/list access and object GET/PUT on its intended private prefixes, including accounting receipts. Do not make the bucket public. Correct credentials/configuration only if inspection identifies a mismatch; environment changes require a backend restart/redeployment. If configuration and policy are correct, give RumptyCloud support the sanitized request ID and UTC probe window.

Before any separately authorized Flow A: authenticated HeadBucket/list and dedicated receipt PUT/GET with matching bytes must pass; deployed /health and /ready must pass ten consecutive checks over several minutes with every dependency ready; PostgreSQL diagnostics must remain accessible; no pending reconciliation may exist; historical reservations/budgets must remain intact; verify deployed OPENAI_MAX_ATTEMPTS=1. A single later successful HEAD is insufficient. No provider call is authorized by running this diagnostic script.

## Reproduce locally

```sh
S3_EVIDENCE_PATH=docs/evidence/s3-readiness-2026-10-16/probe.json \
node --env-file=apps/api/.env --import tsx scripts/s3-diagnostics.ts
```

The script creates only a unique access-check object in the existing receipt prefix, leaves cleanup to the RumptyCloud platform, and emits allowlisted diagnostics without endpoints, credentials, signed URLs or object listings. Preserve earlier evidence before rerunning.

## Validation

653 tests passed in 32 files, including local PostgreSQL/S3 integration and three new S3 readiness regressions: bounded transport settings, stalled-probe abort/concurrency/recovery, and permission-failure recovery with read-only readiness. Lint, API/mobile typechecks, API build and the seven-sentinel mobile secret scan passed. The scan exports Android JavaScript/assets; no APK was built. No production deployment occurred.
