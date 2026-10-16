import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceModule } from './voice/voice.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profiles/profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersModule } from './reminders/reminders.module';
import { FamilyModule } from './family/family.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    ProfileModule,
    RemindersModule,
    FamilyModule,
    VoiceModule,
  ],
})
export class AppModule {}
