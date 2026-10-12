# Canonical Structured Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make structured RAG replies use the exact n8n-generated canonical Markdown, independent of Coordinator rewriting.

**Architecture:** A new execution-artifact reader opens n8n SQLite once and returns both telemetry and canonical Analytics pages. The Express RAG route selects canonical Markdown when present, preserves normal conversational replies otherwise, and fails closed rather than presenting an LLM rewrite as canonical.

**Tech Stack:** TypeScript, Node SQLite (`node:sqlite`), Express, Vitest/Supertest, n8n execution data, live n8n REST API.

**Spec:** `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Section 1.

## Global Constraints

- Canonical Markdown is the source of truth for structured replies.
- Semantic-only replies remain unchanged.
- Multi-page results concatenate by ascending numeric offset.
- Duplicate visible rows are preserved exactly once per returned record.
- Hidden identity fields remain hidden.
- JWT redaction runs after canonical selection.
- If Analytics ran but canonical recovery fails, do not return the Coordinator rewrite as canonical.
- Baseline workflow and client rendering remain unchanged.
- Live n8n resources are backed up before PUT.
- No commit unless explicitly requested.

---

### Task 1: Canonical Execution Artifact Reader

**Files:**
- Create: `server/src/utils/n8nExecutionArtifacts.ts`
- Create: `server/src/utils/n8nExecutionArtifacts.test.ts`
- Reuse: `server/src/utils/n8nTelemetry.ts` types/reference decoding

**Interfaces:**
- Produces:

```ts
export interface CanonicalStructuredPage {
  table: string;
  offset: number;
  markdown: string;
  count: number;
  hasMore: boolean;
  nextOffset: number | null;
  executionId: number;
}

export interface CanonicalStructuredResult {
  kind: 'rows';
  version: 1;
  table: string;
  pages: CanonicalStructuredPage[];
  complete: boolean;
}

export interface N8nExecutionArtifacts {
  execution: TelemetryExecution | null;
  structured: CanonicalStructuredResult | null;
}

export function extractExecutionArtifacts(opts: {
  requestId?: string;
  sessionId?: string;
  dbPath?: string;
}): N8nExecutionArtifacts;
```

- [ ] Write failing fixtures for parent Analytics output, child-only output, running parent + successful child, multiple page offsets, unrelated earlier Analytics call, and missing/corrupt child.
- [ ] Run `npm test --workspace=server -- src/utils/n8nExecutionArtifacts.test.ts`; expect module-not-found/failing assertions.
- [ ] Implement read-only SQLite lookup by requestId/sessionId and recursive n8n reference decoding.
- [ ] Follow `metadata.subExecution.executionId` when the parent tool run is incomplete.
- [ ] Extract `Format Structured Rows` output and retain only table/metric=rows pages.
- [ ] Select the final request chain; sort pages by `offset`; compute `complete = pages.every(!hasMore)` and final `nextOffset === null`.
- [ ] Reuse telemetry extraction within the same SQLite read and return both artifacts from one lookup; opening the database twice is not allowed.
- [ ] Run focused tests and server build.

### Task 2: Persist Canonical Page Metadata in n8n

**Files:**
- Live Analytics workflow `eyaW0zc2LhAyEeLQ` only.

**Interfaces:**
- `Format Structured Rows` output adds `canonicalVersion: 1`, `offset`, `limit`, and `kind: 'rows'` while preserving all existing response fields.

- [ ] Back up the live workflow.
- [ ] Add a persisted Code-node regression showing missing `offset` on the current formatter output.
- [ ] Update `Format Structured Rows` to read `offset` and `limit` from the `Build Aggregate Body` node and emit canonical metadata.
- [ ] Execute the persisted Code node with offsets 0 and 10; verify exact output and no row changes.
- [ ] PUT workflow and fresh GET assert the code and metadata contract.
- [ ] Do not run user-facing E2E yet.

### Task 3: Canonical Override in Express

**Files:**
- Modify: `server/src/routes/rag.ts`
- Test: `server/src/routes/rag.test.ts`

**Interfaces:**
- Consumes: `extractExecutionArtifacts()`.
- Produces: optional response sidecar:

```ts
structured?: {
  kind: 'rows';
  table: string;
  complete: boolean;
  pageCount: number;
  nextOffset: number | null;
} | null;
```

- [ ] Write failing tests:
  - canonical 60-row Markdown overrides altered Coordinator text;
  - natural list request is not converted to bullets;
  - semantic-only response is unchanged;
  - pages concatenate in offset order;
  - JWT-shaped strings are redacted from canonical Markdown;
  - known Analytics + missing artifact returns structured-result-unavailable;
  - telemetry remains present.
- [ ] Run focused route tests; verify RED.
- [ ] Replace the separate telemetry lookup with `extractExecutionArtifacts()`.
- [ ] Select canonical pages before `normalizeReply` table-to-bullet conversion.
- [ ] Return canonical Markdown as `reply`, preserve chart/telemetry/session fields, and attach the optional sidecar.
- [ ] Throw a safe 503/502 ApiError when a structured call is known but canonical recovery fails.
- [ ] Run focused tests and server build.

### Task 4: Deterministic End-to-End Verification

**Files:**
- Temp evidence under `C:\Users\JV\AppData\Local\Temp\opencode\`.

- [ ] Run three consecutive 60-user listing requests; every visible reply must match the canonical 60-row artifact exactly.
- [ ] Run three consecutive 17-section requests; exact match each time.
- [ ] Run two pagination pages and verify ordered concatenation with no duplication/omission.
- [ ] Run one semantic question and verify Coordinator text is preserved.
- [ ] Run benchmark smoke and full server tests/build.
- [ ] Write evidence to the plan SDD ledger; no thesis changes.
