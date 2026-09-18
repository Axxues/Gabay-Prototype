# SPR Gradebook Design — 2026-09-13

## Context

Faculty must follow the DMMMSU Student's Performance Record (SPR,
form `DMMMSU-INS-F010 REV. 00 (07.15.2020)`). Example source:
`C:\Users\JV\Downloads\SPR-Prog1.docx` (CSCC 103 Computer Programming I,
1st Semester S.Y. 2020-2021, 38 students, BSCS I-B).

Documented SPR layout (20 grid columns, landscape):

- C1 Student No. (blank in example) | C2 Name of Student | C3 Course, Year & Section
- C4–C10 Midterm Class Standing items 1–7
  (perfect scores in example: 30, 100, 10, 73, 15, 80, 20;
  student rows only fill items 1–5 — term in progress)
- C11 MT Exam (out of 60) | C12 MT Grade
- C13–C16 Final Class Standing items 1–4 (all blank in example)
- C17 FT Exam | C18 FT Grade
- C19 Final Grade Percentage | C20 Final Grade Numerical
- Footer signatories: Prepared by (Professor) / Verified by (Program Chair) /
  Approved (Dean); header: STUDENT'S PERFORMANCE RECORD + semester +
  Course Code & Title + Schedule.

Current system: `FacultyGradebook.tsx` holds manual midterm/final inputs
(0–100) per student in `courseGrades`, total = 40% midterm + 60% final,
transmutation via `getTransmutedGrade`. Activities/Quizzes/Assignments
produce graded `submissions` but never flow into the gradebook.

Decisions confirmed with user:
1. Grade formula comes from the syllabus:
   `Term = 60% Class Standing + 40% Exam`,
   `Final = 40% Midterm + 60% Final Term`
   (matches `syllabusData.ts` `gradingSystem`).
2. SPR columns are faculty-defined per course (custom titles + perfect
   scores), with auto-suggest/link from existing Activities/Quizzes.
3. Export is Excel (`.xlsx`), not `.docx`.
4. Approach A: SPR replaces the FacultyGradebook body (single source of
   truth, synced back to `courseGrades`).

## Goals / Non-goals

Goals:
- Faculty Grades tab renders the SPR sheet per course.
- Activity/Quiz scores auto-fill SPR cells; every cell remains editable
  (manual override wins, reset-to-auto available).
- MT Grade, FT Grade, Final Percentage + Numerical auto-calculate from
  SPR scores using the syllabus formula + existing transmutation table.
- One-click Excel export mirroring the .docx columns, header, and
  signatory blocks.
- Adapt surrounding system (student view, badges, persistence) with
  minimal churn.

Non-goals (v1):
- Server-side SPR tables / new API endpoints. SPR config + scores persist
  in the client `db` (localStorage, same pattern as other entities);
  only computed term grades sync to the server via existing
  `PUT /api/courses/:id/grades/:studentId`.
- PDF/.docx export. Excel only.
- Attendance or oral-presentation auto-sources (no such entities exist;
  faculty enters those as custom manual columns).
- Changing the transmutation table or syllabus formula editor.

## Architecture

Replace the body of `FacultyGradebook` with an SPR sheet component.
New pure computation module + new Excel exporter module; both
independently unit-testable. State lives in `LMSContext` alongside
`courseGrades`:

- `sprConfigs: Record<courseId, SPRConfig>`
- `sprScores: Record<courseId, Record<studentId, SPRStudentScores>>`
- Existing `setCourseStudentGrade(courseId, studentId, 'midterm'|'final', value)`
  is called automatically whenever a student's computed MT/FT grade changes
  (debounced per student), keeping student gradebook, `LMSContextPanel`
  people/grade badges, and history intact.

No navigation changes. `CoursesPage` still renders `FacultyGradebook`
under sub-tab `grades`; `LMSContextPanel` badge logic unchanged.

## Components

### 1. `src/utils/spr.ts` (new, pure)

- Types: `SPRColumn { id, title, perfectScore, linkedSource?: { kind: 'activity'|'quiz'|'assignment', sourceId } }`,
  `SPRConfig { courseId, midtermColumns: SPRColumn[], finalColumns: SPRColumn[], mtExamPerfect, ftExamPerfect, csWeight, examWeight, mtWeight, ftWeight }`,
  `SPRCell { value: number | null, manual: boolean }`.
- `resolveAutoScore(studentId, column, db): number | null` — latest graded
  submission for the linked source, scaled:
  `score = grade / pointsPossible * perfectScore` (rounded to 2dp).
  Returns null when no graded submission.
- `effectiveScore(cell, auto): number | null` — manual value wins, else auto.
- `classStandingPercent(scores, columns): number` —
  `Σ effective (blank → 0) / Σ perfect * 100`, 0 when no columns.
- `termGrade(csPercent, examScore, examPerfect, csW=60, examW=40)`.
- `finalPercent(mtGrade, ftGrade, mtW=40, ftW=60)`.
- `computeStudentSPR(...) → { csMid, mtGrade, csFinal, ftGrade, finalPercent, numerical }`
  reusing `getTransmutedGrade` for the numerical grade.
- Weight resolution: `getSPRWeights(course)` reads
  `course.syllabus.gradingSystem` when present, falls back to
  60/40 + 40/60, always surfaces the active formula string for the UI badge.

