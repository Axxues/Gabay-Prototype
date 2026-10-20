# Semester Baseline and Rollover Design

**Date:** 2026-10-20
**Status:** Awaiting approval

## Intent & The Why

The school year already has a university-wide **baseline academic year** set by the
University Administrator, which every college must roll over to before its
chairpersons may upload program-assigned courses. The semester has no such
structure: it is typed per row in the uploaded spreadsheet, and a chairperson can
silently create courses for whatever semester they feel like.

The client wants the semester to follow the same governance model as the school
year:

1. The University Administrator chooses a **baseline semester** (`First`,
   `Second`, or `Mid-Year`) alongside the baseline academic year.
2. College Deans independently **roll their college over** to that baseline
   semester, just as they roll over the academic year.
3. Changing the baseline academic year **automatically resets the baseline
   semester to `First`**.
4. Because the semester is now governed, the **Upload Program Assigned Courses**
   screen no longer lets anyone choose a semester, and no longer offers a
   downloadable template.

The result: a chairperson can only ever create course shells for the semester
their college has been rolled over to, and that semester must match what the
university as a whole is running.

---

## Goals

- A single university-wide baseline semester selector in Academic Governance,
  visible to the same roles that already manage the baseline academic year.
- A per-college active semester that only that college's Dean can roll over, and
  only to the current baseline semester.
- Baseline academic year change resets the baseline semester to `First`.
- Upload Program Assigned Courses loses all semester choice: no `Semester` column
  in the preview table, no per-row semester dropdown, no semester in the expected
  file format hint.
- Every course created by an upload is stamped with the **college's active
  semester** (both `course.semester` and the display `course.term`).
- Upload is blocked, with the same amber treatment used for academic year
  mismatch, whenever the college's academic year **or** semester differs from the
  university baseline.
- The Download Template affordance is removed from the upload screen.

## Non-Goals

- No change to `prelim` / `midterm` / `finals` grading terms.
- No change to how the dashboard's "All Semesters / First / Second / Mid-Year"
  filter behaves; its default stays `All Semesters`.
- No archive, locking, or read-only behavior for courses from a previous semester.
- No change to `CreateCoursePage`'s academic term picker or `EditCoursePage`'s
  read-only semester display.
- No new ERP collection, and no REST DDL calls (`/fields`, `/relations`) — the one
  schema change is made through the browser subagent (see Prerequisite).

## Anti-Goals

- Do **not** let a chairperson override the semester at upload time by any path
  (spreadsheet column, table dropdown, URL param, or custom row).
- Do **not** let a Dean roll a college over to a semester other than the baseline.
- Do **not** increment student `yearLevel` or faculty `yearsOfTeaching` on a
  semester rollover. Only academic year rollover advances people; advancing them
  every semester would push a first-year student out of the program in two years.
- Do **not** store a *college's* active semester in the ERP. Only the
  university-wide baseline semester is institutional; the collegiate value stays
  local, matching how a college's active school year already works.
- Do **not** issue the ERP schema change by script or REST call.

---

## Constraints

- The **baseline semester** is institution-wide: it is persisted on the ERP
  `school_years` row that is currently active, cached in `LMSContext` state and
  `localStorage` alongside the baseline school year, and re-hydrated from the ERP
  on load exactly as the baseline school year already is.
- The **per-college semester** lives in `LMSContext` and `localStorage` only,
  mirroring the existing `collegeActiveSchoolYears` record. This inherits that
  record's pre-existing limitation: a Dean's rollover is visible to their own
  browser, not to a chairperson signed in elsewhere. The baseline gate still holds
  across devices because the baseline is ERP-backed.
- `AGENTS.md`: the shared Likha ERP backend at `https://gabay.zyberlab.com` is
  modified **only through the browser subagent** for the one schema addition
  below. All other ERP interaction is ordinary `/items/school_years` item reads and
  writes, which is permitted. No DDL via REST, ever.
- Every ERP call is defensive: a failure leaves the locally cached value intact and
  never blocks a rollover or an upload (`catch(() => {})`, as the existing
  `setBaselineSchoolYear` already does).
