# Validation log

## 2026-10-04 — Live YouCam infrastructure recheck: partially unblocked

**Live gate remains OPEN.** Backend credential presence was confirmed without displaying values. User authorizes at most **8 live rendering submissions: four initial categories plus up to four targeted retries**. No broader reruns or additional OpenAI usage are authorized. No live YouCam request was made during this attempt.

- PostgreSQL hostname resolves and the TLS server is reachable, but verified connection fails with `DEPTH_ZERO_SELF_SIGNED_CERT`. No query succeeded. Obtain the database provider's trusted CA certificate and configure trust server-side; TLS verification was not disabled.
- S3 initially failed with `ENOTFOUND` in virtual-host mode. A path-style HEAD succeeded; changed only `S3_FORCE_PATH_STYLE=true` in the ignored backend environment. Bucket access and private PUT/GET round trip then passed with standard S3 SDK commands. No bucket policy/ACL change was made, and anonymous accessibility was not tested.
- The small synthetic probe under `validation/youcam-preflight/` could not be deleted by the original exact-key cleanup. A proposed prefix/size cleanup was rejected by automatic approval review because it could delete unrelated data; that command did not execute. The remaining probe contains only a generic connectivity-test sentence, no credentials or personal image. Owner cleanup may be required.
- Approved portrait/neckline, hand/wrist input locations and four corresponding product assets remain unspecified. Credentials/infrastructure do not supply these assets. The source catalog still has no approved VTO assets. Requested their locations and the trusted CA path.
- Provider upload/output allowlists remain unconfigured. Existing live adapter also fixes its API origin rather than consuming `YOUCAM_BASE_URL`; validate the documented origin and implement configuration/strict host checks before live submission. Temporary private asset URLs and cumulative durable usage reservations still require implementation/validation before any paid render. Do not interpret successful storage access as completion of those items.
- Optional analysis remains disabled; all four required rendering/device checks remain unrun. **Usage: 0 YouCam requests/units, 0 OpenAI requests.** No live mode was enabled and no application service was restarted into live mode. M9 has not started.

No integration code was changed; only ignored S3 configuration and this validation record changed. Full automated validation must run after the subsequent integration fixes. Previous test counts are not new evidence for this blocked live gate.

## 2026-10-04 — Deferred live YouCam gate: preflight blocked

**Gate remains OPEN; no live rendering has been validated. M9 has not started.** The user authorized a minimal first pass of one known-good render each for earrings, necklace, ring and watch, with actual Samsung output review. Preflight inspected the existing server adapter, provider selection, smoke runner and asset configuration without making provider requests.

- The ignored `apps/api/.env` has no configured `YOUCAM_API_KEY`, `YOUCAM_UPLOAD_HOSTS` or `YOUCAM_ASSET_HOSTS`. Presence was checked without printing values. No key was placed in logs, mobile code, evidence or documentation.
- All 72 source catalog fixtures still have null `vtoAssetUrl`; no approved live product-asset set or corresponding portrait/neckline, hand and wrist input paths are configured. Original catalog illustrations are not automatically approved VTO inputs.
- Existing environment-driven mock/live adapter selection remains intact; no provider flags or runtime configuration were changed. Optional live face/color analysis remains disabled and does not currently drive recommendations. Its account entitlement/useful feature contract is still unresolved, so this attempt does not silently close the optional-analysis scope item.
- **Usage for this attempt: 0 live YouCam requests, 0 units consumed, 0 live OpenAI requests.** Account balance, category entitlement and documented per-render charges remain unknown. No upload, task submission, polling or Samsung live result was attempted; HTTP success and mock completion are not counted as rendering evidence.

Resume prerequisites: configure credentials only in the ignored backend environment; supply verified host allowlists and approved corresponding product/input assets; establish the account's documented unit costs and approved ceiling. Before submitting, add durable request/unit reservations for the four initial renders and bounded polling, counting uncertain submissions conservatively. The existing one-render smoke runner is bounded per invocation but is **not** a cumulative account-use guard. Never rerun uncertain paid submissions automatically; correct and rerun only an affected category within approval, and ask before a broad rerun.

No integration or native code was changed during this blocked preflight. Documentation formatting was checked; the previous 433-test result remains historical and was not rerun as a new live validation result. Once prerequisites are available, complete upload/task/poll/render/mobile visual review, persistence and recovery checks, record real usage/evidence, and restore mock runtime before closing the gate. The blocker is missing external configuration/assets, not an additional approval requirement inferred from a skill.

## 2026-10-04 — Catalog-image stabilization complete (before M9)

**Complete and physically verified. M9 has not started.** All 72 products now have bundled category-appropriate demo illustrations, with original SVG sources and 512×512 PNGs under the repository MIT license. No retailer imagery, third-party downloads or AI generation credits were used. [Asset strategy and implementation](CATALOG_IMAGES.md); [device results](evidence/catalog-images/results.json).

### Implementation and discovered fix

- Kept the Product schema unchanged. Replaced fixture `.invalid` URLs with `catalog://demo/ID.png` logical identifiers and a static Metro manifest. Migration 003 repairs only the exact original persisted fixture URLs, preserving all other facts and custom image sources. Legacy response identifiers also resolve locally.
- Added one image component for regular/anchor product cards, comparisons, and selected/saved/shortlisted/rejected summary thumbnails. Fixed square frames, `contain`, loading indicator, missing-source fallback, failure message and manual Retry. Summary thumbnails reserve 112×112 logical pixels even during lookup/failure.
- **Physical screenshot review caught an intrinsic-size bug:** absolute-fill positioning alone did not override bundled image dimensions, so cards cropped the artwork and thumbnails showed a blank corner. Explicit 100% width/height fixed it. Added rendered-component regression coverage; final `*-fixed.png` evidence shows full illustrations. Early screenshots are retained as pre-fix evidence, not passing sizing evidence.
- No ranking, constraints, decision transitions, feedback learning, comparison semantics or VTO result rendering changed. Catalog art is labeled “Demo illustration”; it is not a product photo or YouCam result. All VTO product assets remain null. No native/config dependencies changed, so the installed SDK57 development binary was reused.

### Automated and device validation

| Check                                | Result                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `M5_INTEGRATION=1 npm run check`     | Lint, backend/mobile typechecks, **433 passing tests in 15 files**, zero skips. Includes all M0–M8 regressions, 72 PNG decode/dimension checks, resolver/lifecycle coverage, native image-prop regression and PostgreSQL migration preservation/idempotency.                                                                                                             |
| `npm run verify:mobile-secrets`      | Android export passed; **94 output files**, no matches for seven server credential sentinels. Expo emitted an exit-cleanup warning on one export but the bundle and scan completed successfully.                                                                                                                                                                         |
| `npm run db:local`                   | Existing local database migration applied; all 72 stored image URLs resolve to catalog assets. Local containers were restarted after initial database-unavailable failure.                                                                                                                                                                                               |
| `npm run format:check`               | Passed.                                                                                                                                                                                                                                                                                                                                                                  |
| Physical Samsung SM-S908N, Android16 | Images loaded for all four categories; regular and E18-anchored results, N01/N02 comparison, and saved/shortlisted summary checked. Corrected full-size and thumbnail presentation reviewed visually.                                                                                                                                                                    |
| Failure/missing/recovery             | Temporarily changed only N02's local image URL to a failing loopback HTTPS source and N01's to an unknown logical asset. Explicit fallback and tappable Retry displayed in reserved frames. Both original URLs restored; no catalog faults remain.                                                                                                                       |
| Cold launch                          | Force-stop/reopen restored image results and identical full domain state; transport version **38 → 39**. Guest access, saved/shortlisted choices and anchor dependency remain.                                                                                                                                                                                           |
| Scrolling/runtime                    | Stable image frames across load/failure; repeated scrolling stayed responsive. Final short Android sample: 321 frames, 1 modern janky frame (0.31%), 47 legacy janky frames (14.64%), zero missed vsync, p95 10ms/p99 11ms. This is a development-device sample, not a production performance guarantee. Final app-PID ReactNativeJS/AndroidRuntime error scan is empty. |

[Evidence](evidence/catalog-images/results.json) includes corrected cards/comparison/thumbnails/cold launch, fallback screenshots, before/after session snapshots and the scroll/runtime logs. OS status-bar activity is redacted.

**Zero live OpenAI or YouCam calls and zero additional spend.** Explicit mock flags used throughout. M7's ledger remains 29 requests / approximately $0.1106142. **Deferred real YouCam rendering/analysis remains OPEN before final submission**; these catalog illustrations do not satisfy that gate. Stop before M9.

## 2026-10-04 — M8 complete: cross-product decision intelligence

**M8 is complete and validated in mock mode. M9 has not started.** Selected catalog anchors, deterministic complement ranking, relevant rejection propagation and criteria-grounded comparisons are implemented across strict shared contracts, engine/catalog, agent/API and mobile. See [decision intelligence](DECISION_INTELLIGENCE.md) for exact supported behavior and [device results](evidence/m8/results.json) for evidence.

### Changes and regression fix

- Explicit selected E18 → necklaces dependencies persist in existing session JSON. Other category constraints/decisions remain authoritative. Same-target replacement is explicit and idempotent; rejecting an anchor removes its links.
- Hard filters run before complement heuristics; explicit preferences outrank feedback and heuristics. Cross-category feedback travels only through selected-anchor links and actual relevant attributes. No price/size/shape dislike is inferred across categories.
- Strict two-product comparison returns actual facts, active scoped criteria, eligibility/violations and evidence. Unknown or cross-category IDs fail honestly. The owned comparison endpoint is read-only; the planner cannot alter requested IDs or bypass confirmation.
- Mobile adds two-card comparison controls, comparison display and summary anchor actions. Comparison drafts reset when category/session changes. Existing keyboard, upload MIME, navigation, credential and persistence implementations remain intact; no native dependency/config change or rebuild was needed.
- Physical testing caught `wrong_style` propagating the shared tag `small` from E02 to N01. Excluded physical size/shape tags from cross-category style evidence and added a regression. Device retest retains E02's delicate/elegant/romantic evidence on N02 while removing N01's size-only penalty. `feedback.png` is pre-fix evidence; `feedback-fixed.png` and `feedback-relevant.png` show the correction.

### Validation

