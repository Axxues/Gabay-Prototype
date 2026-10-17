import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendRagMessage, getRagApiUrl, fetchRagProgress } from './rag';

describe('RAG API client (FastAPI standalone)', () => {
  const originalEnv = import.meta.env.VITE_RAG_API_URL;

  beforeEach(() => {
    vi.unstubAllGlobals();
    import.meta.env.VITE_RAG_API_URL = '';
  });

  afterEach(() => {
    import.meta.env.VITE_RAG_API_URL = originalEnv;
  });

  describe('getRagApiUrl', () => {
    it('defaults to http://localhost:8000/api/chat when VITE_RAG_API_URL is unset', () => {
      import.meta.env.VITE_RAG_API_URL = '';
      expect(getRagApiUrl()).toBe('http://localhost:8000/api/chat');
    });

    it('uses configured VITE_RAG_API_URL and trims trailing slashes', () => {
      import.meta.env.VITE_RAG_API_URL = 'https://rag.gabay-university.edu.ph/';
      expect(getRagApiUrl()).toBe('https://rag.gabay-university.edu.ph/api/chat');
    });
  });

  describe('sendRagMessage', () => {
    it('posts message, student_name, active_course, and history to FastAPI /api/chat', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          reply: 'Hello Alex, the prerequisite is CS101. [CS Handbook]',
          category: 'curriculum_and_instruction',
          sources: [
            { title: 'CS Handbook', source: 'CS Curriculum Section 2' },
          ],
        }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendRagMessage('What is the prerequisite?', {
        sessionId: 'sess-123',
        student_name: 'Alex Mercer',
        active_course: 'CMSC131',
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello! How can I help?' },
        ],
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
      expect(url).toBe('http://localhost:8000/api/chat');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body);
      expect(body.message).toBe('What is the prerequisite?');
      expect(body.student_name).toBe('Alex Mercer');
      expect(body.active_course).toBe('CMSC131');
      expect(body.history).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello! How can I help?' },
      ]);

      expect(res.reply).toBe('Hello Alex, the prerequisite is CS101. [CS Handbook]');
      expect(res.category).toBe('curriculum_and_instruction');
      expect(res.sessionId).toBe('sess-123');
      expect(res.sources).toEqual([
        { label: 'CS Handbook', detail: 'CS Curriculum Section 2' },
      ]);
    });

    it('falls back to string sessionId parameter for backward compatibility', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          reply: 'Response text',
          category: 'student_support',
          sources: [{ source: 'General Guidelines' }],
        }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await sendRagMessage('Hello', 'legacy-session-99');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
      const body = JSON.parse(init.body);
      expect(body.message).toBe('Hello');
      expect(body.student_name).toBeUndefined();
      expect(body.active_course).toBeUndefined();
      expect(res.sessionId).toBe('legacy-session-99');
      expect(res.sources[0]).toEqual({
        label: 'General Guidelines',
        detail: 'General Guidelines',
      });
    });

    it('throws error when response is not ok', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Service pipeline failure',
      }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        sendRagMessage('Trigger failure', 'session-err')
      ).rejects.toThrow(/RAG API request failed \(500\)/);
    });
  });

  describe('fetchRagProgress', () => {
    it('returns null execution', async () => {
      const res = await fetchRagProgress('session-xyz');
      expect(res).toEqual({ execution: null });
    });
  });
});
