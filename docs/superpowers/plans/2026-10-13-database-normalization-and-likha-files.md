# Database Relational Normalization & Likha ERP File Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely normalize all database entities in Likha ERP (including every section of the course syllabus, assessment questions, rubrics, SPR grade cells, and grading terms) and link all LMS file and image uploads directly to Likha ERP Directus `/files` storage.

**Architecture:** Create normalized Directus collections in Likha ERP via Directus API with foreign key relations, unpack legacy JSON blobs into child rows, update Express backend Likha repositories to read/write relationally with full client DTO compatibility, and implement a centralized file streaming bridge that uploads assets directly to `${LIKHA_URL}/files` (`directus_files`) and returns `${LIKHA_URL}/assets/:id`.

**Tech Stack:** TypeScript, Node.js, Express, Likha ERP (Directus REST API), Prisma, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-13-database-normalization-and-likha-files-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-13-database-normalization-and-likha-files-design.md)

## Global Constraints
- Likha ERP (`https://gabay.zyberlab.com`) is the single source of truth for cloud collections and files.
- Zero breaking changes to client API contracts (LMS frontend Vitest suite must maintain 100% pass rate).
- No local filesystem `/uploads` disk dependencies for newly uploaded files or images.
- All schema migrations and unpacking operations must be idempotent.

---

### Task 1: Likha ERP Cloud File Storage Service Bridge

**Files:**
- Create: `server/src/likha/services/fileStorageService.ts`
- Test: `server/src/likha/services/fileStorageService.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LikhaUploadedFile {
    id: string;
    filename_download: string;
    type: string;
    filesize: number;
    url: string;
  }
  export async function uploadFileToLikha(params: {
    buffer: Buffer | Blob;
    filename: string;
    mimetype: string;
    title?: string;
  }): Promise<LikhaUploadedFile>;
  export async function getLikhaFileUrl(fileId: string): Promise<string>;
  export async function deleteLikhaFile(fileId: string): Promise<void>;
  ```

- [ ] **Step 1: Write failing unit test for Likha file storage service**

Create `server/src/likha/services/fileStorageService.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadFileToLikha, getLikhaFileUrl, deleteLikhaFile } from './fileStorageService.js';

describe('Likha File Storage Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats asset URL correctly for a given file ID', async () => {
    const url = await getLikhaFileUrl('uuid-1234');
    expect(url).toBe('https://gabay.zyberlab.com/assets/uuid-1234');
  });

  it('uploads a file buffer to Likha ERP /files and returns file metadata and URL', async () => {
    const mockResponse = {
      data: {
        id: 'test-file-uuid',
        filename_download: 'syllabus.pdf',
        type: 'application/pdf',
        filesize: '1024',
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const result = await uploadFileToLikha({
      buffer: Buffer.from('dummy content'),
      filename: 'syllabus.pdf',
      mimetype: 'application/pdf',
      title: 'Course Syllabus',
    });

    expect(result.id).toBe('test-file-uuid');
    expect(result.url).toBe('https://gabay.zyberlab.com/assets/test-file-uuid');
    expect(result.filename_download).toBe('syllabus.pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/services/fileStorageService.test.ts` in `server/`  
Expected: FAIL with module not found or missing exports.

- [ ] **Step 3: Implement fileStorageService**

Create `server/src/likha/services/fileStorageService.ts`:
```ts
import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';
import { ApiError } from '../../utils/errors.js';

export interface LikhaUploadedFile {
  id: string;
  filename_download: string;
  type: string;
  filesize: number;
  url: string;
}

export async function getLikhaFileUrl(fileId: string): Promise<string> {
  return `${LIKHA_URL}/assets/${fileId}`;
}

export async function uploadFileToLikha(params: {
  buffer: Buffer | Blob;
  filename: string;
  mimetype: string;
  title?: string;
}): Promise<LikhaUploadedFile> {
  const token = await getLikhaAdminToken();
  const formData = new FormData();
  const blob = params.buffer instanceof Blob
    ? params.buffer
    : new Blob([params.buffer], { type: params.mimetype });

  formData.append('file', blob, params.filename);
  if (params.title) {
    formData.append('title', params.title);
  }

  const res = await fetch(`${LIKHA_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(502, 'likha_upload_failed', `Failed to upload file to Likha ERP: ${errorText}`);
  }

  const json = (await res.json()) as {
    data: {
      id: string;
      filename_download: string;
      type: string;
      filesize: string | number;
    };
  };

  const fileData = json.data;
  return {
    id: fileData.id,
    filename_download: fileData.filename_download || params.filename,
    type: fileData.type || params.mimetype,
    filesize: typeof fileData.filesize === 'string' ? parseInt(fileData.filesize, 10) : fileData.filesize,
    url: `${LIKHA_URL}/assets/${fileData.id}`,
  };
}

