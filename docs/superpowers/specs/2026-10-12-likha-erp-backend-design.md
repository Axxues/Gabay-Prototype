# Architecture Specification: Likha ERP Backend Integration for Gabay-Prototype

**Date:** 2026-10-12  
**Status:** Approved  
**Target Domain:** `https://gabay.zyberlab.com/`  
**SDK:** `@likha-erp/likha-sdk` (v1.0.7+)  
**Admin Service Account:** `jayveegenetareyes@gmail.com`  

---

## 1. Executive Summary

This specification outlines the architectural refactoring of the GABAY LMS and RAG backend to utilize **Likha ERP** (`https://gabay.zyberlab.com/`) as its primary data store and identity management provider.

The existing Express backend at `http://localhost:4001` is retained as an intelligent API Gateway and orchestration server for the frontend, preserving:
1. Exact HTTP/REST endpoint contracts expected by the React/Vite client.
2. The hierarchical multi-agent Retrieval-Augmented Generation (RAG) system, benchmark evaluators, and n8n webhook telemetry.
3. Decoupled data persistence through a newly implemented **Likha ERP Repository Layer** built with `@likha-erp/likha-sdk`.

---

## 2. System Architecture

```mermaid
graph TD
    Client["Gabay Frontend (React / Vite)"] -->|/api/* requests| Express["Gabay Express Server (port 4001)"]
    
    subgraph Backend Services
        Express -->|Delegated Auth & LMS Repositories| LikhaService["Likha ERP Service Layer (@likha-erp/likha-sdk)"]
        Express -->|AI Inference & Vector Retrieval| RAG["RAG Multi-Agent & n8n Workflows"]
        RAG -->|Read Course/Syllabus Entities| LikhaService
    end

    LikhaService -->|REST HTTPS (Bearer Auth)| LikhaERP["Likha ERP Cloud (https://gabay.zyberlab.com/)"]
```

### 2.1 Component Responsibilities

1. **Frontend (`client/`)**: Unchanged REST consumer. Continues sending requests to `/api/*` proxied by Vite to Express on port 4001.
2. **Express API Server (`server/`)**: 
   - Acts as an authenticated gateway.
   - Enforces request validation, security headers, file stream uploads, and error normalization.
   - Orchestrates multi-agent RAG reasoning and benchmark evaluations.
3. **Likha ERP Service Layer (`server/src/likha/`)**:
   - Manages Likha ERP connectivity, authentication tokens, and query abstractions.
   - Converts Directus/Likha collection data structures into strongly typed Gabay domain models.
4. **Likha ERP Instance (`https://gabay.zyberlab.com/`)**:
   - Manages user identities, secure password hashing, roles, and relational collections for LMS domain entities.

---

## 3. Data Modeling & Schema Provisioning

### 3.1 Collections Specification

Likha ERP operates on a Directus-compatible data engine. The following collections will be provisioned via the Likha ERP Schema API:

