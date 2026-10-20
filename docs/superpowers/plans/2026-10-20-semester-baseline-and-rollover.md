# Semester Baseline and Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the semester the same governance as the school year — an institution-wide baseline semester set by the administrator, a per-college rollover owned by each Dean, and an Upload Program Assigned Courses screen with no semester choice and no downloadable template.

**Architecture:** The baseline semester is stored on the ERP `school_years` row that is currently active and mirrored into `LMSContext` state with a localStorage cache, exactly as the baseline school year already works. A college's active semester is a second localStorage record alongside the existing `collegeActiveSchoolYears`. The upload screen reads the college's active semester and stamps every created course with it; its upload gate now considers both axes.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), Tailwind, `xlsx` for sheet parsing, Directus/Likha ERP via `likhaLmsApi`.

**Spec:** `docs/superpowers/specs/2026-10-20-semester-baseline-and-rollover-design.md`

## Global Constraints

- The only semester spellings anywhere in the codebase are the exact strings `First`, `Second`, `Mid-Year`. Never `1st`, `2nd`, `Midyear`, `Summer`, or `First Semester` in a stored value. `First Semester` and `Second Semester` appear only as *display labels*.
- College semester values default to the exact string `First` when absent or unrecognized. There is no "null semester" state.
- The ERP is modified through the browser subagent **only** for the one schema addition in Task 1. Everything else is ordinary `/items/school_years` item reads and writes, which are permitted. Never call `/fields`, `/relations`, `/collections`, or any DDL endpoint from code.
- Every ERP call in this feature is wrapped so a failure leaves the local state intact and never blocks a rollover or an upload (`catch {}`).
- A semester rollover must **not** touch `user.yearLevel` or `user.yearsOfTeaching`. Only `setActiveSchoolYear` advances people.
- A college's active semester is never written to the ERP.
- These `data-testid` values must still exist after every task: `assigned-courses-academic-year-display`, `assigned-courses-baseline-mismatch-banner`, `assigned-courses-baseline-mismatch-badge`, `assigned-courses-file-input`, `assigned-courses-dropzone`, `governance-baseline-warning`, `college-content-${college.id}`, `program-row-${dept.id}`, `baseline-mismatch-badge-${college.id}`.
- The existing modal title `Confirm Academic Year Rollover` must still render for a school-year rollover.
- One commit per task. Run test commands from the `client/` directory as `npm test -- run <path>`.

## Review Focus

Inputs and conditions the spec implies but no task's tests pin by default. Each line names the behavior a reasonable person expects; the owning task gets the matching test.

1. **A `Semester` column holding an unrecognized value** (e.g. `Summer`, or a typo) in an uploaded sheet. Expected: the upload succeeds and the value is ignored, because the semester now comes from the college. Owning task: Task 6.
2. **A college that has never rolled over while the baseline is not `First`.** Expected: it reads `First`, shows the amber mismatch, and is blocked from uploading rather than silently proceeding. Owning tasks: Task 2, Task 7.
3. **An ERP that answers with a null or unknown `semester`**, or does not answer at all. Expected: the baseline reads `First`, the app renders, and a baseline change still succeeds locally. Owning tasks: Task 3, Task 4.
4. **Corrupt JSON in the semester localStorage keys.** Expected: the app boots on defaults instead of throwing. Owning task: Task 2.
5. **An administrator submitting the baseline semester it is already set to**, or double-clicking the update button. Expected: a clear refusal and no state change. Owning tasks: Task 2, Task 4.

---

### Task 1: Provision the ERP `semester` field

**Files:**
- Modify: ERP `school_years` collection via the browser subagent at `https://gabay.zyberlab.com/admin` (no repository file)

**Interfaces:**
- Consumes: nothing.
- Produces: the ERP `school_years` field `semester` (string, choices `First` / `Second` / `Mid-Year`), which Task 3 reads and writes. Every other task works without it because tests mock the API.

- [ ] **Step 1: Stop and confirm with the human partner before touching production**

The ERP at `https://gabay.zyberlab.com` is live and shared. Report that this task adds one field to `school_years` and wait for a go-ahead before Step 2.

- [ ] **Step 2: Inspect the current collection**

Using the browser subagent, open Collections → `school_years` and record the current field list and the row where `is_active` is true. If a field named `semester` already exists, skip to Step 4 and report its interface and choices instead.

- [ ] **Step 3: Add the field through the admin UI**

Create a field named `semester` with type Dropdown (string), interface "Dropdown", choices `First`, `Second`, `Mid-Year`, default value `First`, "Required" off, "Allow null" on. Save through the UI only.

- [ ] **Step 4: Verify**

Re-open the collection and confirm: the field exists with those three choices; the previously active row is untouched except that its `semester` reads `First`; no other row changed. Paste the observed values into the task report.

- [ ] **Step 5: No commit**

