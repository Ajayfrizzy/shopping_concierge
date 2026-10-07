import { createRequire } from 'node:module';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createSession, transition } from '@youcam/decision-engine';
import type { ConstraintInput, SessionView } from '@youcam/shared';
const { renderToStaticMarkup } = createRequire(`${process.cwd()}/package.json`)(
  'react-dom/server',
) as {
  renderToStaticMarkup: (element: ReactElement) => string;
};
vi.mock('react-native', () => {
  const host = (name: string) => (p: { children?: ReactNode; accessibilityLabel?: string }) =>
    createElement('div', { 'data-native': name, 'aria-label': p.accessibilityLabel }, p.children);
  return {
    Text: host('Text'),
    View: host('View'),
    Pressable: host('Pressable'),
    StyleSheet: { create: (s: unknown) => s },
  };
});
import { RelaxationChoices } from '../relaxation-choices';
import { adjustmentLabel } from '../presentation';
import { Button } from '../ui';
const budget: ConstraintInput = {
  field: 'budget',
  value: { amount: 65, currency: 'USD' },
  scope: { category: 'earrings' },
  source: 'explicit',
};
const material: ConstraintInput = {
  field: 'material',
  value: 'silver',
  scope: { category: 'earrings' },
  source: 'explicit',
};
function session(): SessionView {
  return {
    version: 1,
    state: transition(createSession({ id: 'ux', category: 'earrings' }), {
      type: 'update_constraints',
      updates: [
        { ...budget, value: { amount: 1, currency: 'USD' }, scope: 'global' },
        { ...material, value: 'platinum', scope: 'global' },
        { field: 'occasion', value: 'wedding', scope: 'global', source: 'explicit' },
      ],
    }).state,
    pendingRelaxations: [
      {
        proposalId: 'owned-offer',
        requiresConfirmation: true,
        updates: [budget, material],
        candidateIds: ['NOT-A-PRODUCT-CARD'],
      },
    ],
  };
}
describe('relaxation UI presentation', () => {
  it('names every proposed change, separates kept constraints and never presents candidate products', () => {
    const view = session();
    const before = structuredClone(view);
    const markup = renderToStaticMarkup(
      createElement(RelaxationChoices, { session: view, disabled: false, onReview: vi.fn() }),
    );
    for (const text of [
      'No exact matches found',
      'Try one of these adjustments',
      'search adjustments, not products',
      'Nothing changes until you confirm',
      'After confirmation',
      'Proposed changes',
      'Kept as recorded',
      'Occasion: wedding',
      'Set budget to USD 65 and try silver instead',
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain('Review option');
    expect(markup).not.toContain('\\n');
    expect(markup).not.toContain('NOT-A-PRODUCT-CARD');
    expect(markup).not.toContain('data-native="Image"');
    expect(view).toEqual(before);
  });
  it('review buttons carry only the original proposal ID and respect the busy state', () => {
    const onReview = vi.fn();
    const view = session();
    const tree = RelaxationChoices({ session: view, disabled: true, onReview });
    const buttons: ReactElement<{ onPress: () => void; disabled: boolean }>[] = [];
    function visit(node: ReactNode) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object' || !('props' in node)) return;
      const el = node as ReactElement<{
        children?: ReactNode;
        onPress: () => void;
        disabled: boolean;
      }>;
      if (el.type === Button) buttons.push(el);
      visit(el.props.children);
    }
    visit(tree);
    expect(onReview).not.toHaveBeenCalled();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.props.disabled).toBe(true);
    buttons[0]!.props.onPress();
    expect(onReview).toHaveBeenCalledExactlyOnceWith('owned-offer');
  });
  it('labels single-field and non-USD adjustments without inferring a direction or changing scope', () => {
    expect(adjustmentLabel([budget])).toBe('Set budget to USD 65');
    expect(adjustmentLabel([{ ...budget, value: { amount: 50, currency: 'EUR' } }])).toBe(
      'Set budget to EUR 50',
    );
    expect(adjustmentLabel([{ ...material, value: 'gold' }])).toBe('Try gold instead');
    expect(adjustmentLabel([])).toBe('Use this adjustment');
  });
});
