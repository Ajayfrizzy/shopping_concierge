import {
  agentPlanSchema,
  type AgentPlan,
  type ConstraintInput,
  type ShoppingSession,
} from '@youcam/shared';
/** Full-string, auditable search grammar. Unknown clauses fail closed, not keyword-extracted. */
export function shoppingInstruction(
  message: string,
  state: ShoppingSession,
): AgentPlan | undefined {
  const match =
    /^(?:i need |find |show me )?(?:(elegant|modern|romantic|minimal) )?(silver|gold|rose gold|steel|titanium|platinum) (earrings|necklaces|rings|watches)(?: under (\$|€|usd |eur )(\d+(?:\.\d{1,2})?))?(?: for (?:an? )?(evening|wedding|work|party|date|everyday)(?: event)?)?(?:\. i prefer something (noticeable|understated)(?: but (not too heavy))?)?[.!]?$/i.exec(
      message.trim(),
    );
  if (!match) return undefined;
  const [, style, material, category, currency, amount, occasion, intensity, weight] = match.map(
    (v) => v?.toLowerCase(),
  );
  if (
    amount &&
    (!Number.isFinite(Number(amount)) || Number(amount) > Number.MAX_SAFE_INTEGER / 100)
  )
    return undefined;
  const updates: ConstraintInput[] = [
    { field: 'material', value: material!, scope: 'global', source: 'explicit' },
  ];
  if (occasion)
    updates.push({ field: 'occasion', value: occasion, scope: 'global', source: 'explicit' });
  if (amount)
    updates.push({
      field: 'budget',
      value: {
        amount: Number(amount),
        currency: ['€', 'eur '].includes(currency!) ? 'EUR' : 'USD',
      },
      scope: 'global',
      source: 'explicit',
    });
  const styles = [...(style ? [style] : []), ...(weight ? ['lightweight'] : [])];
  if (styles.length)
    updates.push({ field: 'styleTags', value: styles, scope: 'global', source: 'explicit' });
  if (intensity)
    updates.push({
      field: 'visualIntensity',
      value: intensity === 'noticeable' ? 'high' : 'low',
      scope: 'global',
      source: 'explicit',
    });
  return agentPlanSchema.parse({
    intent: state.activeCategory ? 'refine_search' : 'start_search',
    disposition: 'execute',
    calls: [
      { name: 'switch_category', args: { category } },
      { name: 'update_constraints', args: { updates } },
      { name: 'search_products', args: {} },
    ],
  });
}
