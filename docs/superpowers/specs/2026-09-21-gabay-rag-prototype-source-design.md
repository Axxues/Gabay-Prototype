# Gabay RAG: Prototype-Source Migration (Approach A) — Design

**Date:** 2026-09-21
**Status:** approved section-by-section by stakeholder
**Goal:** Retire Likha ERP (`school.zyberlab.com` Directus) as the RAG source; ingest from the GabayPrototype SQL Server database instead, serve via the existing `gabay-rag` webhook with LMS-scoped agents.

## Context (verified read-only)

- Retrieval workflow `AtgiSrVPbqjgdZ9x` (active): webhook `POST gabay-rag` → Normalize Input → Coordinator_Agent (Groq `openai/gpt-oss-120b`) → 4 agentTools (Registrar/Academic/Finance/Operations, maxIterations 3) → 7 Qdrant `retrieve-as-tool` nodes on `likha_school_rag` filtered by `metadata.metadata.domain` + `is_junction`, topK 25–30. Embeddings: HF `sentence-transformers/all-MiniLM-L6-v2` (384-dim). Memory: buffer window on `sessionId`.
- Ingestion workflow `LTjJUQJQr4nTVjLh` (active): 6h schedule + `ingest-trigger` webhook → delete-all points → `Prepare Collections` (Directus `https://school.zyberlab.com/items`, Bearer token embedded) → flatten + 3 pre-aggregated summaries → batch-70 insert.
- Qdrant: single collection `likha_school_rag`, 384-dim Cosine, 814 points.
- GabayPrototype DB: 34 LMS Prisma models (User, Course, CourseSection, EnrollmentRequest, Module, ModuleItem, Activity, Quiz, Exam, Announcement, Message, CalendarEvent, Submission, CourseGrade, …), currently ~4 users. No ERP tables.

## Decisions (locked)

1. n8n writes via API key (stakeholder supplies key at implementation).
2. Ingestion reads via new Express export endpoints (not direct SQL from n8n).
3. Agents replaced with LMS set: Courses, Learning, People, Progress (renames allowed).
4. New collection `gabay_prototype_rag`; old ingestion deactivated, old collection archived untouched.

## 1. Ingestion

- New read-only Express routers `GET /api/rag-export/{courses,learning,people,progress}`, service-key header auth (new `RAG_EXPORT_KEY`, gitignored `.env` only).
- Exclusions: password hashes, auth tokens, message bodies (metadata only: subject/sender/timestamp). Grades ship per-student keyed by `studentId` (see §3 privacy).
- New n8n workflow "GABAY RAG — Data Ingestion (Prototype)": 6h schedule (kept) + manual webhook → delete-all on new collection → fetch 4 endpoints → flatten rows to `Collection: <table>` text + 4 area summary docs (catalog, assessment counts, directory, grading overview) → batch-70 insert, same HF credential.
- Old ingestion workflow deactivated, kept for rollback.

## 2. Collection & payload contract

- `gabay_prototype_rag`: 384-dim Cosine, HNSW m=16 (mirrors current; no embedding/model changes).
- Payload: `{domain: courses|learning|people|progress, collection, record_id, is_junction: false, source}` nested under `metadata.metadata.*` (same filter path convention as today). No junction duality; LMS joins flattened into text.

## 3. Retrieval rework

- Unchanged contract: `POST /webhook/gabay-rag` same body; no frontend/server changes.
- Chain unchanged: webhook → Normalize → Coordinator (Groq-120B) → agentTools → Qdrant tools → memory. Same models/credentials/topK.
- Coordinator prompt rewritten to Gabay-LMS scope keeping the Rule 1–5 skeleton (scope refusal naming LMS topics, direct-answer rules, delegation table, no emojis, charts/tables only on explicit request).
- 4 rebuilt agentTools (Courses/Learning/People/Progress), one Qdrant retrieve tool each on the new collection filtered by domain (junction pair collapsed).
- Privacy: server already sends `userId`; Progress tools add `studentId == userId` filter (backend-enforced, prompt as second layer).

## 4. Cutover, secrets & testing

- Order: create collection → export endpoints (+ tests) → build/run new ingestion manually → spot-check points → repoint retrieval → live webhook tests (in-scope answer, out-of-scope refusal, cross-user grades probe) → deactivate old ingestion → rotate exposed Directus bearer token.
- Rollback: reactivate old ingestion + flip retrieval collection back (one edit each).
- Verification: manual n8n runs + webhook probes; new Jest tests for export endpoints only.

## Non-goals

- No change to LMS features, auth model, or embedding/LLM providers; no Directus/Likha data migration (archive only); no refresh-token or prod-hardening work.
