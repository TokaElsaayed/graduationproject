const TOKEN_KEY = 'care-circle-session-token';

export async function readToken(): Promise<string | null> {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
}
