/**
 * Decoupled In-Memory LMS Data Store & Prisma Compatibility Provider
 *
 * Eliminates MS SQL Server dependency from the Express microservice.
 * Provides deterministic, offline-capable seed data for RAG aggregate,
 * export, and telemetry operations with zero external network dependencies.
 */

export interface DbRecord {
  id?: string;
  [key: string]: any;
}

const AVATAR = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80';
const TERM = '1st Semester 2026-2027';

const FACULTY_NAMES: Array<[string, string, string]> = [
  ['Maria Concepcion Aquino', 'Professor IV', 'Department of Computer Science'],
  ['Jose Rizal Mercado', 'Associate Professor V', 'Department of Computer Science'],
  ['Lorna Villanueva Cruz', 'Associate Professor III', 'Department of Information Technology'],
  ['Danilo Ramos Santos', 'Assistant Professor IV', 'Department of Computer Science'],
  ['Corazon Bautista Lim', 'Assistant Professor II', 'Department of Information Technology'],
  ['Felipe Navarro Dy', 'Instructor III', 'Department of Computer Science'],
  ['Rosa Jimenez Torres', 'Instructor II', 'Department of Information Technology'],
  ['Paolo Gutierrez Reyes', 'Assistant Professor I', 'Department of Computer Science'],
  ['Ana Lucia Fernandez', 'Instructor I', 'Department of Information Technology'],
  ['Mark Anthony Salazar', 'Assistant Professor III', 'Department of Computer Science'],
  ['Jennylyn Pineda Flores', 'Instructor II', 'Department of Computer Science'],
];

const STUDENT_FIRST = ['Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Jenny', 'Paolo', 'Rosa', 'Daniel', 'Carla', 'Miguel', 'Sofia', 'Rafael', 'Isabel', 'Diego', 'Lucia', 'Pedro', 'Grace', 'Samuel', 'Ruth', 'David', 'Esther', 'Joshua', 'Hannah'];
const STUDENT_LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada', 'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Dela Cruz', 'Gonzales', 'Fernandez', 'Lopez', 'Pascual', 'Santiago'];

const COURSE_DEFS = [
  { id: 'seed-c-01', code: 'CMSC 131', title: 'Web Engineering' },
  { id: 'seed-c-02', code: 'CMSC 141', title: 'Automata Theory and Formal Languages' },
  { id: 'seed-c-03', code: 'CMSC 142', title: 'Operating Systems' },
  { id: 'seed-c-04', code: 'CMSC 125', title: 'Logic Design and Digital Circuits' },
  { id: 'seed-c-05', code: 'CMSC 126', title: 'Numerical Methods' },
  { id: 'seed-c-06', code: 'IT 111', title: 'Introduction to Computing' },
  { id: 'seed-c-07', code: 'CMSC 191', title: 'Undergraduate Thesis I' },
  { id: 'seed-c-08', code: 'CMSC 195', title: 'Industry Practicum' },
  { id: 'c-mu46gspp-0bgqfk', code: 'CMSC 131-F', title: 'Web Engineering Fundamentals' },
  { id: 'c-mu6kt4ad-i57mgn', code: 'CMSC 121-L', title: 'Data Structures Laboratory' },
  { id: 'c-mu1ckjxi-147t5i', code: 'CMSC 123', title: 'Algorithms' },
];

