import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@/config/api';

let currentSound: Audio.Sound | null = null;
let currentWebAudio: HTMLAudioElement | null = null;
const pendingPlayback = new Map<string, Promise<void>>();
const pendingRequests = new Map<string, Promise<SpeechAudio>>();
const webAudioCache = new Map<string, string>();
type SpeechAudio = { bytes: Uint8Array<ArrayBuffer>; contentType: string };

function audioKey(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `elevenlabs-${(hash >>> 0).toString(16)}`;
}

export async function stopCareAudio(): Promise<void> {
  const sound = currentSound;
  currentSound = null;
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (error) {
      console.warn('Could not stop speech playback:', error);
    }
  }
  if (currentWebAudio) {
    currentWebAudio.pause();
    currentWebAudio.currentTime = 0;
    currentWebAudio = null;
  }
}

/** Request backend speech audio and play it on this device. */
export function speakCareText(
  text: string,
  token: string | null | undefined,
): void {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return;
  if (!token) {
    console.warn('Cannot request speech without an authenticated session.');
    return;
  }
  const key = audioKey(cleanText);
  if (pendingPlayback.has(key)) return;
  const request = playCareText(cleanText, token, key);
  pendingPlayback.set(key, request);
  void request.catch((error) => {
    console.error('Speech playback failed:', error);
  }).finally(() => {
    if (pendingPlayback.get(key) === request) pendingPlayback.delete(key);
  });
}

async function playCareText(
  text: string,
  token: string,
  key: string,
): Promise<void> {
  await stopCareAudio();
  if (Platform.OS === 'web') {
    let url = webAudioCache.get(key);
    if (!url) {
      const speech = await requestTtsAudio(text, token, key);
      url = URL.createObjectURL(new Blob([speech.bytes], { type: speech.contentType }));
      webAudioCache.set(key, url);
    }
    const audio = new window.Audio(url);
    currentWebAudio = audio;
    audio.onended = () => { if (currentWebAudio === audio) currentWebAudio = null; };
    await audio.play();
    return;
  }

  const file = new File(Paths.cache, 'care-circle-tts-audio', `${key}.mp3`);
  if (!file.exists || file.size === 0) {
    const speech = await requestTtsAudio(text, token, key);
    file.create({ intermediates: true, overwrite: true });
    file.write(speech.bytes);
  }
  const { sound } = await Audio.Sound.createAsync({ uri: file.uri }, { shouldPlay: true });
  currentSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish && currentSound === sound) {
      currentSound = null;
      void sound.unloadAsync().catch((error) => console.warn('Could not release speech audio:', error));
    }
  });
}

async function requestTtsAudio(
  text: string,
  token: string,
  key: string,
): Promise<SpeechAudio> {
  const existing = pendingRequests.get(key);
  if (existing) return existing;
  const request: Promise<SpeechAudio> = fetch(`${API_BASE_URL}/voice/speak`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  }).then(async (response) => {
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`TTS request failed (${response.status}): ${details}`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg';
    if (contentType !== 'audio/mpeg') {
      throw new Error(`Unexpected TTS audio format: ${contentType}`);
    }
    return { bytes: new Uint8Array(await response.arrayBuffer()), contentType };
  });
  pendingRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (pendingRequests.get(key) === request) pendingRequests.delete(key);
  }
}
