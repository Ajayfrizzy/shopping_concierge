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
  // Only strip an anchored, explicitly supported capability clause; unknown tails fail closed.
  const vto = /(?: with virtual try-on available| that support virtual try-on)[.!]?$/i.test(
    message.trim(),
  );
  let text = message
    .trim()
    .replace(/(?: with virtual try-on available| that support virtual try-on)[.!]?$/i, '');
  text = text.replace(/\. i want (elegant|modern|romantic|minimal|stylish) designs$/i, ' $1');
  const trailingStyle = / (elegant|modern|romantic|minimal|stylish)$/i.exec(text)?.[1];
  if (
    trailingStyle &&
    /^(?:i need |find |show me )?(?:elegant|modern|romantic|minimal|stylish) /i.test(text)
  )
    return undefined;
  if (trailingStyle) text = text.slice(0, -(trailingStyle.length + 1));
  const match =
    /^(?:i need |find |show me )?(?:(elegant|modern|romantic|minimal|stylish) )?(?:(silver|gold|rose gold|steel|titanium|platinum) )?(earrings|necklaces|rings|watches)(?: under (\$|€|usd |eur )(\d+(?:\.\d{1,2})?))?(?: for (?:an? )?(evening|wedding|work|party|date|everyday)(?: event)?)?(?:\. i prefer something (noticeable|understated)(?: but (not too heavy))?)?[.!]?$/i.exec(
      text,
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
  const updates: ConstraintInput[] = [];
  if (material)
    updates.push({ field: 'material', value: material, scope: 'global', source: 'explicit' });
  if (vto) updates.push({ field: 'vtoOnly', value: true, scope: 'global', source: 'explicit' });
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
  const styles = [
    ...((trailingStyle ?? style) ? [String(trailingStyle ?? style).toLowerCase()] : []),
    ...(weight ? ['lightweight'] : []),
  ];
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
      ...(updates.length ? [{ name: 'update_constraints', args: { updates } }] : []),
      { name: 'search_products', args: {} },
    ],
  });
}
