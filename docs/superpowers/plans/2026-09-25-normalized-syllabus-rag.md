# Normalized Syllabus RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all public normalized syllabus content into semantic and structured RAG with published-only, privacy-safe Qdrant records and dedicated specialist routing.

**Architecture:** `PrismaSyllabusRepository` expands its published/current RAG projection from seven to sixteen logical sections. The existing `course_syllabus` export pack is enriched with revision metadata and re-ingested into `gabay_prototype_rag`; a dedicated `RAG: Syllabus` Qdrant tool routes semantic questions to the correct Course/Learning owners without duplicating syllabus content in the learning domain.

**Tech Stack:** Prisma, TypeScript, Express, Vitest, n8n Qdrant vector-store tool, Qdrant Scroll/ingestion API, existing HF embeddings.

**Spec:** `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Sections 2-7.

## Global Constraints

- Include public content only.
- Exclude drafts, archived revisions, audit tables, source payloads, extension blobs, actor IDs, signatory data, consultation/schedules/rooms, and internal IDs.
- Keep one logical Qdrant collection: `course_syllabus` inside `gabay_prototype_rag`, domain `courses`.
- Preserve existing seven section keys and record IDs.
- Do not expose all 37 raw tables as duplicate Qdrant records.
- `RAG: Syllabus` connects only to Coordinator, Courses, and Learning agents.
- No baseline workflow redesign.
- Re-ingestion must use a full replace flow and be backed up.
- No commit unless explicitly requested.

---

### Task 1: Expand Published Syllabus RAG Projection

**Files:**
- Modify: `server/src/syllabi/contracts.ts`
- Create: `server/src/syllabi/runtime.ts`
- Modify: `server/src/syllabi/repository.ts`
- Test: `server/src/syllabi/repository.test.ts`
- Test: `server/src/syllabi/repositoryReads.test.ts`

**Interfaces:**
- Existing `getRagSections(courseId)` returns records with stable keys and now exactly these keys when published data exists:

```ts
type RagSectionKey =
  | 'institution'
  | 'description'
  | 'faculty'
  | 'institutional_statement'
  | 'program_outcomes'
  | 'core_values'
  | 'graduate_attributes'
  | 'requirements'
  | 'grading'
  | 'rubrics'
  | 'policies'
  | 'outline'
  | 'learning_plan'
  | 'outcomes'
  | 'course_map'
  | 'references';
```

Each record adds `syllabusId`, `revisionNo`, and `status: 'published'`.

- [ ] Define `RagSectionKey` in `contracts.ts` and a shared `getRagSyllabusRepository()` singleton in `runtime.ts`; both export and structured-read routes use this provider.
- [ ] Write failing repository tests for all sixteen keys using normalized fixtures.
- [ ] Add tests proving missing/empty child collections still yield the relevant key or an explicit empty section consistently with current behavior.
- [ ] Run focused tests; verify RED for the nine new keys and metadata.
- [ ] Extend the existing repository include graph only where needed; do not query excluded fields.
- [ ] Add deterministic public-only builders for institution, institutional statement, program outcomes, core values, graduate attributes, requirements, rubrics, learning plan, and course map.
- [ ] Preserve existing `description`, `outcomes`, `grading`, `policies`, `outline`, `references`, and `faculty` output and IDs.
- [ ] Add `syllabusId`, `revisionNo`, and `status` to every record.
- [ ] Run focused tests and server build.

### Task 2: Enrich RAG Export and Structured Syllabus Reads

**Files:**
- Modify: `server/src/routes/ragExport.ts`
- Test: `server/src/routes/ragExport.test.ts`
- Modify: `server/src/routes/ragAggregate.ts`
- Test: `server/src/routes/ragAggregate.test.ts`
- Modify: `server/src/syllabi/runtime.ts`

**Interfaces:**
- Export record shape:

```ts
{
  id: `${courseId}#${section_key}`,
  courseId: string;
  courseCode: string;
  courseTitle: string;
  syllabusId: string;
  revisionNo: number;
  status: 'published';
  section_key: RagSectionKey;
  section_text: string;
}
```

- Add logical structured table `course_syllabus` with fields `courseId`, `courseCode`, `courseTitle`, `syllabusId`, `revisionNo`, `sectionKey`, `sectionText`; filters `courseId`, `courseCode`, `sectionKey`.

- [ ] Write failing export tests for sixteen keys and excluded-field absence.
- [ ] Write failing structured-read tests for `course_syllabus` rows, published-only filtering, pagination, and safe fields.
- [ ] Implement a custom `course_syllabus` structured branch backed by `PrismaSyllabusRepository.getRagSections()` rather than adding raw Prisma models to the generic allowlist.
- [ ] Keep `recordIds` unsupported for this logical table initially because its identity is the composite `<courseId>#<section_key>`.
- [ ] Preserve `domain=courses`, `collection=course_syllabus`, stable IDs, and 1,500-character bounds.
- [ ] Run focused tests and server build.

