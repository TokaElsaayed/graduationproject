import { useState } from 'react';
import { Link, Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import type { AccountRole } from '@/auth/auth-context';
import { AuthField, AuthSubmit, authStyles } from '@/components/auth/auth-ui';

export default function SignupScreen() {
  const router = useRouter();
  const { isReady, user, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('caregiver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isReady) return null;
  if (user) return <Redirect href="/" />;

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await signUp({ fullName, email, password, role });
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={authStyles.page}
    >
      <ScrollView contentContainerStyle={authStyles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <Text style={authStyles.brand}>Care Circle</Text>
        <Text style={authStyles.title}>Create your account</Text>
        <Text style={authStyles.subtitle}>A little support, whenever you need it.</Text>

        {error ? <Text accessibilityRole="alert" style={authStyles.error}>{error}</Text> : null}

        <AuthField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="Your name"
        />
        <AuthField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <AuthField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="At least 8 characters"
        />

        <Text style={authStyles.fieldLabel}>I am joining as</Text>
        <View style={authStyles.roleRow}>
          {([
            ['caregiver', 'Caregiver'],
            ['older_adult', 'Older adult'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: role === value }}
              onPress={() => setRole(value)}
              style={[authStyles.roleButton, role === value && authStyles.roleButtonSelected]}
            >
              <Text style={authStyles.roleText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <AuthSubmit label="Create account" loading={loading} onPress={submit} />
        <Link href="/login" asChild>
          <Pressable style={authStyles.linkButton}>
            <Text style={authStyles.linkText}>Already have an account? Sign in</Text>
          </Pressable>
        </Link>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