This task changes no files. Note in the task report that it is complete before Tasks 2–8 are exercised against production.

---

### Task 2: Semester state, API, and reset rules in `LMSContext`

**Files:**
- Modify: `client/src/shared/types/lms.ts` (add `AcademicSemester` beside `SchoolYear`, around line 46)
- Create: `client/src/shared/utils/academicSemester.ts`
- Modify: `client/src/features/courses/utils/chairSheetParser.ts` (delegate the existing semester helpers, around lines 5-22)
- Modify: `client/src/shared/context/LMSContext.tsx` (state after the `collegeActiveSchoolYears` block near line 1848; getters/setters near lines 5298-5372; provider value near line 8315)
- Test: `client/src/shared/context/LMSContext.semester.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `AcademicSemester = 'First' | 'Second' | 'Mid-Year'`; `ACADEMIC_SEMESTERS: readonly AcademicSemester[]`; `normalizeAcademicSemester(raw?: string | null): AcademicSemester`; `formatSemesterLabel(semester: AcademicSemester): string`; the context members `baselineSemester: AcademicSemester`, `setBaselineSemester(semester: AcademicSemester): Promise<{ success: boolean; message?: string }>`, `getActiveSemesterForCollege(collegeId?: string): AcademicSemester`, `setActiveSemesterForCollege(collegeId: string, semester: AcademicSemester): Promise<{ success: boolean; message?: string }>`; localStorage keys `gabay_baseline_semester_v1` and `gabay_college_active_semesters`.

- [ ] **Step 1: Write the failing test**

Create `client/src/shared/context/LMSContext.semester.test.tsx`, copying the `vi.mock('../api/client', ...)` scaffold and the `Probe` pattern from `LMSContext.schoolYear.test.tsx` verbatim (including `localStorage.clear()` in `beforeEach`). Add these cases:

```tsx
test('defaults the baseline semester to First and a college with no record to First', ...)
  // expect(contextValues.baselineSemester).toBe('First');
  // expect(contextValues.getActiveSemesterForCollege('col-nothing')).toBe('First');

test('rejects rolling a college to a semester other than the baseline', ...)
  // res = await contextValues.setActiveSemesterForCollege('col-ccs', 'Second');
  // expect(res.success).toBe(false);
  // expect(res.message).toContain('university baseline semester');

test('rolls a college over to the baseline semester', ...)
  // await setBaselineSemester('Second'); res = await setActiveSemesterForCollege('col-ccs','Second');
  // expect(res.success).toBe(true);
  // expect(getActiveSemesterForCollege('col-ccs')).toBe('Second');
  // expect(getActiveSemesterForCollege('col-cas')).toBe('First');   // independent per college

test('resets the baseline semester to First when the baseline school year changes, without touching college semesters', ...)
  // await setBaselineSemester('Second');
  // await setActiveSemesterForCollege('col-ccs','Second');
  // await setActiveSchoolYear(... baseline year ...)   // via addSchoolYear + setBaselineSchoolYear as in the schoolYear test
  // expect(contextValues.baselineSemester).toBe('First');
  // expect(getActiveSemesterForCollege('col-ccs')).toBe('Second');  // Dean still has to roll

test('leaves the college semester untouched when the school year is rolled over', ...)
  // baseline 'Second', college rolled to 'Second', then roll the college's active school year
  // expect(getActiveSemesterForCollege('col-ccs')).toBe('Second');

test('does not increment yearLevel or yearsOfTeaching on a semester rollover', ...)
  // login, capture a student's yearLevel and a faculty member's yearsOfTeaching
  // await setBaselineSemester('Second'); await setActiveSemesterForCollege('col-ccs','Second');
  // both values unchanged

test('refuses a baseline semester change to the current value', ...)
  // res = await contextValues.setBaselineSemester('First');
  // expect(res.success).toBe(false);

test('notifies deans and chairpersons when the baseline semester changes', ...)
  // after login + setBaselineSemester('Second')
  // deanNotifs.some(n => n.type === 'baseline_changed' && n.content.includes('Second')) === true
  // chairNotifs likewise; studentNotifs.some(n => n.type === 'baseline_changed') === false

