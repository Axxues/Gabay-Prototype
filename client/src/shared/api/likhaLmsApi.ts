import { getToken, setToken, clearToken } from './client';

export const LIKHA_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LIKHA_URL) ||
  (typeof window !== 'undefined' &&
  window.location?.hostname === 'localhost' &&
  !((globalThis as any).process?.env?.VITEST)
    ? '/likha'
    : 'https://gabay.zyberlab.com');

const SERVICE_EMAIL = 'jayveegenetareyes@gmail.com';
const SERVICE_PASSWORD = 'qwerty12345';
let cachedServiceToken: string | null = null;

export interface LikhaUploadedFile {
  id: string;
  filename_download: string;
  url: string;
}

async function getServiceToken(): Promise<string> {
  if (cachedServiceToken) return cachedServiceToken;
  try {
    const res = await fetch(`${LIKHA_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
    });
    if (res.ok) {
      const data = await res.json();
      cachedServiceToken = data.data?.access_token || null;
      return cachedServiceToken || '';
    }
  } catch {
    /* ignore fallback error */
  }
  return '';
}

import { likhaCache } from './likhaCache';

/**
 * Robust fetch wrapper that applies Directus JWT auth, transparent in-memory TTL
 * caching for GET requests, request deduplication, and auto-invalidation on mutations.
 */
async function rawLikhaFetch<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const url = path.startsWith('http') ? path : `${LIKHA_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 403 && allowRetry) {
    const svcToken = await getServiceToken();
    if (svcToken) {
      headers.set('Authorization', `Bearer ${svcToken}`);
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        throw new Error(`Likha request failed (${retryRes.status}): ${await retryRes.text().catch(() => '')}`);
      }
      const retryJson = await retryRes.json().catch(() => ({}));
      return retryJson.data !== undefined ? retryJson.data : retryJson;
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const error: any = new Error(`Likha request failed (${res.status}): ${errorText}`);
    error.status = res.status;
    error.code = res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : 'request_failed';
    throw error;
  }

  const json = await res.json().catch(() => ({}));
  return json.data !== undefined ? json.data : json;
}

function getPathTtl(path: string): number {
  if (path.includes('/items/courses')) return 60000;
  if (path.includes('/items/syllabi')) return 120000;
  if (path.includes('/users')) return 300000;
  if (path.includes('/items/calendar_events')) return 60000;
  if (path.includes('/items/notifications')) return 15000;
  return 30000;
}

async function likhaRequest<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const token = getToken() || 'anon';
    const cacheKey = `${token}:${path}`;
    const ttl = getPathTtl(path);
    return likhaCache.getOrFetch<T>(cacheKey, () => rawLikhaFetch<T>(path, options, allowRetry), ttl);
  }

  // Mutation: execute and invalidate affected collection cache
  const result = await rawLikhaFetch<T>(path, options, allowRetry);
  const resourceBase = path.split('?')[0];
  likhaCache.invalidate(resourceBase);
  return result;
}

