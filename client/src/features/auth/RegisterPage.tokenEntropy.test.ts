import { describe, it, expect } from 'vitest';
import { generateSecureActivationToken } from '../../shared/utils/cryptoToken';

describe('Activation token generation entropy', () => {
  it('generates a 64-character hex string with high entropy', () => {
    const t1 = generateSecureActivationToken();
    const t2 = generateSecureActivationToken();
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t2).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).not.toBe(t2);
  });
});
