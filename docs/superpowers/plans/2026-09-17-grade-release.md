# Grade Release per Term Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faculty toggle grade visibility per term; students see official scores only for released terms and a locked message otherwise, with the what-if calculator removed.

**Architecture:** Persist a `gradesReleased` JSON map on the Course row (new Prisma column + migration), expose a faculty-only PATCH endpoint, sync it through the existing course normalization in `LMSContext`, add toggles to `FacultyGradebook`, and rewrite `StudentGradebook` around release gating.

**Tech Stack:** Express + Prisma (SQL Server, NVarChar), React + TypeScript, Vitest + supertest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-17-grade-release-design.md`

## Global Constraints

- SQL Server dialect: new column is `NVARCHAR(MAX)`, nullable, no default.
- Term ids are exactly `prelim | midterm | finals` (see `KNOWN_TERMS` in `server/src/routes/courses.ts`).
- TDD every task: failing test first, watched fail, minimal code, watched pass.
- Absent map key (or null column) means NOT released.
- No changes to grade computation (SPR weights, transmutation).

---

### Task 1: Server migration + Prisma schema

**Files:**
- Modify: `server/prisma/schema.prisma` (Course model, after `gradingTerms` line)
- Create: `server/prisma/migrations/20260917200000_add_grades_released/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `Course.gradesReleased` column (raw `string | null`) available to Prisma client after `prisma generate`.

- [ ] **Step 1: Add the column to the Prisma schema**

In `server/prisma/schema.prisma`, inside `model Course`, after the `gradingTerms` line, add:

```prisma
gradesReleased     String?             @db.NVarChar(Max) // JSON map TermId -> boolean, absent = not released
```

- [ ] **Step 2: Create the migration SQL**

Create `server/prisma/migrations/20260917200000_add_grades_released/migration.sql` (wrap in TRY/CATCH exactly like `20260916120000_add_user_banner/migration.sql`):

```sql
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Course] ADD [gradesReleased] NVARCHAR(MAX);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate --schema prisma/schema.prisma` from `server/`
Expected: `The schema is valid` (exit 0). Do NOT run `prisma migrate deploy` (DB owner applies migrations).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/20260917200000_add_grades_released/migration.sql
git commit -m "feat(server): add Course.gradesReleased column"
```

---

### Task 2: Server grades-release endpoint + tests

**Files:**
- Modify: `server/src/routes/courses.ts` (new route after the existing `PATCH /:id` block, before `DELETE /:id`)
- Test: `server/src/routes/courses.test.ts` (append new `it(...)` blocks inside `describe('courses router')`)

**Interfaces:**
- Consumes: `loadCourseOr404`, `assertCourseOwner`, `authenticateToken`, `requireRole('faculty','admin')`, `KNOWN_TERMS` (all already in `courses.ts`).
- Produces: `PATCH /api/courses/:id/grades-release` accepting `{ term, released }`, returning `{ course }`.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/courses.test.ts` (same mocks as the gradingTerms test at line 328 — `prisma.course.findUnique` resolves `{ id: 'c1', instructorId: 'u-fac', published: true }`, `prisma.course.update` echoes `args.data`):

```ts
it('PATCH grades-release toggles one term, merges other terms, rejects bad input', async () => {
  (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'c1',
    instructorId: 'u-fac',
    published: true,
    gradesReleased: JSON.stringify({ midterm: true }),
  });
  (prisma.course.update as ReturnType<typeof vi.fn>).mockImplementation(
    (args: { where: unknown; data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'c1', ...args.data })
  );
  const request = (await import('supertest')).default;

  const set = await request(app())
    .patch('/api/courses/c1/grades-release')
    .set('Authorization', 'Bearer x')
    .send({ term: 'finals', released: true });
  expect(set.status).toBe(200);
  expect(prisma.course.update).toHaveBeenCalledWith({
    where: { id: 'c1' },
    data: expect.objectContaining({
      gradesReleased: JSON.stringify({ midterm: true, finals: true }),
    }),
  });

  const badTerm = await request(app())
    .patch('/api/courses/c1/grades-release')
    .set('Authorization', 'Bearer x')
    .send({ term: 'quarter', released: true });
  expect(badTerm.status).toBe(400);

  const badFlag = await request(app())
    .patch('/api/courses/c1/grades-release')
    .set('Authorization', 'Bearer x')
    .send({ term: 'midterm', released: 'yes' });
  expect(badFlag.status).toBe(400);
});

it('PATCH grades-release as non-owner faculty → 403', async () => {
  (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'c1',
    instructorId: 'u-other',
    published: true,
  });
  const res = await (await import('supertest'))
    .default(app())
    .patch('/api/courses/c1/grades-release')
    .set('Authorization', 'Bearer x')
    .send({ term: 'midterm', released: true });
  expect(res.status).toBe(403);
  expect(prisma.course.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/routes/courses.test.ts` from `server/`
