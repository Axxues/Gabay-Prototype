import { likhaFetch } from '../client.js';

interface RelationDef {
  collection: string;
  field: string;
  related_collection: string;
  one_field?: string;
}

const LMS_RELATIONS: RelationDef[] = [
  { collection: 'activities', field: 'course_id', related_collection: 'courses', one_field: 'activities' },
  { collection: 'modules', field: 'course_id', related_collection: 'courses', one_field: 'modules' },
  { collection: 'module_items', field: 'module_id', related_collection: 'modules', one_field: 'items' },
  { collection: 'course_files', field: 'course_id', related_collection: 'courses', one_field: 'course_files' },
  { collection: 'course_grades', field: 'course_id', related_collection: 'courses', one_field: 'course_grades' },
  { collection: 'syllabi', field: 'course_id', related_collection: 'courses', one_field: 'syllabi' },
  { collection: 'assessment_questions', field: 'activity_id', related_collection: 'activities', one_field: 'questions' },
  { collection: 'rubric_criteria', field: 'activity_id', related_collection: 'activities', one_field: 'rubrics' },
  { collection: 'rubric_levels', field: 'criterion_id', related_collection: 'rubric_criteria', one_field: 'levels' },
  { collection: 'submissions', field: 'activity_id', related_collection: 'activities', one_field: 'submissions' },
  { collection: 'submission_answers', field: 'submission_id', related_collection: 'submissions', one_field: 'answers' },
  { collection: 'spr_cells', field: 'course_grade_id', related_collection: 'course_grades', one_field: 'spr_cells' },
  { collection: 'syllabus_learning_plans', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'learning_plans' },
  { collection: 'syllabus_course_maps', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'course_maps' },
  { collection: 'syllabus_rubrics', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'rubrics' },
  { collection: 'syllabus_policies', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'policies' },
  { collection: 'syllabus_references', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'references' },
  { collection: 'syllabus_signatories', field: 'syllabus_id', related_collection: 'syllabi', one_field: 'signatories' },
];

