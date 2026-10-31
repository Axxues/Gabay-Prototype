# Syllabus Evaluation Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitize the university's syllabus evaluation checklist: a chair-built program-wide matrix template (Likha `gabay_syllabus_eval_matrix`), per-evaluator Y/N + comments forms, and a consolidated N-wins summary.

**Architecture:** Matrix template lives in a new Likha ERP collection (one row per program scope) with a localStorage read cache; evaluator responses extend `EvaluatorReview` inside the existing lifecycle records (localStorage + `syllabi` JSON sync); the consolidated summary is always computed on read. UI: a new chair-only tab (builder + progress), a reworked evaluator modal, and a shared checklist renderer.

**Tech Stack:** React 18 + TypeScript, Tailwind (shadcn-style tokens), vitest + testing-library, localStorage, Likha ERP (Directus) REST via existing `likhaRequest`.

**Spec:** `docs/superpowers/specs/2026-10-31-syllabus-evaluation-matrix-design.md` — the source of all template text, rules, and decided calls. Read it first; this plan does not repeat the default template's criteria text.

## Global Constraints

- All new files under `client/src/features/syllabus/` (feature-folder rule); anything consumed outside the feature is exported from `client/src/features/syllabus/index.ts`.
- Tailwind utility classes with existing tokens (`bg-card`, `text-foreground`, `border-border`, `bg-muted`, purple accent for governance); `AnimatedModal` from `shared/components/common/ModalPortal` for modals; lucide-react icons.
- Likha writes via existing `likhaRequest` (User-Agent handled); filters URL-encoded (`filter%5Bscope_id%5D%5B_eq%5D=`); never `PATCH /relations`.
- No new npm dependencies; no credentials in client code.
- Every task ends green: `npm test -- run <paths>` and `npm run typecheck` pass before the commit step.
- Test commands (from repo root): targeted `npm test -- run <file>`; full `npm test -- run`; types `npm run typecheck`; production build `npm run build`.

## Review Focus

Failure modes the spec implies but no single task's happy path exercises — each is pinned by a named test in its owning task:

1. Comment typed while criterion is marked Y → compliant flips to N and Y is disabled. Test: Task 7, `forces N when a comment exists`.
2. N marked with an empty comment → submission blocked with an inline error. Test: Task 9, `blocks submit when an N criterion lacks a comment`.
3. Two evaluators submitting near-simultaneously → both response sets survive sync (merge by `evaluatorId`, newest `reviewedAt` wins). Tests: Task 5 `merges concurrent evaluator submissions`, Task 13 e2e double-submit.
4. Template fetch 403/empty (collection or row missing) → default template used; nothing crashes. Test: Task 3 `returns null on 403/empty`.
5. Rapid double-click on Save / Evaluate submit → one row, one version bump, one submission. Tests: Task 8 `guards double save`, Task 9 `guards double submit`.

---

## File Structure

```
client/src/features/syllabus/
  types/lifecycle.ts                          # modify: matrix types + record fields
  utils/defaultMatrixTemplate.ts              # create: DEFAULT_EVALUATION_MATRIX
  utils/matrixSummary.ts                      # create: summarizeMatrix (pure)
  api/evaluationMatrixApi.ts                  # create: template CRUD + cache
  hooks/useSyllabusLifecycle.ts               # modify: snapshot/matrix params, merge, group field
  hooks/useEvaluationMatrix.ts                # create: template load/save/reset hook
  api/syllabusCollaborationApi.ts             # modify: matrixSnapshot in payload
  components/matrix/MatrixChecklistTable.tsx  # create: shared fill/readonly renderer
  components/matrix/MatrixBuilder.tsx         # create: template editor
  components/matrix/ConsolidatedMatrixModal.tsx # create: summary/individual viewer
  components/governance/EvaluatorReviewModal.tsx # modify: becomes the matrix form
  components/governance/DepartmentSyllabusTable.tsx # modify: Matrix row action
  components/creator/RevisionRemarksBanner.tsx # modify: optional matrix link
  SyllabusCreatorPage.tsx                     # modify: tab, wiring, hydration
  index.ts                                    # modify: exports
scripts/setup_eval_matrix_collection.py       # create: one-time backend setup
docs/... (tests colocated as *.test.ts(x) next to each file)
```