Expected: FAIL — `PATCH /api/courses/c1/grades-release` returns 404 (no route).

- [ ] **Step 3: Implement the endpoint**

In `server/src/routes/courses.ts`, after the existing `coursesRouter.patch('/:id', ...)` block (ends line 281), insert:

```ts
coursesRouter.patch(
  '/:id/grades-release',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    // Full row: need the current gradesReleased blob to merge one term.
    const row = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!row) throw new ApiError(404, 'not_found', 'Course not found.');
    assertCourseOwner(row, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.term !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(body.term)) {
      throw new ApiError(400, 'bad_request', `Field 'term' must be one of prelim, midterm, finals.`);
    }
    if (typeof body.released !== 'boolean') {
      throw new ApiError(400, 'bad_request', `Field 'released' must be a boolean.`);
    }
    let merged: Record<string, boolean> = {};
    if (typeof row.gradesReleased === 'string' && row.gradesReleased) {
      try {
        const parsed: unknown = JSON.parse(row.gradesReleased);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if ((KNOWN_TERMS as readonly string[]).includes(k) && typeof v === 'boolean') {
              merged[k] = v;
            }
          }
        }
      } catch {
        merged = {};
      }
    }
    merged[body.term] = body.released;
    const updated = await prisma.course.update({
      where: { id: row.id },
      data: { gradesReleased: JSON.stringify(merged) },
    });
    res.json({ course: updated });
  })
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/routes/courses.test.ts` from `server/`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/courses.ts server/src/routes/courses.test.ts
git commit -m "feat(server): per-term grades release endpoint"
```

---

### Task 3: Client type + release-map normalization + tests

**Files:**
- Modify: `client/src/types/lms.ts` (Course interface, after `gradingTerms` line 40)
- Modify: `client/src/utils/gradingTerms.ts` (append helper)
- Modify: `client/src/context/LMSContext.tsx` (`normalizeCourseSyllabus`, line ~562)
- Test: `client/src/utils/gradingTerms.test.ts` (create; follow `client/src/utils/notifiers.test.ts` style)

**Interfaces:**
- Consumes: `TermId` (already in `gradingTerms.ts`).
- Produces: `normalizeGradesReleased(raw: unknown): Record<TermId, boolean>`; `Course.gradesReleased?: Record<TermId, boolean> | null`.

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/gradingTerms.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { normalizeGradesReleased } from './gradingTerms';

describe('normalizeGradesReleased', () => {
  test('parses a JSON map, drops unknown terms and non-boolean values', () => {
    expect(
      normalizeGradesReleased(JSON.stringify({ midterm: true, finals: 1, quarter: true }))
    ).toEqual({ midterm: true });
  });

  test('accepts an object, null, garbage, and undefined as unreleased', () => {
    expect(normalizeGradesReleased({ prelim: true })).toEqual({ prelim: true });
    expect(normalizeGradesReleased(null)).toEqual({});
    expect(normalizeGradesReleased('{bad json')).toEqual({});
    expect(normalizeGradesReleased(undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run src/utils/gradingTerms.test.ts` from `client/`
Expected: FAIL with "normalizeGradesReleased is not a function" (import error).

- [ ] **Step 3: Implement helper, type field, and normalization hookup**

Append to `client/src/utils/gradingTerms.ts`:

```ts
export function normalizeGradesReleased(raw: unknown): Record<TermId, boolean> {
  const out: Record<TermId, boolean> = {};
  let obj: unknown = raw;
  if (typeof raw === 'string' && raw) {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const term = normalizeTermId(k);
    if (term !== null && typeof v === 'boolean') out[term] = v;
  }
  return out;
}
```

