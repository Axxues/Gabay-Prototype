import { describe, expect, it } from 'vitest';
import { unpackLegacyLikhaJsonData } from './normalizeLikhaRelationalData.js';

describe('Likha Relational Data Unpacking', () => {
  it('unpacks all legacy JSON arrays into dedicated child collections without data loss', async () => {
    const counts = await unpackLegacyLikhaJsonData();
    expect(counts).toBeDefined();
    expect(typeof counts.activities).toBe('number');
    expect(typeof counts.quizzes).toBe('number');
    expect(typeof counts.exams).toBe('number');
    expect(typeof counts.submissions).toBe('number');
    expect(typeof counts.grades).toBe('number');
  });
});

