import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export function parseJsonField(val: any, fallback: any = null): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val ?? fallback;
}

export function formatLikhaActivity(a: any): any {
  return {
    id: a.id,
    courseId: a.course_id,
    title: a.title,
    description: a.description || null,
    term: a.term || 'midterm',
    format: a.format || 'questionset',
    category: a.category || null,
    weight: a.weight ?? null,
    totalPoints: a.total_points ?? 50,
    dueDate: a.due_date || null,
    availableFrom: a.available_from || null,
    availableUntil: a.available_until || null,
    published: Boolean(a.published),
    questions: parseJsonField(a.questions, []),
    rubric: parseJsonField(a.rubric, []),
  };
}

export function formatLikhaQuiz(q: any): any {
  return {
    id: q.id,
    courseId: q.course_id,
    title: q.title,
    description: q.description || null,
    term: q.term || 'midterm',
    timeLimitMinutes: q.time_limit_minutes ?? 30,
    totalPoints: q.total_points ?? 20,
    dueDate: q.due_date || null,
    published: Boolean(q.published),
    questions: parseJsonField(q.questions, []),
  };
}

export function formatLikhaExam(e: any): any {
  return {
    id: e.id,
    courseId: e.course_id,
    title: e.title,
    description: e.description || null,
    term: e.term || 'midterm',
    timeLimitMinutes: e.time_limit_minutes ?? 60,
    totalPoints: e.total_points ?? 100,
    dueDate: e.due_date || null,
    published: Boolean(e.published),
    questions: parseJsonField(e.questions, []),
  };
}

export function formatLikhaSubmission(s: any): any {
  return {
    id: s.id,
    courseId: s.course_id,
    studentId: s.student_id,
    activityId: s.activity_id || null,
    quizId: s.quiz_id || null,
    examId: s.exam_id || null,
    status: s.status,
    score: s.score ?? null,
    maxScore: s.max_score ?? null,
    submittedAt: s.submitted_at,
    gradedAt: s.graded_at || null,
    gradedBy: s.graded_by || null,
    answers: parseJsonField(s.answers, {}),
    rubricScores: parseJsonField(s.rubric_scores, {}),
    comments: parseJsonField(s.comments, []),
    fileUrl: s.file_url || null,
    fileName: s.file_name || null,
    content: s.content || null,
  };
}

export async function getActivities(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/activities?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaActivity);
}

export async function getQuizzes(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/quizzes?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaQuiz);
}

export async function getExams(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/exams?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaExam);
}

export async function getSubmissions(courseId: string, studentId?: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  let url = `${LIKHA_URL}/items/submissions?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=250`;
  if (studentId) {
    url += `&filter[student_id][_eq]=${encodeURIComponent(studentId)}`;
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaSubmission);
}

export async function createActivity(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `act-${Date.now().toString(36)}`,
    course_id: data.courseId,
    title: data.title,
    description: data.description || null,
    term: data.term || 'midterm',
    format: data.format || 'questionset',
    category: data.category || null,
    weight: data.weight ?? null,
    total_points: data.totalPoints ?? 50,
    due_date: data.dueDate || null,
    available_from: data.availableFrom || null,
    available_until: data.availableUntil || null,
    published: Boolean(data.published),
    questions: typeof data.questions === 'string' ? data.questions : JSON.stringify(data.questions || []),
    rubric: typeof data.rubric === 'string' ? data.rubric : JSON.stringify(data.rubric || []),
  };

  const res = await fetch(`${LIKHA_URL}/items/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaActivity(json.data);
}

export async function recordSubmission(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `sub-${Date.now().toString(36)}`,
    course_id: data.courseId,
    student_id: data.studentId,
    activity_id: data.activityId || null,
    quiz_id: data.quizId || null,
    exam_id: data.examId || null,
    status: data.status || 'submitted',
    score: data.score ?? null,
    max_score: data.maxScore ?? null,
    submitted_at: data.submittedAt || new Date().toISOString(),
    answers: typeof data.answers === 'string' ? data.answers : JSON.stringify(data.answers || {}),
    rubric_scores: typeof data.rubricScores === 'string' ? data.rubricScores : JSON.stringify(data.rubricScores || {}),
    comments: typeof data.comments === 'string' ? data.comments : JSON.stringify(data.comments || []),
    file_url: data.fileUrl || null,
    file_name: data.fileName || null,
    content: data.content || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaSubmission(json.data);
}

export async function gradeSubmission(
  submissionId: string,
  score: number,
  rubricScores: Record<string, number> = {},
  comment?: string,
  gradedBy?: string
): Promise<any> {
  const token = await getLikhaAdminToken();
  const body: any = {
    score,
    status: 'graded',
    graded_at: new Date().toISOString(),
    graded_by: gradedBy || 'Faculty Instructor',
    rubric_scores: JSON.stringify(rubricScores),
  };
  if (comment) {
    body.comments = JSON.stringify([{ text: comment, author: gradedBy || 'Faculty', createdAt: new Date().toISOString() }]);
  }

  const res = await fetch(`${LIKHA_URL}/items/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaSubmission(json.data);
}
