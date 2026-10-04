import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

// Standard processing rates verified against official model documentation 2026-10-03.
export const APPROVED_MODEL = 'gpt-5.6-terra';
// User-approved 2026-10-04 extension: five additional attempts, same ledger/$1 ceiling.
export const MAX_REQUESTS = 30;
export const MAX_USD = 1;
const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative() }).optional(),
});
export type Usage = z.infer<typeof usageSchema>;
const entrySchema = z
  .object({
    reservedUsd: z.number().finite().nonnegative(),
    chargedUsd: z.number().finite().nonnegative(),
    usage: usageSchema.nullable(),
  })
  .strict();
const ledgerSchema = z
  .object({
    version: z.literal(1),
    model: z.literal(APPROVED_MODEL),
    entries: z.array(entrySchema).max(MAX_REQUESTS),
  })
  .strict();
export function usageCost(raw: unknown): { usage: Usage; usd: number } {
  const usage = usageSchema.parse(raw),
    cached = usage.input_tokens_details?.cached_tokens ?? 0;
  if (cached > usage.input_tokens) throw new Error('Invalid token usage.');
  return {
    usage,
    usd: ((usage.input_tokens - cached) * 2 + cached * 0.2 + usage.output_tokens * 12) / 1_000_000,
  };
}
/** Shared durable cap for runner AND device/API requests. No prompts, keys or user data are stored. */
export class LiveBudget {
  constructor(private readonly path: string) {}
  private read() {
    try {
      return ledgerSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return ledgerSchema.parse({ version: 1, model: APPROVED_MODEL, entries: [] });
      throw new Error('Live budget ledger is invalid; refusing requests.');
    }
  }
  private change<T>(fn: (ledger: z.infer<typeof ledgerSchema>) => T): T {
    mkdirSync(dirname(this.path), { recursive: true });
    // Fail closed on concurrent modification or an interrupted lock; never reset a ledger automatically.
    const lock = `${this.path}.lock`;
    mkdirSync(lock);
    try {
      const ledger = this.read(),
        result = fn(ledger);
      writeFileSync(`${this.path}.tmp`, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      renameSync(`${this.path}.tmp`, this.path);
      return result;
    } finally {
      rmSync(lock, { recursive: true });
    }
  }
  reserve(model: string, bodyBytes: number, maxOutputTokens: number): number {
    if (model !== APPROVED_MODEL)
      throw new Error('Live validation pricing is not verified for this model.');
    if (
      !Number.isSafeInteger(bodyBytes) ||
      bodyBytes < 1 ||
      !Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 1
    )
      throw new Error('Invalid reservation.');
    // One token per UTF-8 byte over the entire serialized request plus protocol/schema margin.
    const reservedUsd = ((bodyBytes + 4096) * 2 + maxOutputTokens * 12) / 1_000_000;
    return this.change((ledger) => {
      if (
        ledger.entries.length >= MAX_REQUESTS ||
        ledger.entries.reduce((sum, e) => sum + e.chargedUsd, 0) + reservedUsd > MAX_USD
      )
        throw new Error('Approved live validation budget exhausted.');
      ledger.entries.push({ reservedUsd, chargedUsd: reservedUsd, usage: null });
      return ledger.entries.length - 1;
    });
  }
  settle(index: number, raw: unknown) {
    const { usage, usd } = usageCost(raw);
    this.change((ledger) => {
      const entry = ledger.entries[index];
      if (!entry || entry.usage) throw new Error('Unknown or already settled request.');
      entry.usage = usage;
      entry.chargedUsd = usd;
      if (usd > entry.reservedUsd) {
        // Retain actual usage and prevent further requests if an unexpected billing bound was exceeded.
        entry.chargedUsd = Math.max(usd, MAX_USD);
      }
    });
  }
  summary() {
    const ledger = this.read();
    return {
      model: ledger.model,
      requests: ledger.entries.length,
      inputTokens: ledger.entries.reduce((s, e) => s + (e.usage?.input_tokens ?? 0), 0),
      outputTokens: ledger.entries.reduce((s, e) => s + (e.usage?.output_tokens ?? 0), 0),
      cachedTokens: ledger.entries.reduce(
        (s, e) => s + (e.usage?.input_tokens_details?.cached_tokens ?? 0),
        0,
      ),
      estimatedOrReservedUsd: ledger.entries.reduce((s, e) => s + e.chargedUsd, 0),
      unknownUsageRequests: ledger.entries.filter((e) => !e.usage).length,
    };
  }
}
