import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';

const demoCheckIns = [
  { time: '9:00 AM', title: 'Daily health check', note: 'Questions about how you feel', status: 'Ready' },
  { time: '1:00 PM', title: 'Lunch and water', note: 'Have lunch and a drink of water', status: 'Coming up' },
  { time: '6:30 PM', title: 'Family call', note: 'Time to talk with family', status: 'Planned' },
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
        <Text style={styles.title}>{user.role === 'older_adult' ? 'My day' : 'Today’s care plan'}</Text>
        <Text style={styles.subtitle}>
          {user.role === 'older_adult'
            ? `A simple example of your day, ${user.fullName.split(' ')[0]}.`
            : 'Example activities for the older adult’s care plan.'}
        </Text>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.actionButton}>
            <Text style={styles.action}>Home</Text>
          </Pressable>
          {user.role === 'older_adult' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/health-check')} style={styles.actionButton}>
              <Text style={styles.action}>Start Health Check</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={styles.actionButton}>
            <Text style={styles.action}>Personal profile</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.actionButton}
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
        <Text style={styles.noticeText}>Sample schedule. These are not saved reminders.</Text>
      </View>
      {demoCheckIns.map((item) => (
        <Pressable
          key={`${item.time}-${item.title}`}
          accessibilityRole={item.time === '9:00 AM' ? 'button' : undefined}
          accessibilityLabel={item.time === '9:00 AM' ? `${item.title}, ${item.status}` : undefined}
          accessibilityHint={item.time === '9:00 AM'
            ? user.role === 'older_adult' ? 'Opens your morning health check' : 'Opens the family dashboard'
            : undefined}
          onPress={item.time === '9:00 AM'
            ? () => router.push(user.role === 'older_adult' ? '/health-check' : '/family')
            : undefined}
          style={({ pressed }) => [styles.card, pressed && item.time === '9:00 AM' && styles.cardPressed]}
        >
          <Text style={styles.time}>{item.time}</Text>
          <View style={styles.details}>
            <Text style={styles.person}>{user.role === 'older_adult' ? item.title : item.title.replace('Your ', 'Family member’s ')}</Text>
            <Text style={styles.note}>{item.note}</Text>
          </View>
          <Text style={styles.status}>{item.time === '9:00 AM'
            ? user.role === 'older_adult' ? 'Start' : 'Open'
            : item.status}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: Palette.background,
    padding: 24,
    paddingTop: 32,
    gap: 14,
  },
  header: { maxWidth: 720, width: '100%', alignSelf: 'center', marginBottom: 8 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 30, fontWeight: '700', marginTop: 10 },
  subtitle: { color: Palette.textSecondary, fontSize: 15, marginTop: 7 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  action: { color: Palette.primary, fontWeight: '700', fontSize: 16 },
  notice: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: Palette.background,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: { color: Palette.primary, fontSize: 15, lineHeight: 21 },
  card: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.background,
    borderRadius: 18,
    padding: 18,
    minHeight: 88,
  },
  cardPressed: { backgroundColor: Palette.background, borderColor: Palette.primary },
  time: { color: Palette.primary, fontWeight: '700', minWidth: 68 },
  details: { flex: 1 },
  person: { color: Palette.text, fontWeight: '700', fontSize: 17 },
  note: { color: Palette.textSecondary, marginTop: 4, fontSize: 15, lineHeight: 21 },
  status: { color: Palette.primary, fontSize: 15, fontWeight: '700' },
});
