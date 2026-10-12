import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export function parseJsonField(val: any, fallback: any = null): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val ?? fallback;
}

export function formatLikhaQuestion(q: any): any {
  return {
    id: q.id,
    activityId: q.activity_id || null,
    quizId: q.quiz_id || null,
    examId: q.exam_id || null,
    text: q.question_text || q.text || '',
    type: q.question_type || q.type || 'multiple_choice',
    points: q.points ?? 5,
    correctAnswer: q.correct_answer || q.correctAnswer || null,
    options: parseJsonField(q.options_json || q.options, []),
    order: q.order ?? 0,
  };
}

export function formatLikhaRubric(r: any): any {
  return {
    id: r.id,
    activityId: r.activity_id || null,
    title: r.title || '',
    description: r.description || '',
    points: r.max_points ?? r.points ?? 10,
    order: r.order ?? 0,
  };
}

export function formatLikhaActivity(a: any, relationalQuestions?: any[], relationalRubric?: any[]): any {
  const questions = relationalQuestions && relationalQuestions.length > 0
    ? relationalQuestions.map(formatLikhaQuestion)
    : parseJsonField(a.questions, []);

  const rubric = relationalRubric && relationalRubric.length > 0
    ? relationalRubric.map(formatLikhaRubric)
    : parseJsonField(a.rubric, []);

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
    questions,
    rubric,
  };
}

export function formatLikhaQuiz(q: any, relationalQuestions?: any[]): any {
  const questions = relationalQuestions && relationalQuestions.length > 0
    ? relationalQuestions.map(formatLikhaQuestion)
    : parseJsonField(q.questions, []);

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
    questions,
  };
}

