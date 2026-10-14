import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { basename } from 'path';
import { ProfileService } from '../profiles/profile.service';

const CARE_CIRCLE_INSTRUCTIONS = `أنت مساعد Care Circle الصوتي، لطيف وهادئ وبتساعد كبار السن في مصر.
اتكلم  المصرية البسيطة والواضحة، بجمل قصيرة وسهلة.
لا تقدم تشخيصًا أو نصيحة طبية. لو المستخدم حاسس بتعب أو دوخة، شجعه بهدوء إنه يكلم أحد أفراد العائلة.
لو الطلب مش واضح، اطلب منه يعيده بهدوء. خليك ودود ومحترم.`;

@Injectable()
export class VoiceService {
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
