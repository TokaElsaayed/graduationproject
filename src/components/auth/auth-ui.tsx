import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Palette } from '@/constants/theme';

export const authStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Palette.background,
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#FFF9F6',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: '#E9D9D4',
  },
  brand: {
    color: Palette.primary,
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '700',
  },
  title: {
    color: Palette.text,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  subtitle: {
    color: '#68605E',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 7,
    marginBottom: 24,
  },
  fieldLabel: {
    color: Palette.text,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 7,
  },
  field: {
    color: Palette.text,
    backgroundColor: '#FFFFFF',
    borderColor: '#DED0CC',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: Palette.primary, fontSize: 15, fontWeight: '600' },
  error: {
    color: '#A02737',
    backgroundColor: '#FCE8E8',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    lineHeight: 20,
  },
  demo: {
    backgroundColor: '#F3E8E4',
    borderRadius: 14,
    padding: 14,
    marginTop: 2,
    marginBottom: 12,
  },
  demoTitle: { color: Palette.primary, fontWeight: '700', marginBottom: 4 },
  demoText: { color: Palette.text, fontSize: 13, lineHeight: 19 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DED0CC',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 12,
  },
  roleButtonSelected: { borderColor: Palette.primary, backgroundColor: '#F3E8E4' },
  roleText: { color: Palette.text, fontSize: 13, fontWeight: '600' },
});

export function AuthField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View>
      <Text style={authStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor="#938986"
        style={authStyles.field}
        {...props}
      />
    </View>
  );
}

export function AuthSubmit({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [authStyles.primaryButton, pressed && { opacity: 0.86 }]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={authStyles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}
