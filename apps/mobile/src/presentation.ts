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
export function constraintLabel(p: ConstraintInput) {
  return `${titleCase(p.field)}: ${displayValue(p.value)} · ${p.scope === 'global' ? 'All categories' : titleCase(p.scope.category)}`;
}
export function changeLabel(change: StateChange) {
  if (change.field.startsWith('constraints.')) {
    const record = (change.current ?? change.previous) as { preference?: ConstraintInput } | null;
    return `${record?.preference ? titleCase(record.preference.field) : 'Constraint'}: ${displayValue(change.previous)} → ${displayValue(change.current)}${record?.preference ? ` · ${record.preference.scope === 'global' ? 'All categories' : titleCase(record.preference.scope.category)}` : ''}`;
  }
  if (change.field === 'activeCategory')
    return `Category: ${displayValue(change.previous)} → ${displayValue(change.current)}`;
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
        .join(' · ') || 'Product choices updated'
    );
  }
  return change.field === 'feedback'
    ? 'Your feedback was recorded for this session.'
    : 'Related product choices updated.';
}
