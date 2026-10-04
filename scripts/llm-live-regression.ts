import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AgentError, createAgentService, interpretMockMessage, type Planner } from '@youcam/agent';
import { agentPlanSchema, type AgentPlan } from '@youcam/shared';
import { createFixtureCatalog } from '@youcam/catalog/fixtures';
import { getActiveConstraints, getHardConstraintViolations } from '@youcam/decision-engine';
import { llmProvider, liveLedgerPath } from '../apps/api/src/llm/config.js';
import { LiveBudget } from '../apps/api/src/llm/budget.js';

async function main() {
  // Run only after explicit credit approval. No YouCam adapters/HTTP server are started.
  if (
    process.env.M7_LIVE_APPROVED !== 'true' ||
    process.env.USE_MOCK_LLM !== 'false' ||
    process.env.USE_MOCK_YOUCAM !== 'true'
  )
    throw new Error(
      'Requires explicit M7_LIVE_APPROVED=true, USE_MOCK_LLM=false and USE_MOCK_YOUCAM=true.',
    );
  const chosen = process.argv[2] ?? 'all';
  const groups = [
    'constraints',
    'feedback',
    'relaxation',
    'invalid-id',
    'ambiguity',
    'budget-scope',
  ] as const;
  if (chosen !== 'all' && !groups.includes(chosen as (typeof groups)[number]))
    throw new Error('Unknown case.');
  const budget = new LiveBudget(liveLedgerPath),
    before = budget.summary();
  const catalog = createFixtureCatalog(),
    planner = llmProvider();
  assert.equal(planner.mode, 'live');
  let lastPlan: AgentPlan | undefined,
    expectedPlan: AgentPlan | undefined,
    failureCode: string | undefined;
  const observedPlanner: Planner = {
    mode: planner.mode,
    async plan(context, signal) {
      expectedPlan = interpretMockMessage(context.message, context.state);
      lastPlan = undefined;
      lastPlan = agentPlanSchema.parse(await planner.plan(context, signal));
      return lastPlan;
    },
  };
  const results: { name: string; passed: boolean }[] = [];
  let activeCase = chosen,
    activeStep = 0;
  try {
    for (const name of groups.filter((g) => chosen === 'all' || chosen === g)) {
      activeCase = name;
      activeStep = 0;
      const agent = createAgentService(catalog, observedPlanner);
      let view = agent.create();
      const send = async (message: string) => {
        activeStep++;
        const r = await agent.turn(view.state.id, {
          type: 'message',
          message,
          requestId: `live-${view.version}`,
          expectedVersion: view.version,
        });
        assert.equal(r.mode, 'live');
        view = r.session;
        if (r.ui.type === 'product_list' || r.ui.type === 'empty_state')
          for (const match of r.ui.payload.exactMatches) {
            assert.deepEqual(catalog.getProduct(match.product.id), match.product);
            assert.deepEqual(getHardConstraintViolations(view.state, match.product), []);
          }
        return r;
      };
      if (name === 'budget-scope') {
        view = (
          await agent.turn(view.state.id, {
            type: 'action',
            requestId: 'scope-category',
            expectedVersion: view.version,
            action: { type: 'switch_category', category: 'earrings' },
          })
        ).session;
        view = (
          await agent.turn(view.state.id, {
            type: 'action',
            requestId: 'scope-global',
            expectedVersion: view.version,
            action: {
              type: 'update_constraints',
              updates: [
                {
                  field: 'budget',
                  scope: 'global',
                  source: 'explicit',
                  value: { amount: 120, currency: 'USD' },
                },
              ],
            },
          })
        ).session;
        const original = structuredClone(view.state.constraints);
        const response = await send('under USD 1');
        assert.equal(response.ui.type, 'empty_state');
        assert.deepEqual(
          view.state.constraints.filter((c) => c.preference.scope === 'global'),
          original,
        );
        assert.deepEqual(getActiveConstraints(view.state).fields.budget?.preference.scope, {
          category: 'earrings',
        });
        assert.deepEqual(getActiveConstraints(view.state).fields.budget?.preference.value, {
          amount: 1,
          currency: 'USD',
        });
      } else if (name === 'constraints') {
        await send('Silver earrings for a wedding under $120, elegant but not too loud.');
        await send('Show me cheaper ones.');
        let fields = getActiveConstraints(view.state).fields;
        assert.equal(fields.material?.preference.value, 'silver');
        assert.equal(fields.occasion?.preference.value, 'wedding');
        assert.deepEqual(fields.budget?.preference.value, { amount: 120, currency: 'USD' });
        assert.equal(fields.pricePreference?.preference.value, 'lower');
        await send('Actually gold.');
        await send('No dangling earrings.');
        await send('Show me necklaces instead.');
        fields = getActiveConstraints(view.state).fields;
        assert.equal(fields.material?.preference.value, 'gold');
        assert.equal(fields.excludedTags, undefined);
        assert.equal(view.state.activeCategory, 'necklaces');
        await send('Back to earrings.');
        assert.deepEqual(getActiveConstraints(view.state).fields.excludedTags?.preference.value, [
          'dangling',
        ]);
      } else if (name === 'feedback') {
        await send('earrings');
        await send('Reject E05 as too flashy');
        await send('Save E18');
        assert.deepEqual(view.state.decisions.earrings?.rejected, ['E05']);
        assert.deepEqual(view.state.decisions.earrings?.saved, ['E18']);
        assert.equal((await send('Save E18')).events.length, 0);
      } else if (name === 'relaxation') {
        const r = await send('Platinum earrings under $1');
        assert.equal(r.ui.type, 'empty_state');
        assert.ok(view.pendingRelaxations.length);
        const stateBefore = structuredClone(view.state);
        assert.equal((await send('Yes')).status, 'clarification');
        assert.deepEqual(view.state, stateBefore);
        const proposal = view.pendingRelaxations[0];
        assert.ok(proposal);
        const requestsBefore = budget.summary().requests;
        const accepted = await agent.turn(view.state.id, {
          type: 'confirm_relaxation',
          proposalId: proposal.proposalId,
          requestId: 'explicit-confirm',
          expectedVersion: view.version,
        });
        assert.ok(accepted.events.length);
        assert.equal(budget.summary().requests, requestsBefore);
      } else if (name === 'invalid-id') {
        await assert.rejects(
          send('Tell me about NONEXISTENT'),
          (error: unknown) => (error as { code: string }).code === 'UNKNOWN_PRODUCT',
        );
        assert.equal(agent.get(view.state.id).version, 0);
      } else {
        assert.equal((await send('Something nice for Saturday.')).status, 'clarification');
        assert.equal(view.state.activeCategory, null);
        assert.equal(view.state.constraints.length, 0);
      }
      results.push({ name, passed: true });
    }
  } catch (error) {
    failureCode =
      error instanceof AgentError
        ? error.code
        : error instanceof assert.AssertionError
          ? 'ASSERTION_FAILED'
          : 'VALIDATION_FAILED';
    results.push({ name: activeCase, passed: false });
    process.exitCode = 1;
  } finally {
    const report = {
      at: new Date().toISOString(),
      selectedCase: chosen,
      activeStep,
      ...(failureCode ? { failureCode, lastPlan, expectedPlan } : {}),
      before,
      after: budget.summary(),
      results,
    };
    mkdirSync('artifacts/m7', { recursive: true });
    writeFileSync(`artifacts/m7/live-${Date.now()}.json`, JSON.stringify(report, null, 2));
    console.info(JSON.stringify(report, null, 2));
  }
}
void main().catch(() => {
  console.error('Live validation setup failed; check server configuration and approval flags.');
  process.exitCode = 1;
});
