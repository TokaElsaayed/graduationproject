import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { speakCareText, stopCareAudio } from '@/voice/speech';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { reminderRequest, cairoTime, type ReminderDose } from '@/reminders/reminders-api';
import { requestReminderPermission, showDoseNotification, syncUpcomingNotifications } from '@/reminders/reminder-notifications';

export default function RemindersScreen() {
  const router = useRouter();
  const { dailyFlow } = useLocalSearchParams<{ dailyFlow?: string }>();
  const { isReady, user, token } = useAuth();
  const { width } = useWindowDimensions();
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
  const hadDueReminder = useRef(false);
  const dailyFlowRedirected = useRef(false);

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
      void syncUpcomingNotifications(result).catch(() => undefined);
    }

    const dueDoses = result
      .filter((dose) => dose.status === 'pending' && dose.displayStatus === 'due')
      .sort((first, second) => new Date(first.scheduledAt).getTime() - new Date(second.scheduledAt).getTime());
    if (dueDoses.length) hadDueReminder.current = true;
    const nextDose = dueDoses.find((dose) => !dismissedDoses.current.has(dose.id));
    if (nextDose) {
      const previousCount = announcedCounts.current.get(nextDose.id) ?? 0;
      if (nextDose.reminderCount > previousCount) {
        announcedCounts.current.set(nextDose.id, nextDose.reminderCount);
        dismissedDoses.current.delete(nextDose.id);
        setSpokenReply('');
        void stopCareAudio();
        speakCareText(nextDose.reminderText, token);
        void showDoseNotification(nextDose).catch(() => undefined);
      }
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
      void stopCareAudio();
    };
  }, [token, refresh]);

  useEffect(() => {
    if (dailyFlow !== '1' || loading || dailyFlowRedirected.current) return;
    const hasUnresolvedDueDose = doses.some((dose) =>
      dose.status === 'pending' && dose.displayStatus === 'due' && !dismissedDoses.current.has(dose.id),
    );
    if (hasUnresolvedDueDose || activeDoseId) return;
    const timeout = setTimeout(() => {
      dailyFlowRedirected.current = true;
      router.replace('/');
    }, hadDueReminder.current ? 6000 : 1000);
    return () => clearTimeout(timeout);
  }, [activeDoseId, dailyFlow, doses, loading, router]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => () => {
    if (recordingRef.current) void recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
    void stopCareAudio();
  }, []);

  const activeDose = useMemo(
    () => doses.find((dose) => dose.id === activeDoseId && dose.status === 'pending' && dose.displayStatus === 'due') ?? null,
    [doses, activeDoseId],
  );
  const takenCount = doses.filter((dose) => dose.status === 'taken').length;
  const remainingCount = doses.filter((dose) => dose.status === 'pending').length;
  const totalMedicines = new Set(doses.map((dose) => dose.medicationId)).size;
  const adherence = doses.length ? Math.round((takenCount / doses.length) * 100) : 0;
  const doseGroups = useMemo(() => {
    const groups: { title: string; icon: string; doses: ReminderDose[] }[] = [
      { title: 'Morning', icon: '☀', doses: [] },
      { title: 'Afternoon', icon: '◒', doses: [] },
      { title: 'Evening', icon: '☾', doses: [] },
    ];
    for (const dose of doses) {
      const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(dose.scheduledAt)));
      groups[hour < 12 ? 0 : hour < 17 ? 1 : 2].doses.push(dose);
    }
    return groups;
  }, [doses]);

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
      void stopCareAudio();
      speakCareText(dose.reminderText, authToken);
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
      void stopCareAudio();
      speakCareText(result.response, authToken);
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

  const firstName = user.fullName.split(/\s+/)[0] || 'Mahmoud';
  const wide = width >= 760;
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, wide && styles.contentWide]}>
          <View style={styles.header}>
            <View style={styles.headerBrand}>
              <View style={styles.logo}><Text style={styles.logoText}>C</Text></View>
              <Text style={styles.brand}>Care Circle</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Open family alerts" onPress={() => router.push('/family-alerts' as Href)} style={styles.headerIconButton}>
                <Text style={styles.headerIcon}>♧</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open dose history" onPress={() => router.push('/dose-history' as Href)} style={styles.historyHeaderButton}>
                <Text style={styles.historyHeaderText}>History</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.pageTitleRow}>
            <View><Text style={styles.title} accessibilityRole="header">Today’s medicines</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={styles.profileButton}>
              <Text style={styles.profileInitial}>{firstName.slice(0, 1).toUpperCase()}</Text>
            </Pressable>
          </View>

          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Today’s summary</Text></View>
          <View style={styles.statsRow}>
            <StatCard icon="✚" label="Medicines" value={String(totalMedicines)} tone="plum" />
            <StatCard icon="✓" label="Taken" value={String(takenCount)} tone="green" />
            <StatCard icon="◷" label="Remaining" value={String(remainingCount)} tone="amber" />
            <StatCard icon="%" label="Completed" value={`${adherence}%`} tone="green" />
          </View>

          <View style={styles.reminderCard}>
            <View style={styles.reminderHeading}>
              <View style={styles.reminderHeadingCopy}><Text style={styles.reminderCardTitle}>Reminder settings</Text></View>
              <View style={[styles.reminderStatusPill, notificationsEnabled && styles.enabledPill]}><View style={[styles.statusDot, notificationsEnabled && styles.statusDotGreen]} /><Text style={styles.reminderStatusText}>{notificationsEnabled ? 'Active' : 'Set up'}</Text></View>
            </View>
            <View style={styles.reminderFeatures}>
              <View style={styles.reminderFeature}><View style={styles.featureCopy}><Text style={styles.featureTitle}>Voice reminders</Text><Text style={styles.featureSubtitle}>Spoken when a dose is due</Text></View><Text style={styles.featureEnabled}>On</Text></View>
              <View style={styles.reminderFeature}><View style={styles.featureCopy}><Text style={styles.featureTitle}>Family alerts</Text><Text style={styles.featureSubtitle}>Alerts for missed doses</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/family-alerts' as Href)}><Text style={styles.featureLink}>View alerts</Text></Pressable></View>
            </View>
            <View style={styles.reminderActions}>
              <Button label={notificationsEnabled ? 'Notifications on' : 'Enable notifications'} onPress={enableNotifications} secondary />
              <Button label={busy ? 'Please wait…' : 'Test a reminder'} onPress={triggerDemo} disabled={busy} />
            </View>
          </View>

          <View style={styles.timelineHeading}><Text style={styles.sectionTitle}>Today’s doses</Text></View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {loading ? <View style={styles.loadingCard}><ActivityIndicator size="large" color={Palette.primary} /><Text style={styles.loadingText}>Loading today’s medicines…</Text></View> : null}
          {!loading && doses.length === 0 ? <Text style={styles.empty}>No medicines are scheduled for today.</Text> : null}
          {doseGroups.map((group) => group.doses.length ? <View key={group.title} style={styles.timeGroup}>
            <View style={styles.timeGroupHeading}><View style={styles.timeGroupIcon}><Text style={styles.timeGroupIconText}>{group.icon}</Text></View><Text style={styles.timeGroupTitle}>{group.title}</Text><View style={styles.timeGroupRule} /><Text style={styles.groupCount}>{group.doses.length} {group.doses.length === 1 ? 'dose' : 'doses'}</Text></View>
            {group.doses.map((dose) => <DoseCard key={dose.id} dose={dose} />)}
          </View> : null)}
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        <BottomTab label="Home" icon="⌂" active={false} onPress={() => router.replace('/')} />
        <BottomTab label="Medicines" icon="✚" active onPress={() => router.replace('/reminders')} />
        <BottomTab label="Assistant" icon="🎙" active={false} onPress={() => router.push('/')} />
        <BottomTab label="Profile" icon="♙" active={false} onPress={() => router.push('/profile')} />
      </View>
      <Modal visible={!!activeDose} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => { if (dailyFlow !== '1') setActiveDoseId(null); }}>
        {activeDose ? <View style={styles.modalPage}>
          <Text style={styles.modalEyebrow}>Medicine reminder</Text>
          <Text style={styles.modalTitle} accessibilityRole="header">{activeDose.medicationName}</Text>
          <Text style={styles.modalDose}>{activeDose.dose}</Text>
          <Text style={styles.modalTime}>Scheduled for {cairoTime(activeDose.scheduledAt)}</Text>
          <Text style={styles.modalMessage}>Time to take {activeDose.medicationName}: {activeDose.dose}.</Text>
          {spokenReply ? <Text style={styles.reply}>{spokenReply}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Saving…' : 'Confirm medicine taken'} onPress={() => void confirmWithTranscript('خدت الدوا')} disabled={busy} large />
          <Button label={recording ? 'Tap to submit recording' : 'Confirm by voice'} onPress={() => void startVoiceConfirmation()} disabled={busy} large secondary />
          {dailyFlow !== '1' ? <Pressable accessibilityRole="button" onPress={() => { dismissedDoses.current.add(activeDose.id); setActiveDoseId(null); }}><Text style={styles.dismiss}>Remind me later</Text></Pressable> : null}
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
  const isTaken = dose.displayStatus === 'taken';
  const isMissed = dose.displayStatus === 'missed';
  return <View style={[styles.doseCard, isTaken && styles.doseCardTaken, isMissed && styles.doseCardMissed]}>
    <View style={[styles.medicineIcon, isTaken && styles.medicineIconTaken]}><Text style={styles.medicineIconText}>✚</Text></View>
    <View style={styles.doseBody}>
      <View style={styles.doseTop}>
        <Text style={styles.doseName}>{dose.medicationName}</Text>
        <Text style={[styles.status, isMissed ? styles.missed : isTaken ? styles.taken : null]}>{label}</Text>
      </View>
      <Text style={styles.doseDetail}>{dose.dose}</Text>
      <View style={styles.doseTimeRow}><Text style={styles.clockIcon}>◷</Text><Text style={styles.doseTimeText}>{cairoTime(dose.scheduledAt)}</Text><Text style={styles.doseTimeCaption}>Scheduled time</Text></View>
    </View>
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

function StatCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: 'plum' | 'green' | 'amber' }) {
  const iconStyle = tone === 'green' ? styles.statIconGreen : tone === 'amber' ? styles.statIconAmber : styles.statIconPlum;
  return <View style={styles.statCard}><View style={[styles.statIconWrap, iconStyle]}><Text style={[styles.statIcon, tone === 'green' ? styles.statTextGreen : tone === 'amber' ? styles.statTextAmber : styles.statTextPlum]}>{icon}</Text></View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function BottomTab({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.bottomTab, active && styles.bottomTabActive, pressed && styles.tabPressed]}>
    <Text style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>{icon}</Text><Text style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>{label}</Text>
  </Pressable>;
}

