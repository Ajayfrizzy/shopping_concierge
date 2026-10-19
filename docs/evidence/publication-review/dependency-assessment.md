> Historical evidence retained at its original path. Status, test counts and budgets apply only to the recorded observation, not live balances. This is not final demo footage. See [current acceptance](../../FINAL_PRODUCTION_ACCEPTANCE.md) for the October 18–19, 2026 code-6 baseline; mock tests and historical live provider evidence remain distinct.

# Dependency advisory inventory — 2026-10-08

All 30 initial audit entries were assessed. The two critical entries are resolved; the final report has 29 entries because npm additionally reports an inherited warning for the unchanged `react-native-is-edge-to-edge`. This inventory maps each remaining entry to its underlying advisory package. See [the repository audit](../../archive/investigations/REPOSITORY_AUDIT.md) for reachability and deferral reasoning. No major upgrades or forced audit fixes were used.

| Entry | Severity | Direct dependency | Underlying advisory package(s) | Disposition |
| --- | --- | --- | --- | --- |
| `concurrently` | critical | yes | `shell-quote` | Fixed by compatible patch/minor versions. |
| `shell-quote` | critical | no | `shell-quote` | Fixed by compatible patch/minor versions. |
| `@expo/cli` | high | no | `braces`, `node-forge`, `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/code-signing-certificates` | high | no | `node-forge` | Deferred for documented SDK-compatible follow-up. |
| `@expo/config` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/config-plugins` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/inline-modules` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/local-build-cache-provider` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/metro` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `@expo/metro-config` | high | no | `braces`, `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@expo/prebuild-config` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `@react-native/community-cli-plugin` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `@react-native/metro-config` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `@react-native/virtualized-lists` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `braces` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `decode-uri-component` | moderate | no | `decode-uri-component` | Deferred for documented SDK-compatible follow-up. |
| `expo` | high | yes | `braces`, `node-forge`, `uuid` | Deferred for documented SDK-compatible follow-up. |
| `expo-router` | moderate | yes | `decode-uri-component` | Deferred for documented SDK-compatible follow-up. |
| `metro` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `metro-config` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `metro-file-map` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `metro-transform-worker` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `micromatch` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `node-forge` | high | no | `node-forge` | Deferred for documented SDK-compatible follow-up. |
| `query-string` | moderate | no | `decode-uri-component` | Deferred for documented SDK-compatible follow-up. |
| `react-native` | high | yes | `braces` | Deferred for documented SDK-compatible follow-up. |
| `react-native-is-edge-to-edge` | high | no | `braces` | Deferred for documented SDK-compatible follow-up. |
| `react-native-reanimated` | high | yes | `braces` | Deferred for documented SDK-compatible follow-up. |
| `react-native-worklets` | high | yes | `braces` | Deferred for documented SDK-compatible follow-up. |
| `uuid` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
| `xcode` | moderate | no | `uuid` | Deferred for documented SDK-compatible follow-up. |
