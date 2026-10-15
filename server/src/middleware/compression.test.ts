import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { nativeCompression } from './compression.js';

describe('nativeCompression middleware', () => {
  it('does not compress responses smaller than threshold (1024 bytes)', async () => {
    const app = express();
    app.use(nativeCompression({ threshold: 1024 }));
    app.get('/small', (_req, res) => {
      res.json({ message: 'hello world' });
    });

    const res = await request(app)
      .get('/small')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body).toEqual({ message: 'hello world' });
  });

  it('compresses JSON responses larger than threshold with gzip', async () => {
    const app = express();
    app.use(nativeCompression({ threshold: 1024 }));

    const largeData = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item number ${i}`,
      description: `This is a detailed description for item ${i} to test compression.`,
    }));

    app.get('/large', (_req, res) => {
      res.json(largeData);
    });

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const { statusCode, headers, body } = await new Promise<{
        statusCode: number;
        headers: any;
        body: Buffer;
      }>((resolve, reject) => {
        const req = http.get(
          `http://localhost:${port}/large`,
          { headers: { 'Accept-Encoding': 'gzip' } },
          (res: any) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () =>
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks),
              })
            );
          }
        );
        req.on('error', reject);
      });

      expect(statusCode).toBe(200);
      expect(headers['content-encoding']).toBe('gzip');

      // Verify payload is truly gzipped and decompresses to the exact data
      const decompressed = gunzipSync(body).toString('utf-8');
      expect(JSON.parse(decompressed)).toEqual(largeData);
    } finally {
      server.close();
    }
  });

  it('does not compress if client does not send gzip in Accept-Encoding', async () => {
    const app = express();
    app.use(nativeCompression({ threshold: 1024 }));
    const largeData = { text: 'A'.repeat(2000) };

    app.get('/no-gzip', (_req, res) => {
      res.json(largeData);
    });

    const res = await request(app)
      .get('/no-gzip')
      .set('Accept-Encoding', 'identity');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body).toEqual(largeData);
  });

  it('does not compress uncompressible MIME types', async () => {
    const app = express();
    app.use(nativeCompression({ threshold: 1024 }));
    const binaryData = Buffer.alloc(2000, 0x01);

    app.get('/binary', (_req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(binaryData);
    });

    const res = await request(app)
      .get('/binary')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('handles 204 No Content without error', async () => {
    const app = express();
    app.use(nativeCompression());

    app.delete('/item', (_req, res) => {
      res.status(204).end();
    });

    const res = await request(app)
      .delete('/item')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(204);
  });
});
