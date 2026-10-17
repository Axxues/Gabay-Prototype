import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendActivationEmail, getEmailApiUrl } from './emailApi';

describe('emailApi client', () => {
  const originalEnv = import.meta.env.VITE_RAG_API_URL;

  beforeEach(() => {
    vi.unstubAllGlobals();
    import.meta.env.VITE_RAG_API_URL = '';
  });

  afterEach(() => {
    import.meta.env.VITE_RAG_API_URL = originalEnv;
  });

  describe('getEmailApiUrl', () => {
    it('defaults to http://localhost:8000/api/auth/send-activation-email when VITE_RAG_API_URL is unset', () => {
      import.meta.env.VITE_RAG_API_URL = '';
      expect(getEmailApiUrl()).toBe('http://localhost:8000/api/auth/send-activation-email');
    });

    it('uses configured VITE_RAG_API_URL without trailing slashes', () => {
      import.meta.env.VITE_RAG_API_URL = 'https://rag.gabay.edu.ph/';
      expect(getEmailApiUrl()).toBe('https://rag.gabay.edu.ph/api/auth/send-activation-email');
    });
  });

  describe('sendActivationEmail', () => {
    it('posts email payload to the activation email endpoint', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          delivered: true,
          message: 'Activation email dispatched successfully.',
        }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendActivationEmail({
        email: 'juan@dmmmsu.edu.ph',
        recipientName: 'Juan Dela Cruz',
        activationUrl: 'http://localhost:5173/activate?token=test-token',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
      expect(url).toBe('http://localhost:8000/api/auth/send-activation-email');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body);
      expect(body.email).toBe('juan@dmmmsu.edu.ph');
      expect(body.recipient_name).toBe('Juan Dela Cruz');
      expect(body.activation_url).toBe('http://localhost:5173/activate?token=test-token');

      expect(res.success).toBe(true);
      expect(res.message).toBe('Activation email dispatched successfully.');
    });

    it('returns graceful failure object on network or API error', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        text: async () => 'Internal server error',
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendActivationEmail({
        email: 'juan@dmmmsu.edu.ph',
        recipientName: 'Juan Dela Cruz',
        activationUrl: 'http://localhost:5173/activate?token=test-token',
      });

      expect(res.success).toBe(false);
      expect(res.message).toBe('Internal server error');
    });
  });
});
