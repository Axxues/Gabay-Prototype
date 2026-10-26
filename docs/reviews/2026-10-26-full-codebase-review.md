# Gabay LMS Prototype — Full Codebase Review

> **CONFIDENTIAL — DO NOT COMMIT OR PUSH THIS REPORT.**
> The repository is public. This document describes exploitable weaknesses and must remain private until every P0/P1 item is fixed and deployed.

| | |
|---|---|
| **Review date** | 2026-10-26 |
| **Repository** | `github.com/Axxues/Gabay-Prototype` (public) |
| **Reviewed revision** | `3ce76c7` (`main`, 2026-10-21) — working tree clean |
| **Scope** | `client/`, `rag-service/`, `scripts/`, `.github/workflows/`, dependency and configuration surface |
| **Reviewer** | AI agent (DeepSeek V4.1 Flash via OpenCode) |
| **Baseline** | `npm run typecheck` passes; `npm test -- --run` passes 979 tests / 150 files; `npm run lint` fails with 1 error and 286 warnings |
| **Changes made** | **None.** This is a report-only pass. No Directus schema or data was modified. |

---

## 1. Executive summary

The codebase is a functional, well-tested prototype, but its security model is **not production-ready**. Three findings are critical enough to require immediate action, independent of any other fix:

1. **Hardcoded production Directus administrator credentials are shipped in the browser bundle, scripts, tests, and documentation — and the client automatically retries any `403` with that administrator token.** The repository is public. The credentials were introduced on 2026-10-14, removed in a security commit on 2026-10-17, and **reintroduced on 2026-10-19**. Treat the account as compromised.
2. **The RAG service exposes unauthenticated email-sending endpoints.** Anyone who can reach the service can send arbitrary activation links and arbitrary 6-digit "leadership verification" codes to any address from the university's mail identity.
3. **The production login page renders one-click demo buttons for Admin/superadmin and other roles using real hardcoded passwords.** Any visitor can become the Chancellor/superadmin without credentials.

Beyond those, the most serious systemic issues are:

- Authorization is largely **client-side**. Grade release, grade visibility, leadership appointment, and role changes are enforced in React, not in the API. Directus row/field permissions were **not** audited (no admin access was used); several findings are therefore marked "verify server-side".
- Grade writes are **silently lossy**. Existing SPR cells are re-`POST`ed with fixed IDs and conflicts are swallowed; term scalar grades are never persisted. The UI reports success.
- Leadership appointment is **not superadmin-only** and is persisted mainly in `localStorage`, so a dean/chair can create another admin and appointments do not synchronize across devices.
- Quiz answer keys and scoring live in the client, so quiz integrity depends entirely on student honesty.

**Immediate action (next 60 minutes):** rotate the Directus admin password, revoke its sessions/tokens, remove the quick-login buttons, and disable or authenticate the RAG email endpoints. Do this before any code cleanup; deleting the strings from `HEAD` does not undo public exposure.

---

## 2. Severity model

| Severity | Meaning |
|---|---|
| **P0 — Critical** | Direct, remotely exploitable compromise of the backend, mail identity, or superadmin account. Fix now; assume exploitation. |
| **P1 — High** | Serious data loss, privacy breach, privilege escalation, or assessment/governance integrity failure. Fix before production. |
| **P2 — Medium** | Exploitable under specific conditions, defense-in-depth gap, or significant functional bug. Fix in the next cycle. |
| **P3 — Low / hygiene** | Hardening, maintainability, or documentation. |

---

## 3. Findings at a glance

