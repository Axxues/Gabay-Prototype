import { describe, expect, it } from 'vitest';
import { SyllabusNormalizationError } from '../utils/syllabusNormalization.js';
import { legacyFixture } from './fixtures.js';
import {
  getSection,
  mapLegacyToWriteModel,
  mapWriteModelToDocument,
  replaceSection,
} from './mapper.js';

const expectedDocument = {
  courseId: 'course-1',
  institution: {
    university: 'Example University',
    college: 'College of Computing',
    formCode: 'INS-F003',
    revision: 'REV. 03',
  },
  courseInfo: {
    code: 'CS 201',
    title: 'Data Structures',
    semester: 'First Semester',
    academicYear: '2026-2027',
    type: 'Lecture and Laboratory',
    credit: '3 units',
    lectureHours: '2 hours/week',
    labHours: '3 hours/week',
    prerequisite: 'CS 101',
    description: 'Study foundational data structures and algorithms.',
  },
  facultyMembers: [
    {
      name: 'Dr. Ada Lovelace',
      sections: [
        { section: 'A', schedule: 'MW 09:00-10:00', room: 'Room 101' },
        { section: 'B', schedule: 'TTh 13:00-14:00', room: 'Room 102' },
      ],
      consultation: 'M 15:00-16:00',
    },
    {
      name: 'Dr. Grace Hopper',
      sections: [{ section: 'C', schedule: 'F 09:00-12:00', room: 'Lab 2' }],
      consultation: 'W 16:00-17:00',
    },
  ],
  institutionalStatements: {
    philosophy: 'Education for service.',
    vision: 'A trusted learning community.',
    mission: 'Teach responsible computing.',
    goal: 'Produce capable and ethical graduates.',
    coreValues: [
      { acronym: 'S', keyword: 'Service', description: 'Serve the community.' },
      { acronym: 'E', keyword: 'Excellence', description: 'Pursue quality.' },
    ],
    graduateAttributes: [
      { number: 1, title: 'Competent', description: 'Applies computing knowledge.' },
      { number: 2, title: 'Ethical', description: 'Uses technology responsibly.' },
    ],
  },
  programOutcomes: [
    { number: 1, description: 'Apply computing knowledge to solve problems.' },
    { number: 2, description: 'Design and evaluate software systems.' },
  ],
  courseOutcomes: [
    { number: 1, statement: 'Explain abstract data types.' },
    { number: 2, statement: 'Implement and analyze core data structures.' },
  ],
  courseRequirements: {
    major: ['Midterm examination', 'Final examination'],
    other: ['Laboratory exercises', 'Class participation'],
  },
  gradingSystem: {
    termFormula: '60% class standing + 40% examination',
    finalFormula: '50% midterm + 50% final',
    classStandingComponents: ['Quizzes', 'Laboratory work', 'Participation'],
    passingGrade: '3.0',
  },
  projectRubrics: [
    {
      category: 'Implementation',
      levels: {
        1: 'Does not meet requirements.',
        2: 'Meets some requirements.',
        3: 'Meets requirements.',
        4: 'Exceeds requirements.',
      },
    },
  ],
  classroomPolicies: ['Attend every class.', 'Submit work on time.'],
  courseOutline: [
    { timeFrame: 'Prelim', title: 'Foundations', topics: ['Arrays', 'Complexity'] },
    { timeFrame: 'Finals', title: 'Capstone', topics: ['Integration', 'Presentation'] },
  ],
  learningPlan: [
    {
      week: 'Weeks 1-6',
      hoursLab: 3,
      hoursLec: 2,
      learningOutcomes: ['Explain array operations.'],
      topics: ['Arrays', 'Complexity'],
      methodology: ['Lecture', 'Laboratory'],
      resources: ['Course notes', 'IDE'],
      assessment: ['Quiz', 'Laboratory report'],
      sdgCoherence: {
        goal: '4',
        title: 'Quality Education',
        description: 'Build foundational skills.',
        target: 'By the end of the course.',
      },
    },
    {
      week: 'Weeks 7-12',
      hoursLab: 3,
      hoursLec: 2,
      learningOutcomes: ['Implement a tree structure.'],
      topics: ['Trees', 'Hashing'],
      methodology: ['Discussion', 'Laboratory'],
      resources: ['Textbook', 'IDE'],
      assessment: ['Workshop', 'Project checkpoint'],
      sdgCoherence: {
        goal: '9',
        title: 'Industry and Innovation',
        description: 'Build resilient systems.',
      },
    },
  ],
  courseMap: [
    {
      coNumber: 1,
      coStatement: 'Historical map wording',
      poAlignments: { 1: 'I', 2: 'D' },
    },
    {
      coNumber: 2,
      coStatement: 'Historical second wording',
      poAlignments: { 1: 'P', 2: '' },
    },
  ],
  references: [
    {
      citation: 'Koffman and Wolfgang, Data Structures',
      year: '2024',
      doiOrPublisher: 'Publisher',
    },
    { citation: 'Course notes', year: '2026' },
  ],
  signatories: {
    preparedBy: [{ name: 'Dr. Ada Lovelace', title: 'Course Instructor' }],
    recommendingApproval: { name: 'Dr. Grace Hopper', title: 'Department Chair' },
    approved: { name: 'Dean Example', title: 'College Dean' },
  },
  sourceDocument: {
    fileName: 'cs201-syllabus.pdf',
    fileSize: '42 KB',
    fileType: 'pdf',
    fileDataUrl: 'data:application/pdf;base64,fixture',
    uploadedAt: '2026-09-24T08:00:00.000Z',
  },
} as const;

