# Android standalone release

**Current beta release:** version 0.1.0 / code 11, accepted source `6e88b5318c035572fe39a99f4c148477583ec01c`, already included in main. [Download the verified v11 APK](https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v11-arm64-release.apk) from the [existing release](https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android). The release tag remains at its historical commit; its attached APK is the separately identified v11 artifact. No tag history is rewritten.

SHA-256: `82f7efad6957d71a3778d127140d23009b6d9081b2675ec9c8ab8d63ec7f9ed0`. Package `com.youcam.shoppingconcierge`; ARM64 only; Android 7/API 24+; standalone; internet and live backend required. Certificate SHA-256: `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34`.

The public unauthenticated v11 download returned HTTP 200 and matched the expected SHA-256 on October 24, 2026 (43,964,439 bytes). The superseded v6 release asset was removed; the original tag commit is unchanged.

The accepted artifact was reverified on October 24, 2026 without rebuilding: signature valid, version code 11, production HTTPS URL embedded, 1,299 APK entries scanned against five configured sensitive values with zero matches. See [v11 implementation/native acceptance](ANDROID_PRIVATE_IMAGE_RELOAD_V11.md). The old v6 asset is superseded; dated acceptance reports remain historical evidence.

**[Official demonstration](https://youtube.com/shorts/8SNE4YJEOBI?feature=share)**. The owner reviewed and published the narrated video. Live VTO outputs expire; recorded footage does not promise continued access to the private demo result. Sample products are illustrative, with no merchant inventory or checkout. Try-on previews are a visual aid, not guaranteed physical fit.

The build instructions below are contributor reference; no rebuild is required to install the verified artifact. Earlier build failures and acceptance records below are historical.

The first release targets the private production API at https://shoppingconcierge.rumptycloud.app. Build baseline: e6703cfadf6b21de195536f7fc596b90696ce999. No provider credentials belong in the app.

## Reproducible local build

```sh
ANDROID_HOME=/path/to/Android/sdk node scripts/build-android-release.mjs
```

Requires Java17, Android SDK/NDK and Gradle dependency network access. The script removes inherited provider/database/storage and public Expo environment variables, disables dotenv loading, and sets the single production HTTPS URL. It runs Expo prebuild followed by Gradle assembleRelease with bundled Hermes JavaScript. The current artifact targets ARM64 devices (including the available ARM64 emulator), not x86/32-bit phones. No Metro or Expo Go is needed.

A dedicated RSA3072 release key and password are generated once under ignored `artifacts/android/signing/` with restricted local permissions. They are not committed, bundled or printed. Back up this directory securely: future in-place updates must use the same certificate. This is a locally signed sideload release, not Google Play signing. Existing debug-signed builds with the same app ID cannot be upgraded in place with this key; do not uninstall a user's existing app without first addressing its session data.

The release-only Expo plugin disables cleartext traffic and Android backup and removes development overlay and obsolete write-storage permissions from the app manifest. The merged APK manifest must also be inspected. Gallery/photo picker only: camera/audio are deliberately disabled. API URL defaults are production HTTPS in release and emulator-local only in development. Shopping timeout is40 seconds, above the server planner's20-second limit. VTO submission/polling retain their existing stable-ID behavior.

## Paid-operation safety

Result refresh/boot previously sent a natural-language `search` through the live planner. It now uses the existing deterministic category action, preserving constraints and ranking without a new OpenAI call. Pending explicit shopper requests still replay their original durable IDs. SecureStore holds the guest credential; a durable private journal holds pending request/context and session references. Provider accounting and VTO idempotency remain server-owned. No paid request is necessary to launch or inspect navigation.

## Journey coverage

Automated tests cover session creation/restoration, grounded cards/images, typed rejection, free-text card productContext and exact retry, deliberate selection, cross-category dependency, persistence/restart, VTO mock upload/result/failure, and network error/replay recovery. Bundled catalog images are separate from private VTO references. Native testing must not repeat paid flows without explicit authorization. A launch/navigation smoke test does not establish full live acceptance or native picker/render quality.

## Dependency review

Installed Expo57.0.27 / React Native0.86.3 / React19.2.3 match the SDK's bundled dependency map. Online Expo metadata recommends six newer patch versions: Expo57.0.30, constants57.0.22, crypto57.0.4, dev-client57.0.20, linking57.0.13, router57.0.28. This maintenance finding is recorded, not hidden as a passing online check. No major-version migration is justified by the audit. Actual build and native smoke results determine whether the current locked set is usable.

## Historical first-release audit severity (code 3)

Fixed critical: release signing previously selected the public debug key; production builds could fall back to an emulator URL. Fixed major: restore/refresh incurred unnecessary live planner calls; a10-second client timeout could expire before the20-second server planner limit. Release network/backup/permission hardening is implemented without changing camera/gallery scope.

Known minor: six available Expo patch updates and the default native splash treatment. Known acceptance limitations: ARM64-only artifact; no physical handset connected; native card/rejection/photo-picker/live-render acceptance still requires a separately authorized device session. Neither automated mocks nor read-only backend probes prove live VTO image quality.

The generated native directory is ignored and rebuilt from app config/plugin. Do not commit signing files, native build directories or APKs. Build logs and artifacts stay local; copy reviewed non-secret metadata into release evidence.

## Historical first artifact and validation result (code 3)

Artifact: `artifacts/android/shopping-concierge-0.1.0-arm64-release.apk`, **43,919,163 bytes (41.88 MiB)**. Application ID `com.youcam.shoppingconcierge`, versionName0.1.0, versionCode3, minSDK24, targetSDK36. Gradle assembleRelease succeeded. APK v2 signature verified, RSA3072 dedicated release certificate (not debug); SHA256 certificate `035ace8decc67b7214f6b2b91d0ed0cd525987f48b48d15df64c708e1c54cb34`. Artifact SHA256 `c64514150729715ca051b22cd5b80f4a03106ae8354d1bf1c625fa5b22a13b96`.

676 tests in35 files passed, including local PostgreSQL/S3 integration. ESLint, API/mobile typechecks and API build passed. Android export secret scan passed95 files/seven sentinels; final APK scan found none of five actual configured server-secret values. The APK contains embedded Hermes JavaScript and the production URL, not the emulator API URL. Merged manifest confirms no camera/audio/overlay/write-storage permissions, no cleartext and no backup. Read-only production health/readiness and E09 product lookup returned200. No paid requests or accounting mutations occurred.

**Native validation blocked, not passed:** no physical device was attached. The available ARM64 API37 emulator initially reported boot complete, then its package service failed during install with Broken pipe and activity service disappeared. After reboot the services returned but installation was refused with “device is still booting”; app launch could not run because installation had not completed. No successful install, cold launch, navigation, card/rejection UI, guest persistence or picker acceptance is claimed. Automated tests cover these controller/API paths but do not replace native acceptance. The APK is ready to transfer for device acceptance, not yet certified stable by an on-device run.

Outstanding **major acceptance gate**: install and cold-launch on a usable ARM64 Android phone/emulator and exercise safe interactions before authorizing paid device flows. **Minor**: patch updates and default splash styling. No known unresolved critical source/build blocker was found, but native runtime remains unverified. Never label the emulator failure as an application crash: the APK was not installed. No Google Play publication, demo script or video.

## Acceptance build — version code 4

The updated build preserves the existing release signing identity and ARM64 target. See [acceptance fixes](archive/acceptance/ANDROID_ACCEPTANCE_FIXES.md) for parser/filter changes, gallery audit, copy and explicit pending-request recovery. Deploy the matching backend before trying VTO discovery from this APK; the older server does not accept the additive constraint. Pending requests retain their original IDs but now require an explicit Retry request after relaunch/refresh. Native and artifact results are recorded in `evidence/android-acceptance-2026-10-17/`.
