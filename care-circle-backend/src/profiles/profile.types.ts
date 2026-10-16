export interface ElderlyProfile {
  userId: string;
  name: string;
  age: number;
  conditions: string[];
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dose: string;
  scheduleTimes: string[];
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
  canViewDashboard: boolean;
}

export interface ProfileSeed {
  profiles: ElderlyProfile[];
  medications: Medication[];
  contacts: EmergencyContact[];
  caregiverLinks: CaregiverLink[];
}

export interface CaregiverLink {
  caregiverUserId: string;
  olderAdultUserId: string;
}
