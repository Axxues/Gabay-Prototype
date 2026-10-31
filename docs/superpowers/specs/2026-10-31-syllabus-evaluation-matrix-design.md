# Syllabus Evaluation Matrix — Design

Date: 2026-10-31
Status: Draft for approval
Feature area: `client/src/features/syllabus` (governance / evaluation flow)

## Intent & Why

After a faculty submits a syllabus, the department chairperson assigns evaluators. Today an evaluator's review is a single remarks textbox plus an Approve / Request Revisions decision — no structured criteria. The university actually evaluates syllabi with a paper checklist ("Syllabus and Inventory of Learning Resources Preparation Checklist") that has three columns: **CRITERIA | Compliant (Y/N) | COMMENTS**.

We digitize that checklist: the chair builds a program-wide **Evaluation Matrix** (pre-loaded with the university checklist, editable), every assigned evaluator fills **their own copy** of it per syllabus, and once all evaluators submit, their responses **summarize into one consolidated matrix** (N wins, comments merged) that becomes the evaluation record and the instructors' revision feedback.

## Goals

- New chair-only **"Evaluation Matrix"** tab on the Syllabus Development page with a matrix builder.
- Default template **pre-loaded from the university checklist** (full transcription below), fully editable (add/edit/remove sections and criteria), with reset-to-default.
- One matrix template **per department (program), shared by all evaluators** in that program.
- Per-evaluator matrix response per syllabus under evaluation: Y/N + comment per criterion, plus overall "Comments and Suggestions".
- Entry rule: **a criterion with a comment is forced to N**.
- Summarization when **all** evaluators submitted: per criterion **N beats Y**; comments merged (attributed when multiple); overall comments merged.
- Approve gating: an evaluator can only Approve when their own matrix has **zero N marks**; any N forces Request Revisions.
- Consolidated matrix visible to chair (and dean read-only), and surfaced to instructors as revision feedback when `revisions_required`.

## Non-goals

- Only one new backend collection (`gabay_syllabus_eval_matrix`); evaluator responses keep riding the existing `syllabi` JSON-content pattern with no schema changes there.
- No e-signature capture; evaluator identity + timestamp recorded digitally instead of the paper signature block.
- No scoring/weights/points — strictly the Y/N + comments model of the paper form.
- No per-criterion file attachments or screenshots.

## Anti-goals (failure even if it technically works)

- Evaluators overwriting each other's answers (responses must stay per-evaluator).
- A syllabus under evaluation silently changing criteria mid-review (template edits must not distort in-flight evaluations — snapshot on assign).
- Consolidated summary drifting from the individual responses it was derived from (summary is always computed on read, never stored as a second source of truth).
- Faculty-facing privilege escalation or new service credentials (existing JWT-based roles only).

## Constraints

- Feature-based folder architecture (AGENTS.md): everything lives inside `client/src/features/syllabus/`; new shared primitives go to `client/src/shared/` only if domain-agnostic; barrel `index.ts` exports for anything consumed outside the feature.
- Token-efficiency: smallest complete diff; reuse `AnimatedModal`, existing Tailwind/shadcn-style tokens, existing lifecycle hook patterns.
- Matrix template persistence: dedicated Likha ERP collection `gabay_syllabus_eval_matrix` (see Backend setup), set up strictly per the `likha-erp-api` skill protocols. Evaluator responses keep the existing dual pattern: localStorage primary, Likha `syllabi` JSON `content` sync (PATCH-then-POST fallback, retry on 5xx/408/429, `User-Agent` handled by existing `likhaRequest`).
- Zero runtime console errors; 100% green test suites; pressure-test concurrency and network failure paths (AGENTS.md production-readiness).

## Approaches considered

