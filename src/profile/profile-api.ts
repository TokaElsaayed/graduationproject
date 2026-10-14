import { API_BASE_URL } from '@/config/api';

export interface UserProfile {
  userId: string;
  name: string;
  age: number;
  conditions: string[];
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  scheduleTimes: string[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
  canViewDashboard: boolean;
}

export async function profileRequest<T>(
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
