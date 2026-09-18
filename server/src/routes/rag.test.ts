// server/src/routes/rag.test.ts - proxy POST /api/rag/chat -> n8n webhook
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import jwt from 'jsonwebtoken';
import express from 'express';
import { ragRouter } from './rag.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/rag', ragRouter);
  a.use(errorMiddleware);
  return a;
}

describe('rag router', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'student-1',
      role: 'student',
    });
    process.env.N8N_RAG_WEBHOOK_URL = 'http://localhost:5678/webhook/gabay-rag';
  });

  afterEach(() => {
    (globalThis as { fetch?: unknown }).fetch = realFetch;
    delete process.env.N8N_RAG_WEBHOOK_URL;
  });

  it('requires auth (401 without token)', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .send({ message: 'hi' });

    expect(res.status).toBe(401);
  });

  it('rejects empty message (400)', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
  });

  it('forwards to n8n webhook and normalizes output', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: 'Hello from LIKHA RAG' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'What is enrollment?', sessionId: 'convo-123' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:5678/webhook/gabay-rag');
    const body = JSON.parse(String((init as { body?: string }).body)) as Record<string, unknown>;
    expect(body.chatInput ?? body.message).toBeTruthy();
    expect(body.sessionId).toBe('convo-123');
    expect(res.body.reply).toBe('Hello from LIKHA RAG');
    expect(res.body.sessionId).toBe('convo-123');
    expect(res.body.chart).toBeNull();
  });

  it('forwards and extracts chart object if user asked for a chart', async () => {
    const mockChart = {
      type: 'bar',
      title: 'Enrolled Breakdown',
      data: [{ label: 'Freshman', value: 1 }],
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: 'Here is your breakdown', chart: mockChart }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Give me a chart', sessionId: 'convo-chart' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Here is your breakdown');
    expect(res.body.chart).toEqual(mockChart);
  });

  it('drops chart object and strips embedded chart code blocks if user did not ask for a chart', async () => {
    const mockChart = {
      type: 'bar',
      title: 'Enrolled Breakdown',
      data: [{ label: 'Freshman', value: 1 }],
    };
    const rawReply = 'There are 4 students enrolled.\n\n```chart\n{"type":"bar","data":[{"label":"Freshman","value":1}]}\n```\nLet me know if you need more details.';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: rawReply, chart: mockChart }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'How many students are enrolled?', sessionId: 'convo-no-chart' });

    expect(res.status).toBe(200);
    expect(res.body.chart).toBeNull();
    expect(res.body.reply).not.toContain('```chart');
    expect(res.body.reply).toContain('There are 4 students enrolled.');
  });

  it('converts markdown table to bullet points if user did not ask for a table', async () => {
    const rawReply =
      'Here are the students:\n\n| Student Name | Student ID | Status |\n|---|---|---|\n| Alice Smith | 1001 | Enrolled |\n| Bob Jones | 1002 | Returning |';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: rawReply }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Who are the students?', sessionId: 'convo-no-table' });

    expect(res.status).toBe(200);
    expect(res.body.reply).not.toContain('|---|---|');
    expect(res.body.reply).toContain('Alice Smith');
    expect(res.body.reply).toContain('1001');
    expect(res.body.reply).toContain('Bob Jones');
  });

  it('preserves markdown table if user explicitly asked for a table', async () => {
    const rawReply =
      'Here are the students:\n\n| Student Name | Student ID | Status |\n|---|---|---|\n| Alice Smith | 1001 | Enrolled |';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: rawReply }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'List the students in a table please', sessionId: 'convo-with-table' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('| Student Name | Student ID | Status |');
  });

  it('handles execution telemetry in chat response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: 'Telemetry test reply' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'telemetry test', sessionId: 's-telemetry' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Telemetry test reply');
    if (res.body.execution) {
      expect(Array.isArray(res.body.execution.tasks)).toBe(true);
    }
  });

  it('returns 502 when n8n is unreachable', async () => {
    (globalThis as { fetch?: unknown }).fetch = vi.fn(async () => {
      throw new Error('fetch failed');
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'hi', sessionId: 's1' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('rag_unavailable');
  });

  it('provides live progress endpoint GET /api/rag/progress/:sessionId', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .get('/api/rag/progress/session-live-test')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('execution');
  });

  it('preserves both tables and charts when user asks for a report', async () => {
    const rawReport = `# Full Enrollment Report

| Category | Count |
|---|---|
| Enrolled | 3 |
| Continuing | 1 |

\`\`\`chart
{
  "type": "bar",
  "title": "Enrollment Overview",
  "data": [
    { "label": "Enrolled", "value": 3 },
    { "label": "Continuing", "value": 1 }
  ]
}
\`\`\`
Summary of findings.`;

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: rawReport }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Can you create a full report on students?', sessionId: 's-report' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('| Category | Count |');
    expect(res.body.reply).toContain('```chart');
    expect(res.body.chart).not.toBeNull();
    expect(res.body.chart?.type).toBe('bar');
    expect(res.body.chart?.data).toHaveLength(2);
  });

  it('handles raw JSON chart object from n8n when user asks for a graph', async () => {
    const rawChartObj = {
      type: 'bar',
      title: 'Student Distribution',
      data: [
        { label: 'Kurby', value: 1 },
        { label: 'Edrich', value: 1 },
      ],
    };

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: rawChartObj }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Can you place that in a graph?', sessionId: 's-graph-obj' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('```chart');
    expect(res.body.chart).toEqual(rawChartObj);
  });

  it('handles raw JSON chart string from n8n when user asks for a graph', async () => {
    const jsonStr = JSON.stringify({
      type: 'bar',
      title: 'Student Distribution',
      data: [{ label: 'Kurby', value: 1 }],
    });

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: jsonStr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/rag/chat')
      .set('Authorization', 'Bearer x')
      .send({ message: 'Can you place that in a graph?', sessionId: 's-graph-str' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('```chart');
    expect(res.body.chart?.type).toBe('bar');
  });
});
