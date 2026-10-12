import jwt from 'jsonwebtoken';

const ISSUER = 'gabay-rag';
const TOKEN_TYPE = 'rag-requester';

export interface RequesterIdentity {
  sub: string;
  role: string;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set');
  return value;
}

export function createRequesterToken(identity: RequesterIdentity): string {
  return jwt.sign(
    { role: identity.role, type: TOKEN_TYPE },
    secret(),
    { subject: identity.sub, issuer: ISSUER, expiresIn: '5m' },
  );
}

export function verifyRequesterToken(token: string): RequesterIdentity {
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER });
  if (typeof payload === 'string' || payload.type !== TOKEN_TYPE ||
      typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
    throw new Error('Invalid requester token.');
  }
  return { sub: payload.sub, role: payload.role };
}
