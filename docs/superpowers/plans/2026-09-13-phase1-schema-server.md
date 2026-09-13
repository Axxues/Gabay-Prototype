# Phase 1 — Prisma Schema + Server Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable Express + Prisma server scaffold with the full ~30-model schema validated and migrated onto the empty `GabayPrototype` database, plus a checked-in `schema.sql` export.

**Architecture:** Prisma `schema.prisma` is the single source of truth: one model per JSON collection plus one child model per nested array, existing string ids kept as `@id @db.NVarChar(64)`. Prisma's SQL Server connector has no `Json` type, so the convention is fixed: queryable/filtered data gets real tables; opaque config blobs go in `NVARCHAR(MAX)` columns holding JSON parsed at the API boundary. Enrollment is derived from approved `EnrollmentRequest` rows — no separate enrollments table (YAGNI).

**Tech Stack:** Node 20+, Express ^4, Prisma ^6 (`prisma` + `@prisma/client`), `jsonwebtoken`, `bcryptjs`, `multer`, `tsx`; SQL Server 2019+ (SQLEXPRESS) with a dedicated `gabay_app` SQL login.

**Spec:** `docs/superpowers/specs/2026-09-13-sql-server-migration-design.md` (§§1–3, §5)

## Global Constraints

- No backend before this plan; all LMS data in `src/data/mockData.json` + localStorage key `gabay_lms_db_v6` (untouched by this phase — deletion happens in Phase 3 seed).
- Database is the new empty `GabayPrototype` catalog on `DESKTOP-DTAQOP7\SQLEXPRESS` (not `CareSync`); only the catalog name differs from the supplied connection string.
- Prisma uses URL format: the ADO.NET string is converted, never pasted verbatim or exposed to the browser; credentials live only in `server/.env` (gitignored).
- Passwordless Windows integrated auth is unavailable from Node: a dedicated SQL login (`gabay_app`, `db_owner` on `GabayPrototype` only) is created via checked-in `001-create-login.sql` in SSMS.
- `Pooling=False` has no Prisma equivalent (it always pools); harmless locally.
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.

---

## File structure

- `server/package.json` (new) — Express + Prisma + auth + upload deps, `tsx` runner.
- `server/tsconfig.json` (new) — strict TS for the server, independent of the Vite app.
- `server/.env` (new, gitignored) + `server/.env.example` (new, committed, no secrets).
- `server/sql/001-create-login.sql` (new) — login, database, user, role (run once in SSMS).
- `server/src/index.ts` (new) — Express app with `/api/health` only (routers arrive in Phase 2).
- `server/prisma/schema.prisma` (new) — all models, built across Tasks 2–5.
- `server/prisma/schema.sql` (new) — literal CREATE TABLE export for the thesis appendix (Task 6).
- `server/uploads/.gitkeep` (new) — file-bytes directory starts empty.
- `vite.config.ts` (modify) — `/api` + `/uploads` proxy to the API port in dev.
- Root `package.json` (modify) — `dev` starts Vite and the API together.

---

### Task 1: Server scaffold + login SQL + dev proxy

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.env`, `server/.env.example`, `server/sql/001-create-login.sql`, `server/src/index.ts`, `server/uploads/.gitkeep`
- Modify: `vite.config.ts` (add proxy — read the file first, keep existing plugins), root `package.json` (`dev` script)

**Interfaces:**
- Consumes: none
- Produces: `GET /api/health → { ok: true }` on `http://localhost:4000`; `DATABASE_URL` convention consumed by Task 2. Keep the port `4000` and the `/api` prefix exact.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "gabay-server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "seed": "tsx prisma/seed.ts",
    "prisma:validate": "prisma validate --schema prisma/schema.prisma",
    "prisma:studio": "prisma studio --schema prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "bcryptjs": "^3.0.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^11.0.0",
    "multer": "^2.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/multer": "^2.0.0",
    "@types/node": "^24.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.0.0",
    "typescript": "~5.7.0"
  }
}
```

Run: `npm install --prefix server`
Expected: `added N packages`, no errors.

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "prisma/seed.ts"]
}
```

- [ ] **Step 3: Create `server/.env.example` (no secrets) and local `server/.env`**