| Check                                                 | Result                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M5_INTEGRATION=1 npm run check`                      | Lint, root/mobile typechecks, **345 tests in 13 files**, zero skips/failures. Includes local PostgreSQL/S3 integration and all M0–M7 regressions.                                                                                                                |
| `npm run verify:mobile-secrets`                       | Android export passes; 29 output files contain none of seven server credential sentinels.                                                                                                                                                                        |
| Formatting                                            | `npm run format:check` passes.                                                                                                                                                                                                                                   |
| Samsung SM-S908N / Android 16 / SDK57 development app | Selected E18 anchors necklaces under USD100; scoped silver/wedding constraints and prior saved E02 remain. Card comparison N01/N02 shows USD50/USD80 and current criteria. Summary coordinate action returns to chat.                                            |
| Error and recovery                                    | Unknown comparison ID shows honest catalog error. Stopped local mock API produces connection error; restarting it and refreshing restores results and dependency.                                                                                                |
| Persistence and reload                                | Real native menu Reload and force-stop/cold launch pass. Domain state exactly matches pre-reload snapshot; transport versions 21 → 22 (cold) → 23 (reload). Comparison itself is read-only; startup restores shopping results, not a transient comparison panel. |
| Keyboard and runtime                                  | Composer/Send remain visible and tappable while keyboard is open; chat scroll/send and closed position pass. Final app-PID ReactNativeJS/AndroidRuntime error scan is empty.                                                                                     |

Physical evidence is in [M8 evidence](evidence/m8/): screenshots of comparison criteria/cards, summary, keyboard, failures/recovery, native menu, reload/cold launch, corrected feedback, plus sanitized persisted session snapshots. Unrelated OS status-bar activity is redacted. An accidental development inspector toggle was disabled before final verification; an unconfirmed early Reload attempt is not counted.

### Credits and remaining external gate

M8 made **zero live OpenAI requests and zero live YouCam calls**, with zero additional spend. Explicit mock flags were used for every local API restart. M7's unchanged ledger remains **29 requests**, **74,655 input tokens** (**44,911 cached**), **3,512 output tokens**, estimated **$0.1106142**. The remaining M7 request allowance was not used. M8 tool/prompt additions have deterministic mock/schema coverage; they are not a new live-LLM quality claim.

**Deferred live-YouCam rendering/analysis remains OPEN and required before final submission**, pending account access, credits and approved assets. Mock completion is not proof of live rendering. No resources were deployed; PostgreSQL/S3 adapters and server-only secrets remain portable. Stop before M9.

## 2026-10-04 — M7 complete after approved extension and device verification

**M7 is complete for the specified bounded live-LLM scope. M8 has not started.** User approved five additional requests (30 cumulative maximum), retaining the original ledger and $1 total ceiling. Updated the hard guard and exhaustion tests to refuse request 31; the ledger was never reset. Model remained `gpt-5.6-terra`, Responses API, low reasoning. No live YouCam calls.

The extension used **four requests**, all for the authorized remaining checks:

| Request | Case                                                                       | Result                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 26      | Mobile recovery refresh from the previous rejected budget turn             | Passed; existing authoritative session recovered.                                                                                                            |
| 27      | Resubmit `under USD 1` on Samsung with corrected prompt                    | Passed; earrings budget becomes USD1 while global USD120, silver/wedding, price preference and saved E02 remain. No exact matches; explicit proposals shown. |
| 28      | Reconnect to correct Metro URL after native Reload failed to load a script | Passed; live refresh restores confirmed state.                                                                                                               |
| 29      | Actual native development-menu Reload after forwarding repair              | Passed; visible live app restored with identical domain state and saved product.                                                                             |

Reviewing and cancelling option 1 left session version/state unchanged (version8). Explicitly confirming displayed earrings USD35 changed only the offered category budget (version9); confirmation used **zero LLM requests**. The global USD120 remained intact. Reconnection and actual reload advanced transport versions to10/11 with identical full domain state. PostgreSQL comparisons, screenshots and usage: [extension results](evidence/m7/extension/results.json).

One development-infrastructure issue was observed honestly: native Reload initially reported “Unable to load script.” Restored `adb reverse tcp:8081 tcp:8082` plus `tcp:8082 tcp:8082`, reopened the installed `exp+shopping-concierge` URL at localhost8082, and retested the actual native menu control. Reload then returned the visible live app and persisted state. No app/native source modification or APK rebuild was needed. Final app-PID ReactNativeJS/AndroidRuntime error scan contains zero matching errors. Earlier failed reload attempts are not counted as passing evidence.

Combined with prior M7 physical evidence, all required device checks now pass: live chat/tool results, grounded cards, preserved constraints, card actions, explicit confirmation, summary/navigation, recoverable error/retry, cold launch and independently verified reload, keyboard/composer and final runtime-error check. The Android picker MIME/upload/job implementation remains untouched. No unrestricted language-quality claim is made beyond the tested supported grammar.

### Final cumulative usage and validation

- **29/30 live requests**, **74,655 input tokens** including **44,911 cached input tokens**, **3,512 output tokens**; all usage known.
- Estimated total **$0.1106142**, using documented $2/M uncached input, $0.20/M cached input and $12/M output rates. Below the unchanged $1 ceiling. One unused request is not permission for unrelated testing.
- `M5_INTEGRATION=1 npm run check`: lint, root/mobile typechecks and **315/315 tests across 12 files** pass, including local persistence integration.
- Prompt-fix Android export/seven-secret scan passed across29 files; the extension changes only the server budget guard/tests and documentation. Formatting verification passes.
- Live API stopped after validation and local persistent API restored to explicit mock LLM/YouCam mode to avoid incidental spending. Server credentials were not printed or copied into evidence.
- **Deferred final-submission real YouCam rendering/optional analysis validation remains OPEN**, with approved account/assets/credits and actual provider evidence still required. M7 success does not close it.

## 2026-10-04 — M7 device validation found scope mismatch; live request cap reached

**M7 remains incomplete.** Samsung SM-S908N / Android16 was connected and tested on 2026-10-03; this entry records the completed checks and blocker on 2026-10-04. Live chat exposed a mismatch between the provider prompt and the current category-budget contract. The fix passes offline validation but requires live revalidation. M8 has not started.

### Device evidence and results

- Passed visible live request/response and “Live AI planning” label with synthetic catalog disclosure. Initial silver earrings/wedding/USD120 request executed actual switch/update/search tools.
- Passed cheaper refinement: existing material, occasion and hard budget preserved; only category price preference added. Persisted replies were checked against the fixture catalog and hard eligibility (126 assertions across overlapping captured response histories, not 126 distinct products or live calls).
- Passed card save E02, summary navigation and persisted saved product. Typed save made no LLM request.
- Passed keyboard-visible input/Send, direct Send, repeated keyboard cycles, newline draft and scrolling; composer returned when keyboard closed. No keyboard or image-picker MIME implementation changes.
- Passed recoverable connection error and explicit Retry after pausing/resuming the local API with guaranteed cleanup. Retry committed one state-read turn, preserved decisions and re-enabled Send. Removing USB forwarding alone did not interrupt the existing connection and is not counted as an error test.
- Passed force-stop/cold-launch restoration of the same guest session and exact domain state. Version advanced for the normal search refresh.
- Separate JavaScript reload is **not conclusively verified**: the HTTP endpoint returned HTML, and the attempted native reload did not independently establish a new refresh/version. Do not treat these attempts as passing evidence.
- App-PID ReactNativeJS/AndroidRuntime error scan contained zero matching errors. Normalized `UNGROUNDED_PLAN` is an application error, not a runtime crash.

Evidence: [device assertions](evidence/m7/device-live/assertions.json), screenshots/state snapshots in `docs/evidence/m7/device-live/`, and [final diagnostic](evidence/m7/device-live/final-diagnostic.json). Captures contain only synthetic shopping data; no credentials or guest tokens.

### Discovered failure and implemented fix

“under USD 1” returned HTTP422 `UNGROUNDED_PLAN`; no state was committed. The final approved diagnostic reproduced the mismatch: the provider proposed a **global** budget update, whereas the current deterministic interpreter requires an **active-category** override. Existing global USD120 must remain intact. The stale provider instruction explicitly said global, so it conflicted with the authoritative implementation.

Corrected only the provider instructions/example: standalone budget refinements use the active category when present, global otherwise; combined initial search constraints remain global. The backend interpreter, state/catalog logic and strict authorization remain unchanged. Added an offline test that rejects the observed global override atomically and accepts a category override while preserving the global budget. Added named `budget-scope` live case with deterministic setup, requiring only one paid request when further validation is authorized. It has **not** been run live.

### Final cumulative live usage

- Model `gpt-5.6-terra`, low reasoning, Responses API.
- **25/25 requests**, including failed plans and the final diagnostic; the ledger was not reset. No further live attempts permitted under the current approval.
- **63,496 input tokens**, including **39,253 cached input tokens**; **3,198 output tokens**.
- **$0.0947126 estimated spend** at the documented standard rates; all usage known. The request ceiling applies even though spend is below $1.
- **Zero live YouCam calls.** Real rendering/optional analysis remains disabled and the deferred final-submission gate remains open.
- Live API stopped and local persistent API restored to explicit mock LLM/YouCam mode after reaching the cap. Credentials and default configuration files were not changed.

### Validation and remaining gate

`M5_INTEGRATION=1 npm run check` passes lint, both typechecks and **315/315 tests across 12 files**. `npm run verify:mobile-secrets` passes Android bundling and seven-secret scanning across 29 export files. No native rebuild is required for the prompt-only fix.

- [ ] Explicitly approve additional request capacity; preserve the existing ledger and $1 total spend ceiling. No calls may occur on a mere continuation instruction.
- [ ] Revalidate only the corrected budget-scope case, then finish device no-match/explicit confirmation and independently establish JavaScript reload restoration. Do not repeat already-passed live groups.
- [ ] Mark M7 complete only after these remaining checks pass. M8 remains stopped.

## 2026-10-03 — M7 live OpenAI regression passed; final device gate open

The approved OpenAI Responses validation ran with **gpt-5.6-terra**, **low** reasoning, the key loaded from ignored server-side `apps/api/.env`, and the existing durable budget ledger. No credentials, raw HTTP headers, private prompts or reasoning output were logged. No live YouCam calls were made. M8 has not started. **M7 remains in progress pending final live-planner physical-device verification:** ADB currently reports no connected device. Prior mock-device evidence remains valid but is not live-planner evidence.

### Actual usage and results

- **17 total HTTP requests**, including all failed validation attempts; no network retries occurred.
- **42,078 input tokens**, including **25,630 cached input tokens**; **2,579 output tokens** (reasoning-inclusive output accounting). Usage was available for every request; no unknown reservations remain.
- Estimated standard-tier spend: **$0.06897**, calculated using $2/M uncached input, $0.20/M cached input and $12/M output. This is a usage-based estimate, not an invoice. The 25-request/$1 cap remains intact with **8 attempts remaining**; the ledger was never reset.
- Three initial requests failed plan authorization, with no state committed. After fixes, fourteen requests passed all five groups below. No passed group was rerun.

| Live case                                         | Result and actual behavior verified                                                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Constraints (6 turns)                             | Passed: initial budget/material/occasion/style, cheaper preference preserving hard constraints, gold replacement, scoped no-dangling exclusion, necklace switch and return. Every displayed exact match checked against actual catalog facts and hard eligibility. |
| Feedback (4 turns)                                | Passed: rejection memory, save and repeated save idempotency with no duplicate events.                                                                                                                                                                             |
| Relaxation (2 turns + deterministic confirmation) | Passed: impossible constraints give no exact matches; plain “Yes” does not change state; explicit current proposal confirmation executes deterministically without another LLM request.                                                                            |
| Invalid ID (1 turn)                               | Passed: actual model proposes requested nonexistent ID and backend rejects it as `UNKNOWN_PRODUCT`; session version remains zero.                                                                                                                                  |
| Ambiguity (1 turn)                                | Passed: focused clarification without inventing a category or constraints.                                                                                                                                                                                         |

### Failures and fixes

1. Before any HTTP request, the runner failed to compile because top-level await was incompatible with the root CommonJS package. Wrapped execution in an async entry point with a sanitized setup failure. Added an offline process-start regression.
2. Initial live constraint case failed authorization; added strict synthetic-plan diagnostics and a sanitized failure code. The diagnostic rerun showed an omitted budget and repeated updates. The backend rejected the entire plan atomically. Changed provider-only JSON Schema literal encoding to singleton enums and placed field discriminators before common properties; clarified unique updates and mandatory budget extraction. Shared validators and the independent authorization check were not weakened.
3. Next attempt included the complete correct budget but used material `Silver` rather than canonical `silver`, so authorization rejected it. Clarified canonical lowercase material/tag values while preserving uppercase currencies and exact product IDs. The six-turn constraint case then passed. Added offline regressions for omission, duplicates and casing; all assert unchanged state after rejection.
4. The live npm script now reads ignored server `apps/api/.env` and optional root `.env` without printing secrets. Shell approval/mock/model flags retain precedence. Normal tests remain mock-only.

These fixes improve tested bounded-plan consistency; the finite run does not establish unrestricted natural-language reliability. Provider HTTP timeout/retry/malformed-response behavior is covered by injected transport tests rather than deliberately buying failing requests. Live unknown-ID and unauthorized-plan behavior were exercised against actual generated plans.

### Validation and remaining manual gate

- Named runs of `scripts/llm-live-regression.ts` with explicit `M7_LIVE_APPROVED=true`, `USE_MOCK_LLM=false`, `USE_MOCK_YOUCAM=true`, exact approved model and low reasoning. Stopped on each failure; reran only the affected constraints group, then ran each remaining group once.
- `M5_INTEGRATION=1 npm run check`: lint, root/mobile typechecks and **314/314 tests across 12 files** pass, including local PostgreSQL/S3 integration.
- `npm run verify:mobile-secrets`: Android export succeeds; 29 exported files contain none of seven server-secret sentinels. No native changes/rebuild required.
- Actual per-run usage/outcomes and strict synthetic failed plans: [live evidence](evidence/m7/live/summary.json). Authoritative continuing cap: `artifacts/m7-live-budget.json`.
- [ ] Connect/unlock Samsung and complete live-planner UI acceptance with remaining budget: visible live mode/tool result, cards/decision actions, explicit confirmation, summary/navigation/cold restore, error/retry and no runtime errors. Keep verified keyboard, guest credentials and M6 image/job behavior intact. Do not rerun already-passed paid groups unnecessarily.
- [ ] **Deferred final-submission real YouCam rendering/optional analysis gate remains OPEN.** Approved account/assets/credits and separate real evidence are still required; mock success and OpenAI success do not satisfy it.

## 2026-10-03 — Repository formatting

Added pinned Prettier 3.6.2, shared formatting configuration and `npm run format` / `npm run format:check`. Applied formatting to supported source, tests, fixtures, configuration and Markdown, preserving existing implementation and pending M7 status. Generated/native build output, lockfiles, credentials, captured evidence and checksum-protected SQL migrations are excluded; unsupported Python/environment files are unchanged. No live services were called.

Validation: Prettier AST/stability debug check and formatting check pass; `M5_INTEGRATION=1 npm run check` passes lint, both typechecks and **310/310 tests**. `npm run verify:mobile-secrets` passes Android export and the seven-secret scan across 29 exported files. No native rebuild is required for formatting.

## 2026-10-03 — M7 adapter/offline validation; live acceptance blocked

M7 is **in progress, not complete**. M8 has not started. The requested server-only OpenAI Responses adapter is implemented with configurable `gpt-5.6-terra` and default low reasoning. No `OPENAI_API_KEY` or ignored root `.env` is present in the current server environment. Actual model/account access, live tool consistency and final live-device behavior therefore remain unverified. No key is recorded here.

### Changes and invariant boundaries

- Added `apps/api/src/llm/{context,openai,budget,config}.ts`: bounded authoritative context, shared-Zod-derived strict function schema, completed function-call validation, optional-field normalization, Responses transport and environment composition. Added `zod-to-json-schema` to the API workspace; model/provider code stays out of domain/infrastructure-neutral packages.
- Existing independent instruction authorization, deterministic catalog/state transitions, unknown-ID rejection, explicit relaxation confirmation, persistence/replay and typed actions remain authoritative. Live planning retains the bounded supported grammar; arbitrary natural-language coverage is not claimed.
- Shared responses distinguish `mock | live` planning. Mobile copy can show live AI planning while retaining the synthetic catalog/visual limitations. Verified composer layout, picker MIME fix and upload/job code are untouched. No native dependencies/config changes or APK rebuild required.
- Persistent shared budget ledger covers runner AND API/device attempts: hard maximum 25 requests/$1 estimated or reserved total. Every retry/failure counts; uncertain usage retains conservative reservation. Single retry only for 429/502/503/504, abort-aware; no indefinite or ambiguous-network retries. Explicit live runner checks structured actions/catalog invariants, not text.
- [LLM configuration and official sources](LLM.md), architecture/API contracts, regression coverage, decision log and milestone tracking updated.

### Automated validation

| Command                                    | Result                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run infra:local` + `npm run db:local` | Existing local PostgreSQL17/S3 mock services healthy; migrations/fixture seed passed. No cloud resources.                                                                                                                       |
| `M5_INTEGRATION=1 npm run check`           | Lint, root/mobile typechecks and **310/310 tests across 12 files**, including all ten local persistence integration tests, passed.                                                                                              |
| `npm run verify:mobile-secrets`            | Android export passed; all 29 files free of seven server-secret sentinels, now including `OPENAI_API_KEY`.                                                                                                                      |
| `npm audit --json`                         | 29 advisories: 10 moderate, 19 high; prior M6 record was 15 (11 moderate/4 high). Current findings are in Expo/Metro/React Native tooling/dependencies, not the new schema converter. No forced incompatible downgrade applied. |
| `npm run test:llm:live`                    | **Not run:** server credential missing. Full default test suite uses injected/mock transports only.                                                                                                                             |

