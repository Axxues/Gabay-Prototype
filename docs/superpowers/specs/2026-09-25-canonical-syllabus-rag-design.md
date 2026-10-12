# Canonical Structured Responses and Normalized Syllabus RAG Design

**Date:** 2026-09-25

## Goal

Guarantee exact user-visible output for structured RAG queries and bring public normalized syllabus content into semantic and structured RAG without exposing private, operational, or migration-only data.

## 1. Canonical Structured Response

### Problem

The structured service and n8n formatter already return deterministic rows, but the Coordinator LLM can still rewrite the final response. One verified run returned 61 rows after receiving the correct 60-row canonical result. Server normalization can also convert canonical tables to bullets.

### Architecture

Create `server/src/utils/n8nExecutionArtifacts.ts`. It reads the n8n SQLite execution store once and returns:

```ts
interface N8nExecutionArtifacts {
  execution: TelemetryExecution | null;
  structured: CanonicalStructuredResult | null;
}
```

The structured artifact contains ordered canonical pages:

```ts
interface CanonicalStructuredPage {
  table: string;
  offset: number;
  markdown: string;
  count: number;
  hasMore: boolean;
  nextOffset: number | null;
  executionId: number;
}
```

Extraction rules:

1. Locate the main execution by the server-generated `requestId`.
2. Inspect successful `RAG: Analytics` parent runs.
3. If parent output is absent or running, follow `metadata.subExecution.executionId` to the successful Analytics child.
4. Read the child's `Format Structured Rows` output.
5. Select the final Analytics chain for the request; ignore earlier unrelated structured calls in hybrid requests.
6. Sort pages by numeric `offset` and concatenate their exact markdown.
7. Preserve duplicates and source order.

`rag.ts` applies the canonical pages as `reply` whenever a structured artifact is present. Semantic-only replies continue through the Coordinator and normal normalization. Canonical markdown bypasses `convertMarkdownTablesToBullets` and all LLM presentation rewriting. JWT redaction still runs on the final visible text.

If a structured Analytics call is known but its canonical artifact cannot be recovered, the route returns a clear structured-result-unavailable error rather than silently treating the Coordinator rewrite as canonical.

The baseline workflow and client rendering remain unchanged.

## 2. Normalized Syllabus Public Scope

The relational migration adds 37 tables. RAG includes public instructional and institutional content only.

### Included logical sections

The published/current syllabus projection expands from seven to sixteen logical sections:

1. `institution`
2. `description` (course information; retained compatibility key)
3. `faculty`
4. `institutional_statement`
5. `program_outcomes`
6. `core_values`
7. `graduate_attributes`
8. `requirements`
9. `grading`
10. `rubrics`
11. `policies`
12. `outline`
13. `learning_plan`
14. `outcomes` (course outcomes; retained compatibility key)
15. `course_map`
16. `references`

Existing keys and record IDs remain backward compatible:

- `description`
- `outcomes`
- `grading`
- `policies`
- `outline`
- `references`
- `faculty`

New sections use new stable section keys while preserving the record-ID form:

```text
<courseId>#<section_key>
```

### Source tables

Public content is read from the current published syllabus through `PrismaSyllabusRepository`, including:

- `Syllabus`
- `SyllabusInstitution`
- `SyllabusCourseInfo`
- `SyllabusInstitutionalStatement`
- `SyllabusGradingSystem` and `SyllabusGradingComponent`
- `SyllabusFaculty`
- `SyllabusRequirement`
- `SyllabusPolicy`
- `SyllabusRubric` and `SyllabusRubricLevel`
- `SyllabusOutlineBlock` and `SyllabusOutlineTopic`
- `SyllabusLearningPlan` and its child tables
- `SyllabusCourseOutcome`
- `SyllabusCourseMap` and `SyllabusCourseMapProgramOutcome`
- `SyllabusReference`
- `ProgramOutcome`, `CoreValue`, `GraduateAttribute`, and their syllabus junctions

### Excluded content

The following never enter normal RAG:

- draft or archived syllabus revisions
- `SyllabusSourceDocument.fileDataUrl`, `legacyPayload`, and internal file links
- `SyllabusExtensionField.value`
- migration audit tables, checksums, error text, and operational counts
- `createdById`, `publishedById`, parent/internal IDs
- faculty user IDs, consultation details, schedules, rooms, and linked section IDs
- signatory names/titles
- raw internal syllabus/child IDs

