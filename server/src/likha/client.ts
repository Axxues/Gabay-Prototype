import { createLikha, authentication, rest, staticToken } from '@likha-erp/likha-sdk';
import { LIKHA_URL, LIKHA_ADMIN_EMAIL, LIKHA_ADMIN_PASSWORD } from '../env.js';

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt: number = 0;

/**
 * Retrieves a valid Admin Bearer token for server-to-server operations.
 * Caches the token until near expiration.
 */
export async function getLikhaAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt) {
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
  const ttlMs = (json.data?.expires || 900) * 1000;
  // Expire 60 seconds early to avoid race conditions
  adminTokenExpiresAt = now + Math.max(ttlMs - 60000, 30000);

  return cachedAdminToken;
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