---

### Task 1: Matrix types + default template

**Files:**
- Modify: `client/src/features/syllabus/types/lifecycle.ts`
- Create: `client/src/features/syllabus/utils/defaultMatrixTemplate.ts`
- Test: `client/src/features/syllabus/utils/defaultMatrixTemplate.test.ts`

**Interfaces:**
- Produces (all later tasks): `MatrixCriterion { id: string; text: string }`, `MatrixSection { id: string; title: string; criteria: MatrixCriterion[] }`, `EvaluationMatrix { version: number; updatedAt: string; updatedBy?: string; sections: MatrixSection[] }`, `EvaluatorMatrixResponse { criterionId: string; compliant: boolean; comment?: string }`, `DEFAULT_EVALUATION_MATRIX: EvaluationMatrix`.
- `EvaluatorReview` gains `matrixResponses?: EvaluatorMatrixResponse[]`, `overallComments?: string`, `matrixVersion?: number`. `SyllabusDevelopmentRecord` and `SyllabusGroup` gain `matrixSnapshot?: EvaluationMatrix`.

- [ ] **Step 1: Write the failing test** `defaultMatrixTemplate.test.ts`: asserts `DEFAULT_EVALUATION_MATRIX.version === 1`; exactly 6 sections with ids `['format','part-1','part-2','part-3','part-4','part-5']`; per-section criteria counts `[7, 14, 6, 7, 1, 6]` (41 total); every criterion id is unique and non-empty; spot-check first/last criterion text starts with `Margins (1" on all sides)` and `Use: Chairperson, Program Dean, CCS`.
- [ ] **Step 2: Run** `npm test -- run client/src/features/syllabus/utils/defaultMatrixTemplate.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Add the types to `types/lifecycle.ts`; transcribe sections/criteria **verbatim from spec §"Default template"** with ids `fmt-1..fmt-7`, `p1-1..p1-14`, `p2-1..p2-6`, `p3-1..p3-7`, `p4-1`, `p5-1..p5-6`; `updatedAt: '2026-10-31T00:00:00.000Z'`.
- [ ] **Step 4: Run** test again — Expected: PASS. Also run `npm test -- run client/src/features/syllabus` (existing suites must stay green).
- [ ] **Step 5: Commit** `feat(syllabus): matrix types + default evaluation template`.

### Task 2: `summarizeMatrix` util

**Files:**
- Create: `client/src/features/syllabus/utils/matrixSummary.ts`
- Test: `client/src/features/syllabus/utils/matrixSummary.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `ConsolidatedComment { evaluatorName: string; comment: string }`, `ConsolidatedRow { criterionId: string; compliant: boolean | null; comments: ConsolidatedComment[] }`, `ConsolidatedSection { id: string; title: string; rows: ConsolidatedRow[] }`, `ConsolidatedMatrix { sections: ConsolidatedSection[]; overallComments: ConsolidatedComment[]; submittedCount: number; totalCount: number }`, `summarizeMatrix(snapshot: EvaluationMatrix, evaluators: EvaluatorReview[]): ConsolidatedMatrix`.

- [ ] **Step 1: Write the failing test.** Cases: (a) evaluator A all Y, evaluator B marks one criterion N with comment → that row `compliant === false`, others Y; (b) any submitted response with a comment but `compliant: true` still summarizes N (comment⇒N invariant); (c) two evaluators commenting the same criterion → both comments present, each attributed; identical comment from two evaluators appears once with two attributions? No — dedupe by `evaluatorName + comment` pair, keep both when names differ; (d) criteria with no submitted responses → `compliant === null`; (e) pending evaluators (status `'pending'` or missing `matrixResponses`) are excluded from rows but reflected in `submittedCount/totalCount`; (f) `overallComments` merges non-empty evaluator `overallComments` the same way; (g) empty `evaluators` → all rows null, counts 0/N.
- [ ] **Step 2: Run** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** pure function per the interface; a response counts as submitted only when its review's `status !== 'pending'` and `matrixResponses` is a non-empty array; row is `false` when any submitted response has `compliant === false` **or** a non-empty comment; `true` only when all submitted responses are compliant with no comments.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(syllabus): consolidated matrix summarizer (N-wins, attributed comment merge)`.