test('recovers from corrupt semester localStorage entries', ...)
  // localStorage.setItem('gabay_college_active_semesters', '{not json');
  // render, expect getActiveSemesterForCollege('col-ccs') === 'First' and no throw
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/shared/context/LMSContext.semester.test.tsx`
Expected: FAIL — `contextValues.baselineSemester` is `undefined` and `setActiveSemesterForCollege` is not a function.

- [ ] **Step 3: Implement the type and the shared helpers**

In `lms.ts`, beside `SchoolYear`:

```ts
export type AcademicSemester = 'First' | 'Second' | 'Mid-Year';
```

Create `client/src/shared/utils/academicSemester.ts` holding the single implementation:

```ts
export const ACADEMIC_SEMESTERS: readonly AcademicSemester[] = ['First', 'Second', 'Mid-Year'];
export function normalizeAcademicSemester(raw?: string | null): AcademicSemester
export function formatSemesterLabel(semester: AcademicSemester): string
```

`normalizeAcademicSemester` must reproduce, exactly, the behavior `chairSheetParser.normalizeAssignedSemester` has today: collapse `-`, `_` and whitespace to single spaces, lowercase; anything containing `mid` or `summer` → `Mid-Year`; anything containing `second`, a standalone `2`/`2nd`, or a leading `2nd` → `Second`; everything else (including empty, null, and unrecognized text) → `First`. `formatSemesterLabel` returns `First Semester`, `Second Semester`, and `Mid-Year`.

In `chairSheetParser.ts`, keep the exported names but delegate: `export type AssignedCourseSemester = AcademicSemester;`, `export const ASSIGNED_COURSE_SEMESTERS = ACADEMIC_SEMESTERS;`, and make `normalizeAssignedSemester` re-export `normalizeAcademicSemester` so no call site changes. The existing `chairSheetParser.test.ts` expectations for `ASSIGNED_COURSE_SEMESTERS` and `normalizeAssignedSemester` must stay green.

- [ ] **Step 4: Implement the context state and API**

Declare both storage keys next to `STORAGE_KEY_COLLEGE_ACTIVE_SY`. Declare the state and its `useRef` mirrors plus persistence effects immediately after the `collegeActiveSchoolYears` block, so the ERP hydration effect below can already read the refs.

`getActiveSemesterForCollege` resolves the college id as `collegeId || activeUser?.collegeId`, returns the recorded value normalized, and otherwise returns `'First'`. Do not fall back to the baseline semester.

`setActiveSemesterForCollege` normalizes the argument, compares it to `baselineSemesterRef.current`, and returns `{ success: false, message: 'Colleges can only roll over to the current university baseline semester (X Semester).' }` on a mismatch. On success it writes the record and the localStorage cache and returns `{ success: true, message: 'College rolled over to X Semester.' }`. It must not call `setDb` or touch any user.

`setBaselineSemester` returns `{ success: false, message: 'The university baseline semester is already X Semester.' }` when the target equals the current value; otherwise it writes the state, the ref, the localStorage cache, and appends a `baseline_changed` notification to the Deans and Chairpersons using the same recipient filter, `actorId`/`actorName` fields, and `setNotifications` + `setDb` pattern as `setBaselineSchoolYear`, with `relatedId` set to the semester string and `content` reading `The baseline semester has now changed to X Semester.`

In `setBaselineSchoolYear`, add `baselineSemester` reset to `'First'` (state, ref, and localStorage) next to its existing work. Leave `setActiveSchoolYear` completely unchanged.

Add all four members to the provider value object next to `getBaselineSchoolYear`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- run src/shared/context/LMSContext.semester.test.tsx src/shared/context/LMSContext.schoolYear.test.tsx src/features/courses/utils/chairSheetParser.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/types/lms.ts client/src/shared/utils/academicSemester.ts client/src/features/courses/utils/chairSheetParser.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.semester.test.tsx
git commit -m "feat(academic): add semester baseline state and rollover API"
```

---

### Task 3: Persist the baseline semester in the ERP

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (inside `academicStructure`, after `updateSchoolYear`, around line 2008)
- Modify: `client/src/shared/context/LMSContext.tsx` (hydration effect around lines 1927-1944; `setBaselineSemester` and `setBaselineSchoolYear` from Task 2)
- Test: `client/src/shared/context/LMSContext.semesterLikha.test.tsx`

**Interfaces:**
- Consumes: `normalizeAcademicSemester`, `baselineSemester`, `setBaselineSemester`, `setBaselineSchoolYear` from Task 2.
- Produces: `likhaLmsApi.academicStructure.updateSchoolYearSemester(id: string, semester: string): Promise<any>`.

- [ ] **Step 1: Write the failing test**

Create `client/src/shared/context/LMSContext.semesterLikha.test.tsx` following the scaffold of `LMSContext.schoolYear.test.tsx`, but give the mocked `academicStructure` a `getSchoolYears` and an `updateSchoolYearSemester`, e.g.:

```ts
academicStructure: {
  getColleges: vi.fn(async () => [{ id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' }]),
  getDepartments: vi.fn(async () => []),
  getSchoolYears: vi.fn(async () => [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'Second' },
  ]),
  updateSchoolYear: vi.fn(async () => ({})),
  updateSchoolYearSemester: vi.fn(async () => ({})),
},
```

Cases:

