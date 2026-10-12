import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../server/.env') });

const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
const LIKHA_ADMIN_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'jayveegenetareyes@gmail.com';
const LIKHA_ADMIN_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'qwerty12345';

interface FieldDef {
  field: string;
  type: 'string' | 'text' | 'integer' | 'float' | 'boolean' | 'json' | 'dateTime' | 'date';
  length?: number;
}

interface CollectionDef {
  name: string;
  fields: FieldDef[];
}

const COLLECTIONS: CollectionDef[] = [
  {
    name: 'courses',
    fields: [
      { field: 'code', type: 'string', length: 32 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'section', type: 'string', length: 64 },
      { field: 'term', type: 'string', length: 64 },
      { field: 'instructor_id', type: 'string', length: 64 },
      { field: 'instructor_name', type: 'string', length: 128 },
      { field: 'published', type: 'boolean' },
      { field: 'color', type: 'string', length: 32 },
      { field: 'image', type: 'text' },
      { field: 'enrolled_count', type: 'integer' },
      { field: 'credits', type: 'integer' },
      { field: 'ched_compliance_code', type: 'string', length: 64 },
      { field: 'join_code', type: 'string', length: 32 },
      { field: 'syllabus', type: 'json' },
      { field: 'spr_config', type: 'json' },
      { field: 'grading_terms', type: 'json' },
      { field: 'grades_released', type: 'json' },
    ],
  },
  {
    name: 'course_sections',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'name', type: 'string', length: 128 },
      { field: 'capacity', type: 'integer' },
      { field: 'enrolled_count', type: 'integer' },
      { field: 'schedule', type: 'string', length: 256 },
      { field: 'location', type: 'string', length: 256 },
    ],
  },
  {
    name: 'enrollment_requests',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'student_id', type: 'string', length: 64 },
      { field: 'student_name', type: 'string', length: 128 },
      { field: 'type', type: 'string', length: 32 },
      { field: 'status', type: 'string', length: 32 },
      { field: 'requested_at', type: 'dateTime' },
      { field: 'resolved_at', type: 'dateTime' },
      { field: 'resolved_by', type: 'string', length: 64 },
      { field: 'section_id', type: 'string', length: 64 },
      { field: 'target_section_id', type: 'string', length: 64 },
    ],
  },
  {
    name: 'modules',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'order', type: 'integer' },
      { field: 'published', type: 'boolean' },
      { field: 'prerequisite_module_id', type: 'string', length: 64 },
      { field: 'author_id', type: 'string', length: 64 },
      { field: 'author_name', type: 'string', length: 128 },
    ],
  },
  {
    name: 'module_items',
    fields: [
      { field: 'module_id', type: 'string', length: 64 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'type', type: 'string', length: 32 },
      { field: 'published', type: 'boolean' },
      { field: 'required', type: 'boolean' },
      { field: 'content', type: 'text' },
      { field: 'url', type: 'string', length: 512 },
      { field: 'duration', type: 'string', length: 64 },
      { field: 'points', type: 'integer' },
      { field: 'due_date', type: 'string', length: 64 },
      { field: 'order', type: 'integer' },
    ],
  },
  {
    name: 'module_comments',
    fields: [
      { field: 'module_id', type: 'string', length: 64 },
      { field: 'author_id', type: 'string', length: 64 },
      { field: 'author_name', type: 'string', length: 128 },
      { field: 'content', type: 'text' },
      { field: 'parent_id', type: 'string', length: 64 },
      { field: 'created_at', type: 'dateTime' },
      { field: 'likes', type: 'json' },
    ],
  },
  {
    name: 'activities',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'description', type: 'text' },
      { field: 'term', type: 'string', length: 32 },
      { field: 'format', type: 'string', length: 32 },
      { field: 'category', type: 'string', length: 64 },
      { field: 'weight', type: 'float' },
      { field: 'total_points', type: 'integer' },
      { field: 'due_date', type: 'dateTime' },
      { field: 'available_from', type: 'dateTime' },
      { field: 'available_until', type: 'dateTime' },
      { field: 'published', type: 'boolean' },
      { field: 'questions', type: 'json' },
      { field: 'rubric', type: 'json' },
    ],
  },
  {
    name: 'quizzes',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'description', type: 'text' },
      { field: 'term', type: 'string', length: 32 },
      { field: 'time_limit_minutes', type: 'integer' },
      { field: 'total_points', type: 'integer' },
      { field: 'due_date', type: 'dateTime' },
      { field: 'published', type: 'boolean' },
      { field: 'questions', type: 'json' },
    ],
  },
  {
    name: 'exams',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'description', type: 'text' },
      { field: 'term', type: 'string', length: 32 },
      { field: 'time_limit_minutes', type: 'integer' },
      { field: 'total_points', type: 'integer' },
      { field: 'due_date', type: 'dateTime' },
      { field: 'published', type: 'boolean' },
      { field: 'questions', type: 'json' },
    ],
  },
  {
    name: 'submissions',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'student_id', type: 'string', length: 64 },
      { field: 'activity_id', type: 'string', length: 64 },
      { field: 'quiz_id', type: 'string', length: 64 },
      { field: 'exam_id', type: 'string', length: 64 },
      { field: 'status', type: 'string', length: 32 },
      { field: 'score', type: 'float' },
      { field: 'max_score', type: 'float' },
      { field: 'submitted_at', type: 'dateTime' },
      { field: 'graded_at', type: 'dateTime' },
      { field: 'graded_by', type: 'string', length: 64 },
      { field: 'answers', type: 'json' },
      { field: 'rubric_scores', type: 'json' },
      { field: 'comments', type: 'json' },
      { field: 'file_url', type: 'string', length: 512 },
      { field: 'file_name', type: 'string', length: 256 },
      { field: 'content', type: 'text' },
    ],
  },
  {
    name: 'announcements',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'author_id', type: 'string', length: 64 },
      { field: 'author_name', type: 'string', length: 128 },
      { field: 'author_avatar', type: 'text' },
      { field: 'title', type: 'string', length: 256 },
      { field: 'content', type: 'text' },
      { field: 'pinned', type: 'boolean' },
      { field: 'created_at', type: 'dateTime' },
      { field: 'likes', type: 'json' },
      { field: 'replies', type: 'json' },
    ],
  },
  {
    name: 'discussions',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'author_id', type: 'string', length: 64 },
      { field: 'author_name', type: 'string', length: 128 },
      { field: 'title', type: 'string', length: 256 },
      { field: 'content', type: 'text' },
      { field: 'pinned', type: 'boolean' },
      { field: 'locked', type: 'boolean' },
      { field: 'created_at', type: 'dateTime' },
      { field: 'replies', type: 'json' },
    ],
  },
  {
    name: 'messages',
    fields: [
      { field: 'sender_id', type: 'string', length: 64 },
      { field: 'sender_name', type: 'string', length: 128 },
      { field: 'recipient_id', type: 'string', length: 64 },
      { field: 'recipient_name', type: 'string', length: 128 },
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'subject', type: 'string', length: 256 },
      { field: 'body', type: 'text' },
      { field: 'read', type: 'boolean' },
      { field: 'created_at', type: 'dateTime' },
      { field: 'attachment_name', type: 'string', length: 256 },
      { field: 'attachment_url', type: 'string', length: 512 },
      { field: 'group_id', type: 'string', length: 64 },
    ],
  },
  {
    name: 'chat_groups',
    fields: [
      { field: 'name', type: 'string', length: 128 },
      { field: 'member_ids', type: 'json' },
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'created_at', type: 'dateTime' },
    ],
  },
  {
    name: 'calendar_events',
    fields: [
      { field: 'title', type: 'string', length: 256 },
      { field: 'date', type: 'string', length: 32 },
      { field: 'start_time', type: 'string', length: 32 },
      { field: 'end_time', type: 'string', length: 32 },
      { field: 'type', type: 'string', length: 32 },
      { field: 'location', type: 'string', length: 256 },
      { field: 'description', type: 'text' },
      { field: 'all_day', type: 'boolean' },
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'user_id', type: 'string', length: 64 },
    ],
  },
  {
    name: 'advising_slots',
    fields: [
      { field: 'date', type: 'string', length: 32 },
      { field: 'time_slot', type: 'string', length: 64 },
      { field: 'location', type: 'string', length: 256 },
      { field: 'status', type: 'string', length: 32 },
      { field: 'faculty_id', type: 'string', length: 64 },
      { field: 'booked_by_id', type: 'string', length: 64 },
      { field: 'booked_by_name', type: 'string', length: 128 },
    ],
  },
  {
    name: 'course_files',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'name', type: 'string', length: 256 },
      { field: 'size', type: 'integer' },
      { field: 'type', type: 'string', length: 64 },
      { field: 'url', type: 'string', length: 512 },
      { field: 'visibility', type: 'string', length: 32 },
      { field: 'parent_id', type: 'string', length: 64 },
      { field: 'auto_key', type: 'string', length: 64 },
      { field: 'uploaded_by', type: 'string', length: 64 },
      { field: 'uploaded_at', type: 'dateTime' },
    ],
  },
  {
    name: 'course_folders',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'name', type: 'string', length: 128 },
      { field: 'parent_id', type: 'string', length: 64 },
      { field: 'auto_key', type: 'string', length: 64 },
    ],
  },
  {
    name: 'course_grades',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'student_id', type: 'string', length: 64 },
      { field: 'midterm_grade', type: 'float' },
      { field: 'final_grade', type: 'float' },
      { field: 'spr_cells', type: 'json' },
      { field: 'updated_at', type: 'dateTime' },
    ],
  },
  {
    name: 'syllabi',
    fields: [
      { field: 'course_id', type: 'string', length: 64 },
      { field: 'version', type: 'integer' },
      { field: 'status', type: 'string', length: 32 },
      { field: 'content', type: 'json' },
      { field: 'published_at', type: 'dateTime' },
      { field: 'created_at', type: 'dateTime' },
    ],
  },
];