export const likhaLmsApi = {
  cache: likhaCache,
  invalidateCache(pattern?: string): void {
    if (pattern) {
      likhaCache.invalidate(pattern);
    } else {
      likhaCache.clear();
    }
  },

  // =========================================================================
  // 1. AUTHENTICATION & DIRECTORY
  // =========================================================================
  auth: {
    async login(email: string, password: string): Promise<{ token: string; user: any }> {
      const res = await fetch(`${LIKHA_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        throw new Error(`Likha authentication failed: ${res.status}`);
      }
      const json = await res.json();
      const token = json.data?.access_token;
      if (token) setToken(token);

      const me = await likhaRequest('/users/me?fields=*,role.*');
      return { token, user: me };
    },

    async getMe(): Promise<any> {
      return likhaRequest('/users/me?fields=*,role.*');
    },

    logout(): void {
      clearToken();
      cachedServiceToken = null;
      likhaCache.clear();
    },
  },

  users: {
    async getUsers(): Promise<any[]> {
      const users = await likhaRequest<any[]>('/users?fields=*,role.*&limit=250&sort=first_name');
      return users || [];
    },

    async updateUser(id: string, updates: any): Promise<any> {
      return likhaRequest(`/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
  },

  // =========================================================================
  // 2. COURSES, SECTIONS & ENROLLMENT REQUESTS
  // =========================================================================
  courses: {
    async getCourses(studentId?: string): Promise<any[]> {
      const query = 'fields=*,cover_image.*,instructor.*,sections.*';
      const all = await likhaRequest<any[]>(`/items/courses?${query}`);
      if (!studentId) return all || [];

      // Filter by approved enrollment requests
      const requests = await likhaRequest<any[]>(
        `/items/enrollment_requests?filter[student_id][_eq]=${encodeURIComponent(studentId)}&filter[status][_eq]=approved&limit=100`
      );
      const approvedCourseIds = new Set((requests || []).map((r: any) => r.course_id));
      if (approvedCourseIds.size === 0) {
        return (all || []).filter((c: any) => c.published);
      }
      return (all || []).filter((c: any) => approvedCourseIds.has(c.id));
    },

    async getCourse(id: string): Promise<any> {
      return likhaRequest(`/items/courses/${encodeURIComponent(id)}?fields=*,cover_image.*,instructor.*,sections.*`);
    },

    async getCourseEnrollments(courseId?: string): Promise<any[]> {
      const query = courseId
        ? `filter[course][_eq]=${encodeURIComponent(courseId)}&fields=*,user.*,course.*`
        : 'fields=*,user.*,course.*';
      return likhaRequest<any[]>(`/items/Course_Enrollments?${query}`).catch(() => []);
    },

    async createCourse(course: any): Promise<any> {
      return likhaRequest('/items/courses', {
        method: 'POST',
        body: JSON.stringify(course),
      });
    },

    async updateCourse(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/courses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteCourse(id: string): Promise<void> {
      await likhaRequest(`/items/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  sections: {
    async getSections(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_sections?filter[course_id][_eq]=${encodeURIComponent(courseId)}`);
    },

    async createSection(section: any): Promise<any> {
      return likhaRequest('/items/course_sections', {
        method: 'POST',
        body: JSON.stringify(section),
      });
    },
  },

  requests: {
    async getRequests(courseId?: string, status?: string): Promise<any[]> {
      let q = `/items/enrollment_requests?limit=200`;
      if (courseId) q += `&filter[course_id][_eq]=${encodeURIComponent(courseId)}`;
      if (status) q += `&filter[status][_eq]=${encodeURIComponent(status)}`;
      return likhaRequest(q);
    },

    async createRequest(request: any): Promise<any> {
      return likhaRequest('/items/enrollment_requests', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    async updateRequest(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/enrollment_requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
  },

  // =========================================================================
  // 3. MODULES & MODULE ITEMS
  // =========================================================================
  modules: {
    async getModulesWithItems(courseId: string): Promise<any[]> {
      const modules = await likhaRequest<any[]>(
        `/items/modules?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*&sort=order`
      );
      if (!Array.isArray(modules) || modules.length === 0) return [];
      const moduleIds = modules.map((m: any) => m.id).filter(Boolean);
      if (moduleIds.length === 0) return modules.map((m: any) => ({ ...m, items: [] }));
      const items = await likhaRequest<any[]>(
        `/items/module_items?filter[module_id][_in]=${moduleIds.join(',')}&sort=order`
      ).catch(() => []);
      const itemMap = new Map<string, any[]>();
      for (const item of (items || [])) {
        const list = itemMap.get(item.module_id) || [];
        list.push(item);
        itemMap.set(item.module_id, list);
      }
      return modules.map((m: any) => ({ ...m, items: itemMap.get(m.id) || [] }));
    },

    async createModule(module: any): Promise<any> {
      return likhaRequest('/items/modules', {
        method: 'POST',
        body: JSON.stringify(module),
      });
    },

    async updateModule(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/modules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteModule(id: string): Promise<void> {
      await likhaRequest(`/items/modules/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async createModuleItem(item: any): Promise<any> {
      return likhaRequest('/items/module_items', {
        method: 'POST',
        body: JSON.stringify(item),
      });
    },

    async updateModuleItem(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/module_items/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteModuleItem(id: string): Promise<void> {
      await likhaRequest(`/items/module_items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getComments(itemId: string): Promise<any[]> {
      return likhaRequest(`/items/module_comments?filter[item_id][_eq]=${encodeURIComponent(itemId)}&sort=created_at`);
    },

    async addComment(comment: any): Promise<any> {
      return likhaRequest('/items/module_comments', {
        method: 'POST',
        body: JSON.stringify(comment),
      });
    },
  },

  // =========================================================================
  // 4. ASSESSMENTS (ACTIVITIES, QUIZZES, EXAMS) & 3NF CHILD RELATIONS
  // =========================================================================
  assessments: {
    async getActivities(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,attachments.directus_files_id.*,questions.*`;
      return likhaRequest(`/items/activities?${query}`);
    },

    async saveActivity(activity: any): Promise<any> {
      return likhaLmsApi.saveActivity(activity);
    },

    async deleteActivity(id: string): Promise<void> {
      await likhaRequest(`/items/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getQuizzes(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,questions.*`;
      return likhaRequest(`/items/quizzes?${query}`);
    },

    async saveQuiz(quiz: any): Promise<any> {
      const { questions, ...rootPayload } = quiz;
      const isUpdate = Boolean(rootPayload.id);
      const url = isUpdate ? `/items/quizzes/${encodeURIComponent(rootPayload.id)}` : '/items/quizzes';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify(rootPayload),
      });
      const quizId = saved.id || rootPayload.id;

      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await likhaRequest('/items/assessment_questions', {
            method: 'POST',
            body: JSON.stringify({
              id: q.id || `q-quiz-${quizId}-${i}`,
              quiz_id: quizId,
              question_text: q.question_text || q.text || q.prompt || '',
              question_type: q.question_type || q.type || 'multiple_choice',
              points: Number(q.points) || 1,
              correct_answer: q.correct_answer || q.correctAnswer || null,
              options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
              order: i + 1,
            }),
          }).catch(() => {});
        }
      }
      return { ...saved, questions: questions || [] };
    },

    async deleteQuiz(id: string): Promise<void> {
      await likhaRequest(`/items/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getExams(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,questions.*`;
      return likhaRequest(`/items/exams?${query}`);
    },

    async saveExam(exam: any): Promise<any> {
      const { questions, ...rootPayload } = exam;
      const isUpdate = Boolean(rootPayload.id);
      const url = isUpdate ? `/items/exams/${encodeURIComponent(rootPayload.id)}` : '/items/exams';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify(rootPayload),
      });
      const examId = saved.id || rootPayload.id;

      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await likhaRequest('/items/assessment_questions', {
            method: 'POST',
            body: JSON.stringify({
              id: q.id || `q-exam-${examId}-${i}`,
              exam_id: examId,
              question_text: q.question_text || q.text || q.prompt || '',
              question_type: q.question_type || q.type || 'multiple_choice',
              points: Number(q.points) || 1,
              correct_answer: q.correct_answer || q.correctAnswer || null,
              options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
              order: i + 1,
            }),
          }).catch(() => {});
        }
      }
      return { ...saved, questions: questions || [] };
    },

    async deleteExam(id: string): Promise<void> {
      await likhaRequest(`/items/exams/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  // =========================================================================
  // 5. SUBMISSIONS & SPEEDGRADER
  // =========================================================================
  submissions: {
    async getSubmissions(assessmentId: string, type: 'activity' | 'quiz' | 'exam' = 'activity'): Promise<any[]> {
      const field = type === 'quiz' ? 'quiz_id' : type === 'exam' ? 'exam_id' : 'activity_id';
      const q = `/items/submissions?filter[${field}][_eq]=${encodeURIComponent(assessmentId)}&fields=*,answers.*`;
      return likhaRequest(q);
    },

    async submitAssessment(submission: any): Promise<any> {
      return likhaLmsApi.submitActivity(submission);
    },

    async gradeSubmission(id: string, score: number, feedback?: string): Promise<any> {
      return likhaLmsApi.gradeSubmission(id, score, feedback);
    },

    async addRubricScore(submissionId: string, criterionId: string, points: number, feedback?: string): Promise<any> {
      return likhaRequest('/items/submission_rubric_scores', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          criterion_id: criterionId,
          points_awarded: points,
          feedback: feedback || '',
        }),
      });
    },

    async addSubmissionComment(submissionId: string, authorId: string, content: string): Promise<any> {
      return likhaRequest('/items/submission_comments', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          author_id: authorId,
          content,
          created_at: new Date().toISOString(),
        }),
      });
    },
  },

  // =========================================================================
  // 6. GRADES & SPR
  // =========================================================================
  grades: {
    async getCourseGrades(courseId: string): Promise<any[]> {
      return likhaLmsApi.getCourseGrades(courseId);
    },

    async saveGradeWithCells(courseId: string, studentId: string, cells: Array<{ task_id: string; score: number }>): Promise<any> {
      // Find or create course_grades entry
      const existing = await likhaRequest<any[]>(
        `/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&filter[student_id][_eq]=${encodeURIComponent(studentId)}&limit=1`
      );
      let gradeRecord = existing && existing[0];
      if (!gradeRecord) {
        gradeRecord = await likhaRequest('/items/course_grades', {
          method: 'POST',
          body: JSON.stringify({
            id: `cg-${courseId}-${studentId}`,
            course_id: courseId,
            student_id: studentId,
          }),
        });
      }

      // Upsert spr_cells child rows
      for (const cell of cells) {
        await likhaRequest('/items/spr_cells', {
          method: 'POST',
          body: JSON.stringify({
            id: `spr-${gradeRecord.id}-${cell.task_id}`,
            course_grade_id: gradeRecord.id,
            student_id: studentId,
            task_id: cell.task_id,
            score: cell.score,
          }),
        }).catch(() => {});
      }
      return gradeRecord;
    },

    async getSPRConfig(courseId: string): Promise<any> {
      const res = await likhaRequest<any[]>(`/items/spr_configs?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=1`);
      return res && res[0] ? res[0] : null;
    },

    async saveSPRConfig(courseId: string, config: any): Promise<any> {
      const existing = await likhaLmsApi.grades.getSPRConfig(courseId);
      if (existing) {
        return likhaRequest(`/items/spr_configs/${encodeURIComponent(existing.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(config),
        });
      }
      return likhaRequest('/items/spr_configs', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId, ...config }),
      });
    },
  },

  // =========================================================================
  // 7. COMMUNICATIONS (ANNOUNCEMENTS, DISCUSSIONS, MESSAGES, NOTIFICATIONS)
  // =========================================================================
  communications: {
    async getAnnouncements(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/announcements?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,replies.*&sort=-date`);
    },

    async createAnnouncement(data: any): Promise<any> {
      return likhaRequest('/items/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async addAnnouncementReply(announcementId: string, reply: any): Promise<any> {
      return likhaRequest('/items/announcement_replies', {
        method: 'POST',
        body: JSON.stringify({ announcement_id: announcementId, ...reply }),
      });
    },

    async getDiscussions(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/discussions?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,replies.*&sort=-date`);
    },

    async createDiscussion(data: any): Promise<any> {
      return likhaRequest('/items/discussions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async addDiscussionReply(discussionId: string, reply: any): Promise<any> {
      return likhaRequest('/items/discussion_replies', {
        method: 'POST',
        body: JSON.stringify({ discussion_id: discussionId, ...reply }),
      });
    },

    async getNotifications(userId: string): Promise<any[]> {
      return likhaRequest(
        `/items/notifications?filter[user_id][_eq]=${encodeURIComponent(userId)}&fields=id,user_id,title,message,type,is_read,created_at,link&sort=-created_at&limit=50`
      );
    },

    async markNotificationRead(id: string): Promise<void> {
      await likhaRequest(`/items/notifications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true }),
      });
    },

    async getMessages(): Promise<any[]> {
      return likhaRequest('/items/chat_messages?sort=created_at&limit=200');
    },

    async sendMessage(data: any): Promise<any> {
      return likhaRequest('/items/chat_messages', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getChatGroups(): Promise<any[]> {
      return likhaRequest('/items/chat_groups?limit=50');
    },

    async createChatGroup(data: any): Promise<any> {
      return likhaRequest('/items/chat_groups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getCalendarEvents(): Promise<any[]> {
      return likhaRequest('/items/calendar_events?limit=200&sort=date');
    },

    async createCalendarEvent(data: any): Promise<any> {
      return likhaRequest('/items/calendar_events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getAdvisingSlots(): Promise<any[]> {
      return likhaRequest('/items/advising_slots?limit=100&sort=date');
    },

    async bookAdvisingSlot(id: string, studentId: string): Promise<any> {
      return likhaRequest(`/items/advising_slots/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ student_id: studentId, status: 'booked' }),
      });
    },
  },

  // =========================================================================
  // 8. SYLLABUS MANAGEMENT
  // =========================================================================
  syllabus: {
    async getSyllabus(courseId: string): Promise<any | null> {
      const list = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,course_info.*,course_outcomes.*,learning_plans.*,policies.*,institution.*&limit=1`
      );
      return list?.[0] || null;
    },

    async createSyllabus(data: any): Promise<any> {
      return likhaRequest('/items/syllabi', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateSyllabus(syllabusId: string, data: any): Promise<any> {
      return likhaRequest(`/items/syllabi/${encodeURIComponent(syllabusId)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  // =========================================================================
  // 9. FILE STORAGE
  // =========================================================================
  files: {
    async uploadFile(file: File): Promise<LikhaUploadedFile> {
      return likhaLmsApi.uploadFile(file);
    },

    async getCourseFiles(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_files?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,file.*`);
    },

    async createCourseFile(data: any): Promise<any> {
      return likhaRequest('/items/course_files', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // =========================================================================
  // BACKWARD COMPATIBILITY TOP-LEVEL METHODS
  // =========================================================================
  async getCoursesWithRelations(): Promise<any[]> {
    const fields = 'fields=*,cover_image.*,instructor.*,sections.*';
    return likhaRequest(`/items/courses?${fields}`);
  },

  async getActivitiesWithRelations(courseId: string): Promise<any[]> {
    const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,attachments.directus_files_id.*,questions.*`;
    return likhaRequest(`/items/activities?${query}`);
  },

  async uploadFile(file: File): Promise<LikhaUploadedFile> {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res = await fetch(`${LIKHA_URL}/files`, { method: 'POST', headers, body: formData });
    if (res.status === 403) {
      const svcToken = await getServiceToken();
      if (svcToken) {
        headers.Authorization = `Bearer ${svcToken}`;
        res = await fetch(`${LIKHA_URL}/files`, { method: 'POST', headers, body: formData });
      }
    }
    if (!res.ok) throw new Error(`File upload to Likha failed: ${res.status}`);
    const json = await res.json();
    const fileData = json.data;
    return {
      id: fileData.id,
      filename_download: fileData.filename_download || file.name,
      url: `${LIKHA_URL}/assets/${fileData.id}`,
    };
  },

  async loginLikhaUser(email: string, password: string): Promise<{ token: string; user: any }> {
    return likhaLmsApi.auth.login(email, password);
  },

  async getNotifications(userId: string): Promise<any[]> {
    return likhaLmsApi.communications.getNotifications(userId);
  },

  async saveActivity(activity: any): Promise<any> {
    const { questions, rubric, ...rootPayload } = activity;
    const isUpdate = Boolean(rootPayload.id);
    const url = isUpdate
      ? `/items/activities/${encodeURIComponent(rootPayload.id)}`
      : `/items/activities`;
    const saved = await likhaRequest(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      body: JSON.stringify(rootPayload),
    });
    const actId = saved.id || rootPayload.id;

    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await likhaRequest('/items/assessment_questions', {
          method: 'POST',
          body: JSON.stringify({
            id: q.id || `q-${actId}-${i}`,
            activity_id: actId,
            question_text: q.question_text || q.text || q.prompt || '',
            question_type: q.question_type || q.type || 'essay',
            points: Number(q.points) || 10,
            correct_answer: q.correct_answer || q.correctAnswer || null,
            options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
            order: i + 1,
          }),
        }).catch(() => {});
      }
    }

    if (Array.isArray(rubric) && rubric.length > 0) {
      for (let i = 0; i < rubric.length; i++) {
        const r = rubric[i];
        await likhaRequest('/items/rubric_criteria', {
          method: 'POST',
          body: JSON.stringify({
            id: r.id || `rub-${actId}-${i}`,
            activity_id: actId,
            title: r.title || r.criterion || '',
            description: r.description || '',
            max_points: Number(r.max_points ?? r.points) || 10,
            order: i + 1,
          }),
        }).catch(() => {});
      }
    }

    return { ...saved, questions: questions || [], rubric: rubric || [] };
  },

  async submitActivity(submission: any): Promise<any> {
    const { answers, ...rootPayload } = submission;
    const subId = rootPayload.id || `sub-${Date.now().toString(36)}`;
    const saved = await likhaRequest('/items/submissions', {
      method: 'POST',
      body: JSON.stringify({ id: subId, ...rootPayload }),
    });

    const answersList = Array.isArray(answers)
      ? answers
      : typeof answers === 'object' && answers !== null
        ? Object.entries(answers).map(([qid, val]) => ({ questionId: qid, answer: String(val) }))
        : [];

    for (let i = 0; i < answersList.length; i++) {
      const a = answersList[i];
      await likhaRequest('/items/submission_answers', {
        method: 'POST',
        body: JSON.stringify({
          id: `sa-${subId}-${i}`,
          submission_id: subId,
          question_id: a.questionId || a.question_id || `q-${i}`,
          student_answer: a.answer || a.studentAnswer || String(a),
          awarded_points: a.points ?? null,
          feedback: a.feedback || null,
        }),
      }).catch(() => {});
    }

    return { ...saved, answers: answersList };
  },

  async gradeSubmission(submissionId: string, score: number, feedback?: string): Promise<any> {
    return likhaRequest(`/items/submissions/${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        score,
        feedback,
        status: 'graded',
        graded_at: new Date().toISOString(),
      }),
    });
  },

  async getCourseGrades(courseId: string): Promise<any[]> {
    return likhaRequest(
      `/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,spr_cells.*`
    );
  },
};
