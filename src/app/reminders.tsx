import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { reminderRequest, cairoTime, type ReminderDose } from '@/reminders/reminders-api';
import { requestReminderPermission, showDoseNotification, syncUpcomingNotifications } from '@/reminders/reminder-notifications';

export default function RemindersScreen() {
  const router = useRouter();
  const { isReady, user, token } = useAuth();
  const [doses, setDoses] = useState<ReminderDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [error, setError] = useState('');
  const [spokenReply, setSpokenReply] = useState('');
  const [activeDoseId, setActiveDoseId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const announcedCounts = useRef(new Map<string, number>());
  const dismissedDoses = useRef(new Set<string>());
  const scheduleSignature = useRef('');

  const refresh = useCallback(async () => {
    if (!token) return;
    const result = await reminderRequest<ReminderDose[]>(token, '/reminders/today');
    setDoses(result);
    const upcomingSignature = result
      .filter((dose) => dose.displayStatus === 'upcoming')
      .map((dose) => `${dose.id}:${dose.scheduledAt}`)
      .sort()
      .join('|');
    if (notificationsEnabled && scheduleSignature.current !== upcomingSignature) {
      scheduleSignature.current = upcomingSignature;
      await syncUpcomingNotifications(result);
    }

    const dueDoses = result.filter((dose) => dose.status === 'pending' && dose.displayStatus === 'due');
    for (const dose of result) {
      if (dose.status !== 'pending' || dose.displayStatus !== 'due') continue;
      const previousCount = announcedCounts.current.get(dose.id) ?? 0;
      if (dose.reminderCount <= previousCount) continue;
      announcedCounts.current.set(dose.id, dose.reminderCount);
      dismissedDoses.current.delete(dose.id);
      setSpokenReply('');
      Speech.stop();
      Speech.speak(dose.reminderText, { language: 'ar', rate: 0.88, pitch: 1 });
      void showDoseNotification(dose).catch(() => undefined);
    }
    setActiveDoseId((current) => {
      if (current && dueDoses.some((dose) => dose.id === current) && !dismissedDoses.current.has(current)) return current;
      return dueDoses.find((dose) => !dismissedDoses.current.has(dose.id))?.id ?? null;
    });
    setLoading(false);
    setError('');
  }, [token, notificationsEnabled]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void requestReminderPermission().then((granted) => {
      if (active) setNotificationsEnabled(granted);
    }).catch(() => undefined);
    const poll = async () => {
      try {
        await refresh();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Could not load medicine schedules.');
          setLoading(false);
        }
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      clearInterval(interval);
      Speech.stop();
    };
  }, [token, refresh]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => () => {
    if (recordingRef.current) void recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
    Speech.stop();
  }, []);

  const activeDose = useMemo(
    () => doses.find((dose) => dose.id === activeDoseId && dose.status === 'pending' && dose.displayStatus === 'due') ?? null,
    [doses, activeDoseId],
  );

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;
  const authToken = token;

  async function enableNotifications() {
    try {
      const granted = await requestReminderPermission();
      setNotificationsEnabled(granted);
      if (!granted) setError('Enable notifications in your device settings to receive reminders.');
      else setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not enable notifications.');
    }
  }

  async function triggerDemo() {
    setBusy(true);
    setError('');
    try {
      const dose = await reminderRequest<ReminderDose>(authToken, '/reminders/demo-trigger', 'POST', {});
      setDoses((items) => [dose, ...items.filter((item) => item.id !== dose.id)]);
      dismissedDoses.current.delete(dose.id);
      setActiveDoseId(dose.id);
      announcedCounts.current.set(dose.id, dose.reminderCount);
      Speech.stop();
      Speech.speak(dose.reminderText, { language: 'ar', rate: 0.88, pitch: 1 });
      await showDoseNotification(dose);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the demo reminder.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmWithTranscript(transcript: string) {
    if (!activeDose) return;
    setBusy(true);
    setError('');
    try {
      const result = await reminderRequest<{ status: string; response: string }>(
        authToken,
        `/reminders/${activeDose.id}/confirm`,
        'POST',
        { transcript },
      );
      setSpokenReply(confirmationTextInEnglish(result.response));
      Speech.stop();
      Speech.speak(result.response, { language: 'ar', rate: 0.88, pitch: 1 });
      if (result.status === 'taken') setActiveDoseId(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the confirmation.');
    } finally {
      setBusy(false);
    }
  }

  async function startVoiceConfirmation() {
    if (recording) {
      setBusy(true);
      try {
        await recording.stopAndUnloadAsync();
        setRecording(null);
        const uri = recording.getURI();
        if (!uri) throw new Error('The recording is empty. Please try again.');
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const audioResponse = await fetch(uri);
          const blob = await audioResponse.blob();
          if (!blob.size) throw new Error('The recording is empty. Please try again.');
          const type = blob.type || 'audio/webm';
          formData.append('audio', new Blob([blob], { type }), `medicine-confirmation.${type.includes('mp4') ? 'm4a' : 'webm'}`);
        } else {
          formData.append('audio', { uri, type: 'audio/m4a', name: 'medicine-confirmation.m4a' } as any);
        }
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.100.40:3000'}/voice/process`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const body = await response.json().catch(() => ({})) as { transcript?: string; message?: string | string[] };
        if (!response.ok || !body.transcript) {
          const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
          throw new Error(message || 'Could not understand the recording. Please try again.');
        }
        await confirmWithTranscript(body.transcript);
      } catch (reason) {
        setRecording(null);
        setError(reason instanceof Error ? reason.message : 'Could not record your voice.');
        setBusy(false);
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Allow microphone access to confirm by voice.');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(result.recording);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start recording.');
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.content}>
          <Text style={styles.brand}>Care Circle</Text>
          <Text style={styles.title} accessibilityRole="header">Today’s Medicines</Text>
          <Text style={styles.subtitle}>Medicine schedules and confirmations</Text>
          <View style={styles.navigation}>
          <NavButton label="Family Alerts" onPress={() => router.push('/family-alerts' as Href)} />
          <NavButton label="Dose History" onPress={() => router.push('/dose-history' as Href)} />
            <NavButton label="Profile" onPress={() => router.push('/profile')} />
          </View>
          <View style={styles.actions}>
            <Button label={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'} onPress={enableNotifications} />
            <Button label={busy ? 'Please wait…' : 'Try a reminder now'} onPress={triggerDemo} disabled={busy} />
          </View>
          <Text style={styles.hint}>Reminders refresh automatically every 4 seconds.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator size="large" color={Palette.primary} /> : null}
          {!loading && doses.length === 0 ? <Text style={styles.empty}>No medicines are scheduled for today.</Text> : null}
          {doses.map((dose) => <DoseCard key={dose.id} dose={dose} />)}
        </View>
      </ScrollView>

      <Modal visible={!!activeDose} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setActiveDoseId(null)}>
        {activeDose ? <View style={styles.modalPage}>
          <Text style={styles.modalEyebrow}>Medicine reminder</Text>
          <Text style={styles.modalTitle} accessibilityRole="header">{activeDose.medicationName}</Text>
          <Text style={styles.modalDose}>{activeDose.dose}</Text>
          <Text style={styles.modalTime}>Scheduled for {cairoTime(activeDose.scheduledAt)}</Text>
          <Text style={styles.modalMessage}>Time to take {activeDose.medicationName}: {activeDose.dose}.</Text>
          {spokenReply ? <Text style={styles.reply}>{spokenReply}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Saving…' : 'I took it'} onPress={() => void confirmWithTranscript('خدت الدوا')} disabled={busy} large />
          <Button label={recording ? 'Tap to submit recording' : 'Confirm by voice'} onPress={() => void startVoiceConfirmation()} disabled={busy} large secondary />
          <Pressable accessibilityRole="button" onPress={() => { dismissedDoses.current.add(activeDose.id); setActiveDoseId(null); }}><Text style={styles.dismiss}>Not now</Text></Pressable>
        </View> : null}
      </Modal>
    </View>
  );
}

function confirmationTextInEnglish(response: string): string {
  const translations: Record<string, string> = {
    'الجرعة دي اتسجلت قبل كده.': 'This dose has already been recorded.',
    'ميعاد الجرعة دي عدى.': 'The scheduled time for this dose has passed.',
    'مسمعتش كويس. ممكن تقول: خدت الدوا أو لسه ماخدتوش؟': 'I did not hear clearly. Please say whether you took the medicine.',
    'حاضر. لما تاخد الدوا قولي: خدت الدوا.': 'Okay. Tell me once you have taken the medicine.',
    'تمام، سجلت إنك خدت الدوا.': 'Okay, I recorded that you took the medicine.',
  };
  return translations[response] ?? response;
}

function DoseCard({ dose }: { dose: ReminderDose }) {
  const label = dose.displayStatus === 'upcoming' ? 'Upcoming' : dose.displayStatus === 'due' ? 'Due now' : dose.displayStatus === 'taken' ? 'Taken' : 'Missed';
  return <View style={styles.doseCard}>
    <View style={styles.doseTop}>
      <Text style={styles.doseName}>{dose.medicationName}</Text>
      <Text style={[styles.status, dose.displayStatus === 'missed' ? styles.missed : dose.displayStatus === 'taken' ? styles.taken : null]}>{label}</Text>
    </View>
    <Text style={styles.doseDetail}>{dose.dose}</Text>
    <Text style={styles.doseDetail}>Scheduled time: {cairoTime(dose.scheduledAt)}</Text>
  </View>;
}

function Button({ label, onPress, disabled, large, secondary }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  large?: boolean;
  secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, large ? styles.largeButton : null, secondary ? styles.secondaryButton : null, disabled ? styles.disabled : null]}>
    <Text style={[styles.buttonText, secondary ? styles.secondaryText : null]}>{label}</Text>
  </Pressable>;
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.navButton}><Text style={styles.navText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  page: { flexGrow: 1, padding: 18, paddingTop: 48, paddingBottom: 36 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 14 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.primary, fontSize: 34, lineHeight: 44, fontWeight: '800' },
  subtitle: { color: Palette.text, fontSize: 19 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  navButton: { borderWidth: 1, borderColor: Palette.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  navText: { color: Palette.primary, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  hint: { color: '#5B5553', fontSize: 15 },
  error: { color: '#8D1724', backgroundColor: '#FDE8E8', padding: 12, borderRadius: 12, fontSize: 16 },
  empty: { backgroundColor: '#FFF9F6', padding: 18, borderRadius: 16, fontSize: 19, color: Palette.text, textAlign: 'center' },
  doseCard: { backgroundColor: '#FFF9F6', borderColor: '#D2BEB9', borderWidth: 1, borderRadius: 17, padding: 16, gap: 8 },
  doseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  doseName: { flex: 1, color: Palette.text, fontSize: 21, fontWeight: '800' },
  status: { color: Palette.primary, fontSize: 15, fontWeight: '800' },
  missed: { color: '#9E2430' },
  taken: { color: '#176B45' },
  doseDetail: { color: '#393230', fontSize: 17 },
  button: { backgroundColor: Palette.primary, paddingHorizontal: 16, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  largeButton: { minHeight: 66, borderRadius: 18, width: '100%', marginTop: 6 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: Palette.primary },
  secondaryText: { color: Palette.primary },
  disabled: { opacity: 0.55 },
  modalPage: { flex: 1, backgroundColor: Palette.background, paddingHorizontal: 26, paddingVertical: 36, justifyContent: 'center', alignItems: 'center', gap: 14 },
  modalEyebrow: { color: Palette.primary, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  modalTitle: { color: Palette.primary, fontSize: 38, lineHeight: 48, fontWeight: '900', textAlign: 'center' },
  modalDose: { color: Palette.text, fontSize: 27, fontWeight: '800', textAlign: 'center' },
  modalTime: { color: Palette.text, fontSize: 22, textAlign: 'center' },
  modalMessage: { color: Palette.text, fontSize: 23, lineHeight: 36, textAlign: 'center', marginVertical: 4 },
  reply: { color: '#176B45', fontSize: 19, textAlign: 'center', writingDirection: 'rtl' },
  dismiss: { padding: 12, color: '#514946', fontSize: 18, fontWeight: '700' },
});
