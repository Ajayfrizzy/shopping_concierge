# Mobile

Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router, and expo-dev-client. The app uses mandatory New Architecture. Run `npm run android:build` from the root to prebuild and install its own Android binary. Do not load this bundle in Recall or another project's development client.

Run `npm run dev:mobile` for port 8082, or `npm run dev:clear -w @youcam/mobile` to clear Metro. See the root README for USB forwarding and `EXPO_PUBLIC_API_URL` configuration. Mobile receives only a public API URL and validates API responses with shared Zod schemas.

Generated Android/iOS projects are local build artifacts. Native changes require prebuild plus a fresh binary. Expo Doctor's app-config sync heuristic is disabled for this Git-less CNG workspace; the build script always prebuilds, while dependency checks remain enabled.

`npm run export:android` verifies bundling. Physical-device boot and interaction remain separate acceptance checks recorded in `docs/VALIDATION.md`.