export function formatLikhaExam(e: any, relationalQuestions?: any[]): any {
  const questions = relationalQuestions && relationalQuestions.length > 0
    ? relationalQuestions.map(formatLikhaQuestion)
    : parseJsonField(e.questions, []);

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
    questions,
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
    status: s.status || 'submitted',
    score: s.score ?? null,
    maxScore: s.max_score ?? null,
    submittedAt: s.submitted_at,
    gradedAt: s.graded_at || null,
    gradedBy: s.graded_by || null,
    answers: parseJsonField(s.answers, []),
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
  const activities = json.data || [];
  if (activities.length === 0) return [];

  // Query relational questions and rubrics
  const qRes = await fetch(`${LIKHA_URL}/items/assessment_questions?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const rRes = await fetch(`${LIKHA_URL}/items/rubric_criteria?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  const allQuestions = qRes && qRes.ok ? ((await qRes.json()) as any).data || [] : [];
  const allRubrics = rRes && rRes.ok ? ((await rRes.json()) as any).data || [] : [];

  return activities.map((a: any) => {
    const actQuestions = allQuestions.filter((q: any) => q.activity_id === a.id);
    const actRubric = allRubrics.filter((r: any) => r.activity_id === a.id);
    return formatLikhaActivity(a, actQuestions, actRubric);
  });
}
export const getCourseActivities = getActivities;

export async function getQuizzes(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/quizzes?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const quizzes = json.data || [];
  if (quizzes.length === 0) return [];

  const qRes = await fetch(`${LIKHA_URL}/items/assessment_questions?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const allQuestions = qRes && qRes.ok ? ((await qRes.json()) as any).data || [] : [];

  return quizzes.map((q: any) => {
    const quizQuestions = allQuestions.filter((item: any) => item.quiz_id === q.id);
    return formatLikhaQuiz(q, quizQuestions);
  });
}
export const getCourseQuizzes = getQuizzes;

export async function getExams(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/exams?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const exams = json.data || [];
  if (exams.length === 0) return [];

  const qRes = await fetch(`${LIKHA_URL}/items/assessment_questions?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const allQuestions = qRes && qRes.ok ? ((await qRes.json()) as any).data || [] : [];

  return exams.map((e: any) => {
    const examQuestions = allQuestions.filter((item: any) => item.exam_id === e.id);
    return formatLikhaExam(e, examQuestions);
  });
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
  const activityId = data.id || `act-${Date.now().toString(36)}`;
  const questionsArr = Array.isArray(data.questions) ? data.questions : parseJsonField(data.questions, []);
  const rubricArr = Array.isArray(data.rubric) ? data.rubric : parseJsonField(data.rubric, []);

  const body = {
    id: activityId,
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
    questions: JSON.stringify(questionsArr),
    rubric: JSON.stringify(rubricArr),
  };

  const res = await fetch(`${LIKHA_URL}/items/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  // Relational writes: insert assessment_questions
  for (let i = 0; i < questionsArr.length; i++) {
    const q = questionsArr[i];
    await fetch(`${LIKHA_URL}/items/assessment_questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: q.id || `q-${activityId}-${i}`,
        activity_id: activityId,
        question_text: q.text || q.prompt || '',
        question_type: q.type || 'essay',
        points: q.points ?? 10,
        correct_answer: q.correctAnswer || null,
        options_json: JSON.stringify(q.options || []),
        order: i + 1,
      }),
    }).catch(() => {});
  }

  // Relational writes: insert rubric_criteria
  for (let i = 0; i < rubricArr.length; i++) {
    const r = rubricArr[i];
    await fetch(`${LIKHA_URL}/items/rubric_criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: r.id || `rub-${activityId}-${i}`,
        activity_id: activityId,
        title: r.title || r.criterion || '',
        description: r.description || '',
        max_points: r.points ?? r.max_points ?? 10,
        order: i + 1,
      }),
    }).catch(() => {});
  }

  const json = (await res.json()) as any;
  return formatLikhaActivity(json.data || body, questionsArr, rubricArr);
}

export async function createQuiz(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const quizId = data.id || `quiz-${Date.now().toString(36)}`;
  const questionsArr = Array.isArray(data.questions) ? data.questions : parseJsonField(data.questions, []);

  const body = {
    id: quizId,
    course_id: data.courseId,
    title: data.title,
    description: data.description || null,
    term: data.term || 'midterm',
    time_limit_minutes: data.timeLimitMinutes ?? 30,
    total_points: data.totalPoints ?? 20,
    due_date: data.dueDate || null,
    published: Boolean(data.published),
    questions: JSON.stringify(questionsArr),
  };

  const res = await fetch(`${LIKHA_URL}/items/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  for (let i = 0; i < questionsArr.length; i++) {
    const q = questionsArr[i];
    await fetch(`${LIKHA_URL}/items/assessment_questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: q.id || `q-${quizId}-${i}`,
        quiz_id: quizId,
        question_text: q.text || q.prompt || '',
        question_type: q.type || 'multiple_choice',
        points: q.points ?? 5,
        correct_answer: q.correctAnswer || null,
        options_json: JSON.stringify(q.options || []),
        order: i + 1,
      }),
    }).catch(() => {});
  }

  const json = (await res.json()) as any;
  return formatLikhaQuiz(json.data || body, questionsArr);
}

export async function createExam(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const examId = data.id || `exam-${Date.now().toString(36)}`;
  const questionsArr = Array.isArray(data.questions) ? data.questions : parseJsonField(data.questions, []);

  const body = {
    id: examId,
    course_id: data.courseId,
    title: data.title,
    description: data.description || null,
    term: data.term || 'midterm',
    time_limit_minutes: data.timeLimitMinutes ?? 60,
    total_points: data.totalPoints ?? 100,
    due_date: data.dueDate || null,
    published: Boolean(data.published),
    questions: JSON.stringify(questionsArr),
  };

  const res = await fetch(`${LIKHA_URL}/items/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  for (let i = 0; i < questionsArr.length; i++) {
    const q = questionsArr[i];
    await fetch(`${LIKHA_URL}/items/assessment_questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: q.id || `q-${examId}-${i}`,
        exam_id: examId,
        question_text: q.text || q.prompt || '',
        question_type: q.type || 'multiple_choice',
        points: q.points ?? 5,
        correct_answer: q.correctAnswer || null,
        options_json: JSON.stringify(q.options || []),
        order: i + 1,
      }),
    }).catch(() => {});
  }

  const json = (await res.json()) as any;
  return formatLikhaExam(json.data || body, questionsArr);
}

export async function recordSubmission(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const subId = data.id || `sub-${Date.now().toString(36)}`;
  const body = {
    id: subId,
    course_id: data.courseId,
    student_id: data.studentId,
    activity_id: data.activityId || null,
    quiz_id: data.quizId || null,
    exam_id: data.examId || null,
    status: data.status || 'submitted',
    score: data.score ?? null,
    max_score: data.maxScore ?? null,
    submitted_at: data.submittedAt || new Date().toISOString(),
    answers: typeof data.answers === 'string' ? data.answers : JSON.stringify(data.answers || []),
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

  // Relational write for submission answers
  const answersArr = Array.isArray(data.answers) ? data.answers : [];
  for (let i = 0; i < answersArr.length; i++) {
    const ans = answersArr[i];
    await fetch(`${LIKHA_URL}/items/submission_answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `sa-${subId}-${i}`,
        submission_id: subId,
        question_id: ans.questionId || `q-${i}`,
        student_answer: ans.answer || ans.studentAnswer || String(ans),
        awarded_points: ans.points ?? null,
        feedback: ans.feedback || null,
      }),
    }).catch(() => {});
  }

  const json = (await res.json()) as any;
  return formatLikhaSubmission(json.data || body);
}



export async function gradeSubmission(
  submissionId: string,
  score: number,
  rubricScores?: Record<string, number>,
  feedback?: string,
  gradedByName?: string
): Promise<any> {
  const token = await getLikhaAdminToken();
  const updateData: Record<string, any> = {
    score,
    status: 'graded',
    graded_at: new Date().toISOString(),
    graded_by: gradedByName || 'Faculty Instructor',
  };
  if (rubricScores) updateData.rubric_scores = JSON.stringify(rubricScores);
  if (feedback) {
    updateData.comments = JSON.stringify([
      {
        id: `c-${Date.now().toString(36)}`,
        authorName: gradedByName || 'Faculty Instructor',
        text: feedback,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const res = await fetch(`${LIKHA_URL}/items/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updateData),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn('[assessmentsRepo] gradeSubmission PATCH failed:', errorText);
    return { id: submissionId, score, status: 'graded', ...updateData };
  }

  const json = (await res.json()) as any;
  return formatLikhaSubmission(json.data);
}