| ID | Severity | Finding | Primary location |
|---|---|---|---|
| P0-1 | Critical | Hardcoded admin credentials + automatic 403 privilege escalation | `client/src/shared/api/likhaLmsApi.ts:94-118, 288-323` |
| P0-2 | Critical | Unauthenticated RAG email endpoints (open mail relay) | `rag-service/app/main.py:134-144, 169-181` |
| P0-3 | Critical | Production quick-login buttons with real superadmin/demo passwords | `client/src/features/auth/LoginPage.tsx:97-112, 292-340` |
| P1-1 | High | Password change accepts the shared default instead of the real password | `client/src/features/auth/ProfilePage.tsx:154-171` |
| P1-2 | High | Grade cell edits silently fail; term grades never persist | `likhaLmsApi.ts:1279-1290`; `LMSContext.tsx:7329-7358` |
| P1-3 | High | Grade release is optimistic, swallows errors, and always shows success | `LMSContext.tsx:5937-5950` |
| P1-4 | High | All course grades/rosters loaded for every course; release gating is client-side | `LMSContext.tsx:2679-2692`; `likhaLmsApi.ts:1918-1929` |
| P1-5 | High | Leadership creation/appointment is available to deans/chairs and is local-only | `App.tsx:119-125, 355`; `LMSContext.tsx:4659-4793` |
| P1-6 | High | Quiz answer keys and scoring are client-side; score is not stored | `ActivityRunnerView.tsx:39-49`; `LMSContext.tsx:3814` |
| P1-7 | High | RAG auth fails open when `RAG_CLIENT_KEY` is unset; the "secret" is in the browser bundle | `main.py:13-33`; `client/src/shared/api/rag.ts` |
| P1-8 | High | Unpublished/stale syllabi remain in the vector index; course-code collisions | `rag-service/ingest.py:252-337, 391-397` |
| P1-9 | High | Course cascade delete can delete shared files and hides partial failures | `likhaLmsApi.ts:672-965` |
| P1-10 | High | Tokens and PII in `localStorage`; local login fallback trusts tamperable data | `client/src/shared/api/client.ts:11-41`; `LMSContext.tsx:1719-1730, 5644` |
| P1-11 | High | Registration/activation is browser-local; admins on other devices never see it | `LMSContext.tsx:4420-4485` |
| P1-12 | High | Missing scores are treated as zero; interim CS-only grades and silent 40/60 defaults | `client/src/shared/utils/spr.ts:32-59, 168-211` |
| P2-1 | Medium | `xlsx@0.18.5` has known prototype-pollution/ReDoS CVEs | `client/package.json` |
| P2-2 | Medium | Conditional React Hook causes the only lint error and can crash the page | `ManageAccountsPage.tsx:40-45` |
| P2-3 | Medium | CORS wildcard-with-credentials fallback; IP rate limit trusts `X-Forwarded-For` | `rag-service/app/main.py`, `core/rate_limit.py` |
| P2-4 | Medium | CI actions unpinned, no least-privilege `permissions`, Python deps unpinned | `.github/workflows/*`; `rag-service/requirements.txt` |
| P2-5 | Medium | Unbounded all-user/all-course fetches; 250-user cap; N+1 bootstrap | `likhaLmsApi.ts:482-483`; `LMSContext.tsx:2434-2528` |
| P2-6 | Medium | RAG prompt-injection/cost-abuse surface (unbounded history, no token cap) | `rag-service/app/main.py`, `agents/synthesizer.py` |
| P2-7 | Medium | `Math.random()` used for leadership code, record IDs, and student IDs | `CreateLeadershipAccountPage.tsx:309`; `LMSContext.tsx:4254` |
| P2-8 | Medium | Email client reports success when the service is unreachable; SMTP simulation reports success | `emailApi.ts:82-91`; `email_service.py` |
| P3-1 | Low | Credentials also appear in tracked docs/tests/scripts (31 files) | `docs/superpowers/`, `scripts/`, tests |
| P3-2 | Low | Role switcher demo code is mounted in production | `RoleSwitcherModal.tsx`; `LMSContext.tsx:3087-3109` |
| P3-3 | Low | `getCourseEnrollments` uses inconsistent collection casing | `likhaLmsApi.ts:646-650` |
| P3-4 | Low | No CSP/security-header verification; no auth-specific automated tests | repo-wide |

---

## 4. Critical findings

### P0-1 — Hardcoded production admin credentials + automatic 403 privilege escalation

**Locations**
- `client/src/shared/api/likhaLmsApi.ts:94-118` — `getLikhaServiceToken()` logs in to Directus with a hardcoded personal account.
- `client/src/shared/api/likhaLmsApi.ts:288-323` — `likhaElevatedRequest()` catches **any** `403` and retries the same request with that admin token.
- Call sites include course deletion (`:672`), orphan cleanup (`:696-724`), and physical file deletion (`:965`).
- `scripts/unpack-likha-json-data.ts:3`, `scripts/verify-zero-json.ts:9` — the same credential is embedded in tooling.
- Tracked docs/tests also contain the address/password (31 matches across the repo).

**Evidence**
- The credential is a real, personal Gmail account with a fixed password. It is sent from the browser in plaintext JSON to `/auth/login`.
- The elevation helper is **not limited to a specific operation**. Any code path that calls `likhaElevatedRequest` gets admin-level retry semantics. Directus RBAC is bypassed by design.
- Git history:
  - `04aa700` (2026-10-14) introduced the service-token fallback.
  - `5f5b33d` (2026-10-17) removed “hardcoded service credentials and automatic 403 privilege escalation.”
  - `06216f0` (2026-10-19) reintroduced them.
  - Current `HEAD` is `3ce76c7` (2026-10-21).
- The repository is public. The credential has therefore been publicly available for roughly a week, and in history since 2026-10-14.

**Impact**
- Anyone can authenticate to the live Directus backend as an administrator.
- Full read/write/delete over users, courses, grades, submissions, files, and schema-adjacent data, subject only to that account’s role.
- The automatic 403 retry turns every client-side authorization check into a real privilege escalation: a dean/chair/faculty action that the UI permits but Directus denies is silently retried as the admin.
- Public exposure means the credential must be treated as compromised even if no abuse is visible.

**Required remediation**
1. **Rotate the Directus account password immediately** and revoke all sessions/tokens for that user.
2. Audit Directus activity/audit logs for logins and mutations since 2026-10-14.
3. Remove `getLikhaServiceToken` and the 403 fallback entirely. If a service account is genuinely required, move the operation to a server-side BFF with a dedicated least-privilege token, never shipped to the client.
4. Remove the credential from **all** files and from git history (`git filter-repo`/BFG), then force-push. Because the repo is public, also request a GitHub cache purge and assume forks/clones retain it.
5. Rotate any other secret that may have been exposed through the same account or `.env` (SMTP, Gemini, Groq, Upstash, static `LIKHA_TOKEN`).
6. Add a pre-commit/CI secret scanner (gitleaks/trufflehog) and branch protection.

