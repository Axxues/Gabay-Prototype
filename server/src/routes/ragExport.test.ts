import '../env.js';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ragExportRouter } from './ragExport.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use('/api/rag-export', ragExportRouter);
  a.use(errorMiddleware);
  return a;
}

describe('ragExport', () => {
  it('401s without the service key', async () => {
    const res = await request(app()).get('/api/rag-export/courses');
    expect(res.status).toBe(401);
  });
  it('returns courses-area tables with the key', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const names = res.body.tables.map((t: { collection: string }) => t.collection);
    expect(names).toEqual(expect.arrayContaining(['course', 'course_section', 'enrollment_request']));
    expect(res.body.tables[0]).toHaveProperty('records');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
  it('404s unknown area', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/nope')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(404);
  });
});