## 3. Export and Qdrant Contract

`/api/rag-export/courses` continues to expose one logical pack:

```text
domain: courses
collection: course_syllabus
record_id: <courseId>#<section_key>
```

The existing n8n ingestion loop inserts the expanded records into `gabay_prototype_rag`; no new Qdrant collection is created.

Syllabus record metadata adds:

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
  "section_key": "outcomes",
  "is_junction": false,
  "source": "gabay-prototype:course_syllabus/<record_id>"
}
```

Public text is whitespace-normalized and bounded consistently with current syllabus export limits.

## 4. Semantic n8n Routing

### Dedicated syllabus tool

Add a live `RAG: Syllabus` Qdrant vector tool using the existing embeddings model and collection. It filters:

```json
{
  "must": [
    {
      "key": "metadata.metadata.collection",
      "match": { "value": "course_syllabus" }
    }
  ]
}
```

It is connected to:

- `Coordinator_Agent`
- `Courses_Agent`
- `Learning_Agent`

It is not connected to `People_Agent` or `Progress_Agent` unless a concrete cross-domain requirement is later approved.

### Domain ownership

- `Courses_Agent`: institution, course information, faculty, institutional statements, policies, references.
- `Learning_Agent`: outcomes, learning plan, grading, rubrics, outline, course map.
- `Coordinator_Agent`: direct semantic syllabus questions and hybrid questions requiring syllabus plus module/activity/content data.

Existing `RAG: Courses` and `RAG: Learning` tools remain responsible for their current non-syllabus collections. Syllabus content is not duplicated into the learning domain.

## 5. Structured Syllabus Queries

Semantic syllabus questions use `RAG: Syllabus`.

Exact lists and projections use `RAG_Analytics` only where a safe structured projection exists. The initial structured syllabus contract exposes public current-published content; drafts and private fields are filtered server-side. Composite-key junction tables are not exposed through single-ID `recordIds` hydration in this phase.

## 6. Error Handling

- No canonical artifact on a semantic request: normal conversational response.
- Canonical artifact present: use exact markdown and preserve optional structured metadata.
- Analytics call known but artifact recovery fails: return structured-result-unavailable; never fall back to an LLM-rewritten table.
- No published syllabus revision: return no published syllabus content; never use legacy JSON fallback when the relational pointer is authoritative.
- Qdrant unavailable: structured database tools may still serve exact lists; semantic syllabus questions report retrieval unavailable.
- Token redaction runs after canonical selection.

## 7. Testing

### Server

- Canonical artifact overrides an altered Coordinator reply.
- Natural listing requests preserve canonical GFM tables.
- Semantic-only replies remain unchanged.
- Multiple pages concatenate by offset with no duplication/omission.
- Missing/corrupt canonical artifact follows fail-closed behavior.
- JWT redaction applies to canonical markdown.
- Syllabus repository returns all sixteen public sections with published-only records.
- Excluded fields are absent from export.
- Existing seven section IDs remain stable.

### n8n

- `RAG: Syllabus` searches only `collection=course_syllabus`.
- Courses, Learning, and Coordinator receive the syllabus tool; People and Progress do not.
- `Courses_Agent` and `Learning_Agent` record rules reflect their syllabus subsections.
- `Analytical_Count` recognizes the expanded logical syllabus collection without counting private tables.
- Fresh GET and persisted Code-node tests prove filters, section routing, and canonical formatting.

### End-to-End

- Re-ingestion produces nonzero current syllabus points and correct metadata.
- Draft/audit/source/extension content is absent from Qdrant.
- Structured 60-user and 17-section responses are exact across repeated runs.
- Representative semantic questions retrieve normalized outcomes, grading, policies, and outline content.
- Hybrid syllabus + module/activity questions use both semantic tools appropriately.
- Full server tests/build, benchmark smoke, lint, and typecheck run; unrelated failures are reported separately.

## Scope Boundaries

- No raw 37-table Qdrant duplication.
- No audit, migration, source payload, extension, signatory, schedule, or consultation indexing.
- No baseline workflow redesign.
- No client redesign in the first implementation; the existing GFM renderer displays canonical tables.
- No commit unless explicitly requested.