```ini
# server/.env.example — copy to .env and fill in the gabay_app password
DATABASE_URL="sqlserver://DESKTOP-DTAQOP7\\SQLEXPRESS:1433;database=GabayPrototype;user=gabay_app;password=CHANGE_ME;encrypt=true;trustServerCertificate=true"
JWT_SECRET="CHANGE_ME_DEV_ONLY"
PORT="4000"
```

Create `server/.env` as a copy with a locally-chosen `gabay_app` password and a random `JWT_SECRET`. Verify `.env` is ignored: `git check-ignore server/.env` must print `server/.env`. If the repo `.gitignore` has no `.env` rule, append `.env` handling scoped to the server folder by adding the line `server/.env` to root `.gitignore`.

- [ ] **Step 4: Create `server/sql/001-create-login.sql`**

```sql
-- Run once in SSMS as a sysadmin. Creates the login, the database, and maps them.
CREATE LOGIN [gabay_app] WITH PASSWORD = N'__SET_A_STRONG_PASSWORD__', CHECK_POLICY = ON;
GO
CREATE DATABASE [GabayPrototype];
GO
USE [GabayPrototype];
GO
CREATE USER [gabay_app] FOR LOGIN [gabay_app];
GO
ALTER ROLE [db_owner] ADD MEMBER [gabay_app];
GO
```

Replace `__SET_A_STRONG_PASSWORD__` with the same password placed in `server/.env`, run the script in SSMS, and record success in the report (no secrets in the report — state only "login created, SSMS success").

- [ ] **Step 5: Create `server/src/index.ts`**

```ts
import express from 'express';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`gabay-server listening on http://localhost:${port}`);
});
```

- [ ] **Step 6: Wire the dev proxy and joint dev script**

Read `vite.config.ts` first; add to the exported config (keeping existing plugins):

```ts
server: {
  proxy: {
    '/api': 'http://localhost:4000',
    '/uploads': 'http://localhost:4000',
  },
},
```

In root `package.json`, change `dev` to start both (Windows-safe, no `&&` semantics issue since npm runs the string via cmd — use `concurrently`? YAGNI: document two terminals instead). Set:

```json
"dev": "vite",
"dev:server": "npm --prefix server run dev",
```

and document in the report that dev requires two terminals (`npm run dev` + `npm run dev:server`) until Phase 4 adds a joint runner if needed.

- [ ] **Step 7: Verify boot + health**

Run: `npm --prefix server run dev` (leave running), then in a second shell `curl http://localhost:4000/api/health` (PowerShell: `Invoke-RestMethod http://localhost:4000/api/health`).
Expected: `{ ok: true }` / `ok : True`. Then `npx tsc -b` at repo root (expect PASS — server has its own tsconfig, root build unaffected).

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/tsconfig.json server/.env.example server/sql/001-create-login.sql server/src/index.ts server/uploads/.gitkeep vite.config.ts package.json .gitignore
git commit -m "feat(server): scaffold Express API, login SQL, dev proxy"
```

Do NOT `git add server/.env` (must remain untracked — verify with `git status --short` before committing).

---

### Task 2: Prisma setup + identity models (User, Course, CourseSection, EnrollmentRequest)

**Files:**
- Create: `server/prisma/schema.prisma` (datasource + generator + 4 models)
- Test: `npx prisma validate` (offline, no DB needed)

**Interfaces:**
- Consumes: `DATABASE_URL` (Task 1)
- Produces: `User`, `Course`, `CourseSection`, `EnrollmentRequest` models consumed by Tasks 3–5 relations and Phase 2 routers. Keep model/field names exact — Phase 2 code imports them verbatim.

- [ ] **Step 1: Create `server/prisma/schema.prisma` with datasource, generator, and identity models**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

enum UserRole {
  admin
  faculty
  staff
  student
}

enum EnrollmentRequestType {
  self_join
  faculty_enroll
  section_switch
}

enum EnrollmentRequestStatus {
  pending
  approved
  rejected
}

model User {
  id             String   @id @db.NVarChar(64)
  name           String   @db.NVarChar(128)
  email          String   @unique @db.NVarChar(256)
  passwordHash   String   @db.NVarChar(256)
  role           UserRole
  avatar         String   @db.NVarChar(512)
  department     String   @db.NVarChar(128)
  title          String   @db.NVarChar(128)
  lastVisitedAt  String?  @db.NVarChar(Max)
  coursesTaught  Course[] @relation("InstructorCourses")
}

model Course {
  id                String             @id @db.NVarChar(64)
  code              String             @db.NVarChar(32)
  title             String             @db.NVarChar(256)
  section           String             @db.NVarChar(64)
  term              String             @db.NVarChar(64)
  instructorId      String             @db.NVarChar(64)
  instructor        User               @relation("InstructorCourses", fields: [instructorId], references: [id])
  instructorName    String             @db.NVarChar(128)
  published         Boolean            @default(false)
  color             String?            @db.NVarChar(32)
  image             String?            @db.NVarChar(512)
  enrolledCount     Int                @default(0)
  credits           Int?
  chedComplianceCode String?           @db.NVarChar(64)
  joinCode          String?            @unique @db.NVarChar(32)
  syllabus          String?            @db.NVarChar(Max)
  sections          CourseSection[]
  requests          EnrollmentRequest[]
}

model CourseSection {
  id            String  @id @db.NVarChar(64)
  courseId      String  @db.NVarChar(64)
  course        Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  name          String  @db.NVarChar(128)
  capacity      Int?
  enrolledCount Int     @default(0)
  schedule      String? @db.NVarChar(256)
  location      String? @db.NVarChar(256)
}

model EnrollmentRequest {
  id              String                  @id @db.NVarChar(64)
  courseId        String                  @db.NVarChar(64)
  course          Course                  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  studentId       String                  @db.NVarChar(64)
  studentName     String                  @db.NVarChar(128)
  type            EnrollmentRequestType
  status          EnrollmentRequestStatus @default(pending)
  requestedAt     DateTime                @default(now())
  resolvedAt      DateTime?
  resolvedBy      String?                 @db.NVarChar(64)
  sectionId       String?                 @db.NVarChar(64)
  targetSectionId String?                 @db.NVarChar(64)
}
```

