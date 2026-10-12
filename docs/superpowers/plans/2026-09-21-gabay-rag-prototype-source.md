# Gabay RAG Prototype-Source Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the `gabay-rag` webhook from a new `gabay_prototype_rag` Qdrant collection ingested from the GabayPrototype SQL Server database, with LMS-scoped agents, archiving the Likha ERP setup.

**Architecture:** New read-only Express export endpoints feed a new API-driven n8n ingestion workflow; the existing retrieval workflow is repointed (collection, filters, prompts, agent names) with its webhook contract untouched; old ingestion is deactivated and the old collection archived.

**Tech Stack:** Express 4 + Prisma 6 (SQL Server), Vitest 5 + supertest 7, n8n REST API v1, Qdrant REST :6333, Groq + HuggingFace Inference (existing n8n credentials, unchanged).

**Spec:** `docs/superpowers/specs/2026-09-21-gabay-rag-prototype-source-design.md`

## Global Constraints

- NEVER print or commit secrets (n8n API key, `RAG_EXPORT_KEY`, Directus token, `gabay_app` password). Secrets live in gitignored `server/.env` and n8n credentials only.
- New Qdrant collection MUST be 384-dim Cosine (matches `sentence-transformers/all-MiniLM-L6-v2`).
- Webhook contract unchanged: `POST /webhook/gabay-rag` with `{chatInput|message, sessionId, userId, role}`.
- Old ingestion workflow `LTjJUQJQr4nTVjLh` is deactivated, never deleted; `likha_school_rag` is never written after cutover.
- Confirm every Prisma field name against `server/prisma/schema.prisma` before running (type names below mirror it; adjust selects if drifted, then `npm run prisma:validate --workspace=server`).

---

## File Structure

- Create: `server/src/routes/ragExport.ts` — 4 read-only routers (`/api/rag-export/courses|learning|people|progress`), service-key auth, safe field selects only.
- Create: `server/src/routes/ragExport.test.ts` — 401-without-key + shape tests per area (supertest, Vitest, mirrors `routes/rag.test.ts` style).
- Modify: `server/src/index.ts:52` — mount `app.use('/api/rag-export', ragExportRouter);` after the rag line.
- Modify: `server/.env.example` — document `RAG_EXPORT_KEY=CHANGE_ME` (value only in gitignored `server/.env`).
- n8n (via API, no repo files): new workflow "GABAY RAG — Data Ingestion (Prototype)"; PATCH retrieval workflow `AtgiSrVPbqjgdZ9x` (prompts, names, Qdrant nodes); deactivate `LTjJUQJQr4nTVjLh`.

## Prerequisite (blocking)

Get from the stakeholder before Task 3: an **n8n API key** (n8n UI → profile → API key) and confirmation that `server/.env` has `RAG_EXPORT_KEY` set (any random 32+ char string) plus dev server running on `:4000`. Without the key, do Tasks 1–2 only, then stop and ask.

---

### Task 1: Export endpoints + tests (TDD)

**Files:**
- Create: `server/src/routes/ragExport.ts`
- Create: `server/src/routes/ragExport.test.ts`
- Modify: `server/src/index.ts` (1 line), `server/.env.example` (1 line)

**Interfaces:**
- Consumes: `../db.js` Prisma client (same import as other routers), `../utils/errors.js` `ApiError`.
- Produces: `ragExportRouter` (Express Router); `GET /:area` → `{ area, tables: [{ collection, domain, isJunction: false, records: [...] }] }`; 401 `{ error: { code: 'unauthorized' } }` without header `x-rag-export-key`.

- [ ] **Step 1: Write the failing test** — create `server/src/routes/ragExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ragExportRouter } from './ragExport.js';

function app() {
  const a = express();
  a.use('/api/rag-export', ragExportRouter);
  return a;
}

describe('ragExport', () => {
  it('401s without the service key', async () => {
    const res = await request(app()).get('/api/rag-export/courses');
    expect(res.status).toBe(401);
  });
  it('returns courses-area tables with the key', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const names = res.body.tables.map((t: { collection: string }) => t.collection);
    expect(names).toEqual(expect.arrayContaining(['course', 'course_section', 'enrollment_request']));
    expect(res.body.tables[0]).toHaveProperty('records');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
  it('404s unknown area', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/nope')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it, confirm failure**

Run: `npm test --workspace=server -- ragExport`
Expected: FAIL with "Failed to load" / "no such file" (router doesn't exist).

- [ ] **Step 3: Implement the router** — create `server/src/routes/ragExport.ts` (verify field names in `schema.prisma` first):

```ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';

export const ragExportRouter = Router();
ragExportRouter.use((req, _res, next) => {
  if (req.header('x-rag-export-key') !== process.env.RAG_EXPORT_KEY) {
    throw new ApiError(401, 'unauthorized', 'Missing or invalid export key.');
  }
  next();
});

