import { useCallback, useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { reminderRequest, cairoTime, type DoseLog } from '@/reminders/reminders-api';

export default function DoseHistoryScreen() {
  const router = useRouter();
  const { isReady, user, token } = useAuth();
  const [history, setHistory] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    setHistory(await reminderRequest<DoseLog[]>(token, '/reminders/log'));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not load dose history.');
      setLoading(false);
    });
  }, [refresh]);

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.content}>
      <Text style={styles.brand}>Care Circle</Text>
      <Text style={styles.title}>Medicine History</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')} style={styles.backButton}><Text style={styles.link}>Back to medicines</Text></Pressable>
      {loading ? <ActivityIndicator size="large" color={Palette.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && history.length === 0 ? <Text style={styles.empty}>There are no doses in the history yet.</Text> : null}
      {history.map((dose) => {
        const status = dose.status === 'taken' ? 'Taken' : dose.status === 'missed' ? 'Missed' : 'Awaiting confirmation';
        return <View key={dose.id} style={styles.card}>
          <Text style={styles.medicine}>{dose.medicationName} · {dose.dose}</Text>
          <Text style={styles.detail}>Scheduled: {new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', dateStyle: 'medium' }).format(new Date(dose.scheduledAt))} at {cairoTime(dose.scheduledAt)}</Text>
          <Text style={[styles.status, dose.status === 'missed' ? styles.missed : dose.status === 'taken' ? styles.taken : null]}>{status}</Text>
          {dose.confirmedAt ? <Text style={styles.detail}>Confirmed at: {new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }).format(new Date(dose.confirmedAt))}</Text> : null}
        </View>;
      })}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: Palette.background, padding: 20, paddingTop: 52 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 15 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.primary, fontSize: 34, fontWeight: '900' },
  backButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  error: { color: Palette.primary, fontSize: 16, padding: 12, backgroundColor: Palette.background, borderRadius: 12 },
  empty: { color: Palette.text, fontSize: 20, textAlign: 'center', padding: 20, backgroundColor: Palette.white, borderRadius: 16 },
  card: { backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.muted, borderRadius: 17, padding: 18, gap: 9 },
  medicine: { color: Palette.text, fontSize: 20, fontWeight: '800' },
  detail: { color: Palette.text, fontSize: 16 },
  status: { color: Palette.primary, fontSize: 17, fontWeight: '800' },
  missed: { color: Palette.primary },
  taken: { color: Palette.success },
});
