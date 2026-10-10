import type { OpenAIBudget } from './budget.js';
import { accountingConfig } from '../accounting/config.js';
import { fileURLToPath } from 'node:url';
import { MockAgentPlanner } from '@youcam/testing';
import { APPROVED_MODEL, LiveBudget } from './budget.js';
import { OpenAIPlanner } from './openai.js';
export const liveLedgerPath = fileURLToPath(
  new URL('../../../../artifacts/m7-live-budget.json', import.meta.url),
);
export function llmProvider(env: NodeJS.ProcessEnv = process.env, budget?: OpenAIBudget) {
  if (env.USE_MOCK_LLM === undefined || env.USE_MOCK_LLM === 'true') return new MockAgentPlanner();
  if (env.USE_MOCK_LLM !== 'false') throw new Error('USE_MOCK_LLM must be true or false.');
  if (env.LLM_PROVIDER !== 'openai' || !env.OPENAI_API_KEY?.trim() || !env.LLM_MODEL?.trim())
    throw new Error(
      'Live LLM requires server-side LLM_PROVIDER=openai, OPENAI_API_KEY and LLM_MODEL.',
    );
  if (env.LLM_MODEL !== APPROVED_MODEL)
    throw new Error(
      'Model pricing/budget must be explicitly reviewed before changing the approved live model.',
    );
  const reasoning = env.LLM_REASONING_EFFORT ?? 'low';
  if (reasoning !== 'low' && reasoning !== 'medium' && reasoning !== 'high')
    throw new Error('Invalid LLM_REASONING_EFFORT.');
  const mode = accountingConfig(env).openaiMode;
  if (env.NODE_ENV === 'production' && mode !== 'postgres')
    throw new Error('Production live OpenAI requires OPENAI_LEDGER_MODE=postgres.');
  if (mode === 'postgres' && (env.PERSISTENCE_MODE !== 'postgres' || !env.DATABASE_URL))
    throw new Error('OpenAI PostgreSQL accounting requires PostgreSQL persistence.');
  return new OpenAIPlanner({
    apiKey: env.OPENAI_API_KEY,
    model: env.LLM_MODEL,
    reasoning,
    budget:
      mode === 'file'
        ? new LiveBudget(liveLedgerPath)
        : (budget ?? {
            reserve() {
              throw new Error('OpenAI PostgreSQL ledger is not initialized.');
            },
            settle() {
              throw new Error('OpenAI PostgreSQL ledger is not initialized.');
            },
          }),
  });
}
