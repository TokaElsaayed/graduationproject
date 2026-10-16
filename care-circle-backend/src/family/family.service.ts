import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import {
  CaregiverLinksRepository,
  ContactsRepository,
  MedicationsRepository,
  UsersRepository,
} from '../profiles/profile.repositories';
import { RemindersService } from '../reminders/reminders.service';
import type { DailyHealthCheckDto } from './family.dto';
import { HealthChecksRepository } from './family.repositories';

@Injectable()
export class FamilyService {
  constructor(
    private readonly links: CaregiverLinksRepository,
    private readonly users: UsersRepository,
    private readonly medications: MedicationsRepository,
    private readonly contacts: ContactsRepository,
    private readonly reminders: RemindersService,
    private readonly healthChecks: HealthChecksRepository,
  ) {}

  getOverview(caregiver: AuthUser) {
    if (caregiver.role !== 'caregiver') throw new ForbiddenException('Caregiver access is required.');
    const olderAdultId = this.links.findOlderAdultId(caregiver.id);
    if (!olderAdultId) throw new NotFoundException('No older-adult profile is linked to this caregiver.');
    const profile = this.users.find(olderAdultId);
    if (!profile) throw new NotFoundException('The linked older-adult profile was not found.');

    return {
      profile,
      medications: this.medications.findByUser(olderAdultId),
      contacts: this.contacts.findByUser(olderAdultId),
      today: this.reminders.getToday(olderAdultId),
      history: this.reminders.getLog(olderAdultId),
      alerts: this.reminders.getFamilyAlerts(olderAdultId),
      healthChecks: this.healthChecks.findByUser(olderAdultId),
    };
  }

  submitHealthCheck(user: AuthUser, input: DailyHealthCheckDto) {
    if (user.role !== 'older_adult') throw new ForbiddenException('Only older-adult accounts can submit a health check.');
    const profile = this.users.find(user.id);
    if (!profile) throw new NotFoundException('Older-adult profile not found.');
    return this.healthChecks.create(user.id, profile.name, input);
  }
}
