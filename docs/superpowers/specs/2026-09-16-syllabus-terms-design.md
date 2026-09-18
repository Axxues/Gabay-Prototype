# Syllabus-Driven Grading Terms Design

Date: 2026-09-16 | Approach: A (term registry + generic term field) | Status: approved §§1–3 in chat

## Context

Gabay Prototype (React 19 + TS + Vite client; Express + Prisma SQL Server) hardcodes two grading terms everywhere: `Exam.term: 'midterm' | 'final'` with a hardcoded picker (`CreateExamPage.tsx:913`), Quiz/Activity have no term at all, and the SPR gradebook pipeline (`SPRConfig.midtermColumns/finalColumns`, `termGrade()`, Final = 40% MT + 60% FT) assumes exactly two terms. The syllabus (`OfficialSyllabusData`) has no structured terms field; only `courseOutline[]` exam-period entries (e.g. "Midterm Examination Period") and free-text `gradingSystem` formulas signal term structure.

Agreed decisions: detect terms from the outline with per-course faculty override (Both); term feeds gradebook computation, not just labels; multi-term weights come from parsing the syllabus formula text.

## §1 Term registry

- `TermId = 'prelim' | 'midterm' | 'finals'` (note: `finals` plural matches the syllabus week-tab vocabulary; stored `'final'` exam rows map to `'finals'` on read).
- New pure helper `resolveCourseTerms(syllabus): TermId[]` in `client/src/utils/` (vitest-covered): scans `courseOutline[].title + topics[]` for exam keywords (`prelim|preliminary`, `midterm|mid-term`, `final`) in exam-period-like entries; preserves outline order; dedupes. Zero hits → `['midterm', 'finals']` default (today's behavior).
- Per-course override `course.gradingTerms?: TermId[]` on the client `Course` type, the server `Course` model, and the course create/update endpoints. `effectiveTerms(course, syllabus) = override ?? resolveCourseTerms(syllabus)`.
- Override editor in the SyllabusView grading-system section, reusing its existing draft/save pattern. Only the three known ids are ever offered; 1 exam period → 1 option, 2 → midterm+finals, prelim detected → 3 options.

## §2 Forms + storage

- New shared `TermSelect` component (`terms`, `value`, `onChange`) styled like the existing exam picker box (`bg-muted/40`, `border-border`). Used in `CreateExamPage` (replaces the hardcoded midterm/final pair), `CreateQuizPage`/`CreateActivityPage` via `ActivityFormFields` / `QuizBuilderFields` as a "Grading term" row fed by `effectiveTerms(course)`.
- `Exam.term` widens to `TermId`; new `term: TermId` (default: first effective term) on client `Quiz` + `Activity` types, server Prisma models, and create/update endpoints, which 400 on terms outside the course's effective list.
- Existing rows keep working: stored `'final'` reads as `'finals'`; 2-term courses see identical options to today.
- Activities/Quizzes/Exams list views show the term as a chip and can filter by it.

## §3 Gradebook math

- `syllabusParser` gains `extractTermWeights(gradingSystem): Record<TermId, number>` (vitest-covered): parses percentages from `termFormula`/`finalFormula` text, extending the existing midterm/final extractor to prelim; validates weights sum to ~100%; falls back to equal split per detected term count (1 term = itself at 100%, 2 terms = today's 40/60, 3 terms = parsed or equal thirds) with a visible "weights defaulted" note in the gradebook.
- SPR structures generalize by term key: stored `midtermColumns`/`finalColumns` become the 2-term projection of a `columnsByTerm: Record<TermId, SPRColumn[]>` map (persisted shape extended, old configs read as-is). `termGrade()` runs per term; final = Σ(termGrade × weight). Item scores route by their stored `term`; 2-term courses compute byte-identically to today.
- Faculty gradebook + student view render one period block per effective term. Legacy items without a `term` count toward midterm with a one-time UI flag.
- Tests: weight parsing (2-term text, 3-term text, garbage → fallback + note) and N-term final computation; `tsc --noEmit`; manual matrix across 1/2/3-term courses, light + dark.

## Out of scope

- Editing term weights by hand (parser fallback is equal split, not an editor); restructuring `courseOutline` week slices; changing `usersMustPostBeforeReplies`-style gates; touching Discussions.
