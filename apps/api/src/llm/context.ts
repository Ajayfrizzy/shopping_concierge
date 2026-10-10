import type { PlanningContext } from '@youcam/agent';

/** Provider-independent context boundary. Callers must still validate/authorize every proposed tool. */
export function buildLLMContext(context: PlanningContext, maxBytes = 64_000) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 256_000)
    throw new Error('Invalid LLM context budget.');
  const state = structuredClone(context.state);
  const products = context.referencedProducts.slice(0, 20).map((p) => ({
    id: p.id,
    category: p.category,
    name: p.name,
    brand: p.brand,
    price: p.price,
    currency: p.currency,
    material: p.material,
    color: p.color,
    styleTags: [...p.styleTags],
    occasionTags: [...p.occasionTags],
    inStock: p.inStock,
    vtoEligible: p.vtoEligible === true,
  }));
  const payload = {
    currentMessage: context.message,
    authoritativeState: state,
    // History and all free-text fields are data, never permission to change structured state.
    recentConversation: context.recentMessages
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) })),
    catalogFacts: products,
    availableTools: context.tools.map((t) => ({ name: t.name, description: t.description })),
    visualEvidence: {
      available: false as const,
      reason: 'No verified live visual evidence is supplied to this planner.',
    },
  };
  const bytes = () => Buffer.byteLength(JSON.stringify(payload), 'utf8');
  // Drop optional context before ever considering authoritative constraints/decisions.
  while (bytes() > maxBytes && payload.recentConversation.length)
    payload.recentConversation.shift();
  while (bytes() > maxBytes && payload.catalogFacts.length) payload.catalogFacts.pop();
  if (bytes() > maxBytes)
    throw new Error(
      'Authoritative state exceeds the configured LLM context budget. No state was omitted.',
    );
  return payload;
}