### Task 3: `evaluationMatrixApi` client module

**Files:**
- Create: `client/src/features/syllabus/api/evaluationMatrixApi.ts`
- Test: `client/src/features/syllabus/api/evaluationMatrixApi.test.ts`

**Interfaces:**
- Consumes: `likhaRequest`/`getValidToken` from `shared/api/likhaLmsApi` (same import path `syllabusCollaborationApi.ts` uses); Task 1 types.
- Produces: `matrixScopeId(department: string | undefined, collegeId: string): string` (trim, lowercase, spaces→`-`; falls back to `collegeId` when department is blank); `readCachedMatrix(scopeId): EvaluationMatrix | null` / `writeCachedMatrix(scopeId, matrix): void` (localStorage key `gabay_syllabus_eval_matrix:{scopeId}`); `fetchMatrixTemplate(scopeId): Promise<EvaluationMatrix | null>` (GET `/items/gabay_syllabus_eval_matrix?filter%5Bscope_id%5D%5B_eq%5D=<scope>&fields=id,scope_id,sections,version,updated_by_name,date_updated`; 403, network error, or empty list → `null`); `createMatrixTemplate(scopeId, matrix, updatedByName?): Promise<EvaluationMatrix | null>` (POST; payload `{ scope_id, sections: JSON string, version, updated_by_name }`; returns the stored matrix or `null`); `updateMatrixTemplate(id, matrix, updatedByName?): Promise<EvaluationMatrix | null>` (PATCH by row id). Save failures retry 3× on 5xx/408/429 (mirror `syllabusCollaborationApi.ts` retry loop); on success also write the localStorage cache.

- [ ] **Step 1: Write the failing test** mocking `likhaLmsApi` the same way `syllabusCollaborationApi.test.ts` does. Cases: `matrixScopeId('BSCS', 'c1') === 'bscs'`; `matrixScopeId('  ', 'c1') === 'c1'`; `fetchMatrixTemplate` maps a row `{sections: <json string>, version: 3}` to a parsed `EvaluationMatrix`; 403 → `null`; empty array → `null`; `createMatrixTemplate` POSTs the expected payload and caches on success; PATCH failure after retries → `null`; cache read of invalid JSON → `null`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per the interface.
- [ ] **Step 4: Run** — Expected: PASS; run the feature suite (`npm test -- run client/src/features/syllabus/api`) stays green.
- [ ] **Step 5: Commit** `feat(syllabus): evaluation matrix template API + cache`.

### Task 4: Likha collection setup script (one-time backend)

**Files:**
- Create: `scripts/setup_eval_matrix_collection.py`

**Interfaces:**
- Produces: collection `gabay_syllabus_eval_matrix` on the instance with fields `scope_id` (string, unique), `sections` (json), `version` (integer, default 1), `updated_by_name` (string), audit fields `date_created`/`user_created`/`date_updated`/`user_updated` + two relations to `system_users`; permissions mirrored from `syllabi`.
- Consumes: env `LIKHA_TOKEN`, base URL from env `LIKHA_URL` (default `https://gabay.zyberlab.com`).

