// src/utils/notifiers.ts
import { isAnnouncementVisibleToViewer } from './sections';
import type { UserRole } from '../types/lms';

interface ReplyAuthor { id: string }
interface AnnLike { authorId: string }
interface ModuleLike {
  authorId?: string;
  comments?: Array<{ authorId: string }>;
}

export function resolveAnnouncementReplyRecipient(
  announcement: AnnLike,
  replier: ReplyAuthor
): string | null {
  if (announcement.authorId === replier.id) return null;
  return announcement.authorId;
}

export function resolveModuleReplyRecipient(
  mod: ModuleLike,
  commenter: ReplyAuthor
): string | null {
  const comments = mod.comments || [];
  for (let i = comments.length - 1; i >= 0; i--) {
    const priorId = comments[i].authorId;
    if (priorId && priorId !== commenter.id) return priorId;
  }
  if (mod.authorId && mod.authorId !== commenter.id) return mod.authorId;
  return null;
}

interface AnnBadgeLike {
  id: string;
  courseId: string;
  sectionId?: string;
  sectionRestriction?: string;
  readBy?: string[];
}

export function countUnreadAnnouncements(
  announcements: AnnBadgeLike[],
  viewer: { id: string; role: UserRole; sectionId: string | null },
  courseId: string
): number {
  return announcements.filter(a => {
    if (a.courseId !== courseId && a.courseId !== 'all') return false;
    const scope = a.sectionId ?? (a.sectionRestriction && a.sectionRestriction !== 'All Sections' ? a.sectionRestriction : 'all');
    if (!isAnnouncementVisibleToViewer({ sectionId: scope }, viewer.sectionId, viewer.role)) return false;
    return !(a.readBy || []).includes(viewer.id);
  }).length;
}

export function countUnreadMessages(
  messages: Array<{ recipientId: string; read: boolean }>,
  viewerId: string
): number {
  return messages.filter(m => m.recipientId === viewerId && !m.read).length;
}

export function countPendingPeople(
  requests: Array<{ courseId: string; status: string }>,
  courseId: string
): number {
  return requests.filter(r => r.courseId === courseId && r.status === 'pending').length;
}

export function isNewerThanVisit(updatedAt: string, lastVisit: string | undefined): boolean {
  if (!lastVisit) return true;
  return new Date(updatedAt).getTime() > new Date(lastVisit).getTime();
}

export function countNewFiles(
  files: Array<{ courseId: string; updatedAt: string }>,
  courseId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`files:${courseId}`];
  return files.filter(f => f.courseId === courseId && isNewerThanVisit(f.updatedAt, visit)).length;
}

export function countNewGrades(
  grades: Array<{ courseId: string; studentId: string; updatedAt?: string }>,
  courseId: string,
  studentId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`grades:${courseId}`];
  return grades.filter(
    g => g.courseId === courseId && g.studentId === studentId && g.updatedAt && isNewerThanVisit(g.updatedAt, visit)
  ).length;
}

export function countUpcomingCalendar(
  events: Array<{ courseId?: string; date: string; createdAt?: string }>,
  courseId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`calendar:${courseId}`];
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return events.filter(e => {
    if (e.courseId && e.courseId !== courseId) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime()) || d < now || d > in14d) return false;
    if (e.createdAt && visit) return isNewerThanVisit(e.createdAt, visit);
    if (visit) return false;
    return true;
  }).length;
}

export function countStudentAssessmentBadge(
  publishedIds: string[],
  submittedActivityKeys: string[]
): number {
  const submitted = new Set(submittedActivityKeys);
  return publishedIds.filter(id => !submitted.has(id)).length;
}

export function countFacultyGradingBadge(
  submissions: Array<{ activityKey?: string; status?: string }>,
  activityKeys: string[]
): number {
  const wanted = new Set(activityKeys);
  return submissions.filter(s => s.activityKey !== undefined && wanted.has(s.activityKey) && s.status === 'submitted').length;
}

export function countAssessmentCategoryBadge(
  activities: Array<{ id: string; courseId: string; format?: string; published?: boolean; assessmentType?: string }>,
  submissions: Array<{ activityKey?: string; courseId?: string; studentId?: string; status?: string }>,
  category: 'activity' | 'assignment' | 'project' | 'presentation',
  userId: string,
  role: UserRole,
  courseId: string
): number {
  const matchesCat = (a: { assessmentType?: string }) =>
    category === 'activity' ? (!a.assessmentType || a.assessmentType === 'activity') : a.assessmentType === category;

  const courseActivities = (activities || []).filter(a => a.courseId === courseId && matchesCat(a));
  if (role === 'faculty' || role === 'admin') {
    const ids = [
      ...courseActivities.filter(a => a.format === 'classic').map(a => a.id),
      ...courseActivities.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
    ];
    return countFacultyGradingBadge(submissions.filter(s => s.courseId === courseId), ids);
  }

  const published = courseActivities.filter(a => a.published);
  const pubIds = [
    ...published.filter(a => a.format === 'classic').map(a => a.id),
    ...published.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
  ];
  const mine = submissions
    .filter(s => s.courseId === courseId && s.studentId === userId)
    .map(s => s.activityKey ?? '');
  return countStudentAssessmentBadge(pubIds, mine);
}

export function countTotalAssessmentBadge(params: {
  activities?: Array<{ id: string; courseId: string; format?: string; published?: boolean; assessmentType?: string }>;
  quizzes?: Array<{ id: string; courseId: string; published?: boolean }>;
  exams?: Array<{ id: string; courseId: string; published?: boolean }>;
  submissions?: Array<{ activityKey?: string; courseId?: string; studentId?: string; status?: string }>;
  userId: string;
  role: UserRole;
  courseId: string;
}): number {
  const { activities = [], quizzes = [], exams = [], submissions = [], userId, role, courseId } = params;
  let total = 0;
  for (const cat of ['activity', 'assignment', 'project', 'presentation'] as const) {
    total += countAssessmentCategoryBadge(activities, submissions, cat, userId, role, courseId);
  }

  const courseQuizzes = (quizzes || []).filter(q => q.courseId === courseId);
  if (role === 'faculty' || role === 'admin') {
    total += countFacultyGradingBadge(
      submissions.filter(s => s.courseId === courseId),
      courseQuizzes.map(q => `asg-quiz-${q.id}`)
    );
  } else {
    const pub = courseQuizzes.filter(q => q.published).map(q => q.id);
    const taken = submissions
      .filter(s => s.courseId === courseId && s.studentId === userId && (s.activityKey ?? '').startsWith('asg-quiz-'))
      .map(s => (s.activityKey ?? '').replace('asg-quiz-', ''));
    total += countStudentAssessmentBadge(pub, taken);
  }

  const courseExams = (exams || []).filter(e => e.courseId === courseId);
  if (role === 'faculty' || role === 'admin') {
    total += countFacultyGradingBadge(
      submissions.filter(s => s.courseId === courseId),
      courseExams.map(e => `asg-exam-${e.id}`)
    );
  } else {
    const pub = courseExams.filter(e => e.published).map(e => e.id);
    const taken = submissions
      .filter(s => s.courseId === courseId && s.studentId === userId && (s.activityKey ?? '').startsWith('asg-exam-'))
      .map(s => (s.activityKey ?? '').replace('asg-exam-', ''));
    total += countStudentAssessmentBadge(pub, taken);
  }

  return total;
}

