// server/src/routes/ragBaseline.test.ts - proxy POST /api/rag-baseline/chat -> baseline n8n webhook
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import jwt from 'jsonwebtoken';
import express from 'express';
import { ragBaselineRouter } from './ragBaseline.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/rag-baseline', ragBaselineRouter);
  a.use(errorMiddleware);
  return a;
}

describe('rag-baseline router', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'STU-2024-001',
      role: 'student',
    });
    process.env.N8N_BASELINE_WEBHOOK_URL =
      'http://localhost:5678/webhook/gabay-baseline-rag';
  });

  afterEach(() => {
    (globalThis as { fetch?: unknown }).fetch = realFetch;
    delete process.env.N8N_BASELINE_WEBHOOK_URL;
  });

  it('401s without token', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag-baseline/chat')
      .send({ message: 'hi' });

    expect(res.status).toBe(401);
  });

  it('rejects empty message (400 bad_request)', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag-baseline/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('returns 502 rag_unavailable when N8N_BASELINE_WEBHOOK_URL is unset', async () => {
    delete process.env.N8N_BASELINE_WEBHOOK_URL;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag-baseline/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'hi' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('rag_unavailable');
  });

  it('forwards to baseline webhook with student suffix and default session', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: 'Hello from baseline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag-baseline/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'What is enrollment?' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:5678/webhook/gabay-baseline-rag');
    const body = JSON.parse(String((init as { body?: string }).body)) as Record<string, unknown>;
    expect(body.chatInput).toBe('What is enrollment? (My student ID is STU-2024-001.)');
    expect(body.sessionId).toBe('default-session');
    expect(body.requesterToken).toBe('test-token');
    expect(res.body.reply).toBe('Hello from baseline');
    expect(res.body.sessionId).toBe('default-session');
  });

  it('redacts JWT-shaped strings from the visible reply', async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdHVkZW50LTIifQ.signature';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: `Leaked token: ${token}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag-baseline/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Show my grades', sessionId: 'redact-baseline' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Leaked token: [redacted token]');
  });

  it('provides live progress endpoint GET /api/rag-baseline/progress/:sessionId', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .get('/api/rag-baseline/progress/session-live-test')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('execution');
  });
});
