# YouCam integration

Current source audit: October 24, 2026, Android v11. [Implementation coverage](IMPLEMENTATION_COVERAGE.md) separates implemented behavior from dated live acceptance. [Earlier integration history](archive/milestones/YOUCAM_IMPLEMENTATION_HISTORY.md) preserves provider-contract research and milestone results.

## Provider and catalog boundary

YouCam is called only by the server adapter in `apps/api/src/youcam/`. Mobile supplies owned session, product and asset identities, never a provider task ID or result URL. Mock mode is the development default. Live mode uses authenticated REST requests and durable usage reservations; model, catalog and decision-engine packages have no provider credentials.

| Category  | Required declared image | Provider operation suffix |
| --------- | ----------------------- | ------------------------- |
| Earrings  | Portrait                | `2d-vto/earring`          |
| Necklaces | Portrait with neckline  | `2d-vto/necklace`         |
| Rings     | Hand                    | `2d-vto/ring`             |
| Watches   | Wrist                   | `2d-vto/watch`            |

The catalog contains 72 synthetic products. The October 10 registration evidence records 12 eligible products: E01/E03/E12, N01/N03/N12, R01/R03/R08 and W03/W08/W11. Eligibility is a backend capability derived from approved private asset registration, not a promise that every fixture supports rendering. See [asset preparation](VTO_ASSET_PREPARATION.md) and [registration evidence](evidence/vto-uploads/judge-registration-2026-10-10.json). Image type is declared and bytes are validated; this does not establish anatomical suitability or physical fit.

Live face/color analysis is unsupported. The mock face analysis returns no inferred face shape. Four-category historical VTO validation does not validate optional analysis.

## Lifecycle and explicit consent

[API contracts](API_CONTRACTS.md) define the authenticated endpoints. Creating a job records a queued request; GET/list restores state without submitting or polling a provider. Android preserves request identity in its journal. Untouched queued jobs require **Start existing try-on**, with a render-consumption notice. Launch, refresh, navigation and foreground restoration must not first-submit them.

`advance` can submit a pristine queued job after persisting its submission claim. A known live provider task can be checked without creating a task. Missing task identity after an uncertain submission fails conservatively; the system must not infer permission to resubmit. Budget reservations and task claims protect against duplicate spending, but do not constitute a distributed exactly-once guarantee.

Android v10/v11 exposes **Check existing YouCam result** for live processing jobs and terminal `PROVIDER_TIMEOUT` failures. It sends one authenticated empty-body `reconcile` request, suppresses duplicate taps and pauses automatic work. An uncertain response permits at most one job-list GET; it does not automatically repeat the POST. Live processing recovery is explicit; automatic timer polling is limited to mock processing. See [controller](../apps/mobile/src/try-on-session.ts), [reconciliation service](../apps/api/src/youcam/reconcile.ts) and [recovery history](archive/recovery/YOUCAM_TASK_RECOVERY_FIX.md).

The server's reconciliation dependency exposes poll and output validation, not start or accounting. It verifies immutable session/product/portrait/task bindings and preserves recovery-audit metadata. Completed replay does not renew signed access. The server's advance endpoint itself does not attest a human tap: old or arbitrary authenticated clients remain outside Android's consent guarantee. A server-verifiable consent protocol is future work.

## Output validation and Android viewing

[Output validation](../apps/api/src/youcam/output.ts) requires HTTPS, trusted host, signed unexpired access, no redirects, bounded downloads, supported PNG/JPEG signature, full decoding and dimension/integrity limits. `image/png` and `image/jpeg` remain accepted; `binary/octet-stream` and `application/octet-stream` are accepted only after the same byte checks. The download ceiling is 8 MiB, image ceiling 16 MP, and multipage or malformed data is rejected. Untrusted content types and URLs remain rejected.

Android v11 isolates Original and result native image identities. Original uses owner-authenticated API bytes; signed provider results explicitly use empty headers, preventing guest-credential leakage and header reuse. Modal errors are scoped, closed images unmount, and foreground checks enforce expiration. See [viewer](../apps/mobile/src/try-on-viewer.tsx) and [v11 acceptance](archive/acceptance/ANDROID_PRIVATE_IMAGE_RELOAD_V11.md).

Completed jobs retain a validated signed URL and deadline. There is **no supported completed-result signed-access renewal endpoint**. GET and completed reconciliation replay do not extend expiration. A successful historical capture is not proof that the image remains accessible now; do not automatically rerender when access expires.

## Evidence and verification

- [Historical four-category Samsung acceptance](JUDGE_GUIDE.md#validated-youcam-evidence), distinct from mock fixtures.
- [Published final demo](https://youtube.com/shorts/8SNE4YJEOBI?feature=share): genuine completed E01 output, Original/result comparison and disclosed pickups. VTO is visual evidence, not guaranteed fit or exact jewelry fidelity.
- Isolated tests: `tests/youcam-output.test.ts`, `tests/youcam-recovery.test.ts`, `tests/youcam-recovery-postgres.test.ts`, `tests/queued-submission.test.ts`, `tests/youcam-ledger.test.ts`, `tests/mobile-task-recovery.test.ts` and mobile viewer tests.

No live operation is authorized by this reference. Preserve existing ledgers, uncertain reservations and historical jobs. Follow [production safeguards](PRODUCTION_READINESS.md) for operational boundaries.