- [ ] **Step 1: Implement** the script per the **likha-erp-api skill** protocols: `requests` with `User-Agent: curl/8.5.0` header; idempotency first — `GET /fields/gabay_syllabus_eval_matrix` succeeds → print "exists, skipping" and exit 0. Else: `POST /collections` (fields incl. `scope_id` with `schema.is_unique: true`); `POST /fields/{col}/<audit field>` × 4 (timestamp/uuid types, specials `date-created`/`user-created`/`date-updated`/`user-updated`, readonly + hidden); `POST /relations` × 2 (`user_created`/`user_updated` → `system_users`) — never `PATCH /relations`; then `GET /permissions?filter%5Bcollection%5D%5B_eq%5D=syllabi&limit=-1`, and for each row whose `action` is `read`/`create`/`update`, POST a matching permission row for the new collection (`presets: {"user_created": "$CURRENT_USER"}` on create); finally `POST /utils/cache/clear` `{"cache":"system"}`. Print each created resource id.
- [ ] **Step 2: Run** `python scripts/setup_eval_matrix_collection.py` (token from env) — Expected: creates the collection and prints ids; re-run → "exists, skipping".
- [ ] **Step 3: Verify remotely** `GET /items/gabay_syllabus_eval_matrix` returns `[]` (not 403) — the client's 403 fallback then only covers pre-setup states.
- [ ] **Step 4: Commit** `feat(backend): gabay_syllabus_eval_matrix collection setup script`.

### Task 5: Lifecycle hook extensions

**Files:**
- Modify: `client/src/features/syllabus/hooks/useSyllabusLifecycle.ts` (`assignEvaluators` :676, `submitEvaluatorReview` :711, `syncRemoteAgreements` :776, groups derivation)
- Test: `client/src/features/syllabus/hooks/useSyllabusLifecycle.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces (Task 6/9/13 rely on exact shapes): `assignEvaluators(groupId, evaluators, onPersist?, matrixSnapshot?: EvaluationMatrix)` — stores `matrixSnapshot` on the record; `submitEvaluatorReview(groupId, evaluatorId, status, remarks?, matrix?: { matrixResponses: EvaluatorMatrixResponse[]; overallComments?: string; matrixVersion?: number }, onPersist?)` — merges `matrix` into the matching review and stamps `reviewedAt`; new `ensureMatrixSnapshot(groupId, snapshot: EvaluationMatrix)` — sets `record.matrixSnapshot` only when absent, no status change, no persist callback; `syncRemoteAgreements(groupId, agreements, status?, evaluators?, matrixSnapshot?)` — **evaluator merge**: union by `evaluatorId`, on collision the review with the newer `reviewedAt` wins (missing `reviewedAt` loses), and it stores `matrixSnapshot` when provided (also in the record-create fallback at :816-828). Groups derivation (search `evaluators: r.evaluators` in the `useMemo` that builds `SyllabusGroup`s): add `matrixSnapshot: r.matrixSnapshot`.

- [ ] **Step 1: Write the failing tests** (extend existing file, reusing its harness): `assignEvaluators stores the matrix snapshot on the record`; `submitEvaluatorReview persists matrixResponses, overallComments and matrixVersion`; `syncRemoteAgreements merges concurrent submissions` — record has evaluator A submitted, remote sync brings B submitted + stale A (older `reviewedAt`) → record keeps new A and adds B; `syncRemoteAgreements stores matrixSnapshot`; `ensureMatrixSnapshot is a no-op when a snapshot exists`.
- [ ] **Step 2: Run** — Expected: new tests FAIL, existing pass.
- [ ] **Step 3: Implement** per the interfaces. Note `submitEvaluatorReview`'s status logic (:739-754) is unchanged.
- [ ] **Step 4: Run** `npm test -- run client/src/features/syllabus/hooks/useSyllabusLifecycle.test.ts` — Expected: PASS (all).
- [ ] **Step 5: Commit** `feat(syllabus): lifecycle hook carries matrix snapshot and per-evaluator responses`.

### Task 6: Remote payload round-trip + tab hydration

**Files:**
- Modify: `client/src/features/syllabus/api/syllabusCollaborationApi.ts` (`GroupDraftPayload` :5-14, `fetchRemoteDraft` both parse branches, `saveRemoteDraft` :173)
- Modify: `client/src/features/syllabus/SyllabusCreatorPage.tsx` (hydration effect near :114-139)
- Test: `client/src/features/syllabus/api/syllabusCollaborationApi.test.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 5 `syncRemoteAgreements` signature.
- Produces: `GroupDraftPayload.matrixSnapshot?: EvaluationMatrix`; `saveRemoteDraft(canonicalCourseId, syllabusData, lastUpdatedBy?, lastUpdatedBySessionId?, submissionAgreements?, status?, evaluators?, matrixSnapshot?)` (8th optional param); `fetchRemoteDraft` returns `payload.matrixSnapshot` when present (both parse branches).

