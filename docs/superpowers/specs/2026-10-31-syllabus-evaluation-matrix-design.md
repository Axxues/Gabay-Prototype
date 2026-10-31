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

- No new Likha ERP collections, no backend schema changes (reuses the `syllabi` JSON-content pattern).
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
- Persistence follows the existing dual pattern: localStorage primary, Likha ERP `syllabi` collection JSON `content` for cross-device sync (PATCH-then-POST fallback, retry on 5xx/408/429, `User-Agent` handled by existing `likhaRequest`).
- Zero runtime console errors; 100% green test suites; pressure-test concurrency and network failure paths (AGENTS.md production-readiness).

## Approaches considered

1. **Extend the existing storage pattern (CHOSEN).** Matrix template + evaluator responses ride in localStorage + Likha `syllabi` JSON, same as evaluator assignments today. Snapshot the template onto each syllabus when evaluators are assigned; compute the summary live from individual responses. *Why: the whole governance flow already lives in this JSON blob; a derived summary cannot drift; no backend work; smallest diff.*
2. **Same, but persist the computed summary** when the last evaluator submits. Matches "summarize once" literally and helps audit, but creates a second source of truth that can go stale. Rejected for now; a stored copy can be added later without changing the data model.
3. **Dedicated Likha collection** for matrices. The "proper" long-term structure, but requires backend schema work via likha-erp-api protocols and is the heaviest option for the prototype. Rejected.

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

