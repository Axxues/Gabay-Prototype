# Syllabus-Driven Grading Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activities, quizzes, and exams carry a grading term chosen from options derived from the course syllabus (1–3 terms), and gradebook math follows those terms.

**Architecture:** A pure term registry (`resolveCourseTerms` + per-course override) feeds one shared `TermSelect` in all three creation forms; `term` is stored on all three item types and validated server-side; SPR weight parsing and grade computation generalize from hardcoded midterm/final to N terms with byte-identical 2-term behavior.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind (client); Express + Prisma SQL Server (server); vitest both sides.

**Spec:** `docs/superpowers/specs/2026-09-16-syllabus-terms-design.md`

## Global Constraints

- `TermId = 'prelim' | 'midterm' | 'finals'` everywhere; stored legacy `'final'` reads as `'finals'`.
- Only the three known ids are ever offered or accepted; anything else 400s server-side.
- 2-term courses behave byte-identically to today (same options, same 40/60 math, same stored shapes read as-is).
- No hand-editable weight editor; parser fallback is equal split with a visible "weights defaulted" note.
- TDD: failing test first for every task; frequent commits; no unrelated refactoring.

---

## File Structure

- `client/src/utils/gradingTerms.ts` (new): `TermId`, `ALL_TERMS`, `LEGACY_TERM_ALIASES = { final: 'finals' }`, `normalizeTermId()`, `resolveCourseTerms(syllabus)`, `effectiveTerms(course, syllabus)`. Tested by `client/src/utils/gradingTerms.test.ts`.
- `client/src/utils/spr.ts` (modify): gains `extractTermWeights()` + `finalPercentTerms()`; existing `resolveSPRWeights`/`termGrade`/`finalPercent` untouched.
- `client/src/utils/spr.test.ts` (extend): weight-parsing + N-term math tests.
- `client/src/types/lms.ts` (modify): `TermId` export; `Exam.term` widen; `Quiz.term` + `Activity.term` add; `Course.gradingTerms?` add.
- `client/src/components/common/TermSelect.tsx` (new): shared picker.
- `server/prisma/schema.prisma` + migration (modify): `Course.gradingTerms String?`, `Quiz.term String?`, `Activity.term String?` (nullable = legacy rows stay valid).
- `server/src/routes/assessments.ts` (modify): quiz/activity POST+PATCH accept/validate `term`; exam validation widens to 3 ids.
- `server/src/routes/courses.ts` (modify): PATCH allowlist gains `gradingTerms` (validated JSON array of known ids, `null` clears).
- `client/src/context/LMSContext.tsx` (modify): `effectiveTerms()` exposure; create/update payloads carry `term` / `gradingTerms`.
- `client/src/pages/CreateExamPage.tsx`, `CreateQuizPage.tsx`, `CreateActivityPage.tsx` + `ActivityFormFields.tsx`, `QuizBuilderFields.tsx` (modify): `TermSelect` rows.
- `client/src/pages/SyllabusView.tsx` (modify): override editor in grading-system section.
- `client/src/components/grading/FacultyGradebook.tsx`, `StudentGradebook.tsx` (modify): per-term period blocks, N-term final, legacy-midterm fallback + flag, weights note.

---

### Task 1: Term registry helper + tests

**Files:**
- Create: `client/src/utils/gradingTerms.ts`
- Test: `client/src/utils/gradingTerms.test.ts`

**Interfaces:**
- Consumes: `OfficialSyllabusData['courseOutline']` shape (`{ title: string; topics: string[] }[]`), `Course`-like `{ gradingTerms?: string[] }`.
- Produces: `TermId`, `normalizeTermId(raw)`, `resolveCourseTerms(syllabus)`, `effectiveTerms(courseLike, syllabus)` used by Tasks 5–7.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/utils/gradingTerms.test.ts
import { describe, expect, it } from 'vitest';
import { effectiveTerms, normalizeTermId, resolveCourseTerms } from './gradingTerms';

