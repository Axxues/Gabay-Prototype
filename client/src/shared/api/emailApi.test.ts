import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendActivationEmail, sendRejectionEmail, getEmailApiUrl } from './emailApi';

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

    it('unwraps JSON detail error messages cleanly', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        text: async () => JSON.stringify({ detail: 'Service unavailable: RAG client authentication key is not configured.' }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendActivationEmail({
        email: 'juan@dmmmsu.edu.ph',
        activationUrl: 'http://localhost:5173/activate?token=test-token',
      });

      expect(res.success).toBe(false);
      expect(res.message).toBe('Service unavailable: RAG client authentication key is not configured.');
    });

    it('attaches X-Gabay-Client-Key header when VITE_RAG_CLIENT_KEY is configured', async () => {
      import.meta.env.VITE_RAG_CLIENT_KEY = 'test-secret-key';
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      await sendActivationEmail({
        email: 'juan@dmmmsu.edu.ph',
        activationUrl: 'http://localhost:5173/activate?token=test',
      });

      const [, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
      expect(init.headers['X-Gabay-Client-Key']).toBe('test-secret-key');
      import.meta.env.VITE_RAG_CLIENT_KEY = '';
    });
  });

  describe('sendCourseInvitations', () => {
    it('dispatches course invitations batch to /api/courses/send-course-invitations', async () => {
      const { sendCourseInvitations, getCourseInvitationEmailApiUrl } = await import('./emailApi');
      expect(getCourseInvitationEmailApiUrl()).toBe('http://localhost:8000/api/courses/send-course-invitations');

      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, total: 1, sent: 1, message: 'Invitations dispatched.' }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const invitations = [
        {
          recipientEmail: 's1@dmmmsu.edu.ph',
          recipientName: 'Student One',
          instructorName: 'Prof. Turing',
          courseCode: 'CS 311',
          courseTitle: 'Software Engineering',
          section: 'BSCS 3A',
          term: '1st Sem 2026-2027',
          joinUrl: 'http://localhost:5173/?action=join&courseId=c1&requestId=req-1',
          requestId: 'req-1',
        },
      ];

      const res = await sendCourseInvitations(invitations);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
      expect(url).toBe('http://localhost:8000/api/courses/send-course-invitations');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.invitations).toHaveLength(1);
      expect(body.invitations[0].recipient_email).toBe('s1@dmmmsu.edu.ph');
      expect(body.invitations[0].course_code).toBe('CS 311');
      expect(res.success).toBe(true);
      expect(res.sent).toBe(1);
    });
  });
  describe('sendRejectionEmail', () => {
    it('posts rejection payload with reason to /api/auth/send-rejection-email', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          delivered: true,
          message: 'Rejection notification email dispatched successfully.',
        }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendRejectionEmail({
        email: 'applicant@student.dmmmsu.edu.ph',
        recipientName: 'Juan Applicant',
        reason: 'Identification document is unreadable.',
        reviewerName: 'Dr. Charlie Marzan',
        reviewerRole: 'College Dean',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
      expect(url).toBe('http://localhost:8000/api/auth/send-rejection-email');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.email).toBe('applicant@student.dmmmsu.edu.ph');
      expect(body.recipient_name).toBe('Juan Applicant');
      expect(body.reason).toBe('Identification document is unreadable.');
      expect(body.reviewer_name).toBe('Dr. Charlie Marzan');
      expect(body.reviewer_role).toBe('College Dean');

      expect(res.success).toBe(true);
    });

    it('unwraps JSON detail error messages cleanly on failure', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        text: async () => JSON.stringify({ detail: 'Failed to deliver rejection email: connection refused' }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendRejectionEmail({
        email: 'applicant@student.dmmmsu.edu.ph',
        reason: 'Invalid ID',
      });

      expect(res.success).toBe(false);
      expect(res.message).toBe('Failed to deliver rejection email: connection refused');
    });
  });

});
