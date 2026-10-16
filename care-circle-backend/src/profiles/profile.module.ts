import { Module } from '@nestjs/common';
import { forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RemindersModule } from '../reminders/reminders.module';
import { ProfileController } from './profile.controller';
import {
  CaregiverLinksRepository,
  ContactsRepository,
  MedicationsRepository,
  UsersRepository,
} from './profile.repositories';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule, forwardRef(() => RemindersModule)],
  controllers: [ProfileController],
  providers: [ProfileService, UsersRepository, MedicationsRepository, ContactsRepository, CaregiverLinksRepository],
  exports: [ProfileService, UsersRepository, MedicationsRepository, ContactsRepository, CaregiverLinksRepository],
})
export class ProfileModule {}
