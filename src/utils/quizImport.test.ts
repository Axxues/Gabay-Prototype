// src/utils/quizImport.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyQuizTextLimit,
  classifyQuizImportFile,
  isQuizImportTooLarge,
  parseQuizText,
  QUIZ_IMPORT_MAX_BYTES,
  QUIZ_IMPORT_TEXT_LIMIT,
} from './quizImport';

describe('parseQuizText JSON', () => {
  it('parses a JSON array of questions', () => {
    const drafts = parseQuizText(
      JSON.stringify([
        { text: 'Capital of France?', type: 'identification', correctAnswer: 'Paris', points: 5 },
      ])
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toBe('Capital of France?');
    expect(drafts[0].type).toBe('identification');
    expect(drafts[0].correctAnswer).toBe('Paris');
  });
  it('parses a { questions } wrapper object', () => {
    const drafts = parseQuizText(
      JSON.stringify({ questions: [{ text: '2+2?', type: 'identification', correctAnswer: '4', points: 2 }] })
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].correctAnswer).toBe('4');
  });
});

describe('parseQuizText line parser', () => {
  it('parses a numbered MC block with options and answer key', () => {
    const drafts = parseQuizText('1. What is 2+2?\nA) 3\nB) 4\nC) 5\nAnswer: B');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('multiple_choice');
    expect(drafts[0].text).toBe('What is 2+2?');
    expect(drafts[0].options).toEqual(['3', '4', '5']);
    expect(drafts[0].correctAnswer).toBe('B');
  });
  it('detects true/false via an Answer key', () => {
    const drafts = parseQuizText('1. The sky is blue\nAnswer: True');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('true_false');
    expect(drafts[0].correctAnswer).toBe('True');
    expect(drafts[0].options).toEqual(['True', 'False']);
  });
  it('reads points hints', () => {
    const drafts = parseQuizText('1. Define gravity (10 pts)\nA) Force\nB) Energy\nAnswer: A');
    expect(drafts[0].points).toBe(10);
  });
  it('maps a lone prompt with no options or key to identification', () => {
    const drafts = parseQuizText('What is the capital of France?');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('identification');
    expect(drafts[0].options).toEqual([]);
  });
  it('maps numbered prompts without options to identifications', () => {
    const drafts = parseQuizText('1. Capital of France?\n2. Largest planet?');
    expect(drafts).toHaveLength(2);
    expect(drafts.every(d => d.type === 'identification')).toBe(true);
  });
  it('merges continuation lines into the prompt', () => {
    const drafts = parseQuizText('1. Explain photosynthesis\nin green plants');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toContain('green plants');
  });
  it('maps garbage input to a single identification fallback', () => {
    const drafts = parseQuizText('asdf jkl');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('identification');
  });
  it('returns no drafts for empty input', () => {
    expect(parseQuizText('   \n  ')).toEqual([]);
  });
});

describe('file guards', () => {
  it('classifies quiz file kinds', () => {
    expect(classifyQuizImportFile('quiz.pdf')).toBe('pdf');
    expect(classifyQuizImportFile('Quiz.DOCX')).toBe('docx');
    expect(classifyQuizImportFile('q.txt')).toBe('text');
    expect(classifyQuizImportFile('q.md')).toBe('text');
    expect(classifyQuizImportFile('q.json')).toBe('text');
    expect(classifyQuizImportFile('q.csv')).toBe('text');
    expect(classifyQuizImportFile('legacy.doc')).toBe('unsupported');
    expect(classifyQuizImportFile('sheet.xls')).toBe('unsupported');
  });
  it('enforces the 10 MB cap', () => {
    expect(QUIZ_IMPORT_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(isQuizImportTooLarge(10 * 1024 * 1024 + 1)).toBe(true);
    expect(isQuizImportTooLarge(10 * 1024 * 1024)).toBe(false);
  });
  it('flags truncation at the text limit', () => {
    const big = 'x'.repeat(QUIZ_IMPORT_TEXT_LIMIT + 100);
    const out = applyQuizTextLimit(big);
    expect(out.truncated).toBe(true);
    expect(out.text).toHaveLength(QUIZ_IMPORT_TEXT_LIMIT);
    expect(applyQuizTextLimit('small').truncated).toBe(false);
  });
});
