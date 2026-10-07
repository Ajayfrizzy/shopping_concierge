import { reserveYouCamRender } from './budget.js';
import { MockVisualProvider } from './mock.js';
import { LiveYouCamProvider } from './live.js';
export function youcamProvider(
  env: NodeJS.ProcessEnv = process.env,
  log?: ConstructorParameters<typeof LiveYouCamProvider>[0]['log'],
) {
  if (env.USE_MOCK_YOUCAM === undefined || env.USE_MOCK_YOUCAM === 'true')
    return new MockVisualProvider();
  if (env.USE_MOCK_YOUCAM !== 'false') throw new Error('USE_MOCK_YOUCAM must be true or false.');
  if (!env.YOUCAM_API_KEY || !env.YOUCAM_UPLOAD_HOSTS || !env.YOUCAM_ASSET_HOSTS)
    throw new Error(
      'Live YouCam requires a server API key and verified upload/asset hostname allowlists.',
    );
  const hosts = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if (!env.YOUCAM_USAGE_LEDGER)
    throw new Error('Live YouCam requires an initialized usage ledger.');
  const ledger = env.YOUCAM_USAGE_LEDGER;
  return new LiveYouCamProvider({
    apiOrigin: env.YOUCAM_BASE_URL || undefined,
    reserveRender: (category) => reserveYouCamRender(ledger, category),
    apiKey: env.YOUCAM_API_KEY,
    uploadHosts: hosts(env.YOUCAM_UPLOAD_HOSTS),
    outputHosts: hosts(env.YOUCAM_ASSET_HOSTS),
    log,
  });
}
