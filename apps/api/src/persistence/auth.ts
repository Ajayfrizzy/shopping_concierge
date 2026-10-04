import { createHash } from 'node:crypto';
import { guestTokenSchema } from '@youcam/shared';
import { AgentError } from '@youcam/agent';
import { createTransport } from 'nodemailer';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function ownerFromAuthorization(header: string | undefined) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(header ?? '');
  if (!match || !guestTokenSchema.safeParse(match[1]).success)
    throw new AgentError(
      'UNAUTHORIZED',
      'A guest credential is required. Restore your device credential or start a new guest identity.',
      401,
    );
  return hashToken(match[1]!);
}
export interface EmailSender {
  send(email: string, token: string): Promise<void>;
}
export function smtpEmailSender(url: string, from: string): EmailSender {
  const transport = createTransport(url);
  return {
    async send(email, token) {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Shopping Concierge sign-in code',
        text: `Your one-time Shopping Concierge code is:\n${token}\nExpires in 10 minutes. Enter it only in the client that requested it. If you did not request this, ignore this message.`,
      });
    },
  };
}