In `client/src/types/lms.ts`, after line 40 (`gradingTerms?: TermId[] | null;`), add:

```ts
gradesReleased?: Record<TermId, boolean> | null;
```

In `client/src/context/LMSContext.tsx`, extend the return of `normalizeCourseSyllabus` (line 562) to include `gradesReleased: normalizeGradesReleased(raw?.gradesReleased)`, and import the helper alongside the existing `normalizeTermId` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run src/utils/gradingTerms.test.ts` from `client/`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/types/lms.ts client/src/utils/gradingTerms.ts client/src/utils/gradingTerms.test.ts client/src/context/LMSContext.tsx
git commit -m "feat(client): gradesReleased type and normalization"
```

---

### Task 4: LMSContext.setGradesReleased + test

**Files:**
- Modify: `client/src/context/LMSContext.tsx` (context type ~line 121-123, implementation after `updateCourseGradingTerms` ~line 2027, provider value ~line 4217-4219)
- Test: `client/src/context/LMSContext.gradesRelease.test.tsx` (create; copy the mock/provider pattern from `client/src/context/LMSContext.updateUser.test.tsx`)

**Interfaces:**
- Consumes: `apiFetch`, `normalizeCourseSyllabus`, `setDb`, `showAlert` (all in scope in `LMSContext.tsx`).
- Produces: `setGradesReleased: (courseId: string, term: TermId, released: boolean) => Promise<void>` on context.

- [ ] **Step 1: Write the failing test**

Create `client/src/context/LMSContext.gradesRelease.test.tsx`. Mock `../api/client` exactly like the updateUser test (login returns a faculty user, course/bootstrap endpoints return empties). The probe captures `db.courses` via `useLMS()` and exposes `login` plus `setGradesReleased`. After login, call `setGradesReleased('c1', 'midterm', true)` with the PATCH mock returning `{ course: { id: 'c1', gradesReleased: JSON.stringify({ midterm: true }) } }`, then assert the cached course has `gradesReleased.midterm === true`:

```tsx
await act(async () => {
  await doRelease!();
});
await waitFor(() => {
  expect(latestCourses.find(c => c.id === 'c1')?.gradesReleased).toEqual({ midterm: true });
});
```

Note: the probe needs a course row present — seed it by having the `/api/courses` mock return `{ courses: [{ id: 'c1', code: 'C1', title: 'T', section: 'S', term: 'T', instructorId: 'u1', instructorName: 'N', published: true, enrolledCount: 0 }] }` so `refreshAll` caches it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run src/context/LMSContext.gradesRelease.test.tsx` from `client/`
Expected: FAIL — `setGradesReleased is not a function` (or undefined).

- [ ] **Step 3: Implement**

Add to the context type (near `updateCourseGradingTerms` declaration):

```ts
setGradesReleased: (courseId: string, term: TermId, released: boolean) => Promise<void>;
```

Add after the `updateCourseGradingTerms` implementation:

```ts
const setGradesReleased = async (courseId: string, term: TermId, released: boolean): Promise<void> => {
  const prev = db.courses.find(c => c.id === courseId)?.gradesReleased;
  const optimistic = { ...(prev || {}), [term]: released };
  setDb(prevDb => ({
    ...prevDb,
    courses: prevDb.courses.map(c => (c.id === courseId ? { ...c, gradesReleased: optimistic } : c))
  }));
  try {
    const { course } = await apiFetch<{ course: Course }>(
      `/api/courses/${encodeURIComponent(courseId)}/grades-release`,
      { method: 'PATCH', body: { term, released } }
    );
    const normalized = normalizeCourseSyllabus(course);
    setDb(prevDb => ({
      ...prevDb,
      courses: prevDb.courses.map(c => (c.id === courseId ? normalized : c))
    }));
    showAlert({
      title: released ? 'Grades Released' : 'Grades Un-released',
      message: `${term} grades are now ${released ? 'visible to students' : 'hidden from students'}.`,
      type: 'success'
    });
  } catch (err) {
    setDb(prevDb => ({
      ...prevDb,
      courses: prevDb.courses.map(c =>
        c.id === courseId ? { ...c, gradesReleased: prev || {} } : c
      )
    }));
    const message = err instanceof ApiError ? err.message : 'Failed to update grade release.';
    setLastError(message);
    showAlert(message, 'Grade Release Failed');
    throw err;
  }
};
```

Add `setGradesReleased` to the provider value object next to `updateCourseGradingTerms`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run src/context/LMSContext.gradesRelease.test.tsx` from `client/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/context/LMSContext.tsx client/src/context/LMSContext.gradesRelease.test.tsx
git commit -m "feat(client): setGradesReleased context action"
```

