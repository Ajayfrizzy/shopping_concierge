import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createSession } from '@youcam/decision-engine';
import { OpenAIPlanner, plannerTools } from '../apps/api/src/llm/openai.js';
import { strictSchemaIssues, toStrictTransportSchema } from '../apps/api/src/llm/tool-schema.js';
import { APPROVED_MODEL } from '../apps/api/src/llm/budget.js';
const fixture = JSON.parse(readFileSync('fixtures/llm/openai-tools.json', 'utf8'));
const rejected = JSON.parse(readFileSync('fixtures/llm/openai-tools-rejected.json', 'utf8'));
const context = {
  state: createSession({ id: 'schema-test', goal: '' }),
  message: 'earrings',
  recentMessages: [],
  referencedProducts: [],
  tools: [],
};
const empty = { type: 'object', properties: {}, required: [], additionalProperties: false };

it('checks every production function definition and the exact serialized tools fixture', async () => {
  expect(plannerTools).toEqual(fixture);
  expect(fixture.map((t: { name: string }) => t.name)).toEqual(['submit_shopping_plan']);
  for (const tool of fixture) {
    expect(tool.strict).toBe(true);
    expect(strictSchemaIssues(tool.parameters)).toEqual([]);
  }
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    expect(JSON.stringify(payload.tools)).toBe(JSON.stringify(fixture));
    expect(payload.tool_choice).toEqual({ type: 'function', name: 'submit_shopping_plan' });
    expect(payload.parallel_tool_calls).toBe(false);
    return new Response('', { status: 400 });
  });
  const planner = new OpenAIPlanner({
    apiKey: 'fixture',
    model: APPROVED_MODEL,
    reasoning: 'low',
    maxAttempts: 1,
    fetch,
    budget: { reserve: () => 1, settle: () => {} },
  });
  await expect(planner.plan(context, new AbortController().signal)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('finds the precise missing required arrays hidden by the old test fallback', () => {
  const issues = strictSchemaIssues(rejected[0].parameters);
  expect(issues.filter((s) => s.includes('/required:'))).toEqual([
    '#/properties/calls/items/anyOf/2/properties/args/required: must list every property (including [] for empty objects)',
    '#/properties/calls/items/anyOf/3/properties/args/required: must list every property (including [] for empty objects)',
  ]);
  expect(issues.filter((s) => s.includes('unsupported transport keyword'))).toHaveLength(35);
});
it.each([
  { ...empty, additionalProperties: true },
  { ...empty, required: undefined },
  { ...empty, properties: { value: { type: 'string' } } },
  {
    ...empty,
    properties: { value: { type: 'object', properties: {}, required: [] } },
    required: ['value'],
  },
  {
    ...empty,
    properties: { value: { type: 'array', items: { ...empty, required: undefined } } },
    required: ['value'],
  },
  {
    ...empty,
    properties: { value: { anyOf: [{ ...empty, additionalProperties: true }, { type: 'null' }] } },
    required: ['value'],
  },
  { ...empty, $defs: { bad: { ...empty, required: undefined } } },
  {
    ...empty,
    properties: { value: { $ref: '#/$defs/bad' } },
    required: ['value'],
    $defs: { bad: { ...empty, additionalProperties: true } },
  },
  { ...empty, properties: { value: { $ref: '#/$defs/missing' } }, required: ['value'] },
  { ...empty, properties: { value: { $ref: 'https://example.test/schema' } }, required: ['value'] },
])('rejects incompatible nested objects or references %#', (schema) =>
  expect(strictSchemaIssues(schema).length).toBeGreaterThan(0),
);
it.each([
  'allOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'dependentRequired',
  'dependentSchemas',
  'patternProperties',
  'uniqueItems',
  'minLength',
  'maxLength',
  '$schema',
])('rejects unsupported transport keyword %s', (key) => {
  expect(strictSchemaIssues({ ...empty, [key]: [] })).toContain(
    `#/${key}: unsupported transport keyword`,
  );
});
it('supports local referenced recursive schemas without skipping definition validation', () => {
  expect(
    strictSchemaIssues({
      ...empty,
      properties: { value: { $ref: '#/$defs/node' } },
      required: ['value'],
      $defs: {
        node: {
          ...empty,
          properties: { next: { anyOf: [{ $ref: '#/$defs/node' }, { type: 'null' }] } },
          required: ['next'],
        },
      },
    }),
  ).toEqual([]);
});
it('normalizes optional properties and empty objects without weakening required values', () => {
  expect(
    toStrictTransportSchema({
      type: 'object',
      properties: { optional: { type: 'string' }, must: { type: 'string' } },
      required: ['must'],
      additionalProperties: false,
    }),
  ).toEqual({
    type: 'object',
    properties: {
      optional: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      must: { type: 'string' },
    },
    required: ['optional', 'must'],
    additionalProperties: false,
  });
  expect(
    toStrictTransportSchema({ type: 'object', properties: {}, additionalProperties: false }),
  ).toEqual(empty);
  expect(() => toStrictTransportSchema({ ...empty, oneOf: [] })).toThrow('Unsupported');
});
it.each(['', 'x'.repeat(1001)])(
  'keeps domain string validation after removing transport lengths %#',
  async (reasonText) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        status: 'completed',
        usage: { input_tokens: 10, output_tokens: 10 },
        output: [
          {
            type: 'function_call',
            name: 'submit_shopping_plan',
            arguments: JSON.stringify({
              intent: 'reject_product',
              disposition: 'execute',
              question: null,
              calls: [
                {
                  name: 'reject_product',
                  args: { productId: 'E12', reasonCode: null, reasonText },
                },
              ],
            }),
          },
        ],
      }),
    );
    const settle = vi.fn();
    const planner = new OpenAIPlanner({
      apiKey: 'fixture',
      model: APPROVED_MODEL,
      reasoning: 'low',
      maxAttempts: 1,
      fetch,
      budget: { reserve: () => 1, settle },
    });
    await expect(planner.plan(context, new AbortController().signal)).rejects.toThrow();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it('replaces the rejected comparison tuple with a length-two homogeneous array', () => {
  const path = '#/properties/calls/items/anyOf/0/properties/args/properties/productIds/items';
  expect(strictSchemaIssues(rejected[0].parameters)).toContain(
    `${path}: tuple arrays are unsupported; use one items schema`,
  );
  expect(
    fixture[0].parameters.properties.calls.items.anyOf[0].properties.args.properties.productIds,
  ).toEqual({ type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' } });
});
it('retains required nullable question and rejection fields on the wire', () => {
  const parameters = fixture[0].parameters;
  expect(parameters.required).toContain('question');
  expect(JSON.stringify(parameters.properties.question)).toContain('null');
  const args = parameters.properties.calls.items.anyOf.find(
    (s: { properties: { name: { enum: string[] } } }) =>
      s.properties.name.enum[0] === 'reject_product',
  ).properties.args;
  expect(args.required).toEqual(['productId', 'reasonCode', 'reasonText']);
  expect(JSON.stringify(args.properties.reasonCode)).toContain('null');
  expect(JSON.stringify(args.properties.reasonText)).toContain('null');
});
