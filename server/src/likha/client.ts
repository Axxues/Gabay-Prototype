import { createLikha, authentication, rest, staticToken } from '@likha-erp/likha-sdk';
import { LIKHA_URL, LIKHA_ADMIN_EMAIL, LIKHA_ADMIN_PASSWORD } from '../env.js';

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt: number = 0;

export function invalidateAdminToken(): void {
  cachedAdminToken = null;
  adminTokenExpiresAt = 0;
}

/**
 * Retrieves a valid Admin Bearer token for server-to-server operations.
 * Caches the token until near expiration.
 */
export async function getLikhaAdminToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedAdminToken && now < adminTokenExpiresAt) {
    return cachedAdminToken;
  }

  const res = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: LIKHA_ADMIN_EMAIL,
      password: LIKHA_ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Likha ERP Admin Authentication Failed (HTTP ${res.status}): ${errorText}`);
  }

  const json = (await res.json()) as {
    data?: {
      access_token?: string;
      expires?: number;
      refresh_token?: string;
    };
  };

  const token = json.data?.access_token;
  if (!token) {
    throw new Error('Likha ERP login succeeded but did not return access_token');
  }

  cachedAdminToken = token;
  const rawExpires = json.data?.expires || 900000;
  // If rawExpires > 10000, it's already in milliseconds (Directus returns ms, e.g. 900000 = 15min)
  const ttlMs = rawExpires > 10000 ? rawExpires : rawExpires * 1000;
  // Expire 60 seconds early to avoid race conditions
  adminTokenExpiresAt = now + Math.max(ttlMs - 60000, 30000);

  return cachedAdminToken;
}

/**
 * Performs a fetch against Likha ERP with the admin Bearer token.
 * If a 401 is encountered (e.g. token expired), it transparently refreshes
 * the admin token and retries once.
 */
export async function likhaFetch(urlPath: string, init: RequestInit = {}): Promise<Response> {
  let token = await getLikhaAdminToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const fullUrl = urlPath.startsWith('http') ? urlPath : `${LIKHA_URL}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
  let res = await fetch(fullUrl, { ...init, headers });

  if (res.status === 401) {
    token = await getLikhaAdminToken(true);
    headers.set('Authorization', `Bearer ${token}`);
    res = await fetch(fullUrl, { ...init, headers });
  }

  return res;
}

/**
 * Creates an authenticated Likha SDK client configured with the Admin token.
 */
export async function getLikhaAdminClient() {
  const token = await getLikhaAdminToken();
  return createLikha(LIKHA_URL).with(staticToken(token)).with(rest());
}

/**
 * Creates a Likha SDK client for a specific user bearer token.
 */
export function createLikhaUserClient(token: string) {
  return createLikha(LIKHA_URL).with(staticToken(token)).with(rest());
}

/**
 * Tests connectivity to the Likha ERP instance.
 */
export async function testLikhaConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${LIKHA_URL}/server/ping`);
    return res.ok;
  } catch {
    return false;
  }
}
