# SQL Server Migration Design — Prisma ORM + Express API

Date: 2026-09-13 | Approach: B (Prisma ORM, in-repo `server/`) | Status: design approved §§1–5, awaiting spec review

## Context

Gabay Prototype is a Vite-only React 19 + TypeScript SPA with no backend. All LMS data lives in `src/data/mockData.json` (18 collections, ~50 rows), loaded into React state by `src/context/LMSContext.tsx` (~2900 lines, ~100 CRUD functions), and persisted to localStorage key `gabay_lms_db_v6`. Login is a localStorage session with plaintext passwords in JSON. There is no server framework and no database driver in the tree. A browser cannot use an ADO.NET connection string, and passwordless Windows integrated auth is not available to Node.js drivers — so this design introduces a backend API project that owns the connection, and rewrites the frontend data layer to call it.

## Decisions (from brainstorming)

- Backend: in-repo `server/` — Node + Express + Prisma ORM (SQL Server connector), Vite proxy in dev. Raw-SQL and stored-procedure options rejected (hidden-SQL and split-logic costs outweigh benefits for a thesis).
- Database: new empty `GabayPrototype` catalog on `DESKTOP-DTAQOP7\SQLEXPRESS` (not the existing `CareSync`); only the catalog name differs from the supplied connection string.
- Auth: server-verified bcrypt passwords + signed JWT (24h); demo role-switcher removed.
- Files: bytes on disk under `server/uploads/`, metadata rows in SQL.
- Seed: one-time script seeds 4 role accounts, then `mockData.json` is deleted; all other tables start empty.
- Empty states: honest "nothing here yet" UI on empty tables is correct UX, not a placeholder. No mock rows anywhere after migration.

## §1 — Architecture + repo layout

New `server/` folder: `server/prisma/schema.prisma` (single source of truth; a generated `schema.sql` export of literal CREATE TABLE statements is checked in for the thesis appendix), `server/src/` with one router per aggregate (`auth`, `users`, `courses`, `modules`, `assignments`, `submissions`, `quizzes`, `activities`, `announcements`, `discussions`, `files`, `messages`, `calendar`, `people`/requests, `grades`), `server/uploads/` for file bytes served statically. The React app keeps every page/component except the data layer: `LMSContext` CRUD functions keep their names but become async `fetch('/api/…')` calls with new `isLoading`/`lastError` context values. `mockData.json` is deleted; localStorage keeps only UI prefs (theme/accent); LMS data and session move to SQL/token. `npm run dev` starts both Vite and the API (`tsx server`); the browser never sees a connection string. Build order: schema → server + auth → seed → frontend rewrite.

## §2 — Data model (Prisma schema → SQL Server tables)

18 JSON collections become ~30 tables: one table per collection plus a child table per nested array — `ModuleItems`, `ModuleComments`, `QuizQuestions` (covers activities, which reuse the question union), `AnnouncementReplies`, `AnnouncementAttachments`, `DiscussionReplies`, `SubmissionComments`, `CourseSections`, plus `EnrollmentRequests`, `Notifications`, `CourseFiles`, `CourseFolders`, `CalendarEvents`, `AdvisingSlots`, `Messages`, `ChatGroups`, `Users`, `Courses`, `Modules`, `Assignments`, `Submissions`, `Quizzes`, `Activities`, `Announcements`, `Discussions`. Existing string ids (`usr-fac-1`, `crs-…`, `mod-…`) stay the primary keys (`@id @db.NVarChar(64)`) so frontend references and seed rows survive unchanged. Prisma's SQL Server connector has no `Json` type: queryable/filtered data gets real child tables with foreign keys; opaque config blobs (rubric scores, syllabus data, signatories) go in `NVARCHAR(MAX)` columns parsed at the API boundary. Dates map to `DateTime`, grades to `Float`/`Int`, matching current JSON shapes.

## §3 — Backend, connection, auth, files

`server/.env` (gitignored; `.env.example` checked in) holds the Prisma URL translated field-for-field from the supplied string: host `DESKTOP-DTAQOP7\SQLEXPRESS`, `database=GabayPrototype`, `encrypt=true`, `trustServerCertificate=true`. Caveats recorded: Prisma uses URL format (the ADO.NET string is converted, never used verbatim or exposed to the browser); passwordless Windows integrated auth is unavailable from Node, so the design specifies a dedicated SQL login (`gabay_app`, `db_owner` on `GabayPrototype` only) created once via checked-in `001-create-login.sql` in SSMS — fallback is a Windows service-account mapping with identical code. `Pooling=False` has no Prisma equivalent (it always pools); harmless locally. Auth: `POST /api/auth/login` verifies bcrypt hashes and returns a JWT (`jsonwebtoken`, 24h); middleware enforces token + role per router. Seed creates Dean 1 (`dean1@dmmmsu.edu.ph`), Faculty 1 (`faculty1@dmmmsu.edu.ph`), Staff 1 (`staff1@dmmmsu.edu.ph`), Student 1 (`student1@dmmmsu.edu.ph`) with dev passwords defined once in `server/prisma/seed.ts`, printed to the server console on first run, and never written into docs or committed files (local demo credentials only). Files: `multer` → `server/uploads/<courseId>/`, static serve; SQL stores metadata only (name, size, mime, path, folder, `sourceArea`/`sourceId`). All API errors return `{ error: { code, message } }`; SQL messages never reach the client.

## §4 — Frontend rewrite + removal list

`LMSContext` keeps every CRUD name the app calls; each becomes an async fetch with loading/error states. Server responses are the source of truth; local state is a cache. Pure utils (`sections`, `notifiers`, `activities`, `quizImport`, `autoFolder`) and the five recent features keep their behavior with API-backed store bodies. Removal list: delete `src/data/mockData.json`; delete its import and all fallback/merge/reset-to-mock blocks in `LMSContext.tsx` (import ~line 34, load/merge ~lines 430–620, session check ~line 684, reset ~lines 2942–2944); delete `STORAGE_KEY_DB` persistence and `STORAGE_KEY_SESSION` (replaced by the JWT, persisted in localStorage under `gabay_token` and sent as a Bearer header). Kept: `syllabusData.ts` (code constant, not data), theme/accent localStorage prefs. Verification: `tsc -b`, existing vitest suites (pure logic unaffected), and a smoke matrix (4-role login → create course → post → upload → approve → grade) against the live DB.

## §5 — Seed, files, rollout, non-goals

`server/prisma/seed.ts` runs once: applies the schema to empty `GabayPrototype`, inserts the 4 accounts (dev passwords printed once and recorded here at implementation time), then the same change deletes `mockData.json`. All other tables start at zero rows; `server/uploads/` starts empty (no files to migrate). Rollout: schema → server + login → seed → frontend rewrite, each demoable (Prisma Studio, token login, end-to-end smoke). Rollback is DB recreate + `git checkout`. Non-goals: refresh-token rotation, a migration framework beyond `schema.sql`, soft deletes, audit tables, production hosting/TLS, and any change to the five recent feature behaviors.

## Rollout order

Schema → server + auth → seed → frontend rewrite. Each phase is demoable independently; the JSON file is deleted only in the seed phase, after the API proves it can serve the seeded accounts. Implementation runs as one plan per phase (four plans total), all arguing from this spec.