```tsx
test('hydrates the baseline semester from the active ERP school year row', ...)
  // expect(contextValues.baselineSemester).toBe('Second');

test('normalizes a legacy Summer value to Mid-Year and unrecognized text to First', ...)
  // getSchoolYears resolves semester: 'Summer' -> baselineSemester === 'Mid-Year'
  // getSchoolYears resolves semester: 'nonsense' -> baselineSemester === 'First'
  // getSchoolYears resolves semester: null -> baselineSemester === 'First'

test('PATCHes semester on the active school year row when the baseline semester changes', ...)
  // await setBaselineSemester('Mid-Year');
  // expect(updateSchoolYearSemester).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mid-Year');

test('sends is_active and semester First together when the baseline school year changes', ...)
  // await setBaselineSchoolYear('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  // expect(updateSchoolYear).toHaveBeenCalledWith('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { is_active: true, semester: 'First' });

test('keeps the local baseline semester change when the ERP call rejects', ...)
  // updateSchoolYearSemester.mockRejectedValueOnce(new Error('502'))
  // res = await setBaselineSemester('Second'); expect(res.success).toBe(true);
  // expect(contextValues.baselineSemester).toBe('Second');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/shared/context/LMSContext.semesterLikha.test.tsx`
Expected: FAIL — `updateSchoolYearSemester` is called zero times and the baseline never hydrates from the ERP.

- [ ] **Step 3: Add the API method**

In `likhaLmsApi.ts`, beside `updateSchoolYear`:

```ts
async updateSchoolYearSemester(id: string, semester: string): Promise<any> {
  return likhaRequest(`/items/school_years/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ semester }),
  });
},
```

- [ ] **Step 4: Hydrate and write back in `LMSContext`**

In the hydration effect's `sySettled` branch, after the existing `setSchoolYears` merge, find the row whose `is_active` (or `isActive`) is true, normalize its `semester` with `normalizeAcademicSemester`, and write the result to `baselineSemester` state, its ref, and the localStorage cache. Do nothing when there is no active row, so the locally generated years and defaults survive an empty ERP response.

In `setBaselineSemester`, after the local writes and before returning, resolve `getBaselineSchoolYear()?.id` and, when that id is a UUID and `likhaLmsApi?.academicStructure?.updateSchoolYearSemester` exists, `await` the PATCH inside a `try { } catch {}`. Reuse the UUID check the same way `setBaselineSchoolYear` does.

In `setBaselineSchoolYear`, add `semester: 'First'` to the object passed for the newly active row, so both writes from task 2's local reset and this PATCH agree.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- run src/shared/context/LMSContext.semesterLikha.test.tsx src/shared/context/LMSContext.semester.test.tsx src/shared/context/LMSContext.schoolYear.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.semesterLikha.test.tsx
git commit -m "feat(academic): persist the baseline semester on the active school year row"
```

---

### Task 4: Baseline semester control in Academic Governance

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx` (destructure near line 51; baseline card around lines 535-578; confirmation modal beside `baselineConfirmData`'s modal)
- Modify: `client/src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx` (useLMS mock)
- Modify: `client/src/features/accounts/components/AcademicStructureTab.test.tsx` (useLMS mock, if it renders colleges)
- Test: `client/src/features/accounts/components/AcademicStructureTab.semester.test.tsx`

**Interfaces:**
- Consumes: `AcademicSemester`, `ACADEMIC_SEMESTERS`, `formatSemesterLabel` (Task 2); the context's `baselineSemester` and `setBaselineSemester`.
- Produces: the `baseline-semester-select` dropdown, the update button, and the confirmation dialog that Task 5's tests and any later reader rely on.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/accounts/components/AcademicStructureTab.semester.test.tsx` from the scaffold of `AcademicStructureTab.schoolYear.test.tsx` (same `react-router-dom` mock, same `sampleColleges` / `sampleDepartments` / `sampleUsers` shape, same `vi.mock('../../../shared/context/LMSContext', ...)`), whose `useLMS` mock additionally provides `baselineSemester: 'Second'`, `setBaselineSemester: mockSetBaselineSemester`, `getActiveSemesterForCollege: () => 'First'`, `setActiveSemesterForCollege: mockSetActiveSemesterForCollege`.

Cases:

```tsx
test('renders the baseline semester control for a university administrator', ...)
  // mockActiveRole = 'admin'; mockActiveUser = { ...admin, adminSubrole: undefined }
  // expect(screen.getByLabelText(/Select University-Wide Default Baseline Semester/i)).toBeInTheDocument();
  // expect(screen.getByText(/Second Semester/)).toBeInTheDocument();   // current baseline shown

test('hides the baseline semester control from a Dean', ...)
  // mockActiveUser = dean of col-cet; expect(queryByLabelText(/Baseline Semester/i)).toBeNull();

test('confirms before updating the baseline semester', ...)
  // choose 'Mid-Year' in the dropdown, click the update button
  // expect(screen.getByText('Confirm Baseline Semester Update')).toBeInTheDocument();
  // click 'Confirm Baseline Semester'
  // await waitFor(() => expect(mockSetBaselineSemester).toHaveBeenCalledWith('Mid-Year'));

test('disables the update button when the selection matches the current baseline', ...)
  // select the value equal to baselineSemester ('Second') -> update button disabled
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/features/accounts/components/AcademicStructureTab.semester.test.tsx`
Expected: FAIL — no element labelled `Select University-Wide Default Baseline Semester`.