### Live usage and explicit remaining gates

- Requested model: **gpt-5.6-terra**, Responses API, reasoning **low**. Official model/function/pricing pages fetched on 2026-10-03 (links in `LLM.md`). Verified standard rates: $2/M input, $0.20/M cached input, $12/M output.
- Actual live LLM requests **0**, input/output/cached tokens **0**, estimated spend **$0**. No live YouCam requests/credits. Budgeted test fixtures are local simulations, not paid usage.
- [ ] Configure server-side `OPENAI_API_KEY`; keep credentials out of source/mobile/logs/fixtures/docs/chat.
- [ ] Run minimal isolated structured live cases (default fourteen requests before retries), recording actual ledger counts/tokens/cost and consistency. Fix failures and rerun only affected named cases under the SAME ledger. No model substitution or ledger reset.
- [ ] Finish live-planner physical checks under the shared cap: real chat/tool results, correct live label, cards/decision actions, explicit relaxation confirmation, summary/navigation/cold reload and error/retry with no runtime errors. Preserve guest credentials, job restoration, picker MIME and keyboard behavior. Mock checks below are not proof of model behavior.

### Physical Android mock regression

Samsung SM-S908N / Android16 detected and used with both providers mocked. Visible existing chat, keyboard-visible input/Send, direct state-read submission, summary navigation and persisted scoped decisions passed. Force-stop/cold launch preserved the exact domain state; version incremented for the normal refresh action. Local API interruption produced a visible recoverable error; explicit Retry succeeded with composer re-enabled. App-PID ReactNativeJS/AndroidRuntime error inspection found no matching errors. Evidence and precise scope: [M7 device evidence](evidence/m7/README.md).

### OPEN — deferred real YouCam validation before final submission

- [ ] Approved account access/credits and appropriate approved assets are available.
- [ ] Actual live category rendering, normalized failures and real output evidence are validated and recorded.
- [ ] Optional live analysis is validated where available, or an explicitly approved unsupported scope decision is recorded before submission.

Keep live rendering/analysis disabled until prerequisites are met. **Mock success is not live YouCam evidence.** This gate remains open and independent of M7 OpenAI acceptance; see [YOUCAM.md](YOUCAM.md).

## 2026-10-02 — M6 mock/device and provider-contract validation complete

M6 is **complete for the specified mock-first validation scope**; **M7 has not started**. All four category paths, strict agent/image/job contracts, portable persistent jobs/cache, server-only mock/live VTO composition and on-demand mobile photo selection are implemented. Live account entitlement, approved product imagery, real rendering quality/anatomy detection and optional live analysis remain **unverified and disabled**, not implied by these results. No authenticated YouCam calls, live LLM calls, cloud resources or API credits were used.

### Acceptance evidence

| Criterion                       | Result                                                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four normalized category paths  | Pass: earrings/necklaces → portrait, rings → hand, watches → wrist; missing/wrong type makes no provider call. All-category mock lifecycle and documented real-adapter upload/submit/poll contracts tested with injected HTTP                                                 |
| Analysis cache                  | Pass: session-owned mock face profiles cached by image hash/kind/mode/version and retained across PostgreSQL connections. No inferred face shape or preference is fabricated. Live/color analysis reports unavailable pending confirmed capability                            |
| Recoverable normalized failures | Pass: unknown product, unauthorized session/asset, malformed fields/results, file/MIME failure, provider auth/rate/network/invalid response, rendering failure and transient poll recovery. A technical failure is not an aesthetic judgment                                  |
| Isolated minimal live checks    | Standalone smoke requires explicit `RUN_YOUCAM_LIVE_SMOKE=one-render`, live server config and approved image/product assets; at most one task and 20 bounded polls. **Not run**; default test/dev paths cannot spend credits                                                  |
| Persistence/trust boundaries    | Pass: durable job claim/replay, concurrent submission once, cached analysis after new connection, owner checks and unchanged shopping state. No model/provider replacement state or invented catalog facts                                                                    |
| Android flow and preservation   | Pass: rebuilt app, typed Try on E13 → portrait request → explicit system photo picker/upload → queued → processing → honestly labeled mock completion; job restores after process death. Shopping state, guest credential, summary/navigation and keyboard behavior preserved |

The real adapter is based on the public YouCam OpenAPI v1.9 documentation retrieved 2026-10-02. That read-only documentation request consumes no inference credits. `docs/YOUCAM.md` records exact endpoint mapping, upload/result host validation, no automatic paid-POST retries, unknown-outcome behavior, status-check recovery and account/asset prerequisites. No live provider availability is asserted.

### Changes and validation

- Added strict shared visual schemas; portable visual repository state and checksum-tracked `002_visual.sql`; owner-checked list/create/read/advance/cache APIs; mock provider and live four-category file/task adapter; explicit server environment switch and a separately gated smoke script.
- Added strict agent `request_vto` catalog/image handoff and mobile try-on screen/client. Prior unsupported-VTO fixture now expects the implemented handoff with unchanged domain state; comparison/dependency unsupported guards remain. M0's live-configuration test still fails closed without required config, while no longer assuming M6 can never configure a live adapter.
- Added SDK-compatible `expo-image-picker ~57.0.20` using `npx expo install expo-image-picker`; two packages added. Photo selection is on demand. Camera/microphone permissions disabled; generated manifest still uses `adjustResize`. No changes to the verified KeyboardAvoidingView/safe-area/composer implementation.
- `M5_INTEGRATION=1 npm run check`: **281/281 tests across 10 files**, lint and both typechecks pass. This retains the prior 256 tests and adds 25 M6 regressions, including one additional real PostgreSQL/local S3 test. Ordinary tests skip the ten explicit local integration tests unless enabled.
- `npm run verify:mobile-secrets`: final Android export passes; 2.9 MB Hermes bundle, all 29 exported files free of six server credential sentinels.
- `npx expo install --check`: dependencies aligned. `npx expo-doctor`: **20/20 enabled checks pass**; existing documented generated-config/Git heuristic exception unchanged.
- `npx expo prebuild --platform android --no-install`, then the same ARM64 SDK57 Gradle command recorded in M5: **BUILD SUCCESSFUL in 1m58s, 455 tasks**. `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`: Success. Package/version remain `com.youcam.shoppingconcierge`, 0.1.0/versionCode 2; SecureStore data retained. APK SHA-256: `bc7578660bf3946555d22de37140b09874406f321d5922302c0156091f6996d1`.
- `npm run db:local`: explicit local migration applied successfully without replacing existing catalog/state. Persistent API and cache-cleared Metro restarted; USB reverses 4000/8082 retained.
- npm dependency-install audit reports **15 advisories (11 moderate, 4 high)**, unchanged. No forced dependency upgrades.

### Physical Samsung evidence and discovered fix

Samsung SM-S908N / Android 16. Only a generated image labeled “M6 MOCK INPUT — No person or product depicted” was selected; no personal gallery image or live provider was used. [Device evidence](evidence/m6/README.md) includes image request, queued/processing/completed/restored job, exact shopping-state comparison, summary, multiline keyboard and app-process logs.

