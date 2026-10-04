import { z } from 'zod';
import {
  catalogSchema,
  compareArgsSchema,
  comparisonSchema,
  catalogSearchResultSchema,
  scoringConfigSchema,
  shoppingSessionSchema,
  type CatalogSearchResult,
  type ConstraintInput,
  type Product,
  type RankedProduct,
  type RankingEvidence,
  type Relaxation,
  type ScoreTier,
  type ScoringConfig,
  type ShoppingSession,
} from '@youcam/shared';
import {
  getActiveConstraints,
  getHardConstraintViolations,
  transition,
} from '@youcam/decision-engine';

const normalize = (v: string) => v.toLowerCase();
const sorted = (values: string[]) => [...new Set(values.map(normalize))].sort();
const overlap = (a: string[], b: string[]) => sorted(a).filter((v) => sorted(b).includes(v));
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const tiers: ScoreTier[] = ['explicit', 'feedback', 'saved_preference', 'visual', 'heuristic'];
const low = ['minimal', 'understated', 'delicate'];
const high = ['statement', 'oversized', 'ornate'];
const shapes = ['round', 'geometric', 'heart', 'oval', 'square'];
const optionsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
    maxRelaxations: z.number().int().min(0).max(20).default(5),
  })
  .strict();

function rank(
  product: Product,
  eligible: Product[],
  state: ShoppingSession,
  products: Map<string, Product>,
  config: ScoringConfig,
): RankedProduct {
  const scores: RankedProduct['scores'] = {
    explicit: 0,
    feedback: 0,
    saved_preference: 0,
    visual: 0,
    heuristic: 0,
  };
  const evidence: RankingEvidence[] = [];
  function add(item: RankingEvidence) {
    if (!item.contribution) return;
    scores[item.tier] += item.contribution;
    evidence.push(item);
  }
  const active = getActiveConstraints(state);
  for (const field of Object.keys(active.fields).sort() as (keyof typeof active.fields)[]) {
    const item = active.fields[field]!;
    if (item.class === 'hard') continue;
    const p = item.preference;
    const base = { tier: p.source, source: p.source };
    switch (p.field) {
      case 'styleTags': {
        const attributes = overlap(product.styleTags, p.value);
        add({
          ...base,
          signal: p.field,
          attributes,
          contribution: (config.style * attributes.length) / Math.max(1, sorted(p.value).length),
        });
        break;
      }
      case 'occasion': {
        const attributes = overlap(product.occasionTags, [p.value]);
        add({
          ...base,
          signal: p.field,
          attributes,
          contribution: attributes.length ? config.occasion : 0,
        });
        break;
      }
      case 'visualIntensity': {
        const attributes = overlap(
          product.styleTags,
          p.value === 'low' ? low : p.value === 'high' ? high : ['balanced'],
        );
        add({
          ...base,
          signal: p.field,
          attributes,
          contribution: attributes.length ? config.intensity : 0,
        });
        break;
      }
      case 'material':
      case 'color':
        if (normalize(product[p.field] ?? '') === normalize(p.value))
          add({
            ...base,
            signal: p.field,
            attributes: [product[p.field]!],
            contribution: config.attribute,
          });
        break;
      case 'pricePreference': {
        // Compare only within the same currency. No exchange rates or inferred budget.
        const prices = [
          ...new Set(eligible.filter((v) => v.currency === product.currency).map((v) => v.price)),
        ].sort((a, b) => a - b);
        const position = prices.indexOf(product.price);
        const factor =
          prices.length < 2
            ? 0
            : (p.value === 'lower' ? prices.length - 1 - position : position) / (prices.length - 1);
        add({
          ...base,
          signal: p.field,
          attributes: [`${product.currency} ${product.price}`, p.value],
          contribution: config.price * factor,
        });
        break;
      }
    }
  }
  // Cross-category signals are relevant only along explicit selected-anchor dependencies.
  const dependencies = state.dependencies.filter(
    (d) =>
      d.targetCategory === product.category &&
      d.type === 'complement' &&
      state.decisions[d.anchorCategory]?.selected.includes(d.anchorProductId),
  );
  for (const d of [...dependencies].sort((a, b) =>
    compareText(a.anchorProductId, b.anchorProductId),
  )) {
    const anchor = products.get(d.anchorProductId);
    if (!anchor || anchor.category !== d.anchorCategory) continue;
    const attributes = [
      ...(anchor.material && normalize(anchor.material) === normalize(product.material ?? '')
        ? [`material: ${product.material}`]
        : []),
      ...(anchor.color && normalize(anchor.color) === normalize(product.color ?? '')
        ? [`color: ${product.color}`]
        : []),
      ...overlap(anchor.styleTags, product.styleTags).map((v) => `style: ${v}`),
      ...overlap(anchor.occasionTags, product.occasionTags).map((v) => `occasion: ${v}`),
    ];
    add({
      tier: 'heuristic',
      signal: 'complement',
      attributes,
      contribution: attributes.length ? config.complement * Math.min(attributes.length, 4) : 0,
      anchorProductId: anchor.id,
    });
  }
  const feedbackCategories = new Set([
    product.category,
    ...dependencies.map((d) => d.anchorCategory),
  ]);
  const rejectedIds = [...feedbackCategories].flatMap((c) => state.decisions[c]?.rejected ?? []);
  for (const id of [...new Set(rejectedIds)].sort()) {
    const rejected = products.get(id);
    if (!rejected) continue;
    const feedback = state.feedback
      .filter(
        (f) =>
          f.category === rejected.category &&
          f.input.productId === id &&
          f.input.action === 'reject',
      )
      .sort((a, b) => b.revision - a.revision)[0];
    if (feedback?.input.action !== 'reject') continue;
    // Price, physical size and shape are not comparable across accessory categories.
    if (
      rejected.category !== product.category &&
      ![
        'too_flashy',
        'too_plain',
        'wrong_style',
        'wrong_occasion',
        'wrong_material',
        'wrong_color',
      ].includes(feedback.input.reasonCode ?? '')
    )
      continue;
    let attributes: string[] = [];
    switch (feedback.input.reasonCode) {
      case 'too_flashy':
        attributes = overlap(product.styleTags, overlap(rejected.styleTags, high));
        break;
      case 'too_plain':
        attributes = overlap(product.styleTags, overlap(rejected.styleTags, low));
        break;
      case 'too_large':
        attributes = overlap(
          product.styleTags,
          overlap(rejected.styleTags, ['oversized', 'large']),
        );
        break;
      case 'too_small':
        attributes = overlap(product.styleTags, overlap(rejected.styleTags, ['small', 'delicate']));
        break;
      case 'wrong_style':
        attributes = overlap(product.styleTags, rejected.styleTags);
        if (rejected.category !== product.category)
          attributes = attributes.filter(
            (tag) => ![...shapes, 'small', 'large', 'oversized'].includes(tag),
          );
        break;
      case 'wrong_occasion':
        attributes = overlap(product.occasionTags, rejected.occasionTags);
        break;
      case 'dislikes_shape':
        attributes = overlap(product.styleTags, overlap(rejected.styleTags, shapes));
        break;
      case 'wrong_material':
      case 'wrong_color': {
        const field = feedback.input.reasonCode === 'wrong_material' ? 'material' : 'color';
        if (rejected[field] && normalize(rejected[field]) === normalize(product[field] ?? ''))
          attributes = [rejected[field]];
        break;
      }
      case 'too_expensive':
        if (product.currency === rejected.currency && product.price >= rejected.price)
          attributes = [`${product.currency} ${product.price} >= ${rejected.price}`];
        break;
      // Missing/other/owns_similar cannot justify guessing an attribute dislike.
    }
    add({
      tier: 'feedback',
      signal: 'rejection',
      contribution: attributes.length ? -config.rejection : 0,
      attributes,
      feedbackProductId: id,
    });
  }
  return { product, scores, evidence };
}

