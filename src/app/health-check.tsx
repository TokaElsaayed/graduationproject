import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { API_BASE_URL } from '@/config/api';
import { speakCareText, stopCareAudio } from '@/voice/speech';

const questions = [
  { key: 'feeling', text: 'How are you today?', spokenText: 'صباح الخير. كيف تشعر اليوم؟ اختر إجابة: أنا بخير، لست على ما يرام، أو أشعر بتعب شديد.', choices: ['Fine', 'Not quite right', 'Not well at all'] },
  { key: 'sleptWell', text: 'Did you sleep well?', spokenText: 'هل نمت جيداً؟ اختر إجابة: نعم، إلى حد ما، أو لا.', choices: ['Yes', 'Somewhat', 'No'] },
  { key: 'pain', text: 'Do you have any pain?', spokenText: 'هل تشعر بأي ألم؟ اختر إجابة: لا، أو نعم.', choices: ['No', 'Yes'] },
  { key: 'breakfast', text: 'Have you eaten breakfast?', spokenText: 'هل تناولت وجبة الإفطار؟ اختر إجابة: نعم، أو ليس بعد.', choices: ['Yes', 'Not yet'] },
] as const;

type Answers = { feeling: string; sleptWell: string; pain: string; breakfast: string };
const emptyAnswers: Answers = { feeling: '', sleptWell: '', pain: '', breakfast: '' };