1. **Template in the existing `syllabi` JSON pattern (superseded).** Matrix template rides in localStorage + Likha `syllabi` JSON like evaluator assignments. Initially chosen for smallest diff; **replaced by user decision** with a dedicated collection.
2. **Dedicated Likha ERP collection for the matrix template (CHOSEN).** New collection `gabay_syllabus_eval_matrix` (app-prefix convention), one row per program scope; the chair **creates** the matrix row on first save and PATCHes updates. Evaluator responses keep riding the existing lifecycle records (localStorage + `syllabi` JSON) — they are per-syllabus, per-evaluator, and need no table of their own. *Why: a first-class, role-governed backend entity makes the program template durable and authoritative; responses stay in the already-synced records.*
3. **Persist the computed consolidated summary** when the last evaluator submits. Rejected for now (second source of truth); the summary stays computed-on-read.
4. **Fully normalized schema** (`matrix` + `sections` + `criteria` collections with O2M relations). Rejected: the template is small, read-as-a-whole, rarely edited — a JSON `sections` column on one row captures it with a fraction of the schema surface and none of the relation pitfalls.

## Decided design

### Data model — `client/src/features/syllabus/types/lifecycle.ts`

```ts
export interface MatrixCriterion {
  id: string;          // stable id, e.g. 'fmt-1', 'p1-4', 'p5-2'
  text: string;        // criterion text incl. examples
}
export interface MatrixSection {
  id: string;          // e.g. 'format', 'part-1' ...
  title: string;       // 'FORMAT', 'Part I', ...
  criteria: MatrixCriterion[];
}
export interface EvaluationMatrix {
  version: number;     // bumped on every chair save
  updatedAt: string;   // ISO
  updatedBy?: string;  // chair name/id
  sections: MatrixSection[];
}

export interface EvaluatorMatrixResponse {
  criterionId: string;
  compliant: boolean;  // Y/N
  comment?: string;
}

export interface EvaluatorReview {
  evaluatorId: string;
  evaluatorName: string;
  status: 'pending' | 'approved' | 'revisions_requested';
  remarks?: string;
  reviewedAt?: string;
  // NEW:
  matrixResponses?: EvaluatorMatrixResponse[]; // one per criterion in the snapshot
  overallComments?: string;                    // "Comments and Suggestions"
  matrixVersion?: number;                      // template version answered against
}
```

Add to `SyllabusDevelopmentRecord`: `matrixSnapshot?: EvaluationMatrix` (copied from the program template at assign time).

### Persistence

- **Template (per program):** Likha ERP collection **`gabay_syllabus_eval_matrix`**, one row per program scope (`scope_id = normalize(activeUser.department || activeUser.collegeId)`). The chair **creates the row on first save** (POST) and PATCHes subsequent edits; each save bumps `version`. localStorage key `gabay_syllabus_eval_matrix:{scopeId}` becomes a read cache / offline fallback only — the collection row is the source of truth. When no row exists yet, the builder UI works against the seeded **default template** (below) in local draft state; it is only persisted to Likha when the chair saves.
- **Template API:** new module `client/src/features/syllabus/api/evaluationMatrixApi.ts`: `GET /items/gabay_syllabus_eval_matrix?filter%5Bscope_id%5D%5B_eq%5D=...` (URL-encoded filter; a missing collection and a missing row both surface as 403/empty → treat as "no matrix yet"); POST on first save, PATCH afterwards; retry on 5xx/408/429 per `likhaLmsApi` conventions.
- **Responses:** ride on `EvaluatorReview` inside the existing lifecycle records — localStorage `gabay_syllabus_lifecycle_records` + `GroupDraftPayload.evaluators` (already `any[]`) via `saveRemoteDraft`. **Verified sync gaps this feature must fix** (builder check):
  - the evaluator-submit persist call (`SyllabusCreatorPage.tsx` ~:1206) currently omits the `evaluators` argument, wiping the remote array on every submission — pass the post-submit evaluators array;
  - `syncRemoteAgreements` replaces the evaluators array wholesale (last-write-wins) — merge by `evaluatorId`, newest `reviewedAt` wins, so concurrent submissions never overwrite each other;
  - `matrixSnapshot` is record-level and absent from `GroupDraftPayload` — add it (and read it back in `fetchRemoteDraft`) so evaluators on other sessions render the same form;
  - hydration currently runs only on the studio route — the governance, Evaluation Matrix, and My Evaluations tabs must fetch-and-sync remote drafts on mount for their visible groups.

