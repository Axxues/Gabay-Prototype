# Structured RAG Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route rosters, directories, projections, and enumerations through deterministic safe structured queries, with semantic-discovery ID hydration for mixed queries.

**Architecture:** Extend the existing service-authenticated `/api/rag-aggregate` route with safe projections, deterministic ordering, pagination, and record-ID hydration. Reuse the existing n8n `RAG: Analytics` toolWorkflow and update Coordinator routing prompts so structured intent bypasses vector top-K while hybrid intent performs vector discovery followed by relational hydration.

**Tech Stack:** TypeScript, Express, Prisma, Vitest/Supertest, n8n REST API, n8n toolWorkflow, Qdrant payload metadata.

**Spec:** `docs/superpowers/specs/2026-09-25-structured-rag-routing-design.md`

## Global Constraints

- No raw SQL from the LLM.
- No arbitrary Prisma model or field selection.
- `submission` and `course_grade` remain forced to `requesterId` scope.
- `User.passwordHash` and other unsafe fields must never appear in structured responses.
- Listing response limit is 1-500; default 100.
- Pagination metadata must make truncation explicit.
- `recordIds` hydration is unsupported for composite-key tables and must fail closed.
- Do not modify the baseline workflow.
- Live n8n API key is read at runtime from `C:\Users\JV\AppData\Local\Temp\opencode\n8nkey.txt`; never print or commit it.
- Do not commit unless explicitly requested.

---

### Task 1: Safe Structured Row Contract

**Files:**
- Modify: `server/src/routes/ragAggregate.ts`
- Test: `server/src/routes/ragAggregate.test.ts`

**Interfaces:**
- Consumes: existing request `{ table, metric, filters, requesterId, field }`.
- Produces: request additions `fields?: string[]`, `limit?: number`, `offset?: number`; response `{ table, metric, value, count, hasMore, nextOffset }` for `rows`.

- [ ] **Step 1: Add failing tests for safe user projection**

Add a test posting:

```json
{
  "table": "user_directory",
  "metric": "rows",
  "filters": { "role": "student" },
  "fields": ["name", "role"],
  "limit": 100
}
```

Assert:

```ts
expect(res.status).toBe(200);
expect(res.body.value).toEqual(expect.any(Array));
expect(res.body.value.every((row) => !('passwordHash' in row))).toBe(true);
expect(Object.keys(res.body.value[0]).sort()).toEqual(['name', 'role']);
expect(res.body).toMatchObject({ count: expect.any(Number), hasMore: expect.any(Boolean) });
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test --workspace=server -- ragAggregate.test.ts`
Expected: FAIL because `fields`, `count`, `hasMore`, and `nextOffset` are unsupported and `rows` currently returns full records.

- [ ] **Step 3: Add per-table safe projections and deterministic ordering**

In `ragAggregate.ts`, extend each table definition with:

```ts
select: Record<string, true>;
orderBy: Record<string, 'asc' | 'desc'>[];
```

Required safe projections include:

```ts
user_directory: { id: true, name: true, role: true, department: true, title: true }
course: { id: true, code: true, title: true, section: true, instructorName: true, published: true, enrolledCount: true }
course_section: { id: true, courseId: true, name: true, capacity: true, enrolledCount: true, schedule: true, location: true }
enrollment_request: { id: true, courseId: true, studentId: true, studentName: true, type: true, status: true, requestedAt: true }
```

Learning tables use the safe fields already selected by `ragExport.ts`. Progress tables use safe grade/submission metadata and never return content/file bodies.

- [ ] **Step 4: Validate `fields`, `limit`, and `offset`**

Rules:

```ts
const limit = body.limit === undefined ? 100 : Number(body.limit);
const offset = body.offset === undefined ? 0 : Number(body.offset);
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw badRequest;
if (!Number.isInteger(offset) || offset < 0) throw badRequest;
```

`fields` must be an array of strings and every field must exist in the table's `select`; otherwise return 400. Missing `fields` uses the full safe projection.

- [ ] **Step 5: Implement paginated `rows` execution**

```ts
const rows = await delegate.findMany({
  where,
  select: requestedSelect,
  orderBy: def.orderBy,
  skip: offset,
  take: limit + 1,
});
const hasMore = rows.length > limit;
const value = hasMore ? rows.slice(0, limit) : rows;
res.json({
  table,
  metric,
  value,
  count: value.length,
  hasMore,
  nextOffset: hasMore ? offset + limit : null,
});
```

- [ ] **Step 6: Add tests for ordering, pagination, and unsafe fields**

Cover stable ordering, `limit=2` returning `hasMore=true`, `nextOffset=2`, offset continuation, and rejection of `passwordHash`.

- [ ] **Step 7: Run focused test and server typecheck**

Run:

```text
npm test --workspace=server -- ragAggregate.test.ts
npm run build --workspace=server
```

Expected: all focused tests pass; TypeScript build passes.

### Task 2: Record-ID Hydration

**Files:**
- Modify: `server/src/routes/ragAggregate.ts`
- Test: `server/src/routes/ragAggregate.test.ts`

