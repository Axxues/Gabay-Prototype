import type { Request, Response, NextFunction } from 'express';
import { createGzip } from 'node:zlib';

const COMPRESSIBLE_TYPES = [
  'application/json',
  'application/javascript',
  'text/html',
  'text/css',
  'text/plain',
  'text/javascript',
  'image/svg+xml',
  'application/xml',
];

export interface CompressionOptions {
  threshold?: number;
}

export function nativeCompression(options: CompressionOptions = {}) {
  const threshold = options.threshold ?? 1024;

  return (req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = req.headers['accept-encoding'];
    if (!acceptEncoding || typeof acceptEncoding !== 'string' || !acceptEncoding.includes('gzip')) {
      return next();
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];
    let isFinished = false;

    // Override res.write
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (res.getHeader('content-encoding')) {
        return (originalWrite as any)(chunk, ...args);
      }
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    } as any;

    // Override res.end
    res.end = function (chunk?: any, ...args: any[]): Response {
      if (isFinished) {
        return (originalEnd as any)(chunk, ...args);
      }
      isFinished = true;

      // Extract optional callback from args
      let cb: (() => void) | undefined;
      for (const arg of args) {
        if (typeof arg === 'function') {
          cb = arg;
          break;
        }
      }

      if (res.getHeader('content-encoding')) {
        return (originalEnd as any)(chunk, ...args);
      }

      if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = Buffer.concat(chunks);

      // Do not compress empty responses, 204 No Content, 304 Not Modified, or payloads smaller than threshold
      if (res.statusCode === 204 || res.statusCode === 304 || body.length < threshold) {
        return (originalEnd as any)(body, cb);
      }

      const contentType = (res.getHeader('content-type') as string) || '';
      const isCompressible = COMPRESSIBLE_TYPES.some((type) => contentType.toLowerCase().includes(type));

      if (!isCompressible) {
        return (originalEnd as any)(body, cb);
      }

      // Compress body with gzip
      const gzip = createGzip();
      const compressedChunks: Buffer[] = [];

      gzip.on('data', (c) => compressedChunks.push(c));
      gzip.on('end', () => {
        const compressed = Buffer.concat(compressedChunks);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', compressed.length);
        res.removeHeader('ETag');
        return (originalEnd as any)(compressed, cb);
      });
      gzip.on('error', () => {
        // Fallback to uncompressed on error
        return (originalEnd as any)(body, cb);
      });

      gzip.end(body);
      return res;
    } as any;

    next();
  };
}