> Do not rely on deleting the current lines. The secret is in git history and in multiple tracked documents.

---

### P0-2 — Unauthenticated RAG email endpoints = open mail relay

**Locations**
- `rag-service/app/main.py:134-144` — `POST /api/auth/send-activation-email`.
- `rag-service/app/main.py:169-181` — `POST /api/auth/send-leadership-code`.
- `rag-service/app/services/email_service.py` — SMTP dispatch and HTML templates.
- `client/src/shared/api/emailApi.ts` — calls these endpoints with no auth header.

**Evidence**
- Neither endpoint has `Depends(verify_client_key)`; every other protected route does. They are reachable without the client key, an LMS session, or any user identity.
- The only validation on `email` is `"@" in email` and length. The caller controls:
  - the recipient address,
  - the activation URL (`activation_url` for the first endpoint),
  - the 6-digit code and role/unit text for the second,
  - the recipient display name.
- The leadership endpoint even returns `code` in its response.
- The global rate limiter is 30 requests/minute per IP, but it is in-memory and trusts `X-Forwarded-For` (see P2-3), so it is bypassable.
- The HTML body escapes the recipient name, but the **link** is attacker-controlled, so the email is still a credible phishing vector from the official mail identity.

**Impact**
- Send arbitrary phishing links to students/faculty from the university’s mail domain.
- Send forged “leadership appointment” codes, undermining the appointment verification.
- Spam/cost abuse and SMTP reputation damage; possible provider suspension.
- The endpoint can be used as a blind SSRF-like probe only in the sense of mail delivery; the primary harm is phishing and abuse.

**Required remediation**
1. Disable both endpoints immediately, or require a server-to-server secret **and** an authenticated LMS user with an allowed role.
2. Never accept the activation URL or verification code from the client. Generate them server-side with `secrets`, store a hash + expiry + intended recipient, and verify on consumption.
3. Restrict recipients to an allowlist of institutional domains.
4. Add per-user and per-recipient rate limits, a job queue, and audit logging.
5. Rotate SMTP credentials if the service has been publicly reachable.

---

### P0-3 — Production quick-login buttons with real superadmin/demo credentials

**Locations**
- `client/src/features/auth/LoginPage.tsx:97-112` — `handleQuickLogin` accepts a password and logs in immediately.
- `client/src/features/auth/LoginPage.tsx:292-340` — “Quick demo login” grid, rendered unconditionally. The first button logs in as the personal account that `isChancellorEmail` forces to `superadmin`; the others log in as dean/chair/faculty/staff/student demo accounts.
- `client/src/shared/context/LMSContext.tsx:1567` — `isChancellorEmail` hardcodes that personal address.
- `client/src/shared/context/LMSContext.tsx:1604-1612` — `normalizeChancellorUser` forces that email to `superadmin` / `chancellor`.
- `client/src/features/auth/ProfilePage.tsx:164` — password change falls back to the shared default when `currentUser.password` is absent.
- `client/src/features/accounts/CreateAccountPage.tsx:73,170` and `EditAccountPage.tsx:60,137` — the same shared default is the default for newly created/edited accounts.

**Evidence**
- There is no `import.meta.env.DEV` guard, no feature flag, and no environment check around the quick-login block.
- The Admin button uses the same personal account as the hardcoded service credential.
- The app is deployed at `gabay-prototype.vercel.app`; if deployed from `main`, the buttons and passwords are in the production bundle.
- The demo accounts use a single shared default password across roles.

**Impact**
- Any visitor becomes Chancellor/superadmin with one click.
- Full access to user management, governance, grades, courses, and any operation the UI exposes (including the elevated service-token paths from P0-1).
- Demo accounts are writable destinations; an attacker can persist changes or use them to social-engineer staff.

**Required remediation**
1. Remove the quick-login block from production builds; if a demo is needed, deploy a separate environment with synthetic data and unique, non-production credentials.
2. Force a password reset for every account using the shared default; disable the default entirely.
3. Remove the hardcoded “chancellor by email” rule. Superadmin must come from an explicit server-side role/grant, not an email string.
4. Add a production build check that fails if the known default-password pattern or quick-login components are present.
5. Enable 2FA for all administrative Directus accounts.

---

## 5. High findings

### P1-1 — Password change does not verify the real current password

**Locations:** `client/src/features/auth/ProfilePage.tsx:154-171`; `client/src/shared/context/LMSContext.tsx:1166-1194` (the Directus mapper never maps `password`); `LMSContext.tsx:4295` (PATCH sends the new password).

**Evidence**
- Directus-authenticated users are mapped without a `password` field.
- The check is `(currentUser.password || <shared default>) !== currentPassword` — the literal default is hardcoded in `ProfilePage.tsx`.
- Therefore, for every normal Directus user, the expected “current password” is the shared default, not the user’s real password.
- The actual change is a client `PATCH /users/:id` with `password`; no server-side re-authentication is performed.

**Impact**
- Anyone with a live session (including a stolen `localStorage` token) can set a new password without knowing the old one and persist access.
- On a shared device, a student/staff member can take over an unattended admin session.
- Weak default password remains valid until manually changed.

