# Likha ERP Full Relational & Media Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure native Directus Relational (`Many to One`, `One to Many`, `Many to Many`) and Media (`File`, `Image`, `Files`) fields in Likha ERP (`https://gabay.zyberlab.com`), update the client API adapter, and harmonize the LMS frontend with full test validation.

**Architecture:** Interactive configuration of media and relational fields via Directus Data Studio UI (`browser_subagent`) to ensure zero DDL outages on the live server. Updating `likhaLmsApi.ts` with deep relational queries (`fields=*.*`) and resilient object normalizers in `LMSContext.tsx` to handle expanded relations and Directus asset URLs.

**Tech Stack:** Directus 11.17.4 (Likha ERP), React 19, TypeScript, Vitest, Vite Proxy, Browser Subagent.

**Spec:** [`docs/superpowers/specs/2026-10-14-likha-erp-relational-and-media-fields-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-14-likha-erp-relational-and-media-fields-design.md)

## Global Constraints

- ZERO REST API DDL/schema calls (`/fields`, `/relations`, `/collections`) against `https://gabay.zyberlab.com` — all schema/interface changes must be made via `browser_subagent` in Directus Admin UI as per [AGENTS.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md).
- Preserve 100% test pass rate across both server (400 tests) and client (325 tests) test suites.
- Maintain backward-compatible normalizers so the frontend gracefully supports both expanded relational objects (`{ id, first_name, ... }`) and legacy string IDs (`"u-student1"`).

---

### Task 1: Directus Media Fields Configuration via Browser Subagent

**Files:**
- Visual Verification: `docs/superpowers/plans/likha_media_fields_verified.png`
- Test: Directus Data Studio UI check via `browser_subagent`

**Interfaces:**
- Consumes: Directus Data Studio UI (`https://gabay.zyberlab.com/admin/settings/data-model`)
- Produces:
  - `courses.cover_image` (`Image` interface $\rightarrow$ `directus_files`)
  - `course_files.file` (`File` interface $\rightarrow$ `directus_files`)
  - `submissions.file` (`File` interface $\rightarrow$ `directus_files`)
  - `activities.attachments` (`Files` interface $\rightarrow$ `directus_files`)
  - `announcements.attachments` (`Files` interface $\rightarrow$ `directus_files`)

- [ ] **Step 1: Inspect existing media fields in Data Studio**

Run `browser_subagent` to open `https://gabay.zyberlab.com/admin/settings/data-model/courses` and check the field list.

- [ ] **Step 2: Add `cover_image` Image field to `courses`**

In Directus Data Model for `courses`:
- Click "Create Field" $\rightarrow$ Select "Relational" $\rightarrow$ "Image".
- Key: `cover_image`, Name: `Cover Image`.
- Related Collection: `directus_files`.
- Save field.

- [ ] **Step 3: Add `file` File field to `course_files` & `submissions`**

In Directus Data Model:
- On `course_files`: Add Relational $\rightarrow$ "File", Key: `file`, Name: `File`, Related Collection: `directus_files`.
- On `submissions`: Add Relational $\rightarrow$ "File", Key: `file`, Name: `File`, Related Collection: `directus_files`.
- Save fields.

- [ ] **Step 4: Add `attachments` Files field to `activities` & `announcements`**

In Directus Data Model:
- On `activities`: Add Relational $\rightarrow$ "Files", Key: `attachments`, Name: `Attachments`, Related Collection: `directus_files`.
- On `announcements`: Add Relational $\rightarrow$ "Files", Key: `attachments`, Name: `Attachments`, Related Collection: `directus_files`.
- Save fields.

- [ ] **Step 5: Verify media fields and capture screenshot**

Use `browser_subagent` to verify all 5 media fields show the green Image/File/Files badge and capture `likha_media_fields_verified.png`.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/likha_media_fields_verified.png
git commit -m "docs(verify): verify Directus media fields configuration in Likha ERP"
```

---

### Task 2: Directus User Many-to-One (M2O) Relations Configuration via Browser Subagent

**Files:**
- Visual Verification: `docs/superpowers/plans/likha_user_m2o_verified.png`
- Test: Directus Data Studio UI check via `browser_subagent`

**Interfaces:**
- Consumes: Directus Data Studio UI
- Produces:
  - `courses.instructor_id` (M2O $\rightarrow$ `directus_users`)
  - `submissions.student_id` (M2O $\rightarrow$ `directus_users`)
  - `course_files.uploaded_by` (M2O $\rightarrow$ `directus_users`)
  - `announcements.author_id` (M2O $\rightarrow$ `directus_users`)
  - `discussions.author_id` (M2O $\rightarrow$ `directus_users`)
  - `notifications.user_id` (M2O $\rightarrow$ `directus_users`)

- [ ] **Step 1: Check existing user fields across target collections**

Run `browser_subagent` to inspect `courses`, `submissions`, `course_files`, `announcements`, `discussions`, and `notifications`.

- [ ] **Step 2: Configure M2O relation to `directus_users` on each collection**

In Directus Data Model:
- On `courses`: Ensure `instructor_id` relationship points to `directus_users` with dropdown/avatar interface.
- On `submissions`: Ensure `student_id` relationship points to `directus_users`.
- On `course_files`: Ensure `uploaded_by` relationship points to `directus_users`.
- On `announcements`: Ensure `author_id` relationship points to `directus_users`.
- On `discussions`: Ensure `author_id` relationship points to `directus_users`.
- On `notifications`: Ensure `user_id` relationship points to `directus_users`.

- [ ] **Step 3: Capture screenshot of configured M2O relations**

Use `browser_subagent` to capture `likha_user_m2o_verified.png` showing `directus_users` M2O badges.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/likha_user_m2o_verified.png
git commit -m "docs(verify): verify Directus user M2O relations in Likha ERP"
```

---

### Task 3: Course Enrollments Many-to-Many (M2M) Junction Collection Creation

**Files:**
- Visual Verification: `docs/superpowers/plans/likha_m2m_enrollments_verified.png`
- Test: Directus Data Studio UI check via `browser_subagent`

**Interfaces:**
- Consumes: Directus Data Studio UI
- Produces:
  - Collection `course_enrollments` (`id`, `role`, `status`, `enrolled_at`, `final_grade`, `course_id` M2O `courses`, `user_id` M2O `directus_users`)
  - `courses.enrolled_students` (M2M interface)

- [ ] **Step 1: Create `course_enrollments` collection in Data Studio**

Run `browser_subagent` navigating to `https://gabay.zyberlab.com/admin/settings/data-model/+`:
- Name: `Course Enrollments`, Collection: `course_enrollments`.
- Primary Key: `id` (UUID generated).
- Fields:
  - `role`: Type string, Interface dropdown (`student`, `teaching_assistant`, `auditor`).
  - `status`: Type string, Interface dropdown (`active`, `pending`, `dropped`, `completed`), default `active`.
  - `enrolled_at`: Type datetime, Interface datetime.
  - `final_grade`: Type string, Interface input.

- [ ] **Step 2: Add M2O relationships for `course_id` and `user_id`**

On `course_enrollments`:
- Add Relational $\rightarrow$ Many to One, Field: `course_id`, Related Collection: `courses`.
- Add Relational $\rightarrow$ Many to One, Field: `user_id`, Related Collection: `directus_users`.

- [ ] **Step 3: Expose `enrolled_students` on `courses`**

On `courses`:
- Add Relational $\rightarrow$ Many to Many (or One to Many via `course_enrollments`), Field: `enrolled_students`.
- Related Collection: `course_enrollments`.
- Save configuration.

- [ ] **Step 4: Seed sample enrollment records and capture screenshot**

Seed active enrollment for `student1@dmmmsu.edu.ph` in `c-cs101` and capture `likha_m2m_enrollments_verified.png`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/likha_m2m_enrollments_verified.png
git commit -m "docs(verify): verify course_enrollments M2M junction in Likha ERP"
```

---

### Task 4: Client API Adapter Expansion ([likhaLmsApi.ts](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/api/likhaLmsApi.ts))

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Likha ERP Directus endpoints (`/items/courses`, `/items/activities`, `/items/submissions`, `/items/course_files`, `/items/announcements`, `/items/course_enrollments`, `/files`)
- Produces:
  - `getCoursesWithRelations()`: includes `cover_image.*`, `instructor_id.*`, `enrolled_students.*`
  - `getActivitiesWithRelations()`: includes `attachments.directus_files_id.*`
  - `getSubmissions()`: includes `file.*`, `student_id.*`
  - `getCourseFiles()`: includes `file.*`, `uploaded_by.*`
  - `getAnnouncements()`: includes `attachments.directus_files_id.*`, `author_id.*`
  - `getCourseEnrollments(courseId)`: queries `course_enrollments`
  - `uploadFile(file: File)`: multipart upload to `/files`

- [ ] **Step 1: Write failing unit test for relational queries in `likhaLmsApi.test.ts`**

Add tests in `client/src/shared/api/likhaLmsApi.test.ts`:
```typescript
it('requests courses with cover_image, instructor_id, and enrolled_students relations', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: [{ id: 'c-1', title: 'Test Course', cover_image: { id: 'img-1' }, instructor_id: { id: 'u-1', first_name: 'Maria' } }],
    }),
  } as any);

  const courses = await likhaLmsApi.getCoursesWithRelations();
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('cover_image.*'),
    expect.any(Object)
  );
  expect(courses[0].cover_image.id).toBe('img-1');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`
Expected: FAIL due to missing `cover_image.*` parameter in URL.

- [ ] **Step 3: Update `likhaLmsApi.ts` query strings & upload helper**

Update `likhaLmsApi.ts`:
- Update `getCoursesWithRelations` query URL to include `cover_image.*,instructor_id.*,enrolled_students.*,enrolled_students.user_id.*`.
- Update `getActivitiesWithRelations` query URL to include `attachments.directus_files_id.*`.
- Update `getSubmissions` to include `file.*,student_id.*`.
- Update `getCourseFiles` to include `file.*,uploaded_by.*`.
- Add `getCourseEnrollments(courseId)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
git commit -m "feat(api): expand Likha API adapter with deep relational queries and file attachments"
```

---

### Task 5: LMSContext Normalization & Frontend Integration ([LMSContext.tsx](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/context/LMSContext.tsx))

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: `client/src/shared/context/LMSContext.*.test.tsx`

**Interfaces:**
- Consumes: Expanded relational responses from `likhaLmsApi`
- Produces:
  - Formatted `User` instances from `instructor_id` / `student_id` / `author_id`
  - Formatted asset URLs for `cover_image`, `file`, and `attachments`
  - Populated course student rosters from `course_enrollments`

- [ ] **Step 1: Write failing test for relational normalizer in `LMSContext`**

Add unit test verifying that when `course.instructor_id` is an expanded object `{ id: 'u-1', first_name: 'Dr. Maria', last_name: 'Santos' }`, the course instructor name is correctly set to `"Dr. Maria Santos"`, and cover image resolves to `/assets/img-1`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/shared/context/LMSContext.courses.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement resilient normalization in `LMSContext.tsx`**

In `LMSContext.tsx`:
- Add `resolveUser(userOrId)` helper supporting both populated user objects and ID lookups.
- Add `resolveAssetUrl(fileOrId)` helper resolving Directus asset URLs.
- Map `course_enrollments` to `course.enrolledStudents` array.

- [ ] **Step 4: Run full client test suite**

Run: `npm --prefix client test -- --run`
Expected: PASS (all 61 test files pass, 325+ tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/
git commit -m "feat(context): normalize Directus relational user and media objects"
```

