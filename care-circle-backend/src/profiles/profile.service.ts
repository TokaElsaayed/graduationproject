import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContactsRepository,
  MedicationsRepository,
  UsersRepository,
} from './profile.repositories';
import type {
  ElderlyProfile,
  EmergencyContact,
  Medication,
} from './profile.types';
import type {
  EmergencyContactDto,
  MedicationDto,
  UpdateEmergencyContactDto,
  UpdateMedicationDto,
  UpdateProfileDto,
} from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersRepository,
    private readonly medications: MedicationsRepository,
    private readonly contacts: ContactsRepository,
  ) {}

  getProfile(userId: string, fallbackName: string): ElderlyProfile {
    return this.users.find(userId) ?? this.users.save({
      userId,
      name: fallbackName,
      age: 65,
      conditions: [],
    });
  }

  updateProfile(userId: string, fallbackName: string, changes: UpdateProfileDto): ElderlyProfile {
    return this.users.save({ ...this.getProfile(userId, fallbackName), ...changes });
  }

  listMedications(userId: string): Medication[] {
    return this.medications.findByUser(userId);
  }

  addMedication(userId: string, input: MedicationDto): Medication {
    return this.medications.create(userId, input);
  }

  updateMedication(userId: string, id: string, changes: UpdateMedicationDto): Medication {
    const item = this.medications.find(userId, id);
    if (!item) throw new NotFoundException('Medication not found.');
    return this.medications.save({ ...item, ...changes });
  }

  removeMedication(userId: string, id: string): { deleted: true } {
    if (!this.medications.delete(userId, id)) throw new NotFoundException('Medication not found.');
    return { deleted: true };
  }

  listContacts(userId: string): EmergencyContact[] {
    return this.contacts.findByUser(userId);
  }

  addContact(userId: string, input: EmergencyContactDto): EmergencyContact {
    if (input.isPrimary) this.clearPrimaryContact(userId);
    return this.contacts.create(userId, input);
  }

  updateContact(userId: string, id: string, changes: UpdateEmergencyContactDto): EmergencyContact {
    const item = this.contacts.find(userId, id);
    if (!item) throw new NotFoundException('Emergency contact not found.');
    if (changes.isPrimary) this.clearPrimaryContact(userId);
    return this.contacts.save({ ...item, ...changes });
  }

  removeContact(userId: string, id: string): { deleted: true } {
    if (!this.contacts.delete(userId, id)) throw new NotFoundException('Emergency contact not found.');
    return { deleted: true };
  }

  buildPersonalContext(userId: string): string {
    const profile = this.users.find(userId);
    if (!profile) return '';
    const medications = this.medications.findByUser(userId);
    const details = [
      `اسم المستخدم: ${profile.name}`,
      `السن: ${profile.age}`,
      profile.conditions.length ? `حالات صحية أبلغ عنها المستخدم: ${profile.conditions.join('، ')}` : '',
      medications.length
        ? `أدوية مسجلة (للتذكير بالسياق فقط): ${medications.map((item) => `${item.name}، ${item.dose}، ${item.scheduleTimes.join(' و ')}`).join('؛ ')}`
        : '',
    ].filter(Boolean);

    return `معلومات شخصية مختصرة عن المستخدم:\n${details.join('\n')}\nلا تشخّص ولا تغيّر أو تقترح جرعات دواء. استخدم المعلومات عند صلتها بالسؤال فقط، ووجّه المستخدم للطبيب أو للطوارئ عند الحاجة.`;
  }

  private clearPrimaryContact(userId: string): void {
    for (const contact of this.contacts.findByUser(userId)) {
      if (contact.isPrimary) this.contacts.save({ ...contact, isPrimary: false });
    }
  }
}
