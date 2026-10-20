import { VisualError } from './provider.js';
/** Provider URL hosts are configured by the operator, not by clients/model output. Redirects are refused. */
export function safeProviderUrl(raw: string, hosts: readonly string[]) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new VisualError('PROVIDER_INVALID_RESPONSE', 'Provider returned an invalid URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    throw new VisualError(
      'PROVIDER_INVALID_RESPONSE',
      'Provider URL is outside the configured HTTPS host allowlist.',
    );
  return url.toString();
}
