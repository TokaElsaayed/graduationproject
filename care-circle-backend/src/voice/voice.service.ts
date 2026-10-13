import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import { basename } from 'path';

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
    try {
      const transcript = await this.speechToText(filePath);
      const reply = await this.generateReply(transcript);
      return { transcript, reply };
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        console.warn('Could not delete temporary audio file:', filePath);
      }
    }
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

  private async generateReply(userText: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: 'openai/gpt-oss-20b', // free-tier friendly model
      messages: [
        {
          role: 'system',
          content: `أنت Care Circle، مساعد صوتي هادئ ولطيف لكبار السن في مصر.

القواعد المهمة:
- رد دائماً بالعامية المصرية البسيطة والواضحة.
- استخدم جمل قصيرة وسهلة الفهم.
- لا تعطِ أي تشخيص طبي أبداً.
- لو الشخص طلب طلبية (لبن، عيش، دواء...) أكد الطلب وقول إنك هتساعد.
- لو حس إن الشخص تعبان أو دوخان، انصحه بهدوء يتصل بالعيلة.
- لو مش فاهم كويس، اطلب منه يعيد بهدوء.
- خليك ودود ومحترم زي ابن أو بنت بيتكلم مع والده أو والدته.

أمثلة على الردود:
- "حاضر، عايز لبن؟ هرتبلك الطلب."
- "طب تمام، قولي كمان مرة بهدوء."
- "خد بالك من نفسك، لو حاسس بدوخة كلم حد من العيلة."
`,
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
      "آسف، لم أفهم ما قلته. هل يمكنك أن تعيد ذلك من فضلك؟"
    );
  }
}