| Collection Name | Purpose | Primary Fields & Types | Relational Links |
|---|---|---|---|
| `directus_users` *(existing)* | System users & profiles | `id` (uuid), `email` (string), `first_name` (string), `last_name` (string), `role` (uuid), `student_id` (string), `department` (string), `user_role` (string), `banner` (string), `student_type` (string), `avatar` (string) | Directus system users |
| `courses` | Academic course offerings | `id` (string pk), `code` (string), `title` (string), `section` (string), `term` (string), `published` (boolean), `color` (string), `image` (string), `enrolled_count` (int), `credits` (int), `ched_compliance_code` (string), `join_code` (string), `syllabus` (json), `spr_config` (json), `grading_terms` (json), `grades_released` (json) | `instructor_id` -> `directus_users` |
| `course_sections` | Schedule sections per course | `id` (string pk), `name` (string), `capacity` (int), `enrolled_count` (int), `schedule` (string), `location` (string) | `course_id` -> `courses` |
| `enrollment_requests` | Student course join & section switch requests | `id` (string pk), `student_name` (string), `type` (string), `status` (string), `requested_at` (dateTime), `resolved_at` (dateTime), `resolved_by` (string), `section_id` (string), `target_section_id` (string) | `course_id` -> `courses`, `student_id` -> `directus_users` |
| `modules` | Learning units / modules | `id` (string pk), `title` (string), `order` (int), `published` (boolean), `prerequisite_module_id` (string), `author_name` (string) | `course_id` -> `courses`, `author_id` -> `directus_users` |
| `module_items` | Content items within modules | `id` (string pk), `title` (string), `type` (string), `published` (boolean), `required` (boolean), `content` (text), `url` (string), `duration` (string), `points` (int), `due_date` (string), `order` (int) | `module_id` -> `modules` |
| `module_comments` | Student & faculty discussions on modules | `id` (string pk), `content` (text), `parent_id` (string), `created_at` (dateTime), `likes` (json), `author_name` (string) | `module_id` -> `modules`, `author_id` -> `directus_users` |
| `activities` | Tasks, homework, problem sets | `id` (string pk), `title` (string), `description` (text), `term` (string), `format` (string), `category` (string), `weight` (float), `due_date` (dateTime), `available_from` (dateTime), `available_until` (dateTime), `questions` (json), `rubric` (json), `published` (boolean), `total_points` (int) | `course_id` -> `courses` |
| `quizzes` | Practice & graded quizzes | `id` (string pk), `title` (string), `description` (text), `term` (string), `time_limit_minutes` (int), `due_date` (dateTime), `questions` (json), `published` (boolean), `total_points` (int) | `course_id` -> `courses` |
| `exams` | Midterm & Final examination records | `id` (string pk), `title` (string), `description` (text), `term` (string), `time_limit_minutes` (int), `due_date` (dateTime), `questions` (json), `published` (boolean), `total_points` (int) | `course_id` -> `courses` |
| `submissions` | Student assessment submissions & grading | `id` (string pk), `status` (string), `score` (float), `max_score` (float), `submitted_at` (dateTime), `graded_at` (dateTime), `graded_by` (string), `answers` (json), `rubric_scores` (json), `comments` (json), `file_url` (string), `file_name` (string), `content` (text) | `course_id` -> `courses`, `student_id` -> `directus_users`, `activity_id` -> `activities`, `quiz_id` -> `quizzes`, `exam_id` -> `exams` |
| `announcements` | Course-wide announcements | `id` (string pk), `title` (string), `content` (text), `pinned` (boolean), `created_at` (dateTime), `likes` (json), `replies` (json), `author_name` (string), `author_avatar` (string) | `course_id` -> `courses`, `author_id` -> `directus_users` |
| `discussions` | Course topic threads & forums | `id` (string pk), `title` (string), `content` (text), `pinned` (boolean), `locked` (boolean), `created_at` (dateTime), `replies` (json), `author_name` (string) | `course_id` -> `courses`, `author_id` -> `directus_users` |
| `messages` | Direct messages & group messages | `id` (string pk), `subject` (string), `body` (text), `read` (boolean), `created_at` (dateTime), `attachment_name` (string), `attachment_url` (string), `group_id` (string) | `sender_id` -> `directus_users`, `recipient_id` -> `directus_users`, `course_id` -> `courses` |
| `chat_groups` | Group messaging channels | `id` (string pk), `name` (string), `member_ids` (json), `created_at` (dateTime) | `course_id` -> `courses` |
| `calendar_events` | Class events, exams, milestones | `id` (string pk), `title` (string), `date` (string), `start_time` (string), `end_time` (string), `type` (string), `location` (string), `description` (text), `all_day` (boolean) | `course_id` -> `courses`, `user_id` -> `directus_users` |
| `advising_slots` | Faculty consultation slots | `id` (string pk), `date` (string), `time_slot` (string), `location` (string), `status` (string), `booked_by_name` (string) | `faculty_id` -> `directus_users`, `booked_by_id` -> `directus_users` |
| `course_files` & `course_folders` | Learning materials & file storage | `id` (string pk), `name` (string), `size` (int), `type` (string), `url` (string), `visibility` (string), `parent_id` (string), `auto_key` (string) | `course_id` -> `courses`, `uploaded_by` -> `directus_users` |
| `course_grades` | Final & Midterm grade reports | `id` (string pk), `midterm_grade` (float), `final_grade` (float), `spr_cells` (json), `updated_at` (dateTime) | `course_id` -> `courses`, `student_id` -> `directus_users` |
| `syllabi` | Relational & JSON syllabus versions | `id` (string pk), `version` (int), `status` (string), `content` (json), `published_at` (dateTime), `created_at` (dateTime) | `course_id` -> `courses` |

### 3.2 Automated Schema Provisioning (`scripts/provision-likha-schema.ts`)
- Authenticates using `LIKHA_ADMIN_EMAIL` and `LIKHA_ADMIN_PASSWORD`.
- Inspects existing collections via `GET /collections`.
- Creates missing collections via `POST /collections`.
- Inspects existing fields via `GET /fields/:collection` and creates missing fields via `POST /fields/:collection`.
- Configures role read/write permissions via `POST /permissions` for Administrator, Faculty, Student, and Staff roles.

### 3.3 Data Seeding (`scripts/seed-likha-data.ts`)
- Populates seed users:
  - Admin: `jayveegenetareyes@gmail.com`
  - Faculty: `faculty1@dmmmsu.edu.ph` (`faculty2026`)
  - Student: `student1@dmmmsu.edu.ph` (`gabay2026`)
- Populates seed courses:
  - `CS 101`: Introduction to Computing
  - `CS 102`: Computer Programming 1
  - `CS 103`: Data Structures and Algorithms