- [ ] **Step 3: Update the existing mocks**

Add `baselineSemester: 'Second'`, `setBaselineSemester: vi.fn().mockResolvedValue({ success: true })`, `getActiveSemesterForCollege: vi.fn().mockReturnValue('First')`, and `setActiveSemesterForCollege: vi.fn().mockResolvedValue({ success: true })` to the `useLMS` mock in `AcademicStructureTab.schoolYear.test.tsx`, and to `AcademicStructureTab.test.tsx` if that file's mock drives a render of the college list. Run both afterwards — they must stay green.

- [ ] **Step 4: Build the control**

Rename the card's heading to `University-Wide Default Baseline Academic Term` and add a second control group beside the existing academic year select, inside the same `canManageBaselineSchoolYear` guard. Treat a missing or unrecognized `baselineSemester` from the context as `First` everywhere in this card, so an unmigrated back end renders a complete control rather than a blank one.

- a `CustomDropdown` with `id="baseline-semester-select"`, `ariaLabel="Select University-Wide Default Baseline Semester"`, `className="w-56"`, options built from `ACADEMIC_SEMESTERS` with `formatSemesterLabel`, and value `selectedBaselineSemesterId || baselineSemester`;
- a button reading `Update Semester`, disabled when the selection is empty or equals `baselineSemester`;
- the hint paragraph: `Changing the baseline academic year resets the baseline semester to First Semester and requires Deans to roll over again.`

Add local state `selectedBaselineSemester` and `semesterConfirmData: { target: AcademicSemester; current: AcademicSemester } | null`, plus `isUpdatingSemester`. Clicking the button sets `semesterConfirmData`. Add a `DialogFrame` titled `Confirm Baseline Semester Update`, subtitle `Set the university-wide baseline semester`, body text naming the target and warning that colleges must roll over, and a footer whose confirm button reads `Confirm Baseline Semester`, calls `setBaselineSemester(target)` inside a `try/finally` that clears `isUpdatingSemester`, then `showAlert` with `type: 'success'` and the returned message on success, `type: 'error'` with the message otherwise.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- run src/features/accounts/components/AcademicStructureTab.semester.test.tsx src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx src/features/accounts/components/AcademicStructureTab.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/accounts/components/AcademicStructureTab.tsx client/src/features/accounts/components/AcademicStructureTab.semester.test.tsx client/src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx client/src/features/accounts/components/AcademicStructureTab.test.tsx
git commit -m "feat(governance): add the university baseline semester control"
```

---

### Task 5: Collegiate semester rollover

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx` (college semester row directly after the academic year row inside the expanded body; rollover confirm state and modal around lines 179-260 and 1251-1299)
- Test: `client/src/features/accounts/components/AcademicStructureTab.semesterRollover.test.tsx`

**Interfaces:**
- Consumes: Task 4's file state; the context's `getActiveSemesterForCollege`, `setActiveSemesterForCollege`, `baselineSemester`.
- Produces: `college-active-semester-${college.id}`, `semester-select-${college.id}`, `baseline-semester-mismatch-badge-${college.id}`, the `Roll Over to Semester` button, and the generalized `rolloverConfirmData` with `kind: 'schoolYear' | 'semester'`.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/accounts/components/AcademicStructureTab.semesterRollover.test.tsx` using the Task 4 scaffold, with a Dean of `col-cet` signed in, `baselineSemester: 'Second'`, and `getActiveSemesterForCollege` returning `'First'` for `col-cet`. Expand the college card (`fireEvent.click` the element labelled `Toggle programs for College of Engineering and Technology`).

Cases:

```tsx
test('shows the college active semester and the amber mismatch badge', ...)
  // expect(screen.getByTestId('college-active-semester-col-cet')).toHaveTextContent('First Semester');
  // expect(screen.getByTestId('baseline-semester-mismatch-badge-col-cet')).toBeInTheDocument();

test('rolls the college over to the baseline semester after confirmation', ...)
  // select 'Second' in semester-select-col-cet, click 'Roll Over to Semester'
  // expect(screen.getByText('Confirm Semester Rollover')).toBeInTheDocument();
  // click 'Confirm Rollover'
  // await waitFor(() => expect(mockSetActiveSemesterForCollege).toHaveBeenCalledWith('col-cet', 'Second'));

test('disables the semester rollover when the selection matches the college active semester', ...)
  // getActiveSemesterForCollege -> 'Second' and baseline 'Second'
  // the 'Roll Over to Semester' button is disabled