- Existing `data-testid` values used by tests (`assigned-courses-academic-year-display`,
  `assigned-courses-baseline-mismatch-banner`, `assigned-courses-baseline-mismatch-badge`,
  `governance-baseline-warning`) must continue to exist so unrelated tests keep
  passing.

---

## Prerequisite: One ERP Schema Addition (browser subagent)

Before the client code lands, using `browser_subagent` against
`https://gabay.zyberlab.com/admin`:

1. Open the **`school_years`** collection's field settings.
2. Add a field named **`semester`**:
   - Type: **Dropdown** (string), interface "Dropdown".
   - Choices: `First`, `Second`, `Mid-Year` — these exact strings, matching
     `normalizeAssignedSemester()` output so no translation layer is needed.
   - Allow null: **yes** (existing rows and legacy payloads keep working; the client
     normalizes a missing value to `First`).
   - Required: **off**. Default value: `First`, so the admin UI and any other writer
     get a sane value automatically.
3. Set the currently active `school_years` row's `semester` to `First`.
4. Confirm the existing rows did not get clobbered.

Then re-read the collection in the admin UI to confirm the field exists with the
right interface before writing any client code. If the field already exists with a
different name or shape, stop and report back rather than forcing it.

Nothing else in the ERP changes: no new collection, no relation, no other field.

---

## Decisions Made By The Client

- **Option A was chosen:** two independent rollovers (academic year and semester),
  mirroring the school year model exactly.
- The admin chooses the baseline semester among `First`, `Second`, `Mid-Year`.
- Deans roll their college over to that baseline semester.
- Changing the baseline school year auto-sets the semester to `First`, and every
  college's Dean must then roll their semester over — the admin never sets a
  college's semester.
- Semester choice is removed entirely from Upload Program Assigned Courses.
- The download template is removed.
- The baseline semester is stored institution-wide in the ERP, on the
  `school_years` collection.
- A college that has never rolled its semester over reads as `First Semester`.

## Calls I Made (veto any of these)

These were not discussed. Each is marked so they can be overridden during review.

1. **Semester rollover does not advance people.** No `yearLevel` or
   `yearsOfTeaching` changes. (Anti-goal above.)
2. **The `SchoolYear` TypeScript interface is unchanged.** The ERP row gains a
   `semester` column (see Prerequisite), but the client keeps the baseline semester
   in its own state slice and reads it from the active row, rather than threading a
   semester through every `SchoolYear` object in the app.
3. **Changing the baseline academic year resets the baseline semester to `First`
   and writes nothing to any college.** Every college whose recorded semester
   differs from the new baseline then shows the amber mismatch until its own Dean
   rolls the semester over — exactly like the academic year, where the admin only
   moves the baseline and the Deans do the rolling. No admin action ever sets a
   college's semester.
4. **The two rollovers are fully independent.** Rolling a college's academic year
   does not touch its semester, and rolling the semester does not touch the
   academic year. A Dean rolling to a new academic year while their college still
   records a non-baseline semester therefore has to roll the semester over too.
5. **A college with no recorded semester reads as `First Semester`.** This mirrors
   the academic year getter's fixed `2025-2026` fallback: when the baseline moves
   off `First`, a never-rolled college shows an amber mismatch and its Dean must
   actively roll over before chairpersons can upload. "Never rolled" and "rolled to
   First" therefore display identically, since both are on First; that is intended,
   and the governance badge uses the same effective value as the upload gate so the
   two can never disagree.
6. **Old spreadsheets that still contain a `Semester` column keep uploading
   fine**; the column is read but its value is ignored. Only the column header
   disappears from the expected-format hint.
7. **The baseline semester change gets its own confirmation modal**, matching the
   existing baseline academic year confirmation.
8. **A baseline semester change notifies Deans and Chairpersons** using the
   existing `baseline_changed` notification type, with semester wording
   (`relatedId` = the semester string, `relatedTitle` = `Semester: Second`; nothing
   routes on this field).
9. **The mismatch reason is never wrong.** `ChairSheetUploadView` keeps a single
   `mismatchErrorMessage` that branches into the three cases listed below, and all
   four `showAlert` calls (`handleProcessFile`, `handleDrop`, `handleFileChange`,
   `handleApproveAndSave`), the locked-dropzone paragraph, and the disabled Select
   button's `title` read from it. A chair blocked only on semester must not be told
   they have an academic year problem.