async function runProvisioning() {
  console.log(`[Likha Provisioning] Connecting to ${LIKHA_URL}...`);
  const loginRes = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LIKHA_ADMIN_EMAIL, password: LIKHA_ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${loginRes.statusText}`);
  }

  const { data: { access_token } } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${access_token}`,
  };

  // 1. Get existing collections
  const colRes = await fetch(`${LIKHA_URL}/collections`, { headers });
  const colData = await colRes.json();
  const existingCols = new Set<string>((colData.data || []).map((c: any) => c.collection));
  console.log(`[Likha Provisioning] Found ${existingCols.size} existing collections.`);

  // 2. Iterate each collection definition
  for (const colDef of COLLECTIONS) {
    if (!existingCols.has(colDef.name)) {
      console.log(`[Likha Provisioning] Creating collection '${colDef.name}'...`);
      const createRes = await fetch(`${LIKHA_URL}/collections`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collection: colDef.name,
          schema: {},
          fields: [
            {
              field: 'id',
              type: 'string',
              schema: { is_primary_key: true, length: 64 },
            },
          ],
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`Failed to create collection '${colDef.name}':`, errText);
        continue;
      }
      console.log(`[Likha Provisioning] Collection '${colDef.name}' created successfully.`);
    } else {
      console.log(`[Likha Provisioning] Collection '${colDef.name}' already exists.`);
    }

    // Inspect fields for this collection
    const fieldsRes = await fetch(`${LIKHA_URL}/fields/${colDef.name}`, { headers });
    const fieldsData = await fieldsRes.json();
    const existingFields = new Set<string>((fieldsData.data || []).map((f: any) => f.field));

    for (const fieldDef of colDef.fields) {
      if (!existingFields.has(fieldDef.field)) {
        console.log(`  -> Adding field '${colDef.name}.${fieldDef.field}' (${fieldDef.type})...`);
        const bodyPayload: any = {
          field: fieldDef.field,
          type: fieldDef.type,
        };
        if (fieldDef.length && fieldDef.type === 'string') {
          bodyPayload.schema = { length: fieldDef.length };
        }
        const addFieldRes = await fetch(`${LIKHA_URL}/fields/${colDef.name}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
        });

        if (!addFieldRes.ok) {
          const errText = await addFieldRes.text();
          console.warn(`  Warning: failed to add field '${fieldDef.field}':`, errText);
        }
      }
    }
  }

  // 3. Grant full permissions to LMS collections for standard roles
  console.log('[Likha Provisioning] Configuring role permissions...');
  const rolesRes = await fetch(`${LIKHA_URL}/roles`, { headers });
  const rolesData = await rolesRes.json();
  const roles: Array<{ id: string; name: string }> = rolesData.data || [];

  const permsRes = await fetch(`${LIKHA_URL}/permissions?limit=500`, { headers });
  const permsData = await permsRes.json();
  const existingPerms = new Set<string>(
    (permsData.data || []).map((p: any) => `${p.role}:${p.collection}:${p.action}`)
  );

  const actions = ['create', 'read', 'update', 'delete'];
  for (const role of roles) {
    for (const colDef of COLLECTIONS) {
      for (const action of actions) {
        const key = `${role.id}:${colDef.name}:${action}`;
        if (!existingPerms.has(key)) {
          await fetch(`${LIKHA_URL}/permissions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              role: role.id,
              collection: colDef.name,
              action,
              fields: ['*'],
            }),
          });
        }
      }
    }
  }

  console.log('[Likha Provisioning] Completed successfully! All collections and permissions are set.');
}

runProvisioning().catch(err => {
  console.error('[Likha Provisioning] Failed:', err);
  process.exit(1);
});