export default function HealthCheckScreen() {
  const router = useRouter();
  const { dailyFlow } = useLocalSearchParams<{ dailyFlow?: string }>();
  const { isReady, user, token } = useAuth();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [completed, setCompleted] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const concern = (answers.feeling !== '' && answers.feeling !== 'Fine') || answers.pain === 'Yes';

  useEffect(() => { recordingRef.current = recording; }, [recording]);

  useEffect(() => () => {
    void stopCareAudio();
    if (recordingRef.current) void recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isReady || user?.role !== 'older_adult' || completed) return;
    const questionToRead = questions[questionIndex];
    if (!questionToRead) return;

    const timeout = setTimeout(() => speakArabic(questionToRead.spokenText, token), 350);
    return () => {
      clearTimeout(timeout);
      void stopCareAudio();
    };
  }, [completed, isReady, questionIndex, token, user?.id, user?.role]);

  useEffect(() => {
    if (!completed || !user) return;
    const message = concern
      ? 'شكراً لك. انتهت أسئلة الاطمئنان. إذا كنت تحتاج إلى المساعدة، فتحدث مع شخص تثق به أو مع فريق الرعاية. هذه الأسئلة لا تُعد تشخيصاً طبياً.'
      : 'شكراً لك. انتهت أسئلة الاطمئنان. نتمنى لك يوماً سعيداً.';
    speakArabic(message, token);
    return () => { void stopCareAudio(); };
  }, [completed, concern, token, user?.fullName]);

  if (!isReady) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'older_adult') return <Redirect href="/family" />;

  const question = questions[questionIndex];
  const selected = answers[question.key];
  function chooseAnswer(value: string) {
    setPendingAnswer(null);
    setVoiceError('');
    setAnswers((current) => ({ ...current, [question.key]: value }));
  }

  async function completeCheckIn(finalAnswers = answers) {
    setSaveError('');
    try {
      const response = await fetch(`${API_BASE_URL}/health-check`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalAnswers),
      });
      const result = await response.json().catch(() => ({})) as { message?: string | string[] };
      if (!response.ok) {
        const message = Array.isArray(result.message) ? result.message.join(' ') : result.message;
        throw new Error(message || `Could not save the check-in (${response.status}).`);
      }
      setCompleted(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your check-in. Please try again.');
    }
  }

  function acceptPendingAnswer() {
    if (!pendingAnswer) return;
    const confirmedAnswers = { ...answers, [question.key]: pendingAnswer };
    setAnswers(confirmedAnswers);
    setPendingAnswer(null);
    setVoiceError('');
    speakArabic('شكراً لك، تم تسجيل إجابتك.', token);
    if (questionIndex < questions.length - 1) setQuestionIndex((current) => current + 1);
    else void completeCheckIn(confirmedAnswers);
  }

  function rejectPendingAnswer() {
    setPendingAnswer(null);
    setVoiceError('');
    speakArabic('حسناً. من فضلك، أعد إجابتك.', token);
  }

  async function handleVoiceAnswer() {
    if (!recording) {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Please allow microphone access to answer by voice.');
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        void stopCareAudio();
        const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(result.recording);
        setVoiceError('');
      } catch (error) {
        setVoiceError(error instanceof Error ? error.message : 'Could not start recording.');
      }
      return;
    }

    setVoiceBusy(true);
    setVoiceError('');
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      const uri = recording.getURI();
      if (!uri) throw new Error('No audio was recorded. Please try again.');

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const audioResponse = await fetch(uri);
        const blob = await audioResponse.blob();
        if (!blob.size) throw new Error('The recording is empty. Please try again.');
        const mimeType = blob.type || 'audio/webm';
        formData.append('audio', new Blob([blob], { type: mimeType }), `health-check.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`);
      } else {
        formData.append('audio', { uri, type: 'audio/m4a', name: 'health-check.m4a' } as any);
      }

      const response = await fetch(`${API_BASE_URL}/voice/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({})) as { transcript?: string; message?: string | string[] };
      if (!response.ok || !data.transcript) {
        const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
        throw new Error(message || 'Could not transcribe your answer. Please try again.');
      }

      if (pendingAnswer) {
        const decision = parseYesNo(data.transcript);
        if (decision === true) acceptPendingAnswer();
        else if (decision === false) rejectPendingAnswer();
        else {
          setVoiceError('Please say yes to confirm or no to try again.');
          speakArabic('قل نعم إذا كانت الإجابة صحيحة، أو لا لإعادتها.', token);
        }
      } else {
        const answer = parseHealthAnswer(question.key, data.transcript);
        if (!answer) {
          setVoiceError('I could not match that answer. Please try again or choose an answer below.');
          speakArabic('لم أسمع إجابة واضحة. هل يمكنك قول إجابتك مرة أخرى؟', token);
        } else {
          setPendingAnswer(answer);
          speakArabic(`فهمت أن إجابتك هي: ${answerInArabic(question.key, answer)}. هل هذا صحيح؟ قل نعم للتأكيد، أو لا لإعادة الإجابة.`, token);
        }
      }
    } catch (error) {
      setRecording(null);
      setVoiceError(error instanceof Error ? error.message : 'Could not process your voice answer.');
    } finally {
      setVoiceBusy(false);
    }
  }

  if (completed) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>Care Circle</Text>
          <View style={styles.card}>
            <Text style={styles.celebration} accessibilityRole="header">Health check complete</Text>
            <Text style={styles.body}>Your answers have been saved.</Text>
            {concern ? (
              <View style={styles.careNote}>
              <Text style={styles.careTitle}>You may need support</Text>
              <Text style={styles.body}>You reported feeling unwell or having pain. Contact someone you trust or your care team. This check-in is not a diagnosis.</Text>
              </View>
            ) : null}
            {saveError ? <Text accessibilityRole="alert" style={styles.voiceError}>{saveError}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => router.replace(dailyFlow === '1' ? '/reminders?dailyFlow=1' : '/')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{dailyFlow === '1' ? 'Continue to medicines' : 'Return to home'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          {dailyFlow !== '1' ? <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backHome}>
            <Text style={styles.backHomeText}>‹  Home</Text>
          </Pressable> : <View style={styles.backHome} />}
          <Text style={styles.brand}>Care Circle</Text>
        </View>
        <View style={styles.card}>
            <Text style={styles.eyebrow}>DAILY HEALTH CHECK</Text>
          <Text style={styles.progress} accessibilityRole="header">Question {questionIndex + 1} of {questions.length}</Text>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: questions.length, now: questionIndex + 1 }} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((questionIndex + 1) / questions.length) * 100}%` }]} />
          </View>
          <Text style={styles.question}>{question.text}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Read aloud: ${question.text}`}
            onPress={() => speakArabic(question.spokenText, token)}
            style={styles.readButton}
          >
            <Text style={styles.readButtonText}>Read question aloud</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={voiceBusy}
            onPress={() => void handleVoiceAnswer()}
            style={[styles.voiceButton, recording && styles.recordingButton, voiceBusy && styles.disabledButton]}
          >
            <Text style={styles.voiceButtonText}>
              {voiceBusy ? 'Processing…' : recording ? 'Finish speaking' : pendingAnswer ? 'Say yes or no' : 'Answer by voice'}
            </Text>
          </Pressable>
          {voiceError ? <Text accessibilityRole="alert" style={styles.voiceError}>{voiceError}</Text> : null}
          {pendingAnswer ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmText}>I heard: {pendingAnswer}. Is that correct?</Text>
              <View style={styles.confirmActions}>
                <Pressable accessibilityRole="button" onPress={acceptPendingAnswer} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Confirm answer</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={rejectPendingAnswer} style={styles.rejectButton}>
                  <Text style={styles.rejectButtonText}>No, try again</Text>
                </Pressable>
              </View>
              <Text style={styles.confirmHint}>Or say yes or no.</Text>
            </View>
          ) : null}
          <View style={styles.choices}>
            {question.choices.map((choice) => {
              const label = choice;
              const isSelected = selected === label;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => chooseAnswer(label)}
                  style={[styles.choice, isSelected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.navigation}>
            <Pressable
              accessibilityRole="button"
              disabled={questionIndex === 0}
              onPress={() => setQuestionIndex((current) => Math.max(0, current - 1))}
              style={[styles.secondaryButton, questionIndex === 0 && styles.disabledButton]}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            {questionIndex < questions.length - 1 ? (
              <Pressable
                accessibilityRole="button"
                disabled={!selected}
                onPress={() => setQuestionIndex((current) => current + 1)}
                style={[styles.primaryButton, !selected && styles.disabledPrimary]}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={!selected}
                onPress={() => void completeCheckIn()}
                style={[styles.primaryButton, !selected && styles.disabledPrimary]}
              >
                <Text style={styles.primaryButtonText}>Submit health check</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function speakArabic(text: string, token: string | null | undefined) {
  speakCareText(text, token);
}

function normalizeTranscript(transcript: string): string {
  return transcript
    .toLocaleLowerCase()
    .replace(/[ًٌٍَُِّْـ]/gu, '')
    .replace(/[،,.!?؟]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function parseYesNo(transcript: string): boolean | null {
  const text = normalizeTranscript(transcript);
  if (/\b(no|nope|not|false)\b|(^|\s)(لأ|لا|لأه|مش)(\s|$)|لسه|ماخدتش|مخدتش/u.test(text)) return false;
  if (/\b(yes|yeah|yep|correct|right|true|okay|ok)\b|(^|\s)(أيوه|ايوه|آه|اه|نعم|صح|مظبوط)(\s|$)/u.test(text)) return true;
  return null;
}

function parseHealthAnswer(key: keyof Answers, transcript: string): string | null {
  const text = normalizeTranscript(transcript);
  const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

  if (key === 'feeling') {
    if (has(/تعبان(ة)? جدا/u, /مش بخير خالص/u, /مش كويس خالص/u, /وحش(ة)? جدا/u, /\b(terrible|very bad|not well at all)\b/u)) return 'Not well at all';
    if (has(/مش احسن/u, /مش كويس(ة)?/u, /مش تمام/u, /مش قوي/u, /نص نص/u, /\b(not quite|not great|so so|somewhat|a little)\b/u)) return 'Not quite right';
    if (has(/كويس(ة)?/u, /تمام/u, /بخير/u, /الحمد لله/u, /\b(fine|good|great|well)\b/u)) return 'Fine';
    return null;
  }

  if (key === 'sleptWell') {
    if (has(/ما.?نمتش/u, /منمتش/u, /مش كويس/u, /لأ/u, /لا/u, /\b(no|not well|badly)\b/u)) return 'No';
    if (has(/إلى حد ما/u, /الى حد ما/u, /شوية/u, /نص نص/u, /\b(somewhat|a little|so so)\b/u)) return 'Somewhat';
    if (has(/نمت كويس/u, /أيوه/u, /ايوه/u, /آه/u, /اه/u, /\b(yes|well|good)\b/u)) return 'Yes';
    return null;
  }

  if (key === 'pain') {
    if (has(/مفيش ألم/u, /مافيش ألم/u, /مش عندي ألم/u, /مش حاسس بألم/u, /لأ/u, /لا/u, /\b(no|no pain)\b/u)) return 'No';
    if (has(/عندي ألم/u, /في ألم/u, /حاسس بألم/u, /وجع/u, /\b(yes|pain|it hurts)\b/u)) return 'Yes';
    return null;
  }

  if (has(/لسه/u, /مافطرتش/u, /مفطرتش/u, /ماكلتش/u, /لأ/u, /لا/u, /\b(not yet|no)\b/u)) return 'Not yet';
  if (has(/فطرت/u, /أكلت الفطار/u, /اكلت الفطار/u, /أيوه/u, /ايوه/u, /آه/u, /اه/u, /\b(yes|i ate|had breakfast)\b/u)) return 'Yes';
  return null;
}

function answerInArabic(key: keyof Answers, answer: string): string {
  const translations: Record<keyof Answers, Record<string, string>> = {
    feeling: { Fine: 'أنك بخير', 'Not quite right': 'أنك لست على ما يرام', 'Not well at all': 'أنك تشعر بتعب شديد' },
    sleptWell: { Yes: 'أنك نمت جيداً', Somewhat: 'أنك نمت إلى حد ما', No: 'أنك لم تنم جيداً' },
    pain: { No: 'أنك لا تشعر بألم', Yes: 'أنك تشعر بألم' },
    breakfast: { Yes: 'أنك تناولت الإفطار', 'Not yet': 'أنك لم تتناول الإفطار بعد' },
  };
  return translations[key][answer] ?? answer;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingTop: 30, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { color: Palette.primary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  backHome: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backHomeText: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: Palette.white, borderRadius: 18, borderWidth: 1, borderColor: Palette.muted, padding: 24, gap: 18 },
  eyebrow: { color: Palette.primary, fontSize: 14, fontWeight: '800', letterSpacing: 1.1 },
  progress: { color: Palette.text, fontSize: 18, fontWeight: '700' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: Palette.background, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Palette.primary, borderRadius: 5 },
  question: { color: Palette.text, fontSize: 30, fontWeight: '800', lineHeight: 38, marginTop: 4 },
  readButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: Palette.background },
  readButtonText: { color: Palette.primary, fontSize: 16, fontWeight: '700' },
  voiceButton: { minHeight: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, borderRadius: 14, backgroundColor: Palette.primary },
  recordingButton: { backgroundColor: Palette.primary },
  voiceButtonText: { color: Palette.white, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  voiceError: { color: Palette.primary, backgroundColor: Palette.background, padding: 12, borderRadius: 10, fontSize: 16 },
  confirmCard: { gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.background },
  confirmText: { color: Palette.text, fontSize: 20, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  confirmButton: { flex: 1, minHeight: 56, minWidth: 130, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: Palette.success },
  confirmButtonText: { color: Palette.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  rejectButton: { flex: 1, minHeight: 56, minWidth: 130, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 11, borderWidth: 2, borderColor: Palette.primary, backgroundColor: Palette.white },
  rejectButtonText: { color: Palette.primary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  confirmHint: { color: Palette.textSecondary, fontSize: 15, textAlign: 'center' },
  choices: { gap: 12, marginTop: 2 },
  choice: { minHeight: 64, borderWidth: 2, borderColor: Palette.muted, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 18, backgroundColor: Palette.white },
  answerIndicator: { width: 16, height: 16, borderRadius: 8, marginRight: 13 },
  choiceSelected: { borderColor: Palette.primary, backgroundColor: Palette.background },
  choiceText: { color: Palette.text, fontSize: 21, fontWeight: '700' },
  choiceTextSelected: { color: Palette.primary },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 },
  secondaryButton: { minHeight: 56, minWidth: 112, paddingHorizontal: 20, borderRadius: 11, borderWidth: 1, borderColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Palette.primary, fontSize: 18, fontWeight: '700' },
  primaryButton: { minHeight: 56, minWidth: 130, flex: 1, paddingHorizontal: 18, borderRadius: 11, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: Palette.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  disabledButton: { opacity: 0.4 },
  disabledPrimary: { opacity: 0.45 },
  footer: { marginTop: 16, color: Palette.textSecondary, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  celebration: { color: Palette.text, fontSize: 28, fontWeight: '800' },
  body: { color: Palette.text, fontSize: 18, lineHeight: 28 },
  careNote: { padding: 16, gap: 8, backgroundColor: Palette.background, borderRadius: 12, borderWidth: 1, borderColor: Palette.warningSurface },
  careTitle: { color: Palette.warning, fontSize: 19, fontWeight: '800' },
});
