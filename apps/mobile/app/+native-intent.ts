/** Guard external Android/iOS links before Expo Router's query decoder runs.
 * The installed transitive decoder has a malformed-input DoS advisory.
 * Internal routes use bounded catalog IDs; malformed/oversized external links go home.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.length > 2048) return '/';
  try {
    decodeURIComponent(path); // Native decoder rejects malformed escapes/UTF-8 without fallback recursion.
    return path;
  } catch {
    return '/';
  }
}
