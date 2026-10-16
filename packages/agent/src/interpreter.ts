import { shoppingInstruction } from './shopping-instruction.ts';
import {
  agentPlanSchema,
  type AgentPlan,
  type ConstraintInput,
  type DecisionAction,
  type ShoppingSession,
  type ToolCall,
} from '@youcam/shared';
import { getActiveConstraints } from '@youcam/decision-engine';

const search: ToolCall = { name: 'search_products', args: {} };
export function actionCall(action: DecisionAction): ToolCall {
  switch (action.type) {
    case 'create_dependency':
      return { name: 'create_dependency', args: action.dependency };
    case 'update_constraints':
      return { name: action.type, args: { updates: action.updates } };
    case 'switch_category':
      return { name: action.type, args: { category: action.category } };
    case 'reset_constraint':
      return { name: action.type, args: { field: action.field, scope: action.scope } };
    case 'feedback': {
      const f = action.feedback;
      const name = {
        like: 'like_product',
        select: 'select_product',
        save: 'save_product',
        shortlist: 'shortlist_product',
        reject: 'reject_product',
      } as const;
      if (f.action === 'reject')
        return {
          name: 'reject_product',
          args: {
            productId: f.productId,
            ...(f.reasonCode ? { reasonCode: f.reasonCode } : {}),
            ...(f.reasonText ? { reasonText: f.reasonText } : {}),
          },
        };
      return { name: name[f.action], args: { productId: f.productId } };
    }
  }
}
const plan = (intent: AgentPlan['intent'], calls: ToolCall[]): AgentPlan =>
  agentPlanSchema.parse({ intent, calls, disposition: 'execute' });
const clarify = (question: AgentPlan['question']): AgentPlan => ({
  intent: 'clarify',
  calls: [],
  disposition: 'clarify',
  question,
});

