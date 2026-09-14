# Grades Auto + Syllabus-Gated Design — 2026-09-14

## Purpose
Remove manual SPR configuration. Grades auto-derive from student scores on
Activities + Quizzes (class standing) and Exams (MT/FT exams), using the
per-syllabus formula in "Course Requirements & Official Grading Formula".
Grades tab is only accessible when a syllabus is uploaded.

## Non-goals
- No full DB migration. `Assignment` type and `sprConfigs/sprScores` rows stay
  for compat; UI no longer creates SPR columns.
- No new grading math beyond parsing existing syllabus strings.

## Architecture
- Gradebook becomes a pure view: `buildAutoColumns()` + `resolveSPRWeights()`
  + `autoScoreFraction()` compute everything at render.
- New `Exam` entity reuses `Quiz` shape and quiz-taking/grading flow.
- Syllabus is the single source of weights. Unparseable formula blocks
  computation with a fix notice, never silent fallback.

## Components & Files Touched
1. **Remove Configure SPR UI**
   - Delete `src/pages/ConfigureSPRPage.tsx`.
   - `src/pages/CoursesPage.tsx`: remove `spr-config` subTab, `onConfigureSPR`,
     `ConfigureSPRPage` import/route, stale `spr-config` guards.
   - `src/components/grading/FacultyGradebook.tsx`: remove `onConfigureSPR`
     prop, Configure button (`data-testid="spr-configure"`), empty-SPR CTA.

2. **Auto columns (Activities + Quizzes only)**
   - New `buildAutoColumns(courseId, db)` in `src/utils/spr.ts`: all
     `published` Activities + Quizzes → columns. Same list feeds both MT and
     FT class standing equally (approved default).
   - Strip `assignment` kind from `autoScoreFraction()` and any source picker.
   - `bulkImportSPRColumns` / `saveSPRConfig` become dead: leave in
     `LMSContext` unused (compat), no UI calls.
   - Nav: `assignments` tab already labeled "Activities"; repoint its data
     source toward `db.activities` in a follow-up swap (DB untouched).

3. **New Exams page (same as Quizzes)**
   - Type `Exam { id, courseId, title, instructions, timeLimitMinutes,
     published, dueDate?, questions: QuizQuestion[], term: 'midterm'|'final' }`
     in `src/types/lms.ts`; `db.exams` + context CRUD mirroring quizzes.
   - `src/pages/ExamsView.tsx` + `CreateExamPage.tsx` cloned from
     `QuizzesView`/`CreateQuizPage`. `COURSE_CHILDREN` += `exams`.
   - Gradebook: exactly 1 MT exam (`term='midterm'`) + 1 FT exam
     (`term='final'`) auto-supply `mtExam`/`ftExam` via graded submissions.
     Multiple per term: use latest graded; none per term: term grade = null.

4. **Syllabus formula extraction**
   - Fix `resolveSPRWeights()` (`src/utils/spr.ts:15-25`, currently hardcoded
     and ignores input) to regex-parse:
     - term: `/(\d+(?:\.\d+)?)\s*%\s*class standing/i` + exam remainder,
     - final: `/(\d+(?:\.\d+)?)\s*%\s*midterm/i` + final remainder.
     - Validate each pair sums to 100 (±0.01). Return `{ ..., parseError }`.
   - Fix `SyllabusView.tsx:1416,1428` hardcoded "60%..." display → bind to
     `data.gradingSystem.termFormula / finalFormula`; keep editable via
     existing `editingSection='gradingSystem'`.
   - `syllabusParser.ts`: preserve scanned formula text verbatim instead of
     overwriting with 60/40 default.

5. **Syllabus-gated Grades tab**
   - `CoursesPage.tsx:256` grades branch: if `!activeCourse.syllabus`, render
     "Syllabus required" empty state (faculty CTA → syllabus tab / upload;
     student → "waiting for instructor"). No table, no export.
   - Same gate in `FacultyGradebook` + `StudentGradebook` as defense-in-depth.

6. **Student view alignment**
   - `StudentGradebook.tsx`: drop `db.courseGrades` manual + fixed 40/60;
     compute per-student auto SPR (same helpers + parsed weights). Keep
     What-If simulator but weighted by parsed weights.

## Data Flow
Syllabus upload → `gradingSystem` strings → `resolveSPRWeights()` →
weights. Activities/Quizzes/Exams submissions (graded) →
`autoScoreFraction()` → class standing → term grade → final % → transmuted
1.00–5.00. No manual column writes; only exam/manual cell overrides via
existing `sprScores` remain (hidden).

## Error Handling
- No syllabus → gated empty state, never an empty table.
- Unparseable formula → amber banner in both gradebooks: "Fix Course
  Requirements & Official Grading Formula section in Syllabus" + jump button;
  grades show "—", export disabled.
- Missing exam item or ungraded submission → cell "—", term = null.

## Testing
- Unit: `resolveSPRWeights` parse cases (60/40, 70/30, decimal, invalid sum,
  garbage → parseError); `buildAutoColumns` filters unpublished, excludes
  assignments; `autoScoreFraction` activity/quiz/exam paths.
- Manual: upload syllabus A (60/40) vs B (70/30) → badge + grades change;
  remove syllabus → gated; unparseable formula → banner; create MT/FT exams →
  auto-fill; submit activity/quiz as student → faculty cell fills.