type Table = { collection: string; domain: string; isJunction: false; records: unknown[] };
const pack = (collection: string, domain: string, records: unknown[]): Table =>
  ({ collection, domain, isJunction: false, records });

ragExportRouter.get('/courses', async (_req, res, next) => {
  try {
    res.json({ area: 'courses', tables: [
      pack('course', 'courses', await prisma.course.findMany({ select: { id: true, code: true, title: true, section: true, instructorName: true, published: true, enrolledCount: true } })),
      pack('course_section', 'courses', await prisma.courseSection.findMany({ select: { id: true, courseId: true, name: true, capacity: true, enrolledCount: true, schedule: true, location: true } })),
      pack('enrollment_request', 'courses', await prisma.enrollmentRequest.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, type: true, status: true, requestedAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/learning', async (_req, res, next) => {
  try {
    res.json({ area: 'learning', tables: [
      pack('module', 'learning', await prisma.module.findMany({ select: { id: true, courseId: true, title: true, order: true, published: true } })),
      pack('module_item', 'learning', await prisma.moduleItem.findMany({ select: { id: true, title: true, type: true, published: true, required: true } })),
      pack('activity', 'learning', await prisma.activity.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, pointsPossible: true, published: true, dueDate: true } })),
      pack('quiz', 'learning', await prisma.quiz.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true, dueDate: true } })),
      pack('exam', 'learning', await prisma.exam.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true } })),
      pack('announcement', 'learning', await prisma.announcement.findMany({ select: { id: true, courseId: true, title: true, content: true, authorName: true, createdAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/people', async (_req, res, next) => {
  try {
    res.json({ area: 'people', tables: [
      pack('user_directory', 'people', await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, department: true, title: true } })),
      pack('calendar_event', 'people', await prisma.calendarEvent.findMany({ select: { id: true, title: true, date: true, time: true, courseId: true, courseCode: true, type: true, description: true } })),
      pack('message_meta', 'people', await prisma.message.findMany({ select: { id: true, senderName: true, senderRole: true, recipientName: true, courseCode: true, subject: true, timestamp: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/progress', async (_req, res, next) => {
  try {
    res.json({ area: 'progress', tables: [
      pack('submission', 'progress', await prisma.submission.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, grade: true, status: true, submittedAt: true } })),
      pack('course_grade', 'progress', await prisma.courseGrade.findMany()),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.use((req, _res, next) => next(new ApiError(404, 'not_found', `Unknown export area: ${req.path}`)));
```

Check `server/src/db.js` exports `prisma` (it does per other routers — confirm import path matches `routes/grades.ts`). Mount in `index.ts`, add `RAG_EXPORT_KEY=CHANGE_ME` to `.env.example`, set real value in gitignored `server/.env`.

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test --workspace=server -- ragExport`
Expected: PASS (3 tests; needs live DB — if DB is down, tests fail with connection error: start SQL Server first, do not mock Prisma).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/ragExport.ts server/src/routes/ragExport.test.ts server/src/index.ts server/.env.example
git commit -m "feat(rag): read-only rag-export endpoints for LMS ingestion"
```

### Task 2: Create `gabay_prototype_rag` collection

**Files:** none (Qdrant API only).

- [ ] **Step 1: Create the collection**

Run: `Invoke-WebRequest -Uri "http://localhost:6333/collections/gabay_prototype_rag" -Method Put -ContentType "application/json" -Body '{"vectors":{"size":384,"distance":"Cosine"}}' -UseBasicParsing`
Expected: `{"result":true,"status":"ok"}`.

- [ ] **Step 2: Verify it exists and is empty**

Run: `Invoke-WebRequest -Uri "http://localhost:6333/collections/gabay_prototype_rag" -UseBasicParsing`
Expected: `"points_count":0`, `size:384`.

### Task 3: New ingestion workflow via n8n API

**Files:** none in repo (n8n API only). Needs the API key from the Prerequisite.

- [ ] **Step 1: Clone the current ingestion as the base**

Run (PowerShell, key in `$env:N8N_KEY`, never printed):
`$w = Invoke-RestMethod -Uri "http://localhost:5678/api/v1/workflows/LTjJUQJQr4nTVjLh" -Headers @{ "X-N8N-API-KEY" = $env:N8N_KEY } -UseBasicParsing`
Expected: workflow JSON with nodes; save to a temp file outside the repo.

- [ ] **Step 2: Transform and create the new workflow** — in a script, apply exactly these edits to the cloned JSON, then `POST /api/v1/workflows` with `name` = `GABAY RAG — Data Ingestion (Prototype)`:
  - Delete Existing Points node: url → `http://qdrant:6333/collections/gabay_prototype_rag/points/delete`.
  - Qdrant Vector Store node: collection → `gabay_prototype_rag`; keep `embeddingBatchSize: 70`, mode `insert`, same Qdrant + HF credentials.
  - Prepare Collections node: replace `jsCode` with fetching the 4 export endpoints (service key from n8n env/credential header, never hardcoded): areas `courses,learning,people,progress` → `http://host.docker.internal:4000/api/rag-export/<area>`; emit `{ collection, domain, isJunction:false, url, records }` per table (records inline — no second fetch needed).
  - Flatten node: replace with: for each table, per record build `text = 'Collection: <collection>\n' + flattened key: value lines` plus one summary doc per area (counts + title lists, mirroring the old 3-summary pattern); metadata `{domain, collection, record_id, is_junction:false, source:'gabay-prototype:<collection>/<id>'}`.
  - Keep schedule (6h), manual webhook (rename path to `ingest-prototype`), batch loop 70, 1s wait.
  - Verify POST returns a new workflow id; do NOT activate yet.

- [ ] **Step 3: Manual test run** — trigger the manual webhook, poll the execution via `GET /api/v1/executions/<id>`, expect success; then `GET /collections/gabay_prototype_rag` shows `points_count > 0`. Spot-check 2 points contain `metadata.domain` of `courses` and `learning`.

- [ ] **Step 4: Commit nothing (n8n-side only)** — record new workflow id + points count in the task summary, never secrets.

### Task 4: Retrieval rework (prompts, agents, Qdrant tools)

**Files:** none in repo (PATCH workflow `AtgiSrVPbqjgdZ9x` via n8n API).

- [ ] **Step 1: Rename the 4 agentTools** (node names + `toolDescription`): Registrar_Agent→Courses_Agent (courses, sections, enrollment), Academic_Agent→Learning_Agent (modules, activities, quizzes, exams, announcements), Finance_Agent→People_Agent (directory, calendar, inbox-meta), Operations_Agent→Progress_Agent (submissions, grades, SPR).
- [ ] **Step 2: Repoint Qdrant tools** — all 7 `vectorStoreQdrant` nodes: collection → `gabay_prototype_rag`; collapse each agent to ONE tool (delete the Relationships duplicate; keep Entities): new filters `{"must":[{"key":"metadata.metadata.domain","match":{"value":"courses"}}]}` (and `learning`, `people`, `progress` respectively); keep topK, models, credentials.
- [ ] **Step 3: Replace Coordinator systemMessage** with the LMS version: copy the live prompt, then apply exactly these replacements (keep Rule 1–5 skeleton, formatting/chart rules verbatim): `LIKHA School System ERP` → `Gabay LMS prototype`; `student records, academic programs, scholarships and fees, and campus operations` → `courses and enrollment, learning content and assessments, people and calendar, grades and progress`; delegation table rows → `Courses_Agent: course catalogs, sections, enrollment requests` / `Learning_Agent: modules, activities, quizzes, exams, announcements` / `People_Agent: user directory, calendar events, inbox metadata` / `Progress_Agent: submissions, course grades`; delete the hardcoded "4 students / Jayvee Scholarship" few-shot lines (counts now come from summary docs).
- [ ] **Step 4: Replace each agent's systemMessage** with its LMS version (same EFFICIENCY DIRECTIVE opening; AVAILABLE TOOLS = its single search tool; RECORD RULES naming its collections, e.g. Courses_Agent: `course`, `course_section`, `enrollment_request`; no hardcoded student names/counts — summaries come from the new summary docs).
- [ ] **Step 5: Save via API and verify** — PUT the workflow, GET it back, assert: 4 renamed agents, 4 Qdrant tools on the new collection, zero references to `likha_school_rag` or `zyberlab` in nodes JSON (search the returned JSON for both strings; expect no hits).

### Task 5: Cutover, secrets, live tests

- [ ] **Step 1: Live webhook probes** (server running, retrieval active):
  - In-scope: `POST localhost:5678/webhook/gabay-rag` `{message:"What courses are available?", userId:"<seeded-student-id>", role:"student"}` → expect 200 with course names from the DB, no ERP terms.
  - Refusal: `{message:" Capital of Germany?"}` → expect the LMS scope refusal.
  - Privacy: same grades question as two different users → each sees only own rows.
- [ ] **Step 2: Deactivate old ingestion** — `POST /api/v1/workflows/LTjJUQJQr4nTVjLh/deactivate`; verify `active:false`. Old collection untouched.
- [ ] **Step 3: Rotate the exposed Directus token** — in the Directus/Likha dashboard, revoke `A3f…` token found in the old workflow (it was committed to workflow JSON, treat as compromised); confirm old ingestion stays green-deactivated.
- [ ] **Step 4: Commit** — nothing secret: `git status` must show no `.env` or workflow JSON; commit any repo-side adjustments with `git commit -m "chore(rag): cut over retrieval to gabay_prototype_rag"`.

## Rollback (if probes fail)

Reactivate old ingestion (`.../activate`), revert the 4 Qdrant nodes' collection to `likha_school_rag` (Task 4 reverse patch), re-run probes. Old data was never deleted.
