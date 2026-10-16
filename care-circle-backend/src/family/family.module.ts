import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profiles/profile.module';
import { RemindersModule } from '../reminders/reminders.module';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import { HealthChecksRepository } from './family.repositories';

@Module({
  imports: [AuthModule, ProfileModule, RemindersModule],
  controllers: [FamilyController],
  providers: [FamilyService, HealthChecksRepository],
})
export class FamilyModule {}