The first native upload exposed Android picker metadata describing PNG while its base64 bytes were JPEG. Backend decoding correctly rejected the mismatch. Fixed the client to determine PNG/JPEG from returned base64 signature, preserving full backend decode/hash/size validation. Added an encoded-image regression, repeated selection/upload successfully and reran final automated/bundle checks. Initial picker automation also omitted the system Done confirmation and a development refresh interrupted selection; final repeated flow completed explicitly.

The try-on operation itself preserved the entire shopping session view. Cold launch preserved identical domain state (normal shopping refresh may advance its turn version), and the completed job restored from PostgreSQL. The rebuilt app passed bounded multiline input, three keyboard open/close cycles with input and Send above IME, return to bottom safe area, and summary/back navigation. Final card-entry and direct Send with the keyboard open also pass: exactly one turn, cleared pending journal and preserved decisions. Current-process ReactNativeJS/AndroidRuntime logs contain no app runtime errors; no red screen observed. This is not a claim that the entire device crash buffer is empty.

Provider failure/timeout/retry and all four image-category paths are automated regressions; the physical success journey used earrings, and physical API error/recovery was additionally observed through the MIME rejection/fix. Live anatomy detection/render quality and optional live analysis require approved inputs/account access before separate validation. Stored raw images and provider output are not interpreted as decision authority. M6 validation is complete within mock-first scope; stop before M7.

## 2026-10-02 — Post-M5 keyboard stabilization complete

**Fixed and physically verified; M6 has not started.** On Samsung SM-S908N / Android 16, the chat composer and Send button now stay above the software keyboard, remain tappable, and return to the bottom safe-area position when it closes.

### Root cause and change

`apps/mobile/app/index.tsx` enabled `KeyboardAvoidingView` padding only on iOS; Android received no avoidance behavior. The SDK57 edge-to-edge Android window retained full-screen layout while the IME covered the bottom composer. Native resize alone did not avoid this overlap on the phone.

Enabled the existing React Native `KeyboardAvoidingView` with `behavior="padding"` on both platforms and `keyboardVerticalOffset={insets.top}` from `useSafeAreaInsets`, accounting for its parent safe-area origin. The header remains outside the avoiding view; scrollable chat and the bounded multiline composer remain inside it. Existing handled keyboard taps, product cards, controller/state, send/retry semantics and safe-area container are preserved. There is no bottom tab navigator in the current app.

Verified Expo's omitted `android.softwareKeyboardLayoutMode` defaults to `resize` in the installed config plugin; generated Android manifest and running activity both use `adjustResize`. This is compatible with the fix. No config, dependency, native module or React Native internal change was needed, so no rebuild/reinstall was required. The installed M5 APK remains compatible. Cache-cleared Metro and cold launch were necessary to verify the updated bundle; initial reloads still displayed the prior layout.

### Validation

- `M5_INTEGRATION=1 npm run check`: **256/256 tests across 9 files**, lint and root/mobile typechecks pass, including local PostgreSQL/S3 regressions.
- `npm run export:android`: pass, 2.9 MB Hermes Android bundle.
- Cache-cleared Metro: `NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 npm run dev:clear -w @youcam/mobile -- --localhost`.
- ADB screenshots, UIAutomator bounds and IME state: short text, long wrapped text plus four explicit newlines, three close/open cycles, direct Send tap while keyboard open and cold-launch typing all pass. Open-state Send bottom was 1198px, above keyboard top 1308px; closed-state Send returns to 2146px. Input grows to its existing bounded multiline height without hiding Send.
- Chat-region scrolling with keyboard open reaches the E13 fixture card while preserving the draft; summary/back navigation passes. Initial automation swipes hit the composer or overscrolled the card; repeated swipes within the actual chat viewport established the successful result. Outer Expo ScrollView accessibility bounds must not be used as the chat viewport.
- Send commits exactly one turn and preserves prior decisions. Force-stop/cold launch restores identical domain state. Paused local API produces visible timeout/Retry; resume/retry commits exactly once, clears the pending journal and preserves decisions.
- Retained current-process runtime logs and visible screens show no app runtime errors/red screen. Physical evidence and geometry/state assertions: [post-M5 keyboard evidence](evidence/post-m5-keyboard/README.md).

Added a repeatable physical regression fixture to [test scenarios](TEST_SCENARIOS.md). The automated suite exercises portable logic; native keyboard geometry is established by the physical checks, not a source-text assertion. No dependencies changed; previous 15 advisories (11 moderate, 4 high) remain the last audited baseline, with no new audit needed for this layout-only fix. No live YouCam/LLM credits, email or cloud resources used. Stabilization gate complete; stop before M6.

## 2026-10-02 — M5 complete: persistence, authorization and physical Android

M5 is **complete and fully validated**. All M0–M4 coverage remains; **M6 has not started**. PostgreSQL/S3 access stays behind portable API adapters, secrets remain server-side/environment-driven, and deterministic state/catalog/tool/explicit-confirmation boundaries are preserved. No cloud deployment/resources, live YouCam/LLM credits or real email were used.

### Implementation and acceptance

- Explicit checksum-tracked PostgreSQL migration and insert-only 72-product fixture seed; owned sessions, feedback, saved products, events, private image metadata and email challenges. Authorized row locks atomically commit structured state, version/replay and projections; rollback/concurrency/restart tests pass.
- Cryptographically generated guest credential saved in native SecureStore before use. Bearer authorization is enforced for sessions/actions/images; raw credentials are not stored in PostgreSQL or the session journal, and Authorization logging is redacted. Session ID alone grants no access. Optional email proof is API-only, disabled by default, and tested with mock delivery.
- Authenticated PNG/JPEG upload/decode, bounded private S3 objects and verified downloads; object bytes survive local service restart. Failed operations return normalized errors. No image anatomy/VTO result is fabricated.
- Internal agent snapshot restore/export preserves existing deterministic execution; no client/model restoration endpoint. Session state remains authoritative over chat. New credential failures fail closed; pre-M5 unowned sessions require explicit new-session recovery.
- Mobile bundle sentinel scan confirms six server credential values are absent from every exported file. Runtime guest credentials are generated on-device, not embedded infrastructure secrets.

See [persistence contracts/setup](PERSISTENCE.md), [API contracts](API_CONTRACTS.md), [decision log](DECISIONS.md) and [physical evidence](evidence/m5/README.md).

### Automated and native validation

| Command/check                               | Result                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run infra:local` / `npm run db:local`  | Pass: healthy local PostgreSQL 17 + Adobe S3Mock 4.11.0; explicit migration/seed                                                          |
| `M5_INTEGRATION=1 npm run check`            | Pass: lint, both typechecks, **256 tests across 9 files** (231 prior + 16 portable M5 + 9 PostgreSQL/S3 integration)                      |
| `npm run test:integration`                  | Pass: real SQL transaction/rollback, concurrent requests, replay/confirmation, authorization/email ownership, S3 bytes and pool reconnect |
| `npm run verify:mobile-secrets`             | Pass: Android export, 1,274 modules, 27 assets, 2.9 MB Hermes; six server secret sentinels absent from all 29 output files                |
| `npx expo install --check` in `apps/mobile` | Pass: SDK-compatible dependencies                                                                                                         |
| `npx expo-doctor` in `apps/mobile`          | Pass: 20/20 enabled checks; existing generated-config/Git exception unchanged                                                             |
| Native Android rebuild and `adb install -r` | Pass: 455 Gradle tasks, BUILD SUCCESSFUL; rebuilt APK installed on Samsung                                                                |
| `npm audit --json` at workspace root        | **15 advisories (11 moderate, 4 high), unchanged**; audit exits 1. No forced fixes                                                        |

Ordinary `npm test` skips the nine explicitly enabled integration tests; it alone does not validate durable mode. Integration tests use an isolated schema in the loopback fixture database. No source changes followed the final full validation; final edits record evidence/status and usage documentation.

Native build from `apps/mobile/android` after Expo native generation:

```sh
ANDROID_HOME=/tmp/youcam-android-sdk ANDROID_SDK_ROOT=/tmp/youcam-android-sdk \
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home \
JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true NODE_ENV=development \
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a \
-PreactNativeDevServerPort=8082 \
-Dorg.gradle.internal.http.socketTimeout=45000 \
-Dorg.gradle.internal.http.connectionTimeout=15000 \
--no-daemon --max-workers=4 --console=plain
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

APK SHA-256: `38f8dcd0674951e3caa6ddfbc018544508ecf90056c8bb29f342fe3a5ea6a017`. Package `com.youcam.shoppingconcierge`, versionName 0.1.0 / versionCode 2. Native additions: SDK-compatible `expo-secure-store ~57.0.4` (config plugin) and `expo-crypto ~57.0.3`. API additions include `pg 8.23.1`, AWS S3 SDK `3.1145.0`, `nodemailer 10.0.13`, image decoding via `sharp`, and PostgreSQL/Nodemailer types. Lockfile updated; React Native internals unchanged. A workspace install reported zero advisories, but the root audit above is authoritative.

### Physical Samsung acceptance

Samsung SM-S908N, Android 16, serial `R3CT2019D9D`; USB reverse ports 4000/8082, persistent local API, mock AI and dedicated rebuilt app.

| Check                              | Result                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest creation/legacy recovery     | Pass: old unowned session honestly unavailable; deliberate new session succeeds. SecureStore file existence checked without reading/exposing its raw secret                                                         |
| Shopping/regression journey        | Pass: chat/cards; save + shortlist E02, select E18, reject E05 with `too_flashy`; no-dangling constraint preserved through necklaces and back; summary/navigation agrees with backend                               |
| Cold launch and persistent restart | Pass: force-stop app, stop API, restart PostgreSQL/S3, restart API and cold-launch app. Same session ID and deeply identical domain state; refresh advances turn version 8 → 9                                      |
| Explicit refresh                   | Pass: same domain state and decisions, expected search refresh version 9 → 10                                                                                                                                       |
| Relaxation confirmation            | Pass: platinum earrings under USD1 yields no exact matches; cancel preserves full view. Explicit offered earrings USD65/silver confirmation applies only offered updates and preserves decisions                    |
| Error/retry                        | Pass: SIGSTOP API, send Actually gold, visible timeout/Retry; SIGCONT then Retry commits once (version 14 → 15), one original request in history, preserved decisions, cleared pending journal and visible recovery |
| Private object retention           | Pass: separate synthetic 2×2 PNG retains exact bytes/hash across PostgreSQL/S3/API restart                                                                                                                          |
| Runtime                            | Pass: no app runtime error, fatal crash or red screen observed; app process survives error recovery                                                                                                                 |

ADB visible taps/text, UIAutomator/screenshots, private journal inspection and read-only database snapshots corroborated these checks. [Evidence assertions](evidence/m5/verification.json) recheck retained restart, refresh, cancel, confirmation and retry snapshots. Retained [app runtime records](evidence/m5/runtime.txt) cover PIDs 16268 and 17869. Two overlapping UIAutomator helper processes (19148/19163) crashed with `UiAutomationService already registered`; these were tooling failures, not app failures. Affected interaction checks were repeated serially and passed. The entire device crash buffer was **not** empty.

### Resolved setup failures and limits

Transient npm network reset and Google Maven DNS failures were retried successfully. MinIO image retrieval failed from DockerHub/Quay, so local S3 protocol validation uses Adobe S3Mock. Its initial bucket/storage environment names were corrected to `COM_ADOBE_TESTING_S3MOCK_STORE_*`; health checks, integration tests and restart retention then passed. An evidence-write approval review timed out; the permitted retry succeeded.

