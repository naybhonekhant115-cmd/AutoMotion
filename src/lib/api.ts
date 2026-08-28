export function getAuthToken(): string | null {
  return localStorage.getItem('automotion_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('automotion_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('automotion_auth_token');
  localStorage.removeItem('automotion_user');
}

export function getCachedUser(): any | null {
  try {
    const raw = localStorage.getItem('automotion_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: any) {
  localStorage.setItem('automotion_user', JSON.stringify(user));
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers,
  });
}
