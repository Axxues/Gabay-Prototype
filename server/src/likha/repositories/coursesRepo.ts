import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';
import { ApiError } from '../../utils/errors.js';
import type { LikhaCourse, LikhaCourseSection, LikhaEnrollmentRequest } from '../types.js';

export function formatLikhaCourse(c: any): any {
  let gradingTerms = c.grading_terms;
  if (typeof gradingTerms === 'string') {
    try { gradingTerms = JSON.parse(gradingTerms); } catch { /* ignore */ }
  }
  let gradesReleased = c.grades_released;
  if (typeof gradesReleased === 'string') {
    try { gradesReleased = JSON.parse(gradesReleased); } catch { /* ignore */ }
  }
  let syllabus = c.syllabus;
  if (typeof syllabus === 'string') {
    try { syllabus = JSON.parse(syllabus); } catch { /* ignore */ }
  }

  return {
    id: c.id,
    code: c.code,
    title: c.title,
    section: c.section,
    term: c.term,
    instructorId: c.instructor_id,
    instructorName: c.instructor_name || 'Faculty Instructor',
    published: Boolean(c.published),
    color: c.color || '#3B82F6',
    image: c.image || null,
    enrolledCount: typeof c.enrolled_count === 'number' ? c.enrolled_count : 0,
    credits: typeof c.credits === 'number' ? c.credits : 3,
    chedComplianceCode: c.ched_compliance_code || null,
    joinCode: c.join_code || null,
    gradingTerms: gradingTerms || null,
    gradesReleased: gradesReleased || null,
    syllabus: syllabus || null,
  };
}

export function formatLikhaSection(s: any): any {
  return {
    id: s.id,
    courseId: s.course_id,
    name: s.name,
    capacity: s.capacity ?? null,
    enrolledCount: s.enrolled_count ?? 0,
    schedule: s.schedule ?? null,
    location: s.location ?? null,
  };
}

export function formatLikhaRequest(r: any): any {
  return {
    id: r.id,
    courseId: r.course_id,
    studentId: r.student_id,
    studentName: r.student_name,
    type: r.type,
    status: r.status,
    requestedAt: r.requested_at,
    resolvedAt: r.resolved_at ?? null,
    resolvedBy: r.resolved_by ?? null,
    sectionId: r.section_id ?? null,
    targetSectionId: r.target_section_id ?? null,
  };
}

export async function getAllCourses(enrolledStudentId?: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/courses?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list courses from Likha: HTTP ${res.status}`);
  }

  const json = (await res.json()) as any;
  const courses = (json.data || []).map(formatLikhaCourse);

  if (!enrolledStudentId) {
    return courses;
  }

  // Filter courses by approved enrollment requests
  const reqRes = await fetch(
    `${LIKHA_URL}/items/enrollment_requests?filter[student_id][_eq]=${encodeURIComponent(enrolledStudentId)}&filter[status][_eq]=approved&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!reqRes.ok) return courses;
  const reqJson = (await reqRes.json()) as any;
  const approvedCourseIds = new Set<string>((reqJson.data || []).map((r: any) => r.course_id));

  // If student has no approved requests, include published seed courses or return approved
  if (approvedCourseIds.size === 0) {
    return courses.filter((c: any) => c.published);
  }
  return courses.filter((c: any) => approvedCourseIds.has(c.id));
}

export async function getCourseById(id: string): Promise<any | null> {
  try {
    const token = await getLikhaAdminToken();
    const res = await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as any;
    if (!json.data) return null;
    return formatLikhaCourse(json.data);
  } catch {
    return null;
  }
}

export async function getCourseByJoinCode(joinCode: string): Promise<any | null> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/courses?filter[join_code][_eq]=${encodeURIComponent(joinCode)}&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const json = (await res.json()) as any;
  if (!json.data || json.data.length === 0) return null;
  return formatLikhaCourse(json.data[0]);
}

