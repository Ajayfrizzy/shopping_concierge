# YouCam generic binary output validation

October 21, 2026. The completed existing E01 provider task returned HTTP 200 with `binary/octet-stream` and a fully decodable 300×375 PNG (188,817 bytes). Host and signed expiry passed; the declared MIME gate rejected the output. An isolated replay changing only the MIME header passed the old validator.

The minimal correction permits `binary/octet-stream` and `application/octet-stream` alongside `image/png` and `image/jpeg`. All accepted responses must have PNG/JPEG signatures and fully decode to the matching format. Explicit image MIME mismatches still fail. Returned audit MIME reflects verified bytes, not the generic header. URL allowlisting, signed-expiry checks, redirect refusal, 8 MiB size cap, 16 MP limit, animation rejection, full decode, download/decode timeouts, ownership and immutable bindings remain unchanged. No provider submission or ledger code changes.

Verification: full isolated integration-enabled suite **977 tests / 50 files passed, zero failed/skipped**. Ten added cases cover binary PNG/JPEG, correct image MIME, invalid/truncated/unsupported images, pixel/byte limits and inappropriate headers. Existing URL/signature/expiry/redirect, reconciliation, PostgreSQL and ledger tests pass. No paid providers were called during tests.

Deployment uses the existing main Git-push integration. No migrations, environment changes, budget resets or production reconciliation are included. Rollback must preserve the recovery-audit parser and queued-job safeguards; the immediate previous main `69b7119` is schema-compatible but still rejects generic MIME. Android v10 needs no update.

Production baseline observed read-only before deployment: OpenAI 25 requests / USD 0.33519680, YouCam 12 committed renders. Existing historical failed job and current processing job, task and portrait remain intact. Deployment identity requires operator dashboard confirmation; healthy endpoints alone do not identify the active revision. Output availability must be rechecked using authenticated status lookup for the same task, never an invented URL lifetime.
