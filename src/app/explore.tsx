import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';

const demoCheckIns = [
  { time: '9:00 AM', person: 'Mariam Hassan', note: 'Morning check-in', status: 'Completed' },
  { time: '1:00 PM', person: 'Mahmoud Hassan', note: 'Lunch and water reminder', status: 'Coming up' },
  { time: '6:30 PM', person: 'Omar Hassan', note: 'Evening family call', status: 'Planned' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { isReady, user, logOut } = useAuth();

  if (!isReady) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>Care Circle</Text>
        <Text style={styles.title}>Today’s care plan</Text>
        <Text style={styles.subtitle}>Sample information for exploring the app.</Text>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')}>
            <Text style={styles.action}>Voice assistant</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}>
            <Text style={styles.action}>Personal profile</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await logOut();
              router.replace('/login');
            }}
          >
            <Text style={styles.action}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Demo data · These reminders are examples, not saved appointments.</Text>
      </View>
      {demoCheckIns.map((item) => (
        <View key={`${item.time}-${item.person}`} style={styles.card}>
          <Text style={styles.time}>{item.time}</Text>
          <View style={styles.details}>
            <Text style={styles.person}>{item.person}</Text>
            <Text style={styles.note}>{item.note}</Text>
          </View>
          <Text style={styles.status}>{item.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: Palette.background,
    padding: 24,
    paddingTop: 64,
    gap: 14,
  },
  header: { maxWidth: 720, width: '100%', alignSelf: 'center', marginBottom: 8 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 30, fontWeight: '700', marginTop: 14 },
  subtitle: { color: '#68605E', fontSize: 15, marginTop: 7 },
  headerActions: { flexDirection: 'row', gap: 18, marginTop: 18 },
  action: { color: Palette.primary, fontWeight: '700' },
  notice: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#F3E8E4',
    borderRadius: 14,
    padding: 14,
  },
  noticeText: { color: Palette.primary, fontSize: 13, lineHeight: 19 },
  card: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF9F6',
    borderWidth: 1,
    borderColor: '#E9D9D4',
    borderRadius: 18,
    padding: 16,
  },
  time: { color: Palette.primary, fontWeight: '700', minWidth: 68 },
  details: { flex: 1 },
  person: { color: Palette.text, fontWeight: '700', fontSize: 15 },
  note: { color: '#68605E', marginTop: 4, fontSize: 14 },
  status: { color: Palette.primary, fontSize: 12, fontWeight: '600' },
});