test('does not offer the semester rollover to a chairperson', ...)
  // chairperson signed in: queryByRole('button', { name: /Roll Over to Semester/i }) is null,
  // but the active semester badge still renders
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/features/accounts/components/AcademicStructureTab.semesterRollover.test.tsx`
Expected: FAIL — no `college-active-semester-col-cet`.

- [ ] **Step 3: Generalize the rollover confirmation state**

Change `rolloverConfirmData` to carry `kind: 'schoolYear' | 'semester'`, keeping the existing fields and adding optional `targetSemester?: AcademicSemester` and `currentActiveSemester?: AcademicSemester`. `handleInitiateRollover` sets `kind: 'schoolYear'`. Add `handleInitiateSemesterRollover(college, semester)` that sets `kind: 'semester'` with the college id, name, target and current semester. `handleConfirmRollover` branches on `kind`: the school-year path is the current code unchanged; the semester path calls `setActiveSemesterForCollege` and shows the same success/error `showAlert` shape with titles `College Semester Rollover Successful` and `Semester Rollover Failed`.

Update the existing `DialogFrame` so its title is `Confirm Semester Rollover` when `kind === 'semester'` and `Confirm Academic Year Rollover` otherwise, its subtitle names the college, and its body shows `Transitioning to SY X` for a school year or `Transitioning to X Semester` for a semester, with the existing warning box kept for school years and a semester-specific line for semesters. The footer's confirm button keeps the label `Confirm Rollover`.

- [ ] **Step 4: Add the collegiate semester row**

Immediately after the academic year row's closing markup, still inside the expanded college body and outside the `getColYears(college.id).length === 0` early return, render:

- `Active Semester:` label and a badge with `data-testid={'college-active-semester-' + college.id}` showing `formatSemesterLabel(getActiveSemesterForCollege(college.id))`;
- when that semester differs from `baselineSemester`, a badge with `data-testid={'baseline-semester-mismatch-badge-' + college.id}` reading `Current Baseline:` and `formatSemesterLabel(baselineSemester)`, styled like the existing academic year mismatch badge;
- when `canRolloverCollegeSchoolYear(college)` is true, a `CustomDropdown` with `id={'semester-select-' + college.id}`, `ariaLabel={'Select semester to roll over for ' + college.name}`, `className="w-48"`, options from `ACADEMIC_SEMESTERS`, plus a `Roll Over to Semester` button disabled unless the selection is non-empty, differs from the college's active semester, and equals `baselineSemester`. Its `title` explains which condition fails, in the same style as the academic year button.

Track the selection per college in a `Record<string, AcademicSemester>` state, defaulting to the baseline semester, mirroring `selectedSYByCollege`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- run src/features/accounts/components src/features/accounts/AcademicGovernancePage.test.tsx src/shared/components/layout/AppRail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/accounts/components/AcademicStructureTab.tsx client/src/features/accounts/components/AcademicStructureTab.semesterRollover.test.tsx
git commit -m "feat(governance): let deans roll their college over to the baseline semester"
```

---

### Task 6: Remove the semester choice and the template download from the upload flow

**Files:**
- Modify: `client/src/features/courses/utils/chairSheetParser.ts` (delete the template API around lines 267-309; drop `semester` from `RawChairSheetRow` at line 31; stop mapping the column around lines 146-156)
- Modify: `client/src/features/courses/components/ChairSheetPreviewTable.tsx` (lines 11-15 and 44, 124-132)
- Modify: `client/src/features/courses/components/ChairSheetUploadView.tsx` (import at line 22; `handleUpdateRow` lines 239-247; `handleDeleteRow` lines 266-274; `handleAddNewRow` lines 284-292; `createCourse` payload lines 325-338; dropzone buttons lines 585-592; format hint line 597)
- Test: `client/src/features/courses/components/ChairSheetUploadView.test.tsx`, `client/src/features/courses/utils/chairSheetParser.test.ts`, `client/src/features/courses/ChairSheetE2E.test.tsx`

**Interfaces:**
- Consumes: Task 2's parser delegation.
- Produces: `RawChairSheetRow` / `ValidatedChairSheetRow` with no `semester` property; an upload screen with a single dropzone button. Task 7 adds the semester stamping back.

- [ ] **Step 1: Update the tests to the new shape**

In `ChairSheetUploadView.test.tsx`: delete the `renders download template button in dropzone` test entirely; rewrite `displays Semester column, allows editing it, and generates course with corresponding term` as `creates every row without a semester field` asserting `screen.queryByRole('columnheader', { name: /^Semester$/i })` is null, `screen.queryByLabelText(/Semester for row 1/i)` is null, and after uploading a sheet whose rows carry a `Semester` column of `Mid-Year` the created course payloads contain no `semester` key.