describe('syllabus relational mapper', () => {
  it('round-trips ordered sections and preserves the map statement', () => {
    const model = mapLegacyToWriteModel(legacyFixture, 'syllabus-1', 'course-1');
    const document = mapWriteModelToDocument(model);

    expect(model.courseOutline.map((row) => row.position)).toEqual([0, 1]);
    expect(model.courseOutline.map((row) => row.timeFrame)).toEqual(['Prelim', 'Finals']);
    expect(model.learningPlan.map((row) => row.position)).toEqual([0, 1]);
    expect(model.courseOutcomes.map((row) => row.position)).toEqual([0, 1]);
    expect(model.courseMap[0].poAlignments).toEqual([
      { programOutcomeNumber: 1, level: 'I', position: 0 },
      { programOutcomeNumber: 2, level: 'D', position: 1 },
    ]);
    expect(model.courseMap[0].coStatement).toBe('Historical map wording');
    expect(model.courseMap[1].poAlignments).toEqual([
      { programOutcomeNumber: 1, level: 'P', position: 0 },
    ]);
    expect(model.sourceDocument).toEqual({
      fileName: 'cs201-syllabus.pdf',
      fileSize: '42 KB',
      fileType: 'pdf',
      fileDataUrl: 'data:application/pdf;base64,fixture',
      uploadedAt: '2026-09-24T08:00:00.000Z',
    });
    expect(model.extensions).toEqual([
      { path: '$.extensions.example', value: { enabled: true } },
    ]);

    expect(document).toEqual(expectedDocument);
    expect(document).not.toHaveProperty('extensions');
  });

  it('reconstructs rubric levels from relational level rows', () => {
    const model = mapLegacyToWriteModel(legacyFixture, 'syllabus-1', 'course-1');
    const relationalModel = {
      ...model,
      projectRubrics: [
        {
          ...model.projectRubrics[0],
          levels: {},
          levelRows: [
            { level: 1 as const, description: 'Relational level one.' },
            { level: 2 as const, description: 'Relational level two.' },
            { level: 3 as const, description: 'Relational level three.' },
            { level: 4 as const, description: 'Relational level four.' },
          ],
        },
      ],
    };

    expect(mapWriteModelToDocument(relationalModel).projectRubrics[0].levels).toEqual({
      1: 'Relational level one.',
      2: 'Relational level two.',
      3: 'Relational level three.',
      4: 'Relational level four.',
    });
  });

  it('replaces one section without mutating other sections', () => {
    const model = mapLegacyToWriteModel(legacyFixture, 'syllabus-1', 'course-1');
    const next = replaceSection(model, 'policies', ['New policy']);

    expect(next.policies).toEqual(['New policy']);
    expect(replaceSection(model, 'policies', [{ text: 'New policy', position: 7 }]).policies).toEqual([
      'New policy',
    ]);
    expect(replaceSection(model, 'courseMap', getSection(model, 'courseMap')).courseMap).toEqual(
      model.courseMap,
    );
    expect(next.courseOutline).toEqual(model.courseOutline);
    expect(next.courseOutline).toBe(model.courseOutline);
    expect(model.policies).not.toEqual(next.policies);
  });

  it('keeps migration-only source payload out of the document', () => {
    const model = mapLegacyToWriteModel(
      {
        ...legacyFixture,
        sourceDocument: {
          ...legacyFixture.sourceDocument,
          legacyPayload: { original: true },
        },
      },
      'syllabus-1',
      'course-1',
    );
    const document = mapWriteModelToDocument(model);

    expect(model.sourceDocument).toHaveProperty('legacyPayload', { original: true });
    expect(document.sourceDocument).not.toHaveProperty('legacyPayload');
  });

  it('retains non-container extension values', () => {
    const model = mapLegacyToWriteModel(
      { ...legacyFixture, extensions: 'retained' },
      'syllabus-1',
      'course-1',
    );

    expect(model.extensions).toContainEqual({ path: '$.extensions', value: 'retained' });
  });

  it('returns section payloads and rejects non-object legacy input', () => {
    const model = mapLegacyToWriteModel(JSON.stringify(legacyFixture), 'syllabus-1', 'course-1');

    expect(getSection(model, 'courseOutcomes')).toEqual(model.courseOutcomes);
    expect(() => mapLegacyToWriteModel([], 'syllabus-1', 'course-1')).toThrow(
      SyllabusNormalizationError,
    );
    expect(() => mapLegacyToWriteModel(42, 'syllabus-1', 'course-1')).toThrow(
      SyllabusNormalizationError,
    );
  });
});
