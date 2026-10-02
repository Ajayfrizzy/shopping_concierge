# Validation log

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

| M2 acceptance criterion | Evidence | Result |
| --- | --- | --- |
| Hard constraints never violated in exact matches | Existing M1 guard reused; independent matrix over 4 categories × 4 budgets × 3 materials with global/category exclusions; separate stock, currency, missing attributes, color, ID, case and plated-material cases; A01–A05/A15 integration | Pass |
| Rejection signals affect ranking | A06 similar statement/oversized product moves below quiet product after too-flashy rejection; factual reason mappings, latest-reason/reversal/save behavior, explicit-instruction priority, and A14 session/category isolation | Pass |
| Same inputs produce deterministic output | Repeated searches, reversed catalog order, JSON session restoration, code-point ID ties, stable proposal grouping/order, and immutable input/output tests | Pass |

A07 additionally verifies that impossible constraints return zero exact results and feasible proposals, including multiple changed fields and exclusions from multiple scopes. Every proposal's candidate is rechecked after applying its updates. Catalog absence, stock/currency/category barriers and rejected-only catalogs remain honest empty results. Full test/policy details: `tests/catalog.test.ts`, `packages/catalog/README.md`, `docs/TEST_SCENARIOS.md`.

### Validation commands and results

| Command | Result |
| --- | --- |
| `npm install --offline --ignore-scripts --no-audit --no-fund` | Pass; registers the catalog workspace and lockfile entry; no new external dependency versions |
| `npm run check` | Pass: ESLint, root API/domain/catalog/tests TypeScript, mobile TypeScript, **170 tests across 5 files** |
| `npm run export:android` | Pass: 1,251 modules, 27 assets, 2.8 MB Hermes bundle; shared catalog contract exports resolve in Metro |
| `npm ls @youcam/catalog @youcam/shared react react-native --depth=0` | Pass: workspace links resolve; React 19.2.3 / React Native 0.86.3 retained |
| `npm ls @youcam/catalog zod --depth=1` | Pass: catalog/shared use the same existing Zod 3.25.76 |

The **65 new M2 tests** retain all **105 previous M0/M1/stabilization tests**, including React/React Native/Reanimated/Worklets singleton and generated native configuration regressions. Native/mobile implementation and dependencies are unchanged, so the completed SDK 57 physical launch/icon/success/error/retry evidence remains applicable; no new binary rebuild was necessary. The existing audit baseline remains tracked in the stabilization section (15 affected nodes); M2 added no external dependency versions and did not rerun the online security audit.

### Scope and remaining work

No M2 validation failure or unmet acceptance criterion remains. Product fixture assets/prices/stock are explicitly synthetic; real merchant integration is outside this milestone. Language interpretation and tool/API routing remain M3, shopping UI M4, persistence M5, provider VTO M6, live LLM M7, dependency/comparison/cross-category intelligence M8. Session search results are not wired into the M0 connectivity preview, which continues to state its limitations honestly. No live API credits were consumed.

## 2026-10-02 — SDK 57 stabilization complete

Stabilization is **complete**. SDK 57 dependency alignment, rename, launcher icon, native build/install, and all physical-device checks pass. M0/M1 acceptance remains satisfied; the final automated suite has **105 passing tests**. M2 is **not started**; work stops here as requested. Live YouCam/LLM calls: **zero**.

### Migration and rename

Followed the [official Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/): install target Expo, run `npx expo install --fix`, install SDK-compatible native peers, check dependencies with `npx expo install --check`, run Expo Doctor, and regenerate the ignored Android project with `npx expo prebuild --clean --platform android --no-install`. Reviewed SDK 55–57 release notes. SDK 55+ requires New Architecture and removes the old app-config flag; Android `newArchEnabled=true` and Hermes remain verified. No React Native internals were patched.

| Dependency | SDK 57 version |
| --- | --- |
| Expo | 57.0.26 |
| React / React DOM | 19.2.3 |
| React Native | 0.86.3 |
| Expo Router / dev-client | 57.0.24 / 57.0.19 |
| Constants / Linking | 57.0.20 / 57.0.11 |
| Status Bar / System UI | 57.0.1 / 57.0.4 |
| Screens / Safe Area Context | 4.26.0 / 5.7.0 |
| Reanimated / Worklets | 4.5.1 / 0.10.1 |

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