This validates real local PostgreSQL and S3-compatible protocol/storage behavior, not RumptyCloud connectivity or production IAM. Optional email delivery used a captured mock, not SMTP. Guest credential loss can lose access absent verified email. SQL and object writes are not a distributed transaction: uncertain metadata commits can leave private orphan objects, with safe retry documented. Image anatomy validation, VTO and live AI belong to later milestones. All M5 acceptance criteria are satisfied; stop before M6.

## 2026-10-02 — Pre-M5 infrastructure documentation update

Documentation-only update **validated**. M4 remains complete; **M5 has not started**. Recorded RumptyCloud managed app deployment, Managed PostgreSQL and S3-compatible storage as the intended hackathon/demo infrastructure, with Expo / React Native mobile and server-side YouCam/selected-LLM adapters. This is not a permanent production-cloud commitment.

Added `INFRASTRUCTURE.md`; aligned architecture, data model, README, AGENTS, M5 milestone/checklist terminology, decision log and the architecture skill. Replaced active Supabase-specific assumptions while preserving M5 deliverables/acceptance criteria. Historical validation entries remain historical. PostgreSQL/S3 compatibility, provider-independent core packages and server-side environment-driven secrets are explicit. No authentication provider is implied by the hosting decision.

Validation performed:

- Reviewed infrastructure references with `rg` across AGENTS, README, docs and repository skills. Remaining Supabase mentions describe superseded assumptions or historical results, not current requirements.
- Parsed the updated architecture skill frontmatter with the repository's existing `js-yaml`; name, description and supported keys pass. The Skill Creator `quick_validate.py` was attempted but could not start because host Python lacks PyYAML (`ModuleNotFoundError: yaml`); no dependency was installed. Local YAML/metadata checks were used instead.
- Checked all 12 relative Markdown links across the nine infrastructure documents/skill files: targets exist.
- Compared SHA-256 hashes and file sets for 60 non-documentation source/configuration files before/after: unchanged, including application/package sources, tests, fixtures, scripts, dependency manifests and lockfile. No runtime or environment configuration changed.
- No application test rerun was needed for prose-only edits; the prior M4 result remains 231 passing tests plus lint/typechecks, Android bundling, Doctor and physical-device acceptance. This does not claim new infrastructure connectivity validation.

No deployment, cloud-resource creation, live provider calls or API-credit use occurred. Stop before M5.

## 2026-10-02 — M4 complete: physical Android acceptance passed

M4 is **complete and fully validated**. The remaining native shopping, navigation, cold-reload, confirmation, and error/retry checks passed on the connected Samsung SM-S908N (Android 16, serial `R3CT2019D9D`). Dedicated app `com.youcam.shoppingconcierge`, versionName 0.1.0 / versionCode 2; existing SDK57 development binary, cache-cleared Metro on port 8082 and mock API on port 4000 with USB reverse. **M5 has not started. Live LLM/YouCam calls: zero.**

### Physical checks

| Check                      | Evidence and result                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visible launch/chat/cards  | Pass: home prompt/mock disclosure; example sent through visible controls returned six exact fixture products with catalog price/stock and scoped constraint changes. No fabricated product photos                                                                                                                                                                       |
| Decision actions           | Pass: saved and shortlisted E02, selected E14, rejected E09 with `too_flashy`. Summary and backend agree; rejected product removed from results, refreshed ranking rendered                                                                                                                                                                                             |
| Refinements/category scope | Pass: Cheaper options preserves global material/budget/occasion/style; “No dangling earrings” remains earrings-scoped through necklaces and back. Prior choices retained                                                                                                                                                                                                |
| Summary/navigation         | Pass: visible summary lists current constraints by scope and correct catalog names/prices for selected/shortlisted/saved/rejected decisions; back navigation preserves session                                                                                                                                                                                          |
| Cold reload                | Pass: `adb shell am force-stop com.youcam.shoppingconcierge` followed by development-client launch restores the same native-journal session ID and deeply identical domain state. Version 9 → 10 is the expected search refresh; restored summary visibly matches                                                                                                       |
| No-match/confirmation      | Pass: “Platinum earrings under $1” shows no exact matches and separate scoped proposals. Review/cancel leaves the entire session unchanged; plain yes leaves domain state unchanged. Explicit Confirm changes sends the current offer and adds only earrings budget USD35/material silver; prior constraints/decisions remain. E01 becomes an exact USD35 silver result |
| Error/retry                | Pass: paused the same API process with SIGSTOP, sent “Actually gold”, observed timeout/error and Retry request. Resumed with SIGCONT and tapped Retry: one version increment, one history entry for that original request ID, preserved decisions, cleared pending journal and visible recovered no-match response                                                      |
| Runtime                    | Pass: visible screens throughout; initial logcat plus final retained ReactNativeJS/AndroidRuntime/crash-buffer inspection found no app errors/exceptions or fatal crash records; both app launch records are retained in evidence. No red runtime screen appeared during any step                                                                                       |

Screenshots, mock state snapshots and assertion summary are in [`evidence/m4/README.md`](evidence/m4/README.md). Device actions were driven with ADB taps/text and checked using screenshots/UIAutomator; backend snapshots were read-only corroboration. The native Expo FileSystem journal was overwritten across turns and read back after process death successfully. The existing binary already contains this SDK-compatible native module; no rebuild was needed.

The initial unfiltered logcat stream ended early with EOF, so final retained runtime and crash buffers were inspected separately rather than claiming continuous capture. Historical crashes from another app were excluded; no Shopping Concierge crash record exists.

No implementation changes were needed during physical verification. The final automated results from the implementation checkpoint remain applicable: **231/231 tests across 7 files**, lint, both typechecks, Android bundling and **20/20 enabled Expo Doctor checks** passed. Known dependency advisories remain **15 (11 moderate, 4 high)**; no dependency changes or new audit run in this device-only pass. Commands included `adb devices -l`, port reversal, `am start`, `input tap/text`, `uiautomator dump`, `exec-out screencap -p`, app-private journal reads, GET session snapshots, `am force-stop`, SIGSTOP/SIGCONT and `adb logcat -T 1 -v threadtime`. API health returned mock/ok after recovery and both USB forwards were retained.

All M4 acceptance criteria are satisfied. M0–M3 regression coverage and deterministic backend boundaries remain intact. Mock API state is still process-local; API restart expiry/deliberate new-session recovery remains covered by automated tests, not a claim of M5 durable storage. Work stops before M5 as requested.

## 2026-10-02 — M4 implementation checkpoint (historical; device gate subsequently passed)

At this checkpoint M4 was **not complete**. Mobile implementation and automated validation pass, but no Android device is connected (`adb devices -l` returns an empty list). The full physical mock shopping journey and native navigation/reload acceptance checks remain unverified. The user was asked to connect/unlock the Samsung phone and authorize USB debugging. **M5 has not started. Live LLM/YouCam calls: zero.**

### Delivered and preserved boundaries

- Home/chat, accessible card actions, exact fixture products in backend order, scoped previous/current changes, loading/errors/retry, no-match proposals with explicit review/cancel/confirm, structured optional rejection reasons, and a separate session-summary route.
- Summary shows backend constraints and selected/shortlisted/saved/rejected IDs across categories with current catalog facts from `GET /v1/products/:id`. Historical decisions are not relabeled as current matches. Missing detail lookups are disclosed.
- Typed client validates shared request/response schemas and session/product identity. Quick actions and chat use M3 orchestration; M1 transitions, M2 hard filtering/ranking and M3 tool/confirmation logic are unchanged. No client scoring, state reconstruction from chat, direct provider calls or model-supplied facts.
- A root controller survives navigation. A private Expo FileSystem journal records only the session ID, up to 40 display messages and any pending request. Writes precede mutations; retries/reloads reuse the same request ID. Backend GET reconciliation suppresses obsolete replay results and keeps session state authoritative. Current results are re-searched after reload/refresh; this changes the turn version/current proposals but not domain decisions.
- Offline restoration, unreadable storage, pre/post-commit write failure, unresolved outcomes and stale versions block unsafe new changes. Backend restart explicitly expires the mock session; starting a replacement requires a deliberate UI confirmation. No durable/authenticated M5 persistence is claimed.
- Fixture prices/stock are labeled synthetic; nonexistent product photography is not fetched or invented. Comparison and VTO remain unavailable, with no fake output or image permission prompts.

### Validation commands and results