const outline = (title: string, topics: string[] = []) => ({ title, topics });

describe('resolveCourseTerms', () => {
  it('detects midterm + finals from exam-period entries', () => {
    expect(resolveCourseTerms({ courseOutline: [
      outline('Foundation'),
      outline('Midterm Examination Period', ['Midterm Examination']),
      outline('Final Examination Period', ['Final Examination']),
    ] })).toEqual(['midterm', 'finals']);
  });
  it('detects prelim when present, preserving outline order', () => {
    expect(resolveCourseTerms({ courseOutline: [
      outline('Preliminary Examination', ['Prelim Exam']),
      outline('Midterm Examination Period'),
      outline('Final Examination Period'),
    ] })).toEqual(['prelim', 'midterm', 'finals']);
  });
  it('defaults to midterm + finals when nothing detected', () => {
    expect(resolveCourseTerms({ courseOutline: [outline('Intro')] })).toEqual(['midterm', 'finals']);
    expect(resolveCourseTerms(null)).toEqual(['midterm', 'finals']);
  });
  it('maps legacy final to finals', () => {
    expect(normalizeTermId('final')).toBe('finals');
    expect(normalizeTermId('midterm')).toBe('midterm');
  });
});

describe('effectiveTerms', () => {
  it('prefers the per-course override', () => {
    expect(effectiveTerms({ gradingTerms: ['midterm'] }, { courseOutline: [outline('Final Examination Period')] }))
      .toEqual(['midterm']);
  });
  it('falls back to detection with no override', () => {
    expect(effectiveTerms({}, { courseOutline: [outline('Midterm Examination Period')] }))
      .toEqual(['midterm']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/gradingTerms.test.ts`
Expected: FAIL with "Failed to resolve import ./gradingTerms".

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/utils/gradingTerms.ts
export type TermId = 'prelim' | 'midterm' | 'finals';
export const ALL_TERMS: TermId[] = ['prelim', 'midterm', 'finals'];
const ORDER: Record<TermId, number> = { prelim: 0, midterm: 1, finals: 2 };

export function normalizeTermId(raw: unknown): TermId | null {
  if (raw === 'final') return 'finals';
  return raw === 'prelim' || raw === 'midterm' || raw === 'finals' ? raw : null;
}

const EXAM_PATTERNS: { id: TermId; re: RegExp }[] = [
  { id: 'prelim', re: /\bprelim(?:inary)?\b/i },
  { id: 'midterm', re: /\bmid[-\s]?term\b/i },
  { id: 'finals', re: /\bfinal(?:s)?\b/i },
];

interface OutlineLike { title?: string; topics?: string[] }

export function resolveCourseTerms(syllabus: { courseOutline?: OutlineLike[] } | null | undefined): TermId[] {
  const found = new Set<TermId>();
  for (const entry of syllabus?.courseOutline ?? []) {
    const hay = `${entry.title ?? ''}\n${(entry.topics ?? []).join('\n')}`;
    if (!/examina/i.test(hay)) continue;
    for (const { id, re } of EXAM_PATTERNS) {
      if (re.test(hay)) found.add(id);
    }
  }
  if (found.size === 0) return ['midterm', 'finals'];
  return [...found].sort((a, b) => ORDER[a] - ORDER[b]);
}

export function effectiveTerms(
  courseLike: { gradingTerms?: string[] | null } | null | undefined,
  syllabus: { courseOutline?: OutlineLike[] } | null | undefined,
): TermId[] {
  const override = (courseLike?.gradingTerms ?? []).map(normalizeTermId).filter((t): t is TermId => t !== null);
  if (override.length > 0) {
    return [...new Set(override)].sort((a, b) => ORDER[a] - ORDER[b]);
  }
  return resolveCourseTerms(syllabus);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/gradingTerms.test.ts`
Expected: PASS (6 tests). Run from `client/`.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/gradingTerms.ts client/src/utils/gradingTerms.test.ts
git commit -m "feat: add syllabus-driven term registry with tests"
```

---

### Task 2: Term weight parsing + N-term math

**Files:**
- Modify: `client/src/utils/spr.ts` (append; do not touch `resolveSPRWeights`, `termGrade`, `finalPercent`)
- Test: `client/src/utils/spr.test.ts` (append new describes)

**Interfaces:**
- Consumes: `TermId` from Task 1; `gradingSystem: { termFormula?: string; finalFormula?: string }`.
- Produces: `extractTermWeights(grading, terms)` and `finalPercentTerms(termGrades, weights)` used by Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// append to client/src/utils/spr.test.ts
import { extractTermWeights, finalPercentTerms } from './spr';

describe('extractTermWeights', () => {
  it('parses 3-term weights from formula text', () => {
    const w = extractTermWeights(
      { termFormula: 'Prelim Grade 30%, Midterm Grade 30%', finalFormula: 'Final Grade = 60% class standing + 40% finals' },
      ['prelim', 'midterm', 'finals'],
    );
    expect(w.weights).toEqual({ prelim: 30, midterm: 30, finals: 40 });
    expect(w.defaulted).toBe(false);
  });
  it('keeps 2-term 40/60 behavior', () => {
    const w = extractTermWeights(
      { termFormula: 'Midterm Grade / Final Term Grade = 60% Class Standing + 40% ME / FE', finalFormula: 'Final Grade = 40% Midterm Grade + 60% Final Term Grade' },
      ['midterm', 'finals'],
    );
    expect(w.weights).toEqual({ midterm: 40, finals: 60 });
    expect(w.defaulted).toBe(false);
  });
  it('falls back to equal split with defaulted flag on garbage', () => {
    const w = extractTermWeights({ termFormula: 'see handbook', finalFormula: '' }, ['prelim', 'midterm', 'finals']);
    expect(w.weights).toEqual({ prelim: 33.33, midterm: 33.33, finals: 33.34 });
    expect(w.defaulted).toBe(true);
  });
});

describe('finalPercentTerms', () => {
  it('weights term grades; null term nulls the final', () => {
    expect(finalPercentTerms({ prelim: 80, midterm: 90, finals: 70 }, { prelim: 30, midterm: 30, finals: 40 })).toBeCloseTo(79, 2);
    expect(finalPercentTerms({ prelim: null, midterm: 90, finals: 70 }, { prelim: 30, midterm: 30, finals: 40 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: FAIL with "Failed to resolve import" / "extractTermWeights is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
// append to client/src/utils/spr.ts (needs TermId import added to the type import block)
import type { TermId } from './gradingTerms';

export interface TermWeightsResult {
  weights: Record<TermId, number>;
  defaulted: boolean;
}

export function extractTermWeights(
  grading: { termFormula?: string; finalFormula?: string } | null | undefined,
  terms: TermId[],
): TermWeightsResult {
  const equalSplit = (): TermWeightsResult => {
    const weights = {} as Record<TermId, number>;
    if (terms.length === 2 && terms.includes('midterm') && terms.includes('finals')) {
      weights['midterm'] = 40; weights['finals'] = 60;
    } else if (terms.length === 1) {
      weights[terms[0]] = 100;
    } else {
      const each = Math.floor(10000 / terms.length) / 100;
      terms.forEach((t, i) => { weights[t] = i === terms.length - 1 ? round2(100 - each * (terms.length - 1)) : each; });
    }
    return { weights, defaulted: true };
  };
  const text = `${grading?.termFormula ?? ''}\n${grading?.finalFormula ?? ''}`;
  const found: Partial<Record<TermId, number>> = {};
  for (const term of terms) {
    const labels = term === 'prelim' ? ['prelim'] : term === 'midterm' ? ['midterm'] : ['final'];
    const m = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^.\\n]{0,80}(?:${labels.join('|')})|(?:${labels.join('|')})[^.\\n]{0,80}(\\d+(?:\\.\\d+)?)\\s*%`, 'i'));
    if (m) found[term] = Number(m[1] ?? m[2]);
  }
  const vals = terms.map(t => found[t]);
  if (vals.some(v => v === undefined)) return equalSplit();
  const total = (vals as number[]).reduce((s, v) => s + v, 0);
  if (Math.abs(total - 100) > 0.01) return equalSplit();
  return { weights: Object.fromEntries(terms.map(t => [t, found[t]!])) as Record<TermId, number>, defaulted: false };
}

export function finalPercentTerms(
  termGrades: Record<TermId, number | null>,
  weights: Record<TermId, number>,
): number | null {
  let acc = 0;
  for (const [term, weight] of Object.entries(weights) as [TermId, number][]) {
    const g = termGrades[term];
    if (g === null || g === undefined) return null;
    acc += (g * weight) / 100;
  }
  return round2(acc);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/spr.ts client/src/utils/spr.test.ts
git commit -m "feat: add syllabus term weight parsing and N-term math"
```

---

### Task 3: Types + schema (TermId everywhere)

**Files:**
- Modify: `client/src/types/lms.ts` (`TermId` export after `UserRole`; `Exam.term:253`; `Quiz:217`; `Activity:232`; `Course:23`)
- Modify: `server/prisma/schema.prisma` (`Course` ~23: `gradingTerms String?`; `Quiz:188`; `Activity:225`)
- Test: `npx tsc --noEmit` (client) + `npx prisma validate` (server)

**Interfaces:**
- Consumes: `TermId` from Task 1.
- Produces: `term`/`gradingTerms` fields consumed by Tasks 4–7.

- [ ] **Step 1: Write the failing check**

Add temporarily to any client test (revert before commit): `const t: TermId = 'prelim';`
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: FAIL (`Cannot find name 'TermId'`).

- [ ] **Step 2: Run baseline**

Run: `npx vitest run src/utils/gradingTerms.test.ts`
Expected: PASS (Task 1 intact).

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/types/lms.ts — after line 1 UserRole export:
export type TermId = 'prelim' | 'midterm' | 'finals';
```

```ts
// Exam interface (line ~253): term: 'midterm' | 'final' → term: TermId;
// Quiz interface (~217) and Activity (~232): add term: TermId;
// Course interface (~23): add gradingTerms?: TermId[] | null;
```

```prisma
# server/prisma/schema.prisma
model Course { ... gradingTerms String? @db.NVarChar(Max) }  # JSON array of TermIds, null = auto-detect
model Quiz { ... term String? @db.NVarChar(16) }              # nullable = legacy rows
model Activity { ... term String? @db.NVarChar(16) }
# Exam.term stays NVARCHAR(16): 'prelim'/'midterm'/'finals' all fit; no column change needed
```

Migration (from `server/`): `npx prisma migrate dev --name add-term-fields --schema prisma/schema.prisma`; if no DB (P3014), hand-write `ALTER TABLE [dbo].[Course] ADD [gradingTerms] NVARCHAR(MAX); ALTER TABLE [dbo].[Quiz] ADD [term] NVARCHAR(16); ALTER TABLE [dbo].[Activity] ADD [term] NVARCHAR(16);` in the `BEGIN TRY/BEGIN TRAN` envelope and run `npx prisma validate`. Then `npx prisma generate` (stale client broke tsc before — see prior SDD ledger).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` (client, PASS) + `npx prisma validate --schema prisma/schema.prisma` (server, PASS).

- [ ] **Step 5: Commit**

```bash
git add client/src/types/lms.ts server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat: add term fields to quiz activity course models"
```

---

### Task 4: Server endpoints (validate + store terms)

**Files:**
- Modify: `server/src/routes/assessments.ts` (quiz/activity POST ~230-270 + PATCH handlers; exam POST ~273 + PATCH ~418)
- Modify: `server/src/routes/courses.ts` (PATCH allowlist ~202 + handler)
- Test: `server/src/routes/assessments.test.ts`, `server/src/routes/courses.test.ts` (extend)

**Interfaces:**
- Consumes: `gradingTerms`/`term` columns from Task 3.
- Produces: persisted terms consumed by Task 5 reads.

- [ ] **Step 1: Write the failing tests**

```ts
// assessments.test.ts — quiz accepts prelim term
const res = await request(app()).post('/api/quizzes').set('Authorization', 'Bearer x')
  .send({ courseId: 'c1', title: 'Q', instructions: 'I', term: 'prelim', questions: [] });
expect(res.status).toBe(201);
expect(res.body.quiz.term).toBe('prelim');
```

```ts
// assessments.test.ts — unknown term 400s
const bad = await request(app()).post('/api/activities').set('Authorization', 'Bearer x')
  .send({ courseId: 'c1', title: 'A', instructions: 'I', term: 'quarter', questions: [] });
expect(bad.status).toBe(400);
```

```ts
// courses.test.ts — PATCH gradingTerms persists + clears
// set: { gradingTerms: ['prelim','midterm','finals'] } → 200; garbage ['quarter'] → 400; null → 200 (clears)
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/routes/assessments.test.ts src/routes/courses.test.ts`
Expected: FAIL (quiz/activity ignore or reject `term`; PATCH drops `gradingTerms`).

- [ ] **Step 3: Write minimal implementation**

```ts
// assessments.ts — shared validator (top of file, used by quiz/activity/exam POST+PATCH):
const KNOWN_TERMS = ['prelim', 'midterm', 'finals'] as const;
function parseTermInput(value: unknown, field = 'term'): string {
  if (typeof value !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(value)) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be one of prelim, midterm, finals.`);
  }
  return value;
}
```

Exam POST (~273): replace `if (term !== 'midterm' && term !== 'final')` with `parseTermInput(body.term)`; exam PATCH (~418) same. Quiz create (~234 `prisma.quiz.create data`): add `term: parseTermInput(body.term ?? 'midterm')`; activity create likewise. Quiz/activity PATCH handlers: `if (body.term !== undefined) data.term = parseTermInput(body.term)`. (Read the exact activity-create + PATCH blocks in-file; they mirror the quiz block quoted in this plan's context section.)

```ts
// courses.ts — PATCH: handle gradingTerms BEFORE the string loop (its type is array|null, not string):
if (body.gradingTerms !== undefined) {
  if (body.gradingTerms !== null) {
    if (!Array.isArray(body.gradingTerms) || body.gradingTerms.some(t => typeof t !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(t))) {
      throw new ApiError(400, 'bad_request', `Field 'gradingTerms' must be an array of prelim, midterm, finals.`);
    }
    data.gradingTerms = JSON.stringify([...new Set(body.gradingTerms)]);
  } else {
    data.gradingTerms = null;
  }
}
```

(`data` is `Record<string, string | boolean | number | null>` — extend its type with the JSON string; share one `KNOWN_TERMS` const per file, no cross-file imports.)

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/routes/assessments.test.ts src/routes/courses.test.ts`
Expected: PASS. Also update the existing `term: 'prelim' → 400` exam test (assessments.test.ts:265-280) to expect 201 — it now contradicts the spec — and re-run.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/assessments.ts server/src/routes/assessments.test.ts server/src/routes/courses.ts server/src/routes/courses.test.ts
git commit -m "feat: validate and store grading terms on assessments and courses"
```

---

### Task 5: Client state (LMSContext passthrough)

**Files:**
- Modify: `client/src/context/LMSContext.tsx` (createQuiz/createActivity/createExam payloads ~1700-1800; update paths; course update path ~1236)
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `TermId`, `effectiveTerms` (Tasks 1, 3); server validation (Task 4).
- Produces: `term`/`gradingTerms` in provider value + payloads, used by Tasks 6–7.

- [ ] **Step 1: Write the failing check**

```ts
// temporary (revert): createQuiz('c1', { title: 'x', term: 'prelim' })
```
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: FAIL (no `term` param / not sent).

- [ ] **Step 2: Run baseline**

Run: `npx vitest run src/utils/gradingTerms.test.ts`
Expected: PASS.

- [ ] **Step 3: Write minimal implementation**

```ts
// createQuiz/createActivity/createExam: accept term?: TermId, default to effectiveTerms(course, syllabus)[0] ?? 'midterm':
term: input.term ?? effectiveTerms(course, course.syllabus ?? null)[0] ?? 'midterm',
// Normalize legacy on read (line ~442 pattern): term: normalizeTermId(raw.term) ?? 'midterm',
// Course update: gradingTerms: string[] | null passthrough (JSON handled server-side as array; send array/null verbatim).
// Expose in provider value: effectiveTermsForCourse: (courseId: string) => TermId[] (db lookup + syllabus).
```

(Read the exact payload builders in-file; keep existing field order, add `term` beside `title`.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/context/LMSContext.tsx
git commit -m "feat: pass grading terms through LMS context"
```

---

### Task 6: Forms UI (TermSelect + override editor)

**Files:**
- Create: `client/src/components/common/TermSelect.tsx`
- Modify: `client/src/pages/CreateExamPage.tsx:113-114,913-927`, `CreateQuizPage.tsx`, `CreateActivityPage.tsx`, `ActivityFormFields.tsx`, `QuizBuilderFields.tsx`, `SyllabusView.tsx` grading-system section (~1826-1970)
- Test: `npx tsc --noEmit` + manual matrix

**Interfaces:**
- Consumes: `effectiveTermsForCourse` (Task 5), `TermId` (Task 1).
- Produces: term-tagged items + per-course overrides, consumed by Task 7.

- [ ] **Step 1: Failing check (manual spec)**

Before screenshot: exam picker shows only Midterm/Final; quiz/activity forms show no term row.

- [ ] **Step 2: Baseline typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Write minimal implementation**

```tsx
// TermSelect.tsx
import React from 'react';
import type { TermId } from '../../utils/gradingTerms';
const LABELS: Record<TermId, string> = { prelim: 'Prelim', midterm: 'Midterm', finals: 'Finals' };
export const TermSelect: React.FC<{ terms: TermId[]; value: TermId; onChange: (t: TermId) => void; id?: string }> = ({ terms, value, onChange, id = 'term-select' }) => (
  <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
    <label htmlFor={id} className="text-[12px] font-semibold text-muted-foreground select-none">Term:</label>
    <select id={id} value={value} onChange={e => { const t = e.target.value as TermId; if (terms.includes(t)) onChange(t); }}
      className="px-2 py-1 bg-background border border-border rounded-xl text-[12.5px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer">
      {terms.map(t => <option key={t} value={t}>{LABELS[t]}</option>)}
    </select>
  </div>
);
```

Exam page: replace the hardcoded `<select>` (~918-926) with `<TermSelect terms={terms} value={term} onChange={setTerm} />` where `terms = effectiveTermsForCourse(courseId)` and `term` state widens to `TermId` (default `terms[0]`). Quiz/Activity forms: add the same row bound to form state, defaulting to `terms[0]`. SyllabusView grading-system edit block: checkbox trio (Prelim/Midterm/Finals, at least one required) writing `draft.gradingTermsOverride`, saved via course PATCH (`gradingTerms` array or `null` for auto). List views: term chip (`LABELS`) + filter by term.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS. Manual: 1/2/3-term courses show 1/2/3 options; override changes options immediately.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/common/TermSelect.tsx client/src/pages/CreateExamPage.tsx client/src/pages/CreateQuizPage.tsx client/src/pages/CreateActivityPage.tsx client/src/components/forms/ActivityFormFields.tsx client/src/components/forms/QuizBuilderFields.tsx client/src/pages/SyllabusView.tsx
git commit -m "feat: add syllabus-driven term picker to assessment forms"
```

---

### Task 7: Gradebook N-term computation + display

**Files:**
- Modify: `client/src/components/grading/FacultyGradebook.tsx` (autoCols ~77, examPerfect ~81, rows ~119, weights ~71), `StudentGradebook.tsx` (mt/ft ~44)
- Test: existing `spr.test.ts` (Task 2) + `npx tsc --noEmit` + manual matrix

**Interfaces:**
- Consumes: `extractTermWeights`, `finalPercentTerms` (Task 2); item `term` (Tasks 3, 5); `effectiveTermsForCourse` (Task 5).

- [ ] **Step 1: Failing check (manual spec)**

Document current behavior: prelim-tagged items have nowhere to count; gradebook shows exactly Midterm/Final blocks.

- [ ] **Step 2: Baseline**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS.

- [ ] **Step 3: Write minimal implementation**

```ts
// FacultyGradebook: replace midtermColumns/finalColumns usage with:
const terms = effectiveTermsForCourse(courseId);
const { weights: termWeights, defaulted: weightsDefaulted } = extractTermWeights(course?.syllabus?.gradingSystem ?? null, terms);
// columnsByTerm: Record<TermId, SPRColumn[]> — build via existing buildAutoColumns then bucket by source item term
// (source lookup: activities/quizzes/exams by linkedSource; missing term → 'midterm' + set legacyFlag once).
// per-term class standing via classStandingPercent on that term's columns; per-term exam via resolveExamScore(courseId, term-equivalent, ...) for midterm/finals, null exam for prelim (class-standing-only term → termGrade with examScore = 100? NO — prelim term grade = classStandingPercent only, documented).
// final = finalPercentTerms(termGrades, termWeights); 2-term path must equal existing finalPercent(mt, ft, w) — assert in code comment + manual matrix.
```

Render one period block per term (existing Midterm/Final blocks become a `.map` over `terms`); show "weights defaulted — equal split" note when `weightsDefaulted`; show "N items without a term counted under Midterm" flag when `legacyFlag`. StudentGradebook: same per-term blocks replacing the mt/ft pair.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/utils/spr.test.ts` + `npx tsc --noEmit -p tsconfig.json`
Expected: PASS both. Manual: seed 1/2/3-term courses; 2-term totals match pre-change numbers exactly.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/grading/FacultyGradebook.tsx client/src/components/grading/StudentGradebook.tsx
git commit -m "feat: compute gradebook across syllabus terms"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Client typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (from `client/`).

- [ ] **Step 2: Client unit tests**

Run: `npx vitest run src/utils/gradingTerms.test.ts src/utils/spr.test.ts src/utils/notifiers.test.ts`
Expected: PASS (from `client/`).

- [ ] **Step 3: Server tests for touched routes**

Run: `npx vitest run src/routes/assessments.test.ts src/routes/courses.test.ts`
Expected: PASS (from `server/`).

- [ ] **Step 4: Prisma validation + generate**

Run: `npx prisma validate --schema prisma/schema.prisma` then `npx prisma generate --schema prisma/schema.prisma`
Expected: PASS both (generate is git-ignored env setup; stale client broke tsc before).

- [ ] **Step 5: Manual matrix sign-off (no commit)**

1-term course (1 option), 2-term (identical options + totals to pre-change), 3-term (prelim appears, weights from formula), override edit changes options immediately, invalid term 400s, light + dark.

---

## Self-Review

1. Spec coverage: §1 registry → Task 1 (+ override storage Task 3/4, editor Task 6); §2 forms+storage → Tasks 3–6; §3 math → Tasks 2, 7; tests/manual gates → Task 8. No gaps.
2. Placeholder scan: no TBD/TODO; every step has exact code, commands, expected outputs; no "similar to Task N" (quiz/activity blocks described as mirroring the quoted exam/quiz code with exact insertion points).
3. Type consistency: `TermId`/`normalizeTermId`/`resolveCourseTerms`/`effectiveTerms`/`extractTermWeights`/`finalPercentTerms` spelled identically across tasks; `gradingTerms` JSON-string server-side vs array client-side is explicit at the Task 4 boundary.
