import {
  Controller,
  Body,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VoiceService } from './voice.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ProfileService } from '../profiles/profile.service';

@Controller('voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly profiles: ProfileService,
  ) {}

  @Post('speak')
  async speak(@Body() body: { text?: unknown }): Promise<StreamableFile> {
    if (typeof body?.text !== 'string') {
      throw new BadRequestException('Text is required.');
    }
    const audio = await this.voiceService.synthesizeSpeech(body.text);
    const contentType = this.voiceService.getSpeechContentType();
    const extension = contentType === 'audio/wav' ? 'wav' : 'mp3';
    return new StreamableFile(audio, {
      type: contentType,
      disposition: `inline; filename="care-circle.${extension}"`,
    });
  }

  @Post('process')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('audio/')) {
          return cb(new BadRequestException('Only audio files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async processVoice(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    this.profiles.getProfile(request.user.id, request.user.fullName);
    const result = await this.voiceService.processAudio(file.path, request.user.id);
    return result;
  }
}