## Backend setup (one-time — follow the `likha-erp-api` skill protocols)

Performed programmatically via the API during implementation, never ad-hoc; writes carry a conventional User-Agent (existing `likhaRequest` does this):

1. `POST /collections` → `gabay_syllabus_eval_matrix` with fields:
   - `scope_id` — string, `schema.is_unique: true` (holds the chair's program scope: normalized `activeUser.department || activeUser.collegeId` — department-first so two program chairs in one college never clobber each other; college fallback when department is blank)
   - `sections` — json (array of `{id, title, criteria: [{id, text}]}`)
   - `version` — integer, default 1
   - `updated_by_name` — string (display convenience)
   - Explicit audit fields `date_created`, `user_created`, `date_updated`, `user_updated` (timestamp/uuid with specials `date-created`/`user-created`/`date-updated`/`user-updated`, readonly + hidden) — `meta.accountability` alone does NOT create these.
2. `POST /relations` (**never PATCH `/relations`**) for `user_created` / `user_updated` → `system_users`.
3. Permissions: extend the existing chair role policy with create/update/read on the collection (create preset `{"user_created": "$CURRENT_USER"}` — `$CURRENT_USER` is invalid as a `schema.default_value`); dean policy read-only; faculty no access. Mirror however `syllabi` / `courses` policies are configured on the instance.
4. `POST /utils/cache/clear` with `{"cache":"system"}` after schema/permission changes.

### Matrix template lifecycle & snapshot rule

- `assignEvaluators(...)` (`useSyllabusLifecycle.ts:676`) gains an optional `matrixSnapshot` argument; the **caller** resolves the template before assigning: local cache → remote fetch (`evaluationMatrixApi`) → seeded default as last resort. The hook copies the resolved template into the record: `matrixSnapshot = resolved`. Evaluators answer against the snapshot; later template edits never alter in-flight evaluations. `matrixVersion` records which version they answered.
- Chair template edits take effect for **future** evaluator assignments only.
- **Legacy records** (assigned before this feature; evaluators exist but no `matrixSnapshot`): lazily seeded from the current program template the first time the evaluator form or any matrix view opens for that record — the one intentional exception to the future-only rule, so existing demo data and tests keep flowing through the new UI.

### Rules (enforced at three layers)

1. **Entry (evaluator form):** typing/keeping a comment on a criterion forces `compliant = false` (comment ⇒ N; UI auto-flips and disables Y while a comment exists). Conversely **N requires a comment** — *(builder's call, veto-able: an N without a comment is not actionable revision feedback, so the form requires one, mirroring the paper form where every N has a comment).*
2. **Submit gate:** "Approve Syllabus" is enabled only when every criterion has `compliant = true` and zero comments. Otherwise the evaluator must use "Request Revisions" (remarks textarea stays required, as today). The matrix rows themselves become the actionable feedback; `remarks` remains the free-text summary.
3. **Summarizer (pure util, computed on read):** for each criterion in the snapshot — if any submitted evaluator marked `compliant = false` (or left a comment), the summary row is **N**; else Y only if all submitted evaluators marked Y. Comments merged as unique lines; when 2+ evaluators commented on the same criterion, prefix each line with the evaluator's surname. Criteria with no submitted responses yet render as pending. Same N-wins merge for `overallComments`. Implemented in `client/src/features/syllabus/utils/matrixSummary.ts` + unit tests.

### UI surfaces

1. **New tab "Evaluation Matrix"** in `SyllabusCreatorPage.tsx` tab union (`'governance' | 'my-courses' | 'evaluations' | 'matrix'`) and pill bar (line ~81 and ~820), rendered **chair-only** (`isChairRole`). Dean gets read-only access if trivial (builder's call).
   - **Section A — Matrix Builder:** section list with editable section titles; criteria rows with text inputs, add/remove criteria, add/remove/reorder sections; Save (first save **creates** the collection row as the chair; afterwards PATCH with a `version` bump); Reset to Default (confirm dialog, PATCH); shows `version`, `updatedAt`, `updatedBy`.
   - **Section B — Evaluation Progress:** list of groups with a `matrixSnapshot` (i.e. evaluators assigned): per evaluator a submitted/pending chip; "View Consolidated Matrix" opens a read-only summary modal (the same renderer used elsewhere); "View Individual" to inspect one evaluator's responses.
2. **Evaluator form:** `EvaluatorReviewModal.tsx` becomes the matrix form — renders the record's `matrixSnapshot` sections as the checklist table (criterion | Y/N toggle | comment input), overall "Comments and Suggestions" textarea, then Approve / Request Revisions with the gating above. Unchanged modal shell (`AnimatedModal`), same props plus the extended `onReview` payload.
3. **Governance table:** `DepartmentSyllabusTable.tsx` row actions gain a "Matrix" action for groups with a snapshot (opens consolidated matrix modal; available to chair/dean from assignment onward).
4. **Instructor feedback:** when `revisions_required`, the studio/revision view (e.g. `RevisionRemarksBanner`) links to the consolidated matrix modal so instructors revise against the concrete N rows.

### Integration points (verified)

- `SyllabusCreatorPage.tsx:81` tab union; `:820-869` tab bar; `:872-961` governance content block (pattern for a new block).
- `useSyllabusLifecycle.ts:676` `assignEvaluators` (add snapshot argument); `:711` `submitEvaluatorReview` (accept + persist `matrixResponses`, `overallComments`, `matrixVersion`; status logic unchanged); the submit persist call in `SyllabusCreatorPage.tsx` (~:1206) must start passing `evaluators`.
- `syllabusCollaborationApi.ts:5` `GroupDraftPayload.evaluators` is `any[]` — responses flow through; `:173` `saveRemoteDraft` passes them.
- `types/lifecycle.ts:17-49` type extensions.
- `EvaluatorReviewModal.tsx` full rework; `DepartmentSyllabusTable.tsx:417-483` action column; `RevisionRemarksBanner.tsx` feedback link.
- New files: `api/evaluationMatrixApi.ts` (targets `gabay_syllabus_eval_matrix`), `utils/matrixSummary.ts`, `utils/defaultMatrixTemplate.ts`, `components/matrix/MatrixChecklistTable.tsx` (shared renderer: fill-in and read-only modes), `components/matrix/MatrixBuilder.tsx`, `components/matrix/ConsolidatedMatrixModal.tsx`. Export via feature `index.ts`.

## Default template (transcribed from the university checklist)

Seed exactly these sections/criteria (chair can edit afterward). Header metadata (Name of Instructor(s), Subject, Date) is **not** criteria — the digital view auto-fills instructor names, course code/title, and evaluation date above the table.

**FORMAT**
1. Margins (1" on all sides)
2. Font size (Trebuchet, 11)
3. Term Format: (e.g. First Semester, Academic Year 2025-2026)
4. Correct spelling
5. Course No. & Descriptive Title: (e.g. CSCC 101 - Computing Fundamentals)
6. Name of Faculty Member/s: (e.g. Juan D. Cruz)
7. Schedule & Room Assignment: (align with the name of the faculty member and consistent with faculty workload; include Section, Schedule, Room) (e.g. 1A 08:00-09:00 MWF Room 101)

**Part I: Course Information**
1. PVMG aligned with the University's
2. Graduate Attributes aligned with University's (6 attributes)
3. Core Values aligned with University's (SPECIAL)
4. Program Outcomes aligned with the program's curriculum and CHED Memo (11 outcomes)
5. Course Type (Lecture/Laboratory)
6. Course Credit: n units
7. Course Description: align with CMO 25, s. 2015
8. Contact hours ([with lab component: Lecture 2 hours/week, Laboratory 3 hours/week], [w/o lab component: 3 hours/week])
9. Course Prerequisites: specified and aligned with the curriculum (e.g. CSCC 101 - Computing Fundamentals)
10. Course Outcomes
11. Course requirements: (major examinations; composition of the class standing)
12. Grading System includes the ff.: (a. MG/TFG: 60% CS and 40% Major Exam; b. FG = 40% MG + 60% TFG; c. Composition and percentage of the class standing; d. Formula of the transmutation)
13. Classroom Policies
14. Consultation Hours (Align with the names of the faculty members; if possible 1 sched for TTh and 1 sched for MWF)

**Part II: Course Outline and Time Frame**
1. CMO 25, s. 2015 compliant
2. Aligned with the SDG (specify target number and desc)
3. Laboratory Activities (aligned with each topic)
4. Inclusion of Midterm and Final examination in week 9 and 18
5. Consistent with the content in the Learning Plan
6. Consistent with the schedule in the Learning Plan

**Part III: Learning Plan**
1. Learning Outcomes: more specific than the course outcomes
2. Consistent with the content in the Course Outline
3. Consistent with the time allotment in the Course Outline
4. SDG Coherence: specify the SDG number and title; specify which target # and description that the course topic/s contribute to
5. Methodology: Aligned with the assessment
6. Resources: specify chapter/unit number from the given reference(s)
7. Assessment: Aligned with the methodology, Aligned with learning outcomes

**Part IV: Course Map**
1. Alignment of Course Outcomes to the Program Outcomes

**Part V: References**
1. Style: APA 7th Ed.
2. 20% of the titles are published within the last 5 years
3. At least 5 titles
4. Ebooks must appear on the CCS Learning Resources Website
5. Consistent with the content of the ILR
6. Use: Chairperson, Program Dean, CCS

Plus, below the criteria table (per evaluator, merged in the summary): **"Comments and Suggestions"** free-text box.

## Testing & pressure-testing requirements

- **Unit:** summarizer (N-wins; comment merge with attribution; comment⇒N invariant; pending criteria; all-Y consolidation), default template shape, Approve gating logic, comment-forces-N interaction logic, snapshot-on-assign, template version bump + reset-to-default.
- **Component/integration:** builder add/remove/edit + save; evaluator modal fill + submit through `submitEvaluatorReview` (state transitions unchanged); consolidated modal for chair/dean; instructor feedback link on `revisions_required`.
- **Extend existing tests:** `useSyllabusLifecycle.test.ts`, `EvaluatorReviewModal.test.tsx`, `SyllabusCreatorPage.lifecycle.test.tsx`, `SyllabusLifecycleE2E.test.tsx`.
- **Pressure:** two evaluators submitting near-simultaneously (remote sync merge keeps both response sets); template save racing evaluator fetch; localStorage unavailable; Likha 5xx on template save (retry, then keep local draft with a clear error); 403/empty on template fetch (missing row or collection) → fall back to default template; 40+ criteria × 6 evaluators render without UI lockup; RBAC — matrix tab hidden from faculty; collection permissions enforce faculty no-access and dean read-only server-side.
- Zero console errors across all flows.

## What's left to the builder

- Exact component decomposition and prop shapes beyond what's specified.
- Reorder UX (drag vs up/down buttons) for sections/criteria.
- Whether dean gets the tab read-only (recommended: yes, if it's a one-line gate).
- Test case details and exact styling, following existing governance styling (purple accent, Tailwind tokens).
