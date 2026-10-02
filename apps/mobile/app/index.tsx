import { useState } from 'react';
import { foundationResponseSchema } from '@youcam/shared';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
export default function Home() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true); setError(''); setReply('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${apiUrl}/v1/foundation/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message.trim() }), signal: controller.signal });
      if (!response.ok) throw new Error('request_failed');
      const body = foundationResponseSchema.parse(await response.json());
      setReply(body.message);
    } catch { setError('Unable to reach the concierge. Check your connection and try again.'); }
    finally { clearTimeout(timer); setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>SHOPPING CONCIERGE</Text>
        <Text style={styles.title}>Find your next{ '\n' }finishing touch.</Text>
        <Text style={styles.intro}>Tell me what you’re shopping for, the occasion, and what matters to you.</Text>
        <View style={styles.note}><Text style={styles.noteTitle}>Development preview</Text><Text style={styles.body}>Chat connectivity is ready to test. Product search, shopping memory, and virtual try-on are coming next.</Text></View>
        <Text style={styles.label}>What do you have in mind?</Text>
        <TextInput accessibilityLabel="Shopping goal" style={styles.input} multiline maxLength={2000} value={message} onChangeText={setMessage} placeholder="Silver earrings for a wedding, under $120…" placeholderTextColor="#72766f" editable={!busy} />
        <Pressable accessibilityRole="button" disabled={busy || !message.trim()} onPress={() => void send()} style={[styles.button, (busy || !message.trim()) && styles.disabled]}>{busy ? <ActivityIndicator color="#ffffff" accessibilityLabel="Sending" /> : <Text style={styles.buttonText}>Send to concierge</Text>}</Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {reply ? <View style={styles.note} accessibilityLiveRegion="polite"><Text style={styles.body}>{reply}</Text></View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f5ef' }, page: { flex: 1 }, content: { padding: 24, gap: 20, flexGrow: 1, maxWidth: 620, width: '100%', alignSelf: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: '#355247', marginTop: 32 },
  title: { fontSize: 38, fontWeight: '600', letterSpacing: -1.2, color: '#213c32', lineHeight: 44 }, intro: { fontSize: 18, lineHeight: 27, color: '#525d55' },
  note: { padding: 18, backgroundColor: '#e9eee5', borderRadius: 16, gap: 8 }, noteTitle: { color: '#213c32', fontSize: 16, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 23, color: '#37493f' }, label: { fontSize: 16, fontWeight: '600', color: '#213c32' },
  input: { minHeight: 112, borderWidth: 1, borderColor: '#8b988b', borderRadius: 14, backgroundColor: '#fff', padding: 16, fontSize: 17, color: '#213c32', textAlignVertical: 'top' },
  button: { backgroundColor: '#244d3a', minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', padding: 14 }, disabled: { opacity: 0.5 }, buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' }, error: { color: '#9c2525', fontSize: 16, lineHeight: 24 },
});