function proposals(state: ShoppingSession, catalog: Product[], max: number): Relaxation[] {
  const active = getActiveConstraints(state);
  const groups = new Map<string, Relaxation>();
  const rejected = state.activeCategory ? state.decisions[state.activeCategory]!.rejected : [];
  for (const product of catalog) {
    if (
      product.category !== state.activeCategory ||
      !product.inStock ||
      rejected.includes(product.id)
    )
      continue;
    const violations = getHardConstraintViolations(state, product);
    const updates: ConstraintInput[] = [];
    let possible = true;
    for (const field of violations.sort()) {
      if (field === 'budget') {
        const p = active.fields.budget?.preference;
        if (p?.field !== 'budget' || p.value.currency !== product.currency) {
          possible = false;
          break;
        }
        updates.push({
          field: 'budget',
          value: { amount: product.price, currency: product.currency },
          source: 'explicit',
          scope: { category: product.category },
        });
      } else if (field === 'material' || field === 'color') {
        const value = product[field];
        if (!value) {
          possible = false;
          break;
        }
        updates.push({ field, value, source: 'explicit', scope: { category: product.category } });
      } else if (field === 'excludedTags' || field === 'excludedProductIds') {
        for (const c of active.fields[field]!.evidence) {
          const p = c.preference;
          if (p.field !== field) continue;
          const value = p.value.filter((v) =>
            field === 'excludedTags' ? !overlap([v], product.styleTags).length : v !== product.id,
          );
          if (value.length !== p.value.length) updates.push({ ...p, value });
        }
      } else {
        possible = false;
        break;
      }
    }
    if (!possible || !updates.length) continue;
    updates.sort((a, b) =>
      compareText(`${a.field}:${JSON.stringify(a.scope)}`, `${b.field}:${JSON.stringify(b.scope)}`),
    );
    // Preview the exact proposed atomic updates with the same engine and guard.
    const preview = transition(state, { type: 'update_constraints', updates }).state;
    if (getHardConstraintViolations(preview, product).length) continue;
    const key = JSON.stringify(updates);
    const existing = groups.get(key);
    if (existing) existing.candidateIds.push(product.id);
    else groups.set(key, { requiresConfirmation: true, updates, candidateIds: [product.id] });
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        a.updates.length - b.updates.length || compareText(a.candidateIds[0]!, b.candidateIds[0]!),
    )
    .slice(0, max);
}

