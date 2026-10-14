import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profiles/profile.module';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