10. **A college semester rollover confirms first**, using a confirmation modal that
    mirrors the academic year one. The existing `rolloverConfirmData` state is
    generalized to carry a `kind: 'schoolYear' | 'semester'` discriminator plus an
    optional `targetSemester`, so one modal component serves both.
11. **The collegiate semester row always renders** in an expanded college card,
    directly below the academic year row and outside that row's "No school years
    registered" early return, because semester state does not depend on any
    `SchoolYear` record existing. Deans of that college get the dropdown plus
    button; everyone else who can see the college gets a read-only badge.
12. **`getActiveSemesterForCollege(undefined)` falls back to
    `activeUser?.collegeId`**, matching `getActiveSchoolYearForCollege`.
13. **`AcademicSemester` is the canonical type**, declared in `lms.ts`.
    `chairSheetParser.ts` re-exports `AssignedCourseSemester` as an alias of it so
    existing imports keep working instead of churning every call site.

---

## Data Model

### Types (`client/src/shared/types/lms.ts`)

```ts
export type AcademicSemester = 'First' | 'Second' | 'Mid-Year';
```

Semesters reuse the spelling already produced by
`normalizeAssignedSemester()` in `chairSheetParser.ts`, so `course.semester`
values stay consistent across the app — and so the ERP dropdown choices need no
translation.

### No changes to the `SchoolYear` interface

`SchoolYear` (`id`, `collegeId?`, `year`, `isActive?`, `createdAt?`) is untouched as
a TypeScript type. The ERP `school_years` **row** gains a `semester` column (see
Prerequisite), but the client reads it off the active row into the `baselineSemester`
state slice instead of widening `SchoolYear`.

### ERP persistence of the baseline semester

`likhaLmsApi.academicStructure` gains one method, matching the shape of the
existing school year calls:

```ts
async updateSchoolYearSemester(id: string, semester: string): Promise<any> {
  return likhaRequest(`/items/school_years/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ semester }),
  });
}
```

- **Read:** the existing hydration effect already maps every `school_years` row. It
  additionally maps `semester` and, from the row where `is_active` is true, seeds
  `baselineSemester`. A missing or unrecognized value normalizes to `First` via
  `normalizeAssignedSemester`, so a database that has not yet been migrated still
  behaves.
- **Write (baseline semester change):** `setBaselineSemester` updates local state
  first, then PATCHes the active row's `semester`, with a silent `catch` exactly
  like `setBaselineSchoolYear`. Local state is the source of truth for the current
  session; the ERP makes the choice visible to every other browser.
- **Write (baseline AY change):** `setBaselineSchoolYear` adds `semester: 'First'`
  to the same two PATCHes it already makes (activating the target row, deactivating
  the previous row) and resets the local baseline semester to `First`. No college
  record is written — client-side or server-side.
- **College semester:** never sent to the ERP.

### Context state

Two new pieces of state in `LMSContext.tsx`, both cached in `localStorage`:

| State | Storage key | Type | Initial value | Institutional source |
|---|---|---|---|---|
| `baselineSemester` | `gabay_baseline_semester_v1` | `AcademicSemester` | `'First'` | ERP `school_years.semester` on the active row |
| `collegeActiveSemesters` | `gabay_college_active_semesters` | `Record<string, AcademicSemester>` | `{ 'col-ccs': 'First' }` | local only |

Both use the existing `safeSetLocalStorage` helper and a `useRef` mirror
(`baselineSemesterRef`, `collegeActiveSemesterRef`) exactly like
`schoolYearsRef` / `collegeActiveSYRef`, so async handlers never read stale state.

Corrupt or missing storage falls back to the initial value rather than throwing.
The baseline semester additionally re-hydrates from the ERP's active school year row
on mount, overwriting the cached value when the ERP answers.

### Context API (additions to the provider interface)

```ts
baselineSemester: AcademicSemester;
setBaselineSemester: (semester: AcademicSemester) => Promise<{ success: boolean; message?: string }>;
getActiveSemesterForCollege: (collegeId?: string) => AcademicSemester;
setActiveSemesterForCollege: (collegeId: string, semester: AcademicSemester) => Promise<{ success: boolean; message?: string }>;
```

Return shapes match the existing `setBaselineSchoolYear` /
`setActiveSchoolYear` so callers and tests behave the same way.

---

## Behavior Rules

| Rule | Where enforced |
|---|---|
| Baseline semester defaults to `First` | context initial state |
| Baseline semester re-hydrates from the ERP active school year row on load | context hydration effect |
| A missing or unrecognized ERP `semester` value normalizes to `First` | context hydration effect (`normalizeAssignedSemester`) |
| Baseline semester change PATCHes `semester` on the active `school_years` row and never blocks on failure | `setBaselineSemester` |
| Admin may set baseline semester to any of the three values | `setBaselineSemester`, governance UI |
| Dean may roll a college to the baseline semester only | `setActiveSemesterForCollege`, governance UI |
| Dean may not roll to the semester the college is already on | governance UI (`disabled`) |
| Baseline academic year change sets baseline semester `= First` and writes no college's semester | `setBaselineSchoolYear` |
| Rolling a college's academic year leaves that college's semester untouched | `setActiveSchoolYear` |
| Semester rollover changes no user `yearLevel` / `yearsOfTeaching` | `setActiveSemesterForCollege` |
| `getActiveSemesterForCollege(id)` returns the recorded semester, else `'First'` | context getter |
| A never-rolled college therefore shows an amber semester mismatch whenever the baseline is not `First` | governance UI, upload gate |
| Upload blocked when college AY ≠ baseline AY **or** college semester ≠ baseline semester | `ChairSheetUploadView` |
| Created courses get `semester = college active semester` and `term = formatCourseTerm(that semester, college active AY)` | `ChairSheetUploadView.handleApproveAndSave` |

### Mismatch messaging

- Both mismatch: "The university baseline is AY *X* · *S* Semester, but your
  college is active for AY *Y* · *T* Semester."
- Only AY: the existing academic-year mismatch copy, unchanged.
- Only semester: "<College> is active for *T* Semester, which does not match the
  university-wide baseline semester (*S* Semester). Roll the semester over in
  Academic Governance to continue."
- The upload banner title becomes "Assigned Courses Upload Restricted: Academic
  Baseline Mismatch" and lists whichever axis is wrong. `isBaselineMismatch` stays
  as the single boolean that gates the file input, dropzone, and approve button.
- Per call 9 this is one message, produced by one helper and reused by the banner,
  by all four blocking `showAlert` calls, by the locked-dropzone paragraph, and by
  the disabled Select button's tooltip. Only the banner keeps the longer
  two-sentence form.

---

## User Interface

### 1. Academic Governance — baseline card (`AcademicStructureTab.tsx`)

The existing admin/chancellor card is renamed
**"University-Wide Default Baseline Academic Term"** and holds two control groups
side by side (wrapping on narrow screens):

- **Baseline Academic Year** — the existing `baseline-sy-select` dropdown and
  *Update Baseline* button. Unchanged behavior.
- **Baseline Semester** — new `baseline-semester-select` dropdown
  (`First Semester`, `Second Semester`, `Mid-Year`) plus an *Update Semester*
  button, disabled when the selection matches the current baseline.

Below the controls, a one-line hint:

> Changing the baseline academic year resets the baseline semester to First
> Semester and requires Deans to roll over again.

Clicking *Update Semester* opens a confirmation dialog
(`baseline-semester-confirm`) reading: "Set the university-wide baseline semester
to *Second Semester*? Colleges must roll over to this semester before their
chairpersons can upload assigned courses." With Cancel / *Confirm Baseline
Semester*.

The card remains visible only to
`canManageBaselineSchoolYear` (superadmin, chancellor, plain admin).

### 2. Academic Governance — college card

The section is retitled **"Collegiate School Year & Semester Rollover"** and gains
a second row beneath the academic-year row. Per call 11 this row renders whenever
the college card is expanded, independent of whether any `SchoolYear` records
exist — a college with no school years still shows its semester state, with the
existing "No school years registered" notice left above it.

- **Active Semester:** badge showing the college's current semester
  (`data-testid="college-active-semester-{collegeId}"`), plus an amber
  `baseline-semester-mismatch-badge-{collegeId}` when it differs from baseline.
- A `semester-select-{collegeId}` dropdown of the three semesters plus a
  *Roll Over to Semester* button.

Rollover authority is the same predicate already used for academic years
(`canRolloverCollegeSchoolYear`) — Deans of that college only. The button is
disabled unless the selection equals the baseline semester and differs from the
college's active semester; the tooltip explains which condition fails, using the
same wording pattern as the academic-year button. Clicking it opens the shared
confirmation modal from call 10 ("Roll Over Semester"), titled for that college and
semester. Viewers who can see the college but lack rollover authority get the
read-only badge only.

Deans see both controls independently. Either can be rolled first; the upload gate
only clears when both match the baseline.

### 3. Upload Program Assigned Courses (`ChairSheetUploadView.tsx`)

**Header badges** — next to the existing academic year badge:

```
Academic Year: AY 2026-2027     Semester: Second Semester
```

The semester value comes from `getActiveSemesterForCollege(userCollegeId)` and is
rendered read-only in `data-testid="assigned-courses-semester-display"`.

**Blocking banner and disabled controls** — driven by the combined
`isBaselineMismatch`, which now considers both axes. The banner lists the college's
current pair against the baseline pair, and names the missing rollover.

**Dropzone** — unchanged layout minus the semester language:

- Button row keeps *Select Assigned Courses File*.
- **The *Download Template* button is removed**, and the button row now holds a
  single primary button.
- The format hint reads:
  `Expected format: First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year and Section`
  followed by a second line:
  `All rows are created under your college's active semester (Second Semester).`

