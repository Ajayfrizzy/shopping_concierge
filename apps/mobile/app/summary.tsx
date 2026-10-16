import { productName } from '../src/presentation';
import { ProductImage } from '../src/product-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categorySchema, type Product } from '@youcam/shared';
import { shoppingAPI, useShopping } from '../src/context';
import { constraintLabel, titleCase } from '../src/presentation';
import { Button, Panel, styles } from '../src/ui';

export default function Summary() {
  const { session, busy, error, controller } = useShopping();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [lookupError, setLookupError] = useState(false);
  const [loading, setLoading] = useState(false);
  const ids = JSON.stringify(
    [
      ...new Set(
        Object.values(session?.state.decisions ?? {}).flatMap((d) => [
          ...d.saved,
          ...d.shortlisted,
          ...d.selected,
          ...d.rejected,
        ]),
      ),
    ].sort(),
  );
  useEffect(() => {
    let cancelled = false;
    setProducts({});
    setLookupError(false);
    const productIds = JSON.parse(ids) as string[];
    if (!productIds.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled(productIds.map((id) => shoppingAPI.product(id))).then((results) => {
      if (cancelled) return;
      setProducts(
        Object.fromEntries(
          results.flatMap((r) => (r.status === 'fulfilled' ? [[r.value.id, r.value]] : [])),
        ),
      );
      setLookupError(results.some((r) => r.status === 'rejected'));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ids, session?.version]);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Your shopping session</Text>
        <Button title="Back to conversation" secondary onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!session ? (
          <Text style={styles.text}>
            Describe a shopping goal to begin. Your decisions will appear here.
          </Text>
        ) : (
          <>
            <Text style={styles.text}>
              Active category:{' '}
              {session.state.activeCategory
                ? titleCase(session.state.activeCategory)
                : 'Not chosen'}
            </Text>
            <Panel>
              <Text style={styles.heading}>Your preferences</Text>
              {session.state.constraints.length ? (
                session.state.constraints.map((c, i) => (
                  <Text key={i} style={styles.text}>
                    {constraintLabel(c.preference)}
                    {c.preference.source !== 'explicit'
                      ? ` · ${titleCase(c.preference.source)}`
                      : ''}
                  </Text>
                ))
              ) : (
                <Text style={styles.text}>No preferences recorded yet.</Text>
              )}
            </Panel>
            {loading && (
              <ActivityIndicator accessibilityLabel="Loading catalog details" color="#244d3a" />
            )}
            {lookupError && (
              <Text style={styles.error}>
                Some catalog details are unavailable. IDs below still reflect your saved session.
              </Text>
            )}
            {Object.entries(session.state.decisions).map(([category, decision]) => (
              <Panel key={category}>
                <Text style={styles.heading}>{titleCase(category)}</Text>
                {(['selected', 'shortlisted', 'saved', 'rejected'] as const).map((kind) => (
                  <View key={kind} style={{ gap: 5 }}>
                    <Text style={styles.heading}>{titleCase(kind)}</Text>
                    {decision[kind].length ? (
                      decision[kind].map((id) => (
                        <View
                          key={id}
                          style={{
                            gap: 12,
                            minHeight: 112,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <ProductImage
                            compact
                            url={products[id]?.imageUrl}
                            name={products[id] ? productName(products[id].name) : id}
                          />
                          <Text style={[styles.text, { flex: 1 }]}>
                            {products[id]
                              ? `${productName(products[id]!.name)} · ${products[id]!.currency} ${products[id]!.price.toFixed(2)}`
                              : `Product ${id} · details unavailable`}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.muted}>None yet</Text>
                    )}
                  </View>
                ))}
              </Panel>
            ))}
            <Text style={styles.muted}>
              Your choices are saved to this shopping session. Clearing app storage can lose access.
              Previous choices may no longer match your latest preferences. Saved means kept for
              later; shortlisted means under consideration; selected means your chosen item for
              coordinated searches.
            </Text>
            <Panel>
              <Text style={styles.heading}>Coordinate selected products</Text>
              {Object.entries(session.state.decisions).flatMap(([category, d]) =>
                d.selected.map((id) => (
                  <View key={id} style={{ gap: 8 }}>
                    <Text style={styles.text}>
                      Chosen {id} · {titleCase(category)}
                    </Text>
                    {categorySchema.options
                      .filter((target) => target !== category)
                      .map((target) => (
                        <Button
                          key={target}
                          title={`Find ${target} with ${id}`}
                          secondary
                          disabled={busy}
                          onPress={() => {
                            void controller.message(`Find ${target} that works with ${id}`);
                            router.back();
                          }}
                        />
                      ))}
                  </View>
                )),
              )}
              {!Object.values(session.state.decisions).some((d) => d.selected.length) && (
                <Text style={styles.muted}>
                  Select your chosen product to find accessories that work with it.
                </Text>
              )}
              {session.state.dependencies.map((d) => (
                <Text key={`${d.anchorProductId}:${d.targetCategory}`} style={styles.text}>
                  Finding {d.targetCategory} to complement {d.anchorProductId}
                </Text>
              ))}
            </Panel>
            <Button
              title="Refresh session"
              disabled={busy}
              onPress={() => {
                void controller.refresh();
              }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