**Fix:** Add a server-side re-authentication endpoint that verifies the current password (or a fresh OIDC/2FA challenge), then change the password and invalidate other sessions. Never use a default fallback in a credential check.

---

### P1-2 — Grade cell edits silently fail; term grades never persist

**Locations**
- `client/src/shared/api/likhaLmsApi.ts:1279-1290` — every cell is `POST`ed with a deterministic ID, and the request is `.catch(() => {})`.
- `client/src/shared/context/LMSContext.tsx:7329-7358` — `setCourseStudentGrade` ensures a row with `saveGradeWithCells(..., [])`, then updates only the local cache.
- `LMSContext.tsx:7504-7506` — SPR cell reset is local-only.

**Evidence**
- The first save creates `spr-<gradeId>-<taskId>`. The second save posts the same ID again. Directus returns `409` for the duplicate; the rejection is swallowed.
- `setCourseStudentGrade` never writes the midterm/final scalar to the server. It calls `saveGradeWithCells` with no cells and then patches `db.courseGrades` in memory.
- Resetting a cell similarly updates only local state.

**Impact**
- Faculty edit a grade, see a success path, and the change is not persisted. Reloading loses it.
- Term grades displayed in the gradebook can diverge permanently from the stored data.
- Grade disputes and accreditation reports are unreliable.

**Fix:** Query the existing cell, `PATCH /items/spr_cells/:id` when present, `POST` only when absent; use a real upsert on the server if available. Surface every error. Persist term scalars in a proper column or derive them server-side from cells. Add an integration test that saves twice and reloads.

---

### P1-3 — Grade release is optimistic, swallows failure, and always shows success

**Location:** `client/src/shared/context/LMSContext.tsx:5937-5950`.

**Evidence**
```ts
setDb(... optimistic ...);
await likhaLmsApi.courses.updateCourse(courseId, { grades_released: optimistic }).catch(() => {});
showAlert({ type: 'success', ... });
```
- The UI is updated before the request; the error is discarded; the success alert is unconditional.

**Impact**
- Faculty believe grades are released/hidden when the backend rejected the change.
- A failed “hide” can leave grades visible; a failed “release” can leave students without grades.
- No audit trail of who released what.

**Fix:** Await the mutation, roll back on failure, show an error, and log an audit event. Only show success after a confirmed server response.

---

### P1-4 — All grades/rosters are loaded; release gating is client-side only

**Locations**
- `LMSContext.tsx:2679-2692` — for every course, `getCourseGrades(course.id)` is fetched and cached.
- `likhaLmsApi.ts:1918-1929` — `GET /items/course_grades?filter[course_id]=...&fields=*,spr_cells.*` returns **every student’s** grade row and cells for the course.
- `LMSContext.tsx:2434-2528` — `refreshDeferred` iterates all courses and fetches sections, requests, enrollments, etc.
- `likhaLmsApi.ts:482-483` — `GET /users?fields=*,role.*&limit=250` for every authenticated session.

**Impact**
- If Directus row-level permissions are not tightly scoped, a student can read peers’ grades, submissions, enrollment data, and up to 250 users’ PII directly from the network response.
- Even if the UI hides unreleased grades, the data is already in the browser; release gating is not an authorization boundary.
- The `limit=250` cap silently truncates larger institutions, causing missing users/rosters.

**Fix:** Move release filtering and row scoping to the server. Expose separate endpoints for “my grades” (student, released only) and “course gradebook” (faculty/admin). Verify with a real student token. Add pagination and field-level permissions. Do not request all users for student sessions.

---

### P1-5 — Leadership creation/appointment is not superadmin-only and is local-only

**Locations**
- `client/src/App.tsx:119-125` — `RequireAdmin` allows both `admin` and `superadmin`. Deans and chairs are mapped to `role: 'admin'` (`LMSContext.tsx:1586-1590`).
- `client/src/App.tsx:355` — `/accounts/create-leadership` is guarded only by `RequireAdmin`.
- `client/src/features/accounts/CreateLeadershipAccountPage.tsx:279-...` — any admin can initiate the flow.
- `CreateLeadershipAccountPage.tsx:309` — the 6-digit code is generated in the browser with `Math.random()`.
- `CreateLeadershipAccountPage.tsx:463` — the code is compared in the browser against the same browser-generated value.
- `CreateLeadershipAccountPage.tsx:480+` — `createUser({ role: 'admin', adminSubrole: ... })`.
- `LMSContext.tsx:4659-4793` — `transferLeadership`/`appointLeadership` have **no authorization check** and update only React state/localStorage.
- `LMSContext.tsx:3087-3109` — `switchRole` can set `currentUser` to the first user with a chosen role, including a fabricated superadmin.

**Impact**
- A dean or chair can open the leadership page and create another dean/chair account, including for another unit if the UI options allow it.
- The “verification code” proves nothing: the creator’s browser generates it, stores it in React state, and compares it. An admin can read it from devtools or simply enter it.
- Appointments are stored in `localStorage` (`STORAGE_KEY_COLLEGES`/`DEPARTMENTS`) and local `db.users`; they do not synchronize to other devices and can be lost on refresh.
- `switchRole` is demo code mounted in production. If any future UI trigger is added, it becomes a one-click superadmin impersonation.

