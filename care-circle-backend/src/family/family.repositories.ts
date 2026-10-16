import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DailyHealthCheck, DailyHealthCheckInput } from './family.types';

@Injectable()
export class HealthChecksRepository {
  private readonly records: DailyHealthCheck[] = [];

  findByUser(userId: string): DailyHealthCheck[] {
    return this.records
      .filter((record) => record.userId === userId)
      .map((record) => ({ ...record }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  create(userId: string, patientName: string, input: DailyHealthCheckInput): DailyHealthCheck {
    const completedAt = new Date().toISOString();
    const record: DailyHealthCheck = {
      id: randomUUID(),
      status: 'completed',
      userId,
      patientName,
      date: new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(completedAt)),
      time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(completedAt)),
      completedAt,
      ...input,
    };
    this.records.unshift(record);
    return { ...record };
  }
}