**Preview table (`ChairSheetPreviewTable.tsx`)** — the `Semester` header and its
`CustomDropdown` cell are deleted. Remaining columns: `#`, First Name, Middle Name,
Last Name, Course Code, Descriptive Title, Year & Sec, Faculty Verification,
Actions.

**`Add custom row`** creates a row with no semester field.

### 4. Sidebar warning (`AppRail.tsx`)

The amber governance dot and its tooltip now fire when **either** axis mismatches:

> University baseline (AY 2026-2027 · First Semester) differs from your college's
> active academic term (AY 2025-2026 · Second Semester)

The `data-testid="governance-baseline-warning"` stays.

---

## Removals

### From `ChairSheetUploadView.tsx`

- `downloadAssignedCoursesTemplate` import and the *Download Template* button.
- `semester` from the `handleUpdateRow` merge, `handleDeleteRow` content check,
  and `handleAddNewRow` seed object.
- The hard-coded `semester: row.semester?.trim() || undefined` on course creation,
  replaced with the college's active semester.

### From `ChairSheetPreviewTable.tsx`

- `SEMESTER_OPTIONS`, the `Semester` `<th>`, and the semester `<td>` with its
  `CustomDropdown`.

### From `chairSheetParser.ts`

Delete the template API entirely, since nothing else consumes it:

- `generateChairSheetTemplateWorkbook`
- `generateAssignedCoursesTemplateWorkbook`
- `downloadChairSheetTemplate`
- `downloadAssignedCoursesTemplate`

Also remove `semester` from `RawChairSheetRow`, and stop mapping the
`Semester`/`Sem`/`Term` column in `parseChairSheet` (the column is simply ignored
if present). Keep `xlsx` imported only if still needed for parsing.

**Kept and unchanged:** `AssignedCourseSemester`, `ASSIGNED_COURSE_SEMESTERS`,
`normalizeAssignedSemester`, `formatCourseTerm`. `formatCourseTerm` continues to
serve `ChairSheetUploadView` (with the college semester) and
`DashboardPage` / `EditCoursePage` / `CoursesPage` indirectly.

---

## Backward Compatibility

- `localStorage` from earlier sessions simply lacks the two new keys; both
  initialize to `First`, matching today's implicit default.
- An ERP `school_years` table that has not yet been migrated (no `semester` column)
  still works: the field reads as `undefined` and normalizes to `First`, and a
  PATCH carrying `semester` against an unmigrated table fails silently without
  breaking the local baseline change.
- Uploading a previously downloaded template (still containing `Semester`) works:
  the extra column is ignored and the semester comes from the college.
- Existing courses keep their stored `semester` and `term`; nothing rewrites
  historical data.
