import { useEffect, useState } from 'react';
import {
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VtoJob } from '@youcam/shared';
import { Button, styles } from './ui';
// Separate native views prevent authenticated original headers from following a
// signed provider URL. Android RN 0.86 does not clear native headers on null.
function PrivateImage({
  source,
  label,
  width,
  height,
}: {
  source: ImageSourcePropType;
  label: string;
  width: number | '100%';
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {failed && (
        <Text accessibilityRole="alert" style={styles.error}>
          This image could not be loaded. Check your connection; image access may be unavailable.
        </Text>
      )}
      <Image
        source={source}
        accessibilityLabel={label}
        resizeMode="contain"
        style={{ width, height }}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
    </>
  );
}
export function TryOnViewer({
  job,
  original,
}: {
  job: VtoJob;
  original: () => Promise<ImageSourcePropType>;
}) {
  const [expanded, setExpanded] = useState(false),
    [zoom, setZoom] = useState(1);
  const [before, setBefore] = useState(false),
    [source, setSource] = useState<ImageSourcePropType | null>(null);
  const [error, setError] = useState<string | null>(null),
    [now, setNow] = useState(Date.now());
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => listener.remove();
  }, []);
  const result = job.result;
  const expired = result?.kind === 'image' && result.expiresAt <= now;
  useEffect(() => {
    setExpanded(false);
    setBefore(false);
    setSource(null);
    setZoom(1);
    setError(null);
    setNow(Date.now());
    if (result?.kind !== 'image') return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
      },
      Math.max(0, result.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [job.id, result]);
  useEffect(() => {
    let alive = true;
    if (before && expanded) {
      void original()
        .then((value) => {
          if (alive) setSource(value);
        })
        .catch(() => {
          if (alive)
            setError(
              'The original photo is unavailable. Return to the try-on image or restore your session.',
            );
        });
    } else setSource(null);
    return () => {
      alive = false;
    };
  }, [before, expanded, original]);
  if (result?.kind === 'mock') return <Text style={styles.text}>{result.message}</Text>;
  if (result?.kind !== 'image') return null;
  const image = (large: boolean) => {
    const showOriginal = large && before;
    if (expired && !showOriginal)
      return (
        <Text style={styles.text}>
          This try-on image has expired. It cannot be refreshed into a new render automatically.
        </Text>
      );
    if (showOriginal && !source) return null;
    return (
      <PrivateImage
        key={`${job.id}:${large}:${showOriginal ? 'original' : result.url}`}
        source={showOriginal ? source! : [{ uri: result.url, headers: {} }]}
        label={showOriginal ? 'Original uploaded photo' : 'Completed YouCam virtual try-on'}
        width={large ? (width - 32) * zoom : '100%'}
        height={large ? Math.max(200, height - 310) * zoom : 360}
      />
    );
  };
  return (
    <>
      <Text style={styles.heading}>Virtual try-on result</Text>
      {!expired && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Expand virtual try-on image"
          onPress={() => {
            setExpanded(true);
            setBefore(false);
            setZoom(1);
            setError(null);
          }}
        >
          {image(false)}
        </Pressable>
      )}
      {expired && (
        <Text style={styles.text}>
          This try-on image has expired. A new render requires another explicit request.
        </Text>
      )}
      {!expired && <Button title="Expand and compare photos" onPress={() => setExpanded(true)} />}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Modal
        visible={expanded}
        onRequestClose={() => {
          setExpanded(false);
          setBefore(false);
        }}
        animationType="fade"
      >
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.heading}>{before ? 'Original photo' : 'Virtual try-on'}</Text>
            <View style={styles.row}>
              <Button
                title="Original"
                secondary
                disabled={before}
                onPress={() => {
                  setBefore(true);
                  setZoom(1);
                  setError(null);
                }}
              />
              <Button
                title="Virtual try-on"
                secondary
                disabled={!before}
                onPress={() => {
                  setBefore(false);
                  setZoom(1);
                  setError(null);
                }}
              />
            </View>
            <View style={styles.row}>
              <Button
                title="Zoom out"
                disabled={zoom <= 1}
                onPress={() => setZoom((z) => Math.max(1, z - 0.5))}
              />
              <Text style={styles.text}>{Math.round(zoom * 100)}%</Text>
              <Button
                title="Zoom in"
                disabled={zoom >= 4}
                onPress={() => setZoom((z) => Math.min(4, z + 0.5))}
              />
              <Button title="Fit image" secondary onPress={() => setZoom(1)} />
            </View>
            <Text style={styles.muted}>
              Scroll to inspect the full photo when zoomed. Digital zoom does not add image detail.
            </Text>
            <Button
              title="Back to try-on"
              secondary
              onPress={() => {
                setExpanded(false);
                setBefore(false);
              }}
            />
          </View>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {before && !source && !error && (
            <Text style={styles.text}>Loading your private original photo…</Text>
          )}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            nestedScrollEnabled
          >
            <ScrollView horizontal nestedScrollEnabled>
              {expanded && image(true)}
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