Notes the implementer must preserve: `passwordHash` replaces the JSON plaintext `password` (Phase 3 seed hashes); `User.lastVisitedAt` and `Course.syllabus` are `NVARCHAR(MAX)` JSON blobs parsed at the API boundary (Prisma SQL Server has no `Json`); enrollment is derived from approved `EnrollmentRequest` rows — no enrollments table. `Course.sectionIds` from JSON is dropped — sections are the relation.

- [ ] **Step 2: Validate offline**

Run: `npx --prefix server prisma validate --schema server/prisma/schema.prisma`
Expected: `The schema is valid` (no DB connection needed).

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(server): Prisma identity models (users, courses, sections, requests)"
```

---

### Task 3: Learning models (modules, assignments, quizzes, activities)

**Files:**
- Modify: `server/prisma/schema.prisma` (append 10 models)
- Test: `npx prisma validate`

**Interfaces:**
- Consumes: `Course` (Task 2)
- Produces: `Module`, `ModuleItem`, `ModuleComment`, `ModuleCommentLike`, `Assignment`, `Submission`, `SubmissionComment`, `Quiz`, `QuizQuestion`, `Activity` consumed by Phase 2 routers. Keep names exact.

- [ ] **Step 1: Append the learning models**

```prisma
model Module {
  id                   String          @id @db.NVarChar(64)
  courseId             String          @db.NVarChar(64)
  title                String          @db.NVarChar(256)
  order                Int             @default(0)
  published            Boolean         @default(false)
  prerequisiteModuleId String?         @db.NVarChar(64)
  authorId             String?         @db.NVarChar(64)
  authorName           String?         @db.NVarChar(128)
  items                ModuleItem[]
  comments             ModuleComment[]
}

model ModuleItem {
  id                String  @id @db.NVarChar(64)
  moduleId          String  @db.NVarChar(64)
  module            Module  @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title             String  @db.NVarChar(256)
  type              String  @db.NVarChar(32)
  published         Boolean @default(true)
  required          Boolean @default(false)
  completionCondition String? @db.NVarChar(32)
  minScore          Float?
  content           String? @db.NVarChar(Max)
  assignmentId      String? @db.NVarChar(64)
  quizId            String? @db.NVarChar(64)
  fileUrl           String? @db.NVarChar(1024)
  fileName          String? @db.NVarChar(256)
  fileSize          String? @db.NVarChar(32)
  fileType          String? @db.NVarChar(64)
  completed         Boolean @default(false)
  authorId          String? @db.NVarChar(64)
  authorName        String? @db.NVarChar(128)
}