### Task 3: Enrich Ingestion Metadata

**Files:**
- Live ingestion workflow `jZxyHAC2VdRVgAgc` only.

- [ ] Back up all live workflows.
- [ ] Update `Flatten to Documents` so `course_syllabus` records preserve metadata:

```json
{
  "domain": "courses",
  "collection": "course_syllabus",
  "record_id": "<courseId>#<section_key>",
  "course_id": "...",
  "course_code": "...",
  "syllabus_id": "...",
  "revision_no": 1,
  "status": "published",
  "section_key": "...",
  "is_junction": false,
  "source": "gabay-prototype:course_syllabus/<record_id>"
}
```

- [ ] Execute the persisted Code node against old and new record fixtures; prove old exports omit new fields and new exports retain them.
- [ ] PUT and fresh GET assert exact metadata construction.
- [ ] Do not delete/re-ingest Qdrant yet.

### Task 4: Add Dedicated Semantic Syllabus Tool

**Files:**
- Live main workflow `AtgiSrVPbqjgdZ9x` only.

- [ ] Back up the main workflow.
- [ ] Add `RAG: Syllabus` using `@n8n/n8n-nodes-langchain.vectorStoreQdrant`, typeVersion 1.3, mode `retrieve-as-tool`, collection `gabay_prototype_rag`, topK 30, existing Qdrant/embedding credentials.
- [ ] Set filter:

```json
{"must":[{"key":"metadata.metadata.collection","match":{"value":"course_syllabus"}}]}
```

- [ ] Connect it to Coordinator, Courses, and Learning agents only.
- [ ] Add tool description covering the sixteen public section keys.
- [ ] Update Courses record rules: institution, description/course info, faculty, institutional statement, policies, references.
- [ ] Update Learning record rules: outcomes, learning plan, grading, rubrics, outline, course map.
- [ ] Update Coordinator hybrid rule: syllabus + module/activity questions may call both tools.
- [ ] Update `Analytical_Count` valid collection guidance while preserving snapshot-completeness semantics.
- [ ] PUT and fresh GET assert node filter, exact three agent connections, and prompt ownership rules.

### Task 5: Re-Ingest and Verify Qdrant

**Files:**
- Temp evidence only.

- [ ] Confirm `/api/rag-export/courses` contains published sixteen-section records and zero draft/audit/source/extension fields.
- [ ] Run the existing manual ingestion webhook once; it performs the established delete-and-rebuild flow for `gabay_prototype_rag`. Do not activate the six-hour schedule.
- [ ] Verify collection health, total point count, and nonzero `course_syllabus` points.
- [ ] Scroll Qdrant read-only and assert:
  - all syllabus metadata has `status=published`;
  - all 16 section keys appear when the database has content;
  - no forbidden field names/values appear;
  - no duplicate `(courseId, section_key)` logical record IDs.
- [ ] If normalized syllabus tables are empty, stop and report; do not fall back to legacy JSON.

### Task 6: Semantic and Hybrid Evaluation

**Files:**
- Temp evidence only.

- [ ] Ask representative questions for outcomes, grading, policies, outline, references, institutional statement, and learning plan; verify retrieved section keys and content.
- [ ] Ask one hybrid syllabus + module/activity question; verify both `RAG: Syllabus` and the appropriate non-syllabus tool run.
- [ ] Ask one draft/private-data adversarial question; verify draft content is not retrievable.
- [ ] Run benchmark smoke, full server tests/build, lint, and root typecheck; classify unrelated failures.
- [ ] Append evidence to the plan SDD ledger; do not modify thesis numbers unless requested.
