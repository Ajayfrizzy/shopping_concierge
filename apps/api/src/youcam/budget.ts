import { closeSync, fsyncSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { z } from 'zod';
import { categorySchema, type Category } from '@youcam/shared';
import { VisualError } from './provider.js';

const reservation = z.object({ category: categorySchema, at: z.string().datetime() }).strict();
/** Append-only reservations survive uncertain responses/restarts. Never refund a submission. */
export function reserveYouCamRender(path: string, category: Category) {
  let lock: number | undefined;
  try {
    lock = openSync(path + '.lock', 'wx', 0o600);
    // The operator must explicitly initialize an empty ledger. Missing/corrupt data fails closed.
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    lines.forEach((line) => reservation.parse(JSON.parse(line)));
    if (lines.length >= 8) throw new Error('Limit reached');
    const event = reservation.parse({ category, at: new Date().toISOString() });
    const fd = openSync(path, 'a', 0o600);
    try {
      writeSync(fd, JSON.stringify(event) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    throw new VisualError(
      'PROVIDER_UNAVAILABLE',
      'Live try-on budget is exhausted or unavailable. No rendering request was submitted.',
    );
  } finally {
    if (lock !== undefined) {
      closeSync(lock);
      unlinkSync(path + '.lock');
    }
  }
}

export function validateFileLedger(path: string) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    lines.forEach((line) => reservation.parse(JSON.parse(line)));
    if (lines.length > 8) throw new Error();
  } catch {
    throw new Error(
      'Live YouCam file ledger initialization failed: existing valid history is required.',
    );
  }
}
