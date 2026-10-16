import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PROFILE_SEED } from './profile.seed';
import type { CaregiverLink, ElderlyProfile, EmergencyContact, Medication } from './profile.types';

@Injectable()
export class CaregiverLinksRepository {
  private readonly records = new Map<string, CaregiverLink>(
    PROFILE_SEED.caregiverLinks.map((link) => [link.caregiverUserId, { ...link }]),
  );

  findOlderAdultId(caregiverUserId: string): string | undefined {
    return this.records.get(caregiverUserId)?.olderAdultUserId;
  }
}

@Injectable()
export class UsersRepository {
  private readonly records = new Map(
    PROFILE_SEED.profiles.map((profile) => [profile.userId, { ...profile, conditions: [...profile.conditions] }]),
  );

  find(userId: string): ElderlyProfile | undefined {
    const profile = this.records.get(userId);
    return profile ? { ...profile, conditions: [...profile.conditions] } : undefined;
  }

  save(profile: ElderlyProfile): ElderlyProfile {
    const stored = { ...profile, conditions: [...profile.conditions] };
    this.records.set(profile.userId, stored);
    return { ...stored, conditions: [...stored.conditions] };
  }
}

@Injectable()
export class MedicationsRepository {
  private readonly records = new Map(
    PROFILE_SEED.medications.map((medication) => [medication.id, { ...medication, scheduleTimes: [...medication.scheduleTimes] }]),
  );

  findByUser(userId: string): Medication[] {
    return [...this.records.values()]
      .filter((item) => item.userId === userId)
      .map((item) => ({ ...item, scheduleTimes: [...item.scheduleTimes] }));
  }

  findAll(): Medication[] {
    return [...this.records.values()].map((item) => ({
      ...item,
      scheduleTimes: [...item.scheduleTimes],
    }));
  }

  findById(id: string): Medication | undefined {
    const item = this.records.get(id);
    return item ? { ...item, scheduleTimes: [...item.scheduleTimes] } : undefined;
  }

  find(userId: string, id: string): Medication | undefined {
    const item = this.records.get(id);
    return item?.userId === userId ? { ...item, scheduleTimes: [...item.scheduleTimes] } : undefined;
  }

  create(userId: string, input: Omit<Medication, 'id' | 'userId'>): Medication {
    const item = { id: randomUUID(), userId, ...input, scheduleTimes: [...input.scheduleTimes] };
    this.records.set(item.id, item);
    return { ...item, scheduleTimes: [...item.scheduleTimes] };
  }

  save(item: Medication): Medication {
    const stored = { ...item, scheduleTimes: [...item.scheduleTimes] };
    this.records.set(item.id, stored);
    return { ...stored, scheduleTimes: [...stored.scheduleTimes] };
  }

  delete(userId: string, id: string): boolean {
    return this.find(userId, id) ? this.records.delete(id) : false;
  }
}

@Injectable()
export class ContactsRepository {
  private readonly records = new Map(
    PROFILE_SEED.contacts.map((contact) => [contact.id, { ...contact }]),
  );

  findByUser(userId: string): EmergencyContact[] {
    return [...this.records.values()]
      .filter((item) => item.userId === userId)
      .map((item) => ({ ...item }));
  }

  find(userId: string, id: string): EmergencyContact | undefined {
    const item = this.records.get(id);
    return item?.userId === userId ? { ...item } : undefined;
  }

  create(userId: string, input: Omit<EmergencyContact, 'id' | 'userId'>): EmergencyContact {
    const item = { id: randomUUID(), userId, ...input };
    this.records.set(item.id, item);
    return { ...item };
  }

  save(item: EmergencyContact): EmergencyContact {
    const stored = { ...item };
    this.records.set(item.id, stored);
    return { ...stored };
  }

  delete(userId: string, id: string): boolean {
    return this.find(userId, id) ? this.records.delete(id) : false;
  }
}
