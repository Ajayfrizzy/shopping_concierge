import { RelaxationChoices } from '../src/relaxation-choices';
import { ProductImage } from '../src/product-image';
import { ComparisonView } from '../src/comparison-view';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedbackReasonSchema, type FeedbackReason, type Product } from '@youcam/shared';
import { useShopping } from '../src/context';
import {
  changeLabel,
  constraintLabel,
  titleCase,
  productName,
  productAttributes,
} from '../src/presentation';
import { Button, Panel, styles } from '../src/ui';

export default function Home() {
  const shopping = useShopping();
  const insets = useSafeAreaInsets();
  const { controller, session, response, busy, ready, error, retryPending, needsRefresh, expired } =
    shopping;
  const [draft, setDraft] = useState('');
  const [rejectionText, setRejectionText] = useState('');
  const [rejecting, setRejecting] = useState<Product | null>(null);
  const [reason, setReason] = useState<FeedbackReason | undefined>();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [limit, setLimit] = useState(4);
  const [compareFirst, setCompareFirst] = useState<string | null>(null);
  useEffect(() => {
    setCompareFirst(null);
  }, [session?.state.id, session?.state.activeCategory]);
  const vtoOnly =
    session?.state.constraints.some(
      (c) =>
        c.preference.field === 'vtoOnly' &&
        c.preference.value === true &&
        c.preference.scope === 'global',
    ) ?? false;
  const disabled = busy || !ready || retryPending || needsRefresh || expired;
  const offer = session?.pendingRelaxations.find((p) => p.proposalId === confirming);
  const result =
    response?.ui.type === 'product_list' || response?.ui.type === 'empty_state'
      ? response.ui.payload
      : null;
  const choices = session?.state.activeCategory
    ? session.state.decisions[session.state.activeCategory]
    : null;
  async function send() {
    if (disabled || !draft.trim()) return;
    const message = draft.trim();
    Keyboard.dismiss();
    await controller.message(message);
    if (!controller.getSnapshot().error) setDraft('');
    setLimit(4);
  }
  const feedback = (product: Product, action: 'save' | 'shortlist' | 'select') => {
    void controller.action(
      { type: 'feedback', feedback: { action, productId: product.id } },
      `${titleCase(action)} ${productName(product.name)}`,
    );
  };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Concierge</Text>
        <View style={styles.row}>
          <Button title="Session summary" secondary onPress={() => router.push('/summary')} />
          <Text style={styles.muted}>
            {session?.state.activeCategory
              ? titleCase(session.state.activeCategory)
              : 'Your next finishing touch'}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.muted}>
            Illustrative catalog with synthetic products and prices, not verified merchant
            inventory. No purchasing. Virtual try-on is available on selected products; previews are
            labeled by source.
          </Text>
          {!shopping.messages.length && (
            <Panel>
              <Text style={styles.heading}>What are you shopping for?</Text>
              <Text style={styles.text}>
                Tell me the accessory, occasion, and what matters to you. For example: “Silver
                earrings for a wedding under $120, elegant but not too loud.”
              </Text>
              <Button
                title="Use this example"
                secondary
                disabled={disabled}
                onPress={() =>
                  setDraft('Silver earrings for a wedding under $120, elegant but not too loud.')
                }
              />
            </Panel>
          )}
          {shopping.messages.slice(-8).map((message) => (
            <Panel
              key={message.id}
              style={{ backgroundColor: message.role === 'user' ? '#fff' : '#e9eee5' }}
            >
              <Text style={styles.muted}>{message.role === 'user' ? 'You' : 'Concierge'}</Text>
              <Text style={styles.text}>{message.text}</Text>
            </Panel>
          ))}
          {response?.ui.type === 'request_image' && (
            <Panel>
              <Text style={styles.text}>
                This try-on needs a {response.ui.payload.requiredType} image.
              </Text>
              <Button
                title="Open try-on"
                disabled={disabled}
                onPress={() => {
                  if (response.ui.type === 'request_image')
                    router.push({
                      pathname: '/try-on',
                      params: { productId: response.ui.payload.productId },
                    });
                }}
              />
            </Panel>
          )}
          {!!response?.events.length && (
            <Panel>
              <Text style={styles.heading}>What changed</Text>
              {response.events
                .flatMap((e) => e.changes)
                .map((change, i) => (
                  <Text key={`${i}-${change.field}`} style={styles.text}>
                    {changeLabel(change)}
                  </Text>
                ))}
            </Panel>
          )}
          {busy && (
            <View accessibilityLiveRegion="polite" style={styles.row}>
              <ActivityIndicator color="#244d3a" />
              <Text style={styles.text}>Updating your session…</Text>
            </View>
          )}
          {error && (
            <Panel>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <View style={styles.row}>
                {!expired && (
                  <Button
                    title={retryPending ? 'Retry request' : 'Refresh session'}
                    onPress={() => {
                      void (retryPending ? controller.retry() : controller.refresh());
                    }}
                    disabled={busy}
                  />
                )}
              </View>
            </Panel>
          )}
          {needsRefresh && !error && (
            <Button
              title="Refresh current results"
              onPress={() => {
                void controller.refresh();
              }}
              disabled={busy}
            />
          )}
          {response?.ui.type === 'comparison' && (
            <ComparisonView comparison={response.ui.payload} />
          )}
          {session?.state.dependencies
            .filter((d) => d.targetCategory === session.state.activeCategory)
            .map((d) => (
              <Panel key={d.anchorProductId}>
                <Text style={styles.text}>
                  Coordinating with selected {d.anchorProductId} · {titleCase(d.anchorCategory)}
                </Text>
                <Text style={styles.muted}>
                  Shared styles help order these options. Your budget and other requirements still
                  apply.
                </Text>
              </Panel>
            ))}
          {session?.state.activeCategory && (
            <Panel>
              <Text style={styles.heading}>Discover virtual try-on</Text>
              <Text style={styles.muted}>
                Only supported products matching your preferences and budget are shown. Your
                rejected items stay excluded.
              </Text>
              <Button
                title={vtoOnly ? 'Show all matching products' : 'Show virtual try-on products'}
                secondary
                disabled={disabled}
                onPress={() => {
                  void controller.action(
                    {
                      type: 'update_constraints',
                      updates: [
                        { field: 'vtoOnly', value: !vtoOnly, scope: 'global', source: 'explicit' },
                      ],
                    },
                    vtoOnly ? 'Show all matching products' : 'Show virtual try-on products',
                  );
                  setLimit(4);
                }}
              />
              {vtoOnly && result?.totalExactMatches === 0 && (
                <>
                  <Text style={styles.text}>
                    No try-on products match your current requirements. Your budget, material and
                    rejected choices have not changed.
                  </Text>
                  <Button
                    title="Revise my preferences"
                    secondary
                    disabled={disabled}
                    onPress={() => router.push('/summary')}
                  />
                  <Text style={styles.muted}>
                    Review your preferences in the summary, then tell the concierge exactly what you
                    want to change.
                  </Text>
                </>
              )}
            </Panel>
          )}
          {result && (
            <>
              {(!!result.totalExactMatches || !session?.pendingRelaxations.length) && (
                <Text style={styles.heading}>
                  {result.totalExactMatches
                    ? `${result.totalExactMatches} exact matches`
                    : 'No exact matches'}
                </Text>
              )}
              {!result.totalExactMatches && !session?.pendingRelaxations.length && (
                <Text style={styles.text}>
                  Your constraints are still active. Review a suggested change below, or describe a
                  different preference.
                </Text>
              )}
              {result.exactMatches.slice(0, limit).map(({ product, evidence }) => (
                <Panel key={product.id} style={{ backgroundColor: '#fff' }}>
                  <Text style={styles.muted}>
                    {titleCase(product.category)} · {product.id}
                  </Text>
                  <ProductImage url={product.imageUrl} name={productName(product.name)} />
                  <Text style={styles.heading}>{productName(product.name)}</Text>
                  <Text style={styles.text}>
                    {product.currency} {product.price.toFixed(2)} ·{' '}
                    {product.inStock
                      ? 'Available in sample catalog'
                      : 'Unavailable in sample catalog'}
                  </Text>
                  <Text style={styles.text}>{productAttributes(product)}</Text>
                  {!!evidence.filter((e) => e.contribution > 0).length && (
                    <Text style={styles.muted}>
                      Matches:{' '}
                      {[
                        ...new Set(
                          evidence.filter((e) => e.contribution > 0).flatMap((e) => e.attributes),
                        ),
                      ].join(' · ')}
                    </Text>
                  )}
                  {evidence
                    .filter((e) => e.contribution < 0)
                    .map((e, i) => (
                      <Text key={i} style={styles.muted}>
                        Lower priority because it shares {e.attributes.join(', ')} details with a
                        product you disliked.
                      </Text>
                    ))}
                  <Button
                    title={
                      compareFirst === product.id
                        ? 'Cancel comparison choice'
                        : compareFirst
                          ? `Compare with ${compareFirst}`
                          : 'Compare'
                    }
                    accessibilityLabel={`Compare ${product.id}`}
                    secondary
                    disabled={disabled}
                    onPress={() => {
                      if (compareFirst === product.id) setCompareFirst(null);
                      else if (compareFirst) {
                        void controller.message(`Compare ${compareFirst} and ${product.id}`);
                        setCompareFirst(null);
                      } else setCompareFirst(product.id);
                    }}
                  />
                  <View style={styles.row}>
                    <Button
                      title={choices?.saved.includes(product.id) ? 'Saved' : 'Save'}
                      accessibilityLabel={`Save ${product.id}`}
                      secondary
                      disabled={disabled || choices?.saved.includes(product.id)}
                      onPress={() => feedback(product, 'save')}
                    />
                    <Button
                      title={
                        choices?.shortlisted.includes(product.id) ? 'Shortlisted' : 'Shortlist'
                      }
                      accessibilityLabel={`Shortlist ${product.id}`}
                      secondary
                      disabled={disabled || choices?.shortlisted.includes(product.id)}
                      onPress={() => feedback(product, 'shortlist')}
                    />
                    <Button
                      title={choices?.selected.includes(product.id) ? 'Selected' : 'Select'}
                      accessibilityLabel={`Select ${product.id}`}
                      disabled={disabled || choices?.selected.includes(product.id)}
                      onPress={() => feedback(product, 'select')}
                    />
                    {product.vtoEligible && (
                      <Button
                        title="Try on"
                        accessibilityLabel={`Try on ${product.id}`}
                        secondary
                        disabled={disabled}
                        onPress={() =>
                          router.push({ pathname: '/try-on', params: { productId: product.id } })
                        }
                      />
                    )}
                    <Button
                      title="Reject"
                      accessibilityLabel={`Reject ${product.id}`}
                      secondary
                      disabled={disabled}
                      onPress={() => {
                        setRejectionText('');
                        setRejecting(product);
                        setReason(undefined);
                      }}
                    />
                  </View>
                </Panel>
              ))}
              {result.exactMatches.length > limit && (
                <Button title="Show more matches" secondary onPress={() => setLimit(limit + 4)} />
              )}
            </>
          )}
          {!!session?.pendingRelaxations.length && (
            <RelaxationChoices session={session} disabled={disabled} onReview={setConfirming} />
          )}
          {session?.state.activeCategory && (
            <View style={styles.row}>
              <Button
                title="Cheaper options"
                secondary
                disabled={disabled}
                onPress={() => {
                  void controller.message('Show me cheaper ones');
                }}
              />
              <Button
                title="Refresh results"
                secondary
                disabled={busy || !ready || expired}
                onPress={() => {
                  void controller.refresh();
                }}
              />
            </View>
          )}
          <Button
            title="Start a new session"
            secondary
            disabled={busy || !ready}
            onPress={() =>
              Alert.alert(
                'Start a new session?',
                'This replaces the session on this phone. Existing decisions will not be carried into the new session.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Start new',
                    onPress: () => {
                      setDraft('');
                      void controller.newSession();
                    },
                  },
                ],
              )
            }
          />
        </ScrollView>
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderColor: '#d8dfd5',
            gap: 8,
            backgroundColor: '#f7f5ef',
          }}
        >
          <TextInput
            accessibilityLabel="Shopping message"
            placeholder="Describe your goal or refine your search…"
            placeholderTextColor="#657268"
            multiline
            maxLength={2000}
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            editable={!disabled}
          />
          <Button
            title={busy ? 'Working…' : 'Send to concierge'}
            onPress={() => {
              void send();
            }}
            disabled={disabled || !draft.trim()}
          />
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={!!rejecting}
        transparent
        animationType="slide"
        onRequestClose={() => setRejecting(null)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.modal}>
          <Panel style={{ maxHeight: '85%' }}>
            <Text style={styles.heading}>Why isn’t this a fit?</Text>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Text style={styles.text}>
              {rejecting ? `${productName(rejecting.name)} · ${rejecting.id}` : ''}
            </Text>
            <TextInput
              accessibilityLabel="Explain rejection"
              placeholder="I don't like this one because…"
              value={rejectionText}
              onChangeText={setRejectionText}
              maxLength={1000}
              style={styles.input}
              multiline
              placeholderTextColor="#657268"
            />
            <Button
              title="Send rejection explanation"
              disabled={disabled || !rejectionText.trim()}
              onPress={() => {
                if (!rejecting) return;
                void controller.message(rejectionText, { productId: rejecting.id }).then(() => {
                  if (!controller.getSnapshot().error) {
                    setRejectionText('');
                    setRejecting(null);
                  }
                });
              }}
            />
            <Text style={styles.muted}>Or choose a reason below:</Text>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {feedbackReasonSchema.options.map((value) => (
                <Button
                  key={value}
                  title={`${reason === value ? '✓ ' : ''}${titleCase(value)}`}
                  secondary={reason !== value}
                  onPress={() => setReason(value)}
                />
              ))}
            </ScrollView>
            <Button
              title="Reject product"
              onPress={() => {
                if (rejecting)
                  void controller.action(
                    {
                      type: 'feedback',
                      feedback: {
                        action: 'reject',
                        productId: rejecting.id,
                        ...(reason ? { reasonCode: reason } : {}),
                      },
                    },
                    `Reject ${rejecting.name}${reason ? `: ${titleCase(reason)}` : ''}`,
                  );
                setRejecting(null);
              }}
              disabled={disabled}
            />
            <Text style={styles.muted}>Choosing a reason is optional.</Text>
            <Button title="Cancel" secondary onPress={() => setRejecting(null)} />
          </Panel>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={!!confirming}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirming(null)}
      >
        <View style={styles.modal}>
          <Panel>
            <Text style={styles.heading}>Confirm this search adjustment?</Text>
            {offer ? (
              <>
                <Text style={styles.text}>{offer.updates.map(constraintLabel).join('\n')}</Text>
                <Text style={styles.muted}>
                  Only these proposed changes will be applied. Other constraints stay as recorded.
                  We’ll search again and show product cards and images for exact matches.
                </Text>
                <Button
                  title="Confirm changes"
                  disabled={disabled}
                  onPress={() => {
                    void controller.confirm(offer.proposalId);
                    setConfirming(null);
                  }}
                />
              </>
            ) : (
              <Text style={styles.error}>
                This proposal is no longer current. Refresh results to review a new one.
              </Text>
            )}
            <Button title="Cancel" secondary onPress={() => setConfirming(null)} />
          </Panel>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
