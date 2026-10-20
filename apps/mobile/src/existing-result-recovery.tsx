import type { VtoJob } from '@youcam/shared';
import { canCheckExistingResult } from './try-on-session';
import { Button } from './ui';
export function ExistingResultRecovery({
  job,
  sessionId,
  productId,
  busy,
  onPress,
}: {
  job: VtoJob | null;
  sessionId: string;
  productId: string;
  busy: boolean;
  onPress: () => void;
}) {
  if (!canCheckExistingResult(job, sessionId, productId)) return null;
  return <Button title="Check existing YouCam result" disabled={busy} onPress={onPress} />;
}
