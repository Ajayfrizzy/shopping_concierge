import { z } from 'zod';
import type { ObjectStore } from '../persistence/objects.js';
import { usageCost, type OpenAIBudget, type Usage } from '../llm/budget.js';

export function receiptKey(prefix: string, id: string) {
  return `${prefix}accounting/openai/receipts/${z.string().uuid().parse(id)}.json`;
}
export function parseReceipt(raw: unknown, expectedId: string) {
  const receipt = z
    .object({ version: z.literal(1), reservationId: z.string().uuid(), usage: z.unknown() })
    .strict()
    .parse(raw);
  if (receipt.reservationId !== expectedId) throw new Error('Receipt reservation mismatch');
  return usageCost(receipt.usage).usage;
}
/** Independent durable evidence before PostgreSQL settlement; no provider payloads or prompts. */
export class ReceiptBudget implements OpenAIBudget {
  private readonly pending = new Map<string, Usage>();
  private recovery?: Promise<void>;
  constructor(
    private readonly budget: OpenAIBudget,
    private readonly objects: ObjectStore,
    private readonly prefix = '',
  ) {}
  reserve(model: string, bytes: number, tokens: number) {
    if (this.pending.size) throw new Error('OpenAI accounting requires reconciliation');
    return this.budget.reserve(model, bytes, tokens);
  }
  private async persist(id: string, usage: Usage) {
    await this.objects.put(
      receiptKey(this.prefix, id),
      Buffer.from(JSON.stringify({ version: 1, reservationId: id, usage })),
      'application/json',
    );
    await this.budget.settle(id, usage);
    this.pending.delete(id);
  }
  async settle(id: string | number, raw: unknown) {
    const key = z.string().uuid().parse(id);
    const usage = usageCost(raw).usage;
    this.pending.set(key, usage);
    try {
      await this.persist(key, usage);
    } catch {
      throw new Error(
        'OpenAI settlement pending reconciliation; do not resubmit provider request.',
      );
    }
  }
  /** Readiness is read-only; recovery must be an explicit accounting operation. */
  assertReady() {
    if (this.pending.size) throw new Error('OpenAI settlement requires reconciliation');
  }
  reconcilePending() {
    this.recovery ??= (async () => {
      for (const [id, usage] of this.pending) await this.persist(id, usage);
    })().finally(() => {
      this.recovery = undefined;
    });
    return this.recovery;
  }
}