const legacyStyles = StyleSheet.create({
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
  hint: { color: Palette.text, fontSize: 15 },
  error: { color: Palette.primary, backgroundColor: Palette.background, padding: 12, borderRadius: 12, fontSize: 16 },
  empty: { backgroundColor: Palette.white, padding: 18, borderRadius: 16, fontSize: 19, color: Palette.text, textAlign: 'center' },
  doseCard: { backgroundColor: Palette.white, borderColor: Palette.muted, borderWidth: 1, borderRadius: 17, padding: 16, gap: 8 },
  doseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  doseName: { flex: 1, color: Palette.text, fontSize: 21, fontWeight: '800' },
  status: { color: Palette.primary, fontSize: 15, fontWeight: '800' },
  missed: { color: Palette.primary },
  taken: { color: Palette.success },
  doseDetail: { color: Palette.error, fontSize: 17 },
  button: { backgroundColor: Palette.primary, paddingHorizontal: 16, minHeight: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  largeButton: { minHeight: 64, borderRadius: 16, width: '100%', marginTop: 6 },
  buttonText: { color: Palette.white, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: Palette.white, borderWidth: 2, borderColor: Palette.primary },
  secondaryText: { color: Palette.primary },
  disabled: { opacity: 0.55 },
  modalPage: { flex: 1, backgroundColor: Palette.background, paddingHorizontal: 24, paddingVertical: 30, justifyContent: 'center', alignItems: 'center', gap: 14 },
  modalEyebrow: { color: Palette.primary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalTitle: { color: Palette.primary, fontSize: 32, lineHeight: 40, fontWeight: '800', textAlign: 'center' },
  modalDose: { color: Palette.text, fontSize: 27, fontWeight: '800', textAlign: 'center' },
  modalTime: { color: Palette.text, fontSize: 22, textAlign: 'center' },
  modalMessage: { color: Palette.text, fontSize: 23, lineHeight: 36, textAlign: 'center', marginVertical: 4 },
  reply: { color: Palette.success, fontSize: 19, textAlign: 'center', writingDirection: 'rtl' },
  dismiss: { padding: 12, color: Palette.text, fontSize: 18, fontWeight: '700' },
});

const styles = {
  ...legacyStyles,
  ...StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    page: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 15, paddingBottom: 130 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 19 },
    contentWide: { maxWidth: 1040, gap: 23 },
    header: { minHeight: 60, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },
    headerBrand: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 },
    logo: { width: 45, height: 45, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.primary },
    logoText: { color: Palette.white, fontWeight: '900' as const, fontSize: 23 },
    brand: { color: Palette.primary, fontSize: 19, fontWeight: '900' as const },
    headerSubtitle: { color: Palette.textSecondary, fontSize: 11, marginTop: 2 },
    headerActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
    headerIconButton: { width: 46, height: 46, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 15, borderWidth: 1, borderColor: Palette.background, backgroundColor: Palette.white },
    headerIcon: { color: Palette.primary, fontSize: 23 },
    historyHeaderButton: { minHeight: 46, justifyContent: 'center' as const, paddingHorizontal: 14, borderRadius: 15, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background },
    historyHeaderText: { color: Palette.primary, fontSize: 13, fontWeight: '800' as const },
    pageTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },
    title: { color: Palette.text, fontSize: 28, lineHeight: 36, fontWeight: '900' as const, letterSpacing: -0.4 },
    subtitle: { color: Palette.primary, fontSize: 14, lineHeight: 20, marginTop: 2 },
    profileButton: { width: 48, height: 48, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background, borderWidth: 2, borderColor: Palette.white },
    profileInitial: { color: Palette.primary, fontWeight: '900' as const, fontSize: 19 },
    heroCard: { minHeight: 235, position: 'relative' as const, overflow: 'hidden' as const, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 21, borderRadius: 25, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.background },
    heroCopy: { flex: 1, maxWidth: 580, zIndex: 1 },
    heroGreeting: { color: Palette.primary, fontSize: 22, lineHeight: 29, fontWeight: '900' as const },
    heroDescription: { color: Palette.text, fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 410 },
    adherenceRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 17, marginTop: 18 },
    adherenceCopy: { minWidth: 105 }, adherenceLabel: { color: Palette.primary, fontSize: 9, fontWeight: '900' as const, letterSpacing: 0.8 }, adherenceValue: { color: Palette.primary, fontSize: 25, lineHeight: 31, fontWeight: '900' as const, marginTop: 2 },
    adherenceDivider: { width: 1, height: 38, backgroundColor: Palette.secondarySurface },
    progressTrack: { height: 7, maxWidth: 330, backgroundColor: Palette.white76, borderRadius: 5, overflow: 'hidden' as const, marginTop: 8 },
    progressFill: { height: '100%' as const, backgroundColor: Palette.primary, borderRadius: 5 },
    heroArtwork: { width: 150, height: 155, alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: 9 },
    heroOrb: { width: 130, height: 130, borderRadius: 65, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.white77, borderWidth: 1, borderColor: Palette.white },
    heroHeart: { color: Palette.primary, fontSize: 83, lineHeight: 98 },
    heroLeafA: { position: 'absolute' as const, right: 1, top: 12, width: 43, height: 43, borderRadius: 16, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const },
    heroLeafB: { position: 'absolute' as const, left: 0, bottom: 12, width: 35, height: 35, borderRadius: 13, backgroundColor: Palette.warningSurface, alignItems: 'center' as const, justifyContent: 'center' as const },
    heroLeafText: { color: Palette.success, fontSize: 18 },
    sectionTitleRow: { marginBottom: -9 }, sectionTitle: { color: Palette.text, fontSize: 19, fontWeight: '900' as const }, sectionHint: { color: Palette.primary, fontSize: 13, marginTop: 3 },
    statsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 11 },
    statCard: { flex: 1, minWidth: 95, minHeight: 104, alignItems: 'flex-start' as const, justifyContent: 'center' as const, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 17, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background },
    statIconWrap: { width: 33, height: 33, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 6 }, statIconPlum: { backgroundColor: Palette.background }, statIconGreen: { backgroundColor: Palette.background }, statIconAmber: { backgroundColor: Palette.warningSurface },
    statIcon: { fontSize: 17, fontWeight: '900' as const }, statTextPlum: { color: Palette.primary }, statTextGreen: { color: Palette.success }, statTextAmber: { color: Palette.warning },
    statLabel: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const }, statValue: { color: Palette.text, fontSize: 23, fontWeight: '800' as const, marginTop: 3 },
    reminderCard: { padding: 16, borderRadius: 18, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background, gap: 12 },
    reminderHeading: { minHeight: 52, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 }, reminderShield: { width: 45, height: 45, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, reminderShieldText: { color: Palette.primary, fontSize: 25 }, reminderHeadingCopy: { flex: 1 }, reminderCardTitle: { color: Palette.text, fontSize: 17, fontWeight: '900' as const }, reminderCardSubtitle: { color: Palette.primary, fontSize: 12, marginTop: 3 },
    reminderStatusPill: { minHeight: 30, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, borderRadius: 15, backgroundColor: Palette.background }, enabledPill: { backgroundColor: Palette.background }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.muted }, statusDotGreen: { backgroundColor: Palette.success }, reminderStatusText: { color: Palette.textSecondary, fontSize: 11, fontWeight: '800' as const },
    reminderFeatures: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Palette.background }, reminderFeature: { minHeight: 61, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, borderBottomWidth: 1, borderBottomColor: Palette.background, paddingVertical: 9 }, featureCheck: { width: 25, height: 25, textAlign: 'center' as const, textAlignVertical: 'center' as const, overflow: 'hidden' as const, borderRadius: 9, color: Palette.success, backgroundColor: Palette.background, fontSize: 15, fontWeight: '900' as const }, featureCopy: { flex: 1 }, featureTitle: { color: Palette.text, fontSize: 15, fontWeight: '700' as const }, featureSubtitle: { color: Palette.primary, fontSize: 14, lineHeight: 19, marginTop: 2 }, featureEnabled: { color: Palette.success, fontSize: 14, fontWeight: '700' as const }, featureLink: { minWidth: 72, minHeight: 48, textAlign: 'center' as const, textAlignVertical: 'center' as const, color: Palette.primary, fontSize: 15, fontWeight: '700' as const },
    reminderActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 9 }, refreshHint: { color: Palette.textSecondary, fontSize: 11 },
    timelineHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, marginTop: 1 }, liveBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 13, backgroundColor: Palette.background }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.success }, liveText: { color: Palette.success, fontSize: 11, fontWeight: '800' as const },
    timeGroup: { gap: 10 }, timeGroupHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, marginTop: 1 }, timeGroupIcon: { width: 33, height: 33, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, timeGroupIconText: { color: Palette.primary, fontSize: 17 }, timeGroupTitle: { color: Palette.text, fontSize: 17, fontWeight: '800' as const }, timeGroupRule: { flex: 1, height: 1, backgroundColor: Palette.background }, groupCount: { color: Palette.textSecondary, fontSize: 14, fontWeight: '700' as const },
    doseCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 13, backgroundColor: Palette.white, borderColor: Palette.background, borderWidth: 1, borderRadius: 17, padding: 15 }, doseCardTaken: { borderColor: Palette.background, backgroundColor: Palette.white }, doseCardMissed: { borderColor: Palette.background },
    medicineIcon: { width: 49, height: 49, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, medicineIconTaken: { backgroundColor: Palette.background }, medicineIconText: { color: Palette.primary, fontSize: 23, fontWeight: '800' as const }, doseBody: { flex: 1, gap: 4 },
    doseTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 8 }, doseName: { flex: 1, color: Palette.text, fontSize: 18, lineHeight: 24, fontWeight: '800' as const }, status: { color: Palette.warning, fontSize: 14, fontWeight: '700' as const, backgroundColor: Palette.warningSurface, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 9 }, missed: { color: Palette.error, backgroundColor: Palette.background }, taken: { color: Palette.success, backgroundColor: Palette.background },
    doseDetail: { color: Palette.textSecondary, fontSize: 15, lineHeight: 21 }, doseTimeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 }, clockIcon: { color: Palette.primary, fontSize: 15 }, doseTimeText: { color: Palette.text, fontSize: 15, fontWeight: '700' as const }, doseTimeCaption: { color: Palette.textSecondary, fontSize: 14 },
    empty: { backgroundColor: Palette.white, padding: 20, borderRadius: 20, fontSize: 16, lineHeight: 24, color: Palette.primary, textAlign: 'center' as const, borderWidth: 1, borderColor: Palette.background }, loadingCard: { minHeight: 100, borderRadius: 20, backgroundColor: Palette.white, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 }, loadingText: { color: Palette.primary, fontSize: 13 },
    error: { color: Palette.error, backgroundColor: Palette.background, padding: 13, borderRadius: 15, fontSize: 14 },
    button: { flexGrow: 1, minHeight: 54, backgroundColor: Palette.primary, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const }, largeButton: { minHeight: 64, borderRadius: 16, width: '100%', marginTop: 5 }, buttonText: { color: Palette.white, fontSize: 16, fontWeight: '700' as const, textAlign: 'center' as const }, secondaryButton: { backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.muted }, secondaryText: { color: Palette.primary }, disabled: { opacity: 0.5 },
    floatingAssistant: { position: 'absolute' as const, right: 20, bottom: 91, width: 70, height: 70, borderRadius: 35, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.primary, borderWidth: 3, borderColor: Palette.secondarySurface, shadowColor: Palette.primary, shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 }, floatingMic: { color: Palette.white, fontSize: 30 }, floatingPressed: { transform: [{ scale: 0.94 }], opacity: 0.92 },
    bottomNav: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, minHeight: 77, paddingHorizontal: 9, paddingTop: 7, paddingBottom: 8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, backgroundColor: Palette.white, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderTopWidth: 1, borderColor: Palette.background, shadowColor: Palette.text, shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
    bottomTab: { minWidth: 64, minHeight: 56, flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2, borderRadius: 15 }, bottomTabActive: { backgroundColor: Palette.background }, bottomTabIcon: { color: Palette.textSecondary, fontSize: 20, lineHeight: 24 }, bottomTabIconActive: { color: Palette.primary }, bottomTabLabel: { color: Palette.textSecondary, fontSize: 11, fontWeight: '600' as const }, bottomTabLabelActive: { color: Palette.primary, fontWeight: '900' as const }, tabPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    modalPage: { flex: 1, backgroundColor: Palette.background, paddingHorizontal: 24, paddingVertical: 30, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 14 }, modalEyebrow: { color: Palette.primary, fontSize: 18, fontWeight: '700' as const, textAlign: 'center' as const }, modalTitle: { color: Palette.primary, fontSize: 32, lineHeight: 40, fontWeight: '800' as const, textAlign: 'center' as const }, modalDose: { color: Palette.text, fontSize: 24, fontWeight: '700' as const, textAlign: 'center' as const }, modalTime: { color: Palette.primary, fontSize: 18, textAlign: 'center' as const }, modalMessage: { color: Palette.text, fontSize: 20, lineHeight: 30, textAlign: 'center' as const, marginVertical: 4 }, reply: { color: Palette.success, fontSize: 18, textAlign: 'center' as const, writingDirection: 'rtl' as const }, dismiss: { minHeight: 48, textAlign: 'center' as const, textAlignVertical: 'center' as const, color: Palette.textSecondary, fontSize: 17, fontWeight: '700' as const },
  }),
};