- [ ] **Step 1: Write the failing tests** in `syllabusCollaborationApi.test.ts`: `saveRemoteDraft includes matrixSnapshot in the PATCH body`; `fetchRemoteDraft returns matrixSnapshot from the stored content` (and from the fallback query branch).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the payload changes.
- [ ] **Step 4: Implement tab hydration in `SyllabusCreatorPage.tsx`:** a `hydratedGroupsRef = useRef<Set<string>>` plus an effect on `[activeTab, groups]` that — for groups visible in the active tab (`governance`/`matrix`: all; `evaluations`: `myEvaluationGroups`) whose `status` is `under_evaluation`, `revisions_required`, or `evaluator_approved`, and not yet in the ref — calls `fetchRemoteDraft(group.courseIds[0])` then `syncRemoteAgreements(group.id, payload.submissionAgreements || {}, payload.status, payload.evaluators, payload.matrixSnapshot)`. Never fires on the studio route's existing one-shot effect.
- [ ] **Step 5: Run** targeted suites (`syllabusCollaborationApi.test.ts`, `SyllabusCreatorPage.test.tsx`) — Expected: PASS.
- [ ] **Step 6: Commit** `feat(syllabus): matrix snapshot rides remote drafts; tab-level hydration`.

### Task 7: `MatrixChecklistTable` shared renderer

**Files:**
- Create: `client/src/features/syllabus/components/matrix/MatrixChecklistTable.tsx`
- Test: `client/src/features/syllabus/components/matrix/MatrixChecklistTable.test.tsx`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `interface MatrixChecklistTableProps { sections: MatrixSection[]; mode: 'fill' | 'readonly'; responses?: Record<string, EvaluatorMatrixResponse>; onCriterionChange?(criterionId: string, patch: { compliant?: boolean; comment?: string }): void }`.

- [ ] **Step 1: Write the failing tests.** Fill mode: renders every section title and criterion text; clicking Y then typing a comment forces the row's compliant to false (assert via `onCriterionChange` payload `{compliant: false, comment: '...'}`) and the Y button becomes disabled; clearing the comment re-enables Y; clicking N then changing emits `{compliant: false}`; a row whose response has `compliant: false` and empty comment shows the hint `Comment required for non-compliant criteria`. Readonly mode: no inputs/buttons render; a `compliant: false` row shows N and its comment text; `compliant: null` shows `—`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Hand-rolled `<table>` with Tailwind tokens (mirror `DepartmentSyllabusTable` styling); the comment⇒N rule lives here: when the incoming/typed comment is non-empty, emit `compliant: false` regardless of prior state.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(syllabus): shared matrix checklist renderer with comment-forces-N rule`.

### Task 8: `useEvaluationMatrix` hook

**Files:**
- Create: `client/src/features/syllabus/hooks/useEvaluationMatrix.ts`
- Test: `client/src/features/syllabus/hooks/useEvaluationMatrix.test.ts`

