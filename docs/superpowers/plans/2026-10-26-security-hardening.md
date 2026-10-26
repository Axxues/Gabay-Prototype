# Gabay LMS Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the critical/high findings from `docs/reviews/2026-10-26-full-codebase-review.md` without breaking local development, and keep the quick-login convenience local-only.

**Architecture:** Client secrets move out of tracked source. Quick-login accounts move to an ignored `client/.env.local` (base64 JSON), gated by `import.meta.env.DEV`. The client loses all service-token elevation. The RAG service fails closed on missing auth, owns leadership-code generation/verification, and reindexes the vector store from published courses only. Grade writes become real upserts. Directus remains the source of truth; no schema/DDL calls are made from code.

**Tech Stack:** React 19 + Vite 8 + TypeScript 6, Vitest, FastAPI, Pydantic, Upstash Vector, Directus REST for application items only.

**Spec:** `docs/reviews/2026-10-26-full-codebase-review.md` — CONFIDENTIAL, do not commit that report.

## Global Constraints

- Do not use Directus REST/DDL for schema, collections, fields, relations, or permissions. Use the admin UI only.
- Do not print or commit credentials. Local secrets belong in `client/.env.local`, `rag-service/.env`, or the shell environment; all are gitignored.
- Quick login must remain available locally via ignored config and must not render in a production build.
- Keep `npm run typecheck`, `npm test -- --run`, and `npm run lint` green (lint error count must reach 0).
- Preserve the existing UI look and feel.
- Do not claim P1-4/P1-5 fully fixed until Directus role permissions are verified with a student/dean token in the admin UI.
- Directus password rotation, SMTP rotation, and git-history purge are user actions; the code must stop depending on the old secrets.

## Review Focus

- A production build must contain no quick-login credentials and no admin service token.
- A student token must never receive another student's grade rows; unreleased terms must not be cached.
- Existing SPR cells must be updated, not re-created; failures must surface.
- The RAG email endpoints must reject unauthenticated and non-admin callers.
- Unpublished syllabi must disappear from retrieval after reindex.
- A failed grade release must not show a success toast.
- A dean must not reach leadership creation or role switching.
- No local-storage object must be trusted as an authenticated identity.

---

### Task 1: Local-only quick login

**Files:**
- Modify: `client/src/features/auth/LoginPage.tsx`
- Create: `client/src/features/auth/quickLogin.ts`
- Create: `client/src/features/auth/quickLogin.test.ts`
- Create: `client/.env.local.example`
- Modify: `.gitignore` (only if `.env.local` is not already covered by `*.local`)
- Local ignored file: `client/.env.local`

**Interfaces:**
- `parseQuickLoginAccounts(raw: string | undefined, isDev: boolean): QuickLoginAccount[]`
- `QuickLoginAccount = { label: string; email: string; password: string; tone?: 'admin'|'dean'|'chair'|'faculty'|'staff'|'student' }`

- [ ] **Step 1: Write failing tests** for: empty raw → `[]`; non-dev → `[]`; valid base64 JSON → parsed accounts; malformed base64/JSON → `[]` (never throw).
- [ ] **Step 2: Run `npm test -- --run src/features/auth/quickLogin.test.ts`** and confirm it fails because the module is missing.
- [ ] **Step 3: Implement `quickLogin.ts`** using `atob` + `JSON.parse`, validating email/password/label strings. Export the parser and a `loadQuickLoginAccounts()` that reads `import.meta.env.VITE_QUICK_LOGIN_ACCOUNTS_B64` and `import.meta.env.DEV`.
- [ ] **Step 4: Replace the hardcoded quick-login JSX** with a `quickLoginAccounts.map(...)`; render nothing when empty. Keep `handleQuickLogin`.
- [ ] **Step 5: Create `client/.env.local`** from the existing six accounts by extracting them with a one-off script (do not print them); Base64-encode the JSON into `VITE_QUICK_LOGIN_ACCOUNTS_B64`. Add `.env.local.example` with a placeholder.
- [ ] **Step 6: Verify** a production build with a dummy `.env.local` does not contain the dummy credential; run the auth tests.