- The `col-ccs` default of `First` means the demo college behaves exactly as it
  does today until someone rolls it.

---

## Verification Plan

New tests:

1. **`LMSContext` semester state** — default `First`; `setBaselineSemester`
   persists; `setActiveSemesterForCollege` persists per college and rejects a
   non-baseline semester; semester rollover leaves `yearLevel` / `yearsOfTeaching`
   untouched; `setBaselineSchoolYear` resets the baseline semester to `First`
   without writing any college's semester; `setActiveSchoolYear` leaves the
   college's semester untouched; a college with no stored semester reads `First`
   even when the baseline is `Second`.
2. **`AcademicStructureTab`** — baseline semester control renders for
   admin/chancellor only; dean rolls semester only to baseline; disabled at the
   already-active semester; mismatch badge appears/clears; confirmation modal
   gates the baseline change; the college semester rollover also confirms first.
3. **ERP sync** — with a mocked `likhaLmsApi`, a baseline semester change PATCHes
   the active `school_years` row's `semester`; a baseline AY change PATCHes
   `is_active` and `semester: 'First'` together; a rejecting/absent ERP leaves the
   local baseline change successful; hydration reads `semester` off the active row
   and normalizes a missing value to `First`.
4. **`ChairSheetUploadView`** — no `Semester` column header; no *Download Template*
   button; created courses carry the college's active semester and matching
   `term`; semester-only mismatch blocks upload and shows the semester copy;
   combined mismatch names both axes.
5. **`chairSheetParser`** — a workbook with a `Semester` column parses with no
   semester on rows; template generators are gone (compile-time check).
6. **`AppRail`** — warning dot when only the semester mismatches.

Existing tests to update (expected breakage, all deliberate):

- `ChairSheetUploadView.test.tsx`: the "Download Template" test is deleted; the
  "displays Semester column, allows editing it…" test becomes a
  "rows carry no semester and are created under the college's active semester"
  test.
- `ChairSheetE2E.test.tsx`: the real sample sheet has four rows with three
  different semesters. The four created courses must now all share the college's
  single semester/term, so those four `createCourse` assertions collapse to one
  semester and four terms derived from it.
- `ChairSheetSchoolYearRollover.test.tsx` and
  `ChairSheetSchoolYearBaselineMismatch.test.tsx`: their `useLMS` mocks gain
  `baselineSemester` and `getActiveSemesterForCollege`; a rollover test asserts the
  semester badge reflects the rolled-over college.
- `AcademicStructureTab.schoolYear.test.tsx` and `AcademicStructureTab.test.tsx`:
  mocks gain the semester API; new assertions for the semester controls.
- `AppRail.test.tsx`: mocks gain semester getters; add the semester-only case.
- `chairSheetParser.test.ts`: delete the template workbook test, drop semester
  expectations from parse results.

Final gate: `npm test --workspace=client` (or the repo's existing client test
command) and `npm run build` both green.

---

## Files Expected To Change

| File | Change |
|---|---|
| ERP `school_years` (browser subagent, admin UI) | add `semester` dropdown field, choices `First` / `Second` / `Mid-Year`, default `First`; set active row to `First` |
| `client/src/shared/types/lms.ts` | add `AcademicSemester` |
| `client/src/shared/utils/academicSemester.ts` | new: canonical semester union, normalizer, display label |
| `client/src/shared/api/likhaLmsApi.ts` | `updateSchoolYearSemester`; map `semester` in `getSchoolYears` consumers |
| `client/src/shared/context/LMSContext.tsx` | semester state, 4 API methods, ERP read/write, reset rules, notifications |
| `client/src/features/accounts/components/AcademicStructureTab.tsx` | baseline semester control + confirm modal + college semester rollover row |
| `client/src/features/courses/components/ChairSheetUploadView.tsx` | semester badge, combined gate, removals, college-semester stamping |
| `client/src/features/courses/components/ChairSheetPreviewTable.tsx` | remove semester column |
| `client/src/features/courses/utils/chairSheetParser.ts` | drop semester mapping + delete template API |
| `client/src/shared/components/layout/AppRail.tsx` | two-axis warning |
| tests listed above | new + updated |
| `docs/superpowers/specs/2026-10-20-semester-baseline-and-rollover-design.md` | this document |
