export type ImageStatus = 'loading' | 'loaded' | 'failed';
export function imageStatus(state: ImageStatus, event: 'load' | 'error'): ImageStatus {
  // Some native implementations send a late load event after an error. Failure stays visible.
  return event === 'error' ? 'failed' : state === 'failed' ? state : 'loaded';
}
export function productImageSource(
  url: string | undefined,
  assets: Record<string, number>,
): number | { uri: string } | undefined {
  if (!url) return undefined;
  // Old persisted/replayed fixture responses retain their original identifiers.
  if (/^https:\/\/fixtures\.invalid\/catalog\/[ENRW](0[1-9]|1[0-8])\.png$/.test(url))
    url = url.replace('https://fixtures.invalid/catalog/', 'catalog://demo/');
  if (Object.hasOwn(assets, url)) return assets[url];
  // Do not hand arbitrary file/content/data schemes or unresolved fixture URLs to native image loading.
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.hostname.endsWith('.invalid')) return { uri: url };
  } catch {
    /* Missing/invalid source uses the same stable fallback. */
  }
  return undefined;
}
