import type { ProfileSeed } from './profile.types';

export const PROFILE_SEED: ProfileSeed = {
  profiles: [
    {
      userId: 'demo-older-adult-001',
      name: 'Mahmoud Hassan',
      age: 72,
      conditions: ['ارتفاع ضغط الدم', 'السكري من النوع الثاني'],
    },
  ],
  medications: [
    {
      id: 'med-demo-001',
      userId: 'demo-older-adult-001',
      name: 'Metformin',
      dose: '500 mg',
      scheduleTimes: ['09:00', '21:00'],
    },
    {
      id: 'med-demo-002',
      userId: 'demo-older-adult-001',
      name: 'Amlodipine',
      dose: '5 mg',
      scheduleTimes: ['09:00'],
    },
  ],
  contacts: [
    {
      id: 'contact-demo-001',
      userId: 'demo-older-adult-001',
      name: 'Mariam Hassan',
      relationship: 'بنتي',
      phone: '+201000000001',
      isPrimary: true,
      canViewDashboard: true,
    },
  ],
};