/** Deliberately bounded mock grammar, not a general natural-language model. Full-string matching fails closed. */
export function interpretMockMessage(message: string, state: ShoppingSession): AgentPlan {
  const text = message.trim().replace(/[.!]$/, '').toLowerCase();
  const compare = /^compare ([\w-]+) and ([\w-]+)[.!]?$/i.exec(message.trim());
  if (compare)
    return plan('compare_products', [
      { name: 'compare_products', args: { productIds: [compare[1]!, compare[2]!] } },
    ]);
  const complement =
    /^(?:now )?(?:find|show me) (?:a |an )?(earring|earrings|necklace|necklaces|ring|rings|watch|watches) that works with (it|this|[\w-]+)(?: under (\$|€|usd |eur )(\d+(?:\.\d{1,2})?))?[.!]?$/i.exec(
      message.trim(),
    );
  if (complement) {
    const category = (
      {
        earring: 'earrings',
        earrings: 'earrings',
        necklace: 'necklaces',
        necklaces: 'necklaces',
        ring: 'rings',
        rings: 'rings',
        watch: 'watches',
        watches: 'watches',
      } as const
    )[complement[1]!.toLowerCase() as 'earring']!;
    const anchors = Object.entries(state.decisions)
      .flatMap(([anchorCategory, d]) =>
        d.selected.map((anchorProductId) => ({ anchorProductId, anchorCategory })),
      )
      .filter((a) => a.anchorCategory !== category);
    const reference = complement[2]!;
    const anchor = /^(it|this)$/i.test(reference)
      ? anchors.length === 1
        ? anchors[0]
        : undefined
      : anchors.find((a) => a.anchorProductId === reference);
    if (!anchor) return clarify('anchor');
    const amount = complement[4] ? Number(complement[4]) : undefined;
    if (
      amount !== undefined &&
      (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100)
    )
      return clarify('instruction');
    return agentPlanSchema.parse({
      intent: 'create_cross_product_search',
      disposition: 'execute',
      calls: [
        {
          name: 'create_dependency',
          args: { ...anchor, targetCategory: category, type: 'complement' },
        },
        { name: 'switch_category', args: { category } },
        ...(amount === undefined
          ? []
          : [
              {
                name: 'update_constraints',
                args: {
                  updates: [
                    {
                      field: 'budget',
                      value: {
                        amount,
                        currency: ['€', 'eur '].includes(complement[3]!.toLowerCase())
                          ? 'EUR'
                          : 'USD',
                      },
                      source: 'explicit',
                      scope: { category },
                    },
                  ],
                },
              },
            ]),
        search,
      ],
    });
  }
  const tryOn = /^(?:try on|try-on|vto) ([\w-]+)[.!]?$/i.exec(message.trim());
  if (tryOn) return plan('request_vto', [{ name: 'request_vto', args: { productId: tryOn[1]! } }]);
  const unsupported: [RegExp, AgentPlan['intent']][] = [
    [/\b(?:try on|try-on|vto)\b/, 'request_vto'],
    [/\bcompare\b/, 'compare_products'],
    [/\b(?:works with|complements|matches my selected)\b/, 'create_cross_product_search'],
    [/^(?:start new session|start over)$/, 'start_new_session'],
    [/\bsimilar to\b/, 'request_similar'],
  ];
  for (const [pattern, intent] of unsupported)
    if (pattern.test(text)) return { intent, calls: [], disposition: 'unsupported' };
  if (/^(?:yes|confirm|accept relaxation)$/.test(text)) return clarify('confirmation');
  if (/^(?:show my state|show my constraints)$/.test(text))
    return plan('ask_product_question', [{ name: 'get_session_state', args: {} }]);
  const detail = /^(?:tell me about|show details for) ([\w-]+)[.!]?$/i.exec(message.trim());
  if (detail)
    return plan('ask_product_question', [{ name: 'get_product', args: { productId: detail[1]! } }]);
  const feedback =
    /^(select|save|shortlist|like|reject) ([\w-]+)(?: (?:as |because (?:it is )?)?(too expensive|too flashy|too plain|too large|too small|wrong material|wrong color|wrong style|wrong occasion|dislikes shape|owns similar|other))?[.!]?$/i.exec(
      message.trim(),
    );
  if (feedback) {
    const action = feedback[1]!.toLowerCase();
    if (action !== 'reject' && feedback[3]) return clarify('instruction');
    const name = `${action}_product` as 'reject_product';
    const call = {
      name,
      args: {
        productId: feedback[2]!,
        ...(feedback[3] ? { reasonCode: feedback[3].toLowerCase().replaceAll(' ', '_') } : {}),
      },
    };
    return agentPlanSchema.parse({ intent: name, disposition: 'execute', calls: [call, search] });
  }
  const categorySwitch =
    /^(?:show me |switch to |back to )(earrings|necklaces|rings|watches)(?: instead)?$/.exec(text);
  if (categorySwitch)
    return agentPlanSchema.parse({
      intent: 'switch_category',
      disposition: 'execute',
      calls: [{ name: 'switch_category', args: { category: categorySwitch[1] } }, search],
    });
  if (/^(?:show me )?(?:cheaper(?: ones)?|more premium(?: ones)?)$/.test(text)) {
    if (!state.activeCategory) return clarify('category');
    const value = text.includes('cheaper') ? 'lower' : 'higher';
    return plan(value === 'lower' ? 'request_cheaper' : 'request_more_premium', [
      actionCall({
        type: 'update_constraints',
        updates: [
          {
            field: 'pricePreference',
            value,
            source: 'explicit',
            scope: { category: state.activeCategory },
          },
        ],
      }),
      search,
    ]);
  }
  if (/^(?:search|show products|show alternatives)$/.test(text))
    return plan('request_alternatives', [search]);
  const materialOnly =
    /^(?:actually |only )?(silver|gold|rose gold|steel|titanium|platinum)(?: only)?$/.exec(text);
  if (materialOnly)
    return plan('refine_search', [
      actionCall({
        type: 'update_constraints',
        updates: [
          { field: 'material', value: materialOnly[1]!, source: 'explicit', scope: 'global' },
        ],
      }),
      search,
    ]);
  const noDangling = /^(?:no dangling|no dangling earrings)$/.test(text);
  if (noDangling) {
    const existing = state.constraints.find(
      (c) =>
        c.preference.field === 'excludedTags' &&
        c.preference.source === 'explicit' &&
        c.preference.scope !== 'global' &&
        c.preference.scope.category === 'earrings',
    )?.preference;
    const values = existing?.field === 'excludedTags' ? existing.value : [];
    return plan('refine_search', [
      actionCall({
        type: 'update_constraints',
        updates: [
          {
            field: 'excludedTags',
            value: [...new Set([...values, 'dangling'])],
            source: 'explicit',
            scope: { category: 'earrings' },
          },
        ],
      }),
      search,
    ]);
  }
  const reset = /^reset (budget|material|color|occasion)$/.exec(text);
  if (reset) {
    const field = reset[1] as 'budget';
    const evidence = getActiveConstraints(state).fields[field]?.evidence[0];
    return plan('reset_constraint', [
      actionCall({
        type: 'reset_constraint',
        field,
        scope: evidence?.preference.scope ?? 'global',
      }),
      search,
    ]);
  }
  const budgetOnly = /^(?:under|max) (\$|€|usd |eur )(\d+(?:\.\d{1,2})?)$/.exec(text);
  if (
    budgetOnly &&
    (!Number.isFinite(Number(budgetOnly[2])) ||
      Number(budgetOnly[2]) > Number.MAX_SAFE_INTEGER / 100)
  )
    return clarify('instruction');
  if (budgetOnly)
    return plan('refine_search', [
      actionCall({
        type: 'update_constraints',
        updates: [
          {
            field: 'budget',
            value: {
              amount: Number(budgetOnly[2]),
              currency: ['€', 'eur '].includes(budgetOnly[1]!) ? 'EUR' : 'USD',
            },
            source: 'explicit',
            scope: state.activeCategory ? { category: state.activeCategory } : 'global',
          },
        ],
      }),
      search,
    ]);
  const shopping = shoppingInstruction(message, state);
  if (shopping) return shopping;
  // Initial fixture intent supports only these complete, auditable clauses.
  const initial =
    /^(?:i need |find |show me )?(?:(silver|gold|rose gold|steel|titanium|platinum) )?(earrings|necklaces|rings|watches)(?: for (?:a )?(wedding|work|party|date|everyday))?(?:,? under (\$|€|usd |eur )(\d+(?:\.\d{1,2})?))?(?:,? (elegant|modern|romantic|minimal))?(?:,? (?:but )?(not too loud|understated))?$/.exec(
      text,
    );
  if (initial) {
    const [, material, category, occasion, currency, amount, style, intensity] = initial;
    if (
      amount &&
      (!Number.isFinite(Number(amount)) || Number(amount) > Number.MAX_SAFE_INTEGER / 100)
    )
      return clarify('instruction');
    const updates: ConstraintInput[] = [];
    if (material)
      updates.push({ field: 'material', value: material, source: 'explicit', scope: 'global' });
    if (occasion)
      updates.push({ field: 'occasion', value: occasion, source: 'explicit', scope: 'global' });
    if (amount)
      updates.push({
        field: 'budget',
        value: {
          amount: Number(amount),
          currency: ['€', 'eur '].includes(currency!) ? 'EUR' : 'USD',
        },
        source: 'explicit',
        scope: 'global',
      });
    if (style)
      updates.push({ field: 'styleTags', value: [style], source: 'explicit', scope: 'global' });
    if (intensity)
      updates.push({ field: 'visualIntensity', value: 'low', source: 'explicit', scope: 'global' });
    return agentPlanSchema.parse({
      intent: state.activeCategory ? 'refine_search' : 'start_search',
      disposition: 'execute',
      calls: [
        { name: 'switch_category', args: { category } },
        ...(updates.length ? [actionCall({ type: 'update_constraints', updates })] : []),
        search,
      ],
    });
  }
  if (/\bunder \d/.test(text)) return clarify('currency');
  return clarify(state.activeCategory ? 'instruction' : 'category');
}
