import './src/env.js';
import { prisma } from './src/db.js';

async function run() {
  const users = await prisma.user.findMany();
  console.log('Prisma users:', users.map(u => ({ id: u.id, email: u.email })));
}
run();
