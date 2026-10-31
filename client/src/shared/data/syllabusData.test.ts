import { describe, expect, it } from 'vitest';
import { formatApa7Reference, formatApa7ReferenceSegments } from './syllabusData';

describe('formatApa7ReferenceSegments', () => {
  it('book: italic title only; edition/publisher/period plain; string output identical to legacy', () => {
    const ref = { type: 'book' as const, authors: 'Laplante, P.', year: '2023', title: 'What Every Engineer Should Know About Software Engineering', edition: '3rd ed.', publisher: 'CRC Press', url: 'https://doi.org/10.1201/9781003306894' };
    const segs = formatApa7ReferenceSegments(ref);
    expect(segs.find(s => s.italic)).toEqual({ text: 'What Every Engineer Should Know About Software Engineering', italic: true });
    expect(formatApa7Reference(ref)).toBe('Laplante, P. (2023). What Every Engineer Should Know About Software Engineering (3rd ed.). CRC Press. https://doi.org/10.1201/9781003306894');
  });

  it('book without edition: trailing period after italic title is plain', () => {
    const ref = { type: 'book' as const, authors: 'Dalkir, K.', year: '', title: 'Knowledge Management in Theory and Practice' };
    expect(formatApa7ReferenceSegments(ref).filter(s => s.italic)).toEqual([{ text: 'Knowledge Management in Theory and Practice', italic: true }]);
    expect(formatApa7Reference(ref)).toBe('Dalkir, K. (n.d.). Knowledge Management in Theory and Practice.');
  });

  it('journal: italic journal name and volume; issue/pages/commas plain; string output identical to legacy', () => {
    const ref = { type: 'journal' as const, authors: 'Dalkir, K.', year: '2019', title: 'Knowledge management', journal: 'Harvard Business Review', volume: '85', issue: '7/8', pages: '162-171', url: 'https://doi.org/x' };
    const italics = formatApa7ReferenceSegments(ref).filter(s => s.italic).map(s => s.text);
    expect(italics).toEqual(['Knowledge management', 'Harvard Business Review', '85']);
    expect(formatApa7Reference(ref)).toBe('Dalkir, K. (2019). Knowledge management. Harvard Business Review, 85(7/8), 162-171. https://doi.org/x');
  });

  it('website: italic page title only (legacy appends period to author)', () => {
    const ref = { type: 'website' as const, authors: 'World Health Organization', year: '2023', title: 'COVID-19 pandemic overview', websiteName: 'World Health Organization', url: 'https://www.who.int/emergencies' };
    const italics = formatApa7ReferenceSegments(ref).filter(s => s.italic).map(s => s.text);
    expect(italics).toEqual(['COVID-19 pandemic overview']);
    expect(formatApa7Reference(ref)).toBe('World Health Organization. (2023). COVID-19 pandemic overview. World Health Organization. https://www.who.int/emergencies');
  });

  it('citation-only ref with a year: legacy book-branch parity (citation ignored by formatter)', () => {
    const ref = { citation: 'Some legacy citation text.', year: '2020' };
    expect(formatApa7ReferenceSegments(ref)).toEqual([{ text: '(2020).' }]);
  });
});
