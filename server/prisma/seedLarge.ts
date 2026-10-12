// server/prisma/seedLarge.ts — one-shot LARGE dev-data seed for RAG evaluation.
//
// What it does (in order):
//   1. Deletes prior `seed-` rows (re-runnable) in FK-safe order.
//   2. Deletes true orphans: Secret Module (+ its items) and Secret Memo
//      (point at nonexistent course c-mu08kkgj-euxrd5), Nibbas messages
//      (recipient does not exist).
//   3. Renames FK-referenced placeholder titles to realistic ones
//      (rename preserves referential integrity; IDs unchanged).
//   4. Normalizes the stray student2 account into a realistic student.
//   5. Inserts ~55 new users (11 faculty + 44 students) + 8 courses with
//      sections, modules/items, activities, quizzes, exams, announcements,
//      ~184 enrollments, ~360 submissions, ~184 course grades, 15 calendar
//      events, 30 inbox messages. All deterministic (mulberry32, fixed seed)
//      so evaluation ground truth is stable. Prints ground-truth JSON.
//
// Run:  npx tsx prisma/seedLarge.ts   (from server/)
// Rollback: npx tsx prisma/seedLargeCleanup.ts  (deletes seed- rows only)
import '../src/env.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';

const AVATAR = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80';
const TERM = '1st Semester 2026-2027';

// Deterministic PRNG (mulberry32) — stable ground truth across runs.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260922);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const gradeFor = (i: number) => 65 + ((i * 37 + 11) % 36); // 65..100 deterministic
// Unique join codes (SQL Server allows a single NULL per UNIQUE column).
const JC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const joinCodeFor = (i: number) =>
  'SD' + [0, 1, 2, 3].map((k) => JC[(i * 5 + k * 7 + 3) % JC.length]).join('');

