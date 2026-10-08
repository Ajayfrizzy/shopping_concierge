# Reproducible Android demo

The demo uses 72 synthetic accessory records, local PostgreSQL/S3, and mock planning/try-on. It needs no paid API credentials or shared account. A fresh installation creates a private guest credential automatically. Existing live evidence is reviewed separately; these commands never activate paid providers.

## Prerequisites

- Node.js 22.13+ and npm 10+; Docker Desktop running.
- JDK 17; Android SDK platform 36 (`platforms/android-36/android.jar`; platform 36.1 alone is insufficient), Build Tools 36.0.0 (Gradle may also install 35.0.0), NDK 27.1.12297006 and CMake 3.22.1. Set `JAVA_HOME` and `ANDROID_HOME` to their installed directories. `adb` must be on PATH.
- Android phone connected over USB with USB debugging authorized. `adb devices -l` must show `device`. For multiple devices, pass `-- --device DEVICE_NAME` (the Expo device name, for example `SM_S908N`) to `demo:android`; use only one device for `demo:mobile` forwarding.
- Internet for first dependency/native build downloads. The running mock workflow needs only the host and USB connection.

## Fresh checkout / installation

From the repository root:

```sh
npm ci
npm run demo:prepare
npm run demo:android
```

`demo:prepare` starts the local services in `infra/compose.local.yml`, runs checksum-checked migrations and seeds fixtures without deleting sessions. The local database is shared with existing local development, not a cloud database. Do not remove Docker volumes to reset the demonstration.

`demo:android` generates and installs **Concierge Demo**, package `com.youcam.shoppingconcierge.demo`. It leaves **Shopping Concierge**, package `com.youcam.shoppingconcierge`, and its guest credentials/history intact. Both use the same application code. The demo's distinct package is for fresh-install validation, not a second product. Generated native files are ignored; the demo builder restores the normal native configuration after its build attempt so existing runtime-alignment checks remain valid. This restoration does not alter the installed apps.

In two terminals:

```sh
npm run demo:api
```

```sh
npm run demo:mobile
```

The second command forwards API port 4000 and Metro port 8082 over USB. Open **Concierge Demo**. If the development-client launcher appears, open this explicit link:

```sh
adb shell am start -a android.intent.action.VIEW \
  -d 'exp+shopping-concierge-demo://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' \
  com.youcam.shoppingconcierge.demo
```

Tap **Use this example**, then **Send to concierge**. Follow [the timed demo](DEMO_SCRIPT.md). **Start a new session** offers a visible confirmation and resets only the phone's current session reference; no database edit or seeded private account is required.

All four demo commands discard inherited provider/database configuration, do not load private `.env` files, force both providers to mock, and use the checked-in local-only environment. The mobile URL is USB loopback. Do not run another server on 4000/8082 at the same time. `/health` is a connectivity fixture, not a live-provider status probe.

## Rehearsal evidence

The [recorded Samsung rehearsal](evidence/m9/timed-demo.mp4) is 1m 46s and uses mock providers. For the prior-live segment, open [the labeled historical capture](evidence/m9/prior-live-labeled.png) in a separate viewer. On a phone, copy it to Downloads and open it in Gallery before rehearsing; return to the demo with Back. This is a prior validated output for a different fixture, not a new rendering of the current E18 candidate. No signed URL, paid request or private account is needed. The public repository image review confirms that the portrait is synthetic; see [image provenance](evidence/IMAGE_PROVENANCE.md). Final narration and portal-specific deliverable review remain separate.

## Recovery and visual evidence

- API unavailable: restart `demo:api`, then use **Retry request** for a pending turn or **Refresh session**. Do not start a new session merely to hide an error. PostgreSQL retains the committed state; request IDs protect retries.
- Metro unavailable: keep `demo:mobile` running, reconnect USB, restart it to renew forwarding and open the explicit link above.
- Catalog missing: rerun `demo:prepare`; do not substitute invented records. Port/service problems appear in command output.
- Photo picker: choose an owned/approved PNG/JPEG up to 4 MiB and 16 MP. Photos are requested only after **Try on**. A mock completion explicitly says no image was rendered. It is not evidence of live visual quality.
- Live result URLs expire. Use the already captured [four-category evidence](JUDGE_GUIDE.md), not another paid render to repair an expired link. No credentials or temporary signed URLs belong in submission artifacts.

The demo is a local development APK requiring Metro and a host API, not a hosted public or standalone production release. RumptyCloud remains the intended deployment target; M9 does not deploy resources. Optional email login remains disabled.

## Validation commands

```sh
M5_INTEGRATION=1 npm run check
npm run verify:mobile-secrets
npm run credits:report
```

`credits:report` only reads historical local ledgers. It reports missing/invalid data as unknown and exits nonzero, never as zero spend; it never contacts a provider or creates/resets a ledger. YouCam reservations are attempted renders, not automatically billable units. Existing sanitized YouCam operation logs record operation/method/status; no keys, photos or signed URLs are logged.

See [M9 validation](VALIDATION.md) for which automated and physical checks have actually passed.
