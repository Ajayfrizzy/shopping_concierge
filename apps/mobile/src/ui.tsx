import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
export function Button({
  title,
  onPress,
  disabled,
  secondary,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, secondary && styles.secondary, disabled && { opacity: 0.45 }]}
    >
      <Text style={[styles.buttonText, secondary && { color: '#244d3a' }]}>{title}</Text>
    </Pressable>
  );
}
export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f5ef' },
  content: { padding: 18, gap: 14 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: '#d8dfd5',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  title: { fontSize: 25, fontWeight: '700', color: '#213c32' },
  heading: { fontSize: 19, fontWeight: '600', color: '#213c32' },
  text: { fontSize: 16, lineHeight: 23, color: '#37493f' },
  muted: { fontSize: 13, lineHeight: 19, color: '#526357' },
  panel: { padding: 16, borderRadius: 16, backgroundColor: '#e9eee5', gap: 9 },
  button: {
    backgroundColor: '#244d3a',
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondary: { backgroundColor: '#fff', borderColor: '#9ba998', borderWidth: 1 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#8b988b',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 64,
    maxHeight: 120,
    fontSize: 16,
    color: '#213c32',
    textAlignVertical: 'top',
  },
  error: { color: '#9c2525', fontSize: 15, lineHeight: 21 },
  modal: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
});
