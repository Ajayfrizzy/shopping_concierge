import {
  agentPlanSchema,
  type AgentPlan,
  type Category,
  type ConstraintInput,
  type ShoppingSession,
} from '@youcam/shared';

/** Consume a composition of bounded clauses, never extract a permissive subset of unknown text. */
export function shoppingInstruction(
  message: string,
  state: ShoppingSession,
): AgentPlan | undefined {
  let text = message.trim().toLowerCase().replaceAll('’', "'").replace(/\s+/g, ' ');
  let category: Category | undefined;
  const updates: ConstraintInput[] = [];
  const styles: string[] = [];
  let invalid = false;
  const add = (update: ConstraintInput) => {
    const previous = updates.find((u) => u.field === update.field);
    if (previous && JSON.stringify(previous.value) !== JSON.stringify(update.value)) invalid = true;
    if (!previous) updates.push(update);
  };
  const value = (field: 'material' | 'occasion' | 'visualIntensity', v: string) =>
    add({ field, value: v, scope: 'global', source: 'explicit' } as ConstraintInput);
  // Each alternative consumes a complete phrase at the cursor. Negations, disjunctions,
  // unknown modifiers and extra actions survive consumption and fail the whole request.
  while (text) {
    text = text.replace(/^[\s,.!?]+/, '');
    if (!text) break;
    const consume = (pattern: RegExp) => {
      const match = pattern.exec(text);
      if (match) text = text.slice(match[0].length).trimStart();
      return match;
    };
    if (consume(/^(?:actually|please|and|but|instead)\b/)) continue;
    if (
      consume(
        /^(?:i'm looking for|i am looking for|i'm shopping for|i am shopping for|i'd like|i would like|i need|i want|i prefer|can you find(?: me)?|could you find(?: me)?|help me choose|do you have anything|recommend(?: me)?|show me|find(?: me)?)\b/,
      )
    )
      continue;
    if (consume(/^(?:a pair of|a|an|some|something|designs|options)\b/)) continue;
    const cat = consume(/^(earrings?|necklaces?|rings?|watches|watch)\b/);
    if (cat) {
      const next = (
        cat[1] === 'watch' ? 'watches' : cat[1]!.endsWith('s') ? cat[1] : cat[1] + 's'
      ) as Category;
      if (category && category !== next) invalid = true;
      category = next;
      continue;
    }
    const budget = consume(
      /^(?:under|below|less than|up to|at most|max|(?:increase|raise|change|set|lower|reduce) my budget to|with a budget of) (\$|€|usd\s*|eur\s*)(\d+(?:\.\d{1,2})?)(?=\s|[,.!?]|$)/,
    );
    if (budget) {
      const amount = Number(budget[2]);
      if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) invalid = true;
      add({
        field: 'budget',
        value: { amount, currency: /€|eur/.test(budget[1]!) ? 'EUR' : 'USD' },
        scope: 'global',
        source: 'explicit',
      });
      continue;
    }
    const material = consume(/^(?:in |made of )?(rose gold|silver|gold|steel|titanium|platinum)\b/);
    if (material) {
      value('material', material[1]!);
      continue;
    }
    const occasion = consume(
      /^(?:suitable for |for )(?:an? )?(evening|wedding|work|party|date|everyday)(?: event)?\b/,
    );
    if (occasion) {
      value('occasion', occasion[1]!);
      continue;
    }
    if (
      consume(
        /^(?:with virtual try-on(?: available)?|that supports? virtual try-on|that i can try on virtually|supports? virtual try-on|with virtual try on(?: available)?)\b/,
      )
    ) {
      add({ field: 'vtoOnly', value: true, scope: 'global', source: 'explicit' });
      continue;
    }
    const low = consume(
      /^(?:not too (?:loud|flashy)|nothing too flashy|understated|subtle|less noticeable)(?: than the last recommendations)?\b/,
    );
    if (low) {
      value('visualIntensity', 'low');
      continue;
    }
    if (
      consume(/^(?:more noticeable(?: than the last recommendations)?|noticeable|statement|bold)\b/)
    ) {
      value('visualIntensity', 'high');
      continue;
    }
    if (consume(/^(?:not too heavy|lightweight)\b/)) {
      styles.push('lightweight');
      continue;
    }
    const style = consume(/^(elegant|modern|romantic|minimal|stylish|sophisticated)\b/);
    if (style) {
      styles.push(style[1]!);
      continue;
    }
    return undefined;
  }
  if (invalid || (!category && !updates.length && !styles.length)) return undefined;
  if (styles.length)
    add({ field: 'styleTags', value: [...new Set(styles)], scope: 'global', source: 'explicit' });
  // Standalone budget refinements retain the established category override semantics.
  if (!category)
    for (const u of updates)
      if (u.field === 'budget' && state.activeCategory)
        u.scope = { category: state.activeCategory };
  if (!category && !state.activeCategory) return undefined;
  return agentPlanSchema.parse({
    intent: state.activeCategory ? 'refine_search' : 'start_search',
    disposition: 'execute',
    calls: [
      ...(category ? [{ name: 'switch_category', args: { category } }] : []),
      ...(updates.length ? [{ name: 'update_constraints', args: { updates } }] : []),
      { name: 'search_products', args: {} },
    ],
  });
}

/** Clarification copy cannot authorize effects; it only identifies conflicting supplied values. */
export function shoppingClarification(message: string, fallback: string): string {
  const text = message.toLowerCase();
  if ((text.match(/(?:\$|€|\busd\s*|\beur\s*)\d+/g)?.length ?? 0) > 1)
    return 'What single maximum budget and currency should I use?';
  if (
    /\b(?:silver|gold|steel|titanium|platinum)\s+or\s+(?:silver|gold|steel|titanium|platinum)\b/.test(
      text,
    )
  )
    return 'Which material should I require for this search?';
  if (
    /\b(?:subtle|understated|not too flashy)\b/.test(text) &&
    /\b(?:bold|noticeable|statement)\b/.test(text)
  )
    return 'Would you prefer subtle or noticeable designs?';
  return fallback;
}
