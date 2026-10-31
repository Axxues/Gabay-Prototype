import { describe, expect, it } from 'vitest';
import { formatApa7Reference, formatApa7ReferenceSegments, sortReferences } from './syllabusData';

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

describe('sortReferences', () => {
  const mk = (authors: string, year: string, title = 'T') => ({ citation: `${authors || title} (${year}).`, authors, year, title });

  it('orders by author surname, then year, case/accent-insensitively; does not mutate input', () => {
    const zed = mk('Zulueta, Z.', '2020');
    const emile = mk('émile, D.', '2021');
    const emileUpper = mk('EMILE, D.', '2022');
    const alonzo = mk('Alonzo, A.', '2023');
    const input = [zed, emile, emileUpper, alonzo];
    const out = sortReferences(input);
    expect(out.map(r => r.year)).toEqual(['2023', '2021', '2022', '2020']);
    expect(input.map(r => r.year)).toEqual(['2020', '2021', '2022', '2023']);
  });

  it('same author: earlier year first; missing year (n.d.) first', () => {
    const out = sortReferences([mk('Dalkir, K.', '2023'), mk('Dalkir, K.', '2019'), mk('Dalkir, K.', '')]);
    expect(out.map(r => r.year)).toEqual(['', '2019', '2023']);
  });

  it('exact ties keep input order (stable)', () => {
    const a = { ...mk('Alonzo, A.', '2020', 'First'), publisher: 'One' };
    const b = { ...mk('Alonzo, A.', '2020', 'First'), publisher: 'Two' };
    expect(sortReferences([b, a])).toEqual([b, a]);
  });

  it('refs without authors sort by citation text; leading The/A/An ignored in the title tiebreak', () => {
    const noAuthor1 = { citation: 'Anonymous report on testing. (2020).', year: '2020' };
    const noAuthor2 = { citation: 'The complete guide to testing. (2021).', year: '2021' };
    const titled = mk('', '2019', 'The Complete Guide to Testing');
    expect(sortReferences([noAuthor2, noAuthor1]).map(r => r.year)).toEqual(['2020', '2021']);
    expect(sortReferences([titled, noAuthor2])[0].year).toBe('2019');
  });
});