### Task 2: Remove service-token elevation and hardcoded credentials

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Modify: `client/src/shared/api/likhaLmsApi.test.ts` (or add focused tests)
- Modify: `scripts/unpack-likha-json-data.ts`
- Modify: `scripts/verify-zero-json.ts`
- Modify: `client/src/shared/context/LMSContext.tsx` (`isChancellorEmail`, `normalizeChancellorUser`)

**Interfaces:**
- `likhaElevatedRequest` is removed; call sites use `likhaRequest`.
- `getLikhaServiceToken` is removed.
- Scripts read `LIKHA_ADMIN_EMAIL`/`LIKHA_ADMIN_PASSWORD` and exit with a clear error when absent.

- [ ] **Step 1: Add a failing test** proving a 403 is surfaced and never retried with a different token (mock `fetch`, assert one call and thrown `ApiError`).
- [ ] **Step 2: Implement** the removal: delete the service-token cache, login helper, and 403 fallback; replace `likhaElevatedRequest` bodies with `likhaRequest`; remove the upload fallback.
- [ ] **Step 3: Update scripts** to require env vars; no defaults.
- [ ] **Step 4: Remove `isChancellorEmail` hardcoding**; superadmin comes from Directus role name/subrole only. Update tests to use synthetic roles.
- [ ] **Step 5: Scrub the personal address/password from tracked tests/docs**, replacing with synthetic values. Run `git grep` to confirm zero credential matches.
- [ ] **Step 6: Run typecheck/tests.**

### Task 3: RAG authentication, email lockdown, server-generated leadership codes

**Files:**
- Modify: `rag-service/app/main.py`
- Modify: `rag-service/app/core/config.py`
- Modify: `rag-service/app/core/rate_limit.py`
- Create: `rag-service/app/services/verification_service.py`
- Modify: `rag-service/app/services/email_service.py`
- Modify: `rag-service/tests/test_security_auth.py`, `test_email_service.py`, `test_security_cors.py`, `test_security_ratelimit.py`
- Create: `rag-service/tests/test_verification_service.py`
- Modify: `client/src/shared/api/emailApi.ts`, `client/src/shared/api/rag.ts`
- Modify: `client/src/features/accounts/CreateLeadershipAccountPage.tsx`
- Local ignored files: `rag-service/.env` (`RAG_CLIENT_KEY`), `client/.env.local` (`VITE_RAG_CLIENT_KEY`)

**Interfaces:**
- `verify_client_key` raises 503 when no key is configured; 401 for missing/wrong key.
- `get_admin_user` verifies a Directus bearer token and requires admin/superadmin role for leadership endpoints.
- `POST /api/auth/send-leadership-code` takes `{email, recipient_name, role_type, unit_name}`, generates the code server-side, stores a hash + 10-minute expiry, emails it, and never returns the code.
- `POST /api/auth/verify-leadership-code` takes `{email, code}` and returns `{success}`.
- `POST /api/auth/send-activation-email` requires client key, an allowed recipient domain, and an `activation_url` whose origin is in `ALLOWED_ACTIVATION_ORIGINS`.

- [ ] **Step 1: Write failing RAG tests** for: no key configured → 503; missing/wrong key → 401; valid key → 200; leadership send without admin token → 401/403; code is not in the response; verify consumes the code; expire/reuse fails; disallowed email domain → 422; disallowed activation origin → 422.
- [ ] **Step 2: Implement settings** (`rag_client_key` required, `allowed_email_domains`, `allowed_activation_origins`, `trust_proxy`).
- [ ] **Step 3: Implement `verification_service.py`** with `issue_code`, `verify_code`, `purge_expired`; use `secrets`.
- [ ] **Step 4: Add dependencies and update endpoints; remove `code` from the request/response models.**
- [ ] **Step 5: Update the client** to send `X-Gabay-Client-Key` and the Directus bearer token; send leadership code requests without a client code; verify via the server before creating/appointing; show a clear error if email fails.
- [ ] **Step 6: Fix CORS** to explicit origins, `allow_credentials=False`; fix rate-limiter IP extraction to trust `X-Forwarded-For` only when `TRUST_PROXY=true`.
- [ ] **Step 7: Generate local keys** into ignored `.env` files; run pytest.

