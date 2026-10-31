# Syllabus Studio Section 6 — References: Alphabetical Order & APA Italics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** References created in Syllabus Studio Step 6 are stored alphabetically and rendered with APA 7 italics in Step 6, the saved syllabus view, and the printed document preview (which today shows hardcoded sample references).

**Architecture:** Two pure helpers live next to the existing APA formatter in `shared/data/syllabusData.ts` — `sortReferences()` (APA sort key: authors → year → title → citation) and `formatApa7ReferenceSegments()` (`[{text, italic?}]`; `formatApa7Reference()` becomes a join of the segments so string and styled output cannot drift). A small `ApaReferenceText` component in `features/syllabus/components/` renders segments as `<em>`, used by Step 6, `SyllabusView`, and `SyllabusDocumentPreview`. The stored `citation` string and the backend payload shape do not change.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library (jsdom), Tailwind classes, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-31-syllabus-step6-references-order-and-apa-italics-design.md`

## Global Constraints

- No Directus/Likha schema or payload changes; `references` stays `ReferenceItem[]` with a flat `citation: string`.
- Never store HTML (`<em>`) inside `citation`; italics are presentation-only.
- Never mutate `data`/props: `sortReferences` returns a new array; preview sorts defensively with a copy.
- `formatApa7Reference()` string output must remain byte-identical to its current behavior (pinned by Task 1 tests).
- No automatic sentence-case/title-case rewriting of user-entered titles.
- Never re-sort while a form edit is open (Step 6 `editingIndex` and inline-editor indices must stay valid); sort only at save/commit.
- Feature-folder rules from `AGENTS.md`: `ApaReferenceText` lives in `features/syllabus/components/`; helpers live next to the existing formatter in `shared/data/syllabusData.ts` (the module that already owns `formatApa7Reference`).
- No new npm dependencies.
- Test command (single run, no watch): `cd client && npx vitest run <file>`. Typecheck: `cd client && npm run typecheck`. Lint: `cd client && npm run lint`.

## Review Focus

1. **Legacy refs with only a `citation` string** (scanned/imported syllabi): must render as plain text with no italics, no crash, no empty line — pinned by preview + Step 6 tests in Tasks 3/5.
2. **Ties (same author, same year):** sort must be stable — input order preserved — pinned in Task 2's unit test.
3. **Accent/case variants** (`émile` vs `Emile`) must sort together — pinned in Task 2's unit test.
4. **Zero references in the printed preview:** no Part V sheets at all, page count shrinks, no crash — pinned in Task 5.
5. **Rapid double-click on "Add Reference"** (pressure test): `saveReference` runs twice; today the second click saves the already-cleared form as an empty book ref that then sorts to the top. Pre-existing behavior, do not fix here, but verify manually that nothing crashes and no duplicate of the just-added ref appears.

---

### Task 1: APA segment formatter (italics) with byte-identical string output

**Files:**
- Modify: `client/src/shared/data/syllabusData.ts:128-197` (`formatApa7Reference` + new exports)
- Test: `client/src/shared/data/syllabusData.test.ts` (new; colocated like `collegesData.test.ts`)

**Interfaces:**
- Consumes: existing `ReferenceItem`, `ReferenceType` in the same file.
- Produces (used by Tasks 3/5):
  - `export interface ApaSegment { text: string; italic?: boolean }`
  - `export function formatApa7ReferenceSegments(ref: Partial<ReferenceItem>): ApaSegment[]`
  - `formatApa7Reference(ref: Partial<ReferenceItem>): string` — unchanged signature, now `formatApa7ReferenceSegments(ref).map(s => s.text).join('')`.

- [ ] **Step 1: Write the failing tests** in `client/src/shared/data/syllabusData.test.ts`

```ts
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

  it('website: italic page title only', () => {
    const ref = { type: 'website' as const, authors: 'World Health Organization', year: '2023', title: 'COVID-19 pandemic overview', websiteName: 'World Health Organization', url: 'https://www.who.int/emergencies' };
    const italics = formatApa7ReferenceSegments(ref).filter(s => s.italic).map(s => s.text);
    expect(italics).toEqual(['COVID-19 pandemic overview']);
    expect(formatApa7Reference(ref)).toBe('World Health Organization (2023). COVID-19 pandemic overview. World Health Organization. https://www.who.int/emergencies');
  });

  it('legacy ref with only a citation string: single plain segment', () => {
    const ref = { citation: 'Some legacy citation text.', year: '2020' };
    expect(formatApa7ReferenceSegments(ref)).toEqual([{ text: 'Some legacy citation text.' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/shared/data/syllabusData.test.ts`
Expected: FAIL — `formatApa7ReferenceSegments` is not exported.

- [ ] **Step 3: Implement** in `client/src/shared/data/syllabusData.ts`

Add `export interface ApaSegment { text: string; italic?: boolean }`. Implement `formatApa7ReferenceSegments` by mirroring the existing per-type part assembly in `formatApa7Reference` (lines 128–197), emitting each part as segments: the title (book/website) or journal name + volume (journal) become `{ text, italic: true }` with the trailing period, commas, parentheses, issue and pages as plain segments; all other parts stay plain; explicit plain `' '` segments replace the old `parts.join(' ')` separators; normalize whitespace within each segment so the joined string matches the old `.replace(/\s+/g, ' ').trim()`. Refactor `formatApa7Reference` to `formatApa7ReferenceSegments(ref).map(s => s.text).join('')`. Keep the legacy `return ref.citation || ''` fallback as a single plain segment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/shared/data/syllabusData.test.ts`
Expected: PASS (all 5). If a string-parity assertion fails, fix the segment builder, not the test.

- [ ] **Step 5: Regression-check existing formatter consumers**

Run: `cd client && npx vitest run src/features/syllabus src/shared`
Expected: PASS — especially `syllabusParser.test.ts` (`/dalkir/i` citation check) and `WizardStepsLate.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/data/syllabusData.ts client/src/shared/data/syllabusData.test.ts
git commit -m "feat(syllabus): APA segment formatter with italics, string output unchanged"
```

---

### Task 2: `sortReferences` — APA-order sort key

**Files:**
- Modify: `client/src/shared/data/syllabusData.ts` (add below `formatApa7Reference`)
- Test: `client/src/shared/data/syllabusData.test.ts`

**Interfaces:**
- Produces (used by Tasks 3/4/5):
  - `export function sortReferences(refs: ReferenceItem[]): ReferenceItem[]` — non-mutating; returns a new array.

- [ ] **Step 1: Write the failing tests** (append to `syllabusData.test.ts`)

```ts
import { sortReferences } from './syllabusData';

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
    const a = mk('Alonzo, A.', '2020', 'First');
    const b = mk('Alonzo, A.', '2020', 'Second');
    expect(sortReferences([b, a])).toEqual([b, a]);
  });

  it('refs without authors sort by citation text; leading The/A/An ignored in the title tiebreak', () => {
    const noAuthor1 = { citation: 'Anonymous report on testing. (2020).', year: '2020' };
    const noAuthor2 = { citation: 'The complete guide to testing. (2021).', year: '2021' };
    const titled = mk('', '2019', 'The Complete Guide to Testing');
    expect(sortReferences([noAuthor2, noAuthor1]).map(r => r.year)).toEqual(['2020', '2021']);
    expect(sortReferences([titled, noAuthor2])[0].year).toBe('2021');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/shared/data/syllabusData.test.ts`
Expected: FAIL — `sortReferences` is not exported.

- [ ] **Step 3: Implement `sortReferences` in `client/src/shared/data/syllabusData.ts`**

Key per spec: normalize authors (trim, NFD accent-strip, lowercase) → year (integer of first 4-digit run, `''`/unparseable → 0) → title (accent-strip, lowercase, strip leading `The `/`A `/`An `) → citation (accent-strip, lowercase). Refs with empty authors fall back to the citation text as the primary key. Return `[...refs].sort(...)` — never mutate.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/shared/data/syllabusData.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/data/syllabusData.ts client/src/shared/data/syllabusData.test.ts
git commit -m "feat(syllabus): sortReferences with APA sort key (authors, year, title, citation)"
```

---

### Task 3: `ApaReferenceText` component + Step 6 sorts on save and renders italics

**Files:**
- Create: `client/src/features/syllabus/components/ApaReferenceText.tsx`
- Modify: `client/src/features/syllabus/components/creator/steps/Step6GradingPolicies.tsx:74-107` (`saveReference`) and `:540-542` (list render)
- Test: `client/src/features/syllabus/components/creator/steps/Step6ReferenceOrder.test.tsx` (new)

**Interfaces:**
- Consumes: `sortReferences`, `formatApa7ReferenceSegments`, `ReferenceItem` from `shared/data/syllabusData`.
- Produces: `export const ApaReferenceText: React.FC<{ reference: ReferenceItem; className?: string }>` — renders segments as text with `<em>` for italic ones; if the ref has no structured fields (`!ref.authors && !ref.title`), renders `ref.citation` as plain text.

- [ ] **Step 1: Write the failing tests** in `Step6ReferenceOrder.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Step6GradingPolicies } from './Step6GradingPolicies';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';

const base = { facultyMembers: [], institutionalStatements: {}, programOutcomes: [], courseOutcomes: [], courseRequirements: { major: [], other: [] }, gradingSystem: {}, projectRubrics: [], classroomPolicies: [], courseOutline: [], learningPlan: [], courseMap: [], signatories: { preparedBy: [], recommendingApproval: { name: '', title: '' }, approved: { name: '', title: '' } } } as unknown as OfficialSyllabusData;

const zed = { citation: 'Zulueta, Z. (2020). Zed Systems. Zed Press.', authors: 'Zulueta, Z.', year: '2020', title: 'Zed Systems', publisher: 'Zed Press' };

describe('Step 6 reference ordering and italics', () => {
  it('stores newly added references alphabetically (APA key)', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={{ ...base, references: [zed] } as OfficialSyllabusData} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Laplante, P\. or Dalkir, K\./i), { target: { value: 'Alonzo, A.' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText(/What Every Engineer/i), { target: { value: 'Alpha Systems' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Reference/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const refs = onChange.mock.calls[0][0].references;
    expect(refs[0].authors).toBe('Alonzo, A.');
    expect(refs[1].authors).toBe('Zulueta, Z.');
  });

  it('renders saved references with APA italics (book title inside <em>)', () => {
    render(<Step6GradingPolicies data={{ ...base, references: [zed] } as OfficialSyllabusData} onChange={vi.fn()} />);
    expect(screen.getByText('Zed Systems').closest('em')).not.toBeNull();
  });

  it('legacy citation-only refs render as plain text', () => {
    render(<Step6GradingPolicies data={{ ...base, references: [{ citation: 'Legacy plain citation.', year: '2020' }] } as OfficialSyllabusData} onChange={vi.fn()} />);
    expect(screen.getByText('Legacy plain citation.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/features/syllabus/components/creator/steps/Step6ReferenceOrder.test.tsx`
Expected: FAIL — `ApaReferenceText` does not exist / `refs[0].authors` is `'Zulueta, Z.'` (insertion order) / title not inside `<em>`.

- [ ] **Step 3: Implement**

Create `ApaReferenceText.tsx` per its Produces interface, importing `formatApa7ReferenceSegments` and the `ReferenceItem` type from `shared/data/syllabusData`. In `Step6GradingPolicies.tsx`: in `saveReference`, wrap the `updated` array with `sortReferences(updated)` before `onChange`; replace the list body `{ref.citation || formatApa7Reference(ref)}` (line 541) with `<ApaReferenceText reference={ref} />`. Do not touch `removeReference`/`editReference` index logic — the array is only re-ordered after a save, and `editingIndex` is reset in the same handler.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/features/syllabus/components/creator/steps/Step6ReferenceOrder.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 5: Regression-check Step 6 suite**

Run: `cd client && npx vitest run src/features/syllabus/components/creator/steps`
Expected: PASS — `WizardStepsLate.test.tsx` and `WizardStepsEarly.test.tsx` unchanged.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/syllabus/components/ApaReferenceText.tsx client/src/features/syllabus/components/creator/steps/Step6GradingPolicies.tsx client/src/features/syllabus/components/creator/steps/Step6ReferenceOrder.test.tsx
git commit -m "feat(syllabus): Step 6 stores references alphabetically and renders APA italics"
```

---

### Task 4: Saved syllabus view — italics in the references block, sort on section commit

**Files:**
- Modify: `client/src/features/syllabus/SyllabusView.tsx:471-495` (`saveDraft`) and `:3885` (saved references render)
- Test: `client/src/features/syllabus/SyllabusView.test.tsx`

**Interfaces:**
- Consumes: `sortReferences` from `shared/data/syllabusData`; `ApaReferenceText` from `./components/ApaReferenceText` (same feature, relative import allowed).

- [ ] **Step 1: Write the failing tests** (append to `SyllabusView.test.tsx` inside `describe('SyllabusView revision editing')`)

Make `syllabusDoc()` read a mutable module-level `let testReferences: ReferenceItem[] = []` for its `references` field, and reset it in `afterEach`.

```tsx
const bookRef = { citation: 'Laplante, P. (2023). Zed Engineering. CRC Press.', authors: 'Laplante, P.', year: '2023', title: 'Zed Engineering', publisher: 'CRC Press' };
const alonzoRef = { citation: 'Alonzo, A. (2022). Alpha Design. MIT Press.', authors: 'Alonzo, A.', year: '2022', title: 'Alpha Design', publisher: 'MIT Press' };

test('references section commit stores references alphabetically', async () => {
  testReferences = [bookRef, alonzoRef];
  render(<SyllabusView courseId="c1" />);
  const editButtons = screen.getAllByTitle('Edit section');
  fireEvent.click(editButtons[editButtons.length - 1]!); // referencesSignatures is the last section
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(mocks.updateSyllabusSection).toHaveBeenCalled());
  const refCall = mocks.updateSyllabusSection.mock.calls.find(c => c[1] === 'references')!;
  expect((refCall[2] as { authors: string }[]).map(r => r.authors)).toEqual(['Alonzo, A.', 'Laplante, P.']);
});

test('saved references render with APA italics', () => {
  testReferences = [bookRef];
  render(<SyllabusView courseId="c1" />);
  expect(screen.getByText('Zed Engineering').closest('em')).not.toBeNull();
});
```

Note: `syllabusDoc()` is called inside the `vi.mock` factory closure — the mutable variable must be read at call time (keep `references: testReferences` inside the function body, not captured at module init).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/features/syllabus/SyllabusView.test.tsx`
Expected: FAIL — stored order is insertion order (`Laplante` first) and title is not inside `<em>`.

- [ ] **Step 3: Implement** in `SyllabusView.tsx`

In `saveDraft` (line 471), after the lock/grading guards, build `const draftToSave = editingSection === 'referencesSignatures' ? { ...draft, references: sortReferences(draft.references ?? []) } : draft;` and use `draftToSave` in the `syllabusEditorSectionPayloads`/`updateCourseSyllabus` calls. At line 3885 replace `{ref.citation}` with `<ApaReferenceText reference={ref} />` (keep the `doiOrPublisher` line as-is). Import `sortReferences` and `ApaReferenceText`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/features/syllabus/SyllabusView.test.tsx`
Expected: PASS (new tests + all existing revision tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/SyllabusView.tsx client/src/features/syllabus/SyllabusView.test.tsx
git commit -m "feat(syllabus): saved syllabus view renders APA italics; references section commit sorts"
```

---

### Task 5: Printed document preview — real, sorted, italicized Part V references

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx:1408-1444` (delete hardcoded Part V blocks) and insert reference sheet builders in both branches
- Test: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`

**Interfaces:**
- Consumes: `sortReferences`, `ReferenceItem` from `shared/data/syllabusData`; `ApaReferenceText` from `../ApaReferenceText`.
- Produces: local `const REFERENCES_PER_SHEET = 12;` and reference sheet builders appended to `sheetBuilders` before the signatories sheet in BOTH the dense branch (currently ends with sheets 16–17) and the sparse `else` branch (before the signatories-only sheet at line 1508).

- [ ] **Step 1: Write the failing tests** (append to `SyllabusDocumentPreview.test.tsx`)

```tsx
const structuredRefs = [
  { citation: 'Laplante, P. (2023). What Every Engineer Should Know About Software Engineering. CRC Press.', authors: 'Laplante, P.', year: '2023', title: 'What Every Engineer Should Know About Software Engineering', publisher: 'CRC Press' },
  { citation: 'Alonzo, A. (2022). Alpha Design. MIT Press.', authors: 'Alonzo, A.', year: '2022', title: 'Alpha Design', publisher: 'MIT Press' },
  { citation: 'Dalkir, K. (2019). Knowledge management in practice. Journal of Knowledge Management, 85(7/8), 162-171.', authors: 'Dalkir, K.', year: '2019', title: 'Knowledge management in practice', journal: 'Journal of Knowledge Management', volume: '85', issue: '7/8', pages: '162-171' },
  { citation: 'Legacy plain citation. (2020).', year: '2020' },
];

it('renders the real references in Part V, alphabetized, with APA italics; sample text removed', () => {
  const { container } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: [...structuredRefs].reverse() }} />);
  expect(screen.queryByText(/Dilan, R\./)).not.toBeInTheDocument();
  const emTexts = Array.from(container.querySelectorAll('em')).map(e => e.textContent);
  expect(emTexts).toContain('What Every Engineer Should Know About Software Engineering');
  expect(emTexts).toContain('Journal of Knowledge Management');
  // Legacy citation-only ref renders plain, no crash.
  expect(screen.getByText('Legacy plain citation. (2020).')).toBeInTheDocument();
  // Alphabetical: Alonzo citation appears before Laplante citation in document order.
  const text = container.textContent || '';
  expect(text.indexOf('Alonzo, A.')).toBeLessThan(text.indexOf('Laplante, P.'));
});

it('chunks references: 13 refs render one more sheet than 12 refs (12 per sheet)', () => {
  const mkMany = (n: number) => Array.from({ length: n }, (_, i) => ({ citation: `Author ${String.fromCharCode(65 + i)}. (${2020 + (i % 5)}). Book ${i + 1}. Press.`, authors: `Author ${String.fromCharCode(65 + i)}.`, year: String(2020 + (i % 5)), title: `Book ${i + 1}`, publisher: 'Press' }));
  const { container: with12 } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: mkMany(12) }} />);
  cleanup();
  const { container: with13 } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: mkMany(13) }} />);
  expect(with13.querySelectorAll('.syllabus-page-sheet').length).toBe(with12.querySelectorAll('.syllabus-page-sheet').length + 1);
});

it('zero references: no Part V sheet, no crash', () => {
  const { container } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: [] }} />);
  expect(screen.queryByText(/Part V: References/i)).not.toBeInTheDocument();
  expect(container.querySelectorAll('.syllabus-page-sheet').length).toBeGreaterThan(0);
});
```

Note: `cleanup` is already imported in `SyllabusDocumentPreview.test.tsx`? Verify at Step 1; if not, add it to the existing `@testing-library/react` import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`
Expected: FAIL — sample text present (`Dilan, R.`), real refs absent, `<em>` absent.

- [ ] **Step 3: Implement** in `SyllabusDocumentPreview.tsx`

1. Compute once near line 152: `const sortedReferences = sortReferences(references ?? []);` and chunk it: `const referenceChunks: ReferenceItem[][] = ...` splitting `sortedReferences` into groups of `REFERENCES_PER_SHEET`.
2. Delete the hardcoded Part V block from sheet 16 (heading + 8 sample `<div>`s, lines ~1408–1418) — sheet 16 keeps the course-map table and legend. Delete the batch-2 sample block from sheet 17 (lines ~1436–1444) — sheet 17 keeps signatories.
3. Add a reference sheet builder used in both branches: for each chunk, push a landscape sheet with `renderHeaderBox()`, the `Part V: References` heading only on the first chunk, the chunk's refs as `<div className="pl-8 -indent-8 leading-[1.16] text-justify"><ApaReferenceText reference={ref} /></div>`, and `renderFooter(pageNo, total)`. In the dense branch insert these builders between the course-map sheet and the signatories sheet; in the sparse branch insert them before the signatories-only sheet. With zero refs, push nothing (skip Part V entirely).
4. `computedTotal = sheetBuilders.length` (line 1565) already recomputes — verify no other hardcoded page totals exist.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`
Expected: PASS — including the pre-existing "renders all 5 parts" test (`Part V: References` still present for CSPC112) and "Page 1 of N" footer consistency.

- [ ] **Step 5: Regression-check the full syllabus feature**

Run: `cd client && npx vitest run src/features/syllabus src/shared`
Expected: PASS — all suites green.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx
git commit -m "feat(syllabus): printed Part V renders real alphabetized references with APA italics"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full client test suite**

Run: `cd client && npx vitest run`
Expected: all suites PASS, zero failures.

- [ ] **Step 2: Typecheck and lint**

Run: `cd client && npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual pressure check (dev server, optional but recommended)**

Run: `cd client && npm run dev` — in Syllabus Studio → Step 6: add 3 refs out of order (double-click "Add Reference" once to check the Review Focus item), open the document preview, print-preview. Expected: list alphabetized with visible italics, Part V paginates, no console errors.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore(syllabus): references ordering and APA italics — final verification"
```