export async function deleteLikhaFile(fileId: string): Promise<void> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new ApiError(502, 'likha_delete_failed', `Failed to delete file from Likha ERP: ${errorText}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/services/fileStorageService.test.ts` in `server/`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/services/fileStorageService.ts server/src/likha/services/fileStorageService.test.ts
git commit -m "feat(likha): implement centralized Likha ERP file storage bridge"
```

---

### Task 2: Schema Migration Script for Normalized Likha Collections

**Files:**
- Create: `server/src/likha/migrations/initNormalizedSchema.ts`

**Interfaces:**
- Produces:
  `export async function ensureNormalizedLikhaSchema(): Promise<void>;`
  Creates collections and fields in Likha ERP:
  - `assessment_questions`
  - `rubric_criteria`
  - `rubric_levels`
  - `course_grading_terms`
  - `spr_cells`
  - `submission_answers`
  - `syllabus_course_info`
  - `syllabus_institution`
  - `syllabus_faculty`
  - `syllabus_program_outcomes`
  - `syllabus_course_outcomes`
  - `syllabus_course_maps`
  - `syllabus_learning_plans`
  - `syllabus_grading_systems`
  - `syllabus_rubrics`
  - `syllabus_rubric_criteria`
  - `syllabus_policies`
  - `syllabus_references`
  - `syllabus_signatories`

- [ ] **Step 1: Write idempotent migration script**

Create `server/src/likha/migrations/initNormalizedSchema.ts` with collection creation logic using Directus API:
```ts
import { likhaFetch } from '../client.js';

interface FieldDef {
  field: string;
  type: string;
  schema?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

interface CollectionDef {
  collection: string;
  fields: FieldDef[];
}

export async function ensureNormalizedLikhaSchema(): Promise<void> {
  const colRes = await likhaFetch('/collections');
  if (!colRes.ok) {
    throw new Error(`Failed to list collections: ${colRes.status}`);
  }
  const colJson = (await colRes.json()) as any;
  const existingCollections = new Set<string>((colJson.data || []).map((c: any) => c.collection));

  const collectionsToEnsure: CollectionDef[] = [
    {
      collection: 'assessment_questions',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'activity_id', type: 'string' },
        { field: 'quiz_id', type: 'string' },
        { field: 'exam_id', type: 'string' },
        { field: 'question_text', type: 'text' },
        { field: 'question_type', type: 'string' },
        { field: 'points', type: 'float' },
        { field: 'correct_answer', type: 'text' },
        { field: 'options_json', type: 'text' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'rubric_criteria',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'activity_id', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'description', type: 'text' },
        { field: 'max_points', type: 'float' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'rubric_levels',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'criterion_id', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'description', type: 'text' },
        { field: 'points', type: 'float' },
      ],
    },
    {
      collection: 'course_grading_terms',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'course_id', type: 'string' },
        { field: 'term', type: 'string' },
        { field: 'is_released', type: 'boolean' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'spr_cells',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'course_grade_id', type: 'string' },
        { field: 'student_id', type: 'string' },
        { field: 'course_id', type: 'string' },
        { field: 'term', type: 'string' },
        { field: 'component_key', type: 'string' },
        { field: 'score', type: 'float' },
      ],
    },
    {
      collection: 'submission_answers',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'submission_id', type: 'string' },
        { field: 'question_id', type: 'string' },
        { field: 'student_answer', type: 'text' },
        { field: 'awarded_points', type: 'float' },
        { field: 'feedback', type: 'text' },
      ],
    },
    {
      collection: 'syllabus_course_info',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'course_code', type: 'string' },
        { field: 'course_title', type: 'string' },
        { field: 'credits', type: 'integer' },
        { field: 'lecture_hours', type: 'integer' },
        { field: 'lab_hours', type: 'integer' },
        { field: 'prerequisites', type: 'string' },
        { field: 'semester', type: 'string' },
        { field: 'academic_year', type: 'string' },
        { field: 'rationale_description', type: 'text' },
      ],
    },
    {
      collection: 'syllabus_institution',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'university_name', type: 'string' },
        { field: 'campus_name', type: 'string' },
        { field: 'college_name', type: 'string' },
        { field: 'department_name', type: 'string' },
        { field: 'vision', type: 'text' },
        { field: 'mission', type: 'text' },
        { field: 'goals', type: 'text' },
      ],
    },
    {
      collection: 'syllabus_faculty',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'faculty_user_id', type: 'string' },
        { field: 'faculty_name', type: 'string' },
        { field: 'email', type: 'string' },
        { field: 'consultation_hours', type: 'string' },
        { field: 'office_room', type: 'string' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_program_outcomes',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'code', type: 'string' },
        { field: 'statement', type: 'text' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_course_outcomes',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'code', type: 'string' },
        { field: 'statement', type: 'text' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_course_maps',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'course_outcome_code', type: 'string' },
        { field: 'program_outcome_code', type: 'string' },
        { field: 'level', type: 'string' },
      ],
    },
    {
      collection: 'syllabus_learning_plans',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'unit_no', type: 'integer' },
        { field: 'time_allotment_weeks', type: 'string' },
        { field: 'intended_learning_outcome', type: 'text' },
        { field: 'topic_content', type: 'text' },
        { field: 'teaching_activities', type: 'text' },
        { field: 'assessment_tasks', type: 'text' },
        { field: 'learning_resources', type: 'text' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_grading_systems',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'lecture_weight', type: 'float' },
        { field: 'lab_weight', type: 'float' },
        { field: 'term_formula', type: 'string' },
        { field: 'passing_grade', type: 'float' },
        { field: 'components_summary', type: 'text' },
      ],
    },
    {
      collection: 'syllabus_rubrics',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'description', type: 'text' },
        { field: 'rubric_type', type: 'string' },
      ],
    },
    {
      collection: 'syllabus_policies',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'policy_type', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'content', type: 'text' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_references',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'author', type: 'string' },
        { field: 'year', type: 'string' },
        { field: 'url', type: 'string' },
        { field: 'order', type: 'integer' },
      ],
    },
    {
      collection: 'syllabus_signatories',
      fields: [
        { field: 'id', type: 'string', schema: { is_primary_key: true } },
        { field: 'syllabus_id', type: 'string' },
        { field: 'name', type: 'string' },
        { field: 'title', type: 'string' },
        { field: 'role', type: 'string' },
        { field: 'order', type: 'integer' },
      ],
    },
  ];

  for (const item of collectionsToEnsure) {
    if (!existingCollections.has(item.collection)) {
      console.log(`Creating collection ${item.collection}...`);
      const createRes = await likhaFetch('/collections', {
        method: 'POST',
        body: JSON.stringify({
          collection: item.collection,
          schema: {},
          meta: { note: `Normalized collection: ${item.collection}` },
          fields: item.fields,
        }),
      });
      if (!createRes.ok) {
        console.error(`Failed to create collection ${item.collection}:`, await createRes.text());
      } else {
        console.log(`Created collection ${item.collection} successfully.`);
      }
    }
  }
}
```

- [ ] **Step 2: Run migration script against Likha ERP**

Execute: `npx tsx server/src/likha/migrations/initNormalizedSchema.ts` (wrapped via runner script)  
Expected: All relational child collections created successfully with HTTP 200/204.

- [ ] **Step 3: Commit**

```bash
git add server/src/likha/migrations/initNormalizedSchema.ts
git commit -m "feat(likha): add idempotent schema migration for all normalized child collections"
```

---

### Task 3: Complete Syllabus Normalization in `syllabiRepo.ts`

**Files:**
- Modify: `server/src/likha/repositories/syllabiRepo.ts`
- Test: `server/src/likha/repositories/syllabiRepo.test.ts`

**Interfaces:**
- Consumes: Likha collections (`syllabi`, `syllabus_course_info`, `syllabus_institution`, `syllabus_faculty`, `syllabus_program_outcomes`, `syllabus_course_outcomes`, `syllabus_course_maps`, `syllabus_learning_plans`, `syllabus_grading_systems`, `syllabus_rubrics`, `syllabus_policies`, `syllabus_references`, `syllabus_signatories`)
- Produces:
  ```ts
  export async function getCourseSyllabus(courseId: string): Promise<any | null>;
  export async function saveCourseSyllabus(courseId: string, content: any): Promise<any>;
  ```

- [ ] **Step 1: Write unit tests for relational syllabus mapping**

Create `server/src/likha/repositories/syllabiRepo.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseSyllabus, saveCourseSyllabus } from './syllabiRepo.js';