- **Template (per program):** localStorage key `gabay_syllabus_eval_matrix:{scopeId}` where `scopeId = record.departmentId || record.collegeId` (the chair's own scope). On first open with no stored template, seed with the **default template** below and persist.
- **Template remote sync:** new small module `client/src/features/syllabus/api/evaluationMatrixApi.ts` mirroring `syllabusCollaborationApi.ts`'s pattern: reuse the `/items/syllabi` collection with draft id `syl-matrix-{scopeId}` (PATCH `/items/syllabi/{id}`, fallback POST with `course_id: 'matrix-{scopeId}'`), content envelope `{ matrix, updatedAt, lastUpdatedBy }`. Same retry rules (3 attempts on 5xx/408/429) and per-draft save queue. Fetch on tab open; localStorage wins if newer (`updatedAt` compare), remote fills other devices.
- **Responses:** ride on `EvaluatorReview` inside the existing lifecycle records — localStorage `gabay_syllabus_lifecycle_records` + `GroupDraftPayload.evaluators` (already `any[]`) via `saveRemoteDraft`. No API signature changes needed beyond passing the extended objects through. `syncRemoteAgreements` merge keeps full evaluator objects (verify it doesn't strip unknown fields).

### Matrix template lifecycle & snapshot rule

- `assignEvaluators(...)` (`useSyllabusLifecycle.ts:676`) additionally copies the current program template into the record: `matrixSnapshot = currentTemplate`. Evaluators answer against the snapshot; later template edits never alter in-flight evaluations. `matrixVersion` records which version they answered.
- Chair template edits take effect for **future** evaluator assignments only.

### Rules (enforced at three layers)

1. **Entry (evaluator form):** typing/keeping a comment on a criterion forces `compliant = false` (comment ⇒ N; UI auto-flips and disables Y while a comment exists). Conversely **N requires a comment** — *(builder's call, veto-able: an N without a comment is not actionable revision feedback, so the form requires one, mirroring the paper form where every N has a comment).*
2. **Submit gate:** "Approve Syllabus" is enabled only when every criterion has `compliant = true` and zero comments. Otherwise the evaluator must use "Request Revisions" (remarks textarea stays required, as today). The matrix rows themselves become the actionable feedback; `remarks` remains the free-text summary.
3. **Summarizer (pure util, computed on read):** for each criterion in the snapshot — if any submitted evaluator marked `compliant = false` (or left a comment), the summary row is **N**; else Y only if all submitted evaluators marked Y. Comments merged as unique lines; when 2+ evaluators commented on the same criterion, prefix each line with the evaluator's surname. Criteria with no submitted responses yet render as pending. Same N-wins merge for `overallComments`. Implemented in `client/src/features/syllabus/utils/matrixSummary.ts` + unit tests.

### UI surfaces

1. **New tab "Evaluation Matrix"** in `SyllabusCreatorPage.tsx` tab union (`'governance' | 'my-courses' | 'evaluations' | 'matrix'`) and pill bar (line ~81 and ~820), rendered **chair-only** (`isChairRole`). Dean gets read-only access if trivial (builder's call).
   - **Section A — Matrix Builder:** section list with editable section titles; criteria rows with text inputs, add/remove criteria, add/remove/reorder sections; Save (bumps `version`); Reset to Default (confirm dialog); shows `version`, `updatedAt`, `updatedBy`.
   - **Section B — Evaluation Progress:** list of groups with a `matrixSnapshot` (i.e. evaluators assigned): per evaluator a submitted/pending chip; "View Consolidated Matrix" opens a read-only summary modal (the same renderer used elsewhere); "View Individual" to inspect one evaluator's responses.
2. **Evaluator form:** `EvaluatorReviewModal.tsx` becomes the matrix form — renders the record's `matrixSnapshot` sections as the checklist table (criterion | Y/N toggle | comment input), overall "Comments and Suggestions" textarea, then Approve / Request Revisions with the gating above. Unchanged modal shell (`AnimatedModal`), same props plus the extended `onReview` payload.
3. **Governance table:** `DepartmentSyllabusTable.tsx` row actions gain a "Matrix" action for groups with a snapshot (opens consolidated matrix modal; available to chair/dean from assignment onward).
4. **Instructor feedback:** when `revisions_required`, the studio/revision view (e.g. `RevisionRemarksBanner`) links to the consolidated matrix modal so instructors revise against the concrete N rows.

### Integration points (verified)

- `SyllabusCreatorPage.tsx:81` tab union; `:820-869` tab bar; `:872-961` governance content block (pattern for a new block).
- `useSyllabusLifecycle.ts:676` `assignEvaluators` (add snapshot); `:711` `submitEvaluatorReview` (accept + persist `matrixResponses`, `overallComments`, `matrixVersion`; status logic unchanged).
- `syllabusCollaborationApi.ts:5` `GroupDraftPayload.evaluators` is `any[]` — responses flow through; `:173` `saveRemoteDraft` passes them.
- `types/lifecycle.ts:17-49` type extensions.
- `EvaluatorReviewModal.tsx` full rework; `DepartmentSyllabusTable.tsx:417-483` action column; `RevisionRemarksBanner.tsx` feedback link.
- New files: `api/evaluationMatrixApi.ts`, `utils/matrixSummary.ts`, `utils/defaultMatrixTemplate.ts`, `components/matrix/MatrixChecklistTable.tsx` (shared renderer: fill-in and read-only modes), `components/matrix/MatrixBuilder.tsx`, `components/matrix/ConsolidatedMatrixModal.tsx`. Export via feature `index.ts`.

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
- **Pressure:** two evaluators submitting near-simultaneously (remote sync merge keeps both response sets); template save racing evaluator fetch; localStorage unavailable; Likha 5xx/403 on template save (retry then graceful localStorage-only); 40+ criteria × 6 evaluators render without UI lockup; RBAC — evaluator matrix tab hidden from faculty/dean; faculty cannot write template (UI-level; prototype has no server-side rule).
- Zero console errors across all flows.

## What's left to the builder

- Exact component decomposition and prop shapes beyond what's specified.
- Reorder UX (drag vs up/down buttons) for sections/criteria.
- Whether dean gets the tab read-only (recommended: yes, if it's a one-line gate).
- Test case details and exact styling, following existing governance styling (purple accent, Tailwind tokens).
