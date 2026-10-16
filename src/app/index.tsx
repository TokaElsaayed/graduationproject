import { Palette } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { speakCareText } from '@/voice/speech';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { API_BASE_URL } from '@/config/api';
import { profileRequest, type EmergencyContact, type Medication } from '@/profile/profile-api';

const colors = {
  primary: Palette.primary, secondary: Palette.secondary, background: Palette.background,
  card: Palette.surface, text: Palette.text, muted: Palette.muted, success: Palette.success,
  danger: Palette.error, paleRose: Palette.secondarySurface, paleGreen: Palette.successSurface, paleRed: Palette.errorSurface,
  border: Palette.border,
};

export default function App() {
  const router = useRouter();
  const { user, token, isReady, logOut } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [pulse] = useState(() => new Animated.Value(1));

  const backendUrl = `${API_BASE_URL}/voice/process`;

  useEffect(() => {
    if (!token || user?.role !== 'older_adult') return;
    let active = true;
    void Promise.all([
      profileRequest<Medication[]>(token, '/profiles/me/medications'),
      profileRequest<EmergencyContact[]>(token, '/profiles/me/contacts'),
    ]).then(([loadedMedications, loadedContacts]) => {
      if (active) {
        setMedications(loadedMedications);
        setContacts(loadedContacts);
      }
    }).catch((error) => console.warn('Could not load home summary data', error));
    return () => { active = false; };
  }, [token, user?.role]);

  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.1, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isRecording, pulse]);

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Microphone permission is required');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
      setIsRecording(true);
      setTranscript('');
      setReply('');
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to start recording', error);
      alert('Could not start recording');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    setIsLoading(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('No audio was recorded. Please try again.');

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const audioResponse = await fetch(uri);
        if (!audioResponse.ok) throw new Error('Could not read the browser recording. Please record again.');
        const recordedBlob = await audioResponse.blob();
        if (recordedBlob.size === 0) throw new Error('The recording is empty. Please record again.');
        const mimeType = recordedBlob.type || 'audio/webm';
        const audioFile = new Blob([recordedBlob], { type: mimeType });
        const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
        formData.append('audio', audioFile, `recording.${extension}`);
      } else {
        formData.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
      }

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const responseText = await response.text();
      let data: { transcript?: string; reply?: string; message?: string };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Backend returned an invalid response (${response.status}).`);
      }
      if (!response.ok) throw new Error(data.message || `Backend request failed (${response.status}).`);
      setTranscript(data.transcript || '');
      setReply(data.reply || '');
      if (!data.reply) setErrorMessage('The server processed your recording but did not return a reply.');
      if (data.reply) void speakCareText(data.reply, token);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not process your recording. Check the connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const openPhone = async () => {
    const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
    if (!primaryContact?.phone) {
      router.push('/profile');
      return;
    }
    const phoneUrl = `tel:${primaryContact.phone.replace(/[^+\d]/g, '')}`;
    try {
      await Linking.openURL(phoneUrl);
    } catch {
      setErrorMessage('Could not open the phone app. Please check your emergency contact details.');
    }
  };

  const scheduledCount = medications.length;
  const displayName = user.fullName || 'Mahmoud Hassan';
  const navButton = (label: string, icon: string, route: '/' | '/reminders' | '/health-check' | '/profile', active = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(route)} style={styles.navItem}>
      <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, wide && styles.pageWide]}>
          <View style={styles.header}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandTitle}>Care Circle</Text>
              <Text style={styles.brandSubtitle}>Care and reminders</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open settings and profile" onPress={() => router.push('/profile')} style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          </View>

          <View style={styles.welcomeCard}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeName}>Hello, {displayName}</Text>
              <View style={styles.medicationSummary}>
                <Text style={styles.medicationIcon}>✚</Text>
                <Text style={styles.medicationText}>
                  {scheduledCount ? `${scheduledCount} medicine${scheduledCount === 1 ? '' : 's'} today` : 'No medicines scheduled today'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Quick access</Text>
          </View>
          <View style={styles.actionsGrid}>
            <QuickAction icon="✚" title="Medicines" subtitle="View today's doses" tone={Palette.background} onPress={() => router.push('/reminders')} />
            <QuickAction icon="▦" title="My Day" subtitle="View your schedule" tone={Palette.background} onPress={() => router.push('/explore')} />
            <QuickAction icon="♡" title="Health Check" subtitle="Check how you feel" tone={Palette.background} onPress={() => router.push('/health-check')} />
            <QuickAction icon="♙" title="Profile" subtitle="Health and contact details" tone={Palette.background} onPress={() => router.push('/profile')} />
          </View>
          {user.role === 'caregiver' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/family')} style={styles.caregiverLink}>
              <Text style={styles.caregiverLinkText}>Open family dashboard  →</Text>
            </Pressable>
          ) : null}

          <View style={styles.assistantCard}>
            <Text accessibilityRole="header" style={styles.assistantTitle}>{isRecording ? 'Listening' : isLoading ? 'Preparing response' : 'Voice assistant'}</Text>
            <Text style={styles.assistantSubtitle}>{isRecording ? 'Tap to finish' : 'Tap the microphone to speak'}</Text>
            <View style={styles.voiceRow}>
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? 'Stop and send recording' : 'Tap to speak'}
                  accessibilityHint="Starts a voice message to Care Circle"
                  disabled={isLoading}
                  onPress={isRecording ? stopRecording : startRecording}
                  style={({ pressed }) => [styles.micButton, isRecording && styles.micListening, pressed && styles.pressed, isLoading && styles.micDisabled]}>
                  {isLoading ? <ActivityIndicator color={Palette.white} size="large" /> : isRecording ? <Text style={styles.micGlyph}>Stop</Text> : (
                    <>
                      <View accessible={false} style={styles.microphoneIcon}>
                        <View style={styles.microphoneHead} />
                        <View style={styles.microphoneStem} />
                        <View style={styles.microphoneStand} />
                        <View style={styles.microphoneBase} />
                      </View>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            </View>
            {isLoading ? <Text accessibilityLiveRegion="polite" style={styles.loadingHint}>Preparing your response…</Text> : null}
            {transcript ? <MessageCard label="You said" text={transcript} /> : null}
            {reply ? <MessageCard label="Care Circle" text={reply} assistant /> : null}
            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/family-alerts')} style={({ pressed }) => [styles.familyCard, pressed && styles.pressed]}>
            <View style={styles.familyIconWrap}><Text style={styles.familyIcon}>♧</Text></View>
            <View style={styles.familyCopy}>
              <Text style={styles.familyTitle}>Family alerts</Text>
              <Text style={styles.familySubtitle}>Review recent care alerts</Text>
            </View>
            <View style={styles.statusBadge}><Text style={styles.statusText}>View</Text></View>
          </Pressable>

          <View style={styles.emergencyCard}>
            <View style={styles.emergencyTop}>
              <View style={styles.emergencyIconWrap}><Text style={styles.emergencyIcon}>♡</Text></View>
              <View style={styles.emergencyCopy}>
                <Text style={styles.emergencyTitle}>Emergency Contact</Text>
              <Text style={styles.emergencySubtitle}>Call your trusted contact</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Call emergency contact" onPress={openPhone} style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
              <Text style={styles.callIcon}>☎</Text><Text style={styles.callText}>Call contact</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={async () => { await logOut(); router.replace('/login'); }} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        {navButton('Home', '⌂', '/', true)}
        {navButton('Medicines', '✚', '/reminders')}
        {navButton('Health', '♡', '/health-check')}
        {navButton('Profile', '♙', '/profile')}
      </View>
    </SafeAreaView>
  );
}

function QuickAction({ icon, title, subtitle, tone, onPress }: { icon: string; title: string; subtitle: string; tone: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}>
      <View style={[styles.actionIconWrap, { backgroundColor: tone }]}><Text style={styles.actionIcon}>{icon}</Text></View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function MessageCard({ label, text, assistant = false }: { label: string; text: string; assistant?: boolean }) {
  return <View style={[styles.messageCard, assistant && styles.assistantMessage]}><Text style={styles.messageLabel}>{label}</Text><Text style={styles.messageText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 106 },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, gap: 16 },
  pageWide: { paddingHorizontal: 30, paddingTop: 24, gap: 24 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: Palette.white, fontSize: 21, fontWeight: '800' },
  brandCopy: { flex: 1 },
  brandTitle: { color: colors.primary, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  brandSubtitle: { color: colors.muted, fontSize: 13, marginTop: 1 },
  settingsButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  settingsIcon: { color: colors.primary, fontSize: 23 },
  welcomeCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, backgroundColor: Palette.white, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 76, height: 76, borderRadius: 27, backgroundColor: colors.paleRose, borderWidth: 2, borderColor: Palette.background, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  welcomeCopy: { flex: 1 },
  welcomeEyebrow: { color: colors.secondary, fontSize: 11, letterSpacing: 1.4, fontWeight: '800', marginBottom: 4 },
  welcomeName: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  welcomeText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  medicationSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  medicationIcon: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  medicationText: { color: colors.primary, flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sectionHeading: { marginBottom: -8 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 14, marginTop: 3 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '48%', flexGrow: 1, flexBasis: '44%', minHeight: 118, padding: 15, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  actionPressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionIcon: { color: colors.primary, fontSize: 25, fontWeight: '700' },
  actionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  actionSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 3 },
  caregiverLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 15, backgroundColor: Palette.white, borderWidth: 1, borderColor: colors.border },
  caregiverLinkText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  assistantCard: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, borderRadius: 22, backgroundColor: Palette.white, borderWidth: 1, borderColor: colors.border },
  assistantEyebrow: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  assistantTitle: { color: colors.text, fontSize: 26, lineHeight: 34, textAlign: 'center', fontWeight: '800', marginTop: 5 },
  assistantSubtitle: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, marginTop: 2 },
  voiceRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  waveform: { flex: 1, minWidth: 38, height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  waveBar: { width: 4, borderRadius: 4, backgroundColor: colors.secondary },
  micButton: { minWidth: 104, height: 84, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, gap: 4 },
  micListening: { backgroundColor: Palette.primary, borderColor: Palette.secondarySurface },
  micDisabled: { opacity: 0.85 },
  micGlyph: { fontSize: 20, color: Palette.white, fontWeight: '800' },
  microphoneIcon: { width: 22, height: 28, alignItems: 'center', justifyContent: 'flex-start' },
  microphoneHead: { width: 9, height: 16, borderRadius: 5, backgroundColor: Palette.white },
  microphoneStem: { position: 'absolute', top: 9, width: 20, height: 15, borderWidth: 2, borderTopWidth: 0, borderColor: Palette.white, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  microphoneStand: { position: 'absolute', top: 23, width: 2, height: 4, backgroundColor: Palette.white },
  microphoneBase: { position: 'absolute', top: 27, width: 14, height: 2, borderRadius: 2, backgroundColor: Palette.white },
  micCaption: { color: colors.primary, fontSize: 16, lineHeight: 23, textAlign: 'center', fontWeight: '700', marginTop: 13 },
  loadingHint: { color: colors.muted, fontSize: 14, marginTop: 8 },
  messageCard: { width: '100%', backgroundColor: Palette.background, borderRadius: 16, padding: 14, marginTop: 12 },
  assistantMessage: { backgroundColor: colors.paleRose },
  messageLabel: { color: colors.primary, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 24 },
  errorMessage: { width: '100%', color: Palette.error, fontSize: 15, lineHeight: 22, backgroundColor: colors.paleRed, borderRadius: 14, padding: 12, marginTop: 12 },
  familyCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  familyIconWrap: { width: 48, height: 48, borderRadius: 17, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center' },
  familyIcon: { color: colors.primary, fontSize: 26, fontWeight: '700' },
  familyCopy: { flex: 1 },
  familyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  familySubtitle: { color: Palette.success, fontSize: 14, lineHeight: 19, marginTop: 3 },
  statusBadge: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 14, backgroundColor: Palette.background },
  statusCheck: { color: Palette.success, fontSize: 15, fontWeight: '900' },
  statusText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  emergencyCard: { padding: 17, borderRadius: 22, backgroundColor: colors.paleRed, borderWidth: 1, borderColor: Palette.background },
  emergencyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emergencyIconWrap: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.errorSurface },
  emergencyIcon: { color: colors.danger, fontSize: 28, fontWeight: '700' },
  emergencyCopy: { flex: 1 },
  emergencyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emergencySubtitle: { color: Palette.error, fontSize: 14, lineHeight: 20, marginTop: 3 },
  callButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14, borderRadius: 16, backgroundColor: colors.danger },
  callIcon: { color: Palette.white, fontSize: 19 },
  callText: { color: Palette.white, fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  signOutButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.muted, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 78, paddingHorizontal: 10, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 18 : 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: Palette.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: colors.border, shadowColor: Palette.text, shadowOpacity: 0.09, shadowRadius: 15, shadowOffset: { width: 0, height: -4 }, elevation: 9 },
  navItem: { minWidth: 64, minHeight: 54, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIcon: { color: Palette.textSecondary, fontSize: 23, lineHeight: 27 },
  navIconActive: { color: colors.primary },
  navLabel: { color: Palette.textSecondary, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  navLabelActive: { color: colors.primary, fontWeight: '800' },
});