**Interfaces:**
- Consumes: request addition `recordIds?: string[]`; only valid with `metric: "rows"`.
- Produces: exact Prisma rows for matching single-ID tables, preserving requester scope.

- [ ] **Step 1: Add failing hydration tests**

Test user hydration:

```json
{
  "table": "user_directory",
  "metric": "rows",
  "recordIds": ["<known-user-id>"],
  "fields": ["name", "role"]
}
```

Assert one exact row and no `passwordHash`.

Test composite-key rejection:

```json
{ "table": "course_grade", "metric": "rows", "recordIds": ["x"], "requesterId": "usr-stud-1" }
```

Assert 400 with `recordIds are unsupported for composite-key tables`.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because `recordIds` is ignored.

- [ ] **Step 3: Implement safe hydration**

Validate:

```ts
if (recordIds !== undefined) {
  if (metric !== 'rows') throw badRequest;
  if (!Array.isArray(recordIds) || recordIds.some((id) => typeof id !== 'string')) throw badRequest;
  if (def.idField !== 'id') throw badRequest;
  where[def.idField] = { in: [...new Set(recordIds)].slice(0, 500) };
}
```

Forced `requesterId` scope is applied after hydration filters, so it cannot be bypassed.

- [ ] **Step 4: Add unknown-ID and limit tests**

Assert unknown IDs return an empty array, never fabricated rows, and more than 500 IDs returns 400.

- [ ] **Step 5: Run focused tests and build**

Expected: all tests and build pass.

### Task 3: n8n Structured-Intent Routing

**Files:**
- Live n8n workflow `AtgiSrVPbqjgdZ9x` only.
- No repo workflow JSON.

**Interfaces:**
- Consumes: existing `RAG: Analytics` toolWorkflow and `Analytical_Count`.
- Produces: Coordinator/agent routing that classifies semantic vs structured intent.

- [ ] **Step 1: Back up live workflow JSON**

Write the current `GET /api/v1/workflows/AtgiSrVPbqjgdZ9x` response to `C:\Users\JV\AppData\Local\Temp\opencode\structured-rag-main-backup.json`.

- [ ] **Step 2: Update Coordinator and specialist prompts**

Add one concise routing block:

```text
STRUCTURED / RELATIONAL INTENT includes counts, rosters, directories, lists, projections, statuses, and attributes of multiple records. Call RAG_Analytics with metric=rows first; use Analytical_Count only when the question is about ingested snapshot completeness. Vector top-K is for semantic content only and is never a completeness source.
```

Hybrid rule:

```text
For semantic discovery plus exact attributes, use the domain vector tool to collect metadata.record_id values, then call RAG_Analytics with recordIds and safe fields to hydrate exact records.
```

- [ ] **Step 3: Extend RAG: Analytics tool description**

Document exact arguments: `metric=rows`, `fields`, `filters`, `limit`, `offset`, `recordIds`, and `requesterId`. State that service response includes `hasMore` and `nextOffset`.

- [ ] **Step 4: PUT workflow and verify persistence**

Use full `PUT /api/v1/workflows/AtgiSrVPbqjgdZ9x`, then GET and assert the new routing text and tool description are present.

### Task 4: End-to-End Verification

**Files:**
- Temp scripts only under `C:\Users\JV\AppData\Local\Temp\opencode\`.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified evidence for listings, hydration, pagination, and regression safety.

- [ ] **Step 1: Verify 60-user listing**

Ask for all users with name and role. Assert exactly 60 rows and all names match the ERP user directory.

- [ ] **Step 2: Verify 17-section listing**

Ask for all course sections with name and location. Assert 17 rows and no top-K loss.

- [ ] **Step 3: Verify pagination**

Request `user_directory` rows with `limit=10` through the n8n structured tool path. Assert `hasMore=true`, `nextOffset=10`, and continuation returns the next stable page.

- [ ] **Step 4: Verify hybrid hydration**

Run a semantic query over syllabus/proposal content, collect returned `record_id` values, hydrate them through RAG_Analytics, and assert displayed attributes match ERP.

- [ ] **Step 5: Run regression checks**

```text
python scripts/run-benchmark.py --smoke
npm test --workspace=server
npm run build --workspace=server
npm run lint --workspace=client
npm run typecheck
```

Expected: smoke 8/8, all server tests pass, build/typecheck/lint pass.

- [ ] **Step 6: Document outcome**

Append verified counts, latency impact, and any remaining limitations to `.superpowers/sdd/<plan>/progress.md`. Do not modify thesis numbers unless explicitly requested.

## Self-Review

- Spec coverage: structured routing -> Task 3; safe deterministic rows -> Task 1; hybrid hydration -> Task 2; verification -> Task 4.
- Security: projections, requester scope, no raw SQL, bounded inputs all covered.
- Type consistency: `fields`, `limit`, `offset`, `recordIds`, `count`, `hasMore`, `nextOffset` names are consistent across tasks.
- Placeholder scan: no TBD/TODO/unspecified implementation steps.
