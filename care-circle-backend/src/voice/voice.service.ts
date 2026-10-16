import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { basename } from 'path';
import { ProfileService } from '../profiles/profile.service';

const CARE_CIRCLE_INSTRUCTIONS = `You are the Care Circle voice assistant. Be warm, calm, respectful, and concise for older adults.
Reply in the same language as the user's transcript. If the transcript is English, answer in natural, simple English. If it is Arabic, answer in simple Egyptian Arabic. Do not translate the user's words unless asked.
Do not diagnose or give medical advice. If the user says they feel tired or dizzy, gently suggest contacting a family member. If the request is unclear, ask a short clarifying question.`;

export interface VoiceEmotion {
  label: 'happy' | 'sad' | 'angry' | 'neutral' | 'uncertain';
  confidence: number;
}

interface SpeechResult {
  transcript: string;
  emotion: VoiceEmotion;
}

@Injectable()
export class VoiceService {
  constructor(
    private readonly config: ConfigService,
    private readonly profiles: ProfileService,
  ) {}

  async processAudio(filePath: string, userId: string): Promise<{
    transcript: string;
    reply: string;
    emotion: VoiceEmotion;
  }> {
    try {
      const { transcript, emotion } = await this.speechToText(filePath);
      const context = this.profiles.buildPersonalContext(userId);
      const reply = await this.generateReply(transcript, context, emotion);
      return { transcript, reply, emotion };
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

  private async speechToText(filePath: string): Promise<SpeechResult> {
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

    const result = (await response.json()) as {
      transcript?: string;
      emotion?: VoiceEmotion;
    };
    if (!result.transcript) {
      throw new Error('ASR service returned an empty transcript');
    }
    if (!result.emotion) {
      throw new Error('ASR service did not return a voice tone estimate');
    }

    return { transcript: result.transcript, emotion: result.emotion };
  }

  private async generateReply(
    userText: string,
    personalContext: string,
    emotion: VoiceEmotion,
  ): Promise<string> {
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
          {
            role: 'system',
            content: `An audio model estimates the speaker's vocal tone as ${emotion.label} with score ${emotion.confidence.toFixed(2)}. This is an uncertain signal, not a fact about their feelings, personality, or health. Respond to what the person said first. When the estimate is at least 0.40, gently reflect the predicted tone if useful (happy, sad, angry, or neutral), while clearly treating it as uncertain. The app will separately ask whether they want to call family, so do not repeat that offer. Never initiate a call. Do not infer tiredness, well-being, or any health condition from voice tone. Use the same language as the transcript: English transcript means English reply; Arabic transcript means Egyptian Arabic reply. Keep the response brief.`,
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