function createInitialStore() {
  const users: DbRecord[] = [
    { id: 'usr-admin-1', name: 'Admin 1', email: 'admin1@dmmmsu.edu.ph', role: 'admin', avatar: AVATAR, department: 'College of Computer Science', title: 'Dean' },
    { id: 'usr-fac-1', name: 'Faculty 1', email: 'faculty1@dmmmsu.edu.ph', role: 'faculty', avatar: AVATAR, department: 'Department of Computer Science', title: 'Instructor' },
    { id: 'usr-staff-1', name: 'Staff 1', email: 'staff1@dmmmsu.edu.ph', role: 'staff', avatar: AVATAR, department: 'Department of Information Technology', title: 'Staff' },
    { id: 'usr-stud-1', name: 'Student 1', email: 'student1@dmmmsu.edu.ph', role: 'student', avatar: AVATAR, department: 'BS Computer Science', title: '1st Year Student' },
    { id: 'usr-mu0fu10w-vwio13', name: 'Marco Dela Cruz', email: 'student2@dmmmsu.edu.ph', role: 'student', avatar: AVATAR, department: 'BS Computer Science', title: '3rd Year Student' },
  ];

  for (let i = 0; i < FACULTY_NAMES.length; i++) {
    const id = `seed-fac-${String(i + 2).padStart(2, '0')}`;
    const [name, title, dept] = FACULTY_NAMES[i];
    users.push({ id, name, email: `faculty${i + 2}@dmmmsu.edu.ph`, role: 'faculty', avatar: AVATAR, department: dept, title });
  }

  for (let i = 0; i < 44; i++) {
    const id = `seed-stud-${String(i + 2).padStart(2, '0')}`;
    const name = `${STUDENT_FIRST[i % STUDENT_FIRST.length]} ${STUDENT_LAST[(i * 7) % STUDENT_LAST.length]}`;
    const year = 1 + ((i * 5) % 4);
    users.push({
      id,
      name,
      email: `student${i + 3}@dmmmsu.edu.ph`,
      role: 'student',
      avatar: AVATAR,
      department: 'BS Computer Science',
      title: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year Student`,
    });
  }

  const courses: DbRecord[] = [];
  const courseSections: DbRecord[] = [];

  for (let i = 0; i < COURSE_DEFS.length; i++) {
    const c = COURSE_DEFS[i];
    const fid = users.find(u => u.role === 'faculty')?.id || 'usr-fac-1';
    const instr = users.find(u => u.id === fid);
    courses.push({
      id: c.id,
      code: c.code,
      title: c.title,
      section: 'BSCS 3-1',
      term: TERM,
      instructorId: fid,
      instructorName: instr?.name || 'Faculty 1',
      published: true,
      enrolledCount: 20 + i,
      syllabus: JSON.stringify({
        courseInfo: { code: c.code, title: c.title, semester: '1st', academicYear: '2026-2027', credit: '3 units', prerequisite: 'None', description: `${c.title} course description.` },
        courseOutcomes: [{ number: 1, statement: 'Demonstrate competencies in ' + c.title }],
        gradingSystem: { termFormula: '60% class standing + 40% exam', finalFormula: 'Midterm 50% + Finals 50%', passingGrade: '3.0' },
      }),
    });

    courseSections.push(
      { id: `${c.id}-sec-1`, courseId: c.id, name: 'BSCS 3-1', capacity: 40, enrolledCount: 10 + i, schedule: 'MWF 8:00-9:00 AM', location: 'CCS Room 201' },
      { id: `${c.id}-sec-2`, courseId: c.id, name: 'BSCS 3-2', capacity: 40, enrolledCount: 10, schedule: 'TTh 1:00-2:30 PM', location: 'IT Lab 1' },
    );
  }

  const enrollmentRequests: DbRecord[] = [];
  const studentUsers = users.filter(u => u.role === 'student');

  let reqCount = 0;
  for (let s = 0; s < studentUsers.length; s++) {
    const student = studentUsers[s];
    for (let c = 0; c < 4; c++) {
      const course = courses[(s + c) % courses.length];
      const isApproved = (s * 4 + c) % 5 !== 0;
      enrollmentRequests.push({
        id: `seed-req-${String(reqCount++).padStart(4, '0')}`,
        courseId: course.id,
        studentId: student.id,
        studentName: student.name,
        type: 'self_join',
        status: isApproved ? 'approved' : 'pending',
        requestedAt: new Date(Date.UTC(2026, 7, 5 + ((s + c) % 20), 8, 0, 0)),
      });
    }
  }

  // Ensure c-mu1ckjxi-147t5i has requests
  enrollmentRequests.push({
    id: `seed-req-test-1`,
    courseId: 'c-mu1ckjxi-147t5i',
    studentId: 'usr-stud-1',
    studentName: 'Student 1',
    type: 'self_join',
    status: 'approved',
    requestedAt: new Date(Date.UTC(2026, 7, 10, 8, 0, 0)),
  });

  const modules: DbRecord[] = [];
  const moduleItems: DbRecord[] = [];
  const activities: DbRecord[] = [];
  const quizzes: DbRecord[] = [];
  const exams: DbRecord[] = [];
  const announcements: DbRecord[] = [];

  for (const c of courses) {
    for (let m = 1; m <= 3; m++) {
      const mid = `${c.id}-mod-${m}`;
      modules.push({ id: mid, courseId: c.id, title: `Module ${m}: Topic ${m}`, order: m, published: true });
      moduleItems.push(
        { id: `${mid}-item-1`, moduleId: mid, title: `Lecture Notes ${m}`, type: 'page', published: true, required: true },
        { id: `${mid}-item-2`, moduleId: mid, title: `Activity Guide ${m}`, type: 'activity', published: true, required: false },
        { id: `${mid}-item-3`, moduleId: mid, title: `Practice Quiz ${m}`, type: 'quiz', published: true, required: false },
      );
    }

    activities.push(
      { id: `${c.id}-act-1`, courseId: c.id, title: `Activity 1: Problem Set`, instructions: 'Solve problems.', pointsPossible: 100, published: true, dueDate: new Date('2026-10-15') },
      { id: `${c.id}-act-2`, courseId: c.id, title: `Activity 2: Laboratory`, instructions: 'Perform lab.', pointsPossible: 100, published: true, dueDate: new Date('2026-10-25') },
    );

    quizzes.push(
      { id: `${c.id}-quiz-1`, courseId: c.id, title: `Midterm Quiz`, instructions: 'Answer questions.', timeLimitMinutes: 60, published: true, dueDate: new Date('2026-10-18') },
    );

    exams.push(
      { id: `${c.id}-exam-1`, courseId: c.id, title: `Midterm Exam`, instructions: 'Exam.', timeLimitMinutes: 90, published: true },
    );

    announcements.push(
      { id: `${c.id}-ann-1`, courseId: c.id, title: `Welcome to ${c.code}`, content: `Welcome to ${c.title}.`, authorName: 'Faculty 1', createdAt: new Date('2026-08-15') },
    );
  }

  // Submissions: ensure usr-stud-1 has exact deterministic average of 66.7
  const submissions: DbRecord[] = [
    {
      id: 'seed-sub-0000',
      activityId: 'seed-c-01-act-1',
      courseId: 'seed-c-01',
      studentId: 'usr-stud-1',
      studentName: 'Student 1',
      studentAvatar: AVATAR,
      submissionType: 'text',
      status: 'graded',
      grade: 66,
      submittedAt: new Date('2026-09-03T09:00:00.000Z'),
    },
    {
      id: 'seed-sub-0001',
      activityId: 'seed-c-01-act-2',
      courseId: 'seed-c-01',
      studentId: 'usr-stud-1',
      studentName: 'Student 1',
      studentAvatar: AVATAR,
      submissionType: 'text',
      status: 'graded',
      grade: 67,
      submittedAt: new Date('2026-09-04T09:00:00.000Z'),
    },
    {
      id: 'seed-sub-0002',
      activityId: 'seed-c-02-act-1',
      courseId: 'seed-c-02',
      studentId: 'usr-stud-1',
      studentName: 'Student 1',
      studentAvatar: AVATAR,
      submissionType: 'text',
      status: 'graded',
      grade: 67,
      submittedAt: new Date('2026-09-05T09:00:00.000Z'),
    },
  ];

  const otherStudents = studentUsers.filter(u => u.id !== 'usr-stud-1');
  for (let i = 3; i < 50; i++) {
    const student = otherStudents[i % otherStudents.length];
    const course = courses[i % courses.length];
    submissions.push({
      id: `seed-sub-${String(i).padStart(4, '0')}`,
      activityId: `${course.id}-act-1`,
      courseId: course.id,
      studentId: student.id,
      studentName: student.name,
      studentAvatar: AVATAR,
      submissionType: 'text',
      status: 'graded',
      grade: 75 + (i % 20),
      submittedAt: new Date(Date.UTC(2026, 8, 3 + (i % 20), 9, 0, 0)),
    });
  }

  const courseGrades: DbRecord[] = [
    { id: 'cg-1', courseId: 'course-1', studentId: 'usr-stud-1', midtermGrade: 85, finalGrade: 88, sprCells: '{}', updatedAt: new Date() },
    { id: 'cg-2', courseId: 'seed-c-01', studentId: 'usr-stud-1', midtermGrade: 67, finalGrade: 68, sprCells: '{}', updatedAt: new Date() },
  ];

  const calendarEvents: DbRecord[] = [];
  for (let i = 1; i <= 15; i++) {
    const c = courses[i % courses.length];
    calendarEvents.push({
      id: `seed-evt-${String(i).padStart(2, '0')}`,
      title: `Event ${i}: ${c.code}`,
      date: `2026-10-${String(2 + (i % 24)).padStart(2, '0')}`,
      time: '9:00 AM - 12:00 PM',
      courseId: c.id,
      courseCode: c.code,
      type: 'academic',
      description: `Scheduled academic event for ${c.code}.`,
    });
  }

  const messages: DbRecord[] = [];
  for (let i = 1; i <= 30; i++) {
    const c = courses[i % courses.length];
    messages.push({
      id: `seed-msg-${String(i).padStart(2, '0')}`,
      senderId: 'usr-fac-1',
      senderName: 'Faculty 1',
      senderRole: 'faculty',
      recipientId: 'usr-stud-1',
      recipientName: 'Student 1',
      recipientRole: 'student',
      courseId: c.id,
      courseCode: c.code,
      subject: `Advisory ${i} for ${c.code}`,
      body: `Notice ${i} regarding ${c.code}.`,
      timestamp: new Date(),
    });
  }

  return {
    course: courses,
    courseSection: courseSections,
    enrollmentRequest: enrollmentRequests,
    user: users,
    module: modules,
    moduleItem: moduleItems,
    activity: activities,
    quiz: quizzes,
    exam: exams,
    announcement: announcements,
    submission: submissions,
    courseGrade: courseGrades,
    calendarEvent: calendarEvents,
    message: messages,
  };
}

let store = createInitialStore();

export function resetDbStore() {
  store = createInitialStore();
}

function matchesWhere(item: DbRecord, where?: Record<string, any>): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === 'OR' && Array.isArray(val)) {
      if (!val.some(subWhere => matchesWhere(item, subWhere))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(val)) {
      if (!val.every(subWhere => matchesWhere(item, subWhere))) return false;
      continue;
    }
    const itemVal = item[key];
    if (val !== null && typeof val === 'object') {
      if (Array.isArray(val.in)) {
        if (!val.in.includes(itemVal)) return false;
      }
      if (val.startsWith !== undefined) {
        if (typeof itemVal !== 'string' || !itemVal.startsWith(val.startsWith)) return false;
      }
      if (val.equals !== undefined) {
        if (itemVal !== val.equals) return false;
      }
      if (val.not !== undefined) {
        if (itemVal === val.not) return false;
      }
    } else {
      if (itemVal !== val) return false;
    }
  }
  return true;
}

function applySelect(item: DbRecord, select?: Record<string, boolean>): DbRecord {
  if (!select) return { ...item };
  const res: Record<string, any> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled && key in item) {
      res[key] = item[key];
    }
  }
  return res;
}

function createDelegate(modelName: keyof ReturnType<typeof createInitialStore>) {
  return {
    async count(opts: { where?: Record<string, any> } = {}): Promise<number> {
      const records = store[modelName] || [];
      return records.filter(r => matchesWhere(r, opts.where)).length;
    },

    async findMany(opts: {
      where?: Record<string, any>;
      select?: Record<string, boolean>;
      orderBy?: any;
      take?: number;
      skip?: number;
    } = {}): Promise<DbRecord[]> {
      let records = (store[modelName] || []).filter(r => matchesWhere(r, opts.where));

      if (opts.orderBy) {
        const orderRules = Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy];
        records.sort((a, b) => {
          for (const rule of orderRules) {
            const [field, direction] = Object.entries(rule)[0] as [string, string];
            const valA = a[field] ?? '';
            const valB = b[field] ?? '';
            const cmp = typeof valA === 'string' ? valA.localeCompare(String(valB)) : valA - valB;
            if (cmp !== 0) return direction.toLowerCase() === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }

      if (opts.skip !== undefined) {
        records = records.slice(opts.skip);
      }
      if (opts.take !== undefined) {
        records = records.slice(0, opts.take);
      }

      return records.map(r => applySelect(r, opts.select));
    },

    async aggregate(opts: {
      where?: Record<string, any>;
      _avg?: Record<string, boolean>;
      _sum?: Record<string, boolean>;
      _min?: Record<string, boolean>;
      _max?: Record<string, boolean>;
      _count?: Record<string, boolean> | true;
    } = {}): Promise<any> {
      const records = (store[modelName] || []).filter(r => matchesWhere(r, opts.where));
      const res: Record<string, any> = {};

      if (opts._avg) {
        res._avg = {};
        for (const field of Object.keys(opts._avg)) {
          const vals = records.map(r => Number(r[field])).filter(n => !isNaN(n));
          res._avg[field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        }
      }

      if (opts._sum) {
        res._sum = {};
        for (const field of Object.keys(opts._sum)) {
          const vals = records.map(r => Number(r[field])).filter(n => !isNaN(n));
          res._sum[field] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
        }
      }

      if (opts._min) {
        res._min = {};
        for (const field of Object.keys(opts._min)) {
          const vals = records.map(r => Number(r[field])).filter(n => !isNaN(n));
          res._min[field] = vals.length ? Math.min(...vals) : null;
        }
      }

      if (opts._max) {
        res._max = {};
        for (const field of Object.keys(opts._max)) {
          const vals = records.map(r => Number(r[field])).filter(n => !isNaN(n));
          res._max[field] = vals.length ? Math.max(...vals) : null;
        }
      }

      if (opts._count) {
        res._count = records.length;
      }

      return res;
    },

    async findUnique(opts: { where: Record<string, any>; select?: Record<string, boolean> }): Promise<DbRecord | null> {
      const records = store[modelName] || [];
      const found = records.find(r => matchesWhere(r, opts.where));
      return found ? applySelect(found, opts.select) : null;
    },

    async findUniqueOrThrow(opts: { where: Record<string, any>; select?: Record<string, boolean> }): Promise<DbRecord> {
      const records = store[modelName] || [];
      const found = records.find(r => matchesWhere(r, opts.where));
      if (!found) throw new Error(`Record not found in ${String(modelName)}`);
      return applySelect(found, opts.select);
    },

    async findFirst(opts: { where?: Record<string, any>; select?: Record<string, boolean> } = {}): Promise<DbRecord | null> {
      const records = store[modelName] || [];
      const found = records.find(r => matchesWhere(r, opts.where));
      return found ? applySelect(found, opts.select) : null;
    },

    async create(opts: { data: DbRecord }): Promise<DbRecord> {
      const record = { ...opts.data };
      if (!record.id) record.id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      (store[modelName] as DbRecord[]).push(record);
      return record;
    },

    async update(opts: { where: Record<string, any>; data: Record<string, any> }): Promise<DbRecord> {
      const records = store[modelName] as DbRecord[];
      const idx = records.findIndex(r => matchesWhere(r, opts.where));
      if (idx === -1) throw new Error(`Record not found to update in ${String(modelName)}`);
      records[idx] = { ...records[idx], ...opts.data };
      return records[idx];
    },

    async updateMany(opts: { where?: Record<string, any>; data: Record<string, any> }): Promise<{ count: number }> {
      const records = store[modelName] as DbRecord[];
      let count = 0;
      for (let i = 0; i < records.length; i++) {
        if (matchesWhere(records[i], opts.where)) {
          records[i] = { ...records[i], ...opts.data };
          count++;
        }
      }
      return { count };
    },

    async delete(opts: { where: Record<string, any> }): Promise<DbRecord> {
      const records = store[modelName] as DbRecord[];
      const idx = records.findIndex(r => matchesWhere(r, opts.where));
      if (idx === -1) throw new Error(`Record not found to delete in ${String(modelName)}`);
      const deleted = records.splice(idx, 1)[0];
      return deleted;
    },

    async deleteMany(opts: { where?: Record<string, any> }): Promise<{ count: number }> {
      const records = store[modelName] as DbRecord[];
      const before = records.length;
      store[modelName] = records.filter(r => !matchesWhere(r, opts.where)) as any;
      return { count: before - (store[modelName] as DbRecord[]).length };
    },
  };
}

export const prisma: any = {
  course: createDelegate('course'),
  courseSection: createDelegate('courseSection'),
  enrollmentRequest: createDelegate('enrollmentRequest'),
  user: createDelegate('user'),
  module: createDelegate('module'),
  moduleItem: createDelegate('moduleItem'),
  activity: createDelegate('activity'),
  quiz: createDelegate('quiz'),
  exam: createDelegate('exam'),
  announcement: createDelegate('announcement'),
  submission: createDelegate('submission'),
  courseGrade: createDelegate('courseGrade'),
  calendarEvent: createDelegate('calendarEvent'),
  message: createDelegate('message'),
  async $queryRaw() { return []; },
  async $executeRaw() { return 1; },
  async $disconnect() { return; },
};
