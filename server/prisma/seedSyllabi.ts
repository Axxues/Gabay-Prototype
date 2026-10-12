// server/prisma/seedSyllabi.ts — backfills OfficialSyllabusData-shaped JSON into
// every course whose syllabus column is NULL. Deterministic per-course content
// (code/title/topics/instructor from the DB row). Re-runnable: only touches
// NULL-syllabus rows. Existing (real) syllabi are never overwritten.
//
// Run: npx tsx prisma/seedSyllabi.ts (from server/)
import '../src/env.js';
import { prisma } from '../src/db.js';

const UNI = {
  university: 'Don Mariano Marcos Memorial State University',
  college: 'College of Computer Science',
  formCode: 'DMMMSU-INS-F003',
  revision: 'REV. 02 (06.23.2025)',
};

const TOPIC_BANK: Record<string, string[]> = {
  'CMSC 131': ['HTML, CSS and Responsive Design', 'JavaScript and Frontend Frameworks', 'Backend APIs and Deployment'],
  'CMSC 141': ['Finite Automata and Regular Expressions', 'Context-Free Grammars and Pushdown Automata', 'Turing Machines and Computability'],
  'CMSC 142': ['Processes and Thread Management', 'Memory Management and Virtualization', 'File Systems and Concurrency'],
  'CMSC 125': ['Boolean Algebra and Gate Networks', 'Combinational and Sequential Circuits', 'Registers, Counters and Memory Units'],
  'CMSC 126': ['Root Finding and Error Analysis', 'Interpolation and Numerical Integration', 'Linear Systems and Differential Equations'],
  'IT 111': ['Computing History and Professions', 'Computer Hardware and Software', 'Data Representation and Security Basics'],
  'CMSC 191': ['Thesis Proposal Writing', 'Literature Review Methods', 'Research Design and Ethics'],
  'CMSC 195': ['Workplace Readiness and Documentation', 'Practicum Deployment and Mentoring', 'Final Report and Evaluation'],
};

function topicsFor(code: string, title: string): string[] {
  return TOPIC_BANK[code] ?? [`${title} Fundamentals`, `${title} Applications`, `${title} Advanced Topics`];
}

function buildSyllabus(course: { id: string; code: string; title: string; section: string; instructorName: string }) {
  const topics = topicsFor(course.code, course.title);
  return {
    courseId: course.id,
    institution: { ...UNI },
    courseInfo: {
      code: course.code,
      title: course.title,
      semester: 'First Semester',
      academicYear: '2026-2027',
      type: 'Lecture and Laboratory',
      credit: '3 units',
      lectureHours: '2 hours/week',
      labHours: '3 hours/week',
      prerequisite: 'As prescribed in the BSCS curriculum checklist',
      description: `${course.code} ${course.title} covers ${topics.join('; ').toLowerCase()}. Students demonstrate mastery through laboratory exercises, examinations, and a capstone output aligned with the program outcomes of the College of Computer Science.`,
    },
    facultyMembers: [{
      name: course.instructorName,
      sections: [{ section: course.section, schedule: 'See class schedule', room: 'CCS Building' }],
      consultation: 'MTWTHF 02:00PM - 03:00PM',
    }],
    institutionalStatements: {
      philosophy: 'Quality education for service and development.',
      vision: 'A premier state university transforming lives and communities.',
      mission: 'To provide quality instruction, research, and extension services.',
      goal: 'To produce competent computing professionals.',
      coreValues: [{ acronym: 'S', keyword: 'Service', description: 'Service to the community.' }],
      graduateAttributes: [{ number: 1, title: 'Competent', description: 'Demonstrates computing competence.' }],
    },
    programOutcomes: [
      { number: 1, description: 'Apply computing knowledge to solve problems.' },
      { number: 2, description: 'Design and evaluate systems and processes.' },
    ],
    courseOutcomes: topics.map((t, i) => ({
      number: i + 1,
      statement: `Explain and apply ${t.toLowerCase()} in computing tasks.`,
    })),
    courseRequirements: {
      major: ['Midterm examination', 'Final examination', 'Capstone output'],
      other: ['Laboratory exercises', 'Quizzes', 'Class participation'],
    },
    gradingSystem: {
      termFormula: 'Term grade = 60% class standing + 40% term examination.',
      finalFormula: 'Final grade = 50% midterm grade + 50% final term grade.',
      classStandingComponents: ['Quizzes (30%)', 'Laboratory exercises (40%)', 'Recitation and participation (30%)'],
      passingGrade: '3.0 (75%) and above.',
    },
    projectRubrics: [{
      category: 'Capstone Output',
      levels: {
        1: 'Output does not meet minimum requirements.',
        2: 'Output partially meets requirements with major gaps.',
        3: 'Output meets requirements with minor gaps.',
        4: 'Output exceeds requirements with exemplary quality.',
      },
    }],
    classroomPolicies: [
      'Regular attendance is required; three consecutive absences merit a warning.',
      'Academic integrity is strictly enforced; plagiarism results in a failing grade.',
      'Laboratory outputs must be submitted on or before the deadline.',
    ],
    courseOutline: topics.map((t, i) => ({
      timeFrame: i === 0 ? 'Prelim period' : i === 1 ? 'Midterm period' : 'Finals period',
      title: t,
      topics: [t],
    })),
    learningPlan: topics.map((t, i) => ({
      week: `Weeks ${i * 6 + 1}-${i * 6 + 6}`,
      hoursLab: 3,
      hoursLec: 2,
      learningOutcomes: [`Explain ${t.toLowerCase()}.`],
      topics: [t],
      methodology: ['Lecture', 'Laboratory hands-on'],
      resources: ['Course handouts', 'Laboratory computers'],
      assessment: ['Quiz', 'Laboratory exercise'],
    })),
    courseMap: topics.map((t, i) => ({ coNumber: i + 1, coStatement: t, poAlignments: { 1: 'D', 2: 'P' } })),
    references: [
      { citation: `${course.code} Course Handouts, College of Computer Science`, year: '2026' },
    ],
    signatories: {
      preparedBy: [{ name: course.instructorName.toUpperCase(), title: 'Course Instructor' }],
      recommendingApproval: { name: 'DEPARTMENT CHAIRPERSON', title: 'Chair, Department of Computer Science' },
      approved: { name: 'COLLEGE DEAN', title: 'Dean, College of Computer Science' },
    },
    sourceDocument: {
      fileName: `${course.code.replace(/\s+/g, '')}_Syllabus_2026.pdf`,
      fileSize: 'seeded',
      fileType: 'pdf',
    },
  };
}

async function main() {
  const empties = await prisma.course.findMany({
    where: { syllabus: null },
    select: { id: true, code: true, title: true, section: true, instructorName: true },
  });
  for (const c of empties) {
    await prisma.course.update({
      where: { id: c.id },
      data: { syllabus: JSON.stringify(buildSyllabus(c)) },
    });
    console.log(`syllabus backfilled: ${c.id} (${c.code} ${c.title})`);
  }
  const remaining = await prisma.course.count({ where: { syllabus: null } });
  console.log(`done. courses still without syllabus: ${remaining}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
