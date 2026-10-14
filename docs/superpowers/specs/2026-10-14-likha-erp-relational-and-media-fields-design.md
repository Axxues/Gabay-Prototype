# Specification: Likha ERP Full Relational & Media Fields Architecture

**Date:** October 14, 2026  
**Status:** Approved for Implementation  
**Target Backend:** Likha ERP Directus (`https://gabay.zyberlab.com`)  
**Target Clients:** Gabay LMS Client (`client/`) & Express Microservice (`server/`)  

---

## 1. Overview & Objective

To fully utilize Likha ERP (Directus) as a complete enterprise backend replacement for the GABAY LMS, this specification establishes native Directus Relational (`Many to One`, `One to Many`, `Many to Many`) and Media (`File`, `Image`, `Files`) fields across all academic collections.

### Core Goals:
1. **Media Asset Integration:** Utilize Directus native media types (`File`, `Image`, `Files`) backed by `directus_files` for course cover images, downloadable materials, student submission files, and activity attachments.
2. **Relational Data Integrity:** Replace flat string ID references (`instructor_id`, `student_id`, `author_id`) with formal `Many to One` (M2O) relations pointing to `directus_users`.
3. **Many to Many (M2M) Enrollment Junction:** Establish a dedicated `course_enrollments` collection that models student-course enrollments with academic metadata (`role`, `status`, `enrolled_at`, `final_grade`).
4. **Safety & Zero DDL Rest API Calls:** Maintain strict compliance with [AGENTS.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md). All collection creation, relation setup, and field interface configurations must be executed interactively via the Directus Data Studio UI (`browser_subagent`) to prevent unhandled host exceptions and server outages.
5. **Client Adapter Harmonization:** Extend [`likhaLmsApi.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/api/likhaLmsApi.ts) with deep relational query fields and robust object normalizers that maintain 100% test compatibility.

---

## 2. Directus Data Model Specification

### 2.1 Media Fields (`directus_files`)

| Collection | Field Key | Type | Interface | Related Collection | Description & Usage |
|---|---|---|---|---|---|
| `courses` | `cover_image` | `uuid` (M2O) | `image` | `directus_files` | Course card banner & catalog preview image. |
| `course_files` | `file` | `uuid` (M2O) | `file` | `directus_files` | Course reference materials (syllabi, slides, PDFs). |
| `submissions` | `file` | `uuid` (M2O) | `file` | `directus_files` | Uploaded student submission file/document. |
| `activities` | `attachments` | M2M | `files` | `directus_files` | Reference files, datasets, and rubrics attached by instructor. |
| `announcements` | `attachments` | M2M | `files` | `directus_files` | Attached circulars, schedules, and documents. |

---

### 2.2 Relational User Fields (`directus_users`)

| Collection | Field Key | Type | Interface | Related Collection | Foreign Key Target |
|---|---|---|---|---|---|
| `courses` | `instructor_id` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Course instructor (renders name, email, avatar). |
| `submissions` | `student_id` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Submitting student. |
| `course_files` | `uploaded_by` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Uploader identity. |
| `announcements` | `author_id` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Announcement publisher. |
| `discussions` | `author_id` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Discussion topic creator. |
| `notifications` | `user_id` | `uuid` (M2O) | `select-dropdown-m2o` | `directus_users` | Notification recipient. |

---

### 2.3 Course Enrollment Many-to-Many (M2M) Junction Collection

A new dedicated collection `course_enrollments` will be created in Directus Data Studio to represent the many-to-many relationship between courses and students:

- **Collection Name:** `course_enrollments`
- **Fields:**
  - `id`: Primary key (UUID, generated automatically)
  - `course_id`: Many-to-One $\rightarrow$ `courses` (cascade on delete)
  - `user_id`: Many-to-One $\rightarrow$ `directus_users` (cascade on delete)
  - `role`: Dropdown (`student`, `teaching_assistant`, `auditor`) default `student`
  - `status`: Dropdown (`active`, `pending`, `dropped`, `completed`) default `active`
  - `enrolled_at`: Datetime (default `NOW()`)
  - `final_grade`: String / Decimal (nullable)
- **Course Collection M2M Interface:**
  - Exposed on `courses` collection as `enrolled_students` with an interactive list interface allowing instructors to view, add, and manage enrolled students.

---

## 3. Client API Adapter & Data Flow

### 3.1 Directus Query AST Deep Relations
In [`client/src/shared/api/likhaLmsApi.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/api/likhaLmsApi.ts), domain fetching methods will expand the relational and media fields:

