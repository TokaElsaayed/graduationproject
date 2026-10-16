export interface DailyHealthCheck {
  id: string;
  status: 'completed';
  userId: string;
  patientName: string;
  date: string;
  time: string;
  completedAt: string;
  feeling: string;
  sleptWell: string;
  pain: string;
  breakfast: string;
}

export interface DailyHealthCheckInput {
  feeling: 'Fine' | 'Not quite right' | 'Not well at all';
  sleptWell: 'Yes' | 'Somewhat' | 'No';
  pain: 'No' | 'Yes';
  breakfast: 'Yes' | 'Not yet';
}
