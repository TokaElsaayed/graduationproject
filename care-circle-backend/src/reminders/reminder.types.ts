export type DoseStatus = 'pending' | 'taken' | 'missed';
export type ConfirmationValue = boolean | 'unclear';

export interface Dose {
  id: string;
  userId: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseStatus;
  confirmedAt: string | null;
  reminderCount: number;
}

export interface ReminderDose extends Dose {
  medicationName: string;
  dose: string;
  reminderText: string;
  displayStatus: 'upcoming' | 'due' | 'taken' | 'missed';
}

export interface FamilyAlert {
  id: string;
  userId: string;
  doseId: string;
  medicationId: string;
  message: string;
  time: string;
  familyMembers: Array<{ id: string; name: string; relationship: string; phone: string }>;
}