---

### Task 6: Full System Integration & Live Browser Verification

**Files:**
- Visual Recording: `lms_relational_media_verify.webp`
- Documentation: Update `task-full-likha-report.md`

**Interfaces:**
- Consumes: Live dev server at `http://localhost:5173` & Likha ERP at `https://gabay.zyberlab.com`
- Produces: End-to-end verified course cover image, user profile avatar, student roster from M2M enrollments, and file attachment uploads.

- [ ] **Step 1: Start dev servers**

Launch Express on port 4001 and Vite client on port 5173.

- [ ] **Step 2: Execute browser verification via `browser_subagent`**

Navigate `browser_subagent` to `http://localhost:5173/login`:
- Log in as Faculty 1.
- Open CS101 Course page: verify course cover image renders from Directus asset URL.
- Open People / Roster tab: verify enrolled students populate from `course_enrollments`.
- Open Files tab: verify file download links point to Directus assets.
- Capture recording: `lms_relational_media_verify.webp`.

- [ ] **Step 3: Run full test suites**

Run:
- `npm --prefix server test -- --run`
- `npm --prefix client test -- --run`
Expected: 100% pass across all 725+ tests.

- [ ] **Step 4: Update report and commit**

Update `task-full-likha-report.md` with relational & media architecture verification.
```bash
git add task-full-likha-report.md
git commit -m "docs(report): update completion report with relational and media fields verification"
```