```typescript
// Courses with media, instructor, and enrolled students
GET /items/courses?fields=*,cover_image.*,instructor_id.id,instructor_id.first_name,instructor_id.last_name,instructor_id.avatar,enrolled_students.*,enrolled_students.user_id.id,enrolled_students.user_id.first_name,enrolled_students.user_id.last_name,enrolled_students.user_id.email,modules.*,modules.items.*,activities.*

// Activities with attachments
GET /items/activities?filter[course_id][_eq]=${courseId}&fields=*,attachments.directus_files_id.*,questions.*,rubrics.*

// Submissions with uploaded file and student profile
GET /items/submissions?filter[activity_id][_eq]=${activityId}&fields=*,file.*,student_id.id,student_id.first_name,student_id.last_name,student_id.avatar,answers.*

// Course files with file metadata and uploader
GET /items/course_files?filter[course_id][_eq]=${courseId}&fields=*,file.*,uploaded_by.id,uploaded_by.first_name,uploaded_by.last_name
```

### 3.2 Media Upload Method
Directus `/files` accepts standard `multipart/form-data`:
```typescript
async uploadFile(file: File): Promise<{ id: string; filename_download: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const json = await likhaRequest<{ data: { id: string; filename_download: string } }>('/files', {
    method: 'POST',
    body: formData,
  });
  return {
    id: json.data.id,
    filename_download: json.data.filename_download || file.name,
    url: `${LIKHA_URL}/assets/${json.data.id}`,
  };
}
```

### 3.3 Normalization in LMSContext
To ensure complete backward compatibility:
- **Instructor / Student Resolution:** If `instructor_id` is an expanded object, construct `{ id, name: `${first_name} ${last_name}`, avatar }`. If a string, look up the user in `db.users`.
- **File Asset Resolution:** Construct download URLs from `${LIKHA_URL}/assets/${file.id}/${file.filename_download}`.
- **Roster Resolution:** Derive course roster from `course.enrolled_students` mapped with student user details.

---

## 4. Execution Plan & Rollout Strategy

### 4.1 Safety Constraints
- **Strict adherence to [AGENTS.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md):** No REST API DDL mutations (`POST /fields`, `POST /relations`, `POST /collections`).
- **Interactive Browser Subagent Execution:** All Directus schema alterations will be performed via `browser_subagent` accessing `https://gabay.zyberlab.com/admin/settings/data-model`.

### 4.2 Implementation Phases
1. **Phase 1: Directus Schema Configuration via Browser Subagent**
   - Create `course_enrollments` collection with metadata fields.
   - Configure `course_id` (M2O `courses`) and `user_id` (M2O `directus_users`).
   - Configure `courses.cover_image` (`Image` $\rightarrow$ `directus_files`).
   - Configure `course_files.file` (`File` $\rightarrow$ `directus_files`).
   - Configure `submissions.file` (`File` $\rightarrow$ `directus_files`).
   - Configure `activities.attachments` and `announcements.attachments` (`Files` $\rightarrow$ `directus_files`).
   - Configure M2O user fields on `courses`, `submissions`, `course_files`, `announcements`, `discussions`, and `notifications`.
2. **Phase 2: Client Adapter & Context Enhancement**
   - Update `likhaLmsApi.ts` endpoints to query deep relational fields.
   - Update `LMSContext.tsx` normalization for media and user objects.
3. **Phase 3: Verification & Test Suite Validation**
   - Update `likhaLmsApi.test.ts` to assert relational queries.
   - Run full client and server test suites (725+ tests).
   - Perform live browser E2E test to upload a file and view relational cards.

---

## 5. Acceptance Criteria

1. **Directus Admin UI:**
   - In `https://gabay.zyberlab.com/admin/settings/data-model`, `courses`, `course_files`, `submissions`, `activities`, and `announcements` display native Directus badges for `Image`, `File`, `Files`, `Many to One`, and `Many to Many`.
   - Editing an item displays the native File upload/preview component and User dropdown with avatar.
2. **Database Integrity:**
   - Course enrollments are tracked in `course_enrollments` linking courses and users.
   - Zero HTTP 502 errors or Directus host crashes during and after configuration.
3. **Application Functionality:**
   - Course cover images render in LMS course cards.
   - File uploads in course files and submissions store files in Directus assets and provide working download links.
   - Client and server test suites pass 100% (725/725 tests).
