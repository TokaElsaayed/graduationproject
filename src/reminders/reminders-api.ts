import { API_BASE_URL } from '@/config/api';

export type DoseStatus = 'pending' | 'taken' | 'missed';
export type DoseDisplayStatus = 'upcoming' | 'due' | 'taken' | 'missed';

export interface ReminderDose {
  id: string;
  medicationId: string;
  medicationName: string;
  dose: string;
  scheduledAt: string;
  status: DoseStatus;
  displayStatus: DoseDisplayStatus;
  confirmedAt: string | null;
  reminderCount: number;
  reminderText: string;
}

export interface FamilyAlert {
  id: string;
  doseId: string;
  medicationId: string;
  message: string;
  time: string;
  familyMembers: Array<{ id: string; name: string; relationship: string; phone: string }>;
}

export interface DoseLog extends Omit<ReminderDose, 'displayStatus' | 'reminderText'> {}

export async function reminderRequest<T>(
  token: string,
  path: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({})) as {
    message?: string | string[];
  } & T;
  if (!response.ok) {
    const message = Array.isArray(result.message) ? result.message.join(' ') : result.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  return result;
}

export function cairoTime(isoDate: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}
