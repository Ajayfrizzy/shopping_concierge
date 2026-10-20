import { ExistingResultRecovery } from '../src/existing-result-recovery';
import { productName } from '../src/presentation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID, digest, CryptoDigestAlgorithm } from 'expo-crypto';
import { createUploadRecovery } from '../src/upload-recovery';
import type { Product, VisualAsset, VisualAssetType } from '@youcam/shared';
import { guestCredential, shoppingAPI, useShopping } from '../src/context';
import { createVisualAPI, pickedImageMime } from '../src/visual-client';
import { createTryOnSession } from '../src/try-on-session';
import { TryOnViewer } from '../src/try-on-viewer';
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
  return id ? (
    <TryOnSession key={`${id}:${productId}`} id={id} productId={productId} />
  ) : (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.text}>Restore your shopping session to view try-on.</Text>
      <Button title="Back to shopping" onPress={() => router.back()} />
    </SafeAreaView>
  );
}
function TryOnSession({ id, productId }: { id: string; productId: string }) {
  const controller = useMemo(() => {
    const path = `${FileSystem.documentDirectory}try-on-${encodeURIComponent(id)}-${encodeURIComponent(productId)}.json`;
    return createTryOnSession(
      api,
      {
        async read() {
          return (await FileSystem.getInfoAsync(path)).exists
            ? FileSystem.readAsStringAsync(path)
            : null;
        },
        async write(value) {
          await FileSystem.writeAsStringAsync(path + '.tmp', value);
          await FileSystem.moveAsync({ from: path + '.tmp', to: path });
        },
      },
      id,
      productId,
      randomUUID,
    );
  }, [id, productId]);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [product, setProduct] = useState<Product | null>(null),
    [needed, setNeeded] = useState<VisualAssetType | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false),
    alive = useRef(true),
    focused = useRef(true);
  const recovery = useMemo(() => {
    const path = `${FileSystem.documentDirectory}upload-${encodeURIComponent(id)}-${encodeURIComponent(productId)}.json`;
    return createUploadRecovery(
      api,
      {
        async read() {
          return (await FileSystem.getInfoAsync(path)).exists
            ? FileSystem.readAsStringAsync(path)
            : null;
        },
        async write(value) {
          await FileSystem.writeAsStringAsync(path + '.tmp', value);
          await FileSystem.moveAsync({ from: path + '.tmp', to: path });
        },
      },
      id,
      productId,
      async (bytes) => {
        const result = await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
        return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
      },
    );
  }, [id, productId]);
  const [recoveryReady, setRecoveryReady] = useState(false),
    [recovering, setRecovering] = useState(false),
    [recoveryOpen, setRecoveryOpen] = useState(false),
    [uploadId, setUploadId] = useState(''),
    [preview, setPreview] = useState<Awaited<ReturnType<typeof api.originalSource>> | null>(null),
    [previewLoaded, setPreviewLoaded] = useState(false),
    [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  async function associate(asset: VisualAsset) {
    if (
      !alive.current ||
      !focused.current ||
      !needed ||
      asset.type !== needed ||
      asset.sessionId !== id ||
      !state.ready ||
      state.pending ||
      state.job
    )
      throw new Error('This photo cannot be associated with the current try-on.');
    await controller.photo(asset.id);
    if (controller.getSnapshot().assetId !== asset.id || controller.getSnapshot().error)
      throw new Error('The photo could not be saved on this phone. Recover the same upload again.');
  }
  async function recover(confirm = false) {
    if (uploadLock.current || !needed || !recoveryReady || state.pending || state.job) return;
    uploadLock.current = true;
    setRecovering(true);
    setError(null);
    try {
      if (confirm) {
        if (!previewLoaded) throw new Error('Review the stored photo before confirming.');
        await recovery.confirm(associate);
        setRecoveryOpen(false);
        setPreview(null);
        setUploadId('');
        setRecoveryNotice(
          'Existing photo recovered. No photo was uploaded and no try-on was started.',
        );
      } else {
        setPreview(null);
        setPreviewLoaded(false);
        await recovery.inspect(uploadId, needed);
        setUploadId(recovery.getPending()!.id);
        setPreview(await api.originalSource(id, recovery.getCandidate()!.id));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Upload recovery failed. Nothing was uploaded or rendered.',
      );
    } finally {
      uploadLock.current = false;
      setRecovering(false);
    }
  }
  const loadProduct = useCallback(async () => {
    const p = await shoppingAPI.product(productId);
    const result = await api.create(id, { requestId: randomUUID(), productId });
    if (!alive.current) return;
    setProduct(p);
    if (result.type === 'unavailable') {
      setUnavailable(result.message);
      setNeeded(null);
    }
    if (result.type === 'request_image') {
      setUnavailable(null);
      setNeeded(result.requiredType);
    }
  }, [id, productId]);
  useEffect(() => {
    alive.current = true;
    void loadProduct().catch(() => {
      if (alive.current) setError('Unable to load try-on availability. Refresh to try again.');
    });
    void controller.boot();
    void recovery
      .boot()
      .then(() => {
        if (alive.current) {
          setRecoveryReady(true);
          if (recovery.getPending()) {
            setUploadId(recovery.getPending()!.id);
            setRecoveryOpen(true);
          }
        }
      })
      .catch(() => {
        if (alive.current)
          setError('Upload recovery journal could not be read. Do not upload again.');
      });
    const subscription = AppState.addEventListener('change', (value) =>
      controller.visibility(value === 'active' && focused.current),
    );
    return () => {
      alive.current = false;

      subscription.remove();
      controller.dispose();
    };
  }, [controller, loadProduct, recovery]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      controller.visibility(AppState.currentState === 'active');
      return () => {
        focused.current = false;
        controller.visibility(false);
      };
    }, [controller]),
  );
  const original = useCallback(
    () => api.originalSource(id, state.job!.assetId),
    [id, state.job?.assetId],
  );
  async function chooseImage() {
    if (!needed || uploadLock.current || !recoveryReady || recovery.getPending()) return;
    uploadLock.current = true;
    setUploading(true);
    setRecoveryNotice(null);
    setError(null);
    try {
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
      await recovery.upload(
        {
          requestId: randomUUID(),
          type: needed,
          mimeType: pickedImageMime(photo.base64),
          data: photo.base64,
        },
        associate,
      );
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'Upload confirmation failed. Recover the existing upload; do not upload again.',
        );
        if (recovery.getPending()) {
          setUploadId(recovery.getPending()!.id);
          setRecoveryOpen(true);
        }
      }
    } finally {
      uploadLock.current = false;
      if (alive.current) setUploading(false);
    }
  }
  const busy = state.busy || uploading || recovering;
  const active = state.job?.status === 'queued' || state.job?.status === 'processing';
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Try on</Text>
        <Button title="Back to shopping" secondary onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>
          {product ? productName(product.name) : 'Loading product…'}
        </Text>
        <Text style={styles.text}>
          Choose photo → Try on → View result. Your preferences and product decisions stay
          unchanged.
        </Text>
        {unavailable && (
          <Panel>
            <Text style={styles.text}>{unavailable}</Text>
          </Panel>
        )}
        {busy && (
          <ActivityIndicator
            accessibilityLabel={uploading ? 'Uploading private photo' : 'Updating try-on'}
          />
        )}
        {(error || state.error) && (
          <Panel>
            <Text accessibilityRole="alert" style={styles.error}>
              {error ?? state.error}
            </Text>
            <Button
              title="Refresh existing try-on"
              disabled={busy}
              onPress={() => {
                setError(null);
                void loadProduct().catch(() => setError('Availability could not be refreshed.'));
                void (state.ready ? controller.refresh() : controller.boot());
              }}
            />
          </Panel>
        )}
        {recoveryNotice && (
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            {recoveryNotice}
          </Text>
        )}
        {state.notice && !recoveryNotice && (
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            {state.notice}
          </Text>
        )}
        {state.job && (
          <Panel>
            <Text accessibilityLiveRegion="polite" style={styles.heading}>
              {state.job.mode === 'mock' ? 'Mock try-on' : 'YouCam try-on'} ·{' '}
              {state.job.status === 'queued'
                ? 'Preparing your try-on'
                : state.job.status === 'processing'
                  ? 'Creating your preview…'
                  : state.job.status === 'completed'
                    ? 'Your result is ready'
                    : 'Try-on could not finish'}
            </Text>
            {state.waiting && (
              <>
                <ActivityIndicator accessibilityLabel="Waiting for try-on result" />
                <Button title="Stop waiting" secondary onPress={controller.pause} />
              </>
            )}
            {active && !state.waiting && (
              <Button
                title={state.job.status === 'queued' ? 'Try on' : 'Resume checking result'}
                disabled={busy || !!unavailable || !recoveryReady || !!recovery.getPending()}
                onPress={() => {
                  void (state.job?.status === 'queued' ? controller.start() : controller.refresh());
                }}
              />
            )}
            {state.job.error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {state.job.error.message}
              </Text>
            )}
            <ExistingResultRecovery
              job={state.job}
              sessionId={id}
              productId={productId}
              busy={busy}
              onPress={() => void controller.checkExistingResult()}
            />
            <TryOnViewer job={state.job} original={original} />
            {!active && (
              <Button
                title="Choose another photo"
                secondary
                disabled={busy}
                onPress={() => {
                  void controller.another();
                }}
              />
            )}
          </Panel>
        )}
        {!state.job && !state.pending && needed && !unavailable && (
          <Panel>
            <Button
              title="Recover existing upload"
              secondary
              disabled={busy || !recoveryReady || !state.ready}
              onPress={() => {
                setRecoveryOpen(true);
                if (recovery.getPending()) setUploadId(recovery.getPending()!.id);
              }}
            />
            {recoveryOpen && (
              <>
                <Text style={styles.text}>
                  Recover a photo already uploaded to this session. No photo is uploaded again and
                  no try-on is started. If the upload ID was not saved on this phone, use its exact
                  ID from your upload record; photos are never chosen automatically.
                </Text>
                <TextInput
                  accessibilityLabel="Existing upload ID"
                  value={uploadId}
                  maxLength={36}
                  editable={!busy && !recovery.getPending()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setUploadId(value);
                    setPreview(null);
                    setPreviewLoaded(false);
                  }}
                  style={{ borderWidth: 1, borderColor: '#7d887c', padding: 12, color: '#163026' }}
                />
                <Button
                  title="Check existing upload"
                  disabled={busy || !uploadId.trim()}
                  onPress={() => {
                    void recover();
                  }}
                />
                {preview && (
                  <>
                    <Text style={styles.text}>
                      Check that this is the intended {needed} photo for{' '}
                      {product ? productName(product.name) : 'this product'}. Confirming only
                      restores the photo association.
                    </Text>
                    <Image
                      source={preview}
                      accessibilityLabel="Existing uploaded photo preview"
                      style={{ width: '100%', height: 240 }}
                      resizeMode="contain"
                      onLoad={() => setPreviewLoaded(true)}
                      onError={() => {
                        setPreviewLoaded(false);
                        setError(
                          'Stored photo could not be displayed. No association was changed.',
                        );
                      }}
                    />
                    <Button
                      title="Use recovered photo"
                      disabled={busy || !previewLoaded}
                      onPress={() => {
                        void recover(true);
                      }}
                    />
                  </>
                )}
              </>
            )}
          </Panel>
        )}
        {!state.job && needed && !unavailable && (
          <Panel>
            <Text style={styles.heading}>Choose a {needed} photo</Text>
            <Text style={styles.text}>
              {needed === 'portrait'
                ? product?.category === 'earrings'
                  ? 'Use a side portrait with an exposed ear.'
                  : 'Show your neck and upper chest with enough space for a necklace.'
                : needed === 'hand'
                  ? 'Show the hand and fingers clearly.'
                  : 'Show your wrist and hand with all five fingers visible.'}{' '}
              Use a clear, well-lit image. An unsuitable pose may be rejected.
            </Text>
            <Text style={styles.muted}>
              Choosing a photo uploads it privately to your session. Tap Try on to send it for
              rendering. Mock mode creates no rendered image.
            </Text>
            {!state.pending && (
              <Button
                title={state.assetId ? 'Choose a different photo' : 'Choose and upload photo'}
                disabled={busy || !state.ready || !recoveryReady || !!recovery.getPending()}
                onPress={() => {
                  void chooseImage();
                }}
              />
            )}
            {state.assetId && !recovery.getPending() && (
              <>
                <Text style={styles.text}>Photo uploaded privately.</Text>
                <Button
                  title={state.pending ? 'Resume try-on request' : 'Try on'}
                  disabled={busy || !state.ready || !recoveryReady || !!recovery.getPending()}
                  onPress={() => {
                    void controller.start();
                  }}
                />
              </>
            )}
          </Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