**Interfaces:**
- Consumes: Task 3 API fns, `DEFAULT_EVALUATION_MATRIX`.
- Produces: `useEvaluationMatrix(department: string | undefined, collegeId: string, userName?: string)` returning `{ template: EvaluationMatrix; loading: boolean; remoteId: string | null; saveTemplate(sections: MatrixSection[]): Promise<boolean>; resetTemplate(): Promise<boolean>; getSnapshotForAssign(): Promise<EvaluationMatrix> }`. Load order on mount: cache → `fetchMatrixTemplate` (remote wins only if its `version` > cached) → `DEFAULT_EVALUATION_MATRIX` seed. `saveTemplate` bumps `version` +1, sets `updatedAt: new Date().toISOString()`, `updatedBy: userName`; creates when `remoteId === null`, patches otherwise; `false` on failure (template state keeps the local edit). `resetTemplate` saves `DEFAULT_EVALUATION_MATRIX.sections` with a version bump. `getSnapshotForAssign` = current `template` if remote-fresh, else resolves cache→remote→default (never throws).

- [ ] **Step 1: Write the failing tests** (mock the api module): seeds default when cache and remote are empty; remote wins when newer; `saveTemplate` creates then updates (assert version increments 1→2 and the create/update call switch); `resetTemplate` saves default sections with version bump; `guards double save` — two rapid `saveTemplate` calls while the first is in flight → second resolves `false` and only one network write happens; `getSnapshotForAssign falls back to default on 403`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per the interface.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(syllabus): evaluation matrix template hook with versioned save/reset`.

### Task 9: Evaluator form rework + page wiring

**Files:**
- Modify: `client/src/features/syllabus/components/governance/EvaluatorReviewModal.tsx`
- Modify: `client/src/features/syllabus/SyllabusCreatorPage.tsx` (evaluations tab click :1127-1134, `EvaluatorReviewModal` call :1192-1226, `AssignEvaluatorsModal` `onConfirm` :1165-1188, imports)
- Test: `client/src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx`; update `SyllabusCreatorPage.lifecycle.test.tsx`

**Interfaces:**
- Consumes: Tasks 1/5/7/8.
- Produces: `EvaluatorReviewModalProps { isOpen; groupId; courseCode; snapshot: EvaluationMatrix | null; onClose(): void; onReview(groupId, status: 'approved' | 'revisions_requested', remarks: string | undefined, matrix: { matrixResponses: EvaluatorMatrixResponse[]; overallComments?: string; matrixVersion?: number }): void }`.

- [ ] **Step 1: Write the failing modal tests** (rewrite the existing suite; keep the harness): renders all snapshot criteria; `blocks submit when an N criterion lacks a comment` — mark one N, click Request Revisions → inline error, no `onReview` call; `Approve is disabled while any criterion is N or commented`; `Approve with all Y emits compliant responses` — asserts the `matrix.matrixResponses` array has one entry per criterion with `compliant: true` and `matrixVersion === snapshot.version`; `guards double submit` — second click while first handler pending emits once; overall-comments textarea value lands in `matrix.overallComments`; `snapshot: null` renders the legacy remarks-only flow (backward compatibility for the brief unseeded moment).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement the modal:** `AnimatedModal` shell kept; body = `MatrixChecklistTable mode="fill"` + overall "Comments and Suggestions" textarea + existing action row (Cancel / Request Revisions / Approve). Approve disabled unless every criterion is compliant with no comments; Request Revisions requires remarks (existing rule) and zero uncommented N's.
- [ ] **Step 4: Wire the page.** Evaluations tab: on Evaluate click, resolve `record = getRecord(group.id)`; `snapshot = record?.matrixSnapshot ?? template` (from `useEvaluationMatrix`); if `!record?.matrixSnapshot` call `ensureMatrixSnapshot(group.id, snapshot)` first. Pass `snapshot` into the modal; in `onReview` compute the full post-submit evaluators array (map `evaluatorReviewGroup.evaluators`, replace the current user's review with `{...mine, status, remarks, reviewedAt: now, ...matrix}`) and pass it to **both** `submitEvaluatorReview(..., matrix, persistCb)` and `saveRemoteDraft(..., status === 'approved' ? 'evaluator_approved' : 'revisions_required', nextEvaluators, snapshot)` — this fixes the existing remote-wipe bug (:1206-1213) and is covered by Review Focus #3/#5. Assign `onConfirm`: make it async; `const snapshot = await getSnapshotForAssign();` then `assignEvaluators(groupId, evaluators, persistCb, snapshot)` and `saveRemoteDraft(..., evaluators.map(...), snapshot)`.
- [ ] **Step 5: Update** `SyllabusCreatorPage.lifecycle.test.tsx` call sites to the new signatures; run `npm test -- run client/src/features/syllabus/components/governance client/src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(syllabus): evaluator matrix form with approve gating and submit-persist fix`.

### Task 10: `ConsolidatedMatrixModal`

**Files:**
- Create: `client/src/features/syllabus/components/matrix/ConsolidatedMatrixModal.tsx`
- Test: `client/src/features/syllabus/components/matrix/ConsolidatedMatrixModal.test.tsx`

**Interfaces:**
- Consumes: Tasks 2/7.
- Produces: `interface ConsolidatedMatrixModalProps { isOpen: boolean; courseCode: string; instructorNames: string[]; snapshot: EvaluationMatrix; evaluators: EvaluatorReview[]; onClose(): void }`. Exported from the feature barrel (Task 10 step 4).

- [ ] **Step 1: Write the failing tests:** header shows course code, instructor names, and the latest `reviewedAt` date; view toggle `Consolidated | <Evaluator name>` per submitted evaluator; consolidated view renders N rows with merged attributed comments (assert one N row from Task 2 fixture data) and pending rows as `—`; switching to an individual view shows only that evaluator's responses; `Comments and Suggestions` block renders merged overall comments.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement:** `summarizeMatrix(snapshot, evaluators)` → map each `ConsolidatedRow` to a fake `EvaluatorMatrixResponse` and render via `MatrixChecklistTable mode="readonly"`; individual view filters that evaluator's `matrixResponses`. Panel: `AnimatedModal`, `max-w-3xl`.
- [ ] **Step 4: Run** — Expected: PASS; add `ConsolidatedMatrixModal`, `summarizeMatrix`, and the matrix types to `client/src/features/syllabus/index.ts` (`MatrixBuilder` is exported in Task 11); `npm run typecheck` green.
- [ ] **Step 5: Commit** `feat(syllabus): consolidated evaluation matrix viewer`.

### Task 11: Evaluation Matrix tab (builder + progress)

**Files:**
- Create: `client/src/features/syllabus/components/matrix/MatrixBuilder.tsx`
- Test: `client/src/features/syllabus/components/matrix/MatrixBuilder.test.tsx`
- Modify: `client/src/features/syllabus/SyllabusCreatorPage.tsx` (tab union :81-84, tab bar :820-869, new content block after governance block :961)

**Interfaces:**
- Consumes: Tasks 1/8/10.
- Produces: `interface MatrixBuilderProps { template: EvaluationMatrix; saving: boolean; onSave(sections: MatrixSection[]): void; onReset(): void }`.

- [ ] **Step 1: Write the failing builder tests:** renders existing sections/criteria as editable inputs; editing a criterion text and Save emits `onSave` with the edited text; `add criterion` appends with a unique id; `remove criterion`/`remove section` (section removal only when it has no criteria? no — always allowed, with its criteria); section/criteria reorder via up/down buttons emits reordered array; Reset requires the second click on `Confirm Reset` before `onReset` fires; `guards double save` — Save disabled while `saving`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `MatrixBuilder`** (local editing state seeded from `template`; up/down reorder buttons, not drag).
- [ ] **Step 4: Wire the tab.** Union gains `'matrix'`; pill button (icon `ListChecks`) rendered `{isChair && …}` after the governance button; content block: Section A = `<MatrixBuilder …>` fed by `useEvaluationMatrix(activeUser?.department, activeUser?.collegeId || '', activeUser?.name)`, `onSave={s => void saveTemplate(s)}` with a success `showAlert`; Section B = list of `groups.filter(g => (g.evaluators?.length ?? 0) > 0)` — course code, per-evaluator submitted/pending chips, `View Consolidated Matrix` button opening `ConsolidatedMatrixModal` (snapshot: `getRecord(g.id)?.matrixSnapshot ?? template`).
- [ ] **Step 5: Add a page test** in `SyllabusCreatorPage.test.tsx`: chair sees the tab; faculty user does not.
- [ ] **Step 6: Run** targeted suites + `npm run typecheck` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(syllabus): chair Evaluation Matrix tab with template builder and progress`.

