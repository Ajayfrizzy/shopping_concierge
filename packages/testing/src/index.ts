import type { FoundationResponse, ProviderResult } from '@youcam/shared';

export interface MockOptions {
  fail?: boolean;
  latencyMs?: number;
}
async function delay(ms = 0): Promise<void> {
  if (ms > 0) await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
export class MockLLMService {
  readonly mode = 'mock' as const;
  constructor(private readonly options: MockOptions = {}) {}
  async respond(): Promise<ProviderResult<FoundationResponse>> {
    await delay(this.options.latencyMs);
    if (this.options.fail)
      return {
        ok: false,
        error: {
          code: 'MOCK_FAILURE',
          message: 'The mock assistant is unavailable. Please retry.',
          recoverable: true,
        },
      };
    return {
      ok: true,
      data: {
        mode: 'mock',
        readyForShopping: false,
        message:
          'The concierge foundation is connected. Shopping search and saved decisions are not available yet.',
      },
    };
  }
}
// This is a connectivity fixture, never a visual analysis or rendering result.
export class MockYouCamService {
  readonly mode = 'mock' as const;
  constructor(private readonly options: MockOptions = {}) {}
  async checkConnection(): Promise<ProviderResult<{ mode: 'mock'; available: true }>> {
    await delay(this.options.latencyMs);
    if (this.options.fail)
      return {
        ok: false,
        error: {
          code: 'MOCK_FAILURE',
          message: 'Mock visual service unavailable. Please retry.',
          recoverable: true,
        },
      };
    return { ok: true, data: { mode: 'mock', available: true } };
  }
}

// M3 planning fixture; kept separate from M0 connectivity behavior.
export { MockAgentPlanner, runAgentScenario } from './agent.ts';
