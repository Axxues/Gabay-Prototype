import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken, likhaFetch } from '../client.js';

export async function getCourseSyllabus(courseId: string): Promise<any | null> {
  const token = await getLikhaAdminToken();

  // 1. Find active syllabus revision
  const res = await fetch(`${LIKHA_URL}/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-created_at,-version&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const sylHeader = json.data?.[0];

  if (!sylHeader) {
    // Fallback: check syllabus column in courses table
    const courseRes = await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(courseId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!courseRes.ok) return null;
    const courseJson = (await courseRes.json()) as any;
    let syl = courseJson.data?.syllabus;
    if (typeof syl === 'string') {
      try { syl = JSON.parse(syl); } catch { /* ignore */ }
    }
    return syl || null;
  }

  const syllabusId = sylHeader.id;

  // 2. Query child collections in parallel for relational reconstruction
  const [
    infoRes,
    instRes,
    facRes,
    poRes,
    coRes,
    mapsRes,
    plansRes,
    gradingRes,
    rubricsRes,
    policiesRes,
    refsRes,
    sigsRes,
  ] = await Promise.all([
    fetch(`${LIKHA_URL}/items/syllabus_course_info?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_institution?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_faculty?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_program_outcomes?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_course_outcomes?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_course_maps?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=100`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_learning_plans?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=100&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_grading_systems?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_rubrics?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_policies?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_references?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=50&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${LIKHA_URL}/items/syllabus_signatories?filter[syllabus_id][_eq]=${encodeURIComponent(syllabusId)}&limit=20&sort=order`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
  ]);

  const parseJsonSafe = async (res: Response | null) => {
    if (!res || !res.ok) return [];
    const j = await res.json().catch(() => ({}));
    return (j as any).data || [];
  };

  const [
    infoRows,
    instRows,
    facRows,
    poRows,
    coRows,
    mapsRows,
    plansRows,
    gradingRows,
    rubricsRows,
    policiesRows,
    refsRows,
    sigsRows,
  ] = await Promise.all([
    parseJsonSafe(infoRes),
    parseJsonSafe(instRes),
    parseJsonSafe(facRes),
    parseJsonSafe(poRes),
    parseJsonSafe(coRes),
    parseJsonSafe(mapsRes),
    parseJsonSafe(plansRes),
    parseJsonSafe(gradingRes),
    parseJsonSafe(rubricsRes),
    parseJsonSafe(policiesRes),
    parseJsonSafe(refsRes),
    parseJsonSafe(sigsRes),
  ]);

  // If relational rows exist, assemble them!
  if (infoRows.length > 0 || instRows.length > 0) {
    const rawInfo = infoRows[0] || {};
    const rawInst = instRows[0] || {};
    const rawGrading = gradingRows[0] || {};

    return {
      courseId,
      version: sylHeader.version || 1,
      status: sylHeader.status || 'published',
      courseInfo: {
        code: rawInfo.course_code || '',
        courseCode: rawInfo.course_code || '',
        title: rawInfo.course_title || '',
        courseTitle: rawInfo.course_title || '',
        credits: rawInfo.credits || 3,
        lectureHours: rawInfo.lecture_hours || 2,
        labHours: rawInfo.lab_hours || 3,
        prerequisites: rawInfo.prerequisites || '',
        semester: rawInfo.semester || '1st Semester',
        academicYear: rawInfo.academic_year || '2026-2027',
        description: rawInfo.rationale_description || '',
      },
      institution: {
        university: rawInst.university_name || 'Don Mariano Marcos Memorial State University',
        campus: rawInst.campus_name || 'South La Union Campus',
        college: rawInst.college_name || 'College of Computer Science',
        department: rawInst.department_name || 'Department of Computer Science',
        vision: rawInst.vision || '',
        mission: rawInst.mission || '',
        goals: rawInst.goals || '',
      },
      faculty: facRows.map((f: any) => ({
        id: f.id,
        name: f.faculty_name,
        email: f.email,
        consultationHours: f.consultation_hours,
        office: f.office_room,
      })),
      programOutcomes: poRows.map((p: any) => ({
        code: p.code,
        statement: p.statement,
      })),
      courseOutcomes: coRows.map((c: any) => ({
        code: c.code,
        statement: c.statement,
      })),
      curriculumMap: mapsRows.map((m: any) => ({
        coCode: m.course_outcome_code,
        poCode: m.program_outcome_code,
        level: m.level,
      })),
      learningPlans: plansRows.map((l: any) => ({
        unitNo: l.unit_no,
        weeks: l.time_allotment_weeks,
        outcomes: l.intended_learning_outcome,
        topic: l.topic_content,
        activities: l.teaching_activities,
        teachingActivities: l.teaching_activities,
        assessments: l.assessment_tasks,
        resources: l.learning_resources,
      })),
      learningPlans: plansRows.map((l: any) => ({
        unitNo: l.unit_no,
        weeks: l.time_allotment_weeks,
        outcomes: l.intended_learning_outcome,
        topic: l.topic_content,
        activities: l.teaching_activities,
        teachingActivities: l.teaching_activities,
        assessments: l.assessment_tasks,
        resources: l.learning_resources,
      })),
      learningPlan: plansRows.map((l: any) => {
        const topics = l.topic_content ? l.topic_content.split('; ').map((s: string) => s.trim()).filter(Boolean) : [];
        const outcomes = l.intended_learning_outcome ? l.intended_learning_outcome.split('; ').map((s: string) => s.trim()).filter(Boolean) : [];
        const activities = l.teaching_activities ? l.teaching_activities.split('; ').map((s: string) => s.trim()).filter(Boolean) : [];
        const assessments = l.assessment_tasks ? l.assessment_tasks.split('; ').map((s: string) => s.trim()).filter(Boolean) : [];
        return {
          unitNo: l.unit_no,
          week: l.time_allotment_weeks || `Week ${l.unit_no || 1}`,
          topics: topics.length > 0 ? topics : ['Course Topic'],
          learningOutcomes: outcomes,
          methodology: activities,
          assessment: assessments,
          hoursLec: 2,
          hoursLab: 3,
        };
      }),
      evaluation: {
        lectureWeight: rawGrading.lecture_weight || 0.6,
        labWeight: rawGrading.lab_weight || 0.4,
        formula: rawGrading.term_formula || '',
        passingGrade: rawGrading.passing_grade || 75,
        summary: rawGrading.components_summary || '',
      },
      rubrics: rubricsRows.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.rubric_type,
      })),
      policies: policiesRows.map((p: any) => ({
        title: p.title,
        content: p.content,
      })),
      references: refsRows.map((r: any) => ({
        title: r.title,
        author: r.author,
        year: r.year,
        url: r.url,
      })),
      signatories: sigsRows.map((s: any) => ({
        name: s.name,
        title: s.title,
        role: s.role,
      })),
    };
  }

  // Graceful fallback to legacy content blob if relational rows were not populated yet
  let content = sylHeader.content;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { /* ignore */ }
  }
  return content || null;
}

