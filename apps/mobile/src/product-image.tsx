import { useReducer, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { catalogAssets } from './catalog-assets';
import { imageStatus, productImageSource } from './product-image-state';

export function ProductImage({
  url,
  name,
  compact = false,
}: {
  url?: string;
  name: string;
  compact?: boolean;
}) {
  // Keyed inner state prevents late callbacks or failures from leaking into a different product.
  return <ImageFrame key={url ?? 'missing'} url={url} name={name} compact={compact} />;
}
function ImageFrame({ url, name, compact }: { url?: string; name: string; compact: boolean }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ImageAttempt
      key={attempt}
      url={url}
      name={name}
      compact={compact}
      retry={() => setAttempt((v) => v + 1)}
    />
  );
}
function ImageAttempt({
  url,
  name,
  compact,
  retry,
}: {
  url?: string;
  name: string;
  compact: boolean;
  retry: () => void;
}) {
  const source = productImageSource(url, catalogAssets);
  const [status, dispatch] = useReducer(imageStatus, 'loading');
  return (
    <View style={[styles.frame, compact && styles.compact]}>
      {source && status !== 'failed' && (
        <Image
          source={source}
          resizeMode="contain"
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          accessibilityLabel={`Demo catalog illustration of ${name}`}
          onLoad={() => dispatch('load')}
          onError={() => dispatch('error')}
          fadeDuration={0}
        />
      )}
      {!source || status === 'failed' ? (
        <View style={styles.overlay}>
          <Text style={styles.fallback}>{source ? 'Image unavailable' : 'No catalog image'}</Text>
          {!compact && <Text style={styles.caption}>{name}</Text>}
          {source && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry image for ${name}`}
              onPress={retry}
              style={styles.retry}
            >
              <Text style={styles.fallback}>Retry image</Text>
            </Pressable>
          )}
        </View>
      ) : status === 'loading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator accessibilityLabel={`Loading image for ${name}`} color="#244d3a" />
        </View>
      ) : null}
      {source && status === 'loaded' && <Text style={styles.label}>Demo illustration</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#eae7df',
    borderRadius: 12,
    overflow: 'hidden',
  },
  compact: { width: 112, height: 112, aspectRatio: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  fallback: { fontSize: 14, color: '#244d3a', textAlign: 'center' },
  caption: { fontSize: 11, color: '#526357', textAlign: 'center' },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  label: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 10,
    color: '#526357',
    backgroundColor: '#fffdf2',
    padding: 3,
    borderRadius: 4,
  },
});