model ModuleComment {
  id         String              @id @db.NVarChar(64)
  moduleId   String              @db.NVarChar(64)
  module     Module              @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  authorId   String              @db.NVarChar(64)
  authorName String              @db.NVarChar(128)
  authorAvatar String            @db.NVarChar(512)
  authorRole String              @db.NVarChar(32)
  content    String              @db.NVarChar(Max)
  createdAt  DateTime            @default(now())
  likes      Int                 @default(0)
  likedBy    ModuleCommentLike[]
  isEdited   Boolean             @default(false)
  editedAt   DateTime?
}

model ModuleCommentLike {
  commentId String        @db.NVarChar(64)
  comment   ModuleComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId    String        @db.NVarChar(64)
  @@id([commentId, userId])
}

model Assignment {
  id               String   @id @db.NVarChar(64)
  courseId         String   @db.NVarChar(64)
  title            String   @db.NVarChar(256)
  instructions     String   @db.NVarChar(Max)
  pointsPossible   Float
  dueDate          DateTime
  submissionTypes  String   @db.NVarChar(64)
  published        Boolean  @default(false)
  category         String   @db.NVarChar(64)
  weight           Float    @default(0)
  rubric           String   @db.NVarChar(Max)
  fileName         String?  @db.NVarChar(256)
  fileUrl          String?  @db.NVarChar(1024)
  fileSize         String?  @db.NVarChar(32)
  availableFrom    DateTime?
  availableUntil   DateTime?
  sectionRestriction String? @db.NVarChar(128)
  submissions      Submission[]
}
```

`submissionTypes` stores the JSON array (e.g. `["file"]`) and `rubric` stores the `RubricCriterion[]` JSON — both `NVARCHAR` blobs parsed at the API boundary per the convention.

```prisma
model Submission {
  id            String              @id @db.NVarChar(64)
  assignmentId  String              @db.NVarChar(64)
  assignment    Assignment          @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  courseId      String              @db.NVarChar(64)
  studentId     String              @db.NVarChar(64)
  studentName   String              @db.NVarChar(128)
  studentAvatar String              @db.NVarChar(512)
  submittedAt   DateTime            @default(now())
  submissionType String             @db.NVarChar(32)
  content       String?             @db.NVarChar(Max)
  fileUrl       String?             @db.NVarChar(1024)
  fileName      String?             @db.NVarChar(256)
  grade         Float?
  gradedAt      DateTime?
  gradedBy      String?             @db.NVarChar(128)
  status        String              @db.NVarChar(32)
  rubricScores  String              @db.NVarChar(Max)
  comments      SubmissionComment[]
}
```

`rubricScores` stores the `Record<string, number>` JSON (`{}` when ungraded).

```prisma
model SubmissionComment {
  id           String     @id @db.NVarChar(64)
  submissionId String     @db.NVarChar(64)
  submission   Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  authorId     String     @db.NVarChar(64)
  authorName   String     @db.NVarChar(128)
  authorRole   String     @db.NVarChar(32)
  createdAt    DateTime   @default(now())
  text         String     @db.NVarChar(Max)
}

model Quiz {
  id               String         @id @db.NVarChar(64)
  courseId         String         @db.NVarChar(64)
  title            String         @db.NVarChar(256)
  instructions     String         @db.NVarChar(Max)
  timeLimitMinutes Int            @default(30)
  published        Boolean        @default(false)
  delayedUntil     DateTime?
  dueDate          DateTime?
  fileName         String?        @db.NVarChar(256)
  fileUrl          String?        @db.NVarChar(1024)
  fileSize         String?        @db.NVarChar(32)
  questions        QuizQuestion[]
}

