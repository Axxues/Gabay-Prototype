import { describe, it, expect } from 'vitest';
import { DEFAULT_EVALUATION_MATRIX } from './defaultMatrixTemplate';

describe('DEFAULT_EVALUATION_MATRIX', () => {
  it('is version 1', () => {
    expect(DEFAULT_EVALUATION_MATRIX.version).toBe(1);
  });

  it('has the 6 spec sections in order', () => {
    expect(DEFAULT_EVALUATION_MATRIX.sections.map((s) => s.id)).toEqual([
      'format',
      'part-1',
      'part-2',
      'part-3',
      'part-4',
      'part-5'
    ]);
  });

  it('has the spec criteria counts per section (41 total)', () => {
    const counts = DEFAULT_EVALUATION_MATRIX.sections.map((s) => s.criteria.length);
    expect(counts).toEqual([7, 14, 6, 7, 1, 6]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(41);
  });

  it('gives every criterion a unique non-empty id', () => {
    const ids = DEFAULT_EVALUATION_MATRIX.sections.flatMap((s) => s.criteria.map((c) => c.id));
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('transcribes the first and last criteria verbatim', () => {
    const format = DEFAULT_EVALUATION_MATRIX.sections[0].criteria;
    const references = DEFAULT_EVALUATION_MATRIX.sections[5].criteria;
    expect(format[0].text.startsWith('Margins (1" on all sides)')).toBe(true);
    expect(references[references.length - 1].text.startsWith('Use: Chairperson, Program Dean, CCS')).toBe(true);
  });
});
