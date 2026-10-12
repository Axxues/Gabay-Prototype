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
    } else {
      console.log(`Collection ${item.collection} already exists.`);
    }
  }
}

// Allow standalone execution via npx tsx
if (process.argv[1]?.endsWith('initNormalizedSchema.ts')) {
  ensureNormalizedLikhaSchema()
    .then(() => {
      console.log('Schema migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Schema migration error:', err);
      process.exit(1);
    });
}
