import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../server/.env') });

const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
const LIKHA_ADMIN_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'jayveegenetareyes@gmail.com';
const LIKHA_ADMIN_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'qwerty12345';

const ROLES = {
  admin: 'f927940e-7f3f-49d4-8c80-a6ccd2167e18',
  faculty: '2e1047c9-1f10-4ae2-b131-6345c7814a6b',
  student: '98a212b2-9482-4ca5-8f67-825699575f3c',
  staff: 'c7d14be0-4259-46d7-b4b6-37db1221a0e9',
};

async function seed() {
  console.log(`[Likha Seeder] Connecting to ${LIKHA_URL}...`);
  const loginRes = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LIKHA_ADMIN_EMAIL, password: LIKHA_ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${loginRes.statusText}`);
  }

  const { data: { access_token } } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${access_token}`,
  };

  // 1. Seed or update Users
  console.log('[Likha Seeder] Checking users...');
  const usersRes = await fetch(`${LIKHA_URL}/users?limit=100`, { headers });
  const usersData = await usersRes.json();
  const existingUsersByEmail = new Map<string, any>((usersData.data || []).map((u: any) => [u.email.toLowerCase(), u]));

  const SEED_USERS = [
    {
      email: 'faculty1@dmmmsu.edu.ph',
      password: 'faculty2026',
      first_name: 'Faculty',
      last_name: 'Instructor 1',
      role: ROLES.faculty,
      user_role: 'faculty',
      department: 'College of Computer Science',
      title: 'Associate Professor I',
      avatar: null,
    },
    {
      email: 'student1@dmmmsu.edu.ph',
      password: 'gabay2026',
      first_name: 'Student',
      last_name: 'Scholar 1',
      role: ROLES.student,
      user_role: 'student',
      student_id: '2023-CS-0001',
      department: 'BS Computer Science',
      title: '4th Year Student (Thesis Track)',
      avatar: null,
    },
    {
      email: 'staff1@dmmmsu.edu.ph',
      password: 'gabay2026',
      first_name: 'Staff',
      last_name: 'Registrar 1',
      role: ROLES.staff,
      user_role: 'staff',
      department: 'Office of the College Registrar',
      title: 'Registrar Staff',
      avatar: null,
    },
  ];

  for (const user of SEED_USERS) {
    const existing = existingUsersByEmail.get(user.email.toLowerCase());
    if (!existing) {
      console.log(`  -> Creating user: ${user.email}`);
      const createRes = await fetch(`${LIKHA_URL}/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...user, status: 'active' }),
      });
      if (!createRes.ok) {
        console.warn(`  Failed to create ${user.email}:`, await createRes.text());
      }
    } else {
      console.log(`  -> User exists: ${user.email} (id: ${existing.id}), updating profile/password...`);
      await fetch(`${LIKHA_URL}/users/${existing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          user_role: user.user_role,
          department: user.department,
          title: user.title,
          password: user.password,
          status: 'active',
        }),
      });
    }
  }

  // Refresh users to get IDs
  const refreshedUsersRes = await fetch(`${LIKHA_URL}/users?limit=100`, { headers });
  const refreshedUsers = await refreshedUsersRes.json();
  const userMap = new Map<string, string>((refreshedUsers.data || []).map((u: any) => [u.email.toLowerCase(), u.id]));
  const facultyId = userMap.get('faculty1@dmmmsu.edu.ph') || 'usr-fac-1';
  const studentId = userMap.get('student1@dmmmsu.edu.ph') || 'usr-stud-1';

  // 2. Seed Courses
  console.log('[Likha Seeder] Checking courses...');
  const coursesRes = await fetch(`${LIKHA_URL}/items/courses?limit=100`, { headers });
  const coursesData = await coursesRes.json();
  const existingCourses = new Set<string>((coursesData.data || []).map((c: any) => c.id));

  const SEED_COURSES = [
    {
      id: 'c-cs101',
      code: 'CS 101',
      title: 'Artificial Intelligence & Expert Systems',
      section: 'BSCS 4-A',
      term: 'First Semester 2026-2027',
      instructor_id: facultyId,
      instructor_name: 'Faculty Instructor 1',
      published: true,
      color: '#3B82F6',
      enrolled_count: 24,
      credits: 3,
      join_code: 'AI4A-2026',
      grading_terms: ['midterm', 'final'],
      grades_released: { midterm: true, final: false },
      syllabus: {
        courseCode: 'CS 101',
        courseTitle: 'Artificial Intelligence & Expert Systems',
        description: 'Comprehensive study of symbolic reasoning, neural systems, and multi-agent retrieval architectures.',
        passingCriteria: '75.0% cumulative SPR score with minimum 60% on Midterm and Final examinations.',
      },
    },
    {
      id: 'c-cs102',
      code: 'CS 102',
      title: 'Web Engineering Fundamentals',
      section: 'BSCS 4-A',
      term: 'First Semester 2026-2027',
      instructor_id: facultyId,
      instructor_name: 'Faculty Instructor 1',
      published: true,
      color: '#10B981',
      enrolled_count: 22,
      credits: 3,
      join_code: 'WEB4A-2026',
      grading_terms: ['midterm', 'final'],
      grades_released: { midterm: false, final: false },
      syllabus: {
        courseCode: 'CS 102',
        courseTitle: 'Web Engineering Fundamentals',
        description: 'Design patterns for scalable web architectures, modern API gateways, and distributed cloud microservices.',
        passingCriteria: '75.0% cumulative mark based on laboratory activities and term examinations.',
      },
    },
    {
      id: 'c-cs103',
      code: 'CS 103',
      title: 'Data Structures Laboratory',
      section: 'BSCS 4-B',
      term: 'First Semester 2026-2027',
      instructor_id: facultyId,
      instructor_name: 'Faculty Instructor 1',
      published: true,
      color: '#8B5CF6',
      enrolled_count: 28,
      credits: 2,
      join_code: 'DATA4B-2026',
      grading_terms: ['midterm', 'final'],
      grades_released: { midterm: false, final: false },
    },
  ];

  for (const course of SEED_COURSES) {
    if (!existingCourses.has(course.id)) {
      console.log(`  -> Creating course: ${course.code} (${course.id})`);
      const createRes = await fetch(`${LIKHA_URL}/items/courses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(course),
      });
      if (!createRes.ok) {
        console.warn(`  Failed to create ${course.code}:`, await createRes.text());
      }
    } else {
      console.log(`  -> Course ${course.code} exists, updating...`);
      await fetch(`${LIKHA_URL}/items/courses/${course.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(course),
      });
    }
  }

  // 3. Seed Course Sections
  console.log('[Likha Seeder] Checking course sections...');
  const secRes = await fetch(`${LIKHA_URL}/items/course_sections?limit=100`, { headers });
  const secData = await secRes.json();
  const existingSec = new Set<string>((secData.data || []).map((s: any) => s.id));

  const SEED_SECTIONS = [
    {
      id: 'sec-cs101-1',
      course_id: 'c-cs101',
      name: 'Section A - Morning',
      capacity: 30,
      enrolled_count: 24,
      schedule: 'MWF 08:00 AM - 10:00 AM',
      location: 'CL 3, Computer Science Building',
    },
    {
      id: 'sec-cs102-1',
      course_id: 'c-cs102',
      name: 'Section A - Afternoon',
      capacity: 30,
      enrolled_count: 22,
      schedule: 'TTh 01:00 PM - 03:00 PM',
      location: 'CL 4, Computer Science Building',
    },
  ];

  for (const sec of SEED_SECTIONS) {
    if (!existingSec.has(sec.id)) {
      await fetch(`${LIKHA_URL}/items/course_sections`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sec),
      });
    }
  }

  // 4. Seed Modules
  console.log('[Likha Seeder] Checking modules...');
  const modRes = await fetch(`${LIKHA_URL}/items/modules?limit=100`, { headers });
  const modData = await modRes.json();
  const existingMods = new Set<string>((modData.data || []).map((m: any) => m.id));

  const SEED_MODULES = [
    {
      id: 'mod-101-1',
      course_id: 'c-cs101',
      title: 'Module 1: Introduction to Multi-Agent Reasoning',
      order: 1,
      published: true,
      author_id: facultyId,
      author_name: 'Faculty Instructor 1',
    },
    {
      id: 'mod-101-2',
      course_id: 'c-cs101',
      title: 'Module 2: Neural Retrieval-Augmented Generation',
      order: 2,
      published: true,
      author_id: facultyId,
      author_name: 'Faculty Instructor 1',
    },
  ];

  for (const m of SEED_MODULES) {
    if (!existingMods.has(m.id)) {
      await fetch(`${LIKHA_URL}/items/modules`, {
        method: 'POST',
        headers,
        body: JSON.stringify(m),
      });
    }
  }

  // 5. Seed Activities & Assessments
  console.log('[Likha Seeder] Checking activities...');
  const actRes = await fetch(`${LIKHA_URL}/items/activities?limit=100`, { headers });
  const actData = await actRes.json();
  const existingActs = new Set<string>((actData.data || []).map((a: any) => a.id));

  const SEED_ACTIVITIES = [
    {
      id: 'act-101-1',
      course_id: 'c-cs101',
      title: 'Laboratory Activity 1: Vector Search Implementation',
      description: 'Implement a cosine similarity retrieval function over document embeddings.',
      term: 'midterm',
      format: 'questionset',
      category: 'Laboratory',
      weight: 15,
      total_points: 50,
      published: true,
      questions: [
        { id: 'q1', type: 'essay', prompt: 'Explain the difference between sparse and dense retrieval.', points: 25 },
        { id: 'q2', type: 'code', prompt: 'Write a dot-product normalization function in TypeScript.', points: 25 },
      ],
    },
  ];

  for (const act of SEED_ACTIVITIES) {
    if (!existingActs.has(act.id)) {
      await fetch(`${LIKHA_URL}/items/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(act),
      });
    }
  }

  console.log('[Likha Seeder] Data seeding completed successfully!');
}

seed().catch(err => {
  console.error('[Likha Seeder] Failed:', err);
  process.exit(1);
});