In `chairSheetParser.test.ts`: delete the template workbook test around line 217 and drop every `semester` expectation from parsed rows, adding one case named `ignores a Semester column in the source workbook` that parses a sheet whose `Semester` cells read `Summer` and asserts the row has no `semester` property.

In `ChairSheetE2E.test.tsx`: the four `expect.objectContaining` assertions lose their `semester` key and all four `term` values become `1st Sem AY 2025-2026`, because no row carries a semester any more. Leave a comment in the file that Task 7 replaces these with the college's semester.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- run src/features/courses/utils/chairSheetParser.test.ts src/features/courses/components/ChairSheetUploadView.test.tsx src/features/courses/ChairSheetE2E.test.tsx`
Expected: FAIL — the `Semester` column header and the `Download Template` button still exist, and rows still carry a semester.

- [ ] **Step 3: Strip the parser**

Delete `generateChairSheetTemplateWorkbook`, `generateAssignedCoursesTemplateWorkbook`, `downloadChairSheetTemplate`, and `downloadAssignedCoursesTemplate`. Remove `semester` from `RawChairSheetRow`. Stop reading the `Semester` / `Sem` / `Term` column in `parseChairSheet`. Keep everything else exported from the file, including `formatCourseTerm`.

If `xlsx` becomes an unused import in the parser, leave it in place only if still used by `parseChairSheet`; otherwise remove the import.

- [ ] **Step 4: Strip the preview table**

Remove `SEMESTER_OPTIONS`, the `Semester` `<th>`, and the semester `<td>` containing the per-row `CustomDropdown`. The remaining columns are `#`, First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year & Sec, Faculty Verification, Actions. If `CustomDropdown` is still used by the faculty picker, keep the import.

- [ ] **Step 5: Strip the upload view**

Remove the `downloadAssignedCoursesTemplate` import and the whole `Download Template` button, leaving `Select Assigned Courses File` as the only button in that row. Remove the `semester` line from `handleUpdateRow`'s merge, from `handleDeleteRow`'s content check, and from `handleAddNewRow`'s seed object. Remove `semester: row.semester?.trim() || undefined` from the `createCourse` payload. Change the format hint to `Expected format: First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year and Section`, dropping `, Semester` and nothing else.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- run src/features/courses`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/courses
git commit -m "refactor(courses): drop semester choice and template download from the upload flow"
```

---

### Task 7: Gate the upload on both axes and stamp the college semester

**Files:**
- Modify: `client/src/features/courses/components/ChairSheetUploadView.tsx` (destructure around lines 40-50; gating around lines 111-148, 301-313; badge block around lines 399-419; banner lines 471-500; dropzone copy lines 536-543 and 570-574; approve modal line 779; `createCourse` payload)
- Modify: `client/src/features/courses/ChairSheetE2E.test.tsx`
- Modify: `client/src/features/courses/ChairSheetSchoolYearRollover.test.tsx` and `ChairSheetSchoolYearBaselineMismatch.test.tsx` (useLMS mocks)
- Test: `client/src/features/courses/ChairSheetSemesterBaselineMismatch.test.tsx`

**Interfaces:**
- Consumes: the context's `baselineSemester` and `getActiveSemesterForCollege`; `formatCourseTerm` from the parser.
- Produces: `assigned-courses-semester-display`; a single `mismatchErrorMessage` used by the banner, all four blocking `showAlert` calls, the dropzone copy, and the disabled button's `title`; created courses carrying `semester` and a matching `term`.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/courses/ChairSheetSemesterBaselineMismatch.test.tsx` from the scaffold of `ChairSheetSchoolYearBaselineMismatch.test.tsx`, with `getBaselineSchoolYear` and `getActiveSchoolYearForCollege` both reporting `2026-2027` so only the semester differs: `baselineSemester: 'Second'` and `getActiveSemesterForCollege: () => 'First'`.

Cases:

```tsx
test('blocks the upload and explains the semester mismatch for a college that has never rolled over', ...)
  // getActiveSemesterForCollege reports 'First' because col-ccs has no recorded semester
  // expect(screen.getByTestId('assigned-courses-baseline-mismatch-banner')).toBeInTheDocument();
  // expect(screen.getByTestId('assigned-courses-file-input')).toBeDisabled();
  // the banner text contains 'Second Semester' and 'First Semester' and does NOT contain 'academic year baseline' wording
  // clicking 'Select Assigned Courses File' shows an alert whose message mentions the semester, not the academic year

test('names both axes when the academic year and the semester both differ', ...)
  // college AY 2025-2026, baseline 2026-2027, college semester 'First', baseline 'Second'
  // banner text contains both 'AY 2026-2027' and 'Second Semester'

test('stamps every created course with the college active semester', ...)
  // aligned mocks: baseline and college both AY 2026-2027, both 'Second Semester'
  // upload a two-row sheet, approve, then every createCourse call has term '2nd Sem AY 2026-2027' and semester 'Second'

test('ignores a Semester column holding an unrecognized value', ...)
  // the uploaded sheet's Semester cells read 'Summer'; the created courses still carry the college semester
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/features/courses/ChairSheetSemesterBaselineMismatch.test.tsx`
Expected: FAIL — `assigned-courses-semester-display` does not exist and the gating ignores the semester.