---

### Task 5: Faculty release toggles + tests

**Files:**
- Modify: `client/src/components/grading/FacultyGradebook.tsx` (legend bar ~line 343-355; needs `setGradesReleased` from `useLMS`, `Lock`/`Globe` icons already imported)
- Test: extend `client/src/components/grading/FacultyGradebook.test.tsx` (mocked `useLMS` pattern already there — add `setGradesReleased: vi.fn()` to the mock and new `describe` block)

**Interfaces:**
- Consumes: `setGradesReleased` from Task 4; `terms`, `TERM_LABELS`, existing legend markup.
- Produces: per-term Release/Un-release buttons (`data-testid="grades-release-<term>"`) + status pills.

- [ ] **Step 1: Write the failing tests**

The file already has a hoisted `mocks` object (`db`, `isLoading`, `isSyncing`) and a `baseDb()` helper whose course row has no `gradesReleased`. Make these exact edits: add `setGradesReleased: vi.fn(),` to the hoisted `mocks` object; add `setGradesReleased: mocks.setGradesReleased,` to the mocked `useLMS()` return; in the new block's `beforeEach`, set `mocks.setGradesReleased.mockClear()` and seed `mocks.db = { ...baseDb(), courses: [{ ...baseDb().courses[0], gradesReleased: { midterm: true } }] };`. Then add:

```tsx
describe('FacultyGradebook grade release', () => {
  beforeEach(() => {
    mocks.setGradesReleased.mockClear();
    mocks.db = { ...baseDb(), courses: [{ ...baseDb().courses[0], gradesReleased: { midterm: true } }] };
    localStorage.setItem('gabay-gradebook-collapsed-c1', JSON.stringify([]));
  });

  test('released term shows pill and Un-release; unreleased shows Release', () => {
    render(<FacultyGradebook courseId="c1" />);
    expect(screen.getByTestId('grades-release-midterm')).toHaveTextContent(/un-release/i);
    expect(screen.getByTestId('grades-release-finals')).toHaveTextContent(/^release$/i);
    expect(screen.getByText('Released')).toBeInTheDocument();
    expect(screen.getByText('Not released')).toBeInTheDocument();
  });

  test('clicking Release calls setGradesReleased with term and true', () => {
    render(<FacultyGradebook courseId="c1" />);
    fireEvent.click(screen.getByTestId('grades-release-finals'));
    expect(mocks.setGradesReleased).toHaveBeenCalledWith('c1', 'finals', true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/components/grading/FacultyGradebook.test.tsx` from `client/`
Expected: FAIL — `Unable to find ... grades-release-midterm`.

- [ ] **Step 3: Implement the toggles**

In `FacultyGradebook.tsx`, pull `setGradesReleased` from `useLMS()`, derive `const releaseMap = course?.gradesReleased || {}`. In the legend bar (after the term weights, ~line 352), render per term:

```tsx
{terms.map(t => {
  const released = releaseMap[t] === true;
  return (
    <span key={`release-${t}`} className="flex items-center space-x-1">
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${released ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
        {released ? 'Released' : 'Not released'}
      </span>
      <button
        type="button"
        data-testid={`grades-release-${t}`}
        onClick={() => void setGradesReleased(courseId, t, !released)}
        className="px-2 py-0.5 text-[11px] font-bold rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all cursor-pointer"
      >
        {released ? 'Un-release' : 'Release'}
      </button>
    </span>
  );
})}
```

Guard the click when `!course` (no-op). Keep everything else in the file untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/components/grading/FacultyGradebook.test.tsx` from `client/`
Expected: PASS (old + new tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/grading/FacultyGradebook.tsx client/src/components/grading/FacultyGradebook.test.tsx
git commit -m "feat(client): faculty per-term grade release toggles"
```

---

### Task 6: StudentGradebook rewrite (remove calculator, gate on release) + tests

