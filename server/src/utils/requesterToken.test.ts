import '../env.js';
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createRequesterToken, verifyRequesterToken } from './requesterToken.js';

process.env.JWT_SECRET ??= 'test-secret';

const SECRET = process.env.JWT_SECRET as string;

function signedToken(options: jwt.SignOptions): string {
  return jwt.sign({ role: 'student', type: 'rag-requester' }, 'wrong-secret', options);
}

describe('requesterToken', () => {
  it('round-trips the requester subject and role', () => {
    const token = createRequesterToken({ sub: 'student-1', role: 'student' });

    expect(verifyRequesterToken(token)).toEqual({ sub: 'student-1', role: 'student' });
  });

  it('rejects a token signed with another secret', () => {
    const token = signedToken({ subject: 'student-1', issuer: 'gabay-rag', expiresIn: '5m' });

    expect(() => verifyRequesterToken(token)).toThrow();
  });

  it('rejects a valid token signed with another algorithm', () => {
    const token = jwt.sign(
      { role: 'student', type: 'rag-requester' },
      SECRET,
      { algorithm: 'HS384', subject: 'student-1', issuer: 'gabay-rag', expiresIn: '5m' },
    );

    expect(() => verifyRequesterToken(token)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(
      { role: 'student', type: 'rag-requester' },
      SECRET,
      { subject: 'student-1', issuer: 'gabay-rag', expiresIn: -1 },
    );

    expect(() => verifyRequesterToken(token)).toThrow();
  });

  it('rejects tokens with the wrong issuer or type', () => {
    const wrongIssuer = signedToken({ subject: 'student-1', issuer: 'other', expiresIn: '5m' });
    const wrongType = jwt.sign(
      { role: 'student', type: 'other' },
      SECRET,
      { subject: 'student-1', issuer: 'gabay-rag', expiresIn: '5m' },
    );

    expect(() => verifyRequesterToken(wrongIssuer)).toThrow();
    expect(() => verifyRequesterToken(wrongType)).toThrow();
  });
});
