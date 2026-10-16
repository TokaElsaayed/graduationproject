import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { basename } from 'path';
import { ProfileService } from '../profiles/profile.service';

const CARE_CIRCLE_INSTRUCTIONS = `أنت مساعد Care Circle الصوتي، لطيف وهادئ وبتساعد كبار السن في مصر.
اتكلم  المصرية البسيطة والواضحة، بجمل قصيرة وسهلة.
لا تقدم تشخيصًا أو نصيحة طبية. لو المستخدم حاسس بتعب أو دوخة، شجعه بهدوء إنه يكلم أحد أفراد العائلة.
لو الطلب مش واضح، اطلب منه يعيده بهدوء. خليك ودود ومحترم.`;

const TTS_CACHE_MAX_BYTES = 24 * 1024 * 1024;
const ttsAudioCache = new Map<string, Buffer>();
const pendingTtsRequests = new Map<string, Promise<Buffer>>();
let ttsAudioCacheBytes = 0;

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly profiles: ProfileService,
  ) {}

  async processAudio(filePath: string, userId: string): Promise<{
    transcript: string;
    reply: string;
  }> {
    try {
      const transcript = await this.speechToText(filePath);
      const context = this.profiles.buildPersonalContext(userId);
      const reply = await this.generateReply(transcript, context);
      return { transcript, reply };
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        console.warn('Could not delete temporary audio file:', filePath);
      }
    }
  }

  private getGroqApiKey(): string {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing from the backend environment');
    }
    return apiKey;
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    if (typeof text !== 'string' || !text.trim() || text.length > 3000) {
      throw new BadRequestException('Speech text must contain 1 to 3000 characters.');
    }

    const cleanText = text.trim();
    const cacheKey = this.buildTtsCacheKey(cleanText);
    const cached = ttsAudioCache.get(cacheKey);
    if (cached) {
      ttsAudioCache.delete(cacheKey);
      ttsAudioCache.set(cacheKey, cached);
      this.logger.log(`TTS cache hit provider=elevenlabs bytes=${cached.length}`);
      return cached;
    }
    const pending = pendingTtsRequests.get(cacheKey);
    if (pending) return pending;

    const request = this.synthesizeWithElevenLabs(cleanText);
    pendingTtsRequests.set(cacheKey, request);
    const startedAt = performance.now();
    try {
      const audio = await request;
      this.cacheTtsAudio(cacheKey, audio);
      this.logger.log(
        `TTS generated provider=elevenlabs bytes=${audio.length} elapsed_ms=${Math.round(performance.now() - startedAt)}`,
      );
      return audio;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      this.logger.error('ElevenLabs TTS request failed.', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('ElevenLabs TTS is unavailable.');
    } finally {
      if (pendingTtsRequests.get(cacheKey) === request) pendingTtsRequests.delete(cacheKey);
    }
  }

  getSpeechContentType(): string {
    return 'audio/mpeg';
  }

  private buildTtsCacheKey(text: string): string {
    const variant = [
      this.config.get<string>('ELEVENLABS_VOICE_ID') ?? '',
      this.config.get<string>('ELEVENLABS_MODEL_ID') ?? 'eleven_v4',
      this.config.get<string>('ELEVENLABS_OUTPUT_FORMAT') ?? 'mp3_22050_32',
    ].join('\0');
    return createHash('sha256').update(`elevenlabs\0${variant}\0${text}`).digest('hex');
  }

  private cacheTtsAudio(key: string, audio: Buffer): void {
    if (audio.length > TTS_CACHE_MAX_BYTES) return;
    while (ttsAudioCacheBytes + audio.length > TTS_CACHE_MAX_BYTES || ttsAudioCache.size >= 128) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (!oldestKey) break;
      ttsAudioCacheBytes -= ttsAudioCache.get(oldestKey)?.length ?? 0;
      ttsAudioCache.delete(oldestKey);
    }
    ttsAudioCache.set(key, audio);
    ttsAudioCacheBytes += audio.length;
  }

  private async synthesizeWithElevenLabs(text: string): Promise<Buffer> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID');
    if (!apiKey || !voiceId) {
      throw new ServiceUnavailableException(
        'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the backend .env before using ElevenLabs TTS.',
      );
    }

    const modelId = this.config.get<string>('ELEVENLABS_MODEL_ID') ?? 'eleven_v4';
    const outputFormat = this.config.get<string>('ELEVENLABS_OUTPUT_FORMAT') ?? 'mp3_22050_32';
    if (modelId.startsWith('eleven_v4')) {
      return this.synthesizeElevenV4WebSocket(text, voiceId, apiKey, modelId, outputFormat);
    }

    const startedAt = performance.now();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          apply_text_normalization: 'auto',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.15,
            use_speaker_boost: true,
            speed: 0.95,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      this.logger.error(`ElevenLabs TTS returned ${response.status}: ${details}`);
      if (response.status === 401 || response.status === 403) {
        throw new BadGatewayException('ElevenLabs rejected the API key or voice access. Check the key and voice ID.');
      }
      if (response.status === 429) {
        throw new BadGatewayException('ElevenLabs quota or rate limit reached. Check the free-plan credits.');
      }
      throw new BadGatewayException(`ElevenLabs speech synthesis failed (${response.status}).`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 128 || !response.headers.get('content-type')?.includes('audio')) {
      throw new BadGatewayException('ElevenLabs returned invalid audio. Verify the voice and model settings.');
    }
    this.logger.log(
      `ElevenLabs TTS voice=${voiceId} model=${modelId} format=${outputFormat} elapsed_ms=${Math.round(performance.now() - startedAt)}`,
    );
    return audio;
  }

  private synthesizeElevenV4WebSocket(
    text: string,
    voiceId: string,
    apiKey: string,
    modelId: string,
    outputFormat: string,
  ): Promise<Buffer> {
    const params = new URLSearchParams({ model_id: modelId, output_format: outputFormat });
    const socket = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?${params}`);
    const startedAt = performance.now();

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Eleven v4 TTS timed out.')), 45_000);

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (socket.readyState < WebSocket.CLOSING) socket.close();
        if (error) {
          reject(error);
          return;
        }
        const audio = Buffer.concat(chunks);
        if (audio.length < 128) {
          reject(new BadGatewayException('Eleven v4 returned empty audio. Check the voice ID and account access.'));
          return;
        }
        this.logger.log(
          `ElevenLabs TTS voice=${voiceId} model=${modelId} format=${outputFormat} elapsed_ms=${Math.round(performance.now() - startedAt)}`,
        );
        resolve(audio);
      };

      socket.addEventListener('open', () => {
        try {
          socket.send(JSON.stringify({ voices: [voiceId], xi_api_key: apiKey }));
          socket.send(JSON.stringify({
            inputs: [{ text, voice_id: voiceId, new_turn: true }],
          }));
          socket.send(JSON.stringify({ close_socket: true }));
        } catch {
          finish(new ServiceUnavailableException('Could not send text to Eleven v4.'));
        }
      });

      socket.addEventListener('message', (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          finish(new BadGatewayException('Eleven v4 returned an unexpected WebSocket message.'));
          return;
        }
        try {
          const message = JSON.parse(event.data) as { audio?: string; is_final?: boolean; error?: string };
          if (message.error) {
            this.logger.error(`Eleven v4 WebSocket error: ${message.error.slice(0, 500)}`);
            finish(new BadGatewayException('Eleven v4 speech synthesis failed.'));
            return;
          }
          if (message.audio) chunks.push(Buffer.from(message.audio, 'base64'));
          if (message.is_final) finish();
        } catch (error) {
          finish(error instanceof Error ? error : new BadGatewayException('Invalid Eleven v4 response.'));
        }
      });

      socket.addEventListener('error', () => {
        finish(new ServiceUnavailableException('Could not connect to the Eleven v4 WebSocket.'));
      });
      socket.addEventListener('close', () => {
        if (!settled) finish(new ServiceUnavailableException('Eleven v4 closed before audio was complete.'));
      });
    });
  }

  private async speechToText(filePath: string): Promise<string> {
    const asrUrl =
      this.config.get<string>('ASR_SERVICE_URL') ??
      'http://127.0.0.1:8001/transcribe';
    const audio = new Uint8Array(fs.readFileSync(filePath));
    const form = new FormData();
    form.append('audio', new Blob([audio]), basename(filePath));

    const response = await fetch(asrUrl, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`ASR service failed (${response.status}): ${details}`);
    }

    const result = (await response.json()) as { transcript?: string };
    if (!result.transcript) {
      throw new Error('ASR service returned an empty transcript');
    }

    return result.transcript;
  }

  private async generateReply(userText: string, personalContext: string): Promise<string> {
    const apiKey = this.getGroqApiKey();
    const model = this.config.get<string>('GROQ_TEXT_MODEL') ?? 'openai/gpt-oss-20b';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: personalContext
              ? `${CARE_CIRCLE_INSTRUCTIONS}\n\n${personalContext}`
              : CARE_CIRCLE_INSTRUCTIONS,
          },
          { role: 'user', content: userText },
        ],
        reasoning_effort: 'low',
        reasoning_format: 'hidden',
        max_completion_tokens: 300,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq GPT-OSS request failed (${response.status}): ${details}`);
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const reply = result.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('Groq GPT-OSS returned an empty reply');
    }

    return reply;
  }

}
