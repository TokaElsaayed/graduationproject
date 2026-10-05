import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import * as fs from 'fs';

@Injectable()
export class VoiceService {
  private groq: Groq;

  constructor(private config: ConfigService) {
    this.groq = new Groq({
      apiKey: this.config.get<string>('GROQ_API_KEY'),
    });
  }

  async processAudio(filePath: string): Promise<{
    transcript: string;
    reply: string;
  }> {
    // 1. Convert speech to text
    const transcript = await this.speechToText(filePath);

    // 2. Generate reply from the text
    const reply = await this.generateReply(transcript);

    // 3. Delete the temporary audio file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('Could not delete temp file:', filePath);
    }

    return { transcript, reply };
  }

  private async speechToText(filePath: string): Promise<string> {
    const transcription = await this.groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3-turbo',
      language: 'en', // change to 'ar' later for Arabic
    });

    return transcription.text;
  }

  private async generateReply(userText: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: 'openai/gpt-oss-20b', // free-tier friendly model
      messages: [
        {
          role: 'system',
          content: `You are Care Circle, a calm and helpful voice assistant for elderly people.
- Reply in short, clear sentences.
- Never give medical diagnoses.
- If the user wants to order something, just confirm and say you will help.
- If they sound unwell, gently suggest contacting family.
- Reply in the same language the user used.`,
        },
        {
          role: 'user',
          content: userText,
        },
      ],
      max_tokens: 150,
      temperature: 0.6,
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      "I'm sorry, I didn't catch that. Can you please say it again?"
    );
  }
}