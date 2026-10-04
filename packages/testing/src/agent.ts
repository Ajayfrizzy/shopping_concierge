import {
  interpretMockMessage,
  type Planner,
  type PlanningContext,
  type createAgentService,
} from '@youcam/agent';
import type { AgentRequest, AgentResponse } from '@youcam/shared';

export class MockAgentPlanner implements Planner {
  readonly mode = 'mock' as const;
  constructor(
    private readonly options: {
      fail?: boolean;
      latencyMs?: number;
      respond?: (context: PlanningContext) => unknown;
    } = {},
  ) {}
  async plan(context: PlanningContext, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw new Error('aborted');
    if (this.options.latencyMs)
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          reject(new Error('aborted'));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, this.options.latencyMs);
        signal.addEventListener('abort', abort, { once: true });
      });
    if (this.options.fail) throw new Error('Mock planner unavailable');
    return this.options.respond
      ? this.options.respond(context)
      : interpretMockMessage(context.message, context.state);
  }
}
/** Full turns through real backend tools; callback assertions run after every restored response. */
export async function runAgentScenario(
  service: ReturnType<typeof createAgentService>,
  steps: { message: string; verify?: (response: AgentResponse) => void }[],
) {
  let session = service.create();
  const responses: AgentResponse[] = [];
  for (const [index, step] of steps.entries()) {
    const request: AgentRequest = {
      type: 'message',
      message: step.message,
      requestId: `scenario-${index}`,
      expectedVersion: session.version,
    };
    const response = await service.turn(session.state.id, JSON.parse(JSON.stringify(request)));
    const restored = JSON.parse(JSON.stringify(response)) as AgentResponse;
    step.verify?.(restored);
    responses.push(restored);
    session = restored.session;
  }
  return responses;
}
