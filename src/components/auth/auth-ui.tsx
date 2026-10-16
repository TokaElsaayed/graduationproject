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
    backgroundColor: Palette.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Palette.background,
  },
  brand: {
    color: Palette.primary,
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
  },
  title: {
    color: Palette.text,
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: Palette.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 7,
    marginBottom: 18,
  },
  sectionLabel: {
    color: Palette.primary,
    fontWeight: '700',
    fontSize: 15,
    marginTop: 5,
    marginBottom: 12,
  },
  fieldLabel: {
    color: Palette.text,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 7,
  },
  field: {
    color: Palette.text,
    backgroundColor: Palette.white,
    borderColor: Palette.muted,
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
  primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '700' },
  linkButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { color: Palette.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  error: {
    color: Palette.primary,
    backgroundColor: Palette.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    lineHeight: 20,
  },
  demo: {
    backgroundColor: Palette.background,
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
    borderColor: Palette.muted,
    backgroundColor: Palette.white,
    borderRadius: 13,
    padding: 12,
  },
  roleButtonSelected: { borderColor: Palette.primary, backgroundColor: Palette.background },
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
        placeholderTextColor={Palette.textSecondary}
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
        <ActivityIndicator color={Palette.white} />
      ) : (
        <Text style={authStyles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}
