// Loads server/.env explicitly, resolved from THIS file's location —
// independent of the process working directory. Must be imported before
// any module that constructs PrismaClient (see index.ts first import).
// Prisma CLI loads .env on its own; this is for `node`/`tsx` runtime.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });

export const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
export const LIKHA_ADMIN_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'jayveegenetareyes@gmail.com';
export const LIKHA_ADMIN_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'qwerty12345';
