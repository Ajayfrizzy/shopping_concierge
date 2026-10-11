/** Internal metadata only. Never include provider messages, prompts, URLs or headers. */
export interface OpenAIDiagnostic {
  stage:
    | 'reservation'
    | 'transport'
    | 'http'
    | 'response_json'
    | 'settlement'
    | 'response_shape'
    | 'plan_schema';
  status?: number;
  requestId?: string;
  errorCode?: string;
  errorType?: string;
  aborted: boolean;
}
const codes = new Set([
  'invalid_api_key',
  'invalid_request_error',
  'invalid_value',
  'invalid_json_schema',
  'invalid_function_parameters',
  'unsupported_parameter',
  'unsupported_value',
  'model_not_found',
  'insufficient_quota',
  'rate_limit_exceeded',
  'context_length_exceeded',
  'permission_denied',
  'account_deactivated',
  'server_error',
  'authentication_error',
]);
const types = new Set([
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'rate_limit_error',
  'insufficient_quota',
  'server_error',
  'api_error',
]);
export async function providerErrorMetadata(response: Response) {
  // Bound diagnostic body reads; error messages may echo sensitive request data.
  const reader = response.body?.getReader();
  if (!reader) return {};
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 8192) return {};
      chunks.push(next.value);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const code = raw?.error?.code;
    const type = raw?.error?.type;
    return {
      ...(typeof code === 'string' ? { errorCode: codes.has(code) ? code : 'unrecognized' } : {}),
      ...(typeof type === 'string' ? { errorType: types.has(type) ? type : 'unrecognized' } : {}),
    };
  } catch {
    return {};
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function diagnosticRequestId(response: Response, secret: string) {
  const id = response.headers.get('x-request-id');
  return id && /^req_[a-zA-Z0-9_-]{1,128}$/.test(id) && !id.includes(secret) ? id : undefined;
}