// ---------------------------------------------------------------- cleanup
async function deleteSeedRows() {
  // Course-scoped rows first (covers original-student rows in seed- courses),
  // then FK children, parents, users last (courses reference instructors).
  await prisma.submission.deleteMany({ where: { OR: [{ id: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.enrollmentRequest.deleteMany({ where: { OR: [{ id: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.courseGrade.deleteMany({ where: { OR: [{ studentId: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.moduleItem.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.activity.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.quiz.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.exam.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.announcement.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.module.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.courseSection.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.course.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.message.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.calendarEvent.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: 'seed-' } } });
}

async function deleteOrphans() {
  // Secret Module items first (FK), then the module + memo (nonexistent course).
  const orphanItems = await prisma.moduleItem.findMany({
    where: { moduleId: 'mod-mu08kkhh-hjm3k0' }, select: { id: true },
  });
  for (const it of orphanItems) await prisma.moduleItem.delete({ where: { id: it.id } });
  await prisma.module.deleteMany({ where: { id: 'mod-mu08kkhh-hjm3k0' } });
  await prisma.announcement.deleteMany({ where: { id: 'ann-mu08kkhy-3gwamg' } });
  // Nibbas messages (recipient never existed).
  await prisma.message.deleteMany({ where: { id: { in: ['msg-mu0narzh-08edmp', 'msg-mu0naw4v-7iwabw'] } } });
  console.log(`orphans removed: ${orphanItems.length} secret-module items, secret module+memo, 2 nibbas messages`);
}

// ------------------------------------------------------- rename placeholders
const TITLE_FIXES: Array<[model: 'course' | 'module' | 'moduleItem' | 'activity' | 'quiz' | 'announcement', id: string, title: string]> = [
  ['course', 'c-mu46gspp-0bgqfk', 'Web Engineering Fundamentals'],
  ['course', 'c-mu6kt4ad-i57mgn', 'Data Structures Laboratory'],
  ['module', 'mod-mu35p6ug-gp1mi2', 'Introduction to Artificial Intelligence'],
  ['module', 'mod-mu3a2wf4-p1tyt0', 'Intelligent Agents and Environments'],
  ['module', 'mod-mu3dsmdf-xklalo', 'Uninformed Search Strategies'],
  ['module', 'mod-mu3dw7wz-2n93xg', 'Machine Learning Basics'],
  ['module', 'mod-mu46h3i9-pcgitq', 'Web Engineering Overview'],
  ['module', 'mod-mu577pls-pj5ogw', 'AI Course Orientation'],
  ['module', 'mod-mu57m81a-841bpq', 'Expert Systems and Knowledge Representation'],
  ['module', 'mod-mu6ktc8y-01m3qb', 'Stacks and Queues'],
  ['module', 'mod-mu6l1b0e-ombn34', 'Trees and Graphs'],
  ['moduleItem', 'item-mu46pgtu-cuchat', 'Lecture 1: Course Overview'],
  ['moduleItem', 'item-mu46xyrb-lnq1g9', 'Handout: Class Policies'],
  ['moduleItem', 'item-mu4mm9q3-9x3bk1', 'Reading: Introduction to Computing'],
  ['moduleItem', 'item-mu6l0sf3-fiztjs', 'Quiz Link: Midterm Quiz'],
  ['moduleItem', 'item-mu6l1wk9-fbpk7q', 'Activity Link: Final Project'],
  ['activity', 'asg-mu2zo57y-1pk7at', 'Problem Set 1: Logic and Proofs'],
  ['activity', 'asg-mu303w0z-bfvzam', 'Problem Set 2: Relations and Functions'],
  ['activity', 'asg-mu3gw270-399pfh', 'Laboratory Exercise 8: Sorting Algorithms'],
  ['activity', 'act-mu6l1wjq-2hqjqg', 'Final Project: Capstone Prototype'],
  ['activity', 'act-mu6l680v-ftdt1i', 'Case Study: Enrollment System Analysis'],
  ['quiz', 'quiz-mu6l0sdo-86gvva', 'Midterm Quiz: Data Structures'],
  ['announcement', 'ann-mu3a3ggb-iuam4t', 'Welcome and Course Policies'],
  ['announcement', 'ann-mu3eats4-8mn281', 'Midterm Examination Schedule'],
  ['announcement', 'ann-mu57q4uf-d31jve', 'Finals Project Guidelines'],
  ['announcement', 'ann-mu6l4dox-6ccsju', 'Laboratory Schedule Update'],
];

async function renamePlaceholders() {
  for (const [model, id, title] of TITLE_FIXES) {
    const m = (prisma as any)[model];
    await m.updateMany({ where: { id }, data: { title } });
  }
  // Normalize stray student2 account.
  const hash = await bcrypt.hash('gabay2026', 10);
  await prisma.user.updateMany({
    where: { id: 'usr-mu0fu10w-vwio13' },
    data: {
      name: 'Marco Dela Cruz', email: 'student2@dmmmsu.edu.ph', passwordHash: hash,
      department: 'BS Computer Science', title: '3rd Year Student',
    },
  });
  console.log(`renamed ${TITLE_FIXES.length} placeholder titles + normalized student2`);
}

// ------------------------------------------------------------------- people
const FACULTY: Array<[string, string, string]> = [
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

// ------------------------------------------------------------------ courses
interface CourseDef { code: string; title: string; topics: [string, string, string]; }
const COURSES: CourseDef[] = [
  { code: 'CMSC 131', title: 'Web Engineering', topics: ['HTML, CSS and Responsive Design', 'JavaScript and Frontend Frameworks', 'Backend APIs and Deployment'] },
  { code: 'CMSC 141', title: 'Automata Theory and Formal Languages', topics: ['Finite Automata and Regular Expressions', 'Context-Free Grammars and Pushdown Automata', 'Turing Machines and Computability'] },
  { code: 'CMSC 142', title: 'Operating Systems', topics: ['Processes and Thread Management', 'Memory Management and Virtualization', 'File Systems and Concurrency'] },
  { code: 'CMSC 125', title: 'Logic Design and Digital Circuits', topics: ['Boolean Algebra and Gate Networks', 'Combinational and Sequential Circuits', 'Registers, Counters and Memory Units'] },
  { code: 'CMSC 126', title: 'Numerical Methods', topics: ['Root Finding and Error Analysis', 'Interpolation and Numerical Integration', 'Linear Systems and Differential Equations'] },
  { code: 'IT 111', title: 'Introduction to Computing', topics: ['Computing History and Professions', 'Computer Hardware and Software', 'Data Representation and Security Basics'] },
  { code: 'CMSC 191', title: 'Undergraduate Thesis I', topics: ['Thesis Proposal Writing', 'Literature Review Methods', 'Research Design and Ethics'] },
  { code: 'CMSC 195', title: 'Industry Practicum', topics: ['Workplace Readiness and Documentation', 'Practicum Deployment and Mentoring', 'Final Report and Evaluation'] },
];
const SCHEDULES = ['MWF 8:00-9:00 AM', 'MWF 10:00-11:00 AM', 'TTh 1:00-2:30 PM', 'TTh 3:00-4:30 PM'];
const LOCATIONS = ['CCS Building Room 201', 'CCS Building Room 202', 'IT Laboratory 1', 'IT Laboratory 2'];
const MSG_SUBJECTS = ['Midterm Exam Reminder', 'Project Milestone Check', 'Quiz Results Released', 'Laboratory Make-up Schedule', 'Thesis Consultation', 'Enrollment Verification', 'Assignment Extension Request', 'Class Suspension Advisory'];
const EVENT_TITLES = ['Midterm Examination Week', 'Thesis Proposal Defense', 'Capstone Exhibit', 'Enrollment Period', 'University Foundation Anniversary'];

async function main() {
  await deleteSeedRows();
  await deleteOrphans();
  await renamePlaceholders();

  const passHash = await bcrypt.hash('gabay2026', 10);

  // ---- faculty
  const facultyIds: string[] = ['usr-fac-1'];
  for (let i = 0; i < FACULTY.length; i++) {
    const id = `seed-fac-${String(i + 2).padStart(2, '0')}`;
    const [name, title, dept] = FACULTY[i];
    await prisma.user.create({
      data: {
        id, name, email: `faculty${i + 2}@dmmmsu.edu.ph`, passwordHash: passHash,
        role: 'faculty', avatar: AVATAR, department: dept, title,
      },
    });
    facultyIds.push(id);
  }

  // ---- students (44 new; + renamed student2 + usr-stud-1 = 46 total)
  const studentIds: string[] = ['usr-stud-1', 'usr-mu0fu10w-vwio13'];
  for (let i = 0; i < 44; i++) {
    const id = `seed-stud-${String(i + 2).padStart(2, '0')}`;
    const name = `${STUDENT_FIRST[i % STUDENT_FIRST.length]} ${STUDENT_LAST[(i * 7) % STUDENT_LAST.length]}`;
    const year = 1 + ((i * 5) % 4);
    await prisma.user.create({
      data: {
        id, name, email: `student${i + 3}@dmmmsu.edu.ph`, passwordHash: passHash,
        role: 'student', avatar: AVATAR, department: 'BS Computer Science',
        title: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year Student`,
      },
    });
    studentIds.push(id);
  }

  // ---- courses + sections
  const courseIds: string[] = [];
  for (let i = 0; i < COURSES.length; i++) {
    const c = COURSES[i];
    const id = `seed-c-${String(i + 1).padStart(2, '0')}`;
    const fid = facultyIds[i % facultyIds.length];
    const finstr = await prisma.user.findUniqueOrThrow({ where: { id: fid } });
    await prisma.course.create({
      data: {
        id, code: c.code, title: c.title, section: 'BSCS 3-1', term: TERM,
        instructorId: fid, instructorName: finstr.name, published: true, enrolledCount: 0,
        joinCode: joinCodeFor(i),
      },
    });
    for (let s = 0; s < 2; s++) {
      await prisma.courseSection.create({
        data: {
          id: `${id}-sec-${s + 1}`, courseId: id,
          name: s === 0 ? 'BSCS 3-1' : 'BSCS 3-2',
          capacity: 40, enrolledCount: 0,
          schedule: SCHEDULES[(i + s) % SCHEDULES.length],
          location: LOCATIONS[(i + s) % LOCATIONS.length],
        },
      });
    }
    courseIds.push(id);
  }

  // ---- learning content per new course
  const activityIds: string[][] = [];
  for (let i = 0; i < COURSES.length; i++) {
    const cid = courseIds[i];
    const acts: string[] = [];
    for (let m = 0; m < 3; m++) {
      const mid = `${cid}-mod-${m + 1}`;
      await prisma.module.create({
        data: { id: mid, courseId: cid, title: `Module ${m + 1}: ${COURSES[i].topics[m]}`, order: m, published: true },
      });
      const itemTypes = ['page', 'activity', 'quiz'];
      for (let k = 0; k < 3; k++) {
        await prisma.moduleItem.create({
          data: {
            id: `${mid}-item-${k + 1}`, moduleId: mid,
            title: `${itemTypes[k] === 'page' ? 'Lecture Notes' : itemTypes[k] === 'activity' ? 'Activity Guide' : 'Practice Quiz'}: ${COURSES[i].topics[m].split(' ').slice(0, 3).join(' ')}`,
            type: itemTypes[k], published: true, required: k === 0,
          },
        });
      }
    }
    const actTitles = ['Problem Set', 'Laboratory Exercise', 'Case Study'];
    for (let a = 0; a < 3; a++) {
      const aid = `${cid}-act-${a + 1}`;
      await prisma.activity.create({
        data: {
          id: aid, courseId: cid, title: `${actTitles[a]} ${a + 1}: ${COURSES[i].topics[a].split(' ').slice(0, 3).join(' ')}`,
          instructions: `Complete the ${actTitles[a].toLowerCase()} covering ${COURSES[i].topics[a]}. Show all solutions and submit before the deadline.`,
          pointsPossible: 100, published: true, term: a === 0 ? 'midterm' : a === 1 ? 'midterm' : 'finals',
          format: 'classic',
        },
      });
      acts.push(aid);
    }
    for (let q = 0; q < 2; q++) {
      await prisma.quiz.create({
        data: {
          id: `${cid}-quiz-${q + 1}`, courseId: cid,
          title: `${q === 0 ? 'Midterm' : 'Finals'} Quiz: ${COURSES[i].topics[q === 0 ? 1 : 2].split(' ').slice(0, 3).join(' ')}`,
          instructions: `Answer all items within the time limit. Passing score is 60 percent.`,
          timeLimitMinutes: 60, published: true, term: q === 0 ? 'midterm' : 'finals',
          dueDate: new Date(Date.UTC(2026, q === 0 ? 8 : 10, 15 + (i % 10), 8, 0, 0)),
        },
      });
    }
    await prisma.exam.create({
      data: {
        id: `${cid}-exam-1`, courseId: cid, title: `Midterm Examination: ${COURSES[i].code}`,
        instructions: `Closed-notes examination covering Modules 1 to 2.`,
        timeLimitMinutes: 90, published: true, term: 'midterm',
      },
    });
    for (let n = 0; n < 2; n++) {
      await prisma.announcement.create({
        data: {
          id: `${cid}-ann-${n + 1}`, courseId: cid,
          title: n === 0 ? `Welcome to ${COURSES[i].code}` : `${COURSES[i].code} Midterm Schedule`,
          content: n === 0
            ? `Welcome to ${COURSES[i].title}. Please read the syllabus and check the module sequence.`
            : `The midterm examination for ${COURSES[i].code} is scheduled per the academic calendar.`,
          authorId: facultyIds[i % facultyIds.length],
          authorName: (await prisma.user.findUniqueOrThrow({ where: { id: facultyIds[i % facultyIds.length] } })).name,
          authorAvatar: AVATAR, authorRole: 'faculty',
        },
      });
    }
    activityIds.push(acts);
  }

  // ---- enrollments: every student x 4 courses (deterministic rotation)
  let reqN = 0; const approvedMap = new Map<string, number>();
  for (let s = 0; s < studentIds.length; s++) {
    const sid = studentIds[s];
    const sname = (await prisma.user.findUniqueOrThrow({ where: { id: sid } })).name;
    for (let e = 0; e < 4; e++) {
      const cid = courseIds[(s + e) % courseIds.length];
      const status = (s * 4 + e) % 10 === 9 ? 'pending' : 'approved';
      await prisma.enrollmentRequest.create({
        data: {
          id: `seed-req-${String(reqN).padStart(4, '0')}`, courseId: cid,
          studentId: sid, studentName: sname, type: 'self_join', status,
          requestedAt: new Date(Date.UTC(2026, 7, 5 + ((s + e) % 20), 8, 0, 0)),
        },
      });
      if (status === 'approved') approvedMap.set(cid, (approvedMap.get(cid) ?? 0) + 1);
      reqN++;
    }
  }
  for (const [cid, n] of approvedMap) {
    await prisma.course.update({ where: { id: cid }, data: { enrolledCount: n } });
    await prisma.courseSection.updateMany({ where: { courseId: cid }, data: { enrolledCount: Math.ceil(n / 2) } });
  }

  // ---- submissions: per enrollment, first 2 activities of the course
  let subN = 0;
  const enrollments = await prisma.enrollmentRequest.findMany({
    where: { status: 'approved', studentId: { in: studentIds }, courseId: { in: courseIds } },
    select: { courseId: true, studentId: true, studentName: true },
  });
  for (let e = 0; e < enrollments.length; e++) {
    const en = enrollments[e];
    const ci = courseIds.indexOf(en.courseId);
    for (let a = 0; a < 2; a++) {
      const graded = (e * 2 + a) % 7 !== 6;
      const g = graded ? gradeFor(e * 2 + a + subN) : null;
      await prisma.submission.create({
        data: {
          id: `seed-sub-${String(subN).padStart(4, '0')}`,
          activityId: activityIds[ci][a], courseId: en.courseId,
          studentId: en.studentId, studentName: en.studentName, studentAvatar: AVATAR,
          submissionType: 'text', status: graded ? 'graded' : 'submitted',
          grade: g, submittedAt: new Date(Date.UTC(2026, 8, 3 + ((e + a) % 20), 9, 0, 0)),
          rubricScores: '[]',
        },
      });
      subN++;
    }
  }

  // ---- course grades per enrollment
  for (let e = 0; e < enrollments.length; e++) {
    const en = enrollments[e];
    await prisma.courseGrade.create({
      data: {
        courseId: en.courseId, studentId: en.studentId,
        midtermGrade: gradeFor(e * 3 + 1), finalGrade: gradeFor(e * 3 + 2),
      },
    });
  }

  // ---- calendar events
  for (let i = 0; i < 15; i++) {
    const cid = courseIds[i % courseIds.length];
    const course = await prisma.course.findUniqueOrThrow({ where: { id: cid } });
    await prisma.calendarEvent.create({
      data: {
        id: `seed-evt-${String(i + 1).padStart(2, '0')}`,
        title: `${EVENT_TITLES[i % EVENT_TITLES.length]}: ${course.code}`,
        date: `2026-10-${String(2 + (i % 24)).padStart(2, '0')}`,
        time: '9:00 AM - 12:00 PM', courseId: cid, courseCode: course.code,
        type: 'academic', description: `Scheduled ${EVENT_TITLES[i % EVENT_TITLES.length].toLowerCase()} for ${course.code} ${course.title}.`,
      },
    });
  }

  // ---- inbox messages (metadata-realistic; bodies excluded from RAG export)
  const fac1 = await prisma.user.findUniqueOrThrow({ where: { id: 'usr-fac-1' } });
  for (let i = 0; i < 30; i++) {
    const fromFac = i % 3 !== 2;
    const sender = fromFac
      ? await prisma.user.findUniqueOrThrow({ where: { id: facultyIds[i % facultyIds.length] } })
      : await prisma.user.findUniqueOrThrow({ where: { id: studentIds[i % studentIds.length] } });
    const recip = fromFac
      ? await prisma.user.findUniqueOrThrow({ where: { id: studentIds[(i * 3) % studentIds.length] } })
      : fac1;
    const cid = courseIds[i % courseIds.length];
    const course = await prisma.course.findUniqueOrThrow({ where: { id: cid } });
    await prisma.message.create({
      data: {
        id: `seed-msg-${String(i + 1).padStart(2, '0')}`,
        senderId: sender.id, senderName: sender.name, senderRole: sender.role,
        recipientId: recip.id, recipientName: recip.name, recipientRole: recip.role,
        courseId: cid, courseCode: course.code,
        subject: MSG_SUBJECTS[i % MSG_SUBJECTS.length],
        body: `This is message ${i + 1} regarding ${course.code}. Please see the LMS for full details.`,
      },
    });
  }

  // ---- ground truth
  const gt = {
    users: await prisma.user.count(),
    faculty: await prisma.user.count({ where: { role: 'faculty' } }),
    students: await prisma.user.count({ where: { role: 'student' } }),
    courses: await prisma.course.count(),
    sections: await prisma.courseSection.count(),
    enrollments: await prisma.enrollmentRequest.count(),
    modules: await prisma.module.count(),
    moduleItems: await prisma.moduleItem.count(),
    activities: await prisma.activity.count(),
    quizzes: await prisma.quiz.count(),
    exams: await prisma.exam.count(),
    announcements: await prisma.announcement.count(),
    submissions: await prisma.submission.count(),
    courseGrades: await prisma.courseGrade.count(),
    calendarEvents: await prisma.calendarEvent.count(),
    messages: await prisma.message.count(),
  };
  console.log('GROUND_TRUTH ' + JSON.stringify(gt));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