export async function createCourse(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body: any = {
    id: data.id,
    code: data.code,
    title: data.title,
    section: data.section,
    term: data.term,
    instructor_id: data.instructorId,
    instructor_name: data.instructorName,
    published: Boolean(data.published),
    color: data.color || '#3B82F6',
    image: data.image || null,
    enrolled_count: data.enrolledCount || 0,
    credits: data.credits || 3,
    ched_compliance_code: data.chedComplianceCode || null,
    join_code: data.joinCode || null,
    grading_terms: data.gradingTerms ? JSON.stringify(data.gradingTerms) : null,
    grades_released: data.gradesReleased ? JSON.stringify(data.gradesReleased) : null,
    syllabus: data.syllabus ? JSON.stringify(data.syllabus) : null,
  };

  const res = await fetch(`${LIKHA_URL}/items/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(400, 'create_course_failed', `Failed to create course in Likha: ${errText}`);
  }

  const json = (await res.json()) as any;
  return formatLikhaCourse(json.data);
}

export async function updateCourse(id: string, updates: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body: any = {};
  if (updates.code !== undefined) body.code = updates.code;
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.section !== undefined) body.section = updates.section;
  if (updates.term !== undefined) body.term = updates.term;
  if (updates.published !== undefined) body.published = updates.published;
  if (updates.color !== undefined) body.color = updates.color;
  if (updates.image !== undefined) body.image = updates.image;
  if (updates.enrolledCount !== undefined) body.enrolled_count = updates.enrolledCount;
  if (updates.credits !== undefined) body.credits = updates.credits;
  if (updates.joinCode !== undefined) body.join_code = updates.joinCode;
  if (updates.gradingTerms !== undefined) {
    body.grading_terms = typeof updates.gradingTerms === 'string' ? updates.gradingTerms : JSON.stringify(updates.gradingTerms);
  }
  if (updates.gradesReleased !== undefined) {
    body.grades_released = typeof updates.gradesReleased === 'string' ? updates.gradesReleased : JSON.stringify(updates.gradesReleased);
  }
  if (updates.syllabus !== undefined) {
    body.syllabus = typeof updates.syllabus === 'string' ? updates.syllabus : JSON.stringify(updates.syllabus);
  }

  const res = await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(400, 'update_course_failed', `Failed to update course in Likha: ${errText}`);
  }

  const json = (await res.json()) as any;
  return formatLikhaCourse(json.data);
}

export async function deleteCourse(id: string): Promise<boolean> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function getCourseSections(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/course_sections?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaSection);
}

export async function createCourseSection(courseId: string, data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `sec-${Date.now().toString(36)}`,
    course_id: courseId,
    name: data.name,
    capacity: data.capacity || 30,
    enrolled_count: data.enrolledCount || 0,
    schedule: data.schedule || null,
    location: data.location || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/course_sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaSection(json.data);
}

export async function updateCourseSection(sectionId: string, updates: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/course_sections/${encodeURIComponent(sectionId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  const json = (await res.json()) as any;
  return formatLikhaSection(json.data);
}

export async function deleteCourseSection(sectionId: string): Promise<boolean> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/course_sections/${encodeURIComponent(sectionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function getEnrollmentRequests(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(
    `${LIKHA_URL}/items/enrollment_requests?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-requested_at&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaRequest);
}

export const getRequestsForCourse = getEnrollmentRequests;

export async function getStudentRequests(studentId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(
    `${LIKHA_URL}/items/enrollment_requests?filter[student_id][_eq]=${encodeURIComponent(studentId)}&sort=-requested_at&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaRequest);
}

export async function createEnrollmentRequest(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `req-${Date.now().toString(36)}`,
    course_id: data.courseId,
    student_id: data.studentId,
    student_name: data.studentName,
    type: data.type || 'self_join',
    status: data.status || 'pending',
    requested_at: data.requestedAt || new Date().toISOString(),
    section_id: data.sectionId || null,
    target_section_id: data.targetSectionId || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/enrollment_requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaRequest(json.data);
}

export async function resolveEnrollmentRequest(requestId: string, status: 'approved' | 'rejected', resolvedBy: string): Promise<any> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/enrollment_requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    }),
  });

  const json = (await res.json()) as any;
  return formatLikhaRequest(json.data);
}