export async function saveCourseSyllabus(courseId: string, content: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const serialized = typeof content === 'string' ? content : JSON.stringify(content);
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  const syllabusId = `syl-${courseId}-${Date.now().toString(36)}`;

  // 1. Create root syllabi revision
  const newSyl = {
    id: syllabusId,
    course_id: courseId,
    version: 1,
    status: 'published',
    content: serialized, // retained for backward compatibility
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  await fetch(`${LIKHA_URL}/items/syllabi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(newSyl),
  });

  // 2. Unpack Course Info
  if (parsed.courseInfo) {
    const ci = parsed.courseInfo;
    await fetch(`${LIKHA_URL}/items/syllabus_course_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `sci-${syllabusId}`,
        syllabus_id: syllabusId,
        course_code: ci.code || ci.courseCode || '',
        course_title: ci.title || ci.courseTitle || '',
        credits: ci.credits || 3,
        lecture_hours: ci.lectureHours || 2,
        lab_hours: ci.labHours || 3,
        prerequisites: ci.prerequisites || '',
        semester: ci.semester || '',
        academic_year: ci.academicYear || '',
        rationale_description: ci.description || '',
      }),
    }).catch(() => {});
  }

  // 3. Unpack Institution
  if (parsed.institution) {
    const inst = parsed.institution;
    await fetch(`${LIKHA_URL}/items/syllabus_institution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `sinst-${syllabusId}`,
        syllabus_id: syllabusId,
        university_name: inst.university || inst.university_name || '',
        campus_name: inst.campus || inst.campus_name || '',
        college_name: inst.college || inst.college_name || '',
        department_name: inst.department || inst.department_name || '',
        vision: inst.vision || '',
        mission: inst.mission || '',
        goals: inst.goals || '',
      }),
    }).catch(() => {});
  }

  // 4. Unpack Faculty
  if (Array.isArray(parsed.faculty)) {
    for (let i = 0; i < parsed.faculty.length; i++) {
      const f = parsed.faculty[i];
      await fetch(`${LIKHA_URL}/items/syllabus_faculty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: `sfac-${syllabusId}-${i}`,
          syllabus_id: syllabusId,
          faculty_name: f.name || f.faculty_name || '',
          email: f.email || '',
          consultation_hours: f.consultationHours || f.consultation_hours || '',
          office_room: f.office || f.office_room || '',
          order: i + 1,
        }),
      }).catch(() => {});
    }
  }

  // 5. Unpack Program Outcomes & Course Outcomes
  if (Array.isArray(parsed.programOutcomes)) {
    for (let i = 0; i < parsed.programOutcomes.length; i++) {
      const po = parsed.programOutcomes[i];
      await fetch(`${LIKHA_URL}/items/syllabus_program_outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: `spo-${syllabusId}-${i}`,
          syllabus_id: syllabusId,
          code: po.code || `PO${i + 1}`,
          statement: po.statement || po.description || '',
          order: i + 1,
        }),
      }).catch(() => {});
    }
  }

  if (Array.isArray(parsed.courseOutcomes)) {
    for (let i = 0; i < parsed.courseOutcomes.length; i++) {
      const co = parsed.courseOutcomes[i];
      await fetch(`${LIKHA_URL}/items/syllabus_course_outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: `sco-${syllabusId}-${i}`,
          syllabus_id: syllabusId,
          code: co.code || `CO${i + 1}`,
          statement: co.statement || co.description || '',
          order: i + 1,
        }),
      }).catch(() => {});
    }
  }

  // 6. Unpack Curriculum Map
  const mapsArr = Array.isArray(parsed.curriculumMap) ? parsed.curriculumMap : [];
  for (let i = 0; i < mapsArr.length; i++) {
    const m = mapsArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_course_maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `scm-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        course_outcome_code: m.coCode || m.courseOutcomeCode || '',
        program_outcome_code: m.poCode || m.programOutcomeCode || '',
        level: m.level || 'I',
      }),
    }).catch(() => {});
  }

  // 7. Unpack Learning Plans
  const plansArr = Array.isArray(parsed.learningPlan)
    ? parsed.learningPlan
    : (Array.isArray(parsed.learningPlans) ? parsed.learningPlans : []);
  for (let i = 0; i < plansArr.length; i++) {
    const lp = plansArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_learning_plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `slp-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        unit_no: lp.unitNo || lp.unit_no || i + 1,
        time_allotment_weeks: String(lp.weeks || lp.week || lp.time_allotment_weeks || `Week ${i + 1}`),
        intended_learning_outcome: Array.isArray(lp.learningOutcomes) ? lp.learningOutcomes.join('; ') : (lp.outcomes || lp.intended_learning_outcome || ''),
        topic_content: Array.isArray(lp.topics) ? lp.topics.join('; ') : (lp.topic || lp.topic_content || ''),
        teaching_activities: Array.isArray(lp.methodology) ? lp.methodology.join('; ') : (lp.activities || lp.teachingActivities || lp.teaching_activities || ''),
        assessment_tasks: Array.isArray(lp.assessment) ? lp.assessment.join('; ') : (lp.assessments || lp.assessment_tasks || ''),
        learning_resources: lp.resources || lp.learning_resources || '',
        order: i + 1,
      }),
    }).catch(() => {});
  }

  // 8. Unpack Grading Systems / Evaluation
  const evalData = parsed.evaluation || parsed.grading || parsed.gradingSystem;
  if (evalData && typeof evalData === 'object') {
    await fetch(`${LIKHA_URL}/items/syllabus_grading_systems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `sgs-${syllabusId}`,
        syllabus_id: syllabusId,
        lecture_weight: evalData.lectureWeight ?? 0.6,
        lab_weight: evalData.labWeight ?? 0.4,
        term_formula: evalData.formula || evalData.termFormula || '',
        passing_grade: evalData.passingGrade ?? 75,
        components_summary: evalData.summary || evalData.componentsSummary || '',
      }),
    }).catch(() => {});
  }

  // 9. Unpack Rubrics
  const rubricsArr = Array.isArray(parsed.rubrics) ? parsed.rubrics : [];
  for (let i = 0; i < rubricsArr.length; i++) {
    const r = rubricsArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_rubrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `srub-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        title: r.title || '',
        description: r.description || '',
        rubric_type: r.type || r.rubric_type || 'analytic',
      }),
    }).catch(() => {});
  }

  // 10. Unpack Policies
  const policiesArr = Array.isArray(parsed.policies) ? parsed.policies : [];
  for (let i = 0; i < policiesArr.length; i++) {
    const pol = policiesArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `spol-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        policy_type: pol.type || 'classroom',
        title: pol.title || '',
        content: pol.content || pol.description || '',
        order: i + 1,
      }),
    }).catch(() => {});
  }

  // 11. Unpack References
  const refsArr = Array.isArray(parsed.references) ? parsed.references : [];
  for (let i = 0; i < refsArr.length; i++) {
    const ref = refsArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `sref-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        title: ref.title || '',
        author: ref.author || '',
        year: String(ref.year || ''),
        url: ref.url || null,
        order: i + 1,
      }),
    }).catch(() => {});
  }

  // 12. Unpack Signatories
  const sigsArr = Array.isArray(parsed.signatories) ? parsed.signatories : [];
  for (let i = 0; i < sigsArr.length; i++) {
    const sig = sigsArr[i];
    await fetch(`${LIKHA_URL}/items/syllabus_signatories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `ssig-${syllabusId}-${i}`,
        syllabus_id: syllabusId,
        name: sig.name || '',
        title: sig.title || '',
        role: sig.role || '',
        order: i + 1,
      }),
    }).catch(() => {});
  }

  // 13. Update courses table
  await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ syllabus: serialized }),
  }).catch(() => {});

  return { id: syllabusId, courseId, version: 1 };
}

/**
 * Extracts context string used by RAG Coordinator and specialized agents.
 */
export async function getRAGContext(courseId: string): Promise<string> {
  const syl = await getCourseSyllabus(courseId);
  if (!syl) return `Course ${courseId} has no syllabus registered.`;

  const title = syl.courseTitle || syl.courseInfo?.title || 'Course';
  const code = syl.courseCode || syl.courseInfo?.code || courseId;
  const desc = syl.description || syl.courseInfo?.description || '';
  const passing = syl.passingCriteria || syl.evaluation?.passingGrade || '75% passing grade';
  const outcomes = Array.isArray(syl.courseOutcomes)
    ? syl.courseOutcomes.map((o: any) => `- ${o.code || ''}: ${o.statement || o}`).join('\n')
    : '';

  return `
Course: ${code} - ${title}
Description: ${desc}
Passing Criteria: ${passing}
Outcomes:
${outcomes}
`.trim();
}
