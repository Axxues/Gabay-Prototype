# Re-review package — Task 7 fix round 1 (970507e..0b1c9cf)

## Commits
- 0b1c9cf fix: EmptyState optional body, DialogFrame a11y+animation+wide variant

## Stat
- 8 files, 5 insertions(+), 9 deletions(-): DialogFrame, EmptyState, Assignments, Calendar, Files, Modules, Quizzes, SyllabusView

## Findings under re-review
1. `body=""` wart → EmptyState `body?` optional + conditional `<p>`; drop `body=""` at call sites.
2. DialogFrame a11y/animation → `role="dialog" aria-modal` + pre-existing `animate-scale-in` (verified in index.css:408).
3. Width variant → DialogFrame `wide?` prop (`max-w-2xl`), used only in Syllabus upload-scanner.

## Evidence claimed
- typecheck PASS, build PASS (~2.1s, chunk warning only). Grep `body=""`: zero. Report appended to `task-7-report.md`.