- Populates course modules, official syllabus JSON data, sample activities, quizzes, and grade records.

---

## 4. Authentication & Identity Flow

### 4.1 Role Mapping

| Likha ERP Role Name | Likha Role UUID | Gabay Frontend `UserRole` |
|---|---|---|
| **Administrator** | `f927940e-7f3f-49d4-8c80-a6ccd2167e18` | `'admin'` |
| **Faculty** | `2e1047c9-1f10-4ae2-b131-6345c7814a6b` | `'faculty'` |
| **Student** | `98a212b2-9482-4ca5-8f67-825699575f3c` | `'student'` |
| **Staff** | `c7d14be0-4259-46d7-b4b6-37db1221a0e9` | `'staff'` |

### 4.2 Login (`POST /api/auth/login`)
1. Client sends `{ email, password }`.
2. Express invokes Likha ERP `POST /auth/login`.
3. Likha ERP validates credentials and returns `{ access_token, refresh_token, expires }`.
4. Express queries `GET /users/me` with the bearer token to retrieve role and user attributes.
5. Express maps fields to the standard Gabay `User` schema:
   - `id`: Likha user UUID
   - `name`: `${first_name} ${last_name}`.trim() || email
   - `email`: user email
   - `role`: mapped role string
   - `studentId`: `user.student_id`
   - `department`: `user.department`
   - `avatar`: `user.avatar`
   - `banner`: `user.banner`
   - `enrolledCourseIds`: list of course IDs where student has approved enrollment
6. Returns `{ user, token: access_token, refreshToken: refresh_token }`.

### 4.3 Session Restore (`GET /api/auth/me`)
- Reads Bearer token from header.
- Calls Likha `GET /users/me`. If invalid or expired, attempts token refresh via Likha `POST /auth/refresh`.
- Returns full Gabay `User` profile.

---

## 5. Repository Layer Implementation (`server/src/likha/`)

### 5.1 Architecture
The repository layer decouples Express route handlers from database details:

```
server/src/likha/
├── client.ts                 # Likha SDK initialization & token management
├── types.ts                  # Directus collection type definitions
├── repositories/
│   ├── usersRepo.ts          # Authentication, user profiles, enrollments
│   ├── coursesRepo.ts        # Courses, course sections, join codes, requests
│   ├── modulesRepo.ts        # Modules, items, comments, likes
│   ├── assessmentsRepo.ts    # Activities, quizzes, exams, submissions, grades
│   ├── syllabiRepo.ts        # Syllabus documents, section revisions, RAG projection
│   ├── communicationsRepo.ts # Announcements, discussions, messages, notifications
│   ├── calendarRepo.ts       # Events, advising slots
│   └── filesRepo.ts          # Course files, folders, permissions
```

### 5.2 Error Handling
- All repository methods wrap SDK invocations in try-catch blocks.
- Check errors using `isLikhaError(err)` to extract status codes and messages.
- Provide sensible defaults or throw structured errors handled by Express `errorMiddleware`.

---

## 6. Multi-Agent RAG Integration

The 7-agent RAG pipeline (`CoordinatorAgent`, `CourseInfoAgent`, `SyllabusAgent`, `AssessmentAgent`, `AcademicAgent`, `AdvisorAgent`, `GeneralInquiryAgent`) and baseline comparison endpoints (`/api/rag`, `/api/rag-baseline`, `/api/rag-aggregate`, `/api/rag-export`) are preserved:
- `syllabiRepo.getRAGContext(courseId)` reads syllabus text and course metadata directly from Likha ERP collections.
- Multi-agent orchestration, n8n webhook triggers, and accuracy evaluations continue operating seamlessly without dependence on local SQL Server.

---

## 7. Verification & Acceptance Criteria

1. **Schema Provisioning**:
   - `npx tsx scripts/provision-likha-schema.ts` runs against `https://gabay.zyberlab.com/` and exits with code 0.
   - All 14 LMS collections are verified visible and queryable in Likha ERP.
2. **Data Seeding**:
   - `npx tsx scripts/seed-likha-data.ts` creates initial faculty, student, courses, and syllabus entries in Likha ERP.
3. **Automated Test Suites**:
   - `npm test` in `server/`: 100% tests passing across all repository and route suites.
   - `npx vitest run` in `client/`: all 320 client tests passing.
4. **Build & Typecheck**:
   - `npm run build` in `server/`: compiles cleanly with 0 TypeScript errors.
   - `npm run build` in `client/`: compiles cleanly with 0 TypeScript errors.
5. **Interactive Browser Verification**:
   - Successful login with Likha credentials on `http://localhost:5173`.
   - Complete navigation of Dashboard, Courses, Syllabus, Assessments, and Gradebook.
   - Successful query submission to GABAY RAG Chatbot displaying response streaming.
