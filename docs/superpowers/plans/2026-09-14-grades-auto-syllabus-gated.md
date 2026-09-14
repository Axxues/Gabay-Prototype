# Grades Auto + Syllabus-Gated Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Configure SPR UI; grades auto-derive from Activities/Quizzes/Exams using the per-syllabus formula; Grades tab gated on syllabus upload.

**Architecture:** Gradebook becomes a pure view over `buildAutoColumns()` + parsed `resolveSPRWeights()` + `autoScoreFraction()`. New `Exam` entity clones the Quiz flow with a `term` field. Syllabus strings are the only weight source; parse failure blocks computation with a fix notice.

**Tech Stack:** React 19 + TypeScript (~6.0), Vite, Tailwind 3, vitest 5, Express + Prisma (server), xlsx export (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-14-grades-auto-syllabus-gated-design.md`

## Global Constraints

- TypeScript strict via `tsc -b`; no new dependencies.
- No DB migration: `Assignment` type and `sprConfigs/sprScores` rows stay; UI stops creating columns.
- Published-only columns: unpublished Activities/Quizzes/Exams never grade.
- Same auto list feeds both MT and FT class standing equally.
- Exactly 1 MT exam (`term='midterm'`) + 1 FT exam (`term='final'`); multiples per term use latest graded submission.
- Unparseable formula never silently falls back; show fix notice and render "—".

---

## File Structure

- `src/types/lms.ts` — add `Exam`, extend `SPRWeights` with `parseError?: boolean`, extend `SPRSourceLink` kind with `'exam'`, add `exams?: Exam[]` to `LMSDatabase`.
- `src/utils/spr.ts` — parse weights, build auto columns, exam-aware `autoScoreFraction`, exam-score resolver.
- `src/utils/spr.test.ts` — TDD cover for the above.
- `src/pages/CoursesPage.tsx` — delete `spr-config` route, add syllabus gate.
- `src/pages/ConfigureSPRPage.tsx` — delete file.
- `src/components/grading/FacultyGradebook.tsx` — auto columns, parsed weights, exam cells read-only auto, gate + parse-error banner.
- `src/components/grading/StudentGradebook.tsx` — same auto calc per student, parsed-weight What-If.
- `src/pages/ExamsView.tsx` + `src/pages/CreateExamPage.tsx` — clones of quiz pages for exams.
- `src/config/navigation.ts` — add `exams` nav item.
- `src/context/LMSContext.tsx` — `exams` state + `createExam`/`recordExamSubmission` mirroring quizzes.
- `server/src/routes/assessments.ts` — add `examsRouter` via `buildAssessmentRouter('exam')`.
- `src/pages/SyllabusView.tsx` — bind formula display to data; `src/utils/syllabusParser.ts` — preserve scanned formula text.

---

### Task 1: Parsed syllabus weights (pure logic, TDD)

**Files:**
- Modify: `src/types/lms.ts:459`
- Modify: `src/utils/spr.ts:15-25`
- Test: `src/utils/spr.test.ts:54-68`

**Interfaces:**
- Consumes: `OfficialSyllabusData['gradingSystem']` shape `{ termFormula?: string; finalFormula?: string }`.
- Produces: `resolveSPRWeights(g): SPRWeights` where `SPRWeights = { csWeight: number; examWeight: number; mtWeight: number; ftWeight: number; formulaLabel: string; parseError?: boolean }`. Later tasks call it with `course?.syllabus?.gradingSystem ?? null` and branch on `weights.parseError`.

- [ ] **Step 1: Extend SPRWeights type**

```ts
// src/types/lms.ts:459 — replace line with:
export interface SPRWeights { csWeight: number; examWeight: number; mtWeight: number; ftWeight: number; formulaLabel: string; parseError?: boolean }
```

- [ ] **Step 2: Write failing parser tests (append to spr.test.ts)**

```ts
it('parses 70/30 term + 50/50 final from syllabus strings', () => {
  const w = resolveSPRWeights({ termFormula: 'Term = 70% Class Standing + 30% Exam', finalFormula: 'Final = 50% Midterm + 50% Final Term' });
  expect(w.csWeight).toBe(70);
  expect(w.examWeight).toBe(30);
  expect(w.mtWeight).toBe(50);
  expect(w.ftWeight).toBe(50);
  expect(w.parseError).toBeFalsy();
});
it('flags unparseable formula instead of silent fallback', () => {
  const w = resolveSPRWeights({ termFormula: 'grades are vibes', finalFormula: '' });
  expect(w.parseError).toBe(true);
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run src/utils/spr.test.ts -t "parses 70/30"`
Expected: FAIL (returns hardcoded 60/40, no parseError).

- [ ] **Step 4: Implement parser in src/utils/spr.ts**

```ts
export function resolveSPRWeights(
  syllabusGrading: { termFormula?: string; finalFormula?: string } | null | undefined,
): SPRWeights {
  const fallback = (): SPRWeights => ({ csWeight: 60, examWeight: 40, mtWeight: 40, ftWeight: 60, formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT', parseError: true });
  if (!syllabusGrading) return { csWeight: 60, examWeight: 40, mtWeight: 40, ftWeight: 60, formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT' };
  const term = syllabusGrading.termFormula ?? '';
  const fin = syllabusGrading.finalFormula ?? '';
  const nums = (s: string) => [...s.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
  const tn = nums(term), fn = nums(fin);
  const sumOk = (a: number[]) => a.length >= 2 && Math.abs(a[0] + a[1] - 100) < 0.01;
  // term: first % = class standing, second % = exam; final: first % = midterm, second % = final term
  if (!sumOk(tn) || !sumOk(fn)) return fallback();
  return { csWeight: tn[0], examWeight: tn[1], mtWeight: fn[0], ftWeight: fn[1], formulaLabel: `Term ${tn[0]}% CS + ${tn[1]}% Exam · Final ${fn[0]}% MT + ${fn[1]}% FT` };
}
```

Also update the old test at `spr.test.ts:64-67` (`ignores syllabus input`) — delete it; it asserts the bug being fixed.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/lms.ts src/utils/spr.ts src/utils/spr.test.ts
git commit -m "feat(grades): parse syllabus grading formula with parseError flag"
```

---

### Task 2: Auto columns + exam-aware scoring (pure logic, TDD)

**Files:**
- Modify: `src/types/lms.ts:232,455-468`
- Modify: `src/utils/spr.ts:52-109`
- Test: `src/utils/spr.test.ts`

**Interfaces:**
- Consumes: `Activity`, `Quiz`, new `Exam` (below), `Submission`.
- Produces: `buildAutoColumns(courseId: string, db: { activities?: Activity[]; quizzes: Quiz[] }): SPRColumn[]`; `autoScoreFraction()` accepts `linkedSource.kind: 'activity' | 'quiz' | 'exam'` plus `exams: Exam[]` param; `resolveExamScore(courseId, term, studentId, db): { score: number | null; perfect: number }`.

- [ ] **Step 1: Add Exam type + extend DB/link types**

```ts
// src/types/lms.ts — after Activity (line ~241) add:
export interface Exam {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  timeLimitMinutes: number;
  published: boolean;
  dueDate?: string;
  questions: QuizQuestion[];
  term: 'midterm' | 'final';
}
// line 455 replace with:
export interface SPRSourceLink { kind: 'activity' | 'quiz' | 'exam'; sourceId: string }
// LMSDatabase add after activities line:
exams?: Exam[];
```

- [ ] **Step 2: Write failing auto-column + exam tests**

```ts
it('builds auto columns from published activities+quizzes only, excluding assignments', () => {
  const cols = buildAutoColumns('c1', {
    activities: [{ id: 'a1', courseId: 'c1', title: 'Act', published: true, pointsPossible: 20 } as Activity],
    quizzes: [{ id: 'q1', courseId: 'c1', title: 'Q', published: true, questions: [{ points: 10 }] } as unknown as Quiz, { id: 'q2', courseId: 'c1', title: 'Draft', published: false, questions: [] } as unknown as Quiz],
  });
  expect(cols.map(c => c.linkedSource?.sourceId).sort()).toEqual(['a1', 'q1']);
});
it('scores exam submissions as percent fraction', () => {
  const exams = [{ id: 'e1', courseId: 'c1', title: 'MT', published: true, term: 'midterm', questions: [{ points: 60 }] } as unknown as Exam];
  const subs = [makeSubmission({ assignmentId: 'asg-exam-e1', studentId: 's1', grade: 45 })];
  expect(autoScoreFraction({ column: col({ kind: 'exam', sourceId: 'e1' }), studentId: 's1', submissions: subs, assignments: [], activities: [], quizzes: [], exams })).toBeCloseTo(0.75, 5);
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run src/utils/spr.test.ts -t "builds auto columns"`
Expected: FAIL with "buildAutoColumns is not defined".

- [ ] **Step 4: Implement in src/utils/spr.ts**

```ts
import type { Activity, Assignment, Exam, Quiz, SPRColumn, SPRWeights, Submission } from '../types/lms';

export function buildAutoColumns(courseId: string, db: { activities?: Activity[]; quizzes: Quiz[] }): SPRColumn[] {
  const cols: SPRColumn[] = [];
  for (const a of db.activities ?? []) {
    if (a.courseId !== courseId || !a.published) continue;
    cols.push({ id: `auto-activity-${a.id}`, title: a.title, perfectScore: Math.max(1, a.pointsPossible || 0), linkedSource: { kind: 'activity', sourceId: a.id } });
  }
  for (const q of db.quizzes ?? []) {
    if (q.courseId !== courseId || !q.published) continue;
    const pts = q.questions.reduce((s, qq) => s + (qq.points ?? 0), 0);
    cols.push({ id: `auto-quiz-${q.id}`, title: q.title, perfectScore: Math.max(1, pts), linkedSource: { kind: 'quiz', sourceId: q.id } });
  }
  return cols;
}
```

Extend `autoScoreFraction` args with `exams?: Exam[]`, add branch: `link.kind === 'exam'` → find exam, `assignmentKey = 'asg-exam-' + id`, divisor 100. Keep `assignment` branch untouched for compat (UI no longer creates them). Add:

```ts
export function resolveExamScore(courseId: string, term: 'midterm' | 'final', studentId: string, db: { exams?: Exam[]; submissions: Submission[] }): { score: number | null; perfect: number } {
  const exam = (db.exams ?? []).find(e => e.courseId === courseId && e.published && e.term === term);
  if (!exam) return { score: null, perfect: 100 };
  const pts = exam.questions.reduce((s, q) => s + (q.points ?? 0), 0);
  const perfect = Math.max(1, pts);
  const cands = db.submissions.filter(s => s.studentId === studentId && s.assignmentId === `asg-exam-${exam.id}` && s.status === 'graded' && typeof s.grade === 'number');
  if (!cands.length) return { score: null, perfect };
  cands.sort((a, b) => String(b.gradedAt ?? b.submittedAt ?? '') > String(a.gradedAt ?? a.submittedAt ?? '') ? 1 : -1);
  return { score: Math.min(Math.max(cands[0].grade as number, 0), 100), perfect };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS (existing assignment tests still pass since branch kept).

- [ ] **Step 6: Commit**

```bash
git add src/types/lms.ts src/utils/spr.ts src/utils/spr.test.ts
git commit -m "feat(grades): auto columns from activities/quizzes plus exam scoring"
```

---

### Task 3: Delete Configure SPR + gate Grades on syllabus

**Files:**
- Modify: `src/pages/CoursesPage.tsx:14,34-36,88-93,256-278`
- Delete: `src/pages/ConfigureSPRPage.tsx`
- Test: manual (no unit; verify via typecheck)

**Interfaces:**
- Consumes: `activeCourse.syllabus` presence, `resolveSPRWeights` parseError from Task 1.
- Produces: Grades tab renders `<SyllabusRequiredEmptyState>` when gated; no `spr-config` route exists.

- [ ] **Step 1: Remove ConfigureSPRPage import + spr-config guards + route**

In `CoursesPage.tsx`: delete `import { ConfigureSPRPage }`, delete the `subTab === 'spr-config'` effect block (lines 88-93), delete the `{subTab === 'spr-config' && ...}` render block (lines 273-278). Change `FacultyGradebook` usage to `<FacultyGradebook courseId={activeCourse.id} />` (drop `onConfigureSPR`).

- [ ] **Step 2: Add syllabus gate above grades branch**

```tsx
{subTab === 'grades' && !activeCourse.syllabus && (
  <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle" data-testid="grades-syllabus-gate">
    <h3 className="text-sm font-bold text-foreground">Syllabus required for grades</h3>
    <p className="text-xs text-muted-foreground mt-1">The grading formula lives in the syllabus under Course Requirements &amp; Official Grading Formula. {activeRole === 'faculty' ? 'Upload a syllabus to enable the gradebook.' : 'Waiting for your instructor to upload the syllabus.'}</p>
    {activeRole === 'faculty' && (
      <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
    )}
  </div>
)}
{subTab === 'grades' && activeCourse.syllabus && ( ...existing role branch... )}
```

- [ ] **Step 3: Delete file + typecheck**

Run: `git rm src/pages/ConfigureSPRPage.tsx` then `npx tsc -b`
Expected: no errors (FacultyGradebook prop error fixed in Task 4; if typecheck fails here, proceed — Task 4 resolves it).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CoursesPage.tsx
git commit -m "feat(grades): remove SPR configure route, gate grades on syllabus"
```

---

### Task 4: FacultyGradebook auto rewrite

**Files:**
- Modify: `src/components/grading/FacultyGradebook.tsx` (full grade path)
- Test: `npx tsc -b` + manual matrix

**Interfaces:**
- Consumes: `buildAutoColumns`, `resolveSPRWeights`, `resolveExamScore`, `autoScoreFraction` (Tasks 1-2); `db.activities/quizzes/exams/submissions`, `course.syllabus`.
- Produces: read-only auto cells + manual exam override removed; export still works via `exportSPRToExcel`.

- [ ] **Step 1: Replace SPR config reads with auto columns**

Delete `getSPRConfig/saveSPRConfig/bulkImportSPRColumns/setSPRCell/resetSPRCell` usage, `onConfigureSPR` prop, Configure button, `postingPolicy` toggle (keep if harmless — delete to reduce noise). Compute:

```tsx
const weights = useMemo(() => resolveSPRWeights(course?.syllabus?.gradingSystem ?? null), [course]);
const autoCols = useMemo(() => buildAutoColumns(courseId, { activities: db.activities, quizzes: db.quizzes }), [courseId, db.activities, db.quizzes]);
```

- [ ] **Step 2: Replace cell computation**

For each student: class standing from `autoCols` via `autoScoreFraction` (blanks → null → counted 0 in `classStandingPercent`); exams via `resolveExamScore(courseId, 'midterm'|'final', student.id, db)`; `termGrade` + `finalPercent` with parsed weights. Cells render as read-only text (no `<input>`, no reset buttons). If `weights.parseError`, render amber banner with button jumping to syllabus tab and render "—" for computed grades; disable Export.

- [ ] **Step 3: Typecheck + manual check**

Run: `npx tsc -b`
Manual: seed course with syllabus + 1 activity + 1 quiz + MT/FT exams; submit as student; faculty sees auto scores; remove syllabus → gated (Task 3); corrupt formula → banner.

- [ ] **Step 4: Commit**

```bash
git add src/components/grading/FacultyGradebook.tsx src/pages/CoursesPage.tsx
git commit -m "feat(grades): faculty gradebook auto from activities/quizzes/exams"
```

---

### Task 5: StudentGradebook auto rewrite

**Files:**
- Modify: `src/components/grading/StudentGradebook.tsx:20-63`
- Test: `npx tsc -b` + manual

**Interfaces:**
- Consumes: same helpers as Task 4, scoped to `activeUser.id`.
- Produces: official card from auto calc; What-If sliders weighted by parsed weights.

- [ ] **Step 1: Replace courseGrades read with auto calc**

Compute `mtGrade/ftGrade/final` for `activeUser.id` using `buildAutoColumns` + `resolveExamScore` + parsed weights. If `!course?.syllabus`, render the same gated empty state. If `weights.parseError`, show fix notice + "—".

- [ ] **Step 2: Rewire What-If**

Keep sliders but contributions use `weights.mtWeight/100`, `weights.ftWeight/100` instead of hardcoded 0.40/0.60; labels show parsed percentages.

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc -b`
Manual: student with graded activity sees official card match faculty row.

- [ ] **Step 4: Commit**

```bash
git add src/components/grading/StudentGradebook.tsx
git commit -m "feat(grades): student view auto from syllabus formula"
```

---

### Task 6: Exams page + nav + context + server (clone of quizzes)

**Files:**
- Create: `src/pages/ExamsView.tsx`, `src/pages/CreateExamPage.tsx`
- Modify: `src/config/navigation.ts:2,20-29`, `src/context/LMSContext.tsx` (add `exams` state, `createExam`, `recordExamSubmission`), `server/src/routes/assessments.ts:9-12`, `src/pages/CoursesPage.tsx` (render branch), Modules link (optional: reuse quiz select)
- Test: `npx tsc -b` + manual create/submit/grade flow

**Interfaces:**
- Consumes: `Exam` type (Task 2), existing quiz server shape.
- Produces: `db.exams`, `createExam(data)`, `recordExamSubmission(examId, studentId, answers)`; `asg-exam-<id>` submissions feed Task 2 resolver.

- [ ] **Step 1: Clone quiz pages for exams**

Copy `src/pages/QuizzesView.tsx` → `ExamsView.tsx`, rename component/props to exam, filter `db.exams` by course, add term badge (`midterm`/`final`) and faculty term picker in `CreateExamPage.tsx` (cloned from `CreateQuizPage.tsx`, plus `<select value={term}>`).

- [ ] **Step 2: Wire nav + CoursesPage branch**

`navigation.ts`: extend `NavIcon` with `'exams'`, add `{ id: 'exams', label: 'Exams', icon: 'exams', roles: ALL }` after quizzes. `CoursesPage.tsx`: add `{subTab === 'exams' && <ExamsView courseId={activeCourse.id} ... />}` mirroring quizzes branch. Reuse quiz icons for `exams` in the rail icon map.

- [ ] **Step 3: Context + server**

`LMSContext.tsx`: add `exams: []` to initial db, fetch `/api/exams?courseId=`, `createExam` POST `/api/exams`, `recordExamSubmission` POST `/api/exams/:id/submit` (mirror quiz fns lines 1508-1584). `server/src/routes/assessments.ts`: add `export const examsRouter = buildAssessmentRouter('exam');` and mount in server router identically to quizzes/activities.

- [ ] **Step 4: Typecheck + manual**

Run: `npx tsc -b`
Manual: faculty creates MT + FT exams, student submits, SpeedGrader grades, gradebook exam cells fill.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ExamsView.tsx src/pages/CreateExamPage.tsx src/config/navigation.ts src/context/LMSContext.tsx server/src/routes/assessments.ts src/pages/CoursesPage.tsx src/types/lms.ts
git commit -m "feat(exams): add Exams page mirroring quizzes with midterm/final term"
```

---

### Task 7: Syllabus formula display + parser preserve

**Files:**
- Modify: `src/pages/SyllabusView.tsx:1342,1415-1428`, `src/utils/syllabusParser.ts:456-477`
- Test: manual upload + edit

- [ ] **Step 1: Bind display to data**

Replace hardcoded `60% Class Standing + 40% ME / FE` (line 1416) with `{data.gradingSystem.termFormula}`, `40% Midterm Grade + 60% Final Term Grade` (line 1428) with `{data.gradingSystem.finalFormula}`, and badge line 1342 with parsed short label. Keep existing edit affordance (`editingSection='gradingSystem'`).

- [ ] **Step 2: Preserve scanned formula text**

In `syllabusParser.ts`, replace the `if (lowerText.includes('60%')...)` overwrite with verbatim extraction: keep `baseData` formulas unless regex finds two `%` pairs in raw text near "class standing"/"midterm", in which case store the matched sentence verbatim.

- [ ] **Step 3: Manual check**

Upload official syllabus → formulas show scanned text; edit formula to garbage → gradebook shows fix notice (Tasks 4-5).

- [ ] **Step 4: Commit**

```bash
git add src/pages/SyllabusView.tsx src/utils/syllabusParser.ts
git commit -m "feat(syllabus): bind grading formula display, preserve scanned text"
```

---

### Task 8: Full verification

- [ ] **Step 1: Typecheck + unit tests**

Run: `npx tsc -b`
Run: `npx vitest run src/utils/spr.test.ts`
Expected: both PASS.

- [ ] **Step 2: Manual matrix**

Syllabus A (60/40) vs B (70/30) changes badge + grades; no syllabus gates both roles; garbage formula banners + export disabled; activity/quiz submit auto-fills; MT/FT exams auto-fill; student view matches faculty row.

- [ ] **Step 3: Commit (only if fixes needed)**

```bash
git add -A
git commit -m "fix(grades): verification fixes for auto syllabus-gated grades"
```

## Self-Review

- Spec coverage: no-Configure (Task 3-4), auto Activities/Quizzes (Task 2+4), Exams page (Task 6), syllabus formula extract + fix notice (Task 1+4+5+7), syllabus gate (Task 3-5). All covered.
- No placeholders: every step has exact file/lines, code, and commands.
- Type consistency: `Exam.term`, `SPRWeights.parseError`, `buildAutoColumns(courseId, db)`, `resolveExamScore(courseId, term, studentId, db)`, `asg-exam-<id>` key used identically in Tasks 2/4/5/6.