### Task 12: Governance "Matrix" action + revision banner link

**Files:**
- Modify: `client/src/features/syllabus/components/governance/DepartmentSyllabusTable.tsx` (actions column :417-483, props interface)
- Modify: `client/src/features/syllabus/components/creator/RevisionRemarksBanner.tsx`
- Modify: `client/src/features/syllabus/SyllabusCreatorPage.tsx` (pass new props; render modal from governance tab)
- Test: `client/src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx`; new `RevisionRemarksBanner.test.tsx` (none exists)

**Interfaces:**
- Consumes: Task 10 modal.
- Produces: `DepartmentSyllabusTable` optional prop `onOpenMatrix?: (group: SyllabusGroup) => void` — button `Matrix` rendered in the row actions when `group.evaluators.length > 0 && onOpenMatrix`; `RevisionRemarksBanner` optional props `matrixSnapshot?: EvaluationMatrix` — when present, renders a `View Evaluation Matrix` button that opens `ConsolidatedMatrixModal` internally (state local to the banner; `evaluators` prop it already has supplies the data).

- [ ] **Step 1: Write the failing tests.** Table: `Matrix` action visible for a group with evaluators and hidden without; click calls `onOpenMatrix(group)`. Banner: without `matrixSnapshot` no button renders; with one, the button renders and opens the modal showing the snapshot's first criterion text.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** both, plus page wiring: `matrixViewingGroup` state; `onOpenMatrix={group => setMatrixViewingGroup(group)}`; modal rendered with `snapshot={getRecord(group.id)?.matrixSnapshot ?? template}`. Locate the `RevisionRemarksBanner` usage (grep `RevisionRemarksBanner` — it renders in the studio) and pass `matrixSnapshot={activeRecord?.matrixSnapshot}` from the nearest record-bearing point (thread a new optional prop through `SyllabusWizard` only if the record isn't already in scope there).
- [ ] **Step 4: Run** targeted suites — Expected: PASS.
- [ ] **Step 5: Commit** `feat(syllabus): matrix action in governance table and revision feedback link`.