model QuizQuestion {
  id            String   @id @db.NVarChar(64)
  quizId        String?  @db.NVarChar(64)
  quiz          Quiz?    @relation(fields: [quizId], references: [id], onDelete: Cascade)
  activityId    String?  @db.NVarChar(64)
  activity      Activity? @relation(fields: [activityId], references: [id], onDelete: Cascade)
  text          String   @db.NVarChar(Max)
  type          String   @db.NVarChar(32)
  options       String   @db.NVarChar(Max)
  correctAnswer String?  @db.NVarChar(1024)
  points        Float    @default(5)
  description   String?  @db.NVarChar(Max)
  rubricNotes   String?  @db.NVarChar(Max)
  imageUrl      String?  @db.NVarChar(1024)
  imageName     String?  @db.NVarChar(256)
  fileUrl       String?  @db.NVarChar(1024)
  fileName      String?  @db.NVarChar(256)
}
```

`options` stores the string-array JSON. One question row belongs to either a quiz or an activity (nullable FKs; API enforces exactly one).

```prisma
model Activity {
  id             String         @id @db.NVarChar(64)
  courseId       String         @db.NVarChar(64)
  title          String         @db.NVarChar(256)
  instructions   String         @db.NVarChar(Max)
  pointsPossible Float
  dueDate        DateTime?
  published      Boolean        @default(false)
  questions      QuizQuestion[]
}
```

- [ ] **Step 2: Validate**

Run: `npx --prefix server prisma validate --schema server/prisma/schema.prisma`
Expected: `The schema is valid`.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(server): Prisma learning models (modules, assignments, quizzes, activities)"
```

---

### Task 4: Comms models (announcements, discussions, messages, calendar, notifications)

**Files:**
- Modify: `server/prisma/schema.prisma` (append 13 models)
- Test: `npx prisma validate`

**Interfaces:**
- Consumes: `Course`, `User` (Task 2)
- Produces: `Announcement`, `AnnouncementReply`, `AnnouncementAttachment`, `AnnouncementLike`, `AnnouncementRead`, `Discussion`, `DiscussionReply`, `DiscussionReplyLike`, `Message`, `ChatGroup`, `ChatGroupMember`, `CalendarEvent`, `AdvisingSlot`, `Notification` consumed by Phase 2 routers. Keep names exact.

- [ ] **Step 1: Append the comms models**

