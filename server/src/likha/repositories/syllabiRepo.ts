import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export async function getCourseSyllabus(courseId: string): Promise<any | null> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-version&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const json = (await res.json()) as any;
  if (!json.data || json.data.length === 0) {
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

  let content = json.data[0].content;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { /* ignore */ }
  }
  return content;
}

export async function saveCourseSyllabus(courseId: string, content: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const serialized = typeof content === 'string' ? content : JSON.stringify(content);

  // 1. Update courses table
  await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ syllabus: serialized }),
  });

  // 2. Insert into syllabi versioned table
  const newSyl = {
    id: `syl-${courseId}-${Date.now()}`,
    course_id: courseId,
    version: 1,
    status: 'published',
    content: serialized,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const res = await fetch(`${LIKHA_URL}/items/syllabi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(newSyl),
  });

  const json = (await res.json()) as any;
  return json.data;
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
  const passing = syl.passingCriteria || syl.courseInfo?.passingCriteria || '75% passing grade';
  const outcomes = Array.isArray(syl.intendedLearningOutcomes)
    ? syl.intendedLearningOutcomes.map((o: any) => `- ${o.statement || o}`).join('\n')
    : '';

  return `
Course: ${code} - ${title}
Description: ${desc}
Passing Criteria: ${passing}
Outcomes:
${outcomes}
`.trim();
}
