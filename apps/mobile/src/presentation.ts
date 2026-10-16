import type { ConstraintInput, JsonValue, StateChange } from '@youcam/shared';
export const titleCase = (text: string) =>
  text
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : 'None';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('amount' in obj && 'currency' in obj) return `${obj.currency} ${obj.amount}`;
    if ('preference' in obj) return displayValue((obj.preference as ConstraintInput).value);
    return Object.entries(obj)
      .map(([k, v]) => `${titleCase(k)}: ${displayValue(v)}`)
      .join(' · ');
  }
  return String(value);
}
export const productName = (name: string) => name.replace(/^Fixture /i, '');
export function productAttributes(product: { material?: string; color?: string }) {
  return (
    [...new Set([product.material, product.color].filter(Boolean))].join(' · ') ||
    'Material and color unspecified'
  );
}
export function constraintLabel(p: ConstraintInput) {
  const scope = p.scope === 'global' ? 'all accessories' : p.scope.category;
  const label =
    p.field === 'vtoOnly'
      ? p.value
        ? 'Virtual try-on available'
        : 'All products'
      : p.field === 'budget'
        ? `Up to ${displayValue(p.value)}`
        : p.field === 'visualIntensity'
          ? `Look: ${{ low: 'subtle', medium: 'balanced', high: 'noticeable' }[p.value]}`
          : p.field === 'styleTags'
            ? `Style: ${p.value.map((v) => (v === 'lightweight' ? 'lightweight (weight unverified)' : v)).join(', ')}`
            : `${titleCase(p.field)}: ${displayValue(p.value)}`;
  return `${label} · ${scope}`;
}
export function adjustmentLabel(updates: ConstraintInput[]) {
  return (
    updates
      .map((p, i) => {
        const label =
          p.field === 'budget'
            ? `Set budget to ${displayValue(p.value)}`
            : p.field === 'material' || p.field === 'color'
              ? `Try ${displayValue(p.value)} instead`
              : `Adjust ${titleCase(p.field).toLowerCase()}`;
        return i === 0 ? label : label[0]!.toLowerCase() + label.slice(1);
      })
      .join(' and ') || 'Use this adjustment'
  );
}
export function changeLabel(change: StateChange) {
  if (change.field.startsWith('constraints.')) {
    const record = (change.current ?? change.previous) as { preference?: ConstraintInput } | null;
    return record?.preference
      ? `${change.current ? 'Updated' : 'Removed'}: ${constraintLabel(record.preference)}`
      : 'Preferences updated';
  }
  if (change.field === 'activeCategory') return `Now browsing ${displayValue(change.current)}`;
  if (change.field.startsWith('decisions.')) {
    const previous = (change.previous ?? {}) as Record<string, JsonValue>;
    const current = (change.current ?? {}) as Record<string, JsonValue>;
    return (
      Object.keys(current)
        .filter(
          (k) =>
            JSON.stringify(current[k]) !== JSON.stringify(previous[k]) &&
            displayValue(current[k]) !== 'None',
        )
        .map((k) => `${titleCase(k)}: ${displayValue(current[k])}`)
        .join(' · ') || 'Your choices have been saved'
    );
  }
  return change.field === 'feedback'
    ? 'Your feedback was recorded for this session.'
    : 'Related product choices updated.';
}