```prisma
model Announcement {
  id                        String                   @id @db.NVarChar(64)
  courseId                  String                   @db.NVarChar(64)
  title                     String                   @db.NVarChar(256)
  content                   String                   @db.NVarChar(Max)
  authorId                  String                   @db.NVarChar(64)
  authorName                String                   @db.NVarChar(128)
  authorAvatar              String                   @db.NVarChar(512)
  authorRole                String                   @db.NVarChar(32)
  createdAt                 DateTime                 @default(now())
  delayedUntil              DateTime?
  sectionId                 String                   @db.NVarChar(64) @default("all")
  sectionRestriction        String                   @db.NVarChar(128) @default("All Sections")
  allowComments             Boolean                  @default(true)
  usersMustPostBeforeReplies Boolean                 @default(false)
  allowLiking               Boolean                  @default(true)
  likes                     Int                      @default(0)
  pinned                    Boolean                  @default(false)
  attachments               AnnouncementAttachment[]
  replies                   AnnouncementReply[]
  likedBy                   AnnouncementLike[]
  readBy                    AnnouncementRead[]
}

model AnnouncementAttachment {
  id             String       @id @default(cuid()) @db.NVarChar(64)
  announcementId String       @db.NVarChar(64)
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  name           String       @db.NVarChar(256)
  size           String       @db.NVarChar(32)
  url            String?      @db.NVarChar(1024)
}

model AnnouncementReply {
  id             String            @id @db.NVarChar(64)
  announcementId String            @db.NVarChar(64)
  announcement   Announcement      @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  authorId       String            @db.NVarChar(64)
  authorName     String            @db.NVarChar(128)
  authorAvatar   String            @db.NVarChar(512)
  authorRole     String            @db.NVarChar(32)
  content        String            @db.NVarChar(Max)
  createdAt      DateTime          @default(now())
  likes          Int               @default(0)
  likedBy        AnnouncementReplyLike[]
}

model AnnouncementReplyLike {
  replyId String            @db.NVarChar(64)
  reply   AnnouncementReply @relation(fields: [replyId], references: [id], onDelete: Cascade)
  userId  String            @db.NVarChar(64)
  @@id([replyId, userId])
}

model AnnouncementLike {
  announcementId String       @db.NVarChar(64)
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  userId         String       @db.NVarChar(64)
  @@id([announcementId, userId])
}

model AnnouncementRead {
  announcementId String       @db.NVarChar(64)
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  userId         String       @db.NVarChar(64)
  @@id([announcementId, userId])
}

model Discussion {
  id                        String            @id @db.NVarChar(64)
  courseId                  String            @db.NVarChar(64)
  title                     String            @db.NVarChar(256)
  prompt                    String            @db.NVarChar(Max)
  authorId                  String            @db.NVarChar(64)
  authorName                String            @db.NVarChar(128)
  authorAvatar              String            @db.NVarChar(512)
  authorRole                String            @db.NVarChar(32)
  createdAt                 DateTime          @default(now())
  isGraded                  Boolean           @default(false)
  pointsPossible            Float?
  dueDate                   DateTime?
  pinned                    Boolean           @default(false)
  locked                    Boolean           @default(false)
  usersMustPostBeforeReplies Boolean          @default(false)
  groupAssignment           String?           @db.NVarChar(128)
  replies                   DiscussionReply[]
}

model DiscussionReply {
  id           String                @id @db.NVarChar(64)
  discussionId String                @db.NVarChar(64)
  discussion   Discussion            @relation(fields: [discussionId], references: [id], onDelete: Cascade)
  parentId     String?               @db.NVarChar(64)
  authorId     String                @db.NVarChar(64)
  authorName   String                @db.NVarChar(128)
  authorAvatar String                @db.NVarChar(512)
  authorRole   String                @db.NVarChar(32)
  content      String                @db.NVarChar(Max)
  createdAt    DateTime              @default(now())
  likes        Int                   @default(0)
  likedBy      DiscussionReplyLike[]
}

model DiscussionReplyLike {
  replyId String          @db.NVarChar(64)
  reply   DiscussionReply @relation(fields: [replyId], references: [id], onDelete: Cascade)
  userId  String          @db.NVarChar(64)
  @@id([replyId, userId])
}

model Message {
  id             String    @id @db.NVarChar(64)
  senderId       String    @db.NVarChar(64)
  senderName     String    @db.NVarChar(128)
  senderRole     String    @db.NVarChar(32)
  recipientId    String    @db.NVarChar(64)
  recipientName  String    @db.NVarChar(128)
  recipientRole  String    @db.NVarChar(32)
  courseId       String?   @db.NVarChar(64)
  courseCode     String?   @db.NVarChar(32)
  subject        String    @db.NVarChar(256)
  body           String    @db.NVarChar(Max)
  timestamp      DateTime  @default(now())
  read           Boolean   @default(false)
  reaction       String?   @db.NVarChar(32)
  attachmentName String?   @db.NVarChar(256)
  attachmentSize String?   @db.NVarChar(32)
  groupId        String?   @db.NVarChar(64)
  isGroup        Boolean   @default(false)
}

model ChatGroup {
  id        String            @id @db.NVarChar(64)
  name      String            @db.NVarChar(128)
  avatar    String?           @db.NVarChar(512)
  courseId  String?           @db.NVarChar(64)
  courseCode String?          @db.NVarChar(32)
  createdAt DateTime          @default(now())
  createdBy String            @db.NVarChar(64)
  members   ChatGroupMember[]
}

model ChatGroupMember {
  groupId String    @db.NVarChar(64)
  group   ChatGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId  String    @db.NVarChar(64)
  @@id([groupId, userId])
}

model CalendarEvent {
  id              String    @id @db.NVarChar(64)
  title           String    @db.NVarChar(256)
  date            String    @db.NVarChar(32)
  time            String    @db.NVarChar(32)
  courseId        String?   @db.NVarChar(64)
  courseCode      String?   @db.NVarChar(32)
  type            String    @db.NVarChar(32)
  description     String    @db.NVarChar(Max)
  createdAt       DateTime?
  startAt         DateTime?
  endAt           DateTime?
  isAllDay        Boolean   @default(false)
  colorHex        String?   @db.NVarChar(32)
  location        String?   @db.NVarChar(256)
  meetingPlatform String?   @db.NVarChar(32)
  meetingId       String?   @db.NVarChar(128)
  meetingPasscode String?   @db.NVarChar(128)
  meetingJoinUrl  String?   @db.NVarChar(1024)
}

model AdvisingSlot {
  id                 String   @id @db.NVarChar(64)
  instructorId       String   @db.NVarChar(64)
  instructorName     String   @db.NVarChar(128)
  date               String   @db.NVarChar(32)
  timeSlot           String   @db.NVarChar(64)
  location           String   @db.NVarChar(256)
  status             String   @db.NVarChar(32)
  bookedByStudentId  String?  @db.NVarChar(64)
  bookedByStudentName String? @db.NVarChar(128)
  notes              String?  @db.NVarChar(Max)
}

model Notification {
  id          String   @id @db.NVarChar(64)
  type        String   @db.NVarChar(64)
  recipientId String   @db.NVarChar(64)
  actorId     String   @db.NVarChar(64)
  actorName   String   @db.NVarChar(128)
  actorAvatar String   @db.NVarChar(512)
  relatedId   String   @db.NVarChar(64)
  relatedTitle String  @db.NVarChar(256)
  content     String   @db.NVarChar(Max)
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

`likedBy`/`readBy`/`memberIds` arrays become join tables (arrays are unqueryable in SQL); only `AnnouncementAttachment.id` is generated (`cuid()`) since JSON attachments carry no ids — everything else keeps its existing string id.

- [ ] **Step 2: Validate**

Run: `npx --prefix server prisma validate --schema server/prisma/schema.prisma`
Expected: `The schema is valid`.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(server): Prisma comms models (announcements, discussions, messages, calendar, notifications)"
```

