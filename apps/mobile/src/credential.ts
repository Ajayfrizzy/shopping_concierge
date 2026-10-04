import { guestTokenSchema } from '@youcam/shared';
import { ClientError } from './client.ts';
/** A read/write failure must never silently replace the identity owning existing sessions. */
export function createGuestCredential(
  storage: { read(): Promise<string | null>; write(token: string): Promise<void> },
  random: () => Promise<Uint8Array>,
) {
  let pending: Promise<string> | undefined;
  return () => {
    if (!pending)
      pending = (async () => {
        try {
          const existing = await storage.read();
          if (existing !== null) return guestTokenSchema.parse(existing);
          const bytes = await random();
          if (bytes.length !== 32) throw new Error('Invalid random bytes');
          const token = guestTokenSchema.parse(
            Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
          );
          await storage.write(token);
          return token;
        } catch {
          pending = undefined;
          throw new ClientError(
            'STORAGE',
            'Unable to access your secure guest identity. Retry without clearing app storage.',
          );
        }
      })();
    return pending;
  };
}
