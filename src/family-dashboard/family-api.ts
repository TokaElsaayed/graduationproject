import { profileRequest } from '@/profile/profile-api';

export interface FamilyMedication {
  id: string;
  name: string;
  dose: string;
  scheduleTimes: string[];
}

export interface FamilyDose {
  id: string;
  medicationId: string;
  medicationName: string;
  dose: string;
  scheduledAt: string;
  status: 'pending' | 'taken' | 'missed';
  displayStatus: 'upcoming' | 'due' | 'taken' | 'missed';
  confirmedAt: string | null;
  reminderCount: number;
  reminderText: string;
}

export interface FamilyOverview {
  profile: {
    userId: string;
    name: string;
    age: number;
    conditions: string[];
  };
  medications: FamilyMedication[];
  contacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    isPrimary: boolean;
    canViewDashboard: boolean;
  }>;
  today: FamilyDose[];
  history: FamilyDose[];
  alerts: Array<{ id: string; message: string; time: string }>;
  healthChecks: Array<{
    id: string;
    status: 'completed';
    patientName: string;
    date: string;
    time: string;
    completedAt: string;
    feeling: string;
    sleptWell: string;
    pain: string;
    breakfast: string;
  }>;
}

export function getFamilyOverview(token: string): Promise<FamilyOverview> {
  return profileRequest<FamilyOverview>(token, '/family/overview');
}
