# Gabay Diagrams (PlantUML)

Detailed but simple/clean. One use-case + one activity per role.

## Files
- `usecase-admin.puml` / `activity-admin.puml`
- `usecase-faculty.puml` / `activity-faculty.puml`
- `usecase-student.puml` / `activity-student.puml`
- `usecase-staff.puml` / `activity-staff.puml`

## Render
- VS Code: Extension `PlantUML` (jebbs.plantuml) → `Alt+D` preview
- Online: https://www.plantuml.com/plantuml/ (paste `.puml`)
- CLI: `plantuml docs/diagrams/*.puml` → generates `.png` next to source

## Roles (from `client/src/types/lms.ts:1`, `client/src/config/navigation.ts:4-30`)
- Admin: full + Manage College Accounts
- Faculty: create/manage + approve (People queue + bell)
- Student: join via code → approval → choose one section; switch via re-request
- Staff: support view only (no Dashboard/Courses/People/Accounts)

## Key flows covered
Sections + enrollment approvals, modules/syllabus/files auto-foldering,
activities (MC/ID/T-F auto, essay manual), quiz PDF/DOCX import,
section-scoped announcements, reply notifications + badges,
grades/SPR, inbox/calendar, RAG.
