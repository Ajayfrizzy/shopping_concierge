import { ProductImage } from './product-image';
import { Text, View } from 'react-native';
import type { Comparison } from '@youcam/shared';
import { constraintLabel } from './presentation';
import { Panel, styles } from './ui';
export function ComparisonView({ comparison }: { comparison: Comparison }) {
  return (
    <Panel>
      <Text style={styles.heading}>Compare against your criteria</Text>
      {comparison.criteria.length ? (
        comparison.criteria.map((c, i) => (
          <Text style={styles.muted} key={i}>
            {constraintLabel(c)}
          </Text>
        ))
      ) : (
        <Text style={styles.muted}>
          No preference criteria recorded. Facts below are not a style verdict.
        </Text>
      )}
      {comparison.items.map((item) => (
        <View key={item.product.id} style={{ gap: 8 }}>
          <ProductImage url={item.product.imageUrl} name={item.product.name} />
          <Text style={styles.heading}>
            {item.product.name} · {item.product.id}
          </Text>
          <Text style={styles.text}>
            {item.product.currency} {item.product.price.toFixed(2)} ·{' '}
            {item.product.inStock ? 'In stock (fixture)' : 'Out of stock (fixture)'}
          </Text>
          <Text style={styles.text}>
            {item.product.material ?? 'Material unknown'} · {item.product.color ?? 'Color unknown'}
          </Text>
          <Text style={styles.muted}>
            Style: {item.product.styleTags.join(', ') || 'Unknown'} · Occasions:{' '}
            {item.product.occasionTags.join(', ') || 'Unknown'}
          </Text>
          <Text style={item.eligible ? styles.text : styles.error}>
            {item.eligible
              ? 'Meets current hard constraints'
              : `Not a current recommendation: ${[...item.violations, ...(item.rejected ? ['rejected in this session'] : [])].join(', ')}`}
          </Text>
          {item.evidence.map((e, i) => (
            <Text key={i} style={styles.muted}>
              {e.contribution < 0
                ? 'Feedback concern'
                : e.anchorProductId
                  ? `Shared with ${e.anchorProductId}`
                  : 'Criteria match'}
              : {e.attributes.join(', ')}
              {e.feedbackProductId ? ` · rejection ${e.feedbackProductId}` : ''}
            </Text>
          ))}
        </View>
      ))}
      <Text style={styles.muted}>
        Catalog facts and recorded criteria only. No visual analysis or invented overall winner.
      </Text>
    </Panel>
  );
}
