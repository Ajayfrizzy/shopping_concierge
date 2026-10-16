import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type { Product, VisualAsset, VtoJob, VisualAssetType } from '@youcam/shared';
import { guestCredential, shoppingAPI, useShopping } from '../src/context';
import { createVisualAPI, pickedImageMime } from '../src/visual-client';
import { Button, Panel, styles } from '../src/ui';
const api = createVisualAPI(
  process.env.EXPO_PUBLIC_API_URL ??
    (__DEV__ ? 'http://10.0.2.2:4000' : 'https://shoppingconcierge.rumptycloud.app'),
  guestCredential,
);
export default function TryOn() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { session } = useShopping();
  const id = session?.state.id;
  const [product, setProduct] = useState<Product | null>(null),
    [job, setJob] = useState<VtoJob | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [needed, setNeeded] = useState<VisualAssetType | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<VisualAsset | null>(null);
  const requestId = useRef(randomUUID());
  const alive = useRef(true);
  const lock = useRef(false);
  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Try-on could not finish. Refresh and retry.');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function refresh() {
    if (!id) return;
    const p = await shoppingAPI.product(productId);
    if (alive.current) setProduct(p);
    const jobs = await api.list(id);
    if (alive.current) setJob(jobs.filter((j) => j.productId === productId).at(-1) ?? null);
    const result = await api.create(id, { requestId: requestId.current, productId });
    if (alive.current && result.type === 'unavailable') {
      setUnavailable(result.message);
      setNeeded(null);
    }
    if (alive.current && result.type === 'request_image') {
      setUnavailable(null);
      setNeeded(result.requiredType);
    }
  }
  useEffect(() => {
    alive.current = true;
    if (id) void run(refresh);
    return () => {
      alive.current = false;
    };
    // This route is mounted for one product/session. Server state, not chat, restores its job.
  }, [id, productId]);
  async function chooseImage() {
    if (!id || !needed) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
      allowsEditing: false,
    });
    if (picked.canceled) return;
    const photo = picked.assets[0];
    if (
      !photo?.base64 ||
      photo.base64.length > 5_592_408 ||
      photo.width * photo.height > 16_000_000
    )
      throw new Error('Choose a PNG/JPEG up to 4 MiB and 16 megapixels.');
    const uploaded = await api.upload(id, {
      requestId: randomUUID(),
      type: needed,
      mimeType: pickedImageMime(photo.base64),
      data: photo.base64,
    });
    if (alive.current) setAsset(uploaded);
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Try on</Text>
        {unavailable && <Text style={styles.text}>{unavailable}</Text>}
        <Button title="Back to shopping" secondary onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{product?.name ?? 'Loading product…'}</Text>
        <Text style={styles.text}>
          Try-on is optional visual evidence. It does not change your preferences or product
          decisions.
        </Text>
        {busy && <ActivityIndicator accessibilityLabel="Updating try-on" />}
        {error && (
          <Panel>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Button
              title="Refresh try-on"
              disabled={busy}
              onPress={() => {
                void run(refresh);
              }}
            />
          </Panel>
        )}
        {job && (
          <Panel>
            <Text style={styles.heading}>
              {job.mode === 'mock' ? 'Mock try-on' : 'YouCam try-on'} · {job.status}
            </Text>
            {job.status === 'queued' && (
              <Text style={styles.text}>Ready to start. No rendering result exists yet.</Text>
            )}
            {job.status === 'processing' && (
              <Text style={styles.text}>
                Rendering is in progress. Check for the completed result.
              </Text>
            )}
            {(job.status === 'queued' || job.status === 'processing') && (
              <Button
                title={job.status === 'queued' ? 'Start rendering' : 'Check result'}
                disabled={busy || (job.status === 'queued' && !!unavailable)}
                onPress={() => {
                  if (id)
                    void run(async () => {
                      const result = await api.advance(id, job.id);
                      if (alive.current) setJob(result);
                    });
                }}
              />
            )}
            {job.error && <Text style={styles.error}>{job.error.message}</Text>}
            {job.result?.kind === 'mock' && <Text style={styles.text}>{job.result.message}</Text>}
            {job.result?.kind === 'image' &&
              (job.result.expiresAt > Date.now() ? (
                <Image
                  source={{ uri: job.result.url }}
                  accessibilityLabel="Completed YouCam try-on"
                  style={{ width: '100%', height: 360 }}
                  resizeMode="contain"
                  onError={() =>
                    setError('The completed image could not be loaded. Its link may have expired.')
                  }
                />
              ) : (
                <Text style={styles.text}>
                  This image link has expired. Request a new try-on if needed.
                </Text>
              ))}
            {(job.status === 'failed' || job.status === 'completed') && (
              <Button
                title={job.status === 'failed' ? 'Prepare another try-on' : 'Try a different image'}
                secondary
                disabled={busy}
                onPress={() => {
                  requestId.current = randomUUID();
                  setJob(null);
                  setAsset(null);
                }}
              />
            )}
          </Panel>
        )}
        {!job && needed && (
          <Panel>
            <Text style={styles.heading}>Choose a {needed} image</Text>
            <Text style={styles.text}>
              {needed === 'portrait'
                ? 'Show your face, ears and neckline clearly.'
                : needed === 'hand'
                  ? 'Show the hand and fingers clearly.'
                  : 'Show an unobstructed wrist.'}{' '}
              Use a clear, well-lit image. The provider may reject an unsuitable pose; the mock does
              not detect anatomy.
            </Text>
            <Text style={styles.muted}>
              Choosing a photo uploads it to your private session. Rendering may send it to YouCam
              only when live mode is configured. Mock mode generates no visual image.
            </Text>
            <Button
              title={asset ? 'Choose a different image' : 'Choose and upload image'}
              disabled={busy}
              onPress={() => {
                void run(chooseImage);
              }}
            />
            {asset && (
              <Button
                title="Request try-on"
                disabled={busy}
                onPress={() => {
                  if (id)
                    void run(async () => {
                      const result = await api.create(id, {
                        requestId: requestId.current,
                        productId,
                        assetId: asset.id,
                      });
                      if (alive.current && result.type === 'job') setJob(result.job);
                      if (alive.current && result.type === 'unavailable') {
                        setUnavailable(result.message);
                        setNeeded(null);
                      }
                    });
                }}
              />
            )}
          </Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
