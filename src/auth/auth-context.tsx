import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/api';
import { clearToken, saveToken } from '@/auth/token-storage';

export type AccountRole = 'caregiver' | 'older_adult';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: AccountRole;
}

interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  logIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    role: AccountRole;
  }) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function request<T>(path: string, body?: object, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
  } & T;

  if (!response.ok) {
    const message = Array.isArray(result.message)
      ? result.message.join(' ')
      : result.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  return result;
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Require a fresh sign-in on each app launch so the older adult daily-care
    // flow always starts from the login screen.
    void clearToken().catch(() => undefined).finally(() => {
      if (active) setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function acceptAuthResult(result: AuthResult) {
    await saveToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
  }

  async function logIn(email: string, password: string): Promise<AuthUser> {
    const result = await request<AuthResult>('/auth/login', { email, password });
    await acceptAuthResult(result);
    return result.user;
  }

  async function signUp(input: {
    fullName: string;
    email: string;
    password: string;
    role: AccountRole;
  }) {
    const result = await request<AuthResult>('/auth/signup', input);
    await acceptAuthResult(result);
  }

  async function logOut() {
    await clearToken();
    setToken(null);
    setUser(null);
  }

  const value: AuthContextValue = { token, user, isReady, logIn, signUp, logOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
