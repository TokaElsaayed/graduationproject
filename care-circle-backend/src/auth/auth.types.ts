export type AccountRole = 'caregiver' | 'older_adult';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: AccountRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthTokenPayload extends AuthUser {
  iat: number;
  exp: number;
}
