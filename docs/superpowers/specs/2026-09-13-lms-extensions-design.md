# LMS Extensions Design — Sections, Activities, Notifiers, Quiz Import, Auto-Foldering

Date: 2026-09-13 | Approach: A (local-first incremental) | Status: approved sections §1–§5, awaiting spec review

## Context

Gabay Prototype is a React + TypeScript + Vite LMS prototype with localStorage-backed `MockDatabase` served through `LMSContext`. No backend exists. This spec adds six requested capabilities as one program, built in order: (1) sections + enrollment approvals, (2) auto-graded activities with question types, (3) cross-tab notifiers + reply notifications, (4) quiz PDF/DOCX upload with scan auto-fill, (5) automatic foldering. Earlier partial work on reply notifications and quiz upload exists in the tree and will be conformed to this spec during implementation.

## Decisions (from brainstorming)

- Section membership: exactly one section per student per course; switching files a new request requiring faculty approval.
- Approvals surface in both the course People page queue and the notification bell panel, backed by one request store.
- Announcement scope: dropdown of one section or All sections (no multi-select).
- Activities auto-grade like quizzes (MC/T-F/identification on submit; essay → manual review).
- Badges show the viewer's unread count; viewing the item clears it.
- Quiz parsing is client-side (`pdfjs` + `mammoth`), heuristic, with mandatory instructor review; nothing leaves the browser.
- Foldering: per-course area folders (`Announcements / Modules / Syllabus`); per-item subfolders for Modules only (`Modules > <Module title>`).

## §1 — Sections + enrollment + section-scoped announcements

Data: `Section { id, courseId, name, capacity?, enrolledCount }`; `Course.sectionIds`; per-course single `sectionId` on the enrollment record; `EnrollmentRequest { id, courseId, studentId, type: 'join_code'|'faculty_invite'|'section_switch', status: 'pending'|'approved'|'rejected', targetSectionId?, createdAt, resolvedAt }`; `Announcement.sectionId: 'all' | sectionId` (default `'all'`).

Flows: Create Course Shell gains a sections editor (empty = current behavior, no chooser). Join-by-code creates a pending request with an "awaiting approval" state. Approval (People queue or bell, same store) routes the student to a section-chooser view with seat availability; picking enrolls them. Faculty invites must be accepted by the student first, then the chooser. Switches reuse the request flow. Composer audience dropdown; feed filters to viewer section (faculty sees all, optionally filtered).

Edges: no sections → skip chooser/scope; full sections unpickable; rejections show re-apply; no self-approval.

Tests: visibility-filter units + request state-machine units; manual matrix (join-code, invite, switch, scoped visibility).

## §2 — Activities with question types

Data: `Activity { id, courseId, moduleId?, title, instructions, questions: QuizQuestion[], pointsPossible, dueDate, published }` reusing the quiz question union; `ActivitySubmission { activityId, studentId, answers, score, status, gradedAt }`. Shared scorer with quizzes: MC/T-F/identification (case-insensitive) auto-score on submit; essay holds `submitted` for SpeedGrader review.

UI: Create Activity mirrors CreateQuizPage cards; student view reuses question widgets with per-question correctness and "pending review" for essays; gradebook/To-Do treat activities like assignments.

Edges: block save on empty MC options or missing keys (same warnings as quizzes); no time limits (YAGNI); existing file/text assignments untouched.

Tests: scorer units per type + blank handling; manual create → submit → score → review → gradebook.

## §3 — Cross-tab notifiers + reply notifications

Data: single unread model from `readBy`/`read` flags + `Notification { type, recipientId, relatedId, read, createdAt }`, capped at ~200/user with pruning. Per-tab badge = viewer unread: calendar, inbox, modules, announcements (incl. scoped), activities/quizzes (role-aware), files (new since last visit), grades (new posts), people (pending requests for faculty). Reply types notify the original commenter/author only, never self.

UI: top-bar bell with total unread; right-side count badges on course nav tabs; viewing clears; bell panel groups by type with per-group "mark all read"; request approvals actionable from bell or People queue.

Edges: role-aware counts; out-of-section announcements never badge; no badge for own actions.

Tests: badge-selector units + recipient-rule units; manual post → badge → view → clear on both roles.

## §4 — Quiz upload + scan auto-fill

Flow: "Upload file" on CreateQuizPage (PDF/DOCX, 10 MB cap) → `pdfjs`/`mammoth` extract text locally → pure `parseQuizText()` heuristic (numbered prompts, `A)` options, T/F markers, points hints; unparseable lines become identification drafts) → review panel (edit/delete/push into form) → existing save/publish path unchanged.

Edges: image-only PDFs show "no extractable text" + paste-text fallback; corrupt/protected files error cleanly with no partial quiz; large files truncate with warning.

Tests: parser units (MC, T/F, identification fallback, garbage); manual one PDF + one DOCX across all four types.

## §5 — Automatic foldering

Structure: per-course `Announcements / Modules / Syllabus`; subfolders only under `Modules > <Module title>`. Files gain `sourceArea` + `sourceId` ("from Announcement: X", survives renames). Composer/module/syllabus uploads auto-create-or-reuse the target folder and file there. Delete of source leaves file with "source deleted" tag (no cascade). Duplicate names get `name (2)` suffixing. Module rename renames its folder. Empty auto-folders hidden from students, visible to faculty. Legacy files stay at root until touched.

Tests: filing-resolver units (mapping + dedupe); manual upload to announcement, module item, syllabus → verify Files placement.

## Non-goals (YAGNI)

Multi-section membership, multi-select announcement scope, per-item folders outside Modules, server upload path, activity time limits, migration of legacy assignments.

## Rollout order

§1 → §2 → §3 → §4 → §5, each demoable independently; partial notification/upload work in the tree is conformed to §3/§4 during implementation.