export class CatalogError extends Error {
  constructor(
    readonly code: 'UNKNOWN_PRODUCT' | 'INVALID_COMPARISON',
    message: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

/** Backend-owned catalog boundary: validate once, keep a private snapshot, return clones. */
export function createCatalog(rawProducts: unknown) {
  const catalog = catalogSchema.parse(rawProducts).sort((a, b) => compareText(a.id, b.id));
  const byId = new Map(catalog.map((p) => [p.id, p]));
  return {
    getProduct(id: string): Product | undefined {
      const product = byId.get(id);
      return product ? structuredClone(product) : undefined;
    },
    compare(rawState: unknown, rawIds: unknown) {
      const state = shoppingSessionSchema.parse(rawState);
      const { productIds } = compareArgsSchema.parse({ productIds: rawIds });
      if (productIds[0] === productIds[1])
        throw new CatalogError('INVALID_COMPARISON', 'Choose two distinct catalog products.');
      const products = productIds.map((id) => {
        const product = byId.get(id);
        if (!product)
          throw new CatalogError('UNKNOWN_PRODUCT', 'A compared product is not in the catalog.');
        return product;
      });
      const category = products[0]!.category;
      if (products.some((p) => p.category !== category) || state.activeCategory !== category)
        throw new CatalogError('INVALID_COMPARISON', 'Compare products from the active category.');
      const eligible = catalog.filter(
        (p) =>
          !getHardConstraintViolations(state, p).length &&
          !state.decisions[category]!.rejected.includes(p.id),
      );
      const criteria = Object.values(getActiveConstraints(state).fields).map((c) => c.preference);
      const items = products.map((product) => {
        const violations = getHardConstraintViolations(state, product);
        const rejected = state.decisions[category]!.rejected.includes(product.id);
        return {
          product,
          violations,
          rejected,
          eligible: !violations.length && !rejected,
          evidence: rank(
            product,
            [...eligible.filter((p) => p.id !== product.id), product],
            state,
            byId,
            scoringConfigSchema.parse({}),
          ).evidence,
        };
      });
      return comparisonSchema.parse({ category, criteria, items });
    },
    search(
      rawState: unknown,
      rawConfig: unknown = {},
      rawOptions: unknown = {},
    ): CatalogSearchResult {
      const state = shoppingSessionSchema.parse(rawState);
      const config = scoringConfigSchema.parse(rawConfig);
      const options = optionsSchema.parse(rawOptions);
      if (!state.activeCategory)
        return {
          status: 'category_required',
          exactMatches: [],
          totalExactMatches: 0,
          relaxations: [],
        };
      const rejected = state.decisions[state.activeCategory]!.rejected;
      const eligible = catalog.filter(
        (p) => !rejected.includes(p.id) && getHardConstraintViolations(state, p).length === 0,
      );
      const ranked = eligible.map((p) => rank(p, eligible, state, byId, config));
      ranked.sort((a, b) => {
        for (const tier of tiers) {
          const difference = b.scores[tier] - a.scores[tier];
          if (difference) return difference;
        }
        return compareText(a.product.id, b.product.id);
      });
      return catalogSearchResultSchema.parse({
        status: ranked.length ? 'matches' : 'no_exact_match',
        totalExactMatches: ranked.length,
        exactMatches: ranked.slice(0, options.limit),
        relaxations: ranked.length ? [] : proposals(state, catalog, options.maxRelaxations),
      });
    },
  };
}