- [ ] **Step 3: Gate on both axes with one message**

Destructure `baselineSemester` and `getActiveSemesterForCollege` from `useLMS`. Derive `activeCollegeSemester = getActiveSemesterForCollege(userCollegeId)` and `baselineSemesterValue = baselineSemester || 'First'`.

Keep `isBaselineMismatch` as the single boolean, now true when the academic years differ **or** the semesters differ.

Build one `mismatchErrorMessage` that branches into exactly three sentences:

- both differ: `The university baseline is AY X · S Semester, but your college is active for AY Y · T Semester.`
- only the year differs: today's existing academic year wording, unchanged.
- only the semester differs: `This college is active for T Semester, which does not match the university-wide baseline semester (S Semester). Roll the semester over in Academic Governance to continue.`

Use that single string in the banner, in all four `showAlert` calls (`handleProcessFile`, `handleDrop`, `handleFileChange`, `handleApproveAndSave` — their titles become `Upload Restricted: Academic Baseline Mismatch` and `Cannot Create Courses: Academic Baseline Mismatch`), in the locked-dropzone paragraph, and in the disabled Select button's `title`. Only the banner keeps the longer two-sentence form, appending the existing "Please ask your College Dean or University Administrator..." line.

- [ ] **Step 4: Show the semester and stamp it onto courses**

Next to the academic year badge, add a semester badge with `data-testid="assigned-courses-semester-display"` rendering `Semester:` and `formatSemesterLabel(activeCollegeSemester)`. Extend the header's "Academic Scope" metric card to `AY X · T Semester`.

In the dropzone, under the format hint, add the line `All rows are created under your college's active semester (T Semester).`

In `handleApproveAndSave`, set `semester: activeCollegeSemester` and `term: formatCourseTerm(activeCollegeSemester, selectedSchoolYear)` on the `createCourse` payload. Update the success alert to name both the year and the semester.

- [ ] **Step 5: Update the mocks and the E2E expectations**

Add `baselineSemester: '<the same semester as the college>'` and `getActiveSemesterForCollege: () => '<that semester>'` to the `useLMS` mocks in `ChairSheetSchoolYearRollover.test.tsx` and `ChairSheetSchoolYearBaselineMismatch.test.tsx`, and assert the new `assigned-courses-semester-display` in the rollover test.

In `ChairSheetE2E.test.tsx`, replace the Task 6 placeholder expectations: every created course now carries the mocked college semester and a matching term.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- run src/features/courses`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/courses
git commit -m "feat(courses): gate assigned-course uploads on the baseline semester"
```

---

### Task 8: Sidebar warning for either mismatch, then the full gate

**Files:**
- Modify: `client/src/shared/components/layout/AppRail.tsx` (lines 28-50 and the tooltip at 68-74)
- Test: `client/src/shared/components/layout/AppRail.test.tsx`

**Interfaces:**
- Consumes: the context's `baselineSemester`, `getActiveSemesterForCollege`.
- Produces: `governance-baseline-warning` firing on either axis.

- [ ] **Step 1: Write the failing test**

Add to `AppRail.test.tsx`, following its existing `useLMS` mock pattern and its existing "renders circular yellow warning tag on Academic Governance for Dean when college active year differs from baseline" test:

```tsx
it('renders the warning tag when only the semester differs from the baseline', ...)
  // baseline year and college year identical; baselineSemester 'Second'; getActiveSemesterForCollege -> 'First'
  // expect(screen.getByTestId('governance-baseline-warning')).toBeInTheDocument();

it('does not render the warning tag when both axes match', ...)
  // both years equal and both semesters 'Second' -> queryByTestId is null
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run src/shared/components/layout/AppRail.test.tsx`
Expected: FAIL — no warning tag when only the semester differs.

- [ ] **Step 3: Extend the warning**

Add `baselineSemester` and `getActiveSemesterForCollege` to the destructure, derive the college's semester the same way `collegeYear` is derived, and make `hasBaselineMismatch` true when either axis differs. Update the `title` to `University baseline (AY X · S Semester) differs from your college's active academic term (AY Y · T Semester)`, keeping the existing `data-testid` unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- run src/shared/components/layout/AppRail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite and the build**

Run: `npm test -- run`
Expected: PASS.

Run: `npm run build`
Expected: exit 0. `tsc -b` is part of it, so any leftover `row.semester` reference or unused import fails here.

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/components/layout/AppRail.tsx client/src/shared/components/layout/AppRail.test.tsx
git commit -m "feat(nav): warn on either academic baseline mismatch axis"
```