### Task 4: Password change, defaults, and local auth fallback

**Files:**
- Modify: `client/src/features/auth/ProfilePage.tsx`
- Modify: `client/src/features/accounts/CreateAccountPage.tsx`
- Modify: `client/src/features/accounts/EditAccountPage.tsx`
- Modify: `client/src/shared/api/likhaLmsApi.ts` (`verifyPassword`)
- Modify: `client/src/shared/context/LMSContext.tsx` (login local fallback, `createUser` local password, `verifyRegistration` fallback)
- Tests: add `ProfilePage.password.test.tsx`, update `LMSContext` auth tests.

**Interfaces:**
- `likhaLmsApi.auth.verifyPassword(email, password): Promise<boolean>` posts `/auth/login` without storing tokens.
- `ProfilePage` calls it before `updateUser`; no default-password fallback.
- Account create/edit require an explicit password of at least 8 characters; no default.
- Local login fallback and local user creation fallback are removed; login requires Directus for email identifiers. Student-ID login is removed unless resolved server-side.
- `verifyRegistration` returns an error if the pending password is unavailable; it never creates a local user with a default password.

- [ ] **Step 1: Write failing tests** for: wrong current password → no PATCH; correct current password → PATCH; empty/short new password rejected; admin create form does not submit without a password; `verifyRegistration` does not create a local fallback.
- [ ] **Step 2: Implement server-side verification** and remove defaults.
- [ ] **Step 3: Remove local fallback paths**; stop storing plaintext passwords in `db.users`.
- [ ] **Step 4: Run targeted tests and typecheck.**

### Task 5: Grade persistence, release, and student scoping

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (`saveGradeWithCells`, `getCourseGrades`, add `clearSPRCell`)
- Modify: `client/src/shared/context/LMSContext.tsx` (`setCourseStudentGrade`, `setGradesReleased`, grade hydration, reset)
- Modify: `client/src/shared/utils/spr.ts`
- Tests: `likhaLmsApi.grades.test.ts`, `LMSContext.grades.test.ts`, `spr.test.ts`

**Interfaces:**
- `saveGradeWithCells` loads existing cells for the grade row, PATCHes by existing ID, POSTs only new cells, and throws on failure.
- `clearSPRCell(courseId, studentId, taskId)` PATCHes `score: null` or deletes the cell.
- `setCourseStudentGrade` persists the term scalar in a dedicated `spr_cells` row (`task_id: '__term_midterm'`/`'__term_final'`) when no scalar column exists; the gradebook reads it.
- `getCourseGrades(courseId, studentId?)` filters by student for student sessions.
- `setGradesReleased` awaits, rolls back, and shows an error on failure.
- `classStandingPercent` excludes missing scores; `termGrade` returns null until required components exist; `extractTermWeights` exposes `defaulted` so the UI can warn.

- [ ] **Step 1: Write failing unit tests** for double-save, existing-cell update, new-cell create, error propagation, term scalar round-trip, student-only fetch, release rollback, missing-score math, and defaulted weights.
- [ ] **Step 2: Implement the API and context changes.**
- [ ] **Step 3: Update the UI** to show a warning when weights are defaulted and “incomplete” when components are missing.
- [ ] **Step 4: Run targeted tests and the full suite.**

### Task 6: Leadership RBAC and role-switcher removal from production

**Files:**
- Modify: `client/src/App.tsx` (`RequireSuperAdmin`)
- Modify: `client/src/shared/context/LMSContext.tsx` (`transferLeadership`, `appointLeadership`, `switchRole`)
- Modify: `client/src/features/accounts/CreateLeadershipAccountPage.tsx`
- Modify: `client/src/shared/components/common/RoleSwitcherModal.tsx`
- Tests: `App.rbac.test.tsx`, `CreateLeadershipAccountPage.test.tsx`, `LMSContext.leadership.test.tsx`

**Interfaces:**
- `RequireSuperAdmin` allows only `activeRole === 'superadmin'`.
- `/accounts/create-leadership` uses it.
- `transferLeadership`/`appointLeadership` reject non-superadmin callers before mutating.
- Role assignments persist via `updateUser` (role only); unit seat metadata remains local with an explicit warning.
- `RoleSwitcherModal` renders only when `import.meta.env.DEV`.

