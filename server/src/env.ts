// Loads server/.env explicitly, resolved from THIS file's location —
// independent of the process working directory. Must be imported before
// any module that constructs PrismaClient (see index.ts first import).
// Prisma CLI loads .env on its own; this is for `node`/`tsx` runtime.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });
