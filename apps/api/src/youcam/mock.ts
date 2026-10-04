import { randomUUID } from 'node:crypto';
import {
  validateImageType,
  renderFailure,
  type TryOnInput,
  type ProviderPoll,
  type YouCamProvider,
} from './provider.js';
/** Simulates lifecycle only: never returns a photo or claims that image anatomy was detected. */
export class MockVisualProvider implements YouCamProvider {
  readonly mode = 'mock' as const;
  starts = 0;
  analyses = 0;
  async analyzeFace() {
    this.analyses++;
    await this.delay();
    if (this.options.failure) throw renderFailure();
    return { faceShape: null };
  }
  constructor(
    private readonly options: { failure?: boolean; processing?: boolean; latencyMs?: number } = {},
  ) {}
  async start(input: TryOnInput) {
    validateImageType(input.category, input.asset);
    this.starts++;
    await this.delay();
    return randomUUID();
  }
  async poll(): Promise<ProviderPoll> {
    await this.delay();
    if (this.options.processing) return { status: 'processing' };
    if (this.options.failure) return { status: 'failed', error: renderFailure().normalized() };
    return { status: 'completed', mock: true };
  }
  private async delay() {
    if (this.options.latencyMs)
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
  }
}
