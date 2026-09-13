import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';

export interface SeedAccount {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'faculty' | 'staff' | 'student';
  password: string;
  avatar: string;
  department: string;
  title: string;
}

// Values mirror src/data/mockData.json rows usr-admin-1, usr-fac-1,
// usr-staff-1, usr-stud-1 exactly (ids, names, emails, roles, avatars,
// departments, titles). Passwords are local dev-only constants.
const ACCOUNTS: SeedAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Dean 1',
    email: 'dean1@dmmmsu.edu.ph',
    role: 'admin',
    password: 'local-dev-admin-01',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'College of Computer Science',
    title: 'Dean & Professor IV',
  },
  {
    id: 'usr-fac-1',
    name: 'Faculty 1',
    email: 'faculty1@dmmmsu.edu.ph',
    role: 'faculty',
    password: 'local-dev-faculty-02',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: 'Department of Computer Science',
    title: 'Associate Professor I',
  },
  {
    id: 'usr-staff-1',
    name: 'Staff 1',
    email: 'staff1@dmmmsu.edu.ph',
    role: 'staff',
    password: 'local-dev-staff-03',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    department: 'Office of the College Registrar',
    title: 'Registrar Aide II (Likha Sync)',
  },
  {
    id: 'usr-stud-1',
    name: 'Student 1',
    email: 'student1@dmmmsu.edu.ph',
    role: 'student',
    password: 'local-dev-student-04',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    department: 'BS Computer Science',
    title: '4th Year Student (Thesis Track)',
  },
];

export async function seed(accounts: SeedAccount[] = ACCOUNTS): Promise<string[]> {
  const emails: string[] = [];
  for (const a of accounts) {
    const passwordHash = await bcrypt.hash(a.password, 10);
    await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, avatar: a.avatar, department: a.department, title: a.title, passwordHash },
      create: {
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        avatar: a.avatar,
        department: a.department,
        title: a.title,
        passwordHash,
      },
    });
    emails.push(a.email);
  }
  return emails;
}

async function main() {
  const emails = await seed();
  console.log(`Seeded ${emails.length} accounts: ${emails.join(', ')}`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