| Command/check                                                                                        | Result                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx expo install expo-file-system` in `apps/mobile`                                                 | Pass; direct SDK-compatible `~57.0.7` declaration and lockfile workspace entry. Version 57.0.7 already existed transitively through Expo       |
| `npm run check`                                                                                      | Pass: ESLint, root/mobile typechecks, **231 tests across 7 files** (210 existing + 21 M4)                                                      |
| `npm run export:android` after final code changes                                                    | Pass: 1,263 modules, 27 assets, 2.9 MB Hermes bundle; exit 0                                                                                   |
| `npx expo install --check` in `apps/mobile`                                                          | Pass: dependencies up to date                                                                                                                  |
| `npx expo-doctor` in `apps/mobile`                                                                   | Pass: 20/20 enabled checks. Existing documented generated-config/Git heuristic exception remains unchanged                                     |
| `npm ls react react-native expo-file-system --all`                                                   | Pass: React 19.2.3, RN 0.86.3, FileSystem 57.0.7 deduped. Existing lockfile/native runtime singleton regression tests also pass                |
| `npm audit --json`                                                                                   | **15 advisories: 11 moderate, 4 high**, unchanged from stabilization baseline. Audit exits 1 for these known findings; no forced fixes applied |
| `GET /health` on local API                                                                           | Pass: mock mode, HTTP 200                                                                                                                      |
| `adb devices -l`                                                                                     | No devices attached; repeated checks still empty                                                                                               |
| Physical launch, touch journey, navigation, file journal reload, unavailable API/retry, runtime logs | **Pending**, not inferred from bundling or portable controller tests                                                                           |

Initial typecheck found outdated generated Expo Router route types for the new summary route; restarting Metro with a cleared cache regenerated them, with no unsafe type cast. The first new test run exposed an incorrect test assertion (feedback reasons live under `feedback.input`); corrected against the shared schema. Recovery review found unreadable-journal retry, failed post-commit reconciliation and offline-restoration gaps; fixes have regression tests. Final suite has no failures.

The existing SDK57 native build's generated `ExpoModulesPackageList.kt` contains both `expo.modules.filesystem.FileSystemModule` and `expo.modules.filesystem.legacy.FileSystemLegacyModule`. No native version/config changed, so declaring the existing module directly does not itself require rebuilding. Actual installed-binary compatibility and file replacement must still be checked on the device; rebuild the dedicated app if that evidence differs. No React Native internals were modified.

### Physical acceptance checklist used for the completed verification above

Development servers were started with mock API on loopback port 4000 and cache-cleared Metro on IPv4 port 8082. Restart if no longer running, following the README USB commands. Use only Shopping Concierge (`com.youcam.shoppingconcierge`), never Recall/Expo Go. Expected phone from previous validation: Samsung SM-S908N, serial `R3CT2019D9D`, Android 16.

1. Connect/unlock/authorize the phone. Forward ports 4000 and 8082 with ADB; open the development-client link from README. Verify visible home, no red runtime screen, and mock disclosure.
2. Tap **Use this example**, then **Send to concierge**. Confirm actual fixture cards, prices and scoped state changes. Use **Cheaper options** and verify unrelated constraints remain. Exercise **Save**, **Shortlist**, **Select**, and **Reject** with a structured reason, then verify badges/removal/reranked results and summary.
3. Enter “No dangling earrings”, switch to necklaces and return to earrings. Verify category scopes and previous earrings choices. Navigate summary/back without losing state.
4. Force-stop/relaunch or reload JavaScript while the API remains running. Verify the same session ID, constraints and decisions are restored through the native file journal/backend GET. Do not count Metro hot reload alone as a cold restoration test.
5. Enter “Platinum earrings under $1”. Verify zero exact cards and separate proposals. Open review, cancel and verify no constraint mutation. Review again and explicitly confirm; verify only offered scoped changes and newly exact results. Plain “yes” must not approve a proposal.
6. Pause the mock API (or otherwise reliably interrupt requests without accidentally serving a keepalive connection). Send a change, verify the recoverable error, restore the same API process, tap **Retry request**, and verify one transition/no lost decisions. Restore all forwarding/server state afterward. API restart is a different test: expect explicit expiry and deliberate new-session recovery.
7. Inspect screenshots and app runtime logs for errors. Record device/build, journey evidence and results here; only then mark M4 complete in milestones/checklist. Stop before M5 as requested.

Automated controller tests cannot establish native layout/usability, Android file overwrite semantics or navigation rendering. Those are the remaining external acceptance gate; none has been silently skipped.

## 2026-10-02 — M3 complete

M3 is **complete and fully validated**. Both milestone acceptance criteria pass through mock multi-turn, tool-boundary and HTTP integration checks. M0–M2 behavior/regressions are retained. No required manual verification, live integration, missing credential, or unresolved product decision applies to this backend milestone. **M4 is not started.** Live LLM/YouCam calls: **zero**.

### Delivered

- `@youcam/agent`: strict tool registry, bounded mock interpretation and planning interface, detached/bounded planner context, working-state execution through M1 and unchanged M2 search, grounded structured response mapping, provider deadline/error handling.
- Backend-owned in-memory session service with opaque IDs, turn versions, atomic commit/CAS after async planning, 50-request idempotent replay window, bounded history and explicit capacity. Client snapshots and planner context cannot mutate truth.
- Shared agent request/response/error schemas. Plans accept tool intents/arguments only, never replacement state, product facts/results, model prose or confirmation. Current-message authorization rejects syntactically valid but unrequested edits before execution.
- Relaxation confirmation is a distinct explicit client request referencing a current session-owned offer ID/version. The backend retrieves its own updates, regenerates the proposal against current facts, applies M1 transitions and reruns exact filtering. Plain yes/model plans/guessed or stale IDs cannot authorize changes.
- `MockAgentPlanner` success/failure/latency/adversarial fixtures and `runAgentScenario`. `fixtures/m3-scenarios.json` runs **6 scenarios with 31 full turns** through real backend tools and JSON request/response round trips.
- API `POST /v1/sessions`, `GET /v1/sessions/:id`, `POST /v1/sessions/:id/messages` with validated message/action/confirmation variants and normalized errors. Existing foundation routes/providers/config remain intact; no mobile UI or native changes.
- Updated agent/testing/shared READMEs, root overview, architecture, agent/API contracts, data model, decisions, regression coverage and milestone/checklist docs.

### Acceptance evidence

| M3 acceptance criterion                                        | Evidence                                                                                                                                                                                                                                                                              | Result |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Full multi-turn fixture scenarios pass without real LLM/YouCam | Six complete scenarios: A01–A05/A13 scoped refinements/category/selection return; A06/A14/A16 rejection reranking/save idempotency/category isolation; A07 no-match with no implicit relaxation; A17 focused clarification; factual detail/state/reset; honest unavailable boundaries | Pass   |
| Model cannot directly mutate state                             | Detached context tests; strict schemas reject state/facts/results/prose; independently grounded plans reject extra valid edits/unknown IDs; backend-only M1/M2 execution; atomic rollback, selection eligibility and concurrent-turn CAS                                              | Pass   |

Additional confirmation tests apply legitimate offered updates and reject altered, guessed, cross-session, superseded and no-longer-feasible proposals. HTTP integration covers create/search/restore/confirm/replay, malformed/oversized input and normalized errors. Provider failure/deadline tests leave state unchanged; late plans cannot commit. Direct user actions use the same tools without a provider call and reject inferred provenance. All exact response products are checked against authoritative catalog records and current hard constraints.

### Validation commands and results

| Command                                                                             | Result                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install --offline --ignore-scripts --no-audit --no-fund`                       | Pass; new agent workspace/internal dependency links only; no new external versions                                                                            |
| `npm run check`                                                                     | Pass: ESLint, root/API/shared/agent/tests and mobile TypeScript, **210 tests across 6 files**                                                                 |
| `npm run export:android`                                                            | Pass, exit 0: 1,252 modules, 27 assets, 2.8 MB Hermes bundle. Expo printed a forced-shutdown notice after successful export; emitted bundle/metadata complete |
| `npm ls @youcam/agent @youcam/catalog @youcam/testing react react-native --depth=0` | Pass: internal workspace links and React 19.2.3 / RN 0.86.3 retained                                                                                          |
| Final lockfile singleton check                                                      | Pass: one React 19.2.3, RN 0.86.3, Reanimated 4.5.1 and Worklets 0.10.1                                                                                       |

The suite adds **40 M3 tests** to the existing **170 M0–M2 tests**. The six scenario tests assert every one of their 31 turns; remaining M3 cases cover adversarial and integration boundaries. New oversized-number regressions protect fail-closed clarification instead of numeric overflow or an invented budget. No M1 transition or M2 filter/ranking algorithm was changed. Native dependencies/config and mobile behavior are unchanged, so prior physical stabilization evidence remains applicable; M3 requires no new device interaction check. Existing dependency advisories remain tracked below; no external versions changed and the online security audit was not rerun.

### Scope and limitations

The mock interpreter uses documented full-string demo grammar. The backend independently authorizes plans against that same current-message grammar; this is deliberately bounded mock interpretation, not proof of arbitrary live LLM semantic accuracy or a production model authorization design. Unsupported/negated/ambiguous inputs clarify without partial constraint edits. Live interpretation remains M7 and must retain authoritative state/catalog boundaries.

Session storage is local, in memory, unauthenticated guest development state and is lost on process restart; persistence/auth and distributed concurrency remain M5. Mobile shopping wiring is M4. A08 comparison, A09–A11 image/VTO lifecycle and A12 dependency-aware ranking remain M6/M8: this milestone tests honest unavailable responses for those requests, never fabricated successful results. No required M3 acceptance criterion is skipped, and no live credits were consumed.

## 2026-10-02 — M2 complete

M2 is **complete and validated**. All three milestone acceptance criteria pass. No required manual verification, credentials, live integration, or unresolved product decision exists for this pure catalog milestone. **M3 is not started.** Live LLM/YouCam calls: **zero**.

### Delivered

- `@youcam/catalog`: validated backend-owned catalog snapshot and detached product lookup; duplicate IDs and malformed records fail closed. Search reuses M1's hard eligibility guard and never changes session state.
- `fixtures/catalog.ts`: **72 clearly synthetic fixture products, 18 each for earrings/necklaces/rings/watches**, with varied budget, material, color, style, occasion, currency and stock. Stable IDs, fixture-labeled names/descriptions, non-fetching placeholder image URLs, and null VTO assets avoid merchant/photography/VTO claims. Fixtures are an opt-in package entry point.
- Deterministic weighted soft ranking with grounded evidence and explicit → feedback → saved → visual → heuristic priority, then stable ID tie-breaking. All hard filtering precedes ranking. Price preferences compare within currency and do not invent budgets/exchange rates.
- Session rejection penalties from known same-category attributes and latest currently active reasons. Rejected IDs are excluded, unknown/missing reasons do not invent dislikes, positive reversal clears active penalties, and saving alone does not.
- No-match results keep exact matches empty. Confirmation-required proposals carry typed scoped updates plus existing candidate IDs; each atomic proposal is previewed through the decision engine before return. Stock/category/currency/rejection safeguards are never relaxed automatically. Scope and unrelated exclusions are preserved explicitly.
- Shared Zod catalog/config/result/evidence schemas; catalog README, architecture, data model, agent contract, decisions, scenario coverage, root/shared READMEs and milestone/checklist updates.

### Acceptance evidence

| M2 acceptance criterion                          | Evidence                                                                                                                                                                                                                                   | Result |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Hard constraints never violated in exact matches | Existing M1 guard reused; independent matrix over 4 categories × 4 budgets × 3 materials with global/category exclusions; separate stock, currency, missing attributes, color, ID, case and plated-material cases; A01–A05/A15 integration | Pass   |
| Rejection signals affect ranking                 | A06 similar statement/oversized product moves below quiet product after too-flashy rejection; factual reason mappings, latest-reason/reversal/save behavior, explicit-instruction priority, and A14 session/category isolation             | Pass   |
| Same inputs produce deterministic output         | Repeated searches, reversed catalog order, JSON session restoration, code-point ID ties, stable proposal grouping/order, and immutable input/output tests                                                                                  | Pass   |

A07 additionally verifies that impossible constraints return zero exact results and feasible proposals, including multiple changed fields and exclusions from multiple scopes. Every proposal's candidate is rechecked after applying its updates. Catalog absence, stock/currency/category barriers and rejected-only catalogs remain honest empty results. Full test/policy details: `tests/catalog.test.ts`, `packages/catalog/README.md`, `docs/TEST_SCENARIOS.md`.

### Validation commands and results

