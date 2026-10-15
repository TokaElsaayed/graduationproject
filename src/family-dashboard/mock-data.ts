export type CheckInStatus = 'completed' | 'in-progress' | 'not-completed';
export type MockDoseStatus = 'taken' | 'pending' | 'postponed' | 'missed';

export interface HealthCheck {
  id: string;
  date: string;
  time: string;
  status: CheckInStatus;
  feeling?: string;
  sleptWell?: string;
  pain?: string;
  breakfast?: string;
}

export interface DashboardDose {
  id: string;
  medication: string;
  instructions: string;
  time: string;
  status: MockDoseStatus;
  confirmedAt?: string;
}

export interface EmergencyEvent {
  id: string;
  type: string;
  date: string;
  time: string;
  status: 'resolved' | 'review' | 'cancelled';
  notified: boolean;
  location?: string;
  details: string;
}

export interface FamilyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  lastContact: string;
  method: 'Call' | 'Message';
  status: string;
}

export interface DashboardNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  kind: 'medication' | 'check-in' | 'emergency';
}

// Fictional sample data for the caregiver dashboard. Nothing here is live health data.
export const initialCheckIns: HealthCheck[] = [
  { id: 'check-today', date: 'Today', time: '8:15 AM', status: 'completed', feeling: 'Good', sleptWell: 'Yes', pain: 'No', breakfast: 'Yes' },
  { id: 'check-yesterday', date: 'Yesterday', time: '8:32 AM', status: 'completed', feeling: 'Okay', sleptWell: 'Yes', pain: 'A little', breakfast: 'Yes' },
  { id: 'check-two-days', date: 'Monday, Oct 12', time: '—', status: 'not-completed' },
];

export const initialDoses: DashboardDose[] = [
  { id: 'dose-metformin-am', medication: 'Metformin', instructions: '500 mg · with food', time: '9:00 AM', status: 'taken', confirmedAt: '9:08 AM' },
  { id: 'dose-amlodipine', medication: 'Amlodipine', instructions: '5 mg · morning', time: '9:00 AM', status: 'taken', confirmedAt: '9:12 AM' },
  { id: 'dose-metformin-pm', medication: 'Metformin', instructions: '500 mg · with food', time: '9:00 PM', status: 'pending' },
  { id: 'dose-vitamin', medication: 'Vitamin D', instructions: '1000 IU · after lunch', time: '1:00 PM', status: 'postponed' },
  { id: 'dose-evening', medication: 'Amlodipine', instructions: '5 mg · evening', time: '8:00 PM', status: 'missed' },
];

export const initialEmergencies: EmergencyEvent[] = [
  { id: 'event-1', type: 'Wellness check requested', date: 'Oct 13, 2026', time: '6:42 PM', status: 'resolved', notified: true, location: 'Home', details: 'A family member checked in by phone. No further assistance requested.' },
  { id: 'event-2', type: 'Assistance button pressed', date: 'Oct 8, 2026', time: '11:18 AM', status: 'cancelled', notified: true, details: 'The alert was cancelled by the user shortly after it was created.' },
];

export const initialContacts: FamilyContact[] = [
  { id: 'contact-mariam', name: 'Mariam Hassan', relationship: 'Daughter', phone: '+20 100 555 0142', lastContact: 'Today · 10:24 AM', method: 'Call', status: 'Connected' },
  { id: 'contact-omar', name: 'Omar Hassan', relationship: 'Son', phone: '+20 101 555 0187', lastContact: 'Yesterday · 7:16 PM', method: 'Message', status: 'Message delivered' },
];

export const initialNotifications: DashboardNotification[] = [
  { id: 'notification-dose', title: 'Medication dose missed', detail: 'Amlodipine · scheduled for 8:00 PM', time: 'Today · 8:30 PM', read: false, kind: 'medication' },
  { id: 'notification-check', title: 'Health check completed', detail: 'Mahmoud checked in this morning.', time: 'Today · 8:15 AM', read: false, kind: 'check-in' },
  { id: 'notification-emergency', title: 'Emergency event recorded', detail: 'Wellness check requested and resolved.', time: 'Yesterday · 6:42 PM', read: true, kind: 'emergency' },
];

export const upcomingReminders = [
  { id: 'reminder-1', name: 'Metformin', instructions: '500 mg · with food', time: '9:00 PM' },
  { id: 'reminder-2', name: 'Amlodipine', instructions: '5 mg · evening', time: '8:00 PM tomorrow' },
];

export const initialProfile = {
  fullName: 'Mahmoud Hassan',
  age: '74',
  conditions: 'Example profile information',
  language: 'Arabic',
};
