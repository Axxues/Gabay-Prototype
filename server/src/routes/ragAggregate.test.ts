import '../env.js';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ragAggregateRouter } from './ragAggregate.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/rag-aggregate', ragAggregateRouter);
  a.use(errorMiddleware);
  return a;
}

const KEY = process.env.RAG_EXPORT_KEY as string;

describe('ragAggregate', () => {
  it('401s without the service key', async () => {
    const res = await request(app()).post('/api/rag-aggregate').send({
      table: 'course', metric: 'count',
    });
    expect(res.status).toBe(401);
  });

  it('counts courses', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'course', metric: 'count' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ table: 'course', metric: 'count', value: expect.any(Number) });
  });

  it('counts with an equality filter', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'course', metric: 'count', filters: { published: true } });
    expect(res.status).toBe(200);
    expect(typeof res.body.value).toBe('number');
  });

  it('rejects unknown tables and metrics', async () => {
    for (const body of [
      { table: 'user', metric: 'count' },
      { table: 'course', metric: 'median' },
      { table: 'course', metric: 'sum', field: 'title' },
    ]) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('scopes per-student tables to the requester', async () => {
    const noId = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'submission', metric: 'count' });
    expect(noId.status).toBe(400);
    const ok = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'submission', metric: 'count', requesterId: 'usr-stud-1' });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.value).toBe('number');
  });
});
