import { ledgerSettings } from './ledger-config.js';
import type { UsageLedger } from './ledger.js';
import { reserveYouCamRender } from './budget.js';
import { MockVisualProvider } from './mock.js';
import { LiveYouCamProvider } from './live.js';
export function youcamProvider(
  env: NodeJS.ProcessEnv = process.env,
  log?: ConstructorParameters<typeof LiveYouCamProvider>[0]['log'],
  usageLedger?: UsageLedger,
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
  const settings = ledgerSettings(env);
  if (
    env.NODE_ENV === 'production' &&
    (settings.mode !== 'postgres' || env.YOUCAM_LEDGER_SCOPE !== 'judge')
  )
    throw new Error('Production live YouCam requires PostgreSQL judge accounting.');
  return new LiveYouCamProvider({
    apiOrigin: env.YOUCAM_BASE_URL || undefined,
    ledger: usageLedger,
    reserveRender:
      settings.mode === 'file'
        ? (category) => reserveYouCamRender(env.YOUCAM_USAGE_LEDGER!, category)
        : usageLedger
          ? undefined
          : () => {
              throw new Error('PostgreSQL YouCam ledger has not initialized.');
            },
    apiKey: env.YOUCAM_API_KEY,
    uploadHosts: hosts(env.YOUCAM_UPLOAD_HOSTS),
    outputHosts: hosts(env.YOUCAM_ASSET_HOSTS),
    log,
  });
}