- [ ] **Step 1: Write failing tests** for dean/chair denied, superadmin allowed, and switcher absent in production.
- [ ] **Step 2: Implement guards and persistence.**
- [ ] **Step 3: Run targeted tests.**

### Task 7: Token storage and local database cleanup

**Files:**
- Modify: `client/src/shared/api/client.ts`
- Modify: `client/src/shared/context/LMSContext.tsx` (remove DB localStorage read/write, local login fallback already removed)
- Tests: `client.test.ts`, `LMSContext.auth.test.tsx`

**Interfaces:**
- Tokens use `sessionStorage` (access + refresh); `clearToken` clears both.
- No `gabay_lms_db_v6` read/write.
- No plaintext password fields in `db.users`.

- [ ] **Step 1: Write failing tests** for sessionStorage keys and no `localStorage` token fallback.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run tests.**

### Task 8: RAG ingestion integrity

**Files:**
- Modify: `rag-service/ingest.py`
- Modify: `rag-service/app/services/vector_store.py`
- Modify: `rag-service/app/core/config.py`
- Tests: `rag-service/tests/test_ingest.py`, `test_vector_store.py`

**Interfaces:**
- `fetch_likha_data` fails closed: if no course carries a published flag, return `[]` and log; if any carry it, keep only published.
- `parse_syllabus_to_sections(course_id, course_code, course_title, syllabus)` uses `course_id` in the doc ID.
- `run_ingestion` calls `index.reset()` first when `RAG_FULL_REINDEX=true` (default true) and then upserts.
- `query_vector_store` drops results below `RAG_MIN_SCORE` (default 0.25).

- [ ] **Step 1: Write failing tests** for unpublished-only input, published filtering, course-ID collision avoidance, reset-before-upsert, and low-score filtering.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run pytest.**

### Task 9: Safe cascade delete

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (`deleteCourseCascade`)
- Tests: `likhaLmsApi.deleteCourse.test.ts`

**Interfaces:**
- Physical `/files` deletion is disabled by default (`deletePhysicalFiles = false`).
- Child deletion failures are collected and thrown as an `ApiError` before the course row is deleted; 404 is treated as already deleted.
- No arbitrary string is treated as a file ID.

- [ ] **Step 1: Write failing tests** for shared-file preservation, 404 tolerance, and failure propagation.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run targeted tests.**

### Task 10: Hygiene and verification

**Files:**
- `client/src/features/accounts/ManageAccountsPage.tsx` (hook)
- `client/src/shared/context/LMSContext.tsx` / `CreateLeadershipAccountPage.tsx` (`Math.random`)
- `client/src/shared/api/emailApi.ts` (fail-closed)
- `client/package.json` (`xlsx` upgrade)
- `.github/workflows/*.yml` (`permissions: contents: read`, SHA pins)
- `rag-service/requirements.txt` (pin versions)
- tests/docs scrub

- [ ] **Step 1: Fix the conditional hook** by calling `useNavigate` unconditionally.
- [ ] **Step 2: Replace `Math.random` identifiers/codes** with `crypto.randomUUID`/`getRandomValues`.
- [ ] **Step 3: Make email API failures fail closed; only simulate in dev.**
- [ ] **Step 4: Upgrade `xlsx`** and run the parser tests.
- [ ] **Step 5: Harden CI** with least-privilege permissions and SHA pins.
- [ ] **Step 6: Run `npm run typecheck`, `npm test -- --run`, `npm run lint`, `pytest`, and a production build secret scan.**

## Blocked / user actions

- Rotate the Directus admin password, revoke sessions, and audit activity logs since 2026-10-14.
- Rotate SMTP/Gemini/Groq/Upstash/static tokens.
- Purge git history and force-push; request GitHub cache purge.
- Verify Directus role/field permissions with a real student and dean token in the admin UI.
- Decide whether to add a backend collection for pending registrations and quiz scoring; without it, P1-4/P1-11 are only partially mitigated.