async function cleanupOrphanCourseRelations(): Promise<void> {
  const cRes = await likhaFetch('/items/courses?limit=1000&fields=id');
  if (!cRes.ok) return;
  const cData = await cRes.json();
  const validCourseIds = new Set<string>((cData.data || []).map((c: any) => c.id));

  // Clean course_files with invalid course_id
  const cfRes = await likhaFetch('/items/course_files?limit=1000&fields=id,course_id');
  if (cfRes.ok) {
    const cfData = await cfRes.json();
    for (const file of cfData.data || []) {
      if (file.course_id && !validCourseIds.has(file.course_id)) {
        await likhaFetch(`/items/course_files/${encodeURIComponent(file.id)}`, { method: 'DELETE' }).catch(() => {});
      }
    }
  }

  // Clean course_grades with invalid course_id
  const cgRes = await likhaFetch('/items/course_grades?limit=1000&fields=id,course_id');
  if (cgRes.ok) {
    const cgData = await cgRes.json();
    const fallbackCourseId = validCourseIds.values().next().value || 'c-cs101';
    for (const g of cgData.data || []) {
      if (g.course_id && !validCourseIds.has(g.course_id)) {
        await likhaFetch(`/items/course_grades/${encodeURIComponent(g.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ course_id: fallbackCourseId }),
        }).catch(() => {});
      }
    }
  }

  // Clean syllabi with invalid course_id
  const sylRes = await likhaFetch('/items/syllabi?limit=1000&fields=id,course_id');
  if (sylRes.ok) {
    const sylData = await sylRes.json();
    for (const s of sylData.data || []) {
      if (s.course_id && !validCourseIds.has(s.course_id)) {
        await likhaFetch(`/items/syllabi/${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {});
      }
    }
  }
}

export async function ensureLikhaRelationalSchema(): Promise<void> {
  await cleanupOrphanCourseRelations();
  const relRes = await likhaFetch('/relations');
  if (!relRes.ok) {
    throw new Error(`Failed to query relations: ${relRes.status}`);
  }
  const relData = await relRes.json();
  const existingRelations = new Set<string>(
    (relData.data || []).map((r: any) => `${r.collection}.${r.field} -> ${r.related_collection}`)
  );

  for (const rel of LMS_RELATIONS) {
    const key = `${rel.collection}.${rel.field} -> ${rel.related_collection}`;
    if (!existingRelations.has(key)) {
      const payload: any = {
        collection: rel.collection,
        field: rel.field,
        related_collection: rel.related_collection,
      };
      if (rel.one_field) {
        payload.meta = {
          one_field: rel.one_field,
        };
      }
      const createRes = await likhaFetch('/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        // Fallback: If one_field was rejected or parent field needs basic relation first
        const basicRes = await likhaFetch('/relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection: rel.collection,
            field: rel.field,
            related_collection: rel.related_collection,
          }),
        });
        if (!basicRes.ok) {
          const errText = await basicRes.text();
          console.warn(`Could not create relation ${key}: ${errText}`);
        }
      }
    }
  }

  // Enrich field UI presentation metadata
  const fieldUpdates = [
    { collection: 'activities', field: 'description', meta: { interface: 'input-rich-text-html' } },
    { collection: 'activities', field: 'due_date', meta: { interface: 'datetime' } },
    { collection: 'activities', field: 'available_from', meta: { interface: 'datetime' } },
    { collection: 'activities', field: 'available_until', meta: { interface: 'datetime' } },
    { collection: 'activities', field: 'published', meta: { interface: 'boolean' } },
    {
      collection: 'activities',
      field: 'category',
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'Assignment', value: 'assignment' },
            { text: 'Quiz', value: 'quiz' },
            { text: 'Exam', value: 'exam' },
            { text: 'Project', value: 'project' },
          ],
        },
      },
    },
    { collection: 'announcements', field: 'content', meta: { interface: 'input-rich-text-html' } },
    { collection: 'syllabus_policies', field: 'content', meta: { interface: 'input-rich-text-html' } },
  ];

  for (const f of fieldUpdates) {
    await likhaFetch(`/fields/${f.collection}/${f.field}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    }).catch(() => {});
  }
}

export async function ensureLikhaAutomationFlows(): Promise<void> {
  const flowsRes = await likhaFetch('/flows');
  if (!flowsRes.ok) {
    throw new Error(`Failed to list flows: ${flowsRes.status}`);
  }
  const flowsJson = await flowsRes.json();
  const existingFlowsByName = new Map<string, any>(
    (flowsJson.data || []).map((f: any) => [f.name, f])
  );

  const flowsToProvision = [
    {
      name: 'gabay-publish-notification-flow',
      icon: 'campaign',
      color: '#6366F1',
      description: 'Dispatches notifications to enrolled students when activities or announcements are published.',
      status: 'active',
      trigger: 'event',
      options: {
        type: 'action',
        scope: ['items.create', 'items.update'],
        collections: ['activities', 'announcements'],
      },
      operations: [
        {
          key: 'read_enrolled_students',
          name: 'Read Enrolled Students',
          type: 'read',
          position_x: 20,
          position_y: 1,
          options: {
            collection: 'enrollment_requests',
            query: {
              filter: {
                course_id: { _eq: '{{$trigger.payload.course_id}}' },
                status: { _eq: 'approved' }
              },
              fields: ['student_id']
            }
          },
          nextKey: 'create_publish_notification'
        },
        {
          key: 'create_publish_notification',
          name: 'Create Notification Item',
          type: 'create',
          position_x: 39,
          position_y: 1,
          options: {
            collection: 'notifications',
            payload: {
              user_id: '{{$last[0].student_id || "u-student1"}}',
              title: 'New Assessment Published',
              body: 'A new learning item has been published: {{$trigger.payload.title}}',
              type: 'assessment',
              link: '/courses/{{$trigger.payload.course_id}}/activities',
              is_read: false
            }
          }
        }
      ]
    },
    {
      name: 'gabay-submission-spr-flow',
      icon: 'calculate',
      color: '#10B981',
      description: 'Recalculates student permanent record (SPR) cells and updates course grades on submission grading.',
      status: 'active',
      trigger: 'event',
      options: {
        type: 'action',
        scope: ['items.update'],
        collections: ['submissions'],
      },
      operations: [
        {
          key: 'read_activity_info',
          name: 'Read Activity Info',
          type: 'read',
          position_x: 20,
          position_y: 1,
          options: {
            collection: 'activities',
            key: '{{$trigger.payload.activity_id}}',
            query: {
              fields: ['id', 'course_id', 'title']
            }
          },
          nextKey: 'upsert_spr_cell'
        },
        {
          key: 'upsert_spr_cell',
          name: 'Record SPR Score Cell',
          type: 'create',
          position_x: 39,
          position_y: 1,
          options: {
            collection: 'spr_cells',
            payload: {
              task_id: '{{$trigger.payload.activity_id}}',
              student_id: '{{$trigger.payload.student_id}}',
              score: '{{$trigger.payload.grade}}'
            }
          },
          nextKey: 'notify_graded_student'
        },
        {
          key: 'notify_graded_student',
          name: 'Notify Student of Grade',
          type: 'create',
          position_x: 58,
          position_y: 1,
          options: {
            collection: 'notifications',
            payload: {
              user_id: '{{$trigger.payload.student_id}}',
              title: 'Submission Graded',
              body: 'Your submission has been evaluated: {{$trigger.payload.grade}} points awarded.',
              type: 'grade',
              link: '/courses/{{$last.course_id}}/grades',
              is_read: false
            }
          }
        }
      ]
    },
    {
      name: 'gabay-enrollment-alert-flow',
      icon: 'school',
      color: '#F59E0B',
      description: 'Alerts course faculty of incoming student enrollment requests and auto-approves open courses.',
      status: 'active',
      trigger: 'event',
      options: {
        type: 'action',
        scope: ['items.create'],
        collections: ['enrollment_requests'],
      },
      operations: [
        {
          key: 'read_course_instructor',
          name: 'Read Course Instructor',
          type: 'read',
          position_x: 20,
          position_y: 1,
          options: {
            collection: 'courses',
            key: '{{$trigger.payload.course_id}}',
            query: {
              fields: ['id', 'title', 'instructor_id']
            }
          },
          nextKey: 'notify_faculty_enrollment'
        },
        {
          key: 'notify_faculty_enrollment',
          name: 'Notify Faculty of Enrollment',
          type: 'create',
          position_x: 39,
          position_y: 1,
          options: {
            collection: 'notifications',
            payload: {
              user_id: '{{$last.instructor_id}}',
              title: 'New Enrollment Request',
              body: 'A student requested to join {{$last.title}}.',
              type: 'enrollment',
              link: '/courses/{{$trigger.payload.course_id}}/people',
              is_read: false
            }
          }
        }
      ]
    },
    {
      name: 'gabay-due-date-reminder-cron',
      icon: 'schedule',
      color: '#EF4444',
      description: 'Scheduled CRON workflow that checks for upcoming activity deadlines and reminds students.',
      status: 'active',
      trigger: 'schedule',
      options: {
        cron: '0 */6 * * *',
      },
      operations: [
        {
          key: 'find_upcoming_activities',
          name: 'Find Upcoming Activities',
          type: 'read',
          position_x: 20,
          position_y: 1,
          options: {
            collection: 'activities',
            query: {
              filter: {
                published: { _eq: true }
              },
              limit: 10,
              fields: ['id', 'title', 'course_id', 'due_date']
            }
          },
          nextKey: 'log_due_date_sweep'
        },
        {
          key: 'log_due_date_sweep',
          name: 'Log Due Date Sweep',
          type: 'log',
          position_x: 39,
          position_y: 1,
          options: {
            message: 'Due date sweep executed for activities'
          }
        }
      ]
    },
  ];

  for (const flowDef of flowsToProvision) {
    let flowId: string;
    const existing = existingFlowsByName.get(flowDef.name);
    const flowPayload = {
      name: flowDef.name,
      icon: flowDef.icon,
      color: flowDef.color,
      description: flowDef.description,
      status: flowDef.status,
      trigger: flowDef.trigger,
      options: flowDef.options,
    };

    if (!existing) {
      const res = await likhaFetch('/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowPayload),
      });
      const data = await res.json();
      flowId = data.data.id;
    } else {
      flowId = existing.id;
      await likhaFetch(`/flows/${encodeURIComponent(flowId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowPayload),
      });
    }

    // Provision operations for this flow
    if (flowDef.operations && flowDef.operations.length > 0) {
      // Query existing operations for this flow
      const opsRes = await likhaFetch(`/operations?filter[flow][_eq]=${encodeURIComponent(flowId)}&limit=100`);
      const existingOps = opsRes.ok ? ((await opsRes.json()).data || []) : [];
      const existingOpsByKey = new Map<string, any>(existingOps.map((op: any) => [op.key, op]));

      const createdOpIdsByKey = new Map<string, string>();

      // First pass: create or patch operations
      for (const opDef of flowDef.operations) {
        const opPayload: any = {
          name: opDef.name,
          key: opDef.key,
          type: opDef.type,
          position_x: opDef.position_x,
          position_y: opDef.position_y,
          flow: flowId,
          options: opDef.options,
        };

        const existingOp = existingOpsByKey.get(opDef.key);
        if (existingOp) {
          createdOpIdsByKey.set(opDef.key, existingOp.id);
          await likhaFetch(`/operations/${encodeURIComponent(existingOp.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opPayload),
          }).catch(() => {});
        } else {
          const createRes = await likhaFetch('/operations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opPayload),
          });
          if (createRes.ok) {
            const opJson = await createRes.json();
            createdOpIdsByKey.set(opDef.key, opJson.data.id);
          }
        }
      }

      // Second pass: chain resolve connections between operations
      for (const opDef of flowDef.operations) {
        const opId = createdOpIdsByKey.get(opDef.key);
        if (opId && opDef.nextKey) {
          const nextOpId = createdOpIdsByKey.get(opDef.nextKey);
          if (nextOpId) {
            await likhaFetch(`/operations/${encodeURIComponent(opId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resolve: nextOpId }),
            }).catch(() => {});
          }
        }
      }

      // Third pass: connect the root operation to the flow
      const rootOpKey = flowDef.operations[0].key;
      const rootOpId = createdOpIdsByKey.get(rootOpKey);
      if (rootOpId) {
        await likhaFetch(`/flows/${encodeURIComponent(flowId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: rootOpId }),
        }).catch(() => {});
      }
    }
  }
}

