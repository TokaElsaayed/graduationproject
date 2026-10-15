import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { saveHealthCheck } from '@/family-dashboard/mock-data';

const questions = [
  { key: 'feeling', text: 'How are you today?', choices: [
    { label: 'Fine', color: '#2F7D4A' },
    { label: 'Not quite right', color: '#C28A12' },
    { label: 'Not well at all', color: '#B43A3A' },
  ] },
  { key: 'sleptWell', text: 'Did you sleep well?', choices: ['Yes', 'Somewhat', 'No'] },
  { key: 'pain', text: 'Do you have any pain?', choices: ['No', 'Yes'] },
  { key: 'breakfast', text: 'Have you eaten breakfast?', choices: ['Yes', 'Not yet'] },
] as const;

type Answers = { feeling: string; sleptWell: string; pain: string; breakfast: string };
const emptyAnswers: Answers = { feeling: '', sleptWell: '', pain: '', breakfast: '' };

export default function HealthCheckScreen() {
  const router = useRouter();
  const { isReady, user } = useAuth();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [completed, setCompleted] = useState(false);

  if (!isReady) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'older_adult') return <Redirect href="/family" />;
  const signedInUser = user;

  const question = questions[questionIndex];
  const selected = answers[question.key];
  const concern = (answers.feeling !== '' && answers.feeling !== 'Fine') || answers.pain === 'Yes';

  function chooseAnswer(value: string) {
    setAnswers((current) => ({ ...current, [question.key]: value }));
  }

  function completeCheckIn() {
    saveHealthCheck({ userId: signedInUser.id, patientName: signedInUser.fullName, ...answers });
    setCompleted(true);
  }

  if (completed) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>Care Circle</Text>
          <View style={styles.card}>
            <Text style={styles.celebration} accessibilityRole="header">Thank you, {signedInUser.fullName.split(' ')[0]}.</Text>
            <Text style={styles.body}>Your morning health check is complete. Your answers are saved for this demo session.</Text>
            {concern ? (
              <View style={styles.careNote}>
                <Text style={styles.careTitle}>Would you like some support?</Text>
                <Text style={styles.body}>You mentioned not feeling well or having pain. Consider telling someone you trust or contacting your care team if you would like help. This check-in does not diagnose a health condition.</Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Return to home</Text>
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
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backHome}>
            <Text style={styles.backHomeText}>‹  Home</Text>
          </Pressable>
          <Text style={styles.brand}>Care Circle</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>MORNING CHECK-IN</Text>
          <Text style={styles.progress} accessibilityRole="header">Question {questionIndex + 1} of {questions.length}</Text>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: questions.length, now: questionIndex + 1 }} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((questionIndex + 1) / questions.length) * 100}%` }]} />
          </View>
          <Text style={styles.question}>{question.text}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Read aloud: ${question.text}`}
            onPress={() => Speech.speak(question.text, { language: 'en', rate: 0.85 })}
            style={styles.readButton}
          >
            <Text style={styles.readButtonText}>🔊  Read this question aloud</Text>
          </Pressable>
          <View style={styles.choices}>
            {question.choices.map((choice) => {
              const label = typeof choice === 'string' ? choice : choice.label;
              const indicatorColor = typeof choice === 'string' ? undefined : choice.color;
              const isSelected = selected === label;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => chooseAnswer(label)}
                  style={[styles.choice, isSelected && styles.choiceSelected]}
                >
                  {indicatorColor ? <View style={[styles.answerIndicator, { backgroundColor: indicatorColor }]} /> : null}
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
                onPress={completeCheckIn}
                style={[styles.primaryButton, !selected && styles.disabledPrimary]}
              >
                <Text style={styles.primaryButtonText}>Complete check-in</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.footer}>Your answers are for your care circle. You can go back and change an answer before finishing.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingTop: 30, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { color: Palette.primary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  backHome: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backHomeText: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: '#FFFEFC', borderRadius: 18, borderWidth: 1, borderColor: '#E7DAD5', padding: 24, gap: 18 },
  eyebrow: { color: Palette.primary, fontSize: 14, fontWeight: '800', letterSpacing: 1.1 },
  progress: { color: '#464348', fontSize: 18, fontWeight: '700' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: '#E9E2DE', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Palette.primary, borderRadius: 5 },
  question: { color: '#242126', fontSize: 30, fontWeight: '800', lineHeight: 38, marginTop: 4 },
  readButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F5EEEB' },
  readButtonText: { color: Palette.primary, fontSize: 16, fontWeight: '700' },
  choices: { gap: 12, marginTop: 2 },
  choice: { minHeight: 64, borderWidth: 2, borderColor: '#D8CECA', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  answerIndicator: { width: 16, height: 16, borderRadius: 8, marginRight: 13 },
  choiceSelected: { borderColor: Palette.primary, backgroundColor: '#F8ECEB' },
  choiceText: { color: '#282529', fontSize: 21, fontWeight: '700' },
  choiceTextSelected: { color: Palette.primary },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 },
  secondaryButton: { minHeight: 56, minWidth: 112, paddingHorizontal: 20, borderRadius: 11, borderWidth: 1, borderColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Palette.primary, fontSize: 18, fontWeight: '700' },
  primaryButton: { minHeight: 56, minWidth: 130, flex: 1, paddingHorizontal: 18, borderRadius: 11, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  disabledButton: { opacity: 0.4 },
  disabledPrimary: { opacity: 0.45 },
  footer: { marginTop: 16, color: '#5E585A', textAlign: 'center', fontSize: 16, lineHeight: 24 },
  celebration: { color: '#29252A', fontSize: 28, fontWeight: '800' },
  body: { color: '#464147', fontSize: 18, lineHeight: 28 },
  careNote: { padding: 16, gap: 8, backgroundColor: '#FBF1E4', borderRadius: 12, borderWidth: 1, borderColor: '#E9D2AC' },
  careTitle: { color: '#654C28', fontSize: 19, fontWeight: '800' },
});