**Files:**
- Modify: `client/src/components/grading/StudentGradebook.tsx` (full rewrite of render; keep computation)
- Test: create `client/src/components/grading/StudentGradebook.test.tsx` (mocked `useLMS`: course with syllabus + `gradesReleased` map, `db.activities/quizzes/submissions/exams`, `markTabVisited: vi.fn()`, `effectiveTermsForCourse: () => ['midterm','finals']`)

**Interfaces:**
- Consumes: `course.gradesReleased`, existing `termOfficial`/`officialFor` computation (keep as-is).
- Produces: released-only student view; no `simulated` exports (all simulation code deleted).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('StudentGradebook release gating', () => {
  test('nothing released → locked empty state, no scores, no simulator', () => {
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/still not released/i)).toBeInTheDocument();
    expect(screen.queryByText(/what-if/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/simulator/i)).not.toBeInTheDocument();
  });

  test('partial release → released term visible, unreleased locked, no total', () => {
    // gradesReleased: { midterm: true }
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/midterm period grade/i)).toBeInTheDocument();
    expect(screen.getByText(/not released/i)).toBeInTheDocument();
    expect(screen.queryByText(/calculated final course rating/i)).not.toBeInTheDocument();
  });

  test('full release → total and transmuted grade shown', () => {
    // gradesReleased: { midterm: true, finals: true }
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/calculated final course rating/i)).toBeInTheDocument();
  });
});
```

Seed the mocked course with a minimal `syllabus: { gradingSystem: null }` so `resolveSPRWeights` defaults apply, empty activities/quizzes (official scores render as Pending but structure shows). Tune text matchers to the final copy below.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/components/grading/StudentGradebook.test.tsx` from `client/`
Expected: FAIL — locked message missing (current view always renders calculator).

- [ ] **Step 3: Rewrite the component**

Keep lines 1–89 (imports, `TERM_DESC`, computation of `terms`, `weights`, `termWeights`, `autoCols`, `columnsByTerm`, `termOfficial`, `officialFor`) and the no-syllabus gate, with these changes:
- Delete `simulated`/`isWhatIfActive` state, `simOf`, `handleSimChange`, `handleResetWhatIf`, `simulatedTotalPercentage`, `simulatedTransmuted`.
- Remove `Sliders`, `RefreshCw` imports if unused.
- Retitle header to `My Grades` (both main view and syllabus gate); keep the term-weight pills.
- Add `const isReleased = (t: TermId): boolean => course?.gradesReleased?.[t] === true;` and `const allReleased = terms.length > 0 && terms.every(isReleased);`
- Official card: if `!terms.some(isReleased)`, render the locked empty state instead of the whole grid:

```tsx
<div className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle" data-testid="grades-not-released">
  <h3 className="text-sm font-bold text-foreground">Your grades are still not released</h3>
  <p className="text-xs text-muted-foreground mt-1">Check back after your instructor releases them.</p>
</div>
```

- Breakdown table: keep Grading period / Weight / Official score columns only; unreleased rows show a lock (`Lock` icon + "Not released") in the Official score cell. Delete the simulator columns.
- Summary row (total + transmuted): render only when `allReleased`.
- Official grade card: show only released terms in the breakdown line; when none released the locked state above already returned.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/components/grading/StudentGradebook.test.tsx` from `client/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/grading/StudentGradebook.tsx client/src/components/grading/StudentGradebook.test.tsx
git commit -m "feat(client): student grades gated on faculty release, calculator removed"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run the full client suite**

Run: `npx vitest --run` from `client/`
Expected: 0 failures. (Known pre-existing: none in gradebook scope; if unrelated suites fail, verify they fail on a clean tree before touching them.)

- [ ] **Step 2: Run the full server suite**

Run: `npx vitest run` from `server/`
Expected: 0 failures.

- [ ] **Step 3: Typecheck the client**

Run: `npx tsc --noEmit -p tsconfig.app.json` from `client/` (allow the generous timeout; large project).
Expected: no errors in touched files. (Known pre-existing: verify any error also occurs without these changes.)

- [ ] **Step 4: Final commit if anything outstanding**

```bash
git status --short
```

Commit only leftover fixups with a `fix:` message. Then report the evidence (suite counts) per verification-before-completion.