| Command                                                              | Result                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm install --offline --ignore-scripts --no-audit --no-fund`        | Pass; registers the catalog workspace and lockfile entry; no new external dependency versions           |
| `npm run check`                                                      | Pass: ESLint, root API/domain/catalog/tests TypeScript, mobile TypeScript, **170 tests across 5 files** |
| `npm run export:android`                                             | Pass: 1,251 modules, 27 assets, 2.8 MB Hermes bundle; shared catalog contract exports resolve in Metro  |
| `npm ls @youcam/catalog @youcam/shared react react-native --depth=0` | Pass: workspace links resolve; React 19.2.3 / React Native 0.86.3 retained                              |
| `npm ls @youcam/catalog zod --depth=1`                               | Pass: catalog/shared use the same existing Zod 3.25.76                                                  |

The **65 new M2 tests** retain all **105 previous M0/M1/stabilization tests**, including React/React Native/Reanimated/Worklets singleton and generated native configuration regressions. Native/mobile implementation and dependencies are unchanged, so the completed SDK 57 physical launch/icon/success/error/retry evidence remains applicable; no new binary rebuild was necessary. The existing audit baseline remains tracked in the stabilization section (15 affected nodes); M2 added no external dependency versions and did not rerun the online security audit.

### Scope and remaining work

No M2 validation failure or unmet acceptance criterion remains. Product fixture assets/prices/stock are explicitly synthetic; real merchant integration is outside this milestone. Language interpretation and tool/API routing remain M3, shopping UI M4, persistence M5, provider VTO M6, live LLM M7, dependency/comparison/cross-category intelligence M8. Session search results are not wired into the M0 connectivity preview, which continues to state its limitations honestly. No live API credits were consumed.

## 2026-10-02 — SDK 57 stabilization complete

Stabilization is **complete**. SDK 57 dependency alignment, rename, launcher icon, native build/install, and all physical-device checks pass. M0/M1 acceptance remains satisfied; the final automated suite has **105 passing tests**. M2 is **not started**; work stops here as requested. Live YouCam/LLM calls: **zero**.

### Migration and rename

Followed the [official Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/): install target Expo, run `npx expo install --fix`, install SDK-compatible native peers, check dependencies with `npx expo install --check`, run Expo Doctor, and regenerate the ignored Android project with `npx expo prebuild --clean --platform android --no-install`. Reviewed SDK 55–57 release notes. SDK 55+ requires New Architecture and removes the old app-config flag; Android `newArchEnabled=true` and Hermes remain verified. No React Native internals were patched.

| Dependency                  | SDK 57 version    |
| --------------------------- | ----------------- |
| Expo                        | 57.0.26           |
| React / React DOM           | 19.2.3            |
| React Native                | 0.86.3            |
| Expo Router / dev-client    | 57.0.24 / 57.0.19 |
| Constants / Linking         | 57.0.20 / 57.0.11 |
| Status Bar / System UI      | 57.0.1 / 57.0.4   |
| Screens / Safe Area Context | 4.26.0 / 5.7.0    |
| Reanimated / Worklets       | 4.5.1 / 0.10.1    |

The SDK 54 baseline was React 19.1.0 / React Native 0.81.5. npm initially retained hoisted Reanimated 4.7.0 / Worklets 0.13.0 alongside the supported versions; install/dedupe alone did not remove them. Root anchors and overrides now enforce the supported versions, and the full `npm ls` check passes with no invalid peers. Lockfile singleton tests cover React, React DOM, React Native, Reanimated, and Worklets.

Changed Expo display name, slug/scheme, mobile heading, root package name, README and product prose to Shopping Concierge. Generated Android `app_name` is Shopping Concierge. Internal `com.youcam.shoppingconcierge` and `@youcam/*` identifiers remain stable for in-place app updates and workspace imports; they are not display branding. Provider/integration references to YouCam remain. Historical validation URLs describe the old build. Android versionCode is now 2.

Configured an opaque Expo icon plus Android adaptive foreground/background and monochrome mask. Temporary shopping-bag artwork was visually inspected; replacement/reproduction instructions are in `apps/mobile/assets/README.md`. Generated native adaptive XML references the correct foreground and monochrome resources. The installed Samsung launcher displays the full Shopping Concierge label and the correct pine/ivory/gold shopping-bag icon; see physical evidence below.

### Automated validation

- `npm run check`: lint, both typecheck stages, **105 tests in 4 files pass** (original 103 retained, two native-peer singleton cases added).
- `npm run export:android`: passes; 1,250 modules / 2.8 MB Hermes bundle.
- `npx expo-doctor`: **20/20 enabled checks pass**. Existing Git-dependent app-config-sync heuristic exclusion remains documented; clean prebuild and generated native assertions validate config synchronization.
- `npx expo install --check`: dependencies up to date.
- `npm ls react react-dom react-native react-native-reanimated react-native-worklets --all`: exit 0, no conflicts. Evidence `/tmp/concierge-sdk57-dependencies.txt`.
- Native prebuild: passes; Gradle 9.3.1, Android SDK/Build Tools 36, NDK 27.1.12297006, Kotlin 2.1.20, JDK 17. Successful native build log `/tmp/concierge-sdk57-build-retry.log`.
- Metro started with `NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 CI=1 npm run dev:clear -- --localhost` (IPv4 ordering avoids this host binding localhost only to `::1`); manifest confirms `exposdk:57.0.0` and Shopping Concierge; mock API `/health` returns HTTP 200 and mode mock.

### Native build and installation

- `:app:assembleDebug` succeeded: **455 actionable tasks**, after retrying Maven/Google connection-refused/timeouts for React Native, Hermes, collection, and viewbinding downloads. No source changes or native-library workarounds were needed for the retry.
- Command from `apps/mobile/android`:

```sh
ANDROID_HOME=/tmp/youcam-android-sdk ANDROID_SDK_ROOT=/tmp/youcam-android-sdk \
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home \
JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true NODE_ENV=development \
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a \
  -PreactNativeDevServerPort=8082 \
  -Dorg.gradle.internal.http.socketTimeout=45000 \
  -Dorg.gradle.internal.http.connectionTimeout=15000 \
  --no-daemon --max-workers=4 --console=plain --info
```

- APK: `artifacts/android/shopping-concierge-sdk57-development.apk`; SHA-256 `cd3083e13e06e3433c14f4f29132ec4a2ccb75652cce449014d561e0e9da74a8`.
- `adb -s R3CT2019D9D install -r artifacts/android/shopping-concierge-sdk57-development.apk`: **Success** on Samsung SM-S908N. Installed versionCode **2** replaces versionCode 1. Recall was not changed.
- `aapt dump badging` confirms Shopping Concierge label, adaptive launcher resources, package identity, and arm64-v8a. Generated BuildConfig confirms New Architecture and Hermes enabled.
- USB forwarding for 8082/4000 restored; launched the new `exp+shopping-concierge` development URI. Metro compiled 1,416 development modules. The initial locked-device blocker was resolved when the user unlocked the phone; all visible checks below then passed.

### Physical-device stabilization — passed

Device: Samsung SM-S908N, Android 16, USB serial `R3CT2019D9D`; installed package `com.youcam.shoppingconcierge`, versionCode 2. Checked the running SDK 57 development build against cache-cleared Metro and mock services only.

| Check               | Observed result                                                                                                                                                                                         | Evidence                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Visible launch      | Shopping Concierge heading and foundation screen render; no red runtime screen                                                                                                                          | [Launch](evidence/sdk57/visible-launch.png)              |
| Launcher label/icon | Samsung app drawer shows full **Shopping Concierge** label and centered shopping-bag artwork, with no default APK icon                                                                                  | [Launcher](evidence/sdk57/launcher.png)                  |
| Launch from icon    | Tapping that entry resumes `com.youcam.shoppingconcierge/.MainActivity` with the healthy app screen                                                                                                     | [Opened from launcher](evidence/sdk57/launcher-open.png) |
| Mock success        | Send returns HTTP 200 and the honest foundation-connected response; no fabricated products                                                                                                              | [Success](evidence/sdk57/success.png)                    |
| Recoverable error   | Temporarily pausing the mock API causes the ten-second request timeout and “Unable to reach the concierge. Check your connection and try again.” Input remains available                                | [Error](evidence/sdk57/error.png)                        |
| Retry recovery      | Resume mock API, restore USB forwarding, tap Send again without restarting: HTTP 200, error clears, success response returns                                                                            | [Retry](evidence/sdk57/retry.png)                        |
| Runtime errors      | Current process log (PID 30466, 986 lines) has zero matches for PlatformConstants, Invariant Violation, FATAL EXCEPTION, or ReactNativeJS Error/Exception; visible checks show no runtime error overlay | `/tmp/concierge-sdk57-device-final.log`                  |

Commands: `adb shell am start -a android.intent.action.VIEW -d 'exp+shopping-concierge://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' com.youcam.shoppingconcierge`, `adb shell input`, `adb exec-out screencap -p`, `adb shell uiautomator dump`, `adb shell dumpsys activity activities`, and `adb logcat -d --pid=30466`. All device commands targeted serial `R3CT2019D9D`.

Failure injection: removing port 4000 forwarding alone preserved an existing HTTP keep-alive connection, so it was insufficient. `kill -STOP 53768` paused only the local mock API to exercise the actual timeout; `kill -CONT 53768` and `adb reverse tcp:4000 tcp:4000` restored it before retry. API log `/tmp/concierge-sdk57-api.log` confirms successful POST responses before/after failure. Metro forwarding on 8082 remained available. The mock API was left running, USB forwarding restored, and the healthy app foregrounded.

No implementation changes were needed during physical verification; the previously completed lint/typechecks, **105 tests**, Android bundle/build, dependency singleton checks, and **20/20 Expo Doctor** results remain applicable. All requested stabilization acceptance checks pass. Known npm audit advisories below remain tracked and are not a claim of an audit-clean release.

### Dependency advisories

`npm audit --json`: **15 affected dependency nodes (11 moderate, 4 high)** versus SDK 54's 19 (17 moderate, 2 high). Previous image-size/postcss high findings are absent. Current high findings involve node-forge and its Expo code-signing/CLI/Expo parents; moderate findings include decode-uri-component/query-string/Router and uuid/xcode/Expo tooling. Full evidence: `/tmp/concierge-sdk57-audit.json`. Doctor passing does not mean npm audit is clean. No forced cross-SDK audit fix or React Native internal patch was used.

## 2026-10-02 — M1 complete

Implemented M1 without changing product scope or consuming live API credits. M2 is not started. No M1 manual verification or external integration is required by its acceptance criteria; no criterion was skipped.

### Delivered

- `packages/shared/src/domain.ts`: strict runtime schemas and inferred types for products, category/image enums, scoped/provenanced constraints, feedback/reasons, decisions, dependencies, versioned session snapshots, proposed actions, and JSON-safe change events. The original `domain.ts` now re-exports this source of truth.
- `@youcam/decision-engine`: pure validated/immutable transitions, effective constraint resolution, hard eligibility guard for new selections, reason-bearing session feedback, decision preservation across categories, and event/no-op semantics. Registered in npm workspaces/lockfile using existing dependencies only.
- `fixtures/m1-scenarios.json`, `tests/decision-engine.test.ts`, and `tests/domain.test.ts`: deterministic state scenarios with serialization between turns, malformed-input/snapshot checks, feedback/idempotency checks, and catalog-ID/constraint guards.
- Updated shared/decision-engine READMEs, architecture/data-model/agent contracts, decisions, scenario coverage map, README, milestone and checklist docs.

### Acceptance evidence

| M1 acceptance criterion                                             | Automated evidence                                                                                                                                                                                           | Result |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Cheaper/material/category switching preserves unrelated constraints | A01–A04 structured fixture replay; exact effective-state comparisons; material replacement changes one slot; cheaper preference retains USD 120 cap, wedding, material and style                             | Pass   |
| Category-specific constraints do not bleed                          | A05 dangling exclusion and category-only price preference disappear from necklace resolution; category budget isolation; A13 round trip restores scoped constraints and selected/shortlisted/saved decisions | Pass   |
| Explicit preference overrides inference                             | A15 explicit silver vs later category-specific visual gold; explicit vs saved/visual/heuristic tested in both orders; inferred material remains soft                                                         | Pass   |

Additional coverage includes A14 session-only reasons, A16 idempotent save, malformed/corrupt snapshots, unknown/mismatched catalog IDs, new-selection hard-constraint failures, dependent-anchor invalidation, deterministic events, input immutability and source-export compatibility. Full language extraction/ranking/VTO/database scenarios remain mapped to later milestones in `TEST_SCENARIOS.md`; M1 does not claim those pass end-to-end.

### Validation commands and results

| Command                                                                      | Result                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm install --offline --ignore-scripts --no-audit --no-fund`                | Pass; links new internal engine workspace and updates lockfile; no external dependencies added   |
| `npm run check`                                                              | Pass: ESLint, API/shared/engine TypeScript, Expo mobile TypeScript, **103 tests across 4 files** |
| `CI=1 EXPO_OFFLINE=1 npm run export:android`                                 | Pass: Android bundle/24 assets produced; existing native dependencies unchanged                  |
| `npm ls @youcam/decision-engine @youcam/shared react react-native --depth=0` | Pass: engine/shared workspace links resolve; React 19.1.0 and RN 0.81.5 retained                 |
| Live LLM/YouCam                                                              | **Zero calls**                                                                                   |

The final suite contains all 29 previous M0 checks, one shared-source import regression, and 73 new domain/engine cases. The 7 fixture cases replay typed proposals; utterance labels are explanatory, not an implemented mock intent parser.

### Failures found and resolved

- A repeated explicit value could incorrectly be treated as a no-op while a newer conflicting scope still won. Reassertion now advances its record when needed; tests cover both global and category directions.
- Android export initially failed because Metro does not substitute a `.ts` source for a runtime `.js` re-export. Shared source exports now name real `.ts` files, with `allowImportingTsExtensions` in both no-emit TypeScript configurations. Added a shared import-boundary regression and reran the full checks and Android export successfully.
- No remaining M1 test/typecheck/lint/build failures. No native dependency changes or new device acceptance requirement were introduced; M0 physical-device evidence remains below.
- No fresh advisory network audit was run: this milestone adds only an internal workspace link to existing shared/Zod dependencies. The prior known baseline remains 19 advisories (17 moderate, 2 high); resolving Expo transitive advisories is still outstanding and is not claimed fixed by M1.

### Next milestone boundary

M2 catalog fixtures/filtering/ranking/no-match relaxations is next. The API/mobile remain the explicit M0 preview until agent/mobile integration milestones; M1 state is in a pure domain snapshot, not yet persisted in Supabase. No hidden setup steps or credentials are needed to reproduce M1 checks.

## 2026-10-02 — Physical-device acceptance passed

**M0 is complete. M1 has not started**, per the user's instruction to stop at this milestone.

- Device: Samsung SM-S908N, Android 16, arm64-v8a, connected by authorized USB debugging.
- Installed `artifacts/android/youcam-m0-development.apk` using `adb -s R3CT2019D9D install -r`: **Success**. Installed identity: `com.youcam.shoppingconcierge`, version 0.1.0 (versionCode 1). Recall was left untouched.
- Restored USB forwarding for ports 8082 (Metro) and 4000 (mock API), then launched the explicit `exp+youcam-shopping-concierge://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082` URI targeted at the Shopping Concierge package. Metro had been started with `--clear` after correcting the dependency set.
- **Native launch passed:** Shopping Concierge's concierge screen rendered without a red runtime screen. Verified via UIAutomator hierarchy and visual screenshot inspection. The running process belonged to the Shopping Concierge package; captured process logs contained no `PlatformConstants`, `Invariant Violation`, `FATAL EXCEPTION`, or ReactNativeJS error matches.
- **Mock API success passed:** submitted a shopping goal on the device; UI displayed “The concierge foundation is connected. Shopping search and saved decisions are not available yet.”
- **Failure recovery passed:** temporarily removed only API port forwarding, tapped Send, and observed “Unable to reach the concierge. Check your connection and try again.” Restored forwarding and tapped Send again: success response returned and the error cleared. Metro remained connected throughout.
- `npm run check` rerun after installation: lint passes, API/shared/mobile typechecks pass, **29 tests pass**. Prior successful install, `/health`, Expo diagnostics, and Android bundle/native build checks remain applicable; there were no code/dependency changes during this device verification.
- Temporary evidence: `/tmp/youcam-m0-success.xml`, `/tmp/youcam-m0-error.xml`, `/tmp/youcam-m0-recovered.xml`, `/tmp/youcam-m0-device.log`, `/tmp/youcam-m0-verified.png`.
- Left the installed Shopping Concierge app, Metro on 8082, mock API on 4000, and USB forwarding available for continued manual preview. No live LLM or YouCam calls were made.
- Dependency advisories remain **19 (17 moderate, 2 high)** as recorded below. M0 acceptance is not a production-security signoff.

## 2026-10-01 — Physical-device runtime repair

The repair and build history below preceded the successful 2026-10-02 acceptance check.

### Root cause and evidence

- The user confirmed that the failed launch loaded Shopping Concierge JavaScript in the pre-existing **Recall development binary**, not a Shopping Concierge build. That native binary does not establish the React Native/Expo module contract required by this project; Metro reloads cannot change it. This is the primary wrong-binary cause of the reported `PlatformConstants` error. Recall’s exact native dependency versions were not inspected, so no specific Recall version or architecture mismatch is asserted.
- Independently, the original workspace installed React 19.1.0 inside the mobile workspace and React 19.3.0 at the root; Router and React Native resolved the root copy. Expo Doctor reported duplicate React. Only one React Native version (0.81.5) was installed. The duplicate is fixed rather than hidden by Metro aliases.
- Expo Go 57.0.9 is also installed, but the user confirmed it was **not** the failing runtime. No Shopping Concierge package was installed before this repair.
- There was no Android native project or `expo-dev-client` dependency before this repair. SDK 54 version checks alone could not establish compatibility with Recall’s binary.

### Exact changes

- Root `package.json`: anchor React and React DOM at 19.1.0, override peer resolution to those root dependencies, pin React Native resolution to 0.81.5, and add `android:build`. Regenerate `package-lock.json`. Direct root anchoring was necessary: adding overrides alone left npm’s stale hoisted 19.3.0 resolution in place.
- `apps/mobile/package.json`: install SDK-compatible `expo-dev-client ~6.0.21`, `react-dom 19.1.0`, and `expo-system-ui ~6.0.9`; start Metro with `--dev-client` on port 8082; provide `dev:clear`; run prebuild before `expo run:android --device`.
- `apps/mobile/app.json`: explicitly enable New Architecture. Generated Gradle properties confirm `newArchEnabled=true` and Hermes; native package is `com.youcam.shoppingconcierge`, with project-specific development-client scheme. No React Native internal files or PlatformConstants workarounds were changed.
- Ignore generated native directories and exclude them from source linting. Expo Doctor’s app-config-sync heuristic is disabled for this Git-less CNG workspace; the build script always runs prebuild. Dependency, duplicate, and New Architecture checks remain enabled.
- Add eight runtime-alignment regressions in `tests/mobile-runtime.test.ts` covering lockfile singletons, SDK versions, React module identity, native app identity, explicit architecture, and rebuild/cache-clear commands.
- Update root/mobile README with dedicated-binary, USB forwarding, Metro isolation, and rebuild instructions.
- Local build tooling: downloaded Android command-line tools/SDK 36 into `/tmp/youcam-android-sdk`; use existing JDK 17. Generated native project is a local artifact, not a hand-maintained source tree.

### JavaScript/configuration validation

- Initial `npx expo-doctor`: 17/18, failed duplicate React.
- Final `npx expo-doctor`: 17/17 enabled checks pass (native-config heuristic excluded for the documented prebuild workflow).
- `npx expo install --check`: passes online.
- Module resolution from root, mobile, React Native, and Router now points to one React 19.1.0; React Native is 0.81.5.
- `npm run check`: lint, API/shared/mobile typechecks, **29 tests pass**.
- `npx expo prebuild --platform android --no-install`: passes. SDK 36, NDK 27.1.12297006, Kotlin 2.1.20; native config inspected.
- Initial Gradle build hit Maven DNS errors; a fresh-process retry passed dependency/plugin setup, then stalled downloading NDK. The stalled build was terminated deliberately; retryable archive downloads are being verified against Google’s published checksum. A temporary USB disconnect was resolved by reconnecting the phone.
- Cache-cleared Metro: `EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 CI=1 npm run dev:clear -- --localhost` in `apps/mobile`. Manifest on port 8082 reports `exposdk:54.0.0`.
- `adb reverse tcp:8082 tcp:8082` and `adb reverse tcp:4000 tcp:4000` connect the dedicated app services over USB.
- Real HTTP `/health`: 200, mock mode. Zero live LLM/YouCam calls.

### Native build result

- Built successfully with JDK 17.0.20.1, Gradle 8.14.3, Android platform 36, Build Tools 35/36, NDK 27.1.12297006, and CMake 3.22.1. The build targets the Samsung device’s arm64-v8a ABI.
- After network retries, the successful command (from `apps/mobile/android`) was:

```sh
ANDROID_HOME=/tmp/youcam-android-sdk ANDROID_SDK_ROOT=/tmp/youcam-android-sdk \
JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true \
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a \
  -PreactNativeDevServerPort=8082 \
  -Dorg.gradle.internal.http.socketTimeout=45000 \
  -Dorg.gradle.internal.http.connectionTimeout=15000 \
  --no-daemon --max-workers=4 --console=plain
```

- Result: `BUILD SUCCESSFUL`, 328 actionable tasks. Build log: `/tmp/youcam-android-build-ipv4.log`. APK copied to `artifacts/android/youcam-m0-development.apk` (ignored binary).
- NDK and Build Tools 35 downloads needed retryable segments due connection resets; complete archives matched Google’s published SHA-1 checksums before extraction. No dependency internals were modified.
- APK SHA-256: `f54b92945222e00e64b1e7b8aabad4f02cf2f1174ae5751cfdba840082f3f78a`. Generated `BuildConfig.java` confirms both `IS_NEW_ARCHITECTURE_ENABLED` and `IS_HERMES_ENABLED` are true.
- Installation attempt encountered a disconnected device (`adb: device R3CT2019D9D not found`); requested reconnection. This was resolved by reconnection and the successful installation/verification on 2026-10-02 recorded above.
- Corrected `npm run export:android` passes. Final JavaScript checks: 29 passing tests, lint and typechecks pass.

### Dependency advisories

`npm audit --json`: **19 advisories (17 moderate, 2 high)**, up from 16 (14 moderate, 2 high). The three additional affected dependency nodes are `expo-dev-client`, `expo-dev-launcher`, and `expo-manifests`, inheriting existing Expo transitive findings. The high `image-size` and `postcss` findings remain. No forced cross-SDK audit upgrades were applied as a runtime fix.

## 2026-10-01 — M0 foundation (historical)

M0 is **not complete**: Android native boot/interaction remains unverified. M1 has not started. No live LLM or YouCam calls were made.

### Implemented

- npm workspaces and lockfile; single root install command.
- Expo SDK 54 / Expo Router / React Native / TypeScript scaffold.
- Fastify app factory and server, `/health`, and an explicitly non-shopping mock message endpoint.
- Shared Zod request/response schemas; validated mobile responses.
- Injectable mock LLM and YouCam connectivity fixtures with failure/latency support.
- Vitest unit/API tests, ESLint, API/shared/mobile typechecking, Android export command.
- Server/public-mobile environment examples and documented local/device setup.

### Checks

| Command/check                                                    | Result                                                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                                    | Passed; workspace lockfile generated.                                                                                 |
| `npm ci`                                                         | Passed; clean install from lockfile.                                                                                  |
| `npm run check` after clean install                              | Passed: lint, API/shared and mobile typechecks, 21 tests.                                                             |
| `CI=1 EXPO_OFFLINE=1 npm run export:android` after clean install | Passed; Android bundle and assets emitted. Does not prove native boot.                                                |
| `CI=1 EXPO_OFFLINE=1 npx expo install --check` in `apps/mobile`  | Installed dependencies match SDK's local compatibility list; offline check is not an online doctor check.             |
| `npm run dev:api` + HTTP `GET /health`                           | Passed: HTTP 200, `{ status: "ok", service: "youcam-api", mode: "mock" }`. Temporary server stopped after validation. |
| `adb devices`                                                    | No attached devices. No Android SDK emulator/AVD found at the host's standard locations.                              |
| Live LLM / YouCam                                                | Zero calls.                                                                                                           |

### Known limitations and failures

- **External acceptance blocker:** no Android device/emulator is available. Android compilation is verified, native startup and tapping Send are not. Follow the Android preview instructions in the root README, verify both a successful response and API-unreachable recovery, then record the device/version/result here before marking M0 complete. The per-milestone gate in `AGENTS.md` prohibits moving to M1 until this is done.
- npm audit reports **16 advisories (14 moderate, 2 high)** in the remaining dependency tree. High findings are in `image-size` and Expo Metro's pinned `postcss`; moderate findings include Expo's `uuid`/`xcode` and routing dependencies. This scaffold is not production ready. Resolve using an Expo-compatible upgrade and rerun native checks before deployment; do not assume a forced audit fix preserves SDK compatibility.
- Upgrading Vitest resolved its reported advisory but initially selected Vite 8, whose native Rolldown binding failed to load on this host. The final configuration uses Vitest 4.1.11 with supported Vite 7.3.6; tests pass after a clean install.
- The development host runs Node 25.9.0 / npm 11.13.0. Node 22 LTS is recommended in setup docs, but was not available for a separate run.
- A01–A18 remain future domain/agent regression work. These 21 foundation tests do not claim scenario coverage.
- The directory has no Git repository metadata; no commit was made.

### Resume point

1. Complete the Android native boot/Send/error smoke check with a compatible Expo Go device/emulator.
2. Record evidence and close M0 only if all acceptance criteria pass.
3. Begin M1 shared domain schemas and decision-engine transitions; follow its scope/precedence acceptance criteria and add corresponding regression scenarios.
