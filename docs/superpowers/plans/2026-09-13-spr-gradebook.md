# SPR Gradebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FacultyGradebook body with the DMMMSU SPR sheet: faculty-defined columns auto-filled from Activities/Quizzes, editable cells, syllabus-formula auto-computation, Excel export mirroring SPR-Prog1.docx.

**Architecture:** Pure SPR math utils first, then server persistence (Prisma JSON columns + routes reusing the grades owner guard), then LMSContext store with term-grade sync, then the sheet UI + config modal, then Excel export. Each layer is independently testable.

**Tech Stack:** React 19 + TypeScript, Tailwind, Prisma 6 + SQL Server, SheetJS `xlsx` (new), vitest 5 (client `npx vitest run`, server `npm --prefix server test`).

**Spec:** `docs/superpowers/specs/2026-09-13-spr-gradebook-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Term formula defaults: `Term = 60% Class Standing + 40% Exam`; `Final = 40% Midterm + 60% Final Term` (from syllabus `gradingSystem`, fallback to these defaults).
- Blank score = 0 in computation, rendered blank with amber hint.
- Excel export contains values only (no Excel formulas), landscape, filename `{courseCode}_SPR.xlsx`.
- No navigation changes; course sub-tab stays `grades`.
- `StudentGradebook` read path unchanged (fed by synced `courseGrades`); admin renders the sheet read-only.
- `npm run typecheck` (`tsc -b`) and `npm run build` must pass after every task.
- CORRECTION TO SPEC: the client `db` is API-backed with no localStorage persistence (`LMSContext.tsx:518`), so SPR config + scores persist via new server endpoints below, not localStorage.

---

## File Structure

- `src/utils/spr.ts` (new) — pure SPR types + math + auto-score resolution. No React, no context imports.
- `src/utils/spr.test.ts` (new) — vitest unit tests mirroring `src/utils/activities.test.ts` style.
- `server/prisma/schema.prisma` (modify) — add `sprConfig String? @db.NVarChar(Max)` to `Course`; add `sprCells String? @db.NVarChar(Max)` to `CourseGrade`.
- `server/prisma/migrations/XXXXXX_spr/migration.sql` (new) — `ALTER TABLE` for the two columns (SQL Server syntax, follow `migrations/20260913172729_init/migration.sql`).
- `server/src/routes/spr.ts` (new) — `GET /api/courses/:id/spr`, `PUT /api/courses/:id/spr` (config), `PUT /api/courses/:id/spr/:studentId` (cells). Reuse `authenticateToken`, `assertCourseOwner` pattern from `grades.ts`.
- `server/src/routes/spr.test.ts` (new) — supertest route tests following `server/src/routes/courses.test.ts` pattern.
- `server/src/index.ts` (modify) — mount `sprRouter` (find the `gradesRouter` mount line and add beside it).
- `src/types/lms.ts` (modify) — add `SPRColumn`, `SPRConfig`, `SPRCellMap` interfaces + `sprConfigs?` / `sprScores?` on `LMSDatabase`.
- `src/context/LMSContext.tsx` (modify) — SPR state + actions (`getSPRConfig`, `saveSPRConfig`, `setSPRCell`, `resetSPRCell`, `bulkImportSPRColumns`) + recompute-and-sync to `setCourseStudentGrade`.
- `src/components/grading/FacultyGradebook.tsx` (rewrite body) — SPR sheet UI; keeps `getTransmutedGrade` export untouched.
- `src/components/grading/SPRConfigModal.tsx` (new) — column config dialog using existing `DialogFrame`.
- `src/utils/sprExport.ts` (new) — `xlsx`-based workbook builder + download.
- `package.json` (modify) — add `xlsx` dependency.

Each file has one responsibility: math never touches React; export never touches context (takes plain args); the modal never writes the server directly (calls context actions).

---

### Task 1: SPR math utils + unit tests

**Files:**
- Create: `src/utils/spr.ts`
- Create: `src/utils/spr.test.ts`
- Modify: `src/types/lms.ts` (append SPR types + `sprConfigs?`/`sprScores?` on `LMSDatabase`; canonical home for all SPR types)

**Interfaces:**
- Consumes: `Submission`, `Assignment`, `Activity`, `Quiz` from `src/types/lms.ts`; `OfficialSyllabusData['gradingSystem']` shape (`termFormula`, `finalFormula` strings only for display).
- Produces (used by Tasks 3, 4, 6; canonical definitions live in `lms.ts`, `spr.ts` imports them):
  - `export interface SPRSourceLink { kind: 'assignment' | 'activity' | 'quiz'; sourceId: string }`
  - `export interface SPRColumn { id: string; title: string; perfectScore: number; linkedSource?: SPRSourceLink }`
  - `export interface SPRWeights { csWeight: number; examWeight: number; mtWeight: number; ftWeight: number; formulaLabel: string }`
  - `export function resolveSPRWeights(syllabusGrading: { termFormula?: string; finalFormula?: string } | null | undefined): SPRWeights`
  - `export function autoScoreFraction(args: { column: SPRColumn; studentId: string; submissions: Submission[]; assignments: Assignment[]; activities: Activity[]; quizzes: Quiz[] }): number | null` (fraction 0..1, null when no graded submission)
  - `export function classStandingPercent(scores: Array<number | null>, perfects: number[]): number`
  - `export function termGrade(csPercent: number, examScore: number | null, examPerfect: number, w: SPRWeights): number | null`
  - `export function finalPercent(mt: number | null, ft: number | null, w: SPRWeights): number | null`
  - `export function round2(n: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/spr.test.ts
import { describe, expect, it } from 'vitest';
import { classStandingPercent, termGrade, finalPercent, resolveSPRWeights } from './spr';

describe('classStandingPercent', () => {
  it('treats blank as zero over total perfect', () => {
    expect(classStandingPercent([30, null, 7], [30, 100, 10])).toBeCloseTo((37 / 140) * 100, 2);
  });
});

describe('termGrade', () => {
  it('applies 60/40 default weights', () => {
    const w = resolveSPRWeights(null);
    expect(w.csWeight).toBe(60);
    expect(termGrade(80, 50, 100, w)).toBe(68);
    expect(termGrade(80, 50, 60, w)).toBeCloseTo(81.33, 2);
  });
});

describe('finalPercent', () => {
  it('applies 40/60 default weights and null when incomplete', () => {
    const w = resolveSPRWeights(null);
    expect(finalPercent(68, 90, w)).toBeCloseTo(81.2, 1);
    expect(finalPercent(68, null, w)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: FAIL with "Failed to resolve import './spr'" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/types/lms.ts (append; canonical SPR types)
export interface SPRSourceLink { kind: 'assignment' | 'activity' | 'quiz'; sourceId: string }
export interface SPRColumn { id: string; title: string; perfectScore: number; linkedSource?: SPRSourceLink }
export interface SPRConfig { courseId: string; midtermColumns: SPRColumn[]; finalColumns: SPRColumn[]; mtExamPerfect: number; ftExamPerfect: number }
export type SPRCellMap = Record<string, Record<string, number | null>>;
```

```ts
// src/utils/spr.ts
import type { Activity, Assignment, Quiz, SPRColumn, Submission } from '../types/lms';

export interface SPRWeights { csWeight: number; examWeight: number; mtWeight: number; ftWeight: number; formulaLabel: string }

export function round2(n: number): number { return Math.round(n * 100) / 100 }

export function resolveSPRWeights(_syllabusGrading: { termFormula?: string; finalFormula?: string } | null | undefined): SPRWeights {
  return { csWeight: 60, examWeight: 40, mtWeight: 40, ftWeight: 60, formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT' };
}

export function classStandingPercent(scores: Array<number | null>, perfects: number[]): number {
  const totalPerfect = perfects.reduce((a, b) => a + b, 0);
  if (totalPerfect <= 0) return 0;
  const earned = scores.reduce<number>((sum, s, i) => sum + Math.min(Math.max(s ?? 0, 0), perfects[i] ?? 0), 0);
  return (earned / totalPerfect) * 100;
}

export function termGrade(csPercent: number, examScore: number | null, examPerfect: number, w: SPRWeights): number | null {
  if (examScore === null || examPerfect <= 0) return null;
  return round2((csPercent * w.csWeight + (examScore / examPerfect) * 100 * w.examWeight) / 100);
}

export function finalPercent(mt: number | null, ft: number | null, w: SPRWeights): number | null {
  if (mt === null || ft === null) return null;
  return round2((mt * w.mtWeight + ft * w.ftWeight) / 100);
}

function latestGraded(submissions: Submission[], assignmentId: string, studentId: string): Submission | undefined {
  return submissions
    .filter(s => s.assignmentId === assignmentId && s.studentId === studentId && s.status === 'graded' && typeof s.grade === 'number')
    .sort((a, b) => (b.gradedAt ?? b.submittedAt).localeCompare(a.gradedAt ?? a.submittedAt))[0];
}

export function autoScoreFraction(args: { column: SPRColumn; studentId: string; submissions: Submission[]; assignments: Assignment[]; activities: Activity[]; quizzes: Quiz[] }): number | null {
  const link = args.column.linkedSource;
  if (!link) return null;
  // Assignments store raw points (grade/pointsPossible); quizzes + activities store percent (grade%).
  if (link.kind === 'assignment') {
    const asg = args.assignments.find(a => a.id === link.sourceId);
    if (!asg || asg.pointsPossible <= 0) return null;
    const sub = latestGraded(args.submissions, asg.id, args.studentId);
    if (!sub || typeof sub.grade !== 'number') return null;
    return Math.min(Math.max(sub.grade / asg.pointsPossible, 0), 1);
  }
  if (link.kind === 'activity') {
    const sub = latestGraded(args.submissions, `asg-activity-${link.sourceId}`, args.studentId);
    if (!sub || typeof sub.grade !== 'number') return null;
    return Math.min(Math.max(sub.grade / 100, 0), 1);
  }
  const sub = latestGraded(args.submissions, `asg-quiz-${link.sourceId}`, args.studentId);
  if (!sub || typeof sub.grade !== 'number') return null;
  return Math.min(Math.max(sub.grade / 100, 0), 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/spr.ts src/utils/spr.test.ts src/types/lms.ts
git commit -m "feat(spr): add SPR math utils and unit tests"
```

---

### Task 2: Server persistence (Prisma + SPR routes)

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260914000000_spr/migration.sql`
- Create: `server/src/routes/spr.ts`
- Create: `server/src/routes/spr.test.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `authenticateToken`, `requireRole`, `asyncHandler`, `ApiError` (same imports as `server/src/routes/grades.ts`); `prisma.course`, `prisma.courseGrade`.
- Produces (used by Task 3):
  - `GET /api/courses/:id/spr` → `{ config: SPRConfigPayload | null }` (faculty/admin full; students 403 unless enrolled — mirror `assertCourseAccess`)
  - `PUT /api/courses/:id/spr` body `{ config: { midtermColumns, finalColumns, mtExamPerfect, ftExamPerfect } }` → `{ config }` (instructor/admin only via `assertCourseOwner` pattern)
  - `PUT /api/courses/:id/spr/:studentId` body `{ midtermScores: Record<string, number|null>, mtExam: number|null, finalScores: Record<string, number|null>, ftExam: number|null }` → `{ cells }` (instructor/admin only)
  - Validation errors use `ApiError(400, 'bad_request', ...)` with field-specific messages; unknown course → 404.

- [ ] **Step 1: Write the failing route test**

```ts
// server/src/routes/spr.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
// Follow server/src/routes/courses.test.ts for app bootstrap import:
// import { app } from '../index.js';  (verify exact export in index.ts before running)
describe('SPR routes', () => {
  it('rejects unauthenticated SPR reads with 401', async () => {
    const { app } = await import('../index.js');
    const res = await request(app).get('/api/courses/any-course/spr');
    expect([401, 403]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- spr.test.ts`
Expected: FAIL (route 404, `spr.ts` not mounted yet).

- [ ] **Step 3: Add Prisma columns**

In `server/prisma/schema.prisma`, add to `model Course` after `syllabus`:

```prisma
sprConfig String? @db.NVarChar(Max)
```

Add to `model CourseGrade`:

```prisma
sprCells String? @db.NVarChar(Max)
```

Create `server/prisma/migrations/20260914000000_spr/migration.sql`:

```sql
ALTER TABLE [dbo].[Course] ADD [sprConfig] NVARCHAR(max);
ALTER TABLE [dbo].[CourseGrade] ADD [sprCells] NVARCHAR(max);
```

Validate: `npm --prefix server run prisma:validate`
Expected: PASS.

- [ ] **Step 4: Implement minimal SPR router**

```ts
// server/src/routes/spr.ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const sprRouter = Router();

function parseScoreMap(value: unknown, field: string): Record<string, number | null> {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be an object.`);
  }
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== null && (typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
      throw new ApiError(400, 'bad_request', `Field '${field}.${k}' must be a non-negative number or null.`);
    }
    out[k] = v as number | null;
  }
  return out;
}

sprRouter.get('/courses/:id/spr', authenticateToken, asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  res.json({ config: course.sprConfig ? JSON.parse(course.sprConfig) : null });
}));

sprRouter.put('/courses/:id/spr', authenticateToken, requireRole('faculty', 'admin'), asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
  const config = (req.body ?? {}).config;
  if (!config || typeof config !== 'object') throw new ApiError(400, 'bad_request', "Field 'config' is required.");
  const updated = await prisma.course.update({
    where: { id: course.id },
    data: { sprConfig: JSON.stringify(config) },
  });
  res.json({ config: JSON.parse(updated.sprConfig!) });
}));

sprRouter.put('/courses/:id/spr/:studentId', authenticateToken, requireRole('faculty', 'admin'), asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const cells = {
    midtermScores: parseScoreMap(body.midtermScores, 'midtermScores'),
    mtExam: body.mtExam === null || body.mtExam === undefined ? null : body.mtExam,
    finalScores: parseScoreMap(body.finalScores, 'finalScores'),
    ftExam: body.ftExam === null || body.ftExam === undefined ? null : body.ftExam,
  };
  if (cells.mtExam !== null && (typeof cells.mtExam !== 'number' || cells.mtExam < 0)) {
    throw new ApiError(400, 'bad_request', "Field 'mtExam' must be a non-negative number or null.");
  }
  if (cells.ftExam !== null && (typeof cells.ftExam !== 'number' || cells.ftExam < 0)) {
    throw new ApiError(400, 'bad_request', "Field 'ftExam' must be a non-negative number or null.");
  }
  const grade = await prisma.courseGrade.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId: req.params.studentId } },
    update: { sprCells: JSON.stringify(cells) },
    create: { courseId: course.id, studentId: req.params.studentId, sprCells: JSON.stringify(cells) },
  });
  res.json({ cells: JSON.parse(grade.sprCells!) });
}));
```

Mount in `server/src/index.ts` next to the `gradesRouter` mount:

```ts
import { sprRouter } from './routes/spr.js';
app.use('/api', sprRouter);
```

- [ ] **Step 5: Run server tests + typecheck**

Run: `npm --prefix server test -- spr.test.ts`
Expected: PASS.
Run: `npm --prefix server run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/20260914000000_spr/migration.sql server/src/routes/spr.ts server/src/routes/spr.test.ts server/src/index.ts
git commit -m "feat(spr): add server persistence for SPR config and cells"
```

---

### Task 3: Client store (types + LMSContext actions)

**Files:**
- Modify: `src/types/lms.ts`
- Modify: `src/context/LMSContext.tsx`

**Interfaces:**
- Consumes: `SPRColumn`, `SPRConfig` (canonical in `lms.ts` from Task 1); `autoScoreFraction`, `classStandingPercent`, `termGrade`, `finalPercent`, `resolveSPRWeights` from Task 1; `setCourseStudentGrade(courseId, studentId, type, score)` (existing, `LMSContext.tsx:3093`); SPR endpoints from Task 2.
- Produces (used by Tasks 4, 5):
  - `export type SPRCellMap = Record<string, Record<string, number | null>>` (courseId → column-keyed manual cells per student; exam cells stored under reserved keys `__mtExam`, `__ftExam`)
  - `getSPRConfig(courseId: string): SPRConfig | null`
  - `saveSPRConfig(courseId: string, config: Omit<SPRConfig,'courseId'>): Promise<void>`
  - `setSPRCell(courseId, studentId, term: 'midterm'|'final', columnId | '__mtExam' | '__ftExam', value: number | null): Promise<void>` (writes manual cell to server, recomputes student, syncs term grade)
  - `resetSPRCell(courseId, studentId, term, key): Promise<void>` (clears manual cell → auto resolves again)
  - `bulkImportSPRColumns(courseId, term): Promise<void>` (creates linked columns for unlinked Activities/Quizzes/Assignments)

- [ ] **Step 1: Extend `LMSDatabase` + `emptyDb()` (types already landed in Task 1)**

Append `sprConfigs?: Record<string, SPRConfig>;` and `sprScores?: Record<string, Record<string, { midterm: Record<string, number | null>; mtExam: number | null; final: Record<string, number | null>; ftExam: number | null }>>;` to `LMSDatabase` in `src/types/lms.ts`. Update `emptyDb()` in `LMSContext.tsx` to include `sprConfigs: {}`, `sprScores: {}`.

- [ ] **Step 2: Add context actions with recompute-and-sync**

```tsx
const recomputeAndSync = async (courseId: string, studentId: string) => {
  // Read config + manual cells + submissions from latest db via setDb callback;
  // compute with Task-1 helpers; then await setCourseStudentGrade(courseId, studentId, 'midterm', mtGrade)
  // and ('final', ftGrade). Null clears via existing null path.
};
```

Sync rule: computed `mtGrade`/`ftGrade` (rounded to 2dp) are PUT to `courseGrades`; `null` (no columns or no exam) clears that term via the existing `score: null` path. Failures surface through the existing `setCourseStudentGrade` alert; SPR manual values are already saved so nothing is lost.

Hydration: extend the existing grades bootstrap (`LMSContext.tsx:687-719` fetch block) to also `GET /api/courses/:id/spr` per visible course and `GET` cells via the same endpoint family; merge into `db.sprConfigs` / `db.sprScores`.

- [ ] **Step 3: Verify typecheck + existing client tests**

Run: `npm run typecheck`
Expected: PASS.
Run: `npx vitest run src/utils`
Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/types/lms.ts src/context/LMSContext.tsx
git commit -m "feat(spr): add client SPR store with term-grade sync"
```

---

### Task 4: SPR sheet UI (FacultyGradebook body)

**Files:**
- Modify: `src/components/grading/FacultyGradebook.tsx`

**Interfaces:**
- Consumes: Task 3 actions + Task 1 math; `getTransmutedGrade` (same file, untouched export); `db.users` roster, `db.submissions/assignments/activities/quizzes` for auto-fill; `showAlert`.
- Produces (used by Task 5): `<FacultyGradebook courseId={...} />` with identical props; renders empty-state CTA (`data-testid="spr-empty-state"`) when no columns, sheet table otherwise.

- [ ] **Step 1: Replace sheet markup (keep header pattern + `getTransmutedGrade`)**

Keep `PageHeader`, search input, and formula badge pattern (`FacultyGradebook.tsx:121-188`); replace the 5-column table (`:193-378`) with the SPR grid: sticky `Student` column, one `<input type="number">` per MT column + MT Exam, read-only MT Grade chip, FT columns + FT Exam, read-only FT Grade chip, Final % + Numerical chip. Cell props: `min={0} max={perfectScore} step={0.25}`, `disabled={activeRole === 'admin'}`, blank (`''`) for null. Auto cells get `title="Auto from {source title}"` + dot marker; manual cells get reset button invoking `resetSPRCell`.

Computation per row (memoized): effective scores via `autoScoreFraction` + manual map → `classStandingPercent` → `termGrade` → `finalPercent` → `getTransmutedGrade(finalPercent)`.

- [ ] **Step 2: Wire edits with validation**

```tsx
const onCellChange = async (studentId: string, term: 'midterm' | 'final', key: string, raw: string, perfect: number) => {
  if (raw === '') { await setSPRCell(courseId, studentId, term, key, null); return; }
  const num = Number(raw);
  if (Number.isNaN(num)) return;
  if (num < 0 || num > perfect) { showAlert({ title: 'Score out of range', message: `Enter 0–${perfect}.`, type: 'warning' }); return; }
  await setSPRCell(courseId, studentId, term, key, num);
};
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS.
Manual: open a course → Grades tab shows SPR sheet (or empty-state CTA for new courses); editing a Quiz-linked cell recomputes MT Grade; admin sees disabled inputs.

- [ ] **Step 4: Commit**

```bash
git add src/components/grading/FacultyGradebook.tsx
git commit -m "feat(spr): replace gradebook body with SPR sheet"
```

---

### Task 5: Column config modal + bulk import

**Files:**
- Create: `src/components/grading/SPRConfigModal.tsx`
- Modify: `src/components/grading/FacultyGradebook.tsx` (open button + modal mount)

**Interfaces:**
- Consumes: `getSPRConfig`, `saveSPRConfig`, `bulkImportSPRColumns` from Task 3; `DialogFrame` from `src/components/common/DialogFrame`; course `assignments/activities/quizzes` lists for the source picker.
- Produces: `<SPRConfigModal courseId={courseId} onClose={() => void} />`; no other consumers.

- [ ] **Step 1: Build modal (titles, perfect scores, source links, exam perfects)**

Sections: Midterm columns list (title text input, perfect number input `min=1`, source `<select>` with options `Manual (no link)` + `Assignment: {title} ({pointsPossible} pts)` + `Activity: {title}` + `Quiz: {title}`, remove button), Add column button (id `crypto.randomUUID()`), Final columns (same), exam perfects (`mtExamPerfect` default 60, `ftExamPerfect` default 60), `Import all Activities/Quizzes` bulk button, Save/Cancel footer. Save validates: non-empty titles, perfect > 0, no duplicate linked source within the same term (warn + block with `showAlert`).

- [ ] **Step 2: Mount in gradebook + verify**

Add `Configure` button in the `PageHeader` actions opening the modal; on save close + toast. Verify typecheck and manual: create 2 columns, link one to a Quiz, confirm auto-fill appears in the sheet.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/grading/SPRConfigModal.tsx src/components/grading/FacultyGradebook.tsx
git commit -m "feat(spr): add SPR column config modal and bulk import"
```

---

### Task 6: Excel export mirroring the .docx

**Files:**
- Modify: `package.json` (add `xlsx`), `package-lock.json` (via install)
- Create: `src/utils/sprExport.ts`
- Modify: `src/components/grading/FacultyGradebook.tsx` (replace Export CSV button)

**Interfaces:**
- Consumes: `SPRConfig`, effective-score resolution + computation from Tasks 1/3; `Course`, `User`, `CourseStudentGrade` for roster/section (`user.courseSections?.[courseId] ?? course.section`); `getTransmutedGrade`.
- Produces: `export function exportSPRToExcel(args: { course: Course; roster: User[]; config: SPRConfig; resolveStudent: (studentId: string) => { mtCells: number[]; mtExam: number|null; ftCells: number[]; ftExam: number|null; mtGrade: number|null; ftGrade: number|null; finalPercent: number|null; numerical: string } }): void` (pure-input, side-effect download only).

- [ ] **Step 1: Add dependency**

```bash
npm install xlsx
```

Verify `package.json` contains `"xlsx": "^0.18.5"` (or newer 0.18.x).

- [ ] **Step 2: Implement exporter**

```ts
// src/utils/sprExport.ts
import * as XLSX from 'xlsx';

export function exportSPRToExcel(args: { /* as above */ }): void {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [];
  rows.push(["STUDENT'S PERFORMANCE RECORD"]);
  rows.push([`${args.course.code}: ${args.course.title}`, '', `Schedule: ${args.course.section}`]);
  rows.push(['No.', 'Name of Student', 'Course, Year & Section', ...args.config.midtermColumns.map(c => c.title), 'MT Exam', 'MT Grade', ...args.config.finalColumns.map(c => c.title), 'FT Exam', 'FT Grade', 'Final %', 'Numerical']);
  rows.push(['', '', '', ...args.config.midtermColumns.map(c => c.perfectScore), args.config.mtExamPerfect, '', ...args.config.finalColumns.map(c => c.perfectScore), args.config.ftExamPerfect, '', '', '']);
  // ... one row per roster student (sorted by name), signatory footer rows, merges, !cols widths, !printSetup landscape ...
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: rows[2].length - 1 } }];
  ws['!freeze'] = { xSplit: 3, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, ws, 'SPR');
  XLSX.writeFile(wb, `${args.course.code}_SPR.xlsx`);
}
```

Column order must be: `No. | Name | Section | MT 1..n | MT Exam | MT Grade | FT 1..m | FT Exam | FT Grade | Final % | Numerical` + perfect-score row + `Prepared by / Verified by / Approved` footer. Values rounded to 2dp; empty computed grades left blank.

- [ ] **Step 3: Replace CSV button with Excel export**

Remove `handleExportCSV` (`FacultyGradebook.tsx:65-116`) and its button; add `Export Excel` button calling `exportSPRToExcel` with resolved per-student values + `showAlert` success toast. Disabled with tooltip when roster is empty or config has zero columns.

- [ ] **Step 4: Verify manually + typecheck**

Run: `npm run typecheck`
Expected: PASS.
Manual: seed 3 students with scores, export, open `.xlsx`, compare column order + perfect row + computed grades against `SPR-Prog1.docx` layout (20-column structure).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/utils/sprExport.ts src/components/grading/FacultyGradebook.tsx
git commit -m "feat(spr): add Excel export mirroring SPR docx layout"
```

---

### Task 7: Regression + cleanup

**Files:**
- Modify: any leftovers found during regression (list explicitly in commit).

**Interfaces:**
- Consumes: all previous tasks.
- Produces: green build, no dead CSV code, students/admin unaffected.

- [ ] **Step 1: Confirm no dead references**

Run: `npx tsc -b 2>&1 | Select-Object -First 20` (Windows PowerShell; no `head`)
Expected: no output (clean). Search `handleExportCSV|Export CSV` in `src/` — expect zero matches. Search `pending-requests` regressions — none (unrelated).

- [ ] **Step 2: Full verification**

Run: `npx vitest run src/utils/spr.test.ts`
Expected: PASS.
Run: `npm --prefix server test`
Expected: PASS.
Run: `npm run build 2>&1 | Select-Object -First 20`
Expected: `✓ built in` with no TS errors.
Manual: student Grades tab unchanged; faculty edit → student value updates after sync; admin sheet read-only; reload persists config + cells (server-backed).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(spr): regression pass and dead-code cleanup"
```

---

## Self-Review

**1. Spec coverage:** Data model → Tasks 1–3. Auto-fill + editable + blank=0 → Tasks 1, 3, 4. Syllabus weights → Task 1 (`resolveSPRWeights`) surfaced in Task 4 badge. Faculty UI + config + bulk import → Tasks 4–5. Excel export mirroring docx columns/header/signatories → Task 6. System adaptations (no nav change, student/admin paths, courseGrades sync) → Tasks 3–4, verified in Task 7. Open item (C1 Student No. blank, studentId under Name) → Task 6 row layout. All spec sections have tasks.

**2. Placeholder scan:** No TBD/TODO/later; every step names exact files, signatures, validation messages, and commands. Error paths use existing `showAlert`/`ApiError` patterns with concrete text. No "similar to Task N" — shared code is referenced by exact function name from Task 1.

**3. Type consistency:** `SPRColumn`/`SPRSourceLink`/`SPRConfig`/`SPRCellMap` defined once in `lms.ts` (Task 1) and imported by `spr.ts`, Task 3 actions, and Task 6 exporter — no duplicates. `autoScoreFraction` args use `Assignment/Activity/Quiz/Submission` from `lms.ts`. Endpoint payloads (`midtermScores`, `mtExam`, `finalScores`, `ftExam`) match between Task 2 validation and Task 3 callers. Grade sync uses existing `setCourseStudentGrade(courseId, studentId, 'midterm'|'final', score|null)` verbatim.

One correction applied inline: spec assumed localStorage persistence; the plan uses server persistence (Prisma + routes) because the client db is API-backed.