**Fix:** Make leadership routes superadmin-only on the client **and** server. Move appointment/transfer to a server transaction with an audit log. Generate and verify the 6-digit code server-side (hashed, expiring, bound to the invitee and unit). Remove `switchRole` and the role-switcher modal from production builds. Add a test that a dean cannot create/transfer a dean.

---

### P1-6 — Quiz/exam answer keys and scoring are client-side; scores are not stored

**Locations**
- `client/src/features/assessments/ActivityRunnerView.tsx:39-49` — `isAutoCorrect` compares the student answer to `q.correctAnswer` in the browser.
- `client/src/shared/api/likhaLmsApi.ts` — quiz rows include `correct_answer` when written (`:1155`, `:1195`, `:1846`), and student views receive the quiz object.
- `client/src/shared/context/LMSContext.tsx:3814-...` — `recordQuizSubmission` submits only `answers`, `status`, and timestamp; no score is computed or stored.

**Impact**
- A student can read `correctAnswer` from the network response, React state, or the JS bundle and answer perfectly.
- There is no authoritative server-side score; faculty must grade manually or trust a client-derived number.
- “Instant feedback” is inherently incompatible with a secret answer key in this design.

**Fix:** Score on the server. Strip `correctAnswer`/explanations from student payloads until after submission. Store the score and per-question result server-side. If instant feedback is required, return correctness after the submission transaction, not with the question payload.

---

### P1-7 — RAG authentication fails open; the client key is not a secret

**Locations**
- `rag-service/app/main.py:13-33` — `verify_client_key` returns immediately if `rag_client_key` is falsy.
- `rag-service/app/core/config.py:29` — CORS defaults; the local `rag-service/.env` has no `RAG_CLIENT_KEY`.
- `client/src/shared/api/rag.ts:38+` — `VITE_RAG_CLIENT_KEY` is bundled into browser JavaScript and sent as a header.

**Impact**
- If `RAG_CLIENT_KEY` is unset in production (as it is locally), the chat endpoint is completely unauthenticated.
- Even when set, the key is public; it deters casual use only. Anyone can extract it and query the vector store or burn Gemini/Groq quota.
- No per-user quota or identity; rate limiting is IP-based and bypassable.

**Fix:** Fail closed: refuse to start (or refuse requests) if the key is missing. Put the RAG service behind a server-side proxy that authenticates the LMS session and applies per-user quotas. Treat `VITE_*` values as public and never use them as authorization.

---

### P1-8 — Stale/unpublished syllabi remain searchable; course-code collisions

**Locations**
- `rag-service/ingest.py:391-397` — `has_published_flag` only filters when at least one course has a published flag. If **no** course has one, all courses (including drafts) are ingested.
- `rag-service/ingest.py:252-337` — section IDs are `course_code + section_key`; empty sections are skipped.
- `run_ingestion` only upserts; it never deletes removed/unpublished documents.
- `rag-service/app/services/vector_store.py` — `top_k=3`, no score threshold.

**Impact**
- Unpublished, retracted, or outdated syllabi remain retrievable indefinitely.
- Multiple sections of the same course code overwrite each other; the RAG answer may describe the wrong section’s policies.
- Low-relevance chunks are returned with no confidence gate, increasing hallucination.

**Fix:** Always filter `published = true` (fail closed). Use stable IDs including course ID + section + academic year, and maintain an ingestion manifest so deleted/unpublished documents can be removed. Reindex after changes. Add a similarity threshold and “insufficient context” response.

---

### P1-9 — Course cascade delete can delete shared files and hides partial failures

**Locations:** `client/src/shared/api/likhaLmsApi.ts:672-965`.

**Evidence**
- `deleteCourseCascade` fetches all child records, then collects “file UUIDs” from arbitrary fields with `addCandidate` (any 16–64-character string).
- It deletes physical assets via `/files/:id` (`:965`) with `likhaElevatedRequest`.
- File IDs are global in Directus; there is no reference count or ownership check. If a cover image, attachment, or submission file is reused by another course, deleting one course removes it everywhere.
- Deletions use `Promise.allSettled` and `.catch()`, so partial failures are invisible; the course delete can still report success, leaving orphans.

**Impact**
- Irreversible loss of shared images/files across unrelated courses.
- Orphaned rows and broken references.
- A failed cleanup is reported as success.

**Fix:** Do not delete physical files automatically. Use soft deletion and a reference-count/GC job that checks all references. Restrict hard delete to superadmin, run it as a server-side transaction/job, and report per-child failures. Add a dry-run mode.

---

### P1-10 — Tokens and PII in `localStorage`; local login fallback trusts tamperable data

**Locations**
- `client/src/shared/api/client.ts:11-41` — access and refresh tokens are stored in `localStorage`.
- `LMSContext.tsx:1719-1730` — the app hydrates the entire `db` from `gabay_lms_db_v6`.
- `LMSContext.tsx:5644` — a college rollover writes the whole `db` (users, grades, submissions) back to `localStorage`.
- `LMSContext.tsx:2953-...` — login has a local fallback for identifiers without `@` that matches `db.users` and compares stored passwords.

