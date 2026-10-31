import { describe, expect, it } from 'vitest';
import { isSyllabusGradeReady } from './syllabusGradeGate';

const grading = { termFormula: '60% class standing + 40% exam', finalFormula: '50% midterm + 50% finals' };

describe('isSyllabusGradeReady', () => {
  it('returns false when no syllabus is present', () => {
    expect(isSyllabusGradeReady({ status: 'published' }, null)).toBe(false);
    expect(isSyllabusGradeReady(null, null)).toBe(false);
  });

  it('returns false for a draft revision even with complete grading fields', () => {
    expect(isSyllabusGradeReady({ status: 'draft' }, { gradingSystem: grading })).toBe(false);
  });

  it('returns false when the published syllabus lacks grading formulas', () => {
    expect(
      isSyllabusGradeReady({ status: 'published' }, { gradingSystem: { termFormula: '', finalFormula: '' } }),
    ).toBe(false);
    expect(
      isSyllabusGradeReady({ status: 'published' }, { gradingSystem: { termFormula: 'T', finalFormula: '' } }),
    ).toBe(false);
  });

  it('returns true for a published revision with complete grading fields', () => {
    expect(isSyllabusGradeReady({ status: 'published' }, { gradingSystem: grading })).toBe(true);
  });

  it('returns true when revision status is unknown but grading fields are present', () => {
    expect(isSyllabusGradeReady(null, { gradingSystem: grading })).toBe(true);
    expect(isSyllabusGradeReady(undefined, { gradingSystem: grading })).toBe(true);
  });

  it('returns true for object-format formulas', () => {
    expect(
      isSyllabusGradeReady({ status: 'published' }, {
        gradingSystem: {
          termFormula: { classStandingPercent: '60', examPercent: '40' },
          finalFormula: { midtermPercent: '40', finalPercent: '60' },
        },
      }),
    ).toBe(true);
  });
});