### Task 13: E2E flow + full verification

**Files:**
- Modify: `client/src/features/syllabus/SyllabusLifecycleE2E.test.tsx`

**Interfaces:**
- Consumes: everything above (no new surfaces).

- [ ] **Step 1: Write the failing e2e test** (extend the existing lifecycle e2e, reusing its setup): chair assigns two evaluators on a submitted group → record carries `matrixSnapshot` with `version === 1`; evaluator A fills all Y and Approves; evaluator B marks one N with comment `Font size is 10` and Requests Revisions with remarks → record status `revisions_required`, instructor agreements reset; chair's consolidated view shows the N row with B's comment attributed; instructor's studio shows the revision banner with the `View Evaluation Matrix` button; after instructor resubmission and evaluator re-review all Y → `evaluator_approved`. Add a double-submit case per Review Focus #3/#5 (fire B's submit twice rapidly via the WS-consensus path → A's and B's responses both intact).
- [ ] **Step 2: Run** — Expected: FAIL, then implement only what the test legitimately exposes (bug fixes, no new features).
- [ ] **Step 3: Full verification:** `npm test -- run` (entire repo suite green), `npm run typecheck`, `npm run build`.
- [ ] **Step 4: Pressure pass:** with the dev server + two browser profiles — concurrent evaluator submits from two sessions; template save racing an evaluator fetch; 40+ criteria matrix render (add a temporary section via builder, then remove); localStorage disabled (devtools block) → default template fallback with no console errors. Zero console errors throughout.
- [ ] **Step 5: Commit** `test(syllabus): evaluation matrix lifecycle e2e + pressure verification`.
