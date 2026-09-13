import { describe, expect, it, vi } from 'vitest';
import { ApiError, errorMiddleware } from './errors.js';

function resDouble() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as { status: (n: number) => unknown; json: (o: unknown) => unknown } & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('errorMiddleware', () => {
  it('passes ApiError through with its status and code', () => {
    const res = resDouble();
    errorMiddleware(new ApiError(403, 'forbidden', 'Nope.'), {} as never, res as never, (() => {}) as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'forbidden', message: 'Nope.' } });
  });
  it('maps body-parser entity.too.large to 413 payload_too_large', () => {
    const res = resDouble();
    const err = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large' });
    errorMiddleware(err, {} as never, res as never, (() => {}) as never);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'payload_too_large', message: 'Request body too large.' } });
  });
  it('maps unknown errors to generic 500 without leaking', () => {
    const res = resDouble();
    errorMiddleware(new Error('secret sql boom'), {} as never, res as never, (() => {}) as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'internal', message: 'Something went wrong.' } });
  });
});