---

### Task 5: Files + catalog models (folders, files, history, templates)

**Files:**
- Modify: `server/prisma/schema.prisma` (append 4 models)
- Test: `npx prisma validate`

**Interfaces:**
- Consumes: `Course` (Task 2)
- Produces: `CourseFolder`, `CourseFile`, `HistoryLog`, `CommonsTemplate` — completes the schema consumed by Task 6 migration and Phase 2 routers. Keep names exact.

- [ ] **Step 1: Append the files + catalog models**

```prisma
model CourseFolder {
  id        String         @id @db.NVarChar(64)
  courseId  String         @db.NVarChar(64)
  parentId  String?        @db.NVarChar(64)
  parent    CourseFolder?  @relation("FolderChildren", fields: [parentId], references: [id], onDelete: NoAction)
  children  CourseFolder[] @relation("FolderChildren")
  name      String         @db.NVarChar(256)
  updatedAt DateTime       @updatedAt
  autoKey   String?        @db.NVarChar(128)
  files     CourseFile[]
}

model CourseFile {
  id            String       @id @db.NVarChar(64)
  courseId      String       @db.NVarChar(64)
  folderId      String?      @db.NVarChar(64)
  folder        CourseFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)
  name          String       @db.NVarChar(256)
  size          Int          @default(0)
  formattedSize String       @db.NVarChar(32)
  type          String       @db.NVarChar(32)
  visibility    String       @db.NVarChar(32)
  updatedAt     DateTime     @updatedAt
  uploadedBy    String       @db.NVarChar(64)
  uploadedByName String      @db.NVarChar(128)
  content       String?      @db.NVarChar(Max)
  url           String?      @db.NVarChar(1024)
  fileUrl       String?      @db.NVarChar(1024)
  sourceArea    String?      @db.NVarChar(32)
  sourceId      String?      @db.NVarChar(64)
}

model HistoryLog {
  id        String   @id @db.NVarChar(64)
  path      String   @db.NVarChar(512)
  title     String   @db.NVarChar(256)
  timestamp DateTime @default(now())
}

model CommonsTemplate {
  id            String  @id @db.NVarChar(64)
  title         String  @db.NVarChar(256)
  category      String  @db.NVarChar(128)
  description   String  @db.NVarChar(Max)
  author        String  @db.NVarChar(128)
  downloads     Int     @default(0)
  rating        Float   @default(0)
  tags          String  @db.NVarChar(Max)
  chedAlignment String  @db.NVarChar(512)
}
```

