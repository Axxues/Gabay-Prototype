# Grade Release per Term — Design

Date: 2026-09-17
Status: Approved (all sections)

## Goal

Replace the student-side grade calculator with a faculty-controlled,
per-term grade release flow:

- Students no longer see the Academic Performance & Grade Calculator
  (what-if simulator). They see official scores only, and only for
  terms the faculty has released.
- Faculty get a per-term Release / Un-release toggle on the gradebook.
- Unreleased terms read as locked; a course with nothing released shows
  "grades are still not released".

## Decisions (from brainstorming)

- Release scope: per grading term (prelim / midterm / finals), not whole
  course, not per student.
- Student released view: official scores only.
- Release is a toggle: faculty can un-release; students immediately see
  the locked message again.
- Storage (Approach A): first-class persisted flag, not stuffed into the
  SPR config blob, not per-student rows.

## 1. Data model & migration

- Prisma `Course` gains `gradesReleased String? @db.NVarChar(Max)`,
  storing `{"prelim": false, "midterm": true, "finals": false}`.
  Absent key (or null column) means not released.
- New migration: `server/prisma/migrations/<timestamp>_add_grades_released/`.
- Client `Course` type gains `gradesReleased?: Record<TermId, boolean> | null`.
- Course fetch normalization parses the JSON safely and defaults to `{}`.

## 2. API

- New endpoint `PATCH /api/courses/:id/grades-release`, body
  `{ term: TermId, released: boolean }`.
- Auth: course instructor or admin only; students get 403.
- Validation: `term` must be a known term id; `released` must be boolean.
- Returns the updated course (with parsed `gradesReleased` map).
- Course GET responses include the parsed map so students receive it via
  the normal bootstrap/sync (no extra fetch).

## 3. Client state

- `LMSContext` gains `setGradesReleased(courseId, term, released)`,
  following the existing `updateCourseGradingTerms` pattern:
  optimistic cache update, PATCH, rollback plus alert on failure,
  success alert naming the term and new state.

## 4. Faculty UI (`FacultyGradebook` header)

- Each effective-term badge gets a Release / Un-release toggle button and
  a Released / Not released status pill.
- Direct toggle, no confirm modal; success/failure alerts via context.
- Non-student roles see the same faculty view they already do (no role
  changes in `CoursesPage` routing).

## 5. Student UI (`StudentGradebook`)

- Removed: what-if simulated grade card, Target Score Simulator card,
  per-term simulator sliders/inputs, simulated-contribution column, and
  the simulated summary row. All related state (`simulated`,
  `isWhatIfActive`, handlers) is deleted.
- Header retitled from "Academic Performance & Grade Calculator" to
  "My Grades" (both the main view and the no-syllabus gate).
- Released terms render official scores exactly as today.
- Unreleased terms render a locked row (lock icon + "Not released").
- Nothing released: empty state "Your grades are still not released.
  Check back after your instructor releases them."
- The overall total percentage and transmuted grade render only when
  every effective term is released; with a partial release the student
  sees per-term released scores and no total (a partial total would
  mislead).
- The no-syllabus gate and formula-error states are unchanged.

## 6. Edge cases

- Legacy courses (`gradesReleased` null): read as all-unreleased. This is
  an intended behavior change — students who previously saw
  auto-computed grades see the locked message until faculty releases.
- Unknown keys in the stored map are ignored; only effective terms for
  the course are evaluated.
- Concurrent toggles: last write wins (single JSON column, same as other
  course fields); optimistic rollback covers failures.

## 7. Testing

- Server route tests: 403 for students, 400 for bad term/missing fields,
  happy-path toggle on/off round-trip, map merge preserves other terms.
- Client tests: student locked view (nothing released), partial release
  (released term visible, unreleased locked, no total), full release
  (total shown), faculty toggle calls context updater with correct args.
- Existing gradebook/notifier suites must stay green.

## Out of scope

- Per-student release, whole-course single switch, release scheduling.
- Changes to grade computation itself (SPR weights, transmutation).
- Notification/email on release.