| Check | Observed result | Evidence |
| --- | --- | --- |
| Visible launch | Shopping Concierge heading and foundation screen render; no red runtime screen | [Launch](evidence/sdk57/visible-launch.png) |
| Launcher label/icon | Samsung app drawer shows full **Shopping Concierge** label and centered shopping-bag artwork, with no default APK icon | [Launcher](evidence/sdk57/launcher.png) |
| Launch from icon | Tapping that entry resumes `com.youcam.shoppingconcierge/.MainActivity` with the healthy app screen | [Opened from launcher](evidence/sdk57/launcher-open.png) |
| Mock success | Send returns HTTP 200 and the honest foundation-connected response; no fabricated products | [Success](evidence/sdk57/success.png) |
| Recoverable error | Temporarily pausing the mock API causes the ten-second request timeout and “Unable to reach the concierge. Check your connection and try again.” Input remains available | [Error](evidence/sdk57/error.png) |
| Retry recovery | Resume mock API, restore USB forwarding, tap Send again without restarting: HTTP 200, error clears, success response returns | [Retry](evidence/sdk57/retry.png) |
| Runtime errors | Current process log (PID 30466, 986 lines) has zero matches for PlatformConstants, Invariant Violation, FATAL EXCEPTION, or ReactNativeJS Error/Exception; visible checks show no runtime error overlay | `/tmp/concierge-sdk57-device-final.log` |

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

| M1 acceptance criterion | Automated evidence | Result |
| --- | --- | --- |
| Cheaper/material/category switching preserves unrelated constraints | A01–A04 structured fixture replay; exact effective-state comparisons; material replacement changes one slot; cheaper preference retains USD 120 cap, wedding, material and style | Pass |
| Category-specific constraints do not bleed | A05 dangling exclusion and category-only price preference disappear from necklace resolution; category budget isolation; A13 round trip restores scoped constraints and selected/shortlisted/saved decisions | Pass |
| Explicit preference overrides inference | A15 explicit silver vs later category-specific visual gold; explicit vs saved/visual/heuristic tested in both orders; inferred material remains soft | Pass |

Additional coverage includes A14 session-only reasons, A16 idempotent save, malformed/corrupt snapshots, unknown/mismatched catalog IDs, new-selection hard-constraint failures, dependent-anchor invalidation, deterministic events, input immutability and source-export compatibility. Full language extraction/ranking/VTO/database scenarios remain mapped to later milestones in `TEST_SCENARIOS.md`; M1 does not claim those pass end-to-end.

### Validation commands and results

| Command | Result |
| --- | --- |
| `npm install --offline --ignore-scripts --no-audit --no-fund` | Pass; links new internal engine workspace and updates lockfile; no external dependencies added |
| `npm run check` | Pass: ESLint, API/shared/engine TypeScript, Expo mobile TypeScript, **103 tests across 4 files** |
| `CI=1 EXPO_OFFLINE=1 npm run export:android` | Pass: Android bundle/24 assets produced; existing native dependencies unchanged |
| `npm ls @youcam/decision-engine @youcam/shared react react-native --depth=0` | Pass: engine/shared workspace links resolve; React 19.1.0 and RN 0.81.5 retained |
| Live LLM/YouCam | **Zero calls** |

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

| Command/check | Result |
| --- | --- |
| `npm install` | Passed; workspace lockfile generated. |
| `npm ci` | Passed; clean install from lockfile. |
| `npm run check` after clean install | Passed: lint, API/shared and mobile typechecks, 21 tests. |
| `CI=1 EXPO_OFFLINE=1 npm run export:android` after clean install | Passed; Android bundle and assets emitted. Does not prove native boot. |
| `CI=1 EXPO_OFFLINE=1 npx expo install --check` in `apps/mobile` | Installed dependencies match SDK's local compatibility list; offline check is not an online doctor check. |
| `npm run dev:api` + HTTP `GET /health` | Passed: HTTP 200, `{ status: "ok", service: "youcam-api", mode: "mock" }`. Temporary server stopped after validation. |
| `adb devices` | No attached devices. No Android SDK emulator/AVD found at the host's standard locations. |
| Live LLM / YouCam | Zero calls. |

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
