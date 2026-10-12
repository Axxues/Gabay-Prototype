# Google Classroom As-Is Diagrams (PlantUML + BPMN)

Existing-system baseline for thesis comparison with Gabay (to-be in parent folder).

## Files
- `usecase-teacher.puml` / `activity-teacher.puml`
- `usecase-student.puml` / `activity-student.puml`
- `erd.puml` + `erd.mmd`, `bpmn-classroom.bpmn`
- `dfd-context.dot`, `dfd-lvl1.dot`
- `*.png` / `*.svg` next to each source (rendered exports)

## Roles (Classroom as-is)
- Teacher: create class + invite code/link, Classwork (Assignment / Quiz / Question / Material), Stream announcements, grade + return
- Student: join via code/invite → view Stream/Classwork → attach + Turn in → view returned grade; guardian summaries are email-only
- Admin: Workspace Admin console only (provision users, guardians, Vault/audit) — no classroom teaching flow

## Render
- Same as parent README: VS Code PlantUML `Alt+D`, https://www.plantuml.com/plantuml/, or `plantuml *.puml`
- BPMN: import `.bpmn` in Camunda Modeler / bpmn.io
