import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  SyllabusValidationError,
  parseExpectedRowVersion,
  validateSectionPayload,
} from './validation.js';
import type { SyllabusSectionKey } from './contracts.js';

const validSections: Array<[SyllabusSectionKey, unknown]> = [
  ['institution', { university: 'U', college: 'C', formCode: 'F', revision: 'R' }],
  [
    'courseInfo',
    {
      code: 'CS 201',
      title: 'Data Structures',
      semester: 'First',
      academicYear: '2026-2027',
      type: 'Lecture',
      credit: '3',
      lectureHours: '2',
      labHours: '3',
      prerequisite: 'CS 101',
      description: 'Desc',
    },
  ],
  [
    'faculty',
    [{ name: 'Dr. A', sections: [{ section: 'A', schedule: 'MW', room: 'R1' }], consultation: 'M' }],
  ],
  [
    'institutionalStatements',
    {
      philosophy: 'p',
      vision: 'v',
      mission: 'm',
      goal: 'g',
      coreValues: [{ acronym: 'S', keyword: 'Service', description: 'd' }],
      graduateAttributes: [{ number: 1, title: 't', description: 'd' }],
    },
  ],
  ['programOutcomes', [{ number: 1, description: 'Apply knowledge.' }]],
  ['courseOutcomes', [{ number: 1, statement: 'Explain ADTs.' }]],
  ['requirements', { major: ['Midterm exam'], other: ['Lab work'] }],
  [
    'gradingSystem',
    { termFormula: '60% + 40%', finalFormula: '50% + 50%', classStandingComponents: ['Quizzes'], passingGrade: '3.0' },
  ],
  ['rubrics', [{ category: 'Implementation', levels: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' } }]],
  ['policies', ['Attend every class.']],
  ['outline', [{ timeFrame: 'Prelim', title: 'Foundations', topics: ['Arrays'] }]],
  [
    'learningPlan',
    [
      {
        week: 'Weeks 1-6',
        hoursLab: 3,
        hoursLec: 2,
        learningOutcomes: ['Explain arrays.'],
        topics: ['Arrays'],
        methodology: ['Lecture'],
        resources: ['Notes'],
        assessment: ['Quiz'],
      },
    ],
  ],
  ['courseMap', [{ coNumber: 1, coStatement: 'Historical wording', poAlignments: { 1: 'I', 2: '' } }]],
  ['references', [{ citation: 'Koffman, Data Structures', year: '2024' }]],
  [
    'signatories',
    {
      preparedBy: [{ name: 'Dr. A', title: 'Instructor' }],
      recommendingApproval: { name: 'Dr. B', title: 'Chair' },
      approved: { name: 'Dean', title: 'Dean' },
    },
  ],
  [
    'sourceDocument',
    { fileName: 's.pdf', fileSize: '42 KB', fileType: 'pdf', uploadedAt: '2026-09-24T08:00:00.000Z' },
  ],
];

function reqWith(headers: Record<string, string> = {}, body: unknown = {}): Request {
  return { headers, body } as unknown as Request;
}

describe('validateSectionPayload', () => {
  it.each(validSections)('accepts a valid %s payload', (section, value) => {
    expect(() => validateSectionPayload(section, value)).not.toThrow();
  });

  it('allows empty list replacement', () => {
    expect(validateSectionPayload('policies', [])).toEqual([]);
    expect(validateSectionPayload('programOutcomes', [])).toEqual([]);
    expect(validateSectionPayload('references', [])).toEqual([]);
  });

  it('rejects invalid types per section', () => {
    expect(() => validateSectionPayload('institution', 'nope')).toThrow(SyllabusValidationError);
    expect(() => validateSectionPayload('faculty', {})).toThrow(SyllabusValidationError);
    expect(() => validateSectionPayload('policies', 'nope')).toThrow(SyllabusValidationError);
    expect(() => validateSectionPayload('learningPlan', 'nope')).toThrow(SyllabusValidationError);
    expect(() => validateSectionPayload('requirements', [])).toThrow(SyllabusValidationError);
  });

  it('rejects an unknown section name', () => {
    expect(() => validateSectionPayload('unknown' as SyllabusSectionKey, {})).toThrow(
      SyllabusValidationError,
    );
  });

  it('rejects unknown top-level fields inside a section', () => {
    expect(() =>
      validateSectionPayload('institution', { university: 'U', college: 'C', formCode: 'F', revision: 'R', bogus: 1 }),
    ).toThrow(SyllabusValidationError);
  });

  it('rejects invalid enum values', () => {
    expect(() =>
      validateSectionPayload('sourceDocument', {
        fileName: 's.pdf',
        fileSize: '1 KB',
        fileType: 'exe',
        uploadedAt: '2026-09-24T08:00:00.000Z',
      }),
    ).toThrow(SyllabusValidationError);
    expect(() =>
      validateSectionPayload('courseMap', [{ coNumber: 1, coStatement: 's', poAlignments: { 1: 'X' } }]),
    ).toThrow(SyllabusValidationError);
  });

  it('rejects duplicate positions', () => {
    expect(() =>
      validateSectionPayload('programOutcomes', [
        { number: 1, description: 'a', position: 0 },
        { number: 2, description: 'b', position: 0 },
      ]),
    ).toThrow(SyllabusValidationError);
  });

  it('rejects invalid numeric ranges', () => {
    expect(() =>
      validateSectionPayload('learningPlan', [
        {
          week: 'W1',
          hoursLab: -1,
          hoursLec: 2,
          learningOutcomes: [],
          topics: [],
          methodology: [],
          resources: [],
          assessment: [],
        },
      ]),
    ).toThrow(SyllabusValidationError);
  });

  it('rejects malformed nested objects', () => {
    expect(() =>
      validateSectionPayload('outline', [{ title: 'Missing timeframe', topics: 'nope' }]),
    ).toThrow(SyllabusValidationError);
    expect(() => validateSectionPayload('courseOutcomes', [{ number: 'one' }])).toThrow(
      SyllabusValidationError,
    );
  });

  it('carries the invalid_syllabus_section code', () => {
    try {
      validateSectionPayload('policies', 42);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SyllabusValidationError);
      expect((err as SyllabusValidationError).code).toBe('invalid_syllabus_section');
    }
  });
});

describe('parseExpectedRowVersion', () => {
  it('reads the If-Match header', () => {
    expect(parseExpectedRowVersion(reqWith({ 'if-match': '3' }))).toBe(3);
  });

  it('reads the body fallback', () => {
    expect(parseExpectedRowVersion(reqWith({}, { expectedRowVersion: 2 }))).toBe(2);
  });

  it('rejects a missing version', () => {
    expect(() => parseExpectedRowVersion(reqWith())).toThrow();
  });

  it('rejects a non-integer version', () => {
    expect(() => parseExpectedRowVersion(reqWith({ 'if-match': 'abc' }))).toThrow();
  });

  it('carries the invalid_syllabus_section code for version preconditions', () => {
    for (const req of [reqWith(), reqWith({ 'if-match': 'abc' })]) {
      try {
        parseExpectedRowVersion(req);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(SyllabusValidationError);
        expect((err as SyllabusValidationError).code).toBe('invalid_syllabus_section');
      }
    }
  });
});