`tags` stores the string-array JSON per the blob convention. `HistoryLog` mirrors the JSON exactly (no user column exists in the source data). `CourseFile.size` is `Int` (2 GB ceiling — documented limit for this prototype; file bytes live on disk, so only metadata size is stored).

- [ ] **Step 2: Validate**

Run: `npx --prefix server prisma validate --schema server/prisma/schema.prisma`
Expected: `The schema is valid`.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(server): Prisma files and catalog models (folders, files, history, templates)"
```

---

### Task 6: Migrate the empty database + export schema.sql

**Files:**
- Create: `server/prisma/schema.sql` (generated, committed for the thesis appendix)
- Test: migration + Studio spot check

**Interfaces:**
- Consumes: full `schema.prisma` (Tasks 2–5), live `DATABASE_URL` (Task 1)
- Produces: all ~30 tables in `GabayPrototype`; `schema.sql` consumed by the thesis appendix. Terminal task of Phase 1.

- [ ] **Step 1: Apply the migration to the empty database**

Run: `npx --prefix server prisma migrate dev --name init --schema server/prisma/schema.prisma`
Expected: `Your database is now in sync with your schema` and a new `server/prisma/migrations/<timestamp>_init/` folder. If SQLEXPRESS is unreachable, stop and report the exact error (BLOCKED with the message) — do not invent workarounds; the database host is a fixed requirement.

- [ ] **Step 2: Export the literal CREATE TABLE statements**

Run: `npx --prefix server prisma migrate diff --from-empty --to-schema-datamodel server/prisma/schema.prisma --script > server/prisma/schema.sql`
Expected: `schema.sql` containing `CREATE TABLE` blocks for all models. Spot-check that `Users`, `Courses`, `QuizQuestions`, and `AnnouncementReplies` tables are present:

```bash
Select-String -LiteralPath server/prisma/schema.sql -Pattern "CREATE TABLE \[(dbo\.)?(Users|Courses|QuizQuestions|AnnouncementReplies)\]"
```

Expected: 4 matches.

- [ ] **Step 3: Studio smoke check**

Run: `npx --prefix server prisma studio --schema server/prisma/schema.prisma`, open the URL, confirm the `User` and `Course` tables exist and are empty (zero rows — seeding is Phase 3).
Expected: tables visible, 0 rows.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.sql server/prisma/migrations
git commit -m "feat(server): initial migration and schema.sql export"
```

---

## Self-Review

**1. Spec coverage:** §2 data model → Tasks 2–5 (every JSON collection + every nested array mapped; string-id PKs; NVARCHAR(MAX) blob convention; no enrollments table). §3 backend/connection → Task 1 (scaffold, `.env` translation, login SQL, proxy) + Task 6 (live migration proof). §3 `schema.sql` export → Task 6 Step 2. Auth/files/seed/frontend (§§3–5) belong to Phase 2–4 plans, explicitly out of this file. No gaps within Phase 1 scope.

**2. Placeholder scan:** No TBD/TODO; every step has exact file paths, full code blocks, exact commands with expected outputs, and exact commit messages. Version pins use caret ranges (`^6.0.0`, `^4.21.0`) resolved at install with success output recorded — the only non-literal values, and the report captures actuals.

**3. Type consistency:** Model names (`User`, `Course`, `CourseSection`, `EnrollmentRequest`, `Module`, `ModuleItem`, `ModuleComment`, `ModuleCommentLike`, `Assignment`, `Submission`, `SubmissionComment`, `Quiz`, `QuizQuestion`, `Activity`, `Announcement`, `AnnouncementAttachment`, `AnnouncementReply`, `AnnouncementReplyLike`, `AnnouncementLike`, `AnnouncementRead`, `Discussion`, `DiscussionReply`, `DiscussionReplyLike`, `Message`, `ChatGroup`, `ChatGroupMember`, `CalendarEvent`, `AdvisingSlot`, `Notification`, `CourseFolder`, `CourseFile`, `HistoryLog`, `CommonsTemplate`) are identical across tasks; relation fields reference only models defined in earlier-or-same tasks; `QuizQuestion.quizId/activityId` nullable pair matches the one-parent rule stated in Task 3.