**Impact**
- Any XSS or malicious extension can steal long-lived admin tokens.
- On a shared machine, `localStorage` tampering can inject a fake `superadmin` user with a non-email `studentId`; the local login path accepts it without Directus. The fake session has no Directus token, but the elevated service-token paths (P0-1) can still perform privileged operations.
- The persisted `db` can contain student PII, grades, and locally created plaintext passwords.

**Fix:** Use `HttpOnly`, `Secure`, `SameSite` cookies for refresh tokens and keep access tokens in memory; add CSRF protection. Remove the local auth fallback. Do not persist the full database; if offline caching is required, encrypt it and scope it per user. Add a strict CSP and sanitize all user-rendered content.

---

### P1-11 — Registration/activation is browser-local

**Location:** `client/src/shared/context/LMSContext.tsx:4420-4485` (and the `RegisterPage`/activation flow).

**Evidence**
- `registerAccount` builds a `newRegistration`, prepends it to `pendingRegistrations`, and returns. There is no API write.
- `pendingRegistrations` is persisted (sanitized of `password`) to `localStorage`.
- `activateEmail`/`verifyRegistration` read that local list.
- The activation token itself is cryptographically strong (`crypto.getRandomValues`, `cryptoToken.ts:1-10`), but it is generated and stored only in the applicant’s browser.

**Impact**
- An applicant who registers on a phone cannot be verified by an admin on a desktop; the admin never sees the request.
- An activation link opened in a different browser fails because the token is not in that browser’s `localStorage`.
- Registration data is device-local and can be lost, duplicated, or tampered with.
- Passwords sit in React state (and briefly in the pending list) on the client.

**Fix:** Persist registrations server-side (Directus collection or BFF), with a server-generated token hash, expiry, and status. Send the activation link from the server. Verify on the server. Add rate limits and duplicate-email checks. Never store the password in the pending record after the initial hashed write.

---

### P1-12 — Missing scores are treated as zero; interim grades look final; weights silently default

**Locations:** `client/src/shared/utils/spr.ts:32-40, 42-59, 168-211`.

**Evidence**
- `classStandingPercent` uses `scores[i] ?? 0`, so an ungraded requirement contributes zero instead of being excluded.
- `termGrade` returns a CS-only percentage as the term grade when the exam is missing and any CS data exists.
- `extractTermWeights` falls back to 40/60 (midterm/finals) or an equal split when the formula is missing/unparseable, with no UI warning.

**Impact**
- Students see artificially low grades for missing work.
- A CS-only interim value can look like a final term grade; final grades can be computed from it later.
- A syllabus with a different weighting is silently graded with the wrong formula.

**Fix:** Represent “not graded” distinctly from zero; exclude missing components or show “incomplete.” Do not emit a term/final grade until required components exist. Require an explicit weight configuration and surface the fallback in the UI. Add unit tests for missing/partial/excused scores.

---

## 6. Medium findings

### P2-1 — `xlsx@0.18.5` has known vulnerabilities

`client/package.json` pins `xlsx@0.18.5`. This version is affected by CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS); fixes are in 0.19.3/0.20.2+ (the npm package is stale; SheetJS distributes newer builds via its CDN). The app parses chair/upload spreadsheets, so a malicious file could hang the tab or pollute prototypes. **Fix:** upgrade to a patched build, parse in a worker with size/time limits, and validate the expected sheet schema.

### P2-2 — Conditional React Hook is the only lint error

`client/src/features/accounts/ManageAccountsPage.tsx:40-45` calls `useNavigate()` inside `try/catch`. If the try result changes between renders, React’s hook order breaks; it also masks a missing Router. `npm run lint` reports this as the single error. **Fix:** call the hook unconditionally at the top, or split the component into router-dependent and router-independent variants. Address the 286 warnings incrementally (most are fast-refresh warnings from `LMSContext` exports).

### P2-3 — CORS/rate-limit weaknesses

- `rag-service/app/main.py` configures CORS with credentials. If `CORS_ALLOWED_ORIGINS` is set to an empty string, the fallback becomes `["*"]` while `allow_credentials=True` — an invalid/unsafe combination.
- `core/rate_limit.py` keys on the first `X-Forwarded-For` value, which is attacker-controlled unless a trusted proxy strips it. The limiter is in-memory, per-instance, and resets on restart.
- **Fix:** explicit production origins only; no wildcard with credentials; trust only a known proxy header; use Redis or a gateway rate limit; add per-user quotas.

### P2-4 — CI/dependency hardening

- `.github/workflows/sync-cron.yml` uses `actions/checkout@v4` and `actions/setup-python@v5` by tag, not commit SHA.
- No `permissions:` block, so the job inherits the repository default `GITHUB_TOKEN` scope. The sync job only needs read access.
- `rag-service/requirements.txt` uses `>=` for all packages; builds are not reproducible and a compromised release can enter CI.
- The sync job receives a static `LIKHA_TOKEN` (likely an admin token) and sends it to a third-party Python dependency install.
- **Fix:** pin actions to SHAs, set `permissions: contents: read`, use a lockfile with hashes, use a read-only Directus token, and add Dependabot/secret scanning.

### P2-5 — Unbounded bootstrap fetches, 250-user cap, N+1

