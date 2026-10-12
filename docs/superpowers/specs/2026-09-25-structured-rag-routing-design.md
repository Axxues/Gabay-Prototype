# Structured RAG Routing and Entity Hydration Design

**Date:** 2026-09-25

## Goal

Separate semantic retrieval from structured record retrieval so GABAY can return complete rosters and entity listings beyond any vector top-K ceiling, while preserving hybrid semantic-discovery queries through ID hydration.

## Root Cause

Low and inconsistent Data Consistency Rate results were not one defect. They came from three layers:

1. **Wrong retrieval primitive:** enumeration, roster, and projection requests were routed through vector top-K, which truncates and cannot guarantee completeness.
2. **Unsafe structured-row contract:** `/api/rag-aggregate` supports `rows`, but returns full Prisma rows, silently caps at 50, has no deterministic order, and can expose sensitive fields such as `User.passwordHash`.
3. **LLM compliance variance:** the Coordinator occasionally mixed filters, invented date boundaries, or returned partially retrieved records even when the correct scroll data was available.

The prototype's Qdrant collection currently has 1,174 points, so top-K 50/60 is below the full dataset. Raising top-K only moves the truncation ceiling and enlarges every prompt.

## Architecture

### 1. Structured-intent routing

The Coordinator classifies requests into two lanes:

- **Semantic intent:** concepts, syllabus context, policy explanation, prose retrieval. Route to the domain Qdrant vector tools.
- **Structured intent:** rosters, directories, counts, statuses, projections, lists, attributes of multiple records. Route first to deterministic structured tools; never use top-K as the source of truth.

Prompt wording changes from "analytical intent" to **"structured / relational intent"** and explicitly includes lists, rosters, projections, and attributes.

### 2. Safe deterministic structured reads

Extend `POST /api/rag-aggregate` rather than adding raw SQL access.

For `metric: "rows"`:

- Use a server-defined safe projection per allowlisted table.
- Optionally accept `fields`, restricted to that table's safe projection.
- Apply deterministic table-specific ordering.
- Support `limit` and `offset`, with maximum 500 rows per response.
- Return `{ table, metric, value, count, hasMore, nextOffset }` so truncation is explicit.
- Never return `passwordHash`, raw content blobs, submission bodies, or other sensitive fields.
- Preserve forced requester scoping for `submission` and `course_grade`.

### 3. Two-stage retrieve-and-hydrate

For mixed queries that need semantic discovery but relational attributes:

1. Qdrant vector tools discover relevant documents and expose `metadata.record_id`.
2. The agent collects matching record IDs.
3. `/api/rag-aggregate` receives `recordIds` plus the target table and safe fields.
4. The server hydrates exact records from Prisma and returns them in deterministic order.

`recordIds` is supported only for tables with a single `id` field. Composite-key tables such as `course_grade` fail closed for hydration until a composite-key contract is explicitly designed.

### 4. n8n tools

Reuse and extend existing tools:

- **Analytical_Count** remains the complete Qdrant-scroll path for ingested snapshot rows.
- **RAG_Analytics** is extended to call safe Prisma `rows` with `fields`, `limit`, `offset`, and `recordIds`.
- New prompt rules require structured tools first for list-all/enumeration requests.
- Hybrid queries use vector discovery followed by RAG_Analytics hydration.

No new subworkflow is required for the first implementation: the existing `RAG: Analytics` subflow already calls `/api/rag-aggregate` with the stored service credential.

## Safety and Consistency

- Service-key authentication remains the trust boundary for n8n calls.
- Per-student tables continue to derive scope from `requesterId`; requester-supplied student filters cannot override the forced scope.
- Public directory projections never expose credentials or private fields.
- Pagination metadata prevents silent truncation.
- Snapshot-fingerprint verification continues to guard SQL-comparator evaluation against ERP drift.

## Testing

### Server

- Projection excludes `passwordHash` and unsafe fields.
- Unknown table/field requests return 400.
- Deterministic ordering and pagination.
- `hasMore` and `nextOffset`.
- Per-student scope cannot be overridden.
- `recordIds` hydration returns exact records.
- Unknown or invalid IDs return no fabricated rows.

### n8n contract

- Structured listing tool receives valid table, fields, limit, and filters.
- Hybrid discovery passes record IDs into hydration.
- Coordinator prompt routes enumerations to structured tools before vector search.

### End-to-end

- 60-user directory listing returns all 60 records without top-K truncation.
- 17-section listing returns all sections.
- Course roster with more than 50 rows paginates visibly.
- Existing benchmark smoke remains green.

## Scope Boundaries

- No raw SQL from the LLM.
- No arbitrary Prisma model or field selection.
- No composite-key hydration in the first slice.
- No baseline workflow changes.
- No commit unless explicitly requested.
