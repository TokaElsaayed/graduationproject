import { useCallback, useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { reminderRequest, type FamilyAlert } from '@/reminders/reminders-api';

export default function FamilyAlertsScreen() {
  const router = useRouter();
  const { isReady, user, token } = useAuth();
  const [alerts, setAlerts] = useState<FamilyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    setAlerts(await reminderRequest<FamilyAlert[]>(token, '/family-alerts'));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { await refresh(); }
      catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Could not load alerts.');
          setLoading(false);
        }
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => { active = false; clearInterval(interval); };
  }, [refresh]);

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.content}>
      <Text style={styles.brand}>Care Circle</Text>
      <Text style={styles.title}>Family Alerts</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')}><Text style={styles.link}>Back to medicines</Text></Pressable>
      <Text style={styles.notice}>These demo alerts are stored in the server’s memory.</Text>
      {loading ? <ActivityIndicator size="large" color={Palette.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && alerts.length === 0 ? <Text style={styles.empty}>There are no missed doses.</Text> : null}
      {alerts.map((alert) => <View key={alert.id} style={styles.card}>
        <Text style={styles.message}>{alert.message}</Text>
        <Text style={styles.time}>{new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(alert.time))}</Text>
        <Text style={styles.membersTitle}>Alert recipients:</Text>
        {alert.familyMembers.length ? alert.familyMembers.map((member) => <Text key={member.id} style={styles.member}>{member.name} · {translateRelationship(member.relationship)} · {member.phone}</Text>) : <Text style={styles.member}>No family members are allowed to view alerts.</Text>}
      </View>)}
    </View>
  </ScrollView>;
}

function translateRelationship(relationship: string): string {
  const translations: Record<string, string> = {
    'بنتي': 'Daughter', 'ابني': 'Son', 'زوجتي': 'Wife', 'زوجي': 'Husband',
    'أختي': 'Sister', 'أخويا': 'Brother', 'أمي': 'Mother', 'أبويا': 'Father',
  };
  return translations[relationship] ?? relationship;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: Palette.background, padding: 20, paddingTop: 52 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 15 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.primary, fontSize: 34, fontWeight: '900' },
  link: { color: Palette.primary, fontSize: 17, fontWeight: '800', textDecorationLine: 'underline' },
  notice: { color: Palette.text, fontSize: 16 },
  error: { color: '#8D1724', fontSize: 16, padding: 12, backgroundColor: '#FDE8E8', borderRadius: 12 },
  empty: { color: Palette.text, fontSize: 20, textAlign: 'center', padding: 20, backgroundColor: '#FFF9F6', borderRadius: 16 },
  card: { backgroundColor: '#FFF9F6', borderWidth: 1, borderColor: '#D2BEB9', borderRadius: 17, padding: 18, gap: 10 },
  message: { color: '#8D1724', fontSize: 21, lineHeight: 32, fontWeight: '800' },
  time: { color: '#514946', fontSize: 15 },
  membersTitle: { color: Palette.text, fontSize: 17, fontWeight: '800' },
  member: { color: Palette.text, fontSize: 16, lineHeight: 25 },
});
