import { describe, it, expect } from 'vitest';
import { testLikhaConnection, getLikhaAdminToken, getLikhaAdminClient } from './client.js';

describe('Likha ERP Client Integration', () => {
  it('connects to Likha ERP server endpoint', async () => {
    const isConnected = await testLikhaConnection();
    expect(isConnected).toBe(true);
  });

  it('authenticates admin service account and retrieves a valid JWT token', async () => {
    const token = await getLikhaAdminToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('initializes authenticated Likha SDK admin client', async () => {
    const client = await getLikhaAdminClient();
    expect(client).toBeDefined();
    expect(typeof client.request).toBe('function');
  });
});