### 2. `FacultyGradebook` (rewrite body, same file/props)

- Header: course code/title, syllabus formula badge
  (`Term 60% CS + 40% Exam · Final 40% MT + 60% FT`), search, Configure
  columns button, Export Excel button, enrolled count.
- Sheet: sticky left columns (No., Name + ID/email, Section), horizontally
  scrollable grade columns:
  `MT 1..n | MT Exam (/mtExamPerfect) | MT Grade (read-only) |
   FT 1..m | FT Exam | FT Grade (read-only) | Final % | Numerical`.
- Cells: numeric inputs `0..perfectScore`, blank allowed. Auto-filled cells
  show a subtle dot; edited cells show "manual" marker + context reset.
  Exam cells use exam perfect. Computed cells read-only with transmutation
  color chips (reuse existing color classes).
- Config mode (modal reusing `DialogFrame`): rename columns, edit perfect
  scores, link/unlink Activity/Quiz source (dropdown with points shown),
  add/remove columns, set exam perfects, "Import all Activities/Quizzes"
  bulk action (creates unlinked-safe links, skips already-linked sources).
  New courses start empty with an empty-state CTA (no seeded dummy columns).
- Faculty-only editing; `activeRole === 'admin'` renders read-only
  (existing pattern). Students never see this component (`StudentGradebook`
  unchanged, fed by synced `courseGrades`).

### 3. `src/utils/sprExport.ts` (new) + `xlsx` dependency

- In-browser workbook generation (SheetJS `xlsx`):
  - Title rows: STUDENT'S PERFORMANCE RECORD; semester + AY (from
    `course.term`); Course Code & Title + Schedule/Section.
  - Column headers mirroring the .docx (No. | Name | Course/Year/Section |
    MT CS 1..n + perfect row | MT Exam | MT Grade | FT CS 1..m + perfect row |
    FT Exam | FT Grade | Final % | Numerical).
  - One row per enrolled student (sorted by name, section from
    `user.courseSections?.[courseId]` or `course.section` fallback).
  - Values only (no Excel formulas), 2dp for percents.
  - Footer rows: Prepared by / Verified by / Approved + name/title lines
    (instructor name prefilled, others blank for signature).
  - Landscape print setup, fit-to-width, frozen panes under headers.
  - Filename: `{courseCode}_SPR.xlsx`; success toast via `showAlert`.
- Graceful fallback: export button disabled with tooltip when no students
  or no columns configured.

### 4. `LMSContext` additions (no server changes)

- `sprConfigs`, `sprScores` in db shape + localStorage persistence
  (follow existing `db` hydration pattern).
- Actions: `getSPRConfig`, `saveSPRConfig`, `setSPRCell`,
  `resetSPRCell`, `bulkImportSPRColumns`, `recomputeSPRGrades`
  (recompute + sync term grades via `setCourseStudentGrade`, debounced).
- Auto-fill is lazy (computed at render from submissions + stored manual
  cells), not duplicated on submission events — no submission-pipeline
  changes needed.

## Data flow

1. Faculty opens Grades tab → `FacultyGradebook` loads `sprConfigs[courseId]`
   (or empty state) + enrolled students.
2. Each cell resolves `effectiveScore(manual ?? auto(submissions))`.
3. Any change (cell edit, config change, new graded submission via
   SpeedGrader) recomputes that student's MT/FT/Final instantly and syncs
   MT/FT into `courseGrades` (existing server PUT).
4. Student Grades tab reads `courseGrades` — no changes needed there.
5. Export reads config + effective scores + computed grades → `.xlsx`.

## Error handling / edge cases

- Blank score = 0 in computation, rendered blank with amber hint (not "0").
- Input validation: non-numeric rejected; `> perfectScore` blocked with
  `showAlert` warning; negatives clamped to 0.
- No columns configured → empty-state CTA, export disabled.
- Linked source deleted → column retained with "source removed" badge,
  cells keep last auto values flipped to manual.
- Unenrolled / removed students excluded from sheet and export.
- `courseGrades` sync failure → SPR values remain (source of truth),
  error toast surfaces, retry on next edit (existing `setCourseStudentGrade`
  error path).
- Syllabus without `gradingSystem` → default weights + formula badge shows
  "institutional default".

## Testing

- `vitest` unit tests for `src/utils/spr.ts`: CS percent (incl. blank=0,
  scaling), term/final math with default + custom weights, transmutation
  boundaries (reuse existing table expectations), auto-score scaling
  (`grade/pointsPossible*perfect`).
- Manual acceptance: seed course with 2 activities + 1 quiz, submit as
  student, confirm auto-fill; edit a cell, confirm recompute + manual badge;
  reset cell, confirm auto returns; export `.xlsx` and compare column order,
  perfect row, and computed grades against `SPR-Prog1.docx` layout.
- Regression: `npm run build` (includes `tsc -b`); student gradebook still
  shows synced MT/FT; admin read-only intact.

## Open items (kept small intentionally)

- Signatory names in export footer: instructor prefilled; chair/dean left
  blank for wet signature (no HR data source exists).
- `Student No.` column (C1): no such field exists on `User`; export leaves
  it blank unless `studentId` should map there — confirm during
  implementation review (default: `studentId` printed under Name, C1 blank
  like the example's empty first column).
