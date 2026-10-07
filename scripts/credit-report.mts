import { readFileSync } from 'node:fs';
import process from 'node:process';
import { z } from 'zod';
import { categorySchema } from '@youcam/shared';
import { LiveBudget } from '../apps/api/src/llm/budget.js';
import { liveLedgerPath } from '../apps/api/src/llm/config.js';

// Read-only local report: never loads .env, contacts providers or creates/resets a ledger.
const report: Record<string, unknown> = {
  scope: 'historical validation ledgers; not current provider billing',
};
try {
  readFileSync(liveLedgerPath); // Missing must not be misreported as zero usage.
  report.openai = new LiveBudget(liveLedgerPath).summary();
} catch {
  report.openai = { status: 'unavailable or invalid; usage unknown' };
  process.exitCode = 1;
}
try {
  const reservation = z.object({ category: categorySchema, at: z.string().datetime() }).strict();
  const events = readFileSync(
    new URL('../docs/evidence/youcam-live/render-reservations.jsonl', import.meta.url),
    'utf8',
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => reservation.parse(JSON.parse(line)));
  report.youcam = {
    reservedRenders: events.length,
    limit: 8,
    byCategory: Object.fromEntries(
      categorySchema.options.map((c) => [c, events.filter((e) => e.category === c).length]),
    ),
    billingUnits: 'Not inferred from reservations; gate evidence records 5 observed units.',
  };
} catch {
  report.youcam = { status: 'unavailable or invalid; usage unknown' };
  process.exitCode = 1;
}
console.info(JSON.stringify(report, null, 2));
