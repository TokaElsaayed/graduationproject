import { useState } from 'react';
import { Link, Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthField, AuthSubmit, authStyles } from '@/components/auth/auth-ui';

export default function LoginScreen() {
  const router = useRouter();
  const { isReady, user, logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isReady) return null;
  if (user) return <Redirect href="/" />;

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await logIn(email, password);
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function useDemoAccount() {
    setError('');
    setLoading(true);
    try {
      await logIn('demo@carecircle.test', 'CareCircle123!');
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function useOlderAdultDemoAccount() {
    setError('');
    setLoading(true);
    try {
      await logIn('olderadult@carecircle.test', 'CareCircle123!');
      router.replace('/profile');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in. Try again.');
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
        <Text style={authStyles.title}>Welcome back</Text>
        <Text style={authStyles.subtitle}>Sign in to continue to your voice assistant.</Text>

        {error ? <Text accessibilityRole="alert" style={authStyles.error}>{error}</Text> : null}

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
          textContentType="password"
          placeholder="At least 8 characters"
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <View style={authStyles.demo}>
          <Text style={authStyles.demoTitle}>Demo account</Text>
          <Text style={authStyles.demoText}>demo@carecircle.test</Text>
          <Text style={authStyles.demoText}>Password: CareCircle123!</Text>
          <Pressable onPress={useDemoAccount} disabled={loading} style={authStyles.linkButton}>
            <Text style={authStyles.linkText}>Continue with demo account</Text>
          </Pressable>
          <Pressable onPress={useOlderAdultDemoAccount} disabled={loading} style={authStyles.linkButton}>
            <Text style={authStyles.linkText}>Continue with older adult demo</Text>
          </Pressable>
        </View>

        <AuthSubmit label="Sign in" loading={loading} onPress={submit} />
        <Link href="/signup" asChild>
          <Pressable style={authStyles.linkButton}>
            <Text style={authStyles.linkText}>Create a new account</Text>
          </Pressable>
        </Link>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
