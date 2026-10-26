export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = 'gabay_token';
const REFRESH_TOKEN_KEY = 'gabay_refresh_token';

function safeSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  try {
    const session = safeSessionStorage();
    const token = session?.getItem(TOKEN_KEY);
    if (token) return token;
    const local = safeLocalStorage();
    return local?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setToken(token: string, persist?: boolean): void {
  try {
    const session = safeSessionStorage();
    const local = safeLocalStorage();
    const shouldPersist = persist ?? Boolean(local?.getItem(TOKEN_KEY) && !session?.getItem(TOKEN_KEY));
    if (shouldPersist && local) {
      local.setItem(TOKEN_KEY, token);
      session?.removeItem(TOKEN_KEY);
    } else if (session) {
      session.setItem(TOKEN_KEY, token);
      local?.removeItem(TOKEN_KEY);
    } else if (local) {
      local.setItem(TOKEN_KEY, token);
    }
  } catch {}
}

export function getRefreshToken(): string | null {
  try {
    const session = safeSessionStorage();
    const token = session?.getItem(REFRESH_TOKEN_KEY);
    if (token) return token;
    const local = safeLocalStorage();
    return local?.getItem(REFRESH_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setRefreshToken(refreshToken: string, persist?: boolean): void {
  try {
    const session = safeSessionStorage();
    const local = safeLocalStorage();
    const shouldPersist = persist ?? Boolean(local?.getItem(REFRESH_TOKEN_KEY) && !session?.getItem(REFRESH_TOKEN_KEY));
    if (shouldPersist && local) {
      local.setItem(REFRESH_TOKEN_KEY, refreshToken);
      session?.removeItem(REFRESH_TOKEN_KEY);
    } else if (session) {
      session.setItem(REFRESH_TOKEN_KEY, refreshToken);
      local?.removeItem(REFRESH_TOKEN_KEY);
    } else if (local) {
      local.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {}
}

export function clearToken(): void {
  try {
    safeSessionStorage()?.removeItem(TOKEN_KEY);
    safeSessionStorage()?.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
  try {
    safeLocalStorage()?.removeItem(TOKEN_KEY);
    safeLocalStorage()?.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export const SESSION_EXPIRED_EVENT = 'gabay:session-expired';

export function notifySessionExpired(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  } else if (typeof globalThis !== 'undefined' && typeof (globalThis as any).dispatchEvent === 'function') {
    (globalThis as any).dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

interface ApiOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && token && !path.includes('/auth/login')) {
    clearToken();
    notifySessionExpired();
  }
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | T;
  if (!res.ok || (data && typeof data === 'object' && 'error' in (data as object))) {
    const err = (data as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(res.status, err?.code || 'request_failed', err?.message || `Request failed (${res.status}).`);
  }
  return data as T;
}

export { likhaLmsApi, LIKHA_URL } from './likhaLmsApi';
