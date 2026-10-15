import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Palette, VoiceAssistantStyles as styles } from '@/constants/theme';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { API_BASE_URL } from '@/config/api';

export default function App() {
  const router = useRouter();
  const { user, token, isReady, logOut } = useAuth();
  const { width, height } = useWindowDimensions();
  const compactHeight = height < 680;
  const buttonSize = Math.min(154, Math.max(112, Math.min(width * 0.42, height * 0.24)));
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ⚠️ Change this to your computer's IP address
  const BACKEND_URL = `${API_BASE_URL}/voice/process`;

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;

  // Start recording
  async function startRecording() {
    try {
      // Ask for microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Microphone permission is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setTranscript('');
      setReply('');
      setErrorMessage('');
    } catch (err) {
      console.error('Failed to start recording', err);
      alert('Could not start recording');
    }
  }

  // Stop recording and send to backend
  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    setIsLoading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        alert('No audio recorded');
        setIsLoading(false);
        return;
      }

      // Send the audio file to the backend
      const formData = new FormData();
      if (Platform.OS === 'web') {
        // Browser recordings are blob URLs; multipart needs the actual Blob.
        const audioResponse = await fetch(uri);
        if (!audioResponse.ok) {
          throw new Error('Could not read the browser recording. Please record again.');
        }

        const recordedBlob = await audioResponse.blob();
        if (recordedBlob.size === 0) {
          throw new Error('The recording is empty. Please record again.');
        }

        const mimeType = recordedBlob.type || 'audio/webm';
        const audioFile = new Blob([recordedBlob], { type: mimeType });
        const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
        formData.append('audio', audioFile, `recording.${extension}`);
      } else {
        // React Native's FormData implementation uses this file descriptor format.
        formData.append('audio', {
          uri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any);
      }

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const responseText = await response.text();
      let data: {
        transcript?: string;
        reply?: string;
        message?: string;
      };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Backend returned an invalid response (${response.status}).`);
      }

      if (response.ok) {
        setTranscript(data.transcript || '');
        setReply(data.reply || '');

        if (!data.reply) {
          setErrorMessage('The server processed the recording but did not return a reply.');
        }

        if (data.reply) {
          Speech.speak(data.reply, {
            language: /[\u0600-\u06FF]/.test(data.reply) ? 'ar' : 'en',
            pitch: 1.0,
            rate: 0.9,
          });
        }
      } else {
        throw new Error(data.message || `Backend request failed (${response.status}).`);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not process the recording. Check the backend connection and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.content,
            {
              paddingTop: compactHeight ? 20 : 36,
              paddingBottom: compactHeight ? 20 : 28,
              paddingHorizontal: Math.min(24, Math.max(16, width * 0.06)),
            },
          ]}>
        <View style={styles.heading}>
          <Text style={styles.title}>Care Circle</Text>
          <Text style={styles.subtitle}>Voice Assistant</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountName}>Hello, {user.fullName}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}>
              <Text style={styles.signOut}>Profile</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')}>
              <Text style={styles.signOut}>Medicines</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/explore')}>
              <Text style={styles.signOut}>Demo plan</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/family')}>
              <Text style={styles.signOut}>Family dashboard</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await logOut();
                router.replace('/login');
              }}
            >
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.centerStage}>
          <View style={styles.soundwave} accessibilityLabel="Sound wave">
            {[20, 34, 52, 68, 42, 76, 54, 34, 62, 44, 26].map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  { height },
                  index === 3 || index === 5 || index === 8 ? styles.waveBarBright : null,
                ]}
              />
            ))}
          </View>

          {isLoading && (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={Palette.primary} />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}

          <ScrollView style={styles.responseArea}>
            {transcript ? (
              <View nativeID="voice-glass-card" style={styles.message}>
                <Text style={styles.label}>You said</Text>
                <Text style={styles.text}>{transcript}</Text>
              </View>
            ) : null}

            {reply ? (
              <View nativeID="voice-glass-card" style={[styles.message, styles.assistantMessage]}>
                <Text style={[styles.label, styles.assistantLabel]}>Care Circle</Text>
                <Text style={[styles.text, styles.assistantText]}>{reply}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View nativeID="voice-glass-card" style={styles.message}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.bottomArea}>
          <View pointerEvents="none" style={styles.particleField}>
            <View style={[styles.particle, styles.particleOne]} />
            <View style={[styles.particle, styles.particleTwo]} />
            <View style={[styles.particle, styles.particleThree]} />
            <View style={[styles.particle, styles.particleFour]} />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Stop and send recording' : 'Tap to speak'}
          >
            <View
              style={[
                styles.circleBorder,
                { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
              ]}>
              <View
                style={[
                  styles.circleFill,
                  { borderRadius: buttonSize / 2 - 3 },
                  isRecording && styles.circleFillRecording,
                ]}>
                <View style={styles.microphone}>
                  <View style={styles.microphoneHead} />
                  <View style={styles.microphoneStem} />
                  <View style={styles.microphoneStand} />
                  <View style={styles.microphoneBase} />
                </View>
            </View>
            </View>
            <Text style={styles.buttonLabel}>
              {isRecording ? 'Tap to Finish' : 'Tap to Speak'}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