`getUsers` fetches `limit=250` users with `fields=*` for every session. `refreshDeferred` then loops all courses and fetches sections, requests, enrollments, grades, quizzes, exams, activities, etc. For a large institution this is slow, memory-heavy, and truncates users beyond 250. **Fix:** server-side scoping and pagination; fetch only the current user’s enrollments; lazy-load rosters per course; avoid `fields=*` on `directus_users`.

### P2-6 — RAG prompt-injection and cost-abuse surface

`/api/chat` accepts up to 20 history items with unbounded `content`, plus `student_name` and `active_course`, all controlled by the caller. The synthesizer inserts history and retrieved documents into the Gemini prompt with delimiters and an anti-injection instruction, which is good, but not a hard boundary. A malicious document (ingested syllabus) or forged history can steer the model; unbounded history can burn tokens. **Fix:** cap total prompt tokens, validate history roles/length, treat retrieved text as data, add output filtering, and enforce per-user quotas.

### P2-7 — `Math.random()` for codes and identifiers

`CreateLeadershipAccountPage.tsx:309` generates the 6-digit appointment code with `Math.random()`. The code is not a secret from the creating admin, so this is primarily an integrity/theater issue, but it should still use `crypto.getRandomValues` and server-side storage. `LMSContext.tsx:4254` generates student IDs with `Math.random()`; `cryptoToken.ts:16-19` falls back to `Math.random()` for UUIDs. **Fix:** use `crypto.randomUUID()`/`getRandomValues` everywhere; enforce uniqueness server-side.

### P2-8 — Email clients report success when nothing was sent

- `client/src/shared/api/emailApi.ts:82-91` catches a network failure for the leadership-code email and returns `success: true` so the demo “continues smoothly.”
- `rag-service/app/services/email_service.py` returns simulated success when SMTP is not configured.
- **Impact:** the UI tells the admin the code/activation link was sent when it was not; the flow then stalls or is bypassed.
- **Fix:** fail closed in production; return `success: false` and a clear “email not sent” message; only allow simulation behind an explicit dev flag.

---

## 7. Low findings / hygiene

- **P3-1 — Credentials in docs/tests/scripts.** Beyond the client, the admin address/password appear in tracked plans, tests, and scripts (31 matches). This widens the leak and makes history purging harder. Include them in the secret scan and history rewrite.
- **P3-2 — Role switcher mounted in production.** `RoleSwitcherModal` is rendered in `AppShell` and `switchRole` impersonates the first user with a chosen role. The visible trigger is currently limited (DEV-only `RoleGuard`, plus an effectively unreachable non-admin branch on `/accounts`), but the code should not ship. Remove it from production builds.
- **P3-3 — Collection-name casing.** `getCourseEnrollments` uses `Course_Enrollments` while other code uses lowercase collection names. Verify the actual Directus collection; a mismatch would silently return `[]` because the call catches errors.
- **P3-4 — Security headers/tests.** No CSP or security-header configuration was found; no automated tests cover the auth bypasses, grade persistence, or RAG email endpoints. Add Playwright/API tests for: student cannot read peers’ grades; dean cannot create leadership; grade edit persists across reload; unauthenticated email endpoint is rejected.

---

## 8. Positive controls observed

These are worth preserving:

- **No raw HTML injection sinks** in client source: no `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, or `new Function(`. `react-markdown` is used without `rehype-raw`, so raw HTML in markdown is not rendered.
- **Activation tokens use `crypto.getRandomValues`** (32 bytes) rather than `Math.random`.
- **RAG email HTML escapes the recipient name** (`html.escape`) before interpolation.
- **The synthesizer has an explicit anti-injection instruction and delimiters** around retrieved context.
- **The RAG service uses Pydantic length limits** on most request fields and restricts history to 20 items.
- **`.env` is gitignored**; only `.env.example` is tracked. Local secrets were not found in git.
- **Baseline quality is decent:** typecheck passes, 979 tests pass, and the app has broad test coverage (150 files). The single lint error is isolated.
- **The cache deduplicates in-flight reads** and invalidates on mutations, which reduces request storms.

---

## 9. Coverage and limitations

This was a **targeted high-risk static review**, not a line-by-line read of all ~100k lines.

**Reviewed in depth:** authentication pages and session bootstrap, `LMSContext` data loading and grade flows, `likhaLmsApi` request/auth/cache/delete paths, `spr.ts` grade math, assessment runner/submission paths, leadership/account flows, RAG service endpoints/agents/ingestion/vector store/rate limiting, scripts with credentials, CI workflows, dependency versions, and lint/test/typecheck baselines.

**Not verified:**
- **Directus server-side role and field permissions.** The backend is a live shared production system; per the repository's `AGENTS.md`, no REST/DDL calls were made and no admin UI session was used. Findings P1-4 (peer grade/PII exposure), P1-5 (dean creating admins), and P0-1 (actual blast radius) depend on the role permissions of the compromised account and of student/faculty roles. **These must be verified in the Directus admin UI before closing them.**
- **Production environment variables** on Vercel/Render (e.g., whether `RAG_CLIENT_KEY` and `CORS_ALLOWED_ORIGINS` are set in production).
- **Live exploitation.** No credentials were used against the production backend and no malicious files were uploaded.
- **Full dependency audit.** `npm audit`/`pip-audit` were not run to completion; only the known `xlsx` issues and obvious pinning problems are reported.
- **Every component.** Lower-risk UI, styling, and test files were not individually reviewed.

Where a finding says “if Directus permissions allow,” treat it as **unconfirmed until tested with a real low-privilege token**.

---

## 10. Immediate response — first 24 hours

Do these in order. The first three do not require code changes.

1. **Rotate the Directus admin password** used by the hardcoded service account. Revoke all its sessions/tokens. If Directus supports it, force logout of all users and rotate static tokens.
2. **Audit Directus activity logs** for that account and for administrative mutations since 2026-10-14. Look for new users, role changes, deleted courses/files, and grade edits. Preserve logs.
3. **Disable the quick-login block** (or deploy a build without it) and force a password reset for every account that used the shared default.
4. **Disable or authenticate the two RAG email endpoints.** Rotate SMTP credentials. If the service was public, assume the mail identity was abused and check sent-mail logs.
5. **Remove the hardcoded credential and 403 elevation from `HEAD`**, then purge git history and force-push. Because the repo is public, request a GitHub cache purge and assume forks retain the secret.
6. **Rotate any other secret** reachable by the compromised account or the RAG service: `LIKHA_TOKEN`, SMTP, Gemini, Groq, Upstash.
7. **Check GitHub** for forks, stars, and code-search caches; notify collaborators. If this is a real institution, follow the data-protection incident process (Philippines: NPC/RA 10173) if personal data was accessed.

> Rotate first, then clean. Purging history while the password is still valid does not protect anything.

---

## 11. Remediation plan

### Phase 0 — Stop the bleeding (today)
- P0-1 credential rotation/removal/elevation removal.
- P0-3 quick-login removal + default-password reset.
- P0-2 email endpoint lockdown + SMTP rotation.
- P1-3 grade-release error handling (small, high-value).
- Add secret scanning to CI and a pre-commit hook.

### Phase 1 — Correctness and authorization (this week)
- P1-2 grade upsert + term persistence; integration tests.
- P1-1 server-side password re-authentication.
- P1-5 superadmin-only leadership + server-side appointment transaction; remove role switcher.
- P1-4 server-side grade/PII scoping; verify with a student token.
- P1-10 token storage and local-auth removal.
- P1-11 server-side registration/activation.

### Phase 2 — Assessment and RAG integrity (next sprint)
- P1-6 server-side quiz scoring and answer-key stripping.
- P1-7 RAG fail-closed auth + server proxy + quotas.
- P1-8 reindex with published-only filtering and stale-document deletion.
- P1-9 soft-delete/file reference counting.
- P1-12 missing-score semantics and explicit weights.
- P2-1 dependency upgrades, P2-2 hook fix, P2-3 CORS/rate limits.

### Phase 3 — Hardening and operations
- P2-4 CI pinning/permissions; P2-5 pagination/N+1; P2-6 prompt/token limits.
- P2-7 crypto RNG; P2-8 fail-closed email.
- CSP/security headers, 2FA for admins, audit logging, backup/restore drills, and a security test suite.

---

## 12. Suggested verification after fixes

1. **Unauthenticated RAG email test:** `POST /api/auth/send-activation-email` with no key must return `401/403`, not `200`.
2. **Student token test:** a real student token must not be able to read another student’s `course_grades`, `spr_cells`, or submission rows; unreleased grades must be absent from the response, not merely hidden in React.
3. **Grade persistence test:** edit an existing cell twice, reload, and confirm both values; change a term grade, reload, and confirm it.
4. **Release test:** make the course update fail (e.g., revoke permission) and confirm the UI shows an error and rolls back.
5. **Leadership test:** log in as a dean, attempt `/accounts/create-leadership` and the appointment action; both must be denied on the client and server.
6. **Password test:** attempt a password change with the shared default while the real password is different; it must fail.
7. **Secret scan:** `gitleaks detect --no-git` and a full-history scan must return zero; a fresh clone must contain no credential.
8. **Quiz test:** inspect the student quiz response/bundle; `correctAnswer` must not be present before submission.
9. **RAG index test:** unpublish a course, re-run ingestion, and confirm its documents are no longer retrievable.
10. **Build gate:** a production build must fail if quick-login/demo/default-password code is present.

---

## 13. Approval request

I have **not modified any code or backend data**. The working tree is clean and the report is the only new artifact.

If you approve, I recommend this order:

1. **P0-1 + P0-3** — remove the hardcoded credential/elevation and the quick-login block (client-only changes; no Directus schema work).
2. **P0-2** — require auth on the email endpoints and stop accepting client-supplied links/codes.
3. **P1-2 + P1-3** — make grade writes and release reporting honest.
4. **P1-5** — restrict leadership flows to superadmin and move appointment persistence server-side.

Please confirm:

- **Rotate the Directus password and SMTP credentials now** (this is the one action that cannot wait for code review).
- Whether I may edit the public repository directly, or should prepare a private patch/worktree.
- Whether Directus admin UI access can be provided so the server-side permission questions in P1-4/P1-5 can be closed.

Until then, treat the backend and the superadmin account as compromised.
