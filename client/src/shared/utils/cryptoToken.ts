export function generateSecureActivationToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    const nodeCrypto = (globalThis as any).crypto;
    nodeCrypto.getRandomValues(bytes);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