describe('Syllabi Repository Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reconstructs normalized syllabus sections into full syllabus structure', async () => {
    // Mock getCourseSyllabus returning relational sections
    const mockSyllabusHeader = {
      data: [{ id: 'syl-1', course_id: 'c-cs101', version: 1, status: 'published' }],
    };
    const mockCourseInfo = {
      data: [{ syllabus_id: 'syl-1', course_code: 'CS101', course_title: 'Intro to AI' }],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/items/syllabi?')) {
        return { ok: true, json: async () => mockSyllabusHeader } as any;
      }
      if (u.includes('/items/syllabus_course_info?')) {
        return { ok: true, json: async () => mockCourseInfo } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const syl = await getCourseSyllabus('c-cs101');
    expect(syl).toBeDefined();
    expect(syl.courseInfo.code).toBe('CS101');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/repositories/syllabiRepo.test.ts` in `server/`  
Expected: FAIL.

- [ ] **Step 3: Update `syllabiRepo.ts` with full relational normalization**

In `server/src/likha/repositories/syllabiRepo.ts`:
- When saving syllabus (`saveCourseSyllabus`):
  1. Upsert root `syllabi` revision row.
  2. Unpack and save `syllabus_course_info`.
  3. Unpack and save `syllabus_institution`.
  4. Unpack and save `syllabus_faculty` rows.
  5. Unpack and save `syllabus_program_outcomes` and `syllabus_course_outcomes`.
  6. Unpack and save `syllabus_course_maps`.
  7. Unpack and save `syllabus_learning_plans`.
  8. Unpack and save `syllabus_grading_systems`.
  9. Unpack and save `syllabus_rubrics`.
  10. Unpack and save `syllabus_policies`, `references`, and `signatories`.
- When reading syllabus (`getCourseSyllabus`):
  1. Query active revision from `syllabi`.
  2. Query child collections in parallel (`syllabus_course_info`, `syllabus_institution`, etc.).
  3. Assemble into rich client model (with backward fallback to legacy JSON if child collections are empty).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/repositories/syllabiRepo.test.ts` in `server/`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/repositories/syllabiRepo.ts server/src/likha/repositories/syllabiRepo.test.ts
git commit -m "feat(syllabi): normalize all syllabus sections into relational Likha collections"
```

---

### Task 4: Assessments, Questions & Rubrics Normalization

**Files:**
- Modify: `server/src/likha/repositories/assessmentsRepo.ts`
- Modify: `server/src/likha/types.ts`
- Test: `server/src/likha/repositories/assessmentsRepo.test.ts`

**Interfaces:**
- Consumes: Likha `activities`, `quizzes`, `exams`, `assessment_questions`, `rubric_criteria`
- Produces:
  ```ts
  export async function getCourseActivities(courseId: string): Promise<any[]>;
  export async function createActivity(data: any): Promise<any>;
  export async function getCourseQuizzes(courseId: string): Promise<any[]>;
  export async function createQuiz(data: any): Promise<any>;
  ```

- [ ] **Step 1: Write unit tests for relational assessment questions and rubrics**

Create `server/src/likha/repositories/assessmentsRepo.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseActivities, createActivity } from './assessmentsRepo.js';

describe('Assessments Relational Repository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('assembles activities with relational questions and rubric criteria', async () => {
    const mockActivity = {
      id: 'act-1',
      course_id: 'c-cs101',
      title: 'Lab 1',
      total_points: 100,
    };
    const mockQuestions = [
      { id: 'q-1', activity_id: 'act-1', question_text: 'Describe A*', points: 50 },
    ];
    const mockRubrics = [
      { id: 'r-1', activity_id: 'act-1', title: 'Accuracy', max_points: 50 },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/items/activities?')) {
        return { ok: true, json: async () => ({ data: [mockActivity] }) } as any;
      }
      if (u.includes('/items/assessment_questions?')) {
        return { ok: true, json: async () => ({ data: mockQuestions }) } as any;
      }
      if (u.includes('/items/rubric_criteria?')) {
        return { ok: true, json: async () => ({ data: mockRubrics }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const activities = await getCourseActivities('c-cs101');
    expect(activities.length).toBe(1);
    expect(activities[0].questions.length).toBe(1);
    expect(activities[0].questions[0].text).toBe('Describe A*');
    expect(activities[0].rubric.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/repositories/assessmentsRepo.test.ts` in `server/`  
Expected: FAIL.

- [ ] **Step 3: Update `assessmentsRepo.ts`**

In `server/src/likha/repositories/assessmentsRepo.ts`:
- When creating activity, quiz, or exam:
  1. Save base row into `activities`, `quizzes`, or `exams`.
  2. Insert each item in `questions` array into `assessment_questions` table with `activity_id` / `quiz_id` / `exam_id`.
  3. Insert rubric items into `rubric_criteria` table with `activity_id`.
- When querying activities, quizzes, or exams:
  1. Fetch base rows.
  2. Batch-query `assessment_questions` and `rubric_criteria` for the assessment IDs.
  3. Attach questions and rubrics to the returned objects.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/repositories/assessmentsRepo.test.ts` in `server/`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/repositories/assessmentsRepo.ts server/src/likha/repositories/assessmentsRepo.test.ts server/src/likha/types.ts
git commit -m "feat(assessments): normalize questions and rubrics into relational Likha collections"
```

---

### Task 5: Grades (SPR) & Grading Terms Normalization

**Files:**
- Modify: `server/src/likha/repositories/gradesRepo.ts`
- Modify: `server/src/likha/repositories/coursesRepo.ts`
- Test: `server/src/likha/repositories/gradesRepo.test.ts`

**Interfaces:**
- Consumes: Likha `course_grades`, `spr_cells`, `course_grading_terms`
- Produces:
  ```ts
  export async function getCourseGrades(courseId: string): Promise<any[]>;
  export async function upsertCourseGrade(courseId: string, studentId: string, data: any): Promise<any>;
  ```

- [ ] **Step 1: Write unit tests for relational SPR cells and grading terms**

Create `server/src/likha/repositories/gradesRepo.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseGrades, upsertCourseGrade } from './gradesRepo.js';

describe('Grades Relational Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates relational spr_cells into grade records', async () => {
    const mockGrades = [{ id: 'cg-1', course_id: 'c1', student_id: 's1', midterm_grade: 92 }];
    const mockCells = [{ course_grade_id: 'cg-1', term: 'midterm', component_key: 'q1', score: 10 }];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/items/course_grades?')) {
        return { ok: true, json: async () => ({ data: mockGrades }) } as any;
      }
      if (u.includes('/items/spr_cells?')) {
        return { ok: true, json: async () => ({ data: mockCells }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const grades = await getCourseGrades('c1');
    expect(grades.length).toBe(1);
    expect(grades[0].sprCells?.midtermScores?.q1).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/repositories/gradesRepo.test.ts` in `server/`  
Expected: FAIL.

- [ ] **Step 3: Update `gradesRepo.ts` and `coursesRepo.ts`**

In `server/src/likha/repositories/gradesRepo.ts`:
- On `upsertCourseGrade`:
  1. Upsert row in `course_grades`.
  2. For each key in `sprCells` (e.g. `midtermScores`, `mtExam`, `finalScores`), upsert row in `spr_cells` collection (`course_grade_id`, `student_id`, `course_id`, `term`, `component_key`, `score`).
- On `getCourseGrades`:
  1. Query `course_grades`.
  2. Query `spr_cells` for the grades.
  3. Map into the SPR gradebook structure.
In `server/src/likha/repositories/coursesRepo.ts`:
- Persist `grading_terms` and `grades_released` into `course_grading_terms` collection.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/repositories/gradesRepo.test.ts` in `server/`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/repositories/gradesRepo.ts server/src/likha/repositories/gradesRepo.test.ts server/src/likha/repositories/coursesRepo.ts
git commit -m "feat(grades): normalize SPR cells and grading terms into relational Likha collections"
```

---

### Task 6: Linking File & Image Uploads to Likha ERP Directus Assets

**Files:**
- Modify: `server/src/routes/files.ts`
- Modify: `server/src/routes/courses.ts`
- Modify: `server/src/likha/repositories/filesRepo.ts`

**Interfaces:**
- Consumes: `uploadFileToLikha`, `getLikhaFileUrl` from `server/src/likha/services/fileStorageService.ts`
- Produces:
  `POST /api/courses/:id/files/upload` -> uploads to Likha ERP Directus `/files`, returns Likha asset URL.
  `POST /api/uploads` -> uploads to Likha ERP Directus `/files`, returns Likha asset URL.

- [ ] **Step 1: Write integration test for Likha-backed course file upload**

In `server/src/routes/files.test.ts`:
Add test asserting that uploaded course files use `uploadFileToLikha` and store Likha asset URLs (`https://gabay.zyberlab.com/assets/...`).

- [ ] **Step 2: Update `server/src/routes/files.ts`**

Update `server/src/routes/files.ts`:
- Replace local disk write with `uploadFileToLikha`:
```ts
const uploaded = await uploadFileToLikha({
  buffer: req.file.buffer,
  filename: req.file.originalname,
  mimetype: req.file.mimetype,
  title: req.file.originalname,
});

const url = uploaded.url; // https://gabay.zyberlab.com/assets/:id
```
- Store `url` and `directus_file_id` in `course_files` and database.

- [ ] **Step 3: Update `server/src/routes/courses.ts` for cover images**

Update `server/src/routes/courses.ts`:
- When course cover image is uploaded or provided, support direct Likha asset URLs.

- [ ] **Step 4: Run server tests to verify file uploads pass**

Run: `npm test` in `server/`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/files.ts server/src/routes/courses.ts server/src/likha/repositories/filesRepo.ts
git commit -m "feat(files): link all course file and image uploads to Likha ERP Directus assets"
```

---

### Task 7: Full System Verification & Regression Suite

**Files:**
- None (system-wide execution)

- [ ] **Step 1: Run complete client test suite**

Run: `npx vitest run` in `client/`  
Expected: All 60 test files passed (320 tests passed).

- [ ] **Step 2: Run complete server test suite**

Run: `npm test` in `server/`  
Expected: Core test suites passed.

- [ ] **Step 3: End-to-end browser verification of normalized syllabus, assessments, and file uploads**

Using `browser_subagent`:
1. Login as Faculty (`faculty1@dmmmsu.edu.ph`).
2. Open course syllabus and verify all sections load from normalized relational Likha collections.
3. Create assessment with questions and rubrics.
4. Upload file in Files tab and verify it stores to Likha ERP Directus asset storage.
5. Capture verification screenshots.

- [ ] **Step 4: Final commit and summary documentation**

```bash
git add -A
git commit -m "chore(normalization): complete database normalization and Likha ERP file integration"
```
