import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type {
  User,
  UserRole,
  TermId,
  Course,
  Module,
  ModuleItem,
  ModuleComment,
  Quiz,
  Exam,
  LMSDatabase,
  CalendarEvent,
  Submission,
  SubmissionComment,
  Message,
  AdvisingSlot,
  HistoryLog,
  Announcement,
  AnnouncementReply,
  Discussion,
  DiscussionReply,
  CourseFile,
  CourseFolder,
  CourseStudentGrade,
  ChatGroup,
  Notification,
  CourseSection,
  EnrollmentRequest,
  SPRConfig,
  SPRColumn,
  College,
  Department,
  Program,
  PendingRegistration,
  AdminSubrole,
  SchoolYear
} from '../types/lms';
import type { Activity } from '../types/lms';
import { activityPointsPossible } from '../utils/activities';
import {
  autoScoreFraction,
  classStandingPercent,
  resolveSPRWeights,
  round2,
  termGrade,
} from '../utils/spr';
import { commonsTemplates } from '../data/commonsTemplates';
import { DEFAULT_COLLEGES, DEFAULT_DEPARTMENTS, generateAutomaticSchoolYears, normalizeProgramName } from '../data/collegesData';
import { effectiveTerms, normalizeGradesReleased, normalizeTermId } from '../utils/gradingTerms';
import { isSyllabusGradeReady } from '../utils/syllabusGradeGate';
import { AlertModal, type AlertModalOptions } from '../components/common/AlertModal';
import { SessionExpiredModal } from '../components/common/SessionExpiredModal';
import type { AssetTransformOptions } from '../utils/avatar';
import { canPickSection } from '../utils/sections';
import type { OfficialSyllabusData } from '../data/syllabusData';
import { ApiError, getToken, setToken, clearToken, likhaLmsApi, LIKHA_URL } from '../api/client';
const SESSION_EXPIRED_EVENT = 'gabay:session-expired';
import { syllabusApi, deleteDraft, withdrawSyllabus } from '../api/syllabus';
import type { SyllabusRevisionHeader, SyllabusRevisionResponse, SyllabusSectionKey } from '../types/syllabusApi';
import { settledValue } from '../utils/promise';
import { formatFileSize, toShortFileType } from '../utils/fileUploader';
import { isValidUuid, generateSecureActivationToken } from '../utils/cryptoToken';
import { isChairRole, isDeanRole } from '../utils/roles';

export interface LMSContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  accent: AccentId;
  customAccentHex: string;
  setAccent: (id: AccentId) => void;
  setCustomAccentHex: (hex: string) => void;
  resetAccent: () => void;
  
  // Authentication & Session
  isAuthenticated: boolean;
  currentUser: User | null;
  activeUser: User;
  activeRole: UserRole;
  login: (emailOrId: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  logout: () => void;
  switchRole: (role: UserRole) => void; // Keep for testing convenience if needed
  isLoading: boolean;
  isSyncing: boolean;
  lastError: string | null;
  authReady: boolean;
  isSessionExpired: boolean;
  dismissSessionExpired: () => void;
  // Session-restore gate: false until the token -> Likha getMe restore
  // attempt settles (or is skipped when no token exists). Route guards
  // render the loading skeleton while this is false.

  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  hydrateCourse: (courseId: string) => Promise<void>;
  db: LMSDatabase;
  
  // SpeedGrader modal state
  activeSpeedGraderSubmissionId: string | null;
  openSpeedGrader: (submissionId: string) => void;
  closeSpeedGrader: () => void;

  // Drawers & Modals
  isHistoryDrawerOpen: boolean;
  setIsHistoryDrawerOpen: (open: boolean) => void;
  isHelpDrawerOpen: boolean;
  setIsHelpDrawerOpen: (open: boolean) => void;
  isRoleModalOpen: boolean;
  setIsRoleModalOpen: (open: boolean) => void;
  isUserProfileModalOpen: boolean;
  setIsUserProfileModalOpen: (open: boolean) => void;

  // Alert & Confirmation Modal
  showAlert: (options: string | AlertModalOptions, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
  closeAlert: () => void;

  // Real CRUD & Interactive Actions
  createCourse: (course: Partial<Course>) => Promise<Course>;
  deleteCourse: (courseId: string) => Promise<void>;
  createModule: (courseId: string, title: string) => Promise<Module>;
  updateModule: (moduleId: string, updates: Partial<Module>) => Promise<void>;
  deleteModule: (moduleId: string) => Promise<void>;
  addModuleItem: (moduleId: string, item: Partial<ModuleItem>) => Promise<void>;
  updateModuleItem: (currentModuleId: string, itemId: string, updates: Partial<ModuleItem>, targetModuleId?: string) => Promise<void>;
  deleteModuleItem: (moduleId: string, itemId: string) => Promise<void>;
  createQuiz: (quiz: Partial<Quiz>) => Promise<Quiz>;
  recordQuizSubmission: (quizId: string, studentId: string, answers: Record<string, string>) => Promise<Submission>;
  createExam: (exam: Partial<Exam>) => Promise<Exam>;
  recordExamSubmission: (examId: string, studentId: string, answers: Record<string, string>) => Promise<Submission>;
  createActivity: (data: Partial<Activity>) => Promise<Activity>;
  updateActivity: (activityId: string, updates: Partial<Activity>) => Promise<Activity>;
  recordActivitySubmission: (activityId: string, studentId: string, answers: Record<string, string>) => Promise<Submission>;
  deleteActivity: (activityId: string) => Promise<void>;
  enrollPerson: (person: Partial<User>, courseId?: string) => Promise<boolean>;
  enrollStudentsInCourse: (studentIds: string[], courseId: string) => Promise<boolean>;
  createUser: (userData: Partial<User>) => Promise<User>;
  updateUser: (userId: string, updates: Partial<User> & { banner?: string }) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  joinCourseByCode: (joinCode: string) => Promise<{ success: boolean; message: string; course?: Course }>;
  regenerateCourseJoinCode: (courseId: string) => Promise<string>;
  updateCourseSyllabus: (courseId: string, syllabus: OfficialSyllabusData) => Promise<void>;
  removeCourseSyllabus: (courseId: string) => Promise<void>;
  syllabusRevisions: Record<string, SyllabusRevisionHeader>;
  refreshPublishedSyllabus: (courseId: string) => Promise<void>;
  updateSyllabusSection: (courseId: string, section: SyllabusSectionKey, value: unknown) => Promise<void>;
  publishSyllabusDraft: (courseId: string) => Promise<void>;
  updateCourseGradingTerms: (courseId: string, gradingTerms: TermId[] | null) => Promise<void>;
  setGradesReleased: (courseId: string, term: TermId, released: boolean) => Promise<void>;
  effectiveTermsForCourse: (courseId: string) => TermId[];
  isCourseGradeReady: (courseId: string) => boolean;
  importCommonsTemplate: (templateId: string, targetCourseId: string) => Promise<{ success: boolean; message: string }>;

  gradeSubmission: (
    submissionId: string,
    grade: number,
    rubricScores: Record<string, number>,
    commentText?: string
  ) => Promise<void>;
  upsertManualExamGrade: (examId: string, studentId: string, grade: number) => Promise<void>;
  submitActivity: (
    activityId: string,
    submissionType: 'file' | 'online_text',
    content?: string,
    fileName?: string,
    answers?: Record<string, string>
  ) => Promise<void>;
  toggleModulePublish: (moduleId: string) => Promise<void>;
  toggleItemCompletion: (moduleId: string, itemId: string) => Promise<void>;
  addModuleComment: (moduleId: string, content: string, parentId?: string) => Promise<void>;
  editModuleComment: (moduleId: string, commentId: string, newContent: string) => Promise<void>;
  deleteModuleComment: (moduleId: string, commentId: string) => Promise<void>;
  toggleLikeModuleComment: (moduleId: string, commentId: string) => Promise<void>;
  sendMessage: (recipientId: string, subject: string, body: string, courseId?: string, attachmentName?: string, attachmentSize?: string, isGroup?: boolean, groupId?: string) => Promise<void>;
  createChatGroup: (name: string, memberIds: string[], courseId?: string) => Promise<ChatGroup>;
  markThreadAsRead: (partnerId: string) => Promise<void>;
  toggleMessageReaction: (messageId: string, reaction: string) => Promise<void>;
  bookAdvisingSlot: (slotId: string) => Promise<void>;
  createAdvisingSlot: (date: string, timeSlot: string, location: string) => Promise<void>;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;

  // Announcements CRUD
  createAnnouncement: (data: Partial<Announcement>) => Promise<Announcement>;
  deleteAnnouncement: (id: string) => Promise<void>;
  togglePinAnnouncement: (id: string) => Promise<void>;
  toggleLikeAnnouncement: (id: string) => Promise<void>;
  addAnnouncementReply: (announcementId: string, content: string, parentId?: string) => Promise<void>;
  markAnnouncementRead: (id: string) => Promise<void>;

  // Notifications
  notifications: Notification[];
  getUnreadNotificationCount: (userId: string, type?: string) => number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string, type?: string) => Promise<void>;
  markTabVisited: (tab: string, courseId?: string) => void;
  markModuleCommentsRead: (moduleId: string) => Promise<void>;
  getNotifications: (userId: string, type?: string, limit?: number) => Notification[];

  // Discussions CRUD
  createDiscussion: (data: Partial<Discussion>) => Promise<Discussion>;
  deleteDiscussion: (id: string) => Promise<void>;
  togglePinDiscussion: (id: string) => Promise<void>;
  toggleLockDiscussion: (id: string) => Promise<void>;
  addDiscussionReply: (discussionId: string, content: string, parentId?: string, attachment?: { name: string; url?: string }) => Promise<void>;
  toggleLikeDiscussionReply: (discussionId: string, replyId: string) => Promise<void>;

  // Course Files & Folders CRUD
  // uploadCourseFile accepts an optional rawFile Blob for the multipart
  // upload endpoint; area/moduleId/moduleTitle trigger server-side filing.
  createCourseFolder: (courseId: string, name: string, parentId?: string | null, autoKey?: string) => Promise<CourseFolder>;
  uploadCourseFile: (fileData: Partial<CourseFile> & { rawFile?: File | Blob; area?: string; moduleId?: string; moduleTitle?: string; silent?: boolean }) => Promise<CourseFile>;
  deleteCourseFile: (fileId: string) => Promise<void>;
  deleteCourseFolder: (folderId: string) => Promise<void>;
  updateFileVisibility: (fileId: string, visibility: 'published' | 'unpublished' | 'restricted') => Promise<void>;
  renameCourseFile: (fileId: string, newName: string) => Promise<void>;

  // Course Grades CRUD (Midterm 40%, Final 60%)
  setCourseStudentGrade: (
    courseId: string,
    studentId: string,
    type: 'midterm' | 'final',
    score: number | null
  ) => Promise<void>;

  // SPR gradebook store (Tasks 4 and 5 consume these)
  getSPRConfig: (courseId: string) => SPRConfig | null;
  saveSPRConfig: (courseId: string, config: Omit<SPRConfig, 'courseId'>) => Promise<void>;
  setSPRCell: (
    courseId: string,
    studentId: string,
    term: 'midterm' | 'final',
    key: string,
    value: number | null
  ) => Promise<void>;
  resetSPRCell: (
    courseId: string,
    studentId: string,
    term: 'midterm' | 'final',
    key: string
  ) => Promise<void>;
  bulkImportSPRColumns: (courseId: string, term: 'midterm' | 'final') => Promise<void>;

  // Sections CRUD
  createSection: (courseId: string, data: Partial<CourseSection>) => Promise<CourseSection>;
  updateSection: (sectionId: string, updates: Partial<CourseSection>) => Promise<boolean>;
  deleteSection: (sectionId: string) => Promise<boolean>;
  getCourseSections: (courseId: string) => CourseSection[];
  getStudentSection: (courseId: string) => CourseSection | null;

  // Enrollment Requests
  createEnrollmentRequest: (courseId: string, type: 'self_join' | 'faculty_enroll') => Promise<EnrollmentRequest>;
  approveEnrollmentRequests: (requestIds: string[]) => Promise<boolean>;
  rejectEnrollmentRequests: (requestIds: string[]) => Promise<boolean>;
  removeStudentFromCourse: (courseId: string, studentId: string) => Promise<boolean>;
  studentApproveInvitation: (requestId: string) => Promise<boolean>;
  studentDeclineInvitation: (requestId: string) => Promise<boolean>;
  selectSection: (courseId: string, sectionId: string) => Promise<boolean>;
  requestSectionSwitch: (courseId: string, targetSectionId: string) => Promise<boolean>;
  getPendingRequestsForCourse: (courseId: string) => Promise<EnrollmentRequest[]>;
  getApprovedRequestsForCourse: (courseId: string) => Promise<EnrollmentRequest[]>;
  getPendingRequestsForStudent: () => EnrollmentRequest[];
  requestJoinCourse: (courseId: string) => Promise<boolean>;
  getMyRequest: (courseId: string) => EnrollmentRequest | null;
  getPendingRequests: (courseId: string) => Promise<EnrollmentRequest[]>;

  // Academic Units & RBAC
  colleges: College[];
  departments: Department[];
  programs: Program[];
  pendingRegistrations: PendingRegistration[];
  registerAccount: (
    payload: {
      firstName: string;
      middleName?: string;
      lastName: string;
      fullName?: string;
      email: string;
      role: 'student' | 'faculty' | 'staff';
      collegeId: string;
      collegeName?: string;
      department: string;
      studentId: string;
      password: string;
    } & Partial<PendingRegistration>
  ) => Promise<PendingRegistration>;
  activateEmail: (token: string) => Promise<{ success: boolean; message: string }>;
  verifyRegistration: (id: string) => Promise<{ success: boolean; message: string; user?: User }>;
  rejectRegistration: (id: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  purgeExpiredRegistrations: () => Promise<number>;
  transferLeadership: (
    roleType: 'dean' | 'chairperson',
    currentLeaderId: string,
    successorId: string,
    unitId: string
  ) => Promise<{ success: boolean; message: string }>;
  addCollege: (college: College, initialDeanId?: string) => Promise<College>;
  addDepartment: (department: Department, initialChairId?: string) => Promise<Department>;
  addProgram: (program: Program, initialChairId?: string) => Promise<Program>;
  deleteCollege: (collegeId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>;
  deleteDepartment: (departmentId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>;
  deleteProgram: (programId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>;
  getCollegeDeleteBlockers: (collegeId: string) => string[];
  getDepartmentDeleteBlockers: (departmentId: string) => string[];
  getProgramDeleteBlockers: (programId: string) => string[];

  // School Year Management
  schoolYears: SchoolYear[];
  addSchoolYear: (collegeId: string, year: string) => Promise<{ success: boolean; message?: string }>;
  setActiveSchoolYear: (collegeId: string, schoolYearId: string) => Promise<{ success: boolean; message?: string }>;
  getSchoolYearsByCollege: (collegeId: string) => SchoolYear[];
  getActiveSchoolYearForCollege: (collegeId: string) => SchoolYear | undefined;
  setBaselineSchoolYear: (schoolYearIdOrYear: string) => Promise<{ success: boolean; message?: string }>;
  getBaselineSchoolYear: () => SchoolYear | undefined;

  logHistory: (path: string, title: string) => void;
  clearHistory: () => void;
}

const STORAGE_KEY_THEME = 'gabay_theme_v1';
const STORAGE_KEY_COLLEGES = 'gabay_colleges';
const STORAGE_KEY_DEPARTMENTS = 'gabay_departments';
const STORAGE_KEY_PENDING_REGISTRATIONS = 'gabay_pending_registrations';
const STORAGE_KEY_SCHOOL_YEARS = 'gabay_school_years';
const STORAGE_KEY_COLLEGE_ACTIVE_SY = 'gabay_college_active_school_years';
export const STORAGE_KEY_DB = 'gabay_lms_db_v6';

const safeSetLocalStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`LocalStorage setItem failed for "${key}".`, err);
    return false;
  }
};

export const LMSContext = createContext<LMSContextType | undefined>(undefined);

/** Selectable system accent. Presets ship hand-tuned light/dark HSL triples. */
export type AccentId = 'pink' | 'emerald' | 'navy' | 'gold' | 'custom';

export interface AccentTheme {
  id: Exclude<AccentId, 'custom'>;
  label: string;
  /** Representative dot color for the swatch UI. */
  swatch: string;
  light: { primary: string; ring: string; sidebarActive: string };
  dark: { primary: string; ring: string; sidebarActive: string };
}

export const ACCENT_PRESETS: AccentTheme[] = [
  {
    id: 'pink',
    label: 'College Pink',
    swatch: '#DB2777',
    light: { primary: '335 78% 46%', ring: '335 78% 46%', sidebarActive: '335 78% 46%' },
    dark: { primary: '335 85% 60%', ring: '335 85% 60%', sidebarActive: '335 85% 60%' }
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatch: '#0E7A5C',
    light: { primary: '162 65% 30%', ring: '162 65% 30%', sidebarActive: '162 65% 30%' },
    dark: { primary: '160 50% 55%', ring: '160 50% 55%', sidebarActive: '160 50% 55%' }
  },
  {
    id: 'navy',
    label: 'Navy',
    swatch: '#2B3F8C',
    light: { primary: '222 60% 34%', ring: '222 60% 34%', sidebarActive: '222 60% 34%' },
    dark: { primary: '220 55% 68%', ring: '220 55% 68%', sidebarActive: '220 55% 68%' }
  },
  {
    id: 'gold',
    label: 'Gold',
    swatch: '#B45309',
    light: { primary: '36 90% 34%', ring: '36 90% 34%', sidebarActive: '36 90% 34%' },
    dark: { primary: '42 95% 58%', ring: '42 95% 58%', sidebarActive: '42 95% 58%' }
  }
];

export const DEFAULT_ACCENT: AccentId = 'pink';
const DEFAULT_CUSTOM_HEX = '#0E7A5C';

const STORAGE_KEY_ACCENT = 'gabay_accent_v1';
const STORAGE_KEY_ACCENT_CUSTOM = 'gabay_accent_custom_v1';

/** '#rrggbb' -> [h, s, l] with h 0-360, s/l 0-100. Returns null for invalid input. */
export function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Derive theme-ready primary/ring/sidebar triple from a custom hex color. */
export function customAccentVars(hex: string, theme: 'dark' | 'light'): { primary: string; ring: string; sidebarActive: string } {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    const fallback = ACCENT_PRESETS[0][theme];
    return { ...fallback };
  }
  const [h, s] = hsl;
  const sat = Math.max(s, 30);
  const light = theme === 'dark' ? 60 : 35;
  const triple = `${h} ${sat}% ${light}%`;
  return { primary: triple, ring: triple, sidebarActive: triple };
}

export const generateCourseJoinCode = (existingCourses: Course[] = [], prefix?: string): string => {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const cleanPrefix = (prefix || 'GBY')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'GBY';

  for (let attempt = 0; attempt < 200; attempt++) {
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `${cleanPrefix}-${randomPart}`;
    if (!existingCourses.some(c => c.joinCode?.toUpperCase() === candidate)) {
      return candidate;
    }
  }
  return `${cleanPrefix}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
};

/** Upsert one enrollment request into a database snapshot (Task 2 cache scope). */
export const mergeEnrollmentRequest = (prev: LMSDatabase, request: EnrollmentRequest): LMSDatabase => {
  const existing = prev.enrollmentRequests || [];
  if (existing.some(r => r.id === request.id)) {
    return { ...prev, enrollmentRequests: existing.map(r => (r.id === request.id ? request : r)) };
  }
  return { ...prev, enrollmentRequests: [...existing, request] };
};

/** Task 4: Directus enrollment_requests / course_sections rows (snake_case)
 *  arrive from write calls — map them to the client shapes (same mapping as
 *  the bootstrap scope in refreshDeferred). */
const mapLikhaRequestRow = (r: any): EnrollmentRequest => ({
  id: String(r.id),
  courseId: String(r.course_id ?? r.courseId ?? ''),
  studentId: String(r.student_id ?? r.studentId ?? ''),
  studentName:
    r.student_name ||
    `${r.first_name || ''} ${r.last_name || ''}`.trim() ||
    r.student_email ||
    String(r.student_id ?? r.studentId ?? 'Student'),
  type: (r.type as EnrollmentRequest['type']) || 'self_join',
  status: r.status as EnrollmentRequest['status'],
  requestedAt: r.requested_at || r.requestedAt || new Date().toISOString(),
  resolvedAt: r.resolved_at ?? r.resolvedAt ?? undefined,
  resolvedBy: r.resolved_by ?? r.resolvedBy ?? undefined,
  sectionId: r.section_id ?? r.sectionId ?? undefined,
  targetSectionId: r.target_section_id ?? r.targetSectionId ?? undefined,
});

const mapLikhaSectionRow = (s: any): CourseSection => ({
  id: String(s.id),
  courseId: String(s.course_id ?? s.courseId ?? ''),
  name: s.name || s.title || 'Section',
  capacity: s.capacity !== undefined ? Number(s.capacity) : undefined,
  enrolledCount: Number(s.enrolled_count ?? s.enrolledCount) || 0,
  schedule: s.schedule,
  location: s.room ?? s.location,
});

/** Task 5: Directus modules / module_items / module_comments rows
 *  (snake_case) arrive from read/write calls — map them to the client
 *  shapes (same mapping as the bootstrap scope in refreshDeferred).
 *  Multi-word item keys convert camelCase->snake_case on write. */
const likhaItemKey = (key: string): string => {
  const snake: Record<string, string> = {
    completionCondition: 'completion_condition',
    activityId: 'activity_id',
    quizId: 'quiz_id',
    fileUrl: 'file_url',
    fileName: 'file_name',
    fileSize: 'file_size',
    fileType: 'file_type',
    minScore: 'min_score',
  };
  return snake[key] ?? key;
};

const toLikhaItemPatch = (body: Record<string, string | boolean | number>): Record<string, string | boolean | number> => {
  const patch: Record<string, string | boolean | number> = {};
  for (const [key, value] of Object.entries(body)) patch[likhaItemKey(key)] = value;
  return patch;
};

const mapLikhaModuleItemRow = (it: any): ModuleItem => ({
  id: String(it.id),
  title: it.title ?? 'Untitled item',
  type: (it.type as ModuleItem['type']) ?? 'page',
  published: it.published ?? true,
  required: Boolean(it.required ?? false),
  completionCondition: it.completion_condition ?? it.completionCondition ?? undefined,
  minScore: typeof it.min_score === 'number' ? it.min_score : (it.minScore ?? undefined),
  content: it.content ?? undefined,
  activityId: it.activity_id ?? it.activityId ?? undefined,
  quizId: it.quiz_id ?? it.quizId ?? undefined,
  fileUrl: it.file_url ?? it.fileUrl ?? undefined,
  fileName: it.file_name ?? it.fileName ?? undefined,
  fileSize: it.file_size ?? it.fileSize ?? undefined,
  fileType: it.file_type ?? it.fileType ?? undefined,
  completed: it.completed ?? undefined,
  authorId: it.author_id ?? it.authorId ?? undefined,
  authorName: it.author_name ?? it.authorName ?? undefined,
});

const mapLikhaModuleCommentRow = (c: any, moduleId: string): ModuleComment => ({
  id: String(c.id),
  moduleId: String(c.module_id ?? c.moduleId ?? moduleId),
  parentId: c.parent_id ?? c.parentId ?? null,
  authorId: String(c.author_id ?? c.authorId ?? ''),
  authorName: c.author_name ?? c.authorName ?? 'Someone',
  authorAvatar: c.author_avatar ?? c.authorAvatar ?? '',
  authorRole: (c.author_role ?? c.authorRole ?? 'student') as ModuleComment['authorRole'],
  content: c.content ?? '',
  createdAt: c.created_at ?? c.createdAt ?? new Date().toISOString(),
  likes: typeof c.likes === 'number' ? c.likes : 0,
  likedBy: Array.isArray(c.liked_by) ? c.liked_by : (c.likedBy ?? []),
  isEdited: c.is_edited ?? c.isEdited ?? undefined,
  editedAt: c.edited_at ?? c.editedAt ?? undefined,
});

const mapLikhaModuleRow = (m: any): Module => ({
  id: String(m.id),
  courseId: String(m.course_id ?? m.courseId ?? ''),
  title: m.title ?? 'Untitled module',
  order: typeof m.order === 'number' ? m.order : Number(m.order) || 0,
  published: m.published ?? true,
  prerequisiteModuleId: m.prerequisite_module_id ?? m.prerequisiteModuleId ?? undefined,
  authorId: m.author_id ?? m.authorId ?? undefined,
  authorName: m.author_name ?? m.authorName ?? undefined,
  items: Array.isArray(m.items) ? m.items.map(mapLikhaModuleItemRow) : [],
  comments: Array.isArray(m.comments)
    ? m.comments.map((c: any) => mapLikhaModuleCommentRow(c, String(m.id)))
    : [],
});

/** Task 8: Directus chat_messages / chat_groups / calendar_events /
 *  advising_slots / announcements / discussions rows (snake_case) arrive
 *  from read/write calls — map them to the client shapes (same mapping as
 *  the bootstrap scopes in refreshEssential/refreshDeferred). Mappers are
 *  idempotent: already-mapped (camelCase) rows map back to themselves, so
 *  `{ ...cached, ...row }` merges are safe. */
const mapLikhaMessageRow = (m: any): Message => ({
  id: String(m.id),
  senderId: String(m.sender_id ?? m.senderId ?? ''),
  senderName: m.sender_name ?? m.senderName ?? '',
  senderRole: (m.sender_role ?? m.senderRole ?? 'student') as UserRole,
  recipientId: String(m.receiver_id ?? m.recipient_id ?? m.recipientId ?? ''),
  recipientName: m.recipient_name ?? m.recipientName ?? '',
  recipientRole: (m.recipient_role ?? m.recipientRole ?? 'student') as UserRole,
  courseId: m.course_id ?? m.courseId ?? undefined,
  subject: m.subject ?? '',
  body: m.body ?? m.message ?? '',
  timestamp: m.created_at ?? m.timestamp ?? new Date().toISOString(),
  read: Boolean(m.is_read ?? m.read ?? false),
  ...(m.reaction !== undefined ? { reaction: m.reaction } : {}),
  groupId: m.group_id ?? m.groupId ?? undefined,
});

const mapLikhaChatGroupRow = (g: any, fallbackMemberId?: string): ChatGroup => ({
  id: String(g.id),
  name: g.name || 'Chat Group',
  memberIds: Array.isArray(g.member_ids)
    ? g.member_ids.map((id: any) => String(id))
    : Array.isArray(g.members)
      ? g.members.map((m: any) => (typeof m === 'string' ? m : m.userId || m.id))
      : fallbackMemberId
        ? [fallbackMemberId]
        : [],
  courseId: g.course_id ?? g.courseId ?? undefined,
  createdAt: g.created_at ?? g.createdAt ?? new Date().toISOString(),
  createdBy: String(g.created_by ?? g.createdBy ?? fallbackMemberId ?? ''),
});

const mapLikhaCalendarEventRow = (e: any): CalendarEvent => ({
  id: String(e.id),
  title: e.title ?? 'Untitled event',
  date: e.date ?? new Date().toISOString().slice(0, 10),
  time: e.time ?? e.start_time ?? e.startTime ?? '',
  courseId: e.course_id ?? e.courseId ?? undefined,
  courseCode: e.course_code ?? e.courseCode ?? undefined,
  type: (e.type as CalendarEvent['type']) ?? 'event',
  description: e.description ?? '',
  startAt: e.start_at ?? e.startAt ?? undefined,
  endAt: e.end_at ?? e.endAt ?? undefined,
  isAllDay: e.all_day ?? e.isAllDay ?? undefined,
  colorHex: e.color_hex ?? e.colorHex ?? undefined,
  location: e.location ?? undefined,
  meetingPlatform: e.meeting_platform ?? e.meetingPlatform ?? undefined,
  meetingId: e.meeting_id ?? e.meetingId ?? undefined,
  meetingPasscode: e.meeting_passcode ?? e.meetingPasscode ?? undefined,
  meetingJoinUrl: e.meeting_join_url ?? e.meetingJoinUrl ?? undefined,
});

const mapLikhaAdvisingSlotRow = (s: any): AdvisingSlot => ({
  id: String(s.id),
  instructorId: String(s.instructor_id ?? s.instructorId ?? ''),
  instructorName: s.instructor_name ?? s.instructorName ?? '',
  date: s.date ?? '',
  timeSlot: s.time_slot ?? s.timeSlot ?? '',
  location: s.location ?? '',
  status: (s.status as AdvisingSlot['status']) ?? 'available',
  bookedByStudentId: s.student_id ?? s.bookedByStudentId ?? undefined,
  bookedByStudentName: s.student_name ?? s.bookedByStudentName ?? undefined,
  notes: s.notes ?? undefined,
});

const mapLikhaAnnouncementReplyRow = (r: any, announcementId: string): AnnouncementReply => ({
  id: String(r.id),
  announcementId: String(r.announcement_id ?? r.announcementId ?? announcementId),
  parentId: r.parent_id ?? r.parentId ?? null,
  authorId: String(r.author_id ?? r.authorId ?? ''),
  authorName: r.author_name ?? r.authorName ?? 'Someone',
  authorAvatar: r.author_avatar ?? r.authorAvatar ?? '',
  authorRole: (r.author_role ?? r.authorRole ?? 'student') as UserRole,
  content: r.content ?? '',
  createdAt: r.created_at ?? r.date ?? r.createdAt ?? new Date().toISOString(),
  likes: typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likes) ? r.likes.length : 0),
  likedBy: Array.isArray(r.liked_by) ? r.liked_by : (r.likedBy ?? []),
});

const mapLikhaAnnouncementRow = (a: any, courseId?: string): Announcement => {
  const createdAt = a.created_at ?? a.date ?? a.createdAt ?? new Date().toISOString();
  return {
    id: String(a.id),
    courseId: String(a.course_id ?? a.courseId ?? courseId ?? ''),
    title: a.title ?? 'Untitled Announcement',
    content: a.content ?? '',
    authorId: String(a.author_id ?? a.authorId ?? ''),
    authorName: a.author_name ?? a.authorName ?? 'Someone',
    authorAvatar: a.author_avatar ?? a.authorAvatar ?? '',
    authorRole: (a.author_role ?? a.authorRole ?? 'faculty') as UserRole,
    createdAt,
    date: a.date ?? createdAt,
    sectionId: a.section_id ?? a.sectionId ?? 'all',
    sectionRestriction: a.sectionRestriction || 'All Sections',
    allowComments: a.allowComments ?? true,
    usersMustPostBeforeReplies: a.usersMustPostBeforeReplies ?? false,
    allowLiking: a.allowLiking ?? true,
    likes: typeof a.likes === 'number' ? a.likes : (Array.isArray(a.likes) ? a.likes.length : 0),
    likedBy: Array.isArray(a.liked_by) ? a.liked_by : (a.likedBy ?? []),
    pinned: Boolean(a.pinned ?? false),
    attachments: Array.isArray(a.attachments) ? a.attachments : [],
    replies: Array.isArray(a.replies) ? a.replies.map((r: any) => mapLikhaAnnouncementReplyRow(r, String(a.id))) : [],
    readBy: Array.isArray(a.read_by) ? a.read_by : (a.readBy ?? []),
  } as Announcement;
};

const mapLikhaDiscussionReplyRow = (r: any, discussionId: string): DiscussionReply => ({
  id: String(r.id),
  discussionId: String(r.discussion_id ?? r.discussionId ?? discussionId),
  parentId: r.parent_id ?? r.parentId ?? undefined,
  authorId: String(r.author_id ?? r.authorId ?? ''),
  authorName: r.author_name ?? r.authorName ?? 'Someone',
  authorAvatar: r.author_avatar ?? r.authorAvatar ?? '',
  authorRole: (r.author_role ?? r.authorRole ?? 'student') as UserRole,
  content: r.content ?? '',
  createdAt: r.created_at ?? r.date ?? r.createdAt ?? new Date().toISOString(),
  likes: typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likes) ? r.likes.length : 0),
  likedBy: Array.isArray(r.liked_by) ? r.liked_by : (r.likedBy ?? []),
});

const mapLikhaDiscussionRow = (d: any, courseId?: string): Discussion => {
  const createdAt = d.created_at ?? d.date ?? d.createdAt ?? new Date().toISOString();
  return {
    id: String(d.id),
    courseId: String(d.course_id ?? d.courseId ?? courseId ?? ''),
    title: d.title ?? 'Untitled Discussion Topic',
    prompt: d.content ?? d.prompt ?? '',
    authorId: String(d.author_id ?? d.authorId ?? ''),
    authorName: d.author_name ?? d.authorName ?? 'Someone',
    authorAvatar: d.author_avatar ?? d.authorAvatar ?? '',
    authorRole: (d.author_role ?? d.authorRole ?? 'faculty') as UserRole,
    createdAt,
    date: d.date ?? createdAt,
    isGraded: d.isGraded ?? false,
    pointsPossible: d.pointsPossible ?? undefined,
    dueDate: d.dueDate ?? undefined,
    pinned: Boolean(d.pinned ?? false),
    locked: Boolean(d.locked ?? false),
    usersMustPostBeforeReplies: d.usersMustPostBeforeReplies ?? false,
    groupActivity: d.groupActivity || 'All Students',
    replies: Array.isArray(d.replies) ? d.replies.map((r: any) => mapLikhaDiscussionReplyRow(r, String(d.id))) : [],
  } as Discussion;
};

/** Task 4: server rows arrive with Dates serialized as ISO strings and
 *  null-able optionals — normalize them to the client shapes. */
const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const toOptionalIso = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return toIsoString(value);
};

const normalizeActivity = (raw: any): Activity => ({
  ...raw,
  format: raw.format === 'classic' ? 'classic' : 'questionset',
  term: normalizeTermId(raw.term) ?? 'midterm',
  dueDate: toOptionalIso(raw.dueDate),
  questions: Array.isArray(raw.questions) ? raw.questions : [],
  submissionTypes: Array.isArray(raw.submissionTypes) ? raw.submissionTypes : undefined,
  rubric: Array.isArray(raw.rubric) ? raw.rubric : undefined,
  category: raw.category ?? undefined,
  weight: typeof raw.weight === 'number' ? raw.weight : undefined,
  fileName: raw.fileName ?? undefined,
  fileUrl: raw.fileUrl ?? undefined,
  fileSize: raw.fileSize ?? undefined,
  availableFrom: toOptionalIso(raw.availableFrom),
  availableUntil: toOptionalIso(raw.availableUntil),
  sectionRestriction: raw.sectionRestriction ?? undefined,
});

const normalizeQuiz = (raw: any): Quiz => ({
  ...raw,
  term: normalizeTermId(raw.term) ?? 'midterm',
  delayedUntil: toOptionalIso(raw.delayedUntil),
  dueDate: toOptionalIso(raw.dueDate),
  fileName: raw.fileName ?? undefined,
  fileUrl: raw.fileUrl ?? undefined,
  fileSize: raw.fileSize ?? undefined,
  questions: Array.isArray(raw.questions) ? raw.questions : [],
});

const normalizeExam = (raw: any): Exam => ({
  ...raw,
  timeLimitMinutes: typeof raw.timeLimitMinutes === 'number' ? raw.timeLimitMinutes : 30,
  dueDate: toOptionalIso(raw.dueDate),
  questions: Array.isArray(raw.questions) ? raw.questions : [],
  term: normalizeTermId(raw.term) ?? 'midterm',
});

/** Task 6: Directus assessment / submission rows (snake_case) arrive from
 *  read/write calls — map them to the client shapes (same mapping as the
 *  bootstrap scope in refreshDeferred). Tolerant both ways: rows already in
 *  client shape pass through unchanged. */
const parseLikhaOptions = (value: unknown): string[] | undefined => {  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

// Coerce numeric strings (Directus may echo numbers as text); non-finite falls through to undefined.
const toFiniteNumber = (value: unknown): number | undefined => {
  const n =
    typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value)
    : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const mapLikhaQuestionRow = (q: any): any => ({
  ...q,
  id: String(q.id ?? `q-${Date.now()}`),
  text: q.text ?? q.question_text ?? '',
  type: q.type ?? q.question_type ?? 'multiple_choice',
  options: parseLikhaOptions(q.options ?? q.options_json) ?? q.options,
  correctAnswer: q.correctAnswer ?? q.correct_answer ?? undefined,
  points: q.points === undefined || q.points === null ? 10 : Number(q.points) || 0,
});

const mapLikhaQuestions = (row: any): any[] => {
  const list = Array.isArray(row.questions)
    ? row.questions
    : Array.isArray(row.assessment_questions)
      ? row.assessment_questions
      : [];
  return list
    .map(mapLikhaQuestionRow)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
};

const mapLikhaQuizRow = (row: any): any => ({
  ...row,
  id: String(row.id),
  courseId: String(row.course_id ?? row.courseId ?? ''),
  title: row.title ?? 'Untitled quiz',
  timeLimitMinutes:
    toFiniteNumber(row.time_limit_minutes) ?? toFiniteNumber(row.timeLimitMinutes),
  delayedUntil: row.delayed_until ?? row.delayedUntil ?? undefined,
  dueDate: row.due_date ?? row.dueDate ?? undefined,
  fileName: row.file_name ?? row.fileName ?? undefined,
  fileUrl: row.file_url ?? row.fileUrl ?? undefined,
  fileSize: row.file_size ?? row.fileSize ?? undefined,
  questions: mapLikhaQuestions(row),
});

const mapLikhaExamRow = (row: any): any => ({
  ...row,
  id: String(row.id),
  courseId: String(row.course_id ?? row.courseId ?? ''),
  title: row.title ?? 'Untitled exam',
  timeLimitMinutes:
    toFiniteNumber(row.time_limit_minutes) ?? toFiniteNumber(row.timeLimitMinutes),
  dueDate: row.due_date ?? row.dueDate ?? undefined,
  questions: mapLikhaQuestions(row),
});

const mapLikhaActivityRow = (row: any): any => ({
  ...row,
  id: String(row.id),
  courseId: String(row.course_id ?? row.courseId ?? ''),
  title: row.title ?? 'Untitled activity',
  pointsPossible:
    typeof row.points_possible === 'number' ? row.points_possible : row.pointsPossible,
  dueDate: row.due_date ?? row.dueDate ?? undefined,
  submissionTypes: Array.isArray(row.submission_types)
    ? row.submission_types
    : row.submissionTypes,
  category: row.category ?? undefined,
  weight: typeof row.weight === 'number' ? row.weight : undefined,
  rubric: Array.isArray(row.rubric)
    ? row.rubric
    : Array.isArray(row.rubric_criteria)
      ? row.rubric_criteria.map((r: any) => ({
        ...r,
        id: String(r.id),
        title: r.title ?? r.criterion ?? '',
        description: r.description ?? '',
        points: Number(r.max_points ?? r.points) || 0,
        ratings: Array.isArray(r.ratings) ? r.ratings : [],
      }))
      : undefined,
  fileName: row.file_name ?? row.fileName ?? undefined,
  fileUrl: row.file_url ?? row.fileUrl ?? undefined,
  fileSize: row.file_size ?? row.fileSize ?? undefined,
  availableFrom: row.available_from ?? row.availableFrom ?? undefined,
  availableUntil: row.available_until ?? row.availableUntil ?? undefined,
  sectionRestriction: row.section_restriction ?? row.sectionRestriction ?? undefined,
  questions: mapLikhaQuestions(row),
});

const mapLikhaSubmissionCommentRow = (c: any, fallbackAuthor: { id: string; name: string; role: UserRole }): SubmissionComment => ({
  id: String(c.id ?? `sc-${Date.now()}`),
  authorId: String(c.author_id ?? c.authorId ?? fallbackAuthor.id),
  authorName: c.author_name ?? c.authorName ?? fallbackAuthor.name,
  authorRole: (c.author_role ?? c.authorRole ?? fallbackAuthor.role) as UserRole,
  createdAt: c.created_at ?? c.createdAt ?? new Date().toISOString(),
  text: c.content ?? c.text ?? '',
});

const mapLikhaSubmissionRow = (row: any, courseId?: string): any => {
  const quizId = row.quiz_id ?? row.quizId ?? undefined;
  const activityId = row.activity_id ?? row.activityId ?? undefined;
  const examId = row.exam_id ?? row.examId ?? undefined;
  const rubricScores =
    row.rubricScores && typeof row.rubricScores === 'object' && !Array.isArray(row.rubricScores)
      ? row.rubricScores
      : Array.isArray(row.rubric_scores)
        ? Object.fromEntries(
          row.rubric_scores
            .filter((r: any) => r && r.criterion_id !== undefined)
            .map((r: any) => [String(r.criterion_id), Number(r.points_awarded) || 0]),
        )
        : undefined;
  return {
    ...row,
    id: String(row.id),
    // SpeedGrader/gradebook/dashboard resolve submissions by these synthetic
    // keys (`asg-quiz-<id>` / `asg-activity-<id>` / `asg-exam-<id>`).
    activityKey:
      row.activityKey ??
      (quizId !== undefined
        ? `asg-quiz-${quizId}`
        : activityId !== undefined
          ? `asg-activity-${activityId}`
          : examId !== undefined
            ? `asg-exam-${examId}`
            : undefined),
    quizId,
    activityId,
    examId,
    courseId: row.course_id ?? row.courseId ?? courseId ?? '',
    studentId: String(row.student_id ?? row.studentId ?? ''),
    submittedAt: row.submitted_at ?? row.created_at ?? row.submittedAt ?? undefined,
    submissionType: row.submission_type ?? row.submissionType ?? undefined,
    content: row.content ?? undefined,
    fileName: row.file_name ?? row.fileName ?? undefined,
    fileUrl: row.file_url ?? row.fileUrl ?? undefined,
    grade: row.score ?? row.grade ?? undefined,
    gradedAt: row.graded_at ?? row.gradedAt ?? undefined,
    gradedBy: row.graded_by ?? row.gradedBy ?? undefined,
    status: row.status ?? undefined,
    ...(rubricScores !== undefined ? { rubricScores } : {}),
    comments: (
      Array.isArray(row.comments)
        ? row.comments
        : Array.isArray(row.submission_comments)
          ? row.submission_comments
          : []
    ).map((c: any) =>
      mapLikhaSubmissionCommentRow(c, { id: '', name: 'Someone', role: 'student' }),
    ),
  };
};

const normalizeSubmissionComment = (raw: any): SubmissionComment => ({
  ...raw,
  createdAt: raw.createdAt ? toIsoString(raw.createdAt) : new Date().toISOString(),
});

export const resolveDirectusAssetUrl = (fileOrId: any, options?: AssetTransformOptions): string | undefined => {
  if (!fileOrId) return undefined;
  const appendParams = (baseUrl: string) => {
    if (!options) return baseUrl;
    const params: string[] = [];
    if (options.width) params.push(`width=${options.width}`);
    if (options.height) params.push(`height=${options.height}`);
    if (options.quality) params.push(`quality=${options.quality}`);
    if (options.format) params.push(`format=${options.format}`);
    return params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;
  };

  if (typeof fileOrId === 'string') {
    if (fileOrId.startsWith('http://') || fileOrId.startsWith('https://') || fileOrId.startsWith('/')) {
      return fileOrId;
    }
    return appendParams(`${LIKHA_URL}/assets/${fileOrId}`);
  }
  if (typeof fileOrId === 'object' && fileOrId !== null) {
    if (fileOrId.id) {
      return appendParams(`${LIKHA_URL}/assets/${fileOrId.id}`);
    }
    if (fileOrId.url) {
      return fileOrId.url;
    }
  }
  return undefined;
};

/** Task 9: Directus course_folders rows (snake_case) arrive from
 *  read/write calls — map them to client CourseFolder shapes. */
const mapLikhaCourseFolderRow = (f: any, fallbackCourseId?: string): CourseFolder => ({
  id: String(f.id),
  courseId: String(f.course_id ?? f.courseId ?? fallbackCourseId ?? ''),
  parentId: f.parent_id !== undefined ? (f.parent_id ? String(f.parent_id) : null) : (f.parentId ?? null),
  name: f.name || 'Folder',
  updatedAt: f.date_updated ?? f.updated_at ?? f.updatedAt ?? f.created_at ?? new Date().toISOString(),
  autoKey: f.autoKey ?? f.auto_key ?? undefined,
});

/** Task 9: Directus course_files rows (snake_case) arrive from
 *  read/write calls — map them to client CourseFile shapes. */
const mapLikhaCourseFileRow = (f: any, fallbackCourseId?: string): CourseFile => {
  const fileObj = f.file;
  const resolvedName = (typeof fileObj === 'object' && fileObj?.filename_download) || f.name || 'Untitled File';
  const resolvedUrl = (typeof fileObj === 'object' ? resolveDirectusAssetUrl(fileObj) : undefined) || f.url || (f.file ? `${LIKHA_URL}/assets/${f.file}` : '');
  const resolvedSize = (typeof fileObj === 'object' && typeof fileObj?.filesize === 'number') ? fileObj.filesize : (f.size ?? 0);
  const resolvedType = f.type || toShortFileType(resolvedName);
  return {
    id: String(f.id),
    courseId: String(f.course_id ?? f.courseId ?? fallbackCourseId ?? ''),
    folderId: f.folder_id !== undefined ? (f.folder_id ? String(f.folder_id) : null) : (f.folderId ?? null),
    name: resolvedName,
    size: resolvedSize,
    formattedSize: f.formatted_size ?? f.formattedSize ?? formatFileSize(resolvedSize),
    type: resolvedType as CourseFile['type'],
    visibility: (f.visibility as CourseFile['visibility']) || 'published',
    updatedAt: f.date_updated ?? f.updated_at ?? f.updatedAt ?? f.created_at ?? new Date().toISOString(),
    uploadedBy: String(f.user_created ?? f.uploaded_by ?? f.uploadedBy ?? ''),
    uploadedByName: f.uploaded_by_name ?? f.uploadedByName ?? 'User',
    content: f.content ?? undefined,
    url: resolvedUrl,
    fileUrl: f.file_url ?? f.fileUrl ?? resolvedUrl,
    sourceArea: f.source_area ?? f.sourceArea ?? undefined,
    sourceId: f.source_id ? String(f.source_id) : (f.sourceId ? String(f.sourceId) : undefined),
  };
};

export const resolveDirectusUserName = (userOrId: any, fallbackName = ''): string => {
  if (!userOrId) return fallbackName;
  if (typeof userOrId === 'object' && userOrId !== null) {
    const full = [userOrId.first_name, userOrId.middle_name, userOrId.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
    if (userOrId.name) return userOrId.name;
    if (userOrId.email) return userOrId.email;
  }
  return fallbackName;
};

export const resolveDirectusUserAvatar = (userOrId: any, fallbackAvatar = ''): string => {
  if (!userOrId) return fallbackAvatar;
  if (typeof userOrId === 'object' && userOrId !== null) {
    if (userOrId.avatar) {
      const assetUrl = resolveDirectusAssetUrl(userOrId.avatar);
      if (assetUrl) return assetUrl;
    }
    if (userOrId.avatarUrl) return userOrId.avatarUrl;
  }
  return fallbackAvatar;
};

// Canonical Directus user-row → User mapping (same predicate as the user
// directory bootstrap: faculty|instructor → faculty, admin → admin,
// staff → staff, else student).
export const mapLikhaUserRowToUser = (row: any): User => {
  const roleName = String(row?.role?.name ?? row?.role ?? 'student').toLowerCase();
  const role: User['role'] =
    roleName.includes('faculty') || roleName.includes('instructor')
      ? 'faculty'
      : roleName.includes('admin')
        ? 'admin'
        : roleName.includes('staff')
          ? 'staff'
          : 'student';
  return {
    id: String(row?.id ?? ''),
    name: resolveDirectusUserName(row, row?.email ?? ''),
    email: row?.email ?? '',
    role,
    avatar: resolveDirectusUserAvatar(row, ''),
    department: row?.department || 'College of Computer Science',
    title: row?.title || (role === 'student' ? 'Undergraduate Student' : 'Faculty Instructor'),
    firstName: row?.first_name || undefined,
    middleName: row?.middle_name || undefined,
    lastName: row?.last_name || undefined,
    yearLevel: row?.year_level !== undefined ? Number(row.year_level) : (row?.yearLevel !== undefined ? Number(row.yearLevel) : undefined),
    yearsOfTeaching: row?.years_of_teaching !== undefined ? Number(row.years_of_teaching) : (row?.yearsOfTeaching !== undefined ? Number(row.yearsOfTeaching) : undefined),
  };
};

const splitDisplayName = (name: string): { first_name: string; last_name: string } => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { first_name: first || '', last_name: rest.join(' ') };
};

export const normalizeSubmission = (raw: any): Submission => {
  const studentObj = raw?.student ?? raw?.student_id;
  const studentId =
    (typeof studentObj === 'object' && studentObj !== null && studentObj.id)
      ? String(studentObj.id)
      : (typeof raw?.student_id === 'string' || typeof raw?.student_id === 'number')
        ? String(raw.student_id)
        : raw?.studentId ?? '';

  const studentName =
    resolveDirectusUserName(studentObj, raw?.studentName ?? '') ||
    raw?.studentName ||
    '';

  const studentAvatar =
    resolveDirectusUserAvatar(studentObj, raw?.studentAvatar ?? '') ||
    raw?.studentAvatar ||
    '';

  const fileObj = raw?.file;
  const fileName =
    (typeof fileObj === 'object' && fileObj !== null && fileObj.filename_download)
      ? fileObj.filename_download
      : raw?.fileName ?? raw?.file_name ?? undefined;

  const fileUrl =
    resolveDirectusAssetUrl(fileObj) ||
    raw?.fileUrl ||
    raw?.file_url ||
    undefined;

  return {
    id: raw.id,
    activityKey: raw.activityKey ?? undefined,
    quizId: raw.quizId ?? undefined,
    activityId: raw.activityId ?? undefined,
    examId: raw.examId ?? undefined,
    courseId: raw.courseId,
    studentId,
    studentName,
    studentAvatar,
    submittedAt: raw.submittedAt ? toIsoString(raw.submittedAt) : new Date().toISOString(),
    submissionType: raw.submissionType === 'file' || fileObj ? 'file' : (raw.submissionType ?? 'online_text'),
    content: raw.content ?? undefined,
    fileUrl,
    fileName,
    grade: raw.grade ?? undefined,
    gradedAt: toOptionalIso(raw.gradedAt),
    gradedBy: raw.gradedBy ?? undefined,
    status: raw.status === 'graded' ? 'graded' : raw.status === 'missing' ? 'missing' : 'submitted',
    rubricScores: (() => {
      const v = raw.rubricScores;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, number>;
      if (typeof v === 'string') {
        try {
          const parsed: unknown = JSON.parse(v);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, number>;
          }
        } catch {
          // fall through to empty
        }
      }
      return {};
    })(),
    comments: Array.isArray(raw.comments) ? raw.comments.map(normalizeSubmissionComment) : [],
  };
};

const normalizeCourseGrade = (raw: any): CourseStudentGrade => ({
  courseId: raw.courseId,
  studentId: raw.studentId,
  midtermGrade: raw.midtermGrade ?? null,
  finalGrade: raw.finalGrade ?? null,
  updatedAt: raw.updatedAt ? toIsoString(raw.updatedAt) : undefined,
});

type SPRStudentCells = {
  midterm: Record<string, number | null>;
  mtExam: number | null;
  final: Record<string, number | null>;
  ftExam: number | null;
};

/** Union-merge per-course manual-cell maps (incoming student rows win). */
const mergeSPRCourseMaps = (
  prev: Record<string, Record<string, SPRStudentCells>> | undefined,
  incoming: Record<string, Record<string, SPRStudentCells>>,
): Record<string, Record<string, SPRStudentCells>> => {
  const out: Record<string, Record<string, SPRStudentCells>> = { ...(prev ?? {}) };
  for (const [courseId, students] of Object.entries(incoming)) {
    out[courseId] = { ...(out[courseId] ?? {}), ...students };
  }
  return out;
};

/** Union-merge grade rows by course+student (incoming rows win). */
const mergeSPRGrades = (
  prev: CourseStudentGrade[] | undefined,
  incoming: CourseStudentGrade[],
): CourseStudentGrade[] => {
  if (incoming.length === 0) return prev ?? [];
  const merged = [...(prev ?? [])];
  const index = new Map(merged.map((g, i) => [`${g.courseId}:${g.studentId}`, i]));
  for (const g of incoming) {
    const key = `${g.courseId}:${g.studentId}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, merged.length);
      merged.push(g);
    } else {
      merged[at] = g;
    }
  }
  return merged;
};

/** Task 7: Likha course_grades rows arrive Directus-shaped (snake_case);
 *  client-shaped camelCase still maps. Term scalars stay null when the row
 *  carries neither casing (cells remain the source of truth). */
const mapLikhaGradeRow = (row: any, courseId: string): any => ({
  ...row,
  courseId: String(row.course_id ?? row.courseId ?? courseId),
  studentId: String(row.student_id ?? row.studentId ?? ''),
  midtermGrade: toFiniteNumber(row.midterm_grade) ?? toFiniteNumber(row.midtermGrade) ?? null,
  finalGrade: toFiniteNumber(row.final_grade) ?? toFiniteNumber(row.finalGrade) ?? null,
  updatedAt: row.updated_at ?? row.updatedAt ?? undefined,
});

/** Task 7: Likha spr_cells child rows [{ task_id, score }] (expanded via
 *  fields=*,spr_cells.*) -> the client manual-cell model. Exam keys
 *  (__mtExam/__ftExam, written by setSPRCell) fill the exam slots; column
 *  ids bucket by the course SPR config, defaulting to midterm when the id
 *  is in neither term list (recompute only reads ids the config knows). */
const parseLikhaSprCellRows = (rows: unknown, config?: SPRConfig | null): SPRStudentCells | null => {
  if (!Array.isArray(rows)) return null;
  const midterm: Record<string, number> = {};
  const final: Record<string, number> = {};
  let mtExam: number | null = null;
  let ftExam: number | null = null;
  let seen = false;
  const midIds = new Set((config?.midtermColumns ?? []).map(c => c.id));
  const finIds = new Set((config?.finalColumns ?? []).map(c => c.id));
  for (const r of rows) {
    const taskId = (r as any)?.task_id ?? (r as any)?.taskId;
    const score = toFiniteNumber((r as any)?.score);
    if (typeof taskId !== 'string' || !taskId || score === undefined) continue;
    seen = true;
    if (taskId === '__mtExam') mtExam = score;
    else if (taskId === '__ftExam') ftExam = score;
    else if (finIds.has(taskId) && !midIds.has(taskId)) final[taskId] = score;
    else midterm[taskId] = score;
  }
  if (!seen) return null;
  return { midterm, mtExam, final, ftExam };
};

/** Task 7: Likha spr_configs rows arrive Directus-shaped (snake_case);
 *  client-shaped camelCase still maps. Absent columns default to [] / 100
 *  so the gradebook renders an empty config instead of crashing. */
const mapLikhaSPRConfigRow = (row: any, courseId: string): SPRConfig | null => {
  if (!row || typeof row !== 'object') return null;
  const asColumns = (value: unknown): SPRColumn[] =>
    (Array.isArray(value) ? value : [])
      .map((c: any): SPRColumn => ({
        id: String(c?.id ?? ''),
        title: c?.title ?? '',
        perfectScore: toFiniteNumber(c?.perfect_score ?? c?.perfectScore) ?? 0,
        ...(c?.linkedSource !== undefined || c?.linked_source !== undefined
          ? { linkedSource: c.linkedSource ?? c.linked_source }
          : {}),
      }))
      .filter(c => c.id !== '');
  return {
    courseId: String(row.course_id ?? row.courseId ?? courseId),
    midtermColumns: asColumns(row.midterm_columns ?? row.midtermColumns),
    finalColumns: asColumns(row.final_columns ?? row.finalColumns),
    mtExamPerfect: toFiniteNumber(row.mt_exam_perfect ?? row.mtExamPerfect) ?? 100,
    ftExamPerfect: toFiniteNumber(row.ft_exam_perfect ?? row.ftExamPerfect) ?? 100,
  };
};

/** Task 5: the server stores Course.gradingTerms as a JSON string (nullable);
 *  the client cache holds the TermId array (null = auto-detect). */
const normalizeCourseGradingTerms = (raw: unknown): TermId[] | null => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw) return null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  return [...new Set((parsed as unknown[]).map(normalizeTermId).filter((t): t is TermId => t !== null))];
};

/** Task 5: the server stores Course.syllabus as a JSON string (nullable);
 *  the client cache holds the parsed OfficialSyllabusData object and resolves
 *  Directus relational user and media objects (cover_image, instructor). */
export const normalizeCourse = (raw: any): Course => {
  const syllabus = raw?.syllabus;
  let parsedSyllabus: Course['syllabus'];
  if (typeof syllabus !== 'string' || !syllabus) {
    parsedSyllabus = syllabus ? raw.syllabus : null;
  } else {
    try {
      parsedSyllabus = JSON.parse(syllabus);
    } catch {
      parsedSyllabus = null;
    }
  }

  if (!parsedSyllabus && (raw?.syllabi || raw?.syllabus_id)) {
    const s = Array.isArray(raw.syllabi) ? raw.syllabi[0] : (raw.syllabi || raw.syllabus_id);
    if (typeof s === 'object' && s !== null) {
      const info = Array.isArray(s.course_info) ? s.course_info[0] : (s.course_info || {});
      const inst = Array.isArray(s.institution) ? s.institution[0] : (s.institution || {});
      parsedSyllabus = {
        courseId: raw.id,
        courseInfo: {
          courseCode: info.course_code || raw.code,
          courseTitle: info.course_title || raw.title,
          credits: info.credits || raw.credits || 3,
          courseDescription: info.rationale_description || '',
        },
        institution: {
          vision: inst.vision || '',
          mission: inst.mission || '',
        },
        courseOutcomes: Array.isArray(s.course_outcomes) ? s.course_outcomes : [],
        learningPlan: Array.isArray(s.learning_plans) ? s.learning_plans : [],
        policies: Array.isArray(s.policies) ? s.policies : [],
      } as any;
    }
  }

  const instructorObj = raw?.instructor ?? raw?.instructor_id;
  const instructorId =
    (typeof instructorObj === 'object' && instructorObj !== null && instructorObj.id)
      ? String(instructorObj.id)
      : (typeof raw?.instructor_id === 'string' || typeof raw?.instructor_id === 'number')
        ? String(raw.instructor_id)
        : raw?.instructorId ?? '';

  const instructorName =
    resolveDirectusUserName(instructorObj, raw?.instructorName || raw?.instructor_name || '') ||
    raw?.instructorName ||
    '';

  const coverImageUrl =
    resolveDirectusAssetUrl(raw?.cover_image) ||
    resolveDirectusAssetUrl(raw?.coverImage) ||
    raw?.image ||
    undefined;

  return {
    ...raw,
    instructorId,
    instructorName,
    image: coverImageUrl ?? raw?.image,
    syllabus: parsedSyllabus,
    gradingTerms: normalizeCourseGradingTerms(raw?.gradingTerms),
    gradesReleased: normalizeGradesReleased(raw?.gradesReleased ?? raw?.grades_released),
  };
};

export const normalizeCourseSyllabus = normalizeCourse;

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIdx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export const LMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      return saved === 'light' ? 'light' : 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // System accent color (user-selectable brand color)
  const [accent, setAccentState] = useState<AccentId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCENT);
      if (saved === 'pink' || saved === 'emerald' || saved === 'navy' || saved === 'gold' || saved === 'custom') {
        return saved;
      }
      return DEFAULT_ACCENT;
    } catch (_) {
      return DEFAULT_ACCENT;
    }
  });

  const [customAccentHex, setCustomAccentHexState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCENT_CUSTOM);
      return hexToHsl(saved ?? '') ? (saved as string) : DEFAULT_CUSTOM_HEX;
    } catch (_) {
      return DEFAULT_CUSTOM_HEX;
    }
  });

  useEffect(() => {
    const vars =
      accent === 'custom'
        ? customAccentVars(customAccentHex, theme)
        : { ...ACCENT_PRESETS.find(p => p.id === accent)![theme] };
    const root = document.documentElement;
    root.style.setProperty('--primary', vars.primary);
    root.style.setProperty('--ring', vars.ring);
    root.style.setProperty('--sidebar-active', vars.sidebarActive);
    safeSetLocalStorage(STORAGE_KEY_ACCENT, accent);
    safeSetLocalStorage(STORAGE_KEY_ACCENT_CUSTOM, customAccentHex);
  }, [accent, customAccentHex, theme]);

  const setAccent = (id: AccentId) => setAccentState(id);

  const setCustomAccentHex = (hex: string) => {
    if (!hexToHsl(hex)) return;
    setCustomAccentHexState(hex);
    setAccentState('custom');
  };

  const resetAccent = () => setAccentState(DEFAULT_ACCENT);

  const isChancellorEmail = (email?: string | null): boolean => {
    return (email || '').trim().toLowerCase() === 'jayveegenetareyes@gmail.com';
  };

  const mapDirectusRole = (
    rawRole: any,
    email?: string | null,
    fallbackSubrole?: AdminSubrole
  ): { role: UserRole; adminSubrole?: AdminSubrole; title: string } => {
    const roleName = (typeof rawRole === 'string' ? rawRole : rawRole?.name || '').toLowerCase();
    const isChancellor =
      isChancellorEmail(email) ||
      roleName.includes('superadmin') ||
      roleName.includes('chancellor');
    const isDean = roleName.includes('dean') || fallbackSubrole === 'dean';
    const isChair = roleName.includes('chair') || fallbackSubrole === 'chairperson';

    if (isChancellor) {
      return { role: 'superadmin', adminSubrole: 'chancellor', title: 'University Chancellor' };
    }
    if (isDean) {
      return { role: 'admin', adminSubrole: 'dean', title: 'College Dean' };
    }
    if (isChair) {
      return { role: 'admin', adminSubrole: 'chairperson', title: 'Department Chairperson' };
    }
    if (roleName.includes('faculty') || roleName.includes('instructor')) {
      return { role: 'faculty', title: 'Instructor' };
    }
    if (roleName.includes('admin')) {
      return { role: 'admin', adminSubrole: fallbackSubrole, title: 'Administrator' };
    }
    if (roleName.includes('staff')) {
      return { role: 'staff', title: 'University Staff' };
    }
    return { role: 'student', title: 'Undergraduate Student' };
  };

  const normalizeChancellorUser = (u: User): User => {
    const mapped = mapDirectusRole(u.role, u.email, u.adminSubrole);
    if (mapped.role === 'superadmin' || isChancellorEmail(u.email)) {
      return {
        ...u,
        role: 'superadmin',
        adminSubrole: 'chancellor',
        title: u.title || 'University Chancellor',
        department: u.department || 'Office of the Chancellor',
      };
    }
    if (mapped.adminSubrole === 'dean') {
      const assignedCol = (colleges || []).find(
        c => (u.id && c.deanId === u.id) ||
             (u.collegeId && c.id === u.collegeId) ||
             (u.department && (c.name?.toLowerCase() === u.department?.toLowerCase() || c.name?.toLowerCase().includes('computer science')))
      );
      const colId = u.collegeId || assignedCol?.id || 'col-ccs';
      const colName = u.collegeName || assignedCol?.name || 'College of Computer Science';
      return {
        ...u,
        role: mapped.role,
        adminSubrole: mapped.adminSubrole,
        title: u.title || mapped.title,
        collegeId: colId,
        collegeName: colName,
        department: u.department || colName,
      };
    }
    if (mapped.adminSubrole === 'chairperson') {
      const assignedDept = (departments || []).find(
        d => (u.id && d.chairpersonId === u.id) ||
             (u.department && (d.name?.toLowerCase().includes(u.department?.toLowerCase()) || u.department?.toLowerCase().includes(d.name?.toLowerCase()) || d.name?.toLowerCase().includes('computer science')))
      );
      const parentCol = (colleges || []).find(c => c.id === (assignedDept?.collegeId || u.collegeId || 'col-ccs'));
      const colId = u.collegeId || assignedDept?.collegeId || parentCol?.id || 'col-ccs';
      const colName = u.collegeName || parentCol?.name || 'College of Computer Science';
      const deptName = u.department || assignedDept?.name || 'Department of Computer Science';
      return {
        ...u,
        role: mapped.role,
        adminSubrole: mapped.adminSubrole,
        title: u.title || mapped.title,
        collegeId: colId,
        collegeName: colName,
        department: deptName,
      };
    }

    const defaultCol = (colleges || []).find(c => c.name?.toLowerCase().includes('computer science')) || colleges?.[0] || {
      id: 'col-ccs',
      name: 'College of Computer Science',
      code: 'CCS',
    };
    const defaultDept = (departments || []).find(d => d.name?.toLowerCase().includes('computer science')) || departments?.[0] || {
      id: 'dept-cs',
      collegeId: defaultCol.id,
      name: 'Department of Computer Science',
      code: 'CS',
    };

    const assignedCol = (colleges || []).find(
      c => (u.collegeId && c.id === u.collegeId) ||
           (u.collegeName && c.name?.toLowerCase() === u.collegeName?.toLowerCase())
    ) || defaultCol;

    const assignedDept = (departments || []).find(
      d => (u.department && d.name?.toLowerCase() === u.department?.toLowerCase()) ||
           (u.collegeId && d.collegeId === u.collegeId)
    ) || defaultDept;

    const resolvedColId = u.collegeId || assignedDept?.collegeId || assignedCol?.id || 'col-ccs';
    const resolvedColName = u.collegeName || assignedCol?.name || 'College of Computer Science';
    const resolvedDept = (u.department && u.department !== resolvedColName && u.department.trim() !== '')
      ? u.department
      : (assignedDept?.name || 'Department of Computer Science');

    return {
      ...u,
      role: mapped.role,
      adminSubrole: mapped.adminSubrole,
      title: u.title || mapped.title,
      collegeId: resolvedColId,
      collegeName: resolvedColName,
      department: resolvedDept,
    };
  };

  const emptyDb = (): LMSDatabase => ({
    users: [],
    courses: [],
    modules: [],
    submissions: [],
    quizzes: [],
    exams: [],
    activities: [],
    calendarEvents: [],
    advisingSlots: [],
    messages: [],
    historyLogs: [],
    commonsTemplates: [],
    announcements: [],
    discussions: [],
    courseFiles: [],
    courseFolders: [],
    courseGrades: [],
    sprConfigs: {},
    sprScores: {},
    chatGroups: [],
    notifications: [],
    courseSections: [],
    enrollmentRequests: [],
  });

  // Database State (API-backed cache; starts empty or loads from localStorage if persisted)
  const [db, setDbState] = useState<LMSDatabase>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DB);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...emptyDb(), ...parsed };
        }
      }
    } catch (_) {}
    return emptyDb();
  });
  const setDb = useCallback((action: React.SetStateAction<LMSDatabase>) => {
    setDbState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next.users && next.users.some(u => isChancellorEmail(u.email))) {
        return {
          ...next,
          users: next.users.map(normalizeChancellorUser),
        };
      }
      return next;
    });
  }, []);

  // Academic Units & Registration Staging State
  const [colleges, setColleges] = useState<College[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLLEGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_COLLEGES;
  });

  const [departments, setDepartments] = useState<Department[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DEPARTMENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: any) => ({
            ...d,
            name: normalizeProgramName(d.name || ''),
          }));
        }
      }
    } catch (_) {}
    return DEFAULT_DEPARTMENTS;
  });

  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PENDING_REGISTRATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(({ password: _, ...rest }: any) => rest as PendingRegistration);
        }
      }
    } catch (_) {}
    return [];
  });

  const pendingRegistrationsRef = useRef(pendingRegistrations);
  useEffect(() => {
    pendingRegistrationsRef.current = pendingRegistrations;
    const sanitized = pendingRegistrations.map(({ password: _, ...rest }) => rest);
    safeSetLocalStorage(STORAGE_KEY_PENDING_REGISTRATIONS, JSON.stringify(sanitized));
  }, [pendingRegistrations]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(colleges));
  }, [colleges]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(departments));
  }, [departments]);

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(() => {
    const autoYears = generateAutomaticSchoolYears();
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCHOOL_YEARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          for (const auto of autoYears) {
            if (!merged.some(m => m.year.trim().toLowerCase() === auto.year.trim().toLowerCase())) {
              merged.push(auto);
            }
          }
          return merged;
        }
      }
    } catch (_) {}
    return autoYears;
  });

  const schoolYearsRef = useRef(schoolYears);
  useEffect(() => {
    schoolYearsRef.current = schoolYears;
    safeSetLocalStorage(STORAGE_KEY_SCHOOL_YEARS, JSON.stringify(schoolYears));
  }, [schoolYears]);

  // Ensure automatically generated 5-year-in-advance school years are always present
  useEffect(() => {
    const autoYears = generateAutomaticSchoolYears();
    setSchoolYears(prev => {
      let changed = false;
      const merged = [...prev];
      for (const auto of autoYears) {
        if (!merged.some(m => m.year.trim().toLowerCase() === auto.year.trim().toLowerCase())) {
          merged.push(auto);
          changed = true;
        }
      }
      if (changed) {
        safeSetLocalStorage(STORAGE_KEY_SCHOOL_YEARS, JSON.stringify(merged));
        return merged;
      }
      return prev;
    });
  }, []);

  const [collegeActiveSchoolYears, setCollegeActiveSchoolYears] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLLEGE_ACTIVE_SY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
    return { 'col-ccs': '2025-2026' };
  });

  const collegeActiveSYRef = useRef(collegeActiveSchoolYears);
  useEffect(() => {
    collegeActiveSYRef.current = collegeActiveSchoolYears;
    safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SY, JSON.stringify(collegeActiveSchoolYears));
  }, [collegeActiveSchoolYears]);

  // Synchronize academic hierarchy with Likha ERP backend (Directus)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (likhaLmsApi?.academicStructure?.getColleges && likhaLmsApi?.academicStructure?.getDepartments) {
          const [colSettled, deptSettled, sySettled] = await Promise.allSettled([
            likhaLmsApi.academicStructure.getColleges(),
            likhaLmsApi.academicStructure.getDepartments(),
            likhaLmsApi.academicStructure.getSchoolYears ? likhaLmsApi.academicStructure.getSchoolYears() : Promise.resolve([]),
          ]);

          if (!cancelled && colSettled.status === 'fulfilled' && Array.isArray(colSettled.value) && colSettled.value.length > 0) {
            const mappedCols: College[] = colSettled.value.map((c: any) => ({
              id: String(c.id),
              name: c.name,
              code: c.code,
              deanId: typeof c.dean_id === 'object' && c.dean_id ? String(c.dean_id.id) : (typeof c.dean_id === 'string' && c.dean_id ? c.dean_id : undefined),
            }));
            setColleges(prev => {
              const merged = [...mappedCols];
              for (const localCol of prev) {
                const exists = merged.some(
                  r => r.id === localCol.id || (r.code && localCol.code && r.code.toUpperCase() === localCol.code.toUpperCase())
                );
                if (!exists) {
                  merged.push(localCol);
                }
              }
              return merged;
            });
          }

          if (!cancelled && deptSettled.status === 'fulfilled' && Array.isArray(deptSettled.value) && deptSettled.value.length > 0) {
            const mappedDepts: Department[] = deptSettled.value.map((d: any) => {
              const rawName = String(d.name || '');
              const cleanName = normalizeProgramName(rawName);
              if (rawName !== cleanName && d.id) {
                likhaLmsApi.academicStructure.updateDepartment(String(d.id), { name: cleanName }).catch(() => {});
              }
              return {
                id: String(d.id),
                collegeId: typeof d.college_id === 'object' && d.college_id ? String(d.college_id.id) : String(d.college_id || ''),
                name: cleanName,
                code: d.code,
                chairpersonId: typeof d.chairperson_id === 'object' && d.chairperson_id ? String(d.chairperson_id.id) : (typeof d.chairperson_id === 'string' && d.chairperson_id ? d.chairperson_id : undefined),
              };
            });
            setDepartments(prev => {
              const merged = [...mappedDepts];
              for (const localDept of prev) {
                const cleanLocal = {
                  ...localDept,
                  name: normalizeProgramName(localDept.name || ''),
                };
                const exists = merged.some(
                  r => r.id === cleanLocal.id || (r.collegeId === cleanLocal.collegeId && r.code && cleanLocal.code && r.code.toUpperCase() === cleanLocal.code.toUpperCase())
                );
                if (!exists) {
                  merged.push(cleanLocal);
                }
              }
              return merged;
            });
          }

          if (!cancelled && sySettled.status === 'fulfilled' && Array.isArray(sySettled.value) && sySettled.value.length > 0) {
            const mappedYears: SchoolYear[] = sySettled.value.map((sy: any) => ({
              id: String(sy.id),
              year: String(sy.year),
              isActive: Boolean(sy.is_active ?? sy.isActive ?? false),
              createdAt: sy.date_created || sy.createdAt,
            }));
            setSchoolYears(prev => {
              const merged = [...mappedYears];
              for (const localSy of prev) {
                const exists = merged.some(r => r.year === localSy.year || r.id === localSy.id);
                if (!exists) {
                  merged.push(localSy);
                }
              }
              return merged;
            });
          }
        }
      } catch {
        // Tolerated; localStorage or default colleges/departments remain intact
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Authentication State (token-backed; session restores via Likha ERP)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      setIsSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const handleSessionExpiredBackToLogin = useCallback(() => {
    clearToken();
    try {
      likhaLmsApi?.invalidateCache?.();
    } catch {}
    setCurrentUser(null);
    setIsSessionExpired(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);
  // SPR lazy-hydration guard: config/cells are fetched once per course per
  // session so getSPRConfig-triggered fills never refetch in a loop.
  const sprHydratedRef = useRef<Set<string>>(new Set());
  // SPR actions run async across awaits — this mirror always holds the
  // latest committed db snapshot for recompute without stale closures.
  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);
  const [syllabusRevisions, setSyllabusRevisions] = useState<Record<string, SyllabusRevisionHeader>>({});
  const syllabusRevisionsRef = useRef(syllabusRevisions);
  useEffect(() => {
    syllabusRevisionsRef.current = syllabusRevisions;
  }, [syllabusRevisions]);
  const activeCourseIdRef = useRef<string | null>('crs-cmsc131');
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const hydratedCourseIdsRef = useRef<Set<string>>(new Set());
  const hydratingCourseIdsRef = useRef<Set<string>>(new Set());

  // ponytail: two-phase bootstrap — essential paints the shell fast,
  // deferred fills per-course details in the background without blocking authReady.
  // bootstrapRef invalidates stale background fills on logout / re-login.
  const bootstrapRef = useRef(0);
  const refreshEssential = async (user: User): Promise<{ fresh: LMSDatabase; courses: Course[]; run: number }> => {
    const run = ++bootstrapRef.current;
    setIsLoading(true);
    setLastError(null);
    sprHydratedRef.current.clear();
    hydratedCourseIdsRef.current.clear();
    hydratingCourseIdsRef.current.clear();
    try {
      // Likha-primary bootstrap: courses, notifications, messages, and
      // calendar events all come from Likha ERP (no Express fallback on
      // this path). Promise.resolve().then(...) turns missing mocks into
      // rejections tolerated by allSettled instead of sync TypeErrors.
      const [coursesSettled, notificationsSettled, messagesSettled, calendarSettled] = await Promise.allSettled([
        Promise.resolve()
          .then(() => likhaLmsApi?.getCoursesWithRelations?.() ?? [])
          .then((likhaCourses: any): any => ({
            courses: ((Array.isArray(likhaCourses) ? likhaCourses : []) as any[]).map((c: any) => ({
              id: c.id,
              code: c.code || c.id,
              title: c.title || c.name || c.id,
              description: c.description || '',
              department: c.department || '',
              term: c.term || '1st Semester 2026-2027',
              units: Number(c.units) || 3,
              enrolledCount: Number(c.enrolled_count ?? c.enrolledCount) || 0,
              published: Boolean(c.published),
              syllabus: c.syllabus || null,
              section: c.section || '',
              cover_image: c.cover_image,
              instructor: c.instructor,
              instructor_id: c.instructor_id,
            })),
          })),
        Promise.resolve()
          .then(() => likhaLmsApi?.getNotifications?.(user.id) ?? likhaLmsApi?.communications?.getNotifications?.(user.id) ?? [])
          .then((likhaNotifs: any): any => ({
            notifications: ((Array.isArray(likhaNotifs) ? likhaNotifs : []) as any[]).map((ln: any) => ({
              id: ln.id || `notif-likha-${Date.now()}`,
              recipientId: ln.recipient || ln.user_id || ln.recipientId || user.id,
              title: ln.subject || ln.title || 'Likha System Notification',
              message: ln.message || '',
              type: ln.type || 'system',
              read: ln.status === 'read' || Boolean(ln.is_read ?? ln.read),
              createdAt: ln.timestamp || ln.created_at || ln.createdAt || new Date().toISOString(),
              link: ln.link || undefined,
            })),
          })),
        Promise.resolve()
          .then(() => (likhaLmsApi as any)?.getMessages?.() ?? likhaLmsApi?.communications?.getMessages?.() ?? [])
          .then((likhaMessages: any): any => ({
            messages: ((Array.isArray(likhaMessages) ? likhaMessages : []) as any[]).map((m: any) => ({
              id: String(m.id || `msg-likha-${Date.now()}`),
              senderId: String(m.sender_id ?? m.senderId ?? ''),
              senderName: m.sender_name || m.senderName || '',
              senderRole: (m.sender_role || m.senderRole || 'student') as UserRole,
              recipientId: String(m.receiver_id ?? m.recipient_id ?? m.recipientId ?? ''),
              recipientName: m.recipient_name || m.recipientName || '',
              recipientRole: (m.recipient_role || m.recipientRole || 'student') as UserRole,
              courseId: m.course_id ?? m.courseId ?? undefined,
              subject: m.subject || '',
              body: m.body || m.message || '',
              timestamp: m.created_at || m.timestamp || new Date().toISOString(),
              read: Boolean(m.is_read ?? m.read ?? false),
              groupId: m.group_id ?? m.groupId ?? undefined,
            })),
          })),
        Promise.resolve()
          .then(() => likhaLmsApi?.communications?.getCalendarEvents?.() ?? [])
          .then((likhaEvents: any): any => ({
            events: (Array.isArray(likhaEvents) ? likhaEvents : []) as CalendarEvent[],
          })),
      ]);
      let resolvedCourses: Course[] = [];
      let notificationsRes = { notifications: [] as Notification[] };
      let messagesRes = { messages: [] as Message[] };
      let calendarRes = { events: [] as CalendarEvent[] };
      // Likha ERP is the source of truth for the essential bootstrap (no
      // Express fallback — removed once every suite mocked likhaLmsApi).
      // A rejected Likha bootstrap surfaces as a load failure below.
      if (coursesSettled.status === 'fulfilled') {
        resolvedCourses = coursesSettled.value.courses;
        notificationsRes = settledValue(notificationsSettled, { notifications: [] as Notification[] });
        messagesRes = settledValue(messagesSettled, { messages: [] as Message[] });
        calendarRes = settledValue(calendarSettled, { events: [] as CalendarEvent[] });
      } else {
        throw coursesSettled.reason;
      }

      const coursesRes = { courses: resolvedCourses };
      const fresh = emptyDb();

      // User directory: Likha ERP users; empty/error → just the active user
      try {
        const likhaUsers = await likhaLmsApi.users.getUsers();
        if (Array.isArray(likhaUsers) && likhaUsers.length > 0) {
          const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
          const userEmail = (user.email || '').trim().toLowerCase();
          const activeUserReg = pendingList.find(r => r.email?.trim().toLowerCase() === userEmail);
          let effectiveActiveUser = user;
          if (activeUserReg?.role === 'student' && user.role !== 'student') {
            effectiveActiveUser = { ...user, role: 'student', title: 'Undergraduate Student' };
          }
          const others = likhaUsers
            .filter((u: any) => u.id !== user.id)
            .map((u: any) => {
              let mapped = mapDirectusRole(u.role, u.email, u.adminSubrole);
              const uEmail = (u.email || '').trim().toLowerCase();
              const knownReg = pendingList.find(r => r.email?.trim().toLowerCase() === uEmail);
              if (knownReg?.role === 'student' && mapped.role !== 'student') {
                mapped = { role: 'student', title: 'Undergraduate Student' };
                // Background heal in Directus
                likhaLmsApi.users.resolveRoleId('student').then(rId => {
                  if (rId && u.id) {
                    likhaLmsApi.users.updateUser(u.id, { role: rId }).catch(() => {});
                  }
                }).catch(() => {});
              } else if (knownReg?.role === 'faculty' && mapped.role !== 'faculty' && mapped.role !== 'admin' && mapped.role !== 'superadmin') {
                mapped = { role: 'faculty', title: 'Instructor' };
              }
              const baseUser: User = {
                id: u.id,
                name: resolveDirectusUserName(u, u.email),
                firstName: u.first_name || undefined,
                middleName: u.middle_name || undefined,
                lastName: u.last_name || undefined,
                email: u.email,
                role: mapped.role,
                adminSubrole: mapped.adminSubrole,
                avatar: u.avatar ? `https://gabay.zyberlab.com/assets/${u.avatar}` : '',
                department:
                  u.department ||
                  (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
                title: (mapped.role === 'student' ? 'Undergraduate Student' : (u.title || mapped.title)),
                collegeId: u.college_id || u.collegeId,
                collegeName: u.college_name || u.collegeName,
                schoolYear: u.school_year || u.schoolYear,
                yearLevel: u.year_level !== undefined ? Number(u.year_level) : (u.yearLevel !== undefined ? Number(u.yearLevel) : undefined),
                yearsOfTeaching: u.years_of_teaching !== undefined ? Number(u.years_of_teaching) : (u.yearsOfTeaching !== undefined ? Number(u.yearsOfTeaching) : undefined),
              };
              return normalizeChancellorUser(baseUser);
            });
          fresh.users = [normalizeChancellorUser(effectiveActiveUser), ...others].map(u => {
            if (u.schoolYear) return u;
            const activeSY = u.collegeId ? getActiveSchoolYearForCollege(u.collegeId) : getActiveSchoolYearForCollege('col-ccs');
            return {
              ...u,
              schoolYear: activeSY?.year || '2025-2026',
            };
          });
        } else {
          const norm = normalizeChancellorUser(user);
          const activeSY = norm.collegeId ? getActiveSchoolYearForCollege(norm.collegeId) : getActiveSchoolYearForCollege('col-ccs');
          fresh.users = [{
            ...norm,
            schoolYear: norm.schoolYear || activeSY?.year || '2025-2026',
          }];
        }
      } catch {
        const norm = normalizeChancellorUser(user);
        const activeSY = norm.collegeId ? getActiveSchoolYearForCollege(norm.collegeId) : getActiveSchoolYearForCollege('col-ccs');
        fresh.users = [{
          ...norm,
          schoolYear: norm.schoolYear || activeSY?.year || '2025-2026',
        }];
      }

      fresh.courses = coursesRes.courses.map(normalizeCourseSyllabus).map(c => {
        if (c.schoolYear) return c;
        const colId = (c as any).collegeId || (c as any).college_id || 'col-ccs';
        const activeSY = getActiveSchoolYearForCollege(colId) || getActiveSchoolYearForCollege('col-ccs');
        return {
          ...c,
          schoolYear: activeSY?.year || '2025-2026',
        };
      });
      fresh.notifications = notificationsRes.notifications;

      try {
        const likhaNotifs = await likhaLmsApi.getNotifications(user.id);
        if (Array.isArray(likhaNotifs) && likhaNotifs.length > 0) {
          const mapped: Notification[] = likhaNotifs.map((ln: any) => ({
            id: ln.id || `notif-likha-${Date.now()}`,
            recipientId: ln.recipient || ln.user_id || user.id,
            actorId: ln.sender || ln.actor_id || 'system',
            actorName: ln.actor_name || 'System',
            actorAvatar: ln.actor_avatar || '',
            relatedId: ln.related_id || ln.link || ln.item || '',
            relatedTitle: ln.subject || ln.title || 'Notification',
            content: ln.message || ln.content || '',
            type: (['module_comment_reply', 'announcement_reply', 'quiz_draft_saved', 'activity_submitted', 'calendar_event', 'file_uploaded', 'grade_posted'].includes(ln.type) ? ln.type : 'calendar_event') as Notification['type'],
            read: ln.status === 'read' || Boolean(ln.is_read ?? ln.read),
            createdAt: ln.timestamp || ln.created_at || new Date().toISOString(),
          }));
          const seen = new Set(fresh.notifications.map(n => n.id));
          for (const item of mapped) {
            if (!seen.has(item.id)) {
              fresh.notifications.unshift(item);
              seen.add(item.id);
            }
          }
        }
      } catch (_likhaNotifErr) {
        // Tolerated if Likha notifications offline
      }

      fresh.messages = messagesRes.messages;
      fresh.calendarEvents = calendarRes.events;

      // Calendar events: also augment from Likha ERP
      try {
        const likhaEvents = await likhaLmsApi.communications.getCalendarEvents();
        if (Array.isArray(likhaEvents) && likhaEvents.length > 0) {
          const seen = new Set(fresh.calendarEvents.map(e => e.id));
          for (const ev of likhaEvents) {
            if (!seen.has(ev.id)) {
              fresh.calendarEvents.push(ev);
              seen.add(ev.id);
            }
          }
        }
      } catch {
        // Tolerated
      }

      // Chat groups + advising slots come from Likha ERP (no Express fallback)
      try {
        const [groupsSettled, slotsSettled] = await Promise.allSettled([
          likhaLmsApi.communications.getChatGroups(),
          likhaLmsApi.communications.getAdvisingSlots(),
        ]);
        if (groupsSettled.status === 'fulfilled' && Array.isArray(groupsSettled.value) && groupsSettled.value.length > 0) {
          fresh.chatGroups = groupsSettled.value.map((g: any) => ({
            id: g.id,
            name: g.name || 'Chat Group',
            courseId: g.course_id || undefined,
            memberIds: Array.isArray(g.member_ids)
              ? g.member_ids
              : Array.isArray(g.members)
                ? g.members.map((m: any) => m.userId || m.id)
                : [],
            createdAt: g.created_at || new Date().toISOString(),
            createdBy: g.created_by || user.id,
          }));
        }
        if (slotsSettled.status === 'fulfilled' && Array.isArray(slotsSettled.value) && slotsSettled.value.length > 0) {
          fresh.advisingSlots = slotsSettled.value;
        }
      } catch {
        // Tolerated
      }

      // Refresh academic hierarchy from Likha ERP
      try {
        if (likhaLmsApi?.academicStructure?.getColleges && likhaLmsApi?.academicStructure?.getDepartments) {
          const [colSettled, deptSettled] = await Promise.allSettled([
            likhaLmsApi.academicStructure.getColleges(),
            likhaLmsApi.academicStructure.getDepartments(),
          ]);
          if (colSettled.status === 'fulfilled' && Array.isArray(colSettled.value) && colSettled.value.length > 0) {
            const mappedCols: College[] = colSettled.value.map((c: any) => ({
              id: String(c.id),
              name: c.name,
              code: c.code,
              deanId: typeof c.dean_id === 'object' && c.dean_id ? String(c.dean_id.id) : (typeof c.dean_id === 'string' && c.dean_id ? c.dean_id : undefined),
            }));
            setColleges(prev => {
              const merged = [...mappedCols];
              for (const localCol of prev) {
                const exists = merged.some(
                  r => r.id === localCol.id || (r.code && localCol.code && r.code.toUpperCase() === localCol.code.toUpperCase())
                );
                if (!exists) {
                  merged.push(localCol);
                }
              }
              return merged;
            });
          }
          if (deptSettled.status === 'fulfilled' && Array.isArray(deptSettled.value) && deptSettled.value.length > 0) {
            const mappedDepts: Department[] = deptSettled.value.map((d: any) => {
              const rawName = String(d.name || '');
              const cleanName = normalizeProgramName(rawName);
              if (rawName !== cleanName && d.id) {
                likhaLmsApi.academicStructure.updateDepartment(String(d.id), { name: cleanName }).catch(() => {});
              }
              return {
                id: String(d.id),
                collegeId: typeof d.college_id === 'object' && d.college_id ? String(d.college_id.id) : String(d.college_id || ''),
                name: cleanName,
                code: d.code,
                chairpersonId: typeof d.chairperson_id === 'object' && d.chairperson_id ? String(d.chairperson_id.id) : (typeof d.chairperson_id === 'string' && d.chairperson_id ? d.chairperson_id : undefined),
              };
            });
            setDepartments(prev => {
              const merged = [...mappedDepts];
              for (const localDept of prev) {
                const cleanLocal = {
                  ...localDept,
                  name: normalizeProgramName(localDept.name || ''),
                };
                const exists = merged.some(
                  r => r.id === cleanLocal.id || (r.collegeId === cleanLocal.collegeId && r.code && localDept.code && r.code.toUpperCase() === cleanLocal.code.toUpperCase())
                );
                if (!exists) {
                  merged.push(cleanLocal);
                }
              }
              return merged;
            });
          }
        }
      } catch {
        // Tolerated
      }

      setDb(fresh);
      setIsLoading(false);
      return { fresh, courses: coursesRes.courses, run };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load data.';
      setLastError(message);
      setIsLoading(false);
      showAlert(message, 'Load Failed');
      throw err;
    }
  };

  const refreshDeferred = async (fresh: LMSDatabase, courses: Course[], run: number): Promise<void> => {
    const prioritizedCourses = [...courses].sort((a, b) => {
      if (a.id === activeCourseIdRef.current) return -1;
      if (b.id === activeCourseIdRef.current) return 1;
      return 0;
    });
    const coursesRes = { courses: prioritizedCourses };
    try {
      // Course/request cache scope comes from Likha ERP (no Express
      // fallback): sections plus pending/approved requests per course.
      // Per-course failures are tolerated (e.g. students get 403 on the
      // faculty-only requests endpoint); the sync getters read whatever
      // the cache holds.
      const mapLikhaSection = (s: any): CourseSection => ({
        id: String(s.id),
        courseId: String(s.course_id ?? s.courseId ?? ''),
        name: s.name || s.title || 'Section',
        capacity: s.capacity !== undefined ? Number(s.capacity) : undefined,
        enrolledCount: Number(s.enrolled_count ?? s.enrolledCount) || 0,
        schedule: s.schedule,
        location: s.room ?? s.location,
      });
      const mapLikhaRequest = (r: any): EnrollmentRequest => ({
        id: String(r.id),
        courseId: String(r.course_id ?? r.courseId ?? ''),
        studentId: String(r.student_id ?? r.studentId ?? ''),
        studentName:
          r.student_name ||
          `${r.first_name || ''} ${r.last_name || ''}`.trim() ||
          r.student_email ||
          String(r.student_id ?? r.studentId ?? 'Student'),
        type: (r.type as EnrollmentRequest['type']) || 'self_join',
        status: r.status as EnrollmentRequest['status'],
        requestedAt: r.requested_at || r.requestedAt || new Date().toISOString(),
        resolvedAt: r.resolved_at ?? r.resolvedAt ?? undefined,
        resolvedBy: r.resolved_by ?? r.resolvedBy ?? undefined,
        sectionId: r.section_id ?? r.sectionId ?? undefined,
        targetSectionId: r.target_section_id ?? r.targetSectionId ?? undefined,
      });
      const scopeResults = await Promise.all(
        coursesRes.courses.map(course =>
          (async () => {
            const [sectionsSettled, requestsSettled, approvedSettled] = await Promise.allSettled([
              Promise.resolve().then(() => likhaLmsApi?.sections?.getSections?.(course.id) ?? []),
              Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.(course.id, 'pending') ?? []),
              Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.(course.id, 'approved') ?? []),
            ]);
            return { sectionsSettled, requestsSettled, approvedSettled };
          })()
        )
      );
      const sectionMap = new Map<string, CourseSection>();
      const requestMap = new Map<string, EnrollmentRequest>();
      for (const r of scopeResults) {
        if (r.sectionsSettled.status === 'fulfilled') {
          for (const s of (r.sectionsSettled.value as any[])) {
            const mapped = mapLikhaSection(s);
            sectionMap.set(mapped.id, mapped);
          }
        }
        if (r.requestsSettled.status === 'fulfilled') {
          for (const req of (r.requestsSettled.value as any[])) {
            const mapped = mapLikhaRequest(req);
            requestMap.set(mapped.id, mapped);
          }
        }
        // Approved rows seed the enrollment cache so rosters (People,
        // gradebooks) and enrolled-course lists survive refresh. Students
        // get 403 here — tolerated — and are covered by requests below.
        if (r.approvedSettled.status === 'fulfilled') {
          for (const req of (r.approvedSettled.value as any[])) {
            const mapped = mapLikhaRequest(req);
            requestMap.set(mapped.id, mapped);
          }
        }
      }
      // Seed the request cache with the viewer's own requests so
      // getPendingRequestsForStudent (sync) survives reload.
      const mineSettled = await Promise.allSettled([
        Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.() ?? []),
      ]);
      if (mineSettled[0].status === 'fulfilled') {
        for (const req of (mineSettled[0].value as any[])) {
          const mapped = mapLikhaRequest(req);
          requestMap.set(mapped.id, mapped);
        }
      }
      try {
        if (likhaLmsApi?.courses?.getCourseEnrollments) {
          await Promise.allSettled(
            coursesRes.courses.map(async course => {
              const enrollments = await likhaLmsApi.courses.getCourseEnrollments(course.id);
              if (Array.isArray(enrollments)) {
                for (const enr of enrollments) {
                  const studentUser = typeof enr.user === 'object' ? enr.user : null;
                  const studentId = studentUser?.id || (typeof enr.user === 'string' ? enr.user : String(enr.user || ''));
                  const reqId = `enr-${enr.id || `${course.id}-${studentId}`}`;
                  if (!requestMap.has(reqId)) {
                    const studentName = studentUser
                      ? `${studentUser.first_name || ''} ${studentUser.last_name || ''}`.trim() || studentUser.email
                      : `Student ${studentId}`;
                    requestMap.set(reqId, {
                      id: reqId,
                      courseId: course.id,
                      studentId: String(studentId),
                      studentName: studentName || 'Enrolled Student',
                      type: 'self_join',
                      status: 'approved',
                      requestedAt: enr.enrolled_at || new Date().toISOString(),
                      resolvedAt: enr.enrolled_at || new Date().toISOString(),
                    });
                  }
                }
              }
            })
          );
        }
      } catch {
        // Tolerated if Likha enrollments endpoint offline
      }
      fresh.courseSections = [...sectionMap.values()];
      fresh.enrollmentRequests = [...requestMap.values()];

      // Scoped Course Hydration: Prioritize the viewer's active course,
      // courses taught, courses with user enrollments or requests, plus the first 2 courses
      // to maintain instant responsiveness and preserve existing test contracts without
      // fetching all courses in the catalog.
      const user = currentUserRef.current;
      const relevantCourseIds = new Set<string>();
      if (activeCourseIdRef.current) relevantCourseIds.add(activeCourseIdRef.current);
      if (user) {
        for (const c of coursesRes.courses) {
          if (c.instructorId === user.id || (c as any).instructor_id === user.id) {
            relevantCourseIds.add(c.id);
          }
        }
        for (const req of requestMap.values()) {
          if (req.studentId === user.id && req.courseId) {
            relevantCourseIds.add(req.courseId);
          }
        }
      }
      for (const c of coursesRes.courses.slice(0, 2)) {
        relevantCourseIds.add(c.id);
      }

      const coursesToHydrate = coursesRes.courses.filter(c => relevantCourseIds.has(c.id));
      for (const c of coursesToHydrate) {
        hydratedCourseIdsRef.current.add(c.id);
      }

      // Course-content bootstrap: modules (with items + comments incl.
      // likedBy arrays), announcements (with replies/attachments/likedBy/
      // readBy), discussions (with replies) for each of the user's courses
      // (enrolled + taught — the same course set resolved above). Per-course
      // failures are tolerated (403-tolerant); sync getters read the cache.
      const contentResults = await mapConcurrent(
        coursesToHydrate,
        3,
        course =>
          (async () => {
            const [modulesSettled, announcementsSettled, discussionsSettled] = await Promise.allSettled([
              // Task 5: modules (+ embedded items; row-embedded comments when
              // present) come from Likha ERP (no Express fallback on this
              // path). likha-gap: module_comments is item-scoped in Likha, so
              // there is no batched module-level comment read to fan out here
              // (browser_subagent follow-up).
              Promise.resolve()
                .then(() => likhaLmsApi?.modules?.getModulesWithItems?.(course.id) ?? [])
                .then((rows: any): { modules: Module[] } => ({
                  modules: ((Array.isArray(rows) ? rows : []) as any[]).map(mapLikhaModuleRow),
                })),
              Promise.resolve()
                .then(() => likhaLmsApi?.communications?.getAnnouncements?.(course.id) ?? [])
                .then((rows: any): { announcements: Announcement[] } => ({
                  announcements: ((Array.isArray(rows) ? rows : []) as any[]).map(r =>
                    mapLikhaAnnouncementRow(r, course.id)
                  ),
                })),
              Promise.resolve()
                .then(() => likhaLmsApi?.communications?.getDiscussions?.(course.id) ?? [])
                .then((rows: any): { discussions: Discussion[] } => ({
                  discussions: ((Array.isArray(rows) ? rows : []) as any[]).map(r =>
                    mapLikhaDiscussionRow(r, course.id)
                  ),
                })),
            ]);
            return { modulesSettled, announcementsSettled, discussionsSettled };
          })()
      );
      const allModules: Module[] = [];
      const allAnnouncements: Announcement[] = [];
      const allDiscussions: Discussion[] = [];
      for (const r of contentResults) {
        if (r.modulesSettled.status === 'fulfilled') allModules.push(...r.modulesSettled.value.modules);
        if (r.announcementsSettled.status === 'fulfilled') {
          allAnnouncements.push(...r.announcementsSettled.value.announcements);
        }
        if (r.discussionsSettled.status === 'fulfilled') {
          allDiscussions.push(...r.discussionsSettled.value.discussions);
        }
      }
      fresh.modules = allModules;
      fresh.announcements = allAnnouncements;
      fresh.discussions = allDiscussions;
      // Task 6 assessment bootstrap: quizzes, exams, and activities come
      // from Likha ERP (no Express fallback on this path). Task 7: grades
      // + SPR config ride the same Likha path. Per-course failures are
      // tolerated (403-tolerant); sync getters read the cache.
      const assessmentResults = await mapConcurrent(
        coursesToHydrate,
        3,
        course =>
          (async () => {
            const [quizzesSettled, examsSettled, activitiesSettled, gradesSettled] =
              await Promise.allSettled([
                // Task 6: quizzes (+questions) come from Likha ERP (no
                // Express fallback on this path). Promise.resolve().then(...)
                // turns missing mocks into rejections tolerated by allSettled
                // instead of sync TypeErrors.
                Promise.resolve()
                  .then(() => likhaLmsApi?.assessments?.getQuizzes?.(course.id) ?? [])
                  .then((rows: any): { quizzes: Quiz[] } => ({
                    quizzes: ((Array.isArray(rows) ? rows : []) as any[]).map((r: any) =>
                      normalizeQuiz(mapLikhaQuizRow(r))
                    ),
                  })),
                Promise.resolve()
                  .then(() => likhaLmsApi?.assessments?.getExams?.(course.id) ?? [])
                  .then((rows: any): { exams: Exam[] } => ({
                    exams: ((Array.isArray(rows) ? rows : []) as any[]).map((r: any) =>
                      normalizeExam(mapLikhaExamRow(r))
                    ),
                  })),
                Promise.resolve()
                  .then(() => likhaLmsApi?.assessments?.getActivities?.(course.id) ?? [])
                  .then((rows: any): { activities: Activity[] } => ({
                    activities: ((Array.isArray(rows) ? rows : []) as any[]).map((r: any) =>
                      normalizeActivity(mapLikhaActivityRow(r))
                    ),
                  })),
                // Task 7: course grades come from Likha ERP (no Express
                // fallback on this path). Promise.resolve().then(...) turns
                // missing mocks into rejections tolerated by allSettled
                // instead of sync TypeErrors.
                Promise.resolve()
                  .then(() => likhaLmsApi?.grades?.getCourseGrades?.(course.id) ?? [])
                  .then((rows: any): { grades: CourseStudentGrade[]; gradeCellRows: Array<{ studentId: string; cellRows: unknown }> } => {
                    const list = (Array.isArray(rows) ? rows : []) as any[];
                    return {
                      grades: list.map((r: any) => normalizeCourseGrade(mapLikhaGradeRow(r, course.id))),
                      // Raw spr_cells ride along for the config-aware split
                      // below (SPR configs load in the next pass).
                      gradeCellRows: list.map((r: any) => ({
                        studentId: String(r.student_id ?? r.studentId ?? ''),
                        cellRows: r.spr_cells ?? r.sprCells ?? [],
                      })),
                    };
                  }),
              ]);
            return {
              courseId: course.id,
              quizzesSettled,
              examsSettled,
              activitiesSettled,
              gradesSettled,
              gradeCellRows:
                gradesSettled.status === 'fulfilled' ? gradesSettled.value.gradeCellRows : [],
            };
          })()
      );
      const allQuizzes: Quiz[] = [];
      const allExams: Exam[] = [];
      const allActivities: Activity[] = [];
      const allGrades: CourseStudentGrade[] = [];
      const allSPRScores: Record<string, Record<string, SPRStudentCells>> = {};
      for (const r of assessmentResults) {
        if (r.quizzesSettled.status === 'fulfilled') {
          for (const q of r.quizzesSettled.value.quizzes) allQuizzes.push(q);
        }
        if (r.examsSettled.status === 'fulfilled') {
          for (const e of r.examsSettled.value.exams) allExams.push(e);
        }
        if (r.activitiesSettled.status === 'fulfilled') {
          for (const a of r.activitiesSettled.value.activities) allActivities.push(a);
        }
        if (r.gradesSettled.status === 'fulfilled') {
          for (const g of r.gradesSettled.value.grades) {
            allGrades.push(g);
          }
        }
      }
      // SPR config hydration: one Likha getSPRConfig per visible course
      // after grades load. Per-course failures are tolerated; sync getters
      // read whatever the cache holds and ensureSPRCourse retries lazily.
      // spr_cells split per course here so column ids bucket against the
      // freshly loaded config (cells survive reload with no extra round-trip).
      const sprConfigResults = await mapConcurrent(
        coursesToHydrate,
        4,
        course =>
          (async () => {
            try {
              const row = await likhaLmsApi?.grades?.getSPRConfig?.(course.id);
              return { courseId: course.id, config: mapLikhaSPRConfigRow(row ?? null, course.id) };
            } catch {
              return { courseId: course.id, config: null };
            }
          })()
      );
      const allSPRConfigs: Record<string, SPRConfig> = {};
      for (const r of sprConfigResults) {
        sprHydratedRef.current.add(r.courseId);
        if (r.config) allSPRConfigs[r.courseId] = r.config;
      }
      for (const r of assessmentResults) {
        const config = allSPRConfigs[r.courseId] ?? null;
        for (const { studentId, cellRows } of r.gradeCellRows) {
          if (!studentId) continue;
          const cells = parseLikhaSprCellRows(cellRows, config);
          if (cells) {
            if (!allSPRScores[r.courseId]) allSPRScores[r.courseId] = {};
            allSPRScores[r.courseId][studentId] = cells;
          }
        }
      }
      // Submissions ride per quiz / exam / activity from Likha ERP (no
      // Express fallback on this path). Per-list failures are tolerated
      // (403-tolerant); sync getters read the cache.
      const courseByAssessment = new Map<string, string>();
      for (const q of allQuizzes) courseByAssessment.set(q.id, q.courseId);
      for (const e of allExams) courseByAssessment.set(e.id, e.courseId);
      for (const a of allActivities) courseByAssessment.set(a.id, a.courseId);
      const mapLikhaSubmissionList = (assessmentId: string) => (rows: any): { submissions: any[] } => ({
        submissions: ((Array.isArray(rows) ? rows : []) as any[]).map((s: any) =>
          normalizeSubmission(mapLikhaSubmissionRow(s, courseByAssessment.get(assessmentId)))
        ),
      });
      const allSubmissions: Submission[] = [];
      const seenSubmissionIds = new Set<string>();
      const assessmentItems: Array<{ id: string; type: 'quiz' | 'activity' | 'exam' }> = [
        ...allQuizzes.map(q => ({ id: q.id, type: 'quiz' as const })),
        ...allActivities.map(a => ({ id: a.id, type: 'activity' as const })),
        ...allExams.map(e => ({ id: e.id, type: 'exam' as const })),
      ];
      const submissionResults = await mapConcurrent(
        assessmentItems,
        6,
        async item => {
          try {
            const rows = (await likhaLmsApi?.submissions?.getSubmissions?.(item.id, item.type)) ?? [];
            return mapLikhaSubmissionList(item.id)(rows);
          } catch {
            return { submissions: [] };
          }
        }
      );
      for (const r of submissionResults) {
        for (const merged of r.submissions) {
          if (seenSubmissionIds.has(merged.id)) continue;
          seenSubmissionIds.add(merged.id);
          allSubmissions.push(merged);
        }
      }
      fresh.submissions = allSubmissions;
      fresh.quizzes = allQuizzes;
      fresh.exams = allExams;
      fresh.activities = allActivities;
      fresh.courseGrades = allGrades;
      fresh.sprConfigs = allSPRConfigs;
      fresh.sprScores = allSPRScores;
      // Task 9 files bootstrap: folders + direct CourseFile rows for each of
      // the user's courses (virtual aggregation in useCourseFiles reads these
      // rows plus module/announcement/activity sources). Per-course
      // failures are tolerated (403-tolerant); sync getters read the cache.
      const fileResults = await mapConcurrent(
        coursesToHydrate,
        3,
        course =>
          (async () => {
            const [foldersSettled, filesSettled] = await Promise.allSettled([
              likhaLmsApi.files?.getCourseFolders ? likhaLmsApi.files.getCourseFolders(course.id) : Promise.resolve([]),
              likhaLmsApi.files?.getCourseFiles ? likhaLmsApi.files.getCourseFiles(course.id) : Promise.resolve([]),
            ]);
            return { courseId: course.id, foldersSettled, filesSettled };
          })()
      );
      const allFolders: CourseFolder[] = [];
      const allFiles: CourseFile[] = [];
      for (const r of fileResults) {
        if (r.foldersSettled.status === 'fulfilled' && Array.isArray(r.foldersSettled.value)) {
          allFolders.push(...r.foldersSettled.value.map((f: any) => mapLikhaCourseFolderRow(f, r.courseId)));
        }
        if (r.filesSettled.status === 'fulfilled' && Array.isArray(r.filesSettled.value)) {
          allFiles.push(...r.filesSettled.value.map((f: any) => mapLikhaCourseFileRow(f, r.courseId)));
        }
      }
      fresh.courseFolders = allFolders;
      fresh.courseFiles = allFiles;
      if (bootstrapRef.current !== run) return; // ponytail: logout/re-login mid-fill — don't resurrect stale db
      const done = fresh;
      setDb(prev => ({
        ...done,
        historyLogs: prev.historyLogs,
        courses: [...done.courses, ...prev.courses.filter(c => !done.courses.some(d => d.id === c.id))],
      }));
    } catch (err) {
      console.warn('[refreshDeferred] background fill failed:', err);
    }
  };

  // Session restore: token -> check Likha ERP -> user + bootstrap
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let user: User | null = null;

        // 1. Try Likha ERP true backend first
        if (likhaLmsApi?.auth?.getMe) {
          try {
            const me = await likhaLmsApi.auth.getMe();
            if (me?.id) {
              let mapped = mapDirectusRole(me.role, me.email, me.adminSubrole);
              const meEmail = (me.email || '').trim().toLowerCase();
              const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
              const knownReg = pendingList.find(r => r.email?.trim().toLowerCase() === meEmail);
              if (knownReg?.role === 'student' && mapped.role !== 'student') {
                mapped = { role: 'student', title: 'Undergraduate Student' };
                likhaLmsApi.users.resolveRoleId('student').then(rId => {
                  if (rId && me.id) {
                    likhaLmsApi.users.updateUser(me.id, { role: rId }).catch(() => {});
                  }
                }).catch(() => {});
              } else if (knownReg?.role === 'faculty' && mapped.role !== 'faculty' && mapped.role !== 'admin' && mapped.role !== 'superadmin') {
                mapped = { role: 'faculty', title: 'Instructor' };
              }
              const rawMeUser: User = {
                id: me.id,
                name: resolveDirectusUserName(me, me.email),
                firstName: me.first_name || undefined,
                middleName: me.middle_name || undefined,
                lastName: me.last_name || undefined,
                email: me.email,
                role: mapped.role,
                adminSubrole: mapped.adminSubrole,
                avatar: me.avatar ? `https://gabay.zyberlab.com/assets/${me.avatar}` : '',
                department:
                  me.department ||
                  (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
                title: (mapped.role === 'student' ? 'Undergraduate Student' : (me.title || mapped.title)),
                collegeId: me.college_id || me.collegeId,
                collegeName: me.college_name || me.collegeName,
                yearLevel: me.year_level !== undefined ? Number(me.year_level) : (me.yearLevel !== undefined ? Number(me.yearLevel) : undefined),
                yearsOfTeaching: me.years_of_teaching !== undefined ? Number(me.years_of_teaching) : (me.yearsOfTeaching !== undefined ? Number(me.yearsOfTeaching) : undefined),
              };
              user = normalizeChancellorUser(rawMeUser);
            }
          } catch (likhaErr: any) {
            // If Likha explicitly returns 401 Unauthorized, the stored token is expired/invalid.
            if (likhaErr?.status === 401 || String(likhaErr?.message).includes('401')) {
              clearToken();
              setIsSessionExpired(true);
              return;
            }
          }
        }

        // Likha-only restore: if Likha
        // yields no user, the stored token is unusable.
        if (!user) {
          clearToken();
          return;
        }

        if (cancelled) return;
        setCurrentUser(user);
        const { fresh, courses, run } = await refreshEssential(user);
        if (cancelled) return;
        setAuthReady(true);
        await refreshDeferred(fresh, courses, run);
      } catch (err: any) {
        if (cancelled) return;
        const isAuthError =
          (err instanceof ApiError && err.status === 401) ||
          err?.status === 401 ||
          String(err?.message).includes('401');

        if (isAuthError) {
          clearToken();
          setIsSessionExpired(true);
        } else {
          const message = err instanceof ApiError ? err.message : 'Failed to restore session.';
          setLastError(message);
          showAlert(message, 'Load Failed');
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated = currentUser !== null;
  const activeUser = currentUser || db.users[0];
  const activeRole: UserRole = currentUser?.role || 'student';

  const login = async (emailOrId: string, password: string): Promise<{ success: boolean; message?: string; user?: User }> => {
    const cleanEmail = emailOrId.trim().toLowerCase();
    const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
    const pending = pendingList.find(
      r => r.email.trim().toLowerCase() === cleanEmail || r.studentId?.trim().toLowerCase() === cleanEmail
    );

    if (pending && pending.status !== 'verified') {
      const isExpired = pending.status === 'expired' || Date.now() >= new Date(pending.expiresAt).getTime();
      if (isExpired) {
        if (pending.status !== 'expired') {
          setPendingRegistrations(prev =>
            prev.map(r => (r.id === pending.id ? { ...r, status: 'expired' } : r))
          );
        }
        return {
          success: false,
          message: 'Your registration has expired. Please register again.',
        };
      }

      if (pending.status === 'rejected') {
        return {
          success: false,
          message: 'Your registration was rejected by an administrator.',
        };
      }

      if (pending.status === 'pending') {
        if (!pending.emailVerified) {
          return {
            success: false,
            message: 'Please verify your email address first via the activation link sent to your inbox.',
          };
        }
        const msRemaining = new Date(pending.expiresAt).getTime() - Date.now();
        const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
        return {
          success: false,
          message: `Account pending administrator verification. (Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'})`,
        };
      }
    }

    // Likha-only auth: no Express /api/auth/login fallback.
    if (emailOrId.includes('@')) {
      try {
        const likhaAuth = await likhaLmsApi.loginLikhaUser(emailOrId, password);
        if (likhaAuth?.token && likhaAuth?.user) {
          let mapped = mapDirectusRole(
            likhaAuth.user.role,
            likhaAuth.user.email,
            likhaAuth.user.adminSubrole
          );
          if (pending?.role === 'student' && mapped.role !== 'student') {
            mapped = { role: 'student', title: 'Undergraduate Student' };
            // Correct Directus role in background
            likhaLmsApi.users.resolveRoleId('student').then(rId => {
              if (rId && likhaAuth.user.id) {
                likhaLmsApi.users.updateUser(likhaAuth.user.id, { role: rId }).catch(() => {});
              }
            }).catch(() => {});
          } else if (pending?.role === 'faculty' && mapped.role !== 'faculty' && mapped.role !== 'admin' && mapped.role !== 'superadmin') {
            mapped = { role: 'faculty', title: 'Instructor' };
          }
          const rawMappedUser: User = {
            id: likhaAuth.user.id,
            name: resolveDirectusUserName(likhaAuth.user, likhaAuth.user.email),
            firstName: likhaAuth.user.first_name || undefined,
            middleName: likhaAuth.user.middle_name || undefined,
            lastName: likhaAuth.user.last_name || undefined,
            email: likhaAuth.user.email,
            role: mapped.role,
            adminSubrole: mapped.adminSubrole,
            avatar: likhaAuth.user.avatar ? `${likhaLmsApi ? 'https://gabay.zyberlab.com/assets/' + likhaAuth.user.avatar : ''}` : '',
            department:
              likhaAuth.user.department ||
              (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
            title: (mapped.role === 'student' ? 'Undergraduate Student' : (likhaAuth.user.title || mapped.title)),
            collegeId: likhaAuth.user.college_id || likhaAuth.user.collegeId,
            collegeName: likhaAuth.user.college_name || likhaAuth.user.collegeName,
            yearLevel: likhaAuth.user.year_level !== undefined ? Number(likhaAuth.user.year_level) : (likhaAuth.user.yearLevel !== undefined ? Number(likhaAuth.user.yearLevel) : undefined),
            yearsOfTeaching: likhaAuth.user.years_of_teaching !== undefined ? Number(likhaAuth.user.years_of_teaching) : (likhaAuth.user.yearsOfTeaching !== undefined ? Number(likhaAuth.user.yearsOfTeaching) : undefined),
          };
          const mappedUser = normalizeChancellorUser(rawMappedUser);
          setToken(likhaAuth.token);
          const essentialLikha = await refreshEssential(mappedUser);
          void refreshDeferred(essentialLikha.fresh, essentialLikha.courses, essentialLikha.run);
          setCurrentUser(mappedUser);
          return { success: true, user: mappedUser };
        }
      } catch (likhaErr: any) {
        const msg = String(likhaErr?.message || '');
        if (msg.includes('401') || msg.includes('authentication failed')) {
          return { success: false, message: 'Invalid email or password.' };
        }
      }
    }

    const localUser = db.users.find(
      u => (u.email.toLowerCase() === cleanEmail || u.studentId?.toLowerCase() === cleanEmail)
    );
    if (localUser) {
      const effectiveUser = normalizeChancellorUser(localUser);
      if (!effectiveUser.password || effectiveUser.password !== password) {
        return { success: false, message: 'Invalid email or password.' };
      }
      setCurrentUser(effectiveUser);
      return { success: true, user: effectiveUser };
    }

    return { success: false, message: 'Login failed.' };
  };

  const logout = () => {
    clearToken();
    bootstrapRef.current++;
    sprHydratedRef.current.clear();
    setSyllabusRevisions({});
    setCurrentUser(null);
    setDb(emptyDb());
    setIsUserProfileModalOpen(false);
    setIsRoleModalOpen(false);
  };

  const switchRole = (role: UserRole) => {
    let userWithRole = db.users.find(u => u.role === role);
    if (!userWithRole && role === 'superadmin') {
      const foundJayvee = db.users.find(u => isChancellorEmail(u.email));
      if (foundJayvee) {
        userWithRole = normalizeChancellorUser(foundJayvee);
      } else {
        userWithRole = {
          id: 'usr-chancellor-jayvee',
          name: 'Jayvee Reyes',
          email: 'jayveegenetareyes@gmail.com',
          role: 'superadmin',
          adminSubrole: 'chancellor',
          title: 'University Chancellor',
          department: 'Office of the Chancellor',
          avatar: '',
        };
      }
    }
    if (userWithRole) {
      setCurrentUser(normalizeChancellorUser(userWithRole));
    }
  };

  // On-demand Course Hydration (Priority 1 Optimization)
  const hydrateCourse = useCallback(async (courseId: string): Promise<void> => {
    if (!courseId) return;
    if (hydratedCourseIdsRef.current.has(courseId) || hydratingCourseIdsRef.current.has(courseId)) {
      return;
    }
    hydratingCourseIdsRef.current.add(courseId);
    try {
      const [
        sectionsSettled,
        requestsSettled,
        approvedSettled,
        modulesSettled,
        announcementsSettled,
        discussionsSettled,
        quizzesSettled,
        examsSettled,
        activitiesSettled,
        gradesSettled,
        sprConfigSettled,
        foldersSettled,
        filesSettled,
      ] = await Promise.allSettled([
        Promise.resolve().then(() => likhaLmsApi?.sections?.getSections?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.(courseId, 'pending') ?? []),
        Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.(courseId, 'approved') ?? []),
        Promise.resolve().then(() => likhaLmsApi?.modules?.getModulesWithItems?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.communications?.getAnnouncements?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.communications?.getDiscussions?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.assessments?.getQuizzes?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.assessments?.getExams?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.assessments?.getActivities?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.grades?.getCourseGrades?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.grades?.getSPRConfig?.(courseId) ?? null),
        Promise.resolve().then(() => likhaLmsApi?.files?.getCourseFolders?.(courseId) ?? []),
        Promise.resolve().then(() => likhaLmsApi?.files?.getCourseFiles?.(courseId) ?? []),
      ]);

      const newSections = sectionsSettled.status === 'fulfilled' && Array.isArray(sectionsSettled.value)
        ? (sectionsSettled.value as any[]).map(mapLikhaSectionRow)
        : [];
      const newRequests = [
        ...(requestsSettled.status === 'fulfilled' && Array.isArray(requestsSettled.value) ? (requestsSettled.value as any[]).map(mapLikhaRequestRow) : []),
        ...(approvedSettled.status === 'fulfilled' && Array.isArray(approvedSettled.value) ? (approvedSettled.value as any[]).map(mapLikhaRequestRow) : []),
      ];
      const newModules = modulesSettled.status === 'fulfilled' && Array.isArray(modulesSettled.value)
        ? (modulesSettled.value as any[]).map(mapLikhaModuleRow)
        : [];
      const newAnnouncements = announcementsSettled.status === 'fulfilled' && Array.isArray(announcementsSettled.value)
        ? (announcementsSettled.value as any[]).map(r => mapLikhaAnnouncementRow(r, courseId))
        : [];
      const newDiscussions = discussionsSettled.status === 'fulfilled' && Array.isArray(discussionsSettled.value)
        ? (discussionsSettled.value as any[]).map(r => mapLikhaDiscussionRow(r, courseId))
        : [];
      const newQuizzes = quizzesSettled.status === 'fulfilled' && Array.isArray(quizzesSettled.value)
        ? (quizzesSettled.value as any[]).map(r => normalizeQuiz(mapLikhaQuizRow(r)))
        : [];
      const newExams = examsSettled.status === 'fulfilled' && Array.isArray(examsSettled.value)
        ? (examsSettled.value as any[]).map(r => normalizeExam(mapLikhaExamRow(r)))
        : [];
      const newActivities = activitiesSettled.status === 'fulfilled' && Array.isArray(activitiesSettled.value)
        ? (activitiesSettled.value as any[]).map(r => normalizeActivity(mapLikhaActivityRow(r)))
        : [];
      const newGrades = gradesSettled.status === 'fulfilled' && Array.isArray(gradesSettled.value)
        ? (gradesSettled.value as any[]).map(r => normalizeCourseGrade(mapLikhaGradeRow(r, courseId)))
        : [];
      const sprConfig = sprConfigSettled.status === 'fulfilled' && sprConfigSettled.value
        ? mapLikhaSPRConfigRow(sprConfigSettled.value, courseId)
        : null;
      const newFolders = foldersSettled.status === 'fulfilled' && Array.isArray(foldersSettled.value)
        ? (foldersSettled.value as any[]).map(f => mapLikhaCourseFolderRow(f, courseId))
        : [];
      const newFiles = filesSettled.status === 'fulfilled' && Array.isArray(filesSettled.value)
        ? (filesSettled.value as any[]).map(f => mapLikhaCourseFileRow(f, courseId))
        : [];

      // Fetch submissions for assessments in this course
      const assessments: Array<{ id: string; type: 'quiz' | 'activity' | 'exam' }> = [
        ...newQuizzes.map(q => ({ id: q.id, type: 'quiz' as const })),
        ...newActivities.map(a => ({ id: a.id, type: 'activity' as const })),
        ...newExams.map(e => ({ id: e.id, type: 'exam' as const })),
      ];
      let newSubmissions: Submission[] = [];
      if (assessments.length > 0 && likhaLmsApi?.submissions?.getSubmissions) {
        const subSettled = await Promise.allSettled(
          assessments.map(async item => {
            const rows = (await likhaLmsApi.submissions.getSubmissions(item.id, item.type)) ?? [];
            return (Array.isArray(rows) ? rows : []).map((s: any) =>
              normalizeSubmission(mapLikhaSubmissionRow(s, courseId))
            );
          })
        );
        for (const res of subSettled) {
          if (res.status === 'fulfilled') {
            newSubmissions.push(...res.value);
          }
        }
      }

      setDb(prev => ({
        ...prev,
        courseSections: [...(prev.courseSections || []).filter(s => s.courseId !== courseId), ...newSections],
        enrollmentRequests: [...(prev.enrollmentRequests || []).filter(r => r.courseId !== courseId), ...newRequests],
        modules: [...(prev.modules || []).filter(m => m.courseId !== courseId), ...newModules],
        announcements: [...(prev.announcements || []).filter(a => a.courseId !== courseId), ...newAnnouncements],
        discussions: [...(prev.discussions || []).filter(d => d.courseId !== courseId), ...newDiscussions],
        quizzes: [...(prev.quizzes || []).filter(q => q.courseId !== courseId), ...newQuizzes],
        exams: [...(prev.exams || []).filter(e => e.courseId !== courseId), ...newExams],
        activities: [...(prev.activities || []).filter(a => a.courseId !== courseId), ...newActivities],
        courseGrades: [...(prev.courseGrades || []).filter(g => g.courseId !== courseId), ...newGrades],
        courseFolders: [...(prev.courseFolders || []).filter(f => f.courseId !== courseId), ...newFolders],
        courseFiles: [...(prev.courseFiles || []).filter(f => f.courseId !== courseId), ...newFiles],
        submissions: [
          ...(prev.submissions || []).filter(s => s.courseId !== courseId),
          ...newSubmissions,
        ],
        sprConfigs: sprConfig ? { ...prev.sprConfigs, [courseId]: sprConfig } : prev.sprConfigs,
      }));

      hydratedCourseIdsRef.current.add(courseId);
    } catch (err) {
      console.warn(`[hydrateCourse] Failed to hydrate course ${courseId}:`, err);
    } finally {
      hydratingCourseIdsRef.current.delete(courseId);
    }
  }, []);

  // Course state
  const [activeCourseId, setActiveCourseIdState] = useState<string | null>('crs-cmsc131');
  const setActiveCourseId = useCallback((id: string | null) => {
    activeCourseIdRef.current = id;
    setActiveCourseIdState(id);
    if (id) {
      void hydrateCourse(id);
    }
  }, [hydrateCourse]);

  // UI Drawers & Modals
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

// Alert & Confirmation Modal state
  const [alertOptions, setAlertOptions] = useState<AlertModalOptions | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // Notifications state (mirrors db.notifications so badges survive reload)
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const stored = (db as LMSDatabase).notifications;
    if (stored && Array.isArray(stored)) {
      setNotifications(prev => {
        if (prev.length === stored.length && prev.every((n, i) => n.id === stored[i]?.id && n.read === stored[i]?.read)) {
          return prev;
        }
        return [...stored].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    }
  }, [db.notifications]);

  const showAlert = (options: string | AlertModalOptions, title?: string) => {
    if (typeof options === 'string') {
      setAlertOptions({
        title: title || 'Notice',
        message: options,
        type: 'info'
      });
    } else {
      setAlertOptions(options);
    }
    setIsAlertOpen(true);
  };

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setAlertOptions({
      title: title || 'Confirmation',
      message,
      type: 'confirm',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm
    });
    setIsAlertOpen(true);
  };

  const closeAlert = () => {
    setIsAlertOpen(false);
  };

  // SpeedGrader
  const [activeSpeedGraderSubmissionId, setActiveSpeedGraderSubmissionId] = useState<string | null>(null);

  const openSpeedGrader = (subId: string) => {
    setActiveSpeedGraderSubmissionId(subId);
  };

  const closeSpeedGrader = () => {
    setActiveSpeedGraderSubmissionId(null);
  };

  // History logger
  const logHistory = (path: string, title: string) => {
    const newLog: HistoryLog = {
      id: `hist-${Date.now()}`,
      path,
      title,
      timestamp: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    setDb(prev => ({
      ...prev,
      historyLogs: [newLog, ...prev.historyLogs.filter(h => h.path !== path)].slice(0, 15)
    }));
  };

  // ==========================================
  // REAL CRUD ACTIONS
  // ==========================================

  // Syllabus-driven grading terms: per-course options from the override
  // (Task 6 editor) or syllabus detection, consumed by Tasks 6-7.
  const effectiveTermsForCourse = (courseId: string): TermId[] => {
    const course = db.courses.find(c => c.id === courseId);
    return effectiveTerms(course ?? null, course?.syllabus ?? null);
  };

  const isCourseGradeReady = (courseId: string): boolean => {
    const course = db.courses.find(c => c.id === courseId);
    return isSyllabusGradeReady(syllabusRevisions[courseId] ?? null, course?.syllabus ?? null);
  };

  const defaultTermForCourse = (courseId: string): TermId =>
    effectiveTermsForCourse(courseId)[0] ?? 'midterm';

  const createCourse = async (courseData: Partial<Course>): Promise<Course> => {
    const uniqueJoinCode =
      courseData.joinCode?.trim().toUpperCase() ||
      generateCourseJoinCode(db.courses, courseData.code);

    try {
      // Likha ERP is the source of truth (Express /api/courses is RAG-only now).
      const row = await likhaLmsApi.courses.createCourse({
        code: courseData.code || 'CMSC 199',
        title: courseData.title || 'Advanced Computer Science Topics',
        section: courseData.section || 'BSCS 4-1',
        term: courseData.term || '1st Sem AY 2026-2027',
        instructor_name: courseData.instructorName || activeUser.name,
        instructor_id: courseData.instructorId || activeUser.id,
        published: courseData.published ?? true,
        color: courseData.color !== undefined ? courseData.color : '',
        image: courseData.image || '',
        credits: courseData.credits || 3,
        ched_compliance_code: courseData.chedComplianceCode || 'CMO-25-2015',
        join_code: uniqueJoinCode
      });

      const course: Course = {
        id: String((row as any)?.id ?? `crs-${Date.now().toString(36)}`),
        code: (row as any)?.code || courseData.code || 'CMSC 199',
        title: (row as any)?.title || courseData.title || 'Advanced Computer Science Topics',
        section: (row as any)?.section || courseData.section || 'BSCS 4-1',
        term: (row as any)?.term || courseData.term || '1st Sem AY 2026-2027',
        instructorId: courseData.instructorId || activeUser.id,
        instructorName: courseData.instructorName || activeUser.name,
        published: (row as any)?.published ?? courseData.published ?? true,
        color: (row as any)?.color ?? (courseData.color !== undefined ? courseData.color : ''),
        image: (row as any)?.image || courseData.image || '',
        enrolledCount: 0,
        credits: (row as any)?.credits || courseData.credits || 3,
        chedComplianceCode: (row as any)?.ched_compliance_code || courseData.chedComplianceCode || 'CMO-25-2015',
        joinCode: (row as any)?.join_code || uniqueJoinCode,
        schoolYear: courseData.schoolYear || (activeUser?.collegeId ? getActiveSchoolYearForCollege(activeUser.collegeId)?.year : undefined) || getActiveSchoolYearForCollege('col-ccs')?.year || '2025-2026',
      };

      setDb(prev => ({
        ...prev,
        courses: [course, ...prev.courses]
      }));

      setActiveCourseId(course.id);

      return course;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create course.';
      setLastError(message);
      showAlert(message, 'Create Course Failed');
      throw err;
    }
  };

  const deleteCourse = async (courseId: string): Promise<void> => {
    try {
      // Children-first cascade: Directus has no server-side CASCADE, so a
      // bare course DELETE orphans (or is blocked by) modules, items,
      // syllabus rows, announcements, assessments, files, grades, etc.
      try {
        await likhaLmsApi.courses.deleteCourseCascade(courseId);
      } catch {
        await likhaLmsApi.courses.deleteCourse(courseId);
      }
      // Purge every course-scoped slice so no orphaned modules, items,
      // syllabus revisions, announcements, assessments, files, grades,
      // sections, or requests survive in the UI.
      setDb(prev => {
        const keep = <T extends { courseId?: string }>(rows: T[] | undefined) =>
          (rows || []).filter(r => r.courseId !== courseId);
        const { [courseId]: _droppedCfg, ...sprConfigs } = prev.sprConfigs || {};
        const { [courseId]: _droppedScores, ...sprScores } = prev.sprScores || {};
        return {
          ...prev,
          courses: (prev.courses || []).filter(c => c.id !== courseId),
          modules: keep(prev.modules),
          activities: keep(prev.activities),
          quizzes: keep(prev.quizzes),
          exams: keep(prev.exams),
          submissions: (prev.submissions || []).filter(s => s.courseId !== courseId),
          announcements: keep(prev.announcements),
          discussions: keep(prev.discussions),
          courseFiles: keep(prev.courseFiles),
          courseFolders: keep(prev.courseFolders),
          courseGrades: keep(prev.courseGrades),
          courseSections: keep(prev.courseSections),
          enrollmentRequests: keep(prev.enrollmentRequests),
          calendarEvents: (prev.calendarEvents || []).filter(e => e.courseId !== courseId),
          users: (prev.users || []).map(u =>
            (u.enrolledCourseIds || []).includes(courseId)
              ? { ...u, enrolledCourseIds: (u.enrolledCourseIds || []).filter(c => c !== courseId) }
              : u
          ),
          sprConfigs,
          sprScores,
        };
      });
      setSyllabusRevisions(prev => {
        const { [courseId]: _dropped, ...rest } = prev;
        return rest;
      });
      likhaLmsApi.invalidateCache('/items/courses');
      // Clear every cached child list whose filter references this course
      // (keys look like `...filter[course_id][_eq]=<courseId>...`).
      likhaLmsApi.invalidateCache(`_eq]=${courseId}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete course.';
      setLastError(message);
      showAlert(message, 'Delete Course Failed');
      throw err;
    }
  };

  const createModule = async (courseId: string, title: string): Promise<Module> => {
    try {
      // Likha ERP is the source of truth for modules.
      const row = await likhaLmsApi.modules.createModule({
        course_id: courseId,
        title,
        order: db.modules.filter(m => m.courseId === courseId).length + 1,
        published: true,
      });
      // Server defaults order to 0 — keep the client's append-at-end ordering.
      const mapped = mapLikhaModuleRow({ course_id: courseId, ...(row as any) });
      const merged: Module = {
        ...mapped,
        order: mapped.order || db.modules.filter(m => m.courseId === courseId).length + 1,
      };
      setDb(prev => ({
        ...prev,
        modules: [...prev.modules, merged]
      }));
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create module.';
      setLastError(message);
      showAlert(message, 'Create Module Failed');
      throw err;
    }
  };

  const updateModule = async (moduleId: string, updates: Partial<Module>): Promise<void> => {
    // Folder renames ride along server-side (module:<id> autoKey); no client
    // courseFolders bookkeeping needed.
    const body: Record<string, string | boolean | number> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.published !== undefined) body.published = updates.published;
    if (updates.order !== undefined) body.order = updates.order;
    try {
      // Likha ERP is the source of truth for modules.
      const row = await likhaLmsApi.modules.updateModule(moduleId, body);
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).map(m =>
          m.id === moduleId
            ? mapLikhaModuleRow({ ...m, ...(row as any), items: m.items, comments: m.comments })
            : m
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update module.';
      setLastError(message);
      showAlert(message, 'Update Module Failed');
      throw err;
    }
  };

  const deleteModule = async (moduleId: string): Promise<void> => {
    // No-cascade semantics live server-side (filed CourseFile rows stay).
    try {
      // Likha ERP is the source of truth for modules.
      await likhaLmsApi.modules.deleteModule(moduleId);
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).filter(m => m.id !== moduleId)
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete module.';
      setLastError(message);
      showAlert(message, 'Delete Module Failed');
      throw err;
    }
  };

  const addModuleItem = async (moduleId: string, itemData: Partial<ModuleItem>): Promise<void> => {
    // File fields pass through; the server files them (area/modules folders).
    // Likha ERP is the source of truth for module items (snake_case patch).
    const body: Record<string, string | boolean> = {};
    if (itemData.title !== undefined) body.title = itemData.title;
    if (itemData.type !== undefined) body.type = itemData.type;
    if (itemData.published !== undefined) body.published = itemData.published;
    if (itemData.required !== undefined) body.required = itemData.required;
    if (itemData.completionCondition !== undefined) body.completionCondition = itemData.completionCondition;
    if (itemData.content !== undefined && itemData.content !== null) body.content = itemData.content;
    if (itemData.activityId !== undefined && itemData.activityId !== null) body.activityId = itemData.activityId;
    if (itemData.quizId !== undefined && itemData.quizId !== null) body.quizId = itemData.quizId;
    if (itemData.fileUrl !== undefined && itemData.fileUrl !== null) body.fileUrl = itemData.fileUrl;
    if (itemData.fileName !== undefined && itemData.fileName !== null) body.fileName = itemData.fileName;
    if (itemData.fileSize !== undefined && itemData.fileSize !== null) body.fileSize = itemData.fileSize;
    if (itemData.fileType !== undefined && itemData.fileType !== null) body.fileType = itemData.fileType;
    try {
      const patch = toLikhaItemPatch(body);
      const row = await likhaLmsApi.modules.createModuleItem({ module_id: moduleId, ...patch });
      const item = mapLikhaModuleItemRow({ module_id: moduleId, ...patch, ...(row as any) });
      setDb(prev => ({
        ...prev,
        modules: prev.modules.map(mod =>
          mod.id === moduleId ? { ...mod, items: [...mod.items, item] } : mod
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add module item.';
      setLastError(message);
      showAlert(message, 'Add Item Failed');
      throw err;
    }
  };

  const updateModuleItem = async (
    currentModuleId: string,
    itemId: string,
    updates: Partial<ModuleItem>,
    targetModuleId?: string
  ): Promise<void> => {
    const destModuleId = targetModuleId || currentModuleId;
    try {
      const body: Record<string, string | boolean | number> = {};
      const stringFields = [
        'title', 'type', 'completionCondition', 'content', 'activityId',
        'quizId', 'fileUrl', 'fileName', 'fileSize', 'fileType'
      ] as const;
      for (const key of stringFields) {
        const value = updates[key];
        if (value !== undefined && value !== null) body[key] = value;
      }
      if (updates.published !== undefined) body.published = updates.published;
      if (updates.required !== undefined) body.required = updates.required;
      if (updates.minScore !== undefined) body.minScore = updates.minScore;
      if (destModuleId !== currentModuleId) {
        // Cross-module move: single PATCH carrying the target FK — the item
        // id is PRESERVED server-side.
        const row = await likhaLmsApi.modules.updateModuleItem(itemId, {
          ...toLikhaItemPatch(body),
          module_id: destModuleId,
        });
        setDb(prev => {
          const src = (prev.modules || [])
            .find(mod => mod.id === currentModuleId)?.items
            .find(it => it.id === itemId);
          const moved = mapLikhaModuleItemRow({ ...(src ?? {}), ...(row as any) });
          const withoutSource = (prev.modules || []).map(mod =>
            mod.id === currentModuleId
              ? { ...mod, items: mod.items.filter(it => it.id !== itemId) }
              : mod
          );
          return {
            ...prev,
            modules: withoutSource.map(mod =>
              mod.id === destModuleId ? { ...mod, items: [...mod.items, moved] } : mod
            )
          };
        });
        return;
      }
      const row = await likhaLmsApi.modules.updateModuleItem(itemId, toLikhaItemPatch(body));
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).map(mod =>
          mod.id === currentModuleId
            ? { ...mod, items: mod.items.map(it => (it.id === itemId ? mapLikhaModuleItemRow({ ...it, ...(row as any) }) : it)) }
            : mod
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update module item.';
      setLastError(message);
      showAlert(message, 'Update Item Failed');
      throw err;
    }
  };

  const deleteModuleItem = async (moduleId: string, itemId: string): Promise<void> => {
    try {
      // Likha ERP is the source of truth for module items.
      await likhaLmsApi.modules.deleteModuleItem(itemId);
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).map(mod =>
          mod.id === moduleId ? { ...mod, items: mod.items.filter(it => it.id !== itemId) } : mod
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete module item.';
      setLastError(message);
      showAlert(message, 'Delete Item Failed');
      throw err;
    }
  };

  const createQuiz = async (quizData: Partial<Quiz>): Promise<Quiz> => {
    const courseId = quizData.courseId || activeCourseId || 'crs-cmsc131';
    const term = quizData.term ?? defaultTermForCourse(courseId);
    // Questions pass through (Likha persists option blobs + answer keys in
    // assessment_questions child rows).
    try {
      // Likha ERP is the source of truth for quizzes.
      const saved = await likhaLmsApi.assessments.saveQuiz({
        course_id: courseId,
        title: quizData.title || 'New Assessment Quiz',
        term,
        instructions: quizData.instructions || 'Answer all questions carefully. Time limit strictly enforced.',
        published: quizData.published ?? true,
        questions: quizData.questions || [
          {
            id: `q-${Date.now()}-1`,
            text: 'Which architectural pattern is recommended for modern web applications?',
            type: 'multiple_choice',
            options: ['Component-based (e.g. React)', 'Monolithic CGI', 'FTP Server', 'Telnet Terminal'],
            correctAnswer: 'Component-based (e.g. React)',
            points: 10
          }
        ],
        ...(quizData.timeLimitMinutes !== undefined ? { time_limit_minutes: quizData.timeLimitMinutes } : {}),
        ...(quizData.delayedUntil !== undefined ? { delayed_until: quizData.delayedUntil } : {}),
        ...(quizData.dueDate !== undefined ? { due_date: quizData.dueDate } : {}),
        ...(quizData.fileName !== undefined ? { file_name: quizData.fileName } : {}),
        ...(quizData.fileUrl !== undefined ? { file_url: quizData.fileUrl } : {}),
        ...(quizData.fileSize !== undefined ? { file_size: quizData.fileSize } : {})
      });
      const merged = normalizeQuiz(mapLikhaQuizRow(saved));
      setDb(prev => ({
        ...prev,
        quizzes: [merged, ...prev.quizzes]
      }));

      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create quiz.';
      setLastError(message);
      showAlert(message, 'Create Quiz Failed');
      throw err;
    }
  };

  const recordQuizSubmission = async (
    quizId: string,
    studentId: string,
    answers: Record<string, string>
  ): Promise<Submission> => {
    // Client computes nothing new: POST the answers, cache the Likha row.
    // Instant-feedback scoring stays in QuizzesView's client scorer; the
    // gradebook reads the Likha row.
    try {
      // Likha ERP is the source of truth for submissions.
      const saved = await likhaLmsApi.submissions.submitAssessment({
        quiz_id: quizId,
        student_id: studentId,
        answers,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
      const courseId = dbRef.current.quizzes?.find(q => q.id === quizId)?.courseId;
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const idx = prev.submissions.findIndex(
          s => merged.activityKey !== undefined && s.activityKey === merged.activityKey && s.studentId === studentId
        );
        if (idx >= 0) {
          const updatedSubs = [...prev.submissions];
          updatedSubs[idx] = merged;
          return { ...prev, submissions: updatedSubs };
        }
        return { ...prev, submissions: [merged, ...prev.submissions] };
      });
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit quiz.';
      setLastError(message);
      showAlert(message, 'Submit Quiz Failed');
      throw err;
    }
  };

  const createExam = async (examData: Partial<Exam>): Promise<Exam> => {
    const courseId = examData.courseId || activeCourseId || 'crs-cmsc131';
    const term = examData.term ?? defaultTermForCourse(courseId);
    try {
      // Likha ERP is the source of truth for exams.
      const saved = await likhaLmsApi.assessments.saveExam({
        course_id: courseId,
        title: examData.title || 'New Exam',
        term,
        instructions: examData.instructions || 'Answer all questions carefully. Time limit strictly enforced.',
        published: examData.published ?? true,
        questions: examData.questions || [
          {
            id: `q-${Date.now()}-1`,
            text: 'Which architectural pattern is recommended for modern web applications?',
            type: 'multiple_choice',
            options: ['Component-based (e.g. React)', 'Monolithic CGI', 'FTP Server', 'Telnet Terminal'],
            correctAnswer: 'Component-based (e.g. React)',
            points: 10
          }
        ],
        ...(examData.timeLimitMinutes !== undefined ? { time_limit_minutes: examData.timeLimitMinutes } : {}),
        ...(examData.dueDate !== undefined ? { due_date: examData.dueDate } : {}),
        ...((examData as { fileName?: unknown }).fileName !== undefined ? { file_name: (examData as { fileName?: unknown }).fileName } : {}),
        ...((examData as { fileUrl?: unknown }).fileUrl !== undefined ? { file_url: (examData as { fileUrl?: unknown }).fileUrl } : {}),
        ...((examData as { fileSize?: unknown }).fileSize !== undefined ? { file_size: (examData as { fileSize?: unknown }).fileSize } : {})
      });
      const merged = normalizeExam(mapLikhaExamRow(saved));
      setDb(prev => ({
        ...prev,
        exams: [merged, ...(prev.exams || [])]
      }));

      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create exam.';
      setLastError(message);
      showAlert(message, 'Create Exam Failed');
      throw err;
    }
  };

  const recordExamSubmission = async (
    examId: string,
    studentId: string,
    answers: Record<string, string>
  ): Promise<Submission> => {
    // Client computes nothing new: POST the answers, cache the Likha row.
    // Instant-feedback scoring stays in ExamsView's client scorer; the
    // gradebook reads the Likha row.
    try {
      // Likha ERP is the source of truth for submissions.
      const saved = await likhaLmsApi.submissions.submitAssessment({
        exam_id: examId,
        student_id: studentId,
        answers,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
      const courseId = dbRef.current.exams?.find(e => e.id === examId)?.courseId;
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const idx = (prev.submissions || []).findIndex(
          s => merged.activityKey !== undefined && s.activityKey === merged.activityKey && s.studentId === studentId
        );
        if (idx >= 0) {
          const updatedSubs = [...prev.submissions];
          updatedSubs[idx] = merged;
          return { ...prev, submissions: updatedSubs };
        }
        return { ...prev, submissions: [merged, ...prev.submissions] };
      });
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit exam.';
      setLastError(message);
      showAlert(message, 'Submit Exam Failed');
      throw err;
    }
  };

  const createActivity = async (data: Partial<Activity>): Promise<Activity> => {
    const courseId = data.courseId || activeCourseId || 'crs-cmsc131';
    const questions = data.questions || [];
    const term = data.term ?? defaultTermForCourse(courseId);
    const format = data.format ?? 'questionset';
    try {
      const body: Record<string, unknown> =
        format === 'classic'
          ? {
              course_id: courseId,
              title: data.title?.trim() || 'New Course Activity',
              instructions:
                data.instructions || 'Please review the guidelines and submit your work before the deadline.',
              points_possible: data.pointsPossible ?? 100,
              due_date: data.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
              ...(data.term !== undefined ? { term: data.term } : { term }),
              submission_types: data.submissionTypes || ['file', 'online_text'],
              published: data.published ?? true,
              category: data.category || 'Laboratory',
              weight: data.weight ?? 20,
              // No predefined rubric: the Classic Activity form owns an
              // opt-in custom rubric (ActivityFormValue.includeRubric); when
              // unchecked the payload carries `rubric: []` and SpeedGrader
              // falls back to plain score entry.
              rubric: Array.isArray(data.rubric) ? data.rubric : [],
              ...(data.fileName !== undefined ? { file_name: data.fileName } : {}),
              ...(data.fileUrl !== undefined ? { file_url: data.fileUrl } : {}),
              ...(data.fileSize !== undefined ? { file_size: data.fileSize } : {}),
              ...(data.availableFrom !== undefined ? { available_from: data.availableFrom } : {}),
              ...(data.availableUntil !== undefined ? { available_until: data.availableUntil } : {}),
              ...(data.sectionRestriction !== undefined ? { section_restriction: data.sectionRestriction } : {}),
              format: 'classic',
            }
          : {
              course_id: courseId,
              title: data.title?.trim() || 'New Question-Set Activity',
              term,
              instructions: data.instructions || 'Answer all questions carefully.',
              points_possible: data.pointsPossible ?? activityPointsPossible(questions),
              ...(data.dueDate !== undefined ? { due_date: data.dueDate } : {}),
              published: data.published ?? true,
              questions,
              format: 'questionset',
            };
      // Likha ERP is the source of truth for activities.
      const saved = await likhaLmsApi.assessments.saveActivity(body);
      const merged = normalizeActivity(mapLikhaActivityRow(saved));
      setDb(prev => ({
        ...prev,
        activities: [merged, ...(prev.activities || [])]
      }));

      if (merged.format === 'classic' && merged.dueDate) {
        // Client-only calendar mirroring: classic activities get a deadline
        // event (CalendarEvent type 'activity').
        const newCalEvent: CalendarEvent = {
          id: `evt-${Date.now()}`,
          title: `Due: ${merged.title}`,
          date: merged.dueDate.split('T')[0],
          time: '11:59 PM',
          courseId: merged.courseId,
          type: 'activity',
          description: `Course activity submission deadline for ${merged.title}`
        };
        setDb(prev => ({
          ...prev,
          calendarEvents: [...prev.calendarEvents, newCalEvent]
        }));
      }

      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create activity.';
      setLastError(message);
      showAlert(message, 'Create Activity Failed');
      throw err;
    }
  };

  const updateActivity = async (activityId: string, updates: Partial<Activity>): Promise<Activity> => {
    // Likha ERP is the source of truth (union of classic + question-set
    // fields — all classic fields supported). Questions are write-once, so
    // the cached question set is preserved here.
    try {
      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.term !== undefined) body.term = updates.term;
      if (updates.instructions !== undefined) body.instructions = updates.instructions;
      if (updates.published !== undefined) body.published = updates.published;
      if (updates.dueDate !== undefined) body.due_date = updates.dueDate;
      if (updates.pointsPossible !== undefined) body.points_possible = updates.pointsPossible;
      if (updates.submissionTypes !== undefined) body.submission_types = updates.submissionTypes;
      if (updates.category !== undefined) body.category = updates.category;
      if (updates.weight !== undefined) body.weight = updates.weight;
      if (updates.rubric !== undefined) body.rubric = updates.rubric;
      if (updates.fileName !== undefined) body.file_name = updates.fileName;
      if (updates.fileUrl !== undefined) body.file_url = updates.fileUrl;
      if (updates.fileSize !== undefined) body.file_size = updates.fileSize;
      if (updates.availableFrom !== undefined) body.available_from = updates.availableFrom;
      if (updates.availableUntil !== undefined) body.available_until = updates.availableUntil;
      if (updates.sectionRestriction !== undefined) body.section_restriction = updates.sectionRestriction;
      const saved = await likhaLmsApi.assessments.saveActivity({ id: activityId, ...body });
      const normalized = normalizeActivity(mapLikhaActivityRow(saved));
      let merged: Activity = normalized;
      setDb(prev => {
        const existing = (prev.activities || []).find(a => a.id === activityId);
        merged = {
          ...normalized,
          questions:
            normalized.questions && normalized.questions.length > 0
              ? normalized.questions
              : existing?.questions || []
        };
        return {
          ...prev,
          activities: (prev.activities || []).map(a => (a.id === activityId ? merged : a))
        };
      });

      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update activity.';
      setLastError(message);
      showAlert(message, 'Update Activity Failed');
      throw err;
    }
  };

  const recordActivitySubmission = async (
    activityId: string,
    studentId: string,
    answers: Record<string, string>
  ): Promise<Submission> => {
    // Same pattern as quizzes: POST the answers, cache the Likha row.
    // Essay-pending status comes from the Likha row (status stays
    // 'submitted' until faculty grades in SpeedGrader).
    try {
      // Likha ERP is the source of truth for submissions.
      const saved = await likhaLmsApi.submissions.submitAssessment({
        activity_id: activityId,
        student_id: studentId,
        answers,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
      const courseId = dbRef.current.activities?.find(a => a.id === activityId)?.courseId;
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const updatedSubs = [...prev.submissions];
        const idx = updatedSubs.findIndex(
          s => merged.activityKey !== undefined && s.activityKey === merged.activityKey && s.studentId === studentId
        );
        if (idx >= 0) {
          updatedSubs[idx] = merged;
        } else {
          updatedSubs.unshift(merged);
        }
        return { ...prev, submissions: updatedSubs };
      });
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit activity.';
      setLastError(message);
      showAlert(message, 'Submit Activity Failed');
      throw err;
    }
  };

  const deleteActivity = async (activityId: string): Promise<void> => {
    try {
      // Likha ERP is the source of truth for activities.
      await likhaLmsApi.assessments.deleteActivity(activityId);
      setDb(prev => ({
        ...prev,
        activities: (prev.activities || []).filter(a => a.id !== activityId),
        submissions: prev.submissions.filter(
          s => s.activityKey !== activityId && s.activityKey !== `asg-activity-${activityId}`
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete activity.';
      setLastError(message);
      showAlert(message, 'Delete Activity Failed');
      throw err;
    }
  };

  const enrollPerson = async (person: Partial<User>, courseId?: string): Promise<boolean> => {
    const targetCourseId = courseId || activeCourseId;
    const newPerson: User = {
      id: `usr-${person.role || 'stud'}-${Date.now().toString(36)}`,
      name: person.name || 'New Enrollee',
      email: person.email || `user.${Date.now()}@dmmmsu.edu.ph`,
      role: person.role || 'student',
      avatar: person.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      studentId: person.studentId || (person.role === 'student' ? `2026-SLUC-${Math.floor(1000 + Math.random() * 9000)}` : undefined),
      department: person.department || 'BS Computer Science',
      title: person.title || (person.role === 'student' ? 'Enrolled Student' : 'Instructor'),
      enrolledCourseIds: person.enrolledCourseIds || (targetCourseId ? [targetCourseId] : [])
    };

    setDb(prev => {
      const updatedCourses = prev.courses.map(c => {
        if (c.id === targetCourseId && newPerson.role === 'student') {
          return { ...c, enrolledCount: c.enrolledCount + 1 };
        }
        return c;
      });

      return {
        ...prev,
        users: [...prev.users, newPerson],
        courses: updatedCourses
      };
    });

    // Mirror the invite in Likha ERP when the person references an existing
    // account id. When the invite fails, roll back the created user.
    if (targetCourseId && person.id) {
      try {
        const row = await likhaLmsApi.requests.createRequest({
          course_id: targetCourseId,
          student_id: person.id,
          type: 'faculty_enroll',
          status: 'pending'
        });
        setDb(prev => mergeEnrollmentRequest(prev, mapLikhaRequestRow(row)));
      } catch (err) {
        const createdId = newPerson.id;
        setDb(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id !== createdId)
        }));
        const message = err instanceof ApiError ? err.message : 'Failed to send course invite.';
        setLastError(message);
        showAlert(message, 'Invite Failed');
        return false;
      }
    }
    return true;
  };

  const enrollStudentsInCourse = async (studentIds: string[], courseId: string): Promise<boolean> => {
    const targetCourseId = courseId || activeCourseId;
    if (!targetCourseId || studentIds.length === 0) return false;

    try {
      const rows = await Promise.all(
        studentIds.map(studentId =>
          likhaLmsApi.requests.createRequest({
            course_id: targetCourseId,
            student_id: studentId,
            type: 'faculty_enroll',
            status: 'pending'
          })
        )
      );
      setDb(prev => {
        let merged = prev;
        for (const row of rows) {
          merged = mergeEnrollmentRequest(merged, mapLikhaRequestRow(row));
        }
        return merged;
      });
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to enroll students.';
      setLastError(message);
      showAlert(message, 'Enroll Failed');
      return false;
    }
  };

  const createUser = async (userData: Partial<User>): Promise<User> => {
    const role = userData.role || 'student';
    const displayName = userData.name?.trim() || userData.email?.trim() || 'New User';
    const { first_name, last_name } = splitDisplayName(displayName);
    try {
      // Directus owns identity fields plus the role UUID FK. Avatar URLs and
      // titles stay client-side (no known writable field / upload UX yet).
      // Unknown role names resolve to null and stay local-only as before.
      const resolvedFirstName = userData.firstName || first_name;
      const resolvedLastName = userData.lastName || last_name;
      const payload: Record<string, string> = {
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        email: userData.email?.trim() || '',
        password: userData.password || 'password123',
        department: userData.department || 'College of Computer Science',
      };
      if (userData.middleName) {
        payload.middle_name = userData.middleName;
      }
      if (userData.role !== undefined) {
        // /roles unreachable → null → role stays local-only, write proceeds.
        let roleId: string | null = null;
        try {
          roleId = await likhaLmsApi.users.resolveRoleId(role);
        } catch {
          roleId = null;
        }
        if (roleId) payload.role = roleId;
      }
      const row = await likhaLmsApi.users.createUser(payload);
      // If Directus ignored the role or assigned default role, ensure we update it via PATCH
      if (payload.role && row?.id && (!row.role || (typeof row.role === 'object' ? row.role.id !== payload.role : row.role !== payload.role))) {
        try {
          await likhaLmsApi.users.updateUser(row.id, { role: payload.role });
        } catch (_) {}
      }
      const mapped = mapLikhaUserRowToUser(row);
      const merged: User = {
        ...mapped,
        id: userData.id || mapped.id,
        role,
        avatar:
          userData.avatar ||
          mapped.avatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: userData.title || (role === 'student' ? 'Undergraduate Student' : (role === 'faculty' ? 'Instructor' : mapped.title)),
        studentId: userData.studentId || (role === 'student' ? `2026-${Math.floor(10000 + Math.random() * 90000)}` : undefined),
        password: userData.password || 'password123',
        enrolledCourseIds: userData.enrolledCourseIds || [],
        name: userData.name || mapped.name,
        firstName: userData.firstName,
        middleName: userData.middleName,
        lastName: userData.lastName,
        adminSubrole: userData.adminSubrole,
        collegeId: userData.collegeId,
        collegeName: userData.collegeName,
        verificationStatus: userData.verificationStatus,
        emailVerified: userData.emailVerified,
        registeredAt: userData.registeredAt,
        verificationExpiresAt: userData.verificationExpiresAt,
        schoolYear: userData.schoolYear || (userData.collegeId ? getActiveSchoolYearForCollege(userData.collegeId)?.year : undefined) || getActiveSchoolYearForCollege('col-ccs')?.year || '2025-2026',
      };
      setDb(prev => ({
        ...prev,
        users: [...prev.users, merged]
      }));
      return merged;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user.';
      setLastError(message);
      showAlert(message, 'Create User Failed');
      throw err;
    }
  };

  const updateUser = async (id: string, updates: Partial<User> & { banner?: string }): Promise<boolean> => {
    // Directus PATCH accepts core identity fields plus the role UUID FK
    // (avatar URLs/titles stay local-only: no known writable field / upload
    // UX yet). Unknown role names resolve to null and stay local-only.
    const patchBody: Record<string, string> = {};
    if (updates.name !== undefined) {
      const { first_name, last_name } = splitDisplayName(updates.name);
      patchBody.first_name = first_name;
      if (last_name) patchBody.last_name = last_name;
    }
    if (updates.firstName !== undefined) patchBody.first_name = updates.firstName;
    if (updates.middleName !== undefined) patchBody.middle_name = updates.middleName;
    if (updates.lastName !== undefined) patchBody.last_name = updates.lastName;
    if (updates.email !== undefined) patchBody.email = updates.email;
    if (updates.password !== undefined) patchBody.password = updates.password;
    if (updates.department !== undefined) patchBody.department = updates.department;
    if (updates.role !== undefined) {
      // /roles unreachable → null → role stays local-only, write proceeds.
      let roleId: string | null = null;
      try {
        roleId = await likhaLmsApi.users.resolveRoleId(updates.role);
      } catch {
        roleId = null;
      }
      if (roleId) patchBody.role = roleId;
    }
    const localUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Partial<User>;

    try {
      if (Object.keys(patchBody).length > 0) {
        const row = await likhaLmsApi.users.updateUser(id, patchBody);
        const mapped = mapLikhaUserRowToUser(row);
        // Name/email/department echo back from the server; every other field
        // keeps its local value unless explicitly updated. NOTE: `role` is
        // deliberately absent here, so a server-side role rejection is
        // invisible — the requested role still applies locally below.
        const serverEcho = { name: mapped.name, email: mapped.email, department: mapped.department };
        setDb(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === id ? { ...u, ...serverEcho, ...localUpdates } : u))
        }));
        // Active session reads from currentUser (not db.users) — sync it so
        // avatar/banner/name changes render instantly without a reload.
        setCurrentUser(prev => (prev && prev.id === id ? { ...prev, ...serverEcho, ...localUpdates } : prev));
      } else {
        setDb(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === id ? { ...u, ...localUpdates } : u))
        }));
        setCurrentUser(prev => (prev && prev.id === id ? { ...prev, ...localUpdates } : prev));
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user.';
      setLastError(message);
      showAlert(message, 'Update User Failed');
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (activeUser.id === userId) {
      return {
        success: false,
        message: 'You cannot delete your own active account.'
      };
    }

    const userToDelete = db.users.find(u => u.id === userId);
    if (!userToDelete) {
      return { success: false, message: 'User not found.' };
    }

    try {
      await likhaLmsApi.users.deleteUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user.';
      setLastError(message);
      return { success: false, message };
    }

    setDb(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== userId),
      submissions: prev.submissions.filter(s => s.studentId !== userId)
    }));

    return {
      success: true,
      message: `Account for ${userToDelete.name} has been deleted.`
    };
  };

  const registerAccount = async (
    payload: {
      firstName: string;
      middleName?: string;
      lastName: string;
      fullName?: string;
      email: string;
      role: 'student' | 'faculty' | 'staff';
      collegeId: string;
      collegeName?: string;
      department: string;
      studentId: string;
      password: string;
    } & Partial<PendingRegistration>
  ): Promise<PendingRegistration> => {
    const id = payload.id || `reg-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    const fullName =
      payload.fullName ||
      [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' ');
    const matchedCollege = colleges.find(
      c => c.id === payload.collegeId || c.code.toLowerCase() === payload.collegeId.toLowerCase()
    );
    const collegeName = payload.collegeName || matchedCollege?.name || payload.collegeId;
    const activationToken =
      payload.activationToken ||
      generateSecureActivationToken();
    const registeredAt = payload.registeredAt || new Date().toISOString();
    const expiresAt =
      payload.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const newRegistration: PendingRegistration = {
      id,
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      fullName,
      email: payload.email,
      role: payload.role,
      collegeId: payload.collegeId,
      collegeName,
      department: payload.department,
      studentId: payload.studentId,
      password: payload.password,
      emailVerified: payload.emailVerified ?? false,
      activationToken,
      registeredAt,
      expiresAt,
      status: payload.status || 'pending',
      schoolYear: payload.schoolYear || (payload.collegeId ? getActiveSchoolYearForCollege(payload.collegeId)?.year : undefined) || getActiveSchoolYearForCollege('col-ccs')?.year || '2025-2026',
    };

    const currentList = pendingRegistrationsRef.current || pendingRegistrations;
    const updated = [
      newRegistration,
      ...currentList.filter(
        r => r.id !== newRegistration.id && r.email.toLowerCase() !== newRegistration.email.toLowerCase()
      )
    ];
    pendingRegistrationsRef.current = updated;
    setPendingRegistrations(updated);
    return newRegistration;
  };

  const activateEmail = useCallback(async (token: string): Promise<{ success: boolean; message: string }> => {
    let list = pendingRegistrationsRef.current || [];
    if (!list.some(r => r.activationToken === token)) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PENDING_REGISTRATIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (_) {}
    }

    const target = list.find(r => r.activationToken === token);
    if (!target) {
      return { success: false, message: 'Invalid or expired activation link.' };
    }
    const isExpired = target.status === 'expired' || Date.now() >= new Date(target.expiresAt).getTime();
    if (isExpired) {
      const updated = list.map(r => (r.activationToken === token ? { ...r, status: 'expired' as const } : r));
      pendingRegistrationsRef.current = updated;
      setPendingRegistrations(updated);
      try {
        const sanitized = updated.map(({ password: _, ...rest }) => rest);
        safeSetLocalStorage(STORAGE_KEY_PENDING_REGISTRATIONS, JSON.stringify(sanitized));
      } catch (_) {}
      return { success: false, message: 'Activation token has expired.' };
    }

    const updated = list.map(r => (r.activationToken === token ? { ...r, emailVerified: true } : r));
    pendingRegistrationsRef.current = updated;
    setPendingRegistrations(updated);
    try {
      const sanitized = updated.map(({ password: _, ...rest }) => rest);
      safeSetLocalStorage(STORAGE_KEY_PENDING_REGISTRATIONS, JSON.stringify(sanitized));
    } catch (_) {}
    return { success: true, message: 'Email address successfully verified.' };
  }, []);


  const verifyRegistration = async (id: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const list = pendingRegistrationsRef.current || pendingRegistrations;
    const target = list.find(r => r.id === id);
    if (!target) {
      return { success: false, message: 'Registration record not found.' };
    }

    const isExpired = target.status === 'expired' || Date.now() >= new Date(target.expiresAt).getTime();
    if (isExpired) {
      const updated = list.map(r => (r.id === id ? { ...r, status: 'expired' as const } : r));
      pendingRegistrationsRef.current = updated;
      setPendingRegistrations(updated);
      return { success: false, message: 'Registration has expired.' };
    }

    if (!target.emailVerified) {
      return { success: false, message: 'Cannot verify registration: email address has not been verified yet.' };
    }

    let createdUser: User;
    try {
      createdUser = await createUser({
        name: target.fullName,
        firstName: target.firstName,
        middleName: target.middleName,
        lastName: target.lastName,
        email: target.email,
        role: target.role,
        department: target.department,
        collegeId: target.collegeId,
        collegeName: target.collegeName,
        studentId: target.studentId,
        password: target.password,
        verificationStatus: 'verified',
        emailVerified: true,
        registeredAt: target.registeredAt,
        verificationExpiresAt: target.expiresAt,
      });
    } catch (_) {
      createdUser = {
        id: `usr-${Date.now()}`,
        name: target.fullName,
        firstName: target.firstName,
        middleName: target.middleName,
        lastName: target.lastName,
        email: target.email,
        role: target.role,
        department: target.department,
        collegeId: target.collegeId,
        collegeName: target.collegeName,
        studentId: target.studentId,
        password: target.password,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: target.role === 'student' ? 'Undergraduate Student' : 'Instructor',
        verificationStatus: 'verified',
        emailVerified: true,
        registeredAt: target.registeredAt,
        verificationExpiresAt: target.expiresAt,
        schoolYear: target.schoolYear || (target.collegeId ? getActiveSchoolYearForCollege(target.collegeId)?.year : undefined) || getActiveSchoolYearForCollege('col-ccs')?.year || '2025-2026',
        enrolledCourseIds: [],
      };
      setDb(prev => ({
        ...prev,
        users: [...prev.users, createdUser],
      }));
    }

    const verifyUpdated = (pendingRegistrationsRef.current || pendingRegistrations).map(r =>
      r.id === id ? { ...r, status: 'verified' as const } : r
    );
    pendingRegistrationsRef.current = verifyUpdated;
    setPendingRegistrations(verifyUpdated);

    return {
      success: true,
      message: 'User registration approved and active account created.',
      user: createdUser,
    };
  };

  const rejectRegistration = async (id: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    const rejectUpdated = (pendingRegistrationsRef.current || pendingRegistrations).map(r =>
      r.id === id ? { ...r, status: 'rejected' as const } : r
    );
    pendingRegistrationsRef.current = rejectUpdated;
    setPendingRegistrations(rejectUpdated);
    return {
      success: true,
      message: reason ? `Registration rejected: ${reason}` : 'Registration rejected.',
    };
  };

  const purgeExpiredRegistrations = async (): Promise<number> => {
    const now = Date.now();
    const currentList = pendingRegistrationsRef.current || pendingRegistrations;
    let count = 0;
    const updated = currentList.map(reg => {
      if (reg.status === 'pending' && new Date(reg.expiresAt).getTime() <= now) {
        count++;
        return { ...reg, status: 'expired' as const };
      }
      return reg;
    });
    if (count > 0) {
      setPendingRegistrations(updated);
    }
    return count;
  };

  // Automatically purge expired registrations when context initializes
  useEffect(() => {
    void purgeExpiredRegistrations();
  }, []);

  const transferLeadership = async (
    roleType: 'dean' | 'chairperson',
    currentLeaderId: string,
    successorId: string,
    unitId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (currentLeaderId === successorId) {
      return { success: false, message: 'Predecessor and successor cannot be the same user.' };
    }

    const targetCol = roleType === 'dean' ? colleges.find(c => c.id === unitId) : undefined;
    const targetDept = roleType === 'chairperson' ? departments.find(d => d.id === unitId) : undefined;

    // Atomically update db.users: predecessor to faculty, successor to admin with adminSubrole & unit metadata
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id === currentLeaderId) {
          return {
            ...u,
            role: 'faculty' as UserRole,
            adminSubrole: undefined,
          };
        }
        if (u.id === successorId) {
          return {
            ...u,
            role: 'admin' as UserRole,
            adminSubrole: roleType,
            ...(roleType === 'dean'
              ? { collegeId: unitId, collegeName: targetCol?.name }
              : { department: targetDept?.name || u.department || '', collegeId: targetDept?.collegeId }),
          };
        }
        return u;
      }),
    }));

    // Update active user session if leader or successor is currently logged in
    setCurrentUser(prev => {
      if (!prev) return prev;
      if (prev.id === currentLeaderId) {
        return { ...prev, role: 'faculty' as UserRole, adminSubrole: undefined };
      }
      if (prev.id === successorId) {
        return {
          ...prev,
          role: 'admin' as UserRole,
          adminSubrole: roleType,
          ...(roleType === 'dean'
            ? { collegeId: unitId, collegeName: targetCol?.name }
            : { department: targetDept?.name || prev.department || '', collegeId: targetDept?.collegeId }),
        };
      }
      return prev;
    });

    // Single-seat invariant in colleges and departments: assign successor to unitId,
    // clear previous unit held by currentLeaderId if different, and vacate cross-unit assignments.
    if (roleType === 'dean') {
      setColleges(prev => {
        const next = prev.map(c => {
          if (c.id === unitId) return { ...c, deanId: successorId };
          if (c.deanId === currentLeaderId) return { ...c, deanId: undefined };
          if (c.deanId === successorId && c.id !== unitId) return { ...c, deanId: undefined };
          return c;
        });
        safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(next));
        return next;
      });
      setDepartments(prev => {
        const hasMatch = prev.some(d => d.chairpersonId === successorId);
        if (!hasMatch) return prev;
        const next = prev.map(d => {
          if (d.chairpersonId === successorId) return { ...d, chairpersonId: undefined };
          return d;
        });
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
        return next;
      });
    } else if (roleType === 'chairperson') {
      setDepartments(prev => {
        const next = prev.map(d => {
          if (d.id === unitId) return { ...d, chairpersonId: successorId };
          if (d.chairpersonId === currentLeaderId) return { ...d, chairpersonId: undefined };
          if (d.chairpersonId === successorId && d.id !== unitId) return { ...d, chairpersonId: undefined };
          return d;
        });
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
        return next;
      });
      setColleges(prev => {
        const hasMatch = prev.some(c => c.deanId === successorId);
        if (!hasMatch) return prev;
        const next = prev.map(c => {
          if (c.deanId === successorId) return { ...c, deanId: undefined };
          return c;
        });
        safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(next));
        return next;
      });
    }

    // Best effort API sync if reachable
    try {
      const syncPromises: Promise<any>[] = [];
      if (likhaLmsApi?.users?.updateUser) {
        syncPromises.push(likhaLmsApi.users.updateUser(currentLeaderId, { role: 'faculty' }).catch(() => {}));
        syncPromises.push(likhaLmsApi.users.updateUser(successorId, { role: 'admin' }).catch(() => {}));
      }
      if (likhaLmsApi?.academicStructure) {
        if (roleType === 'dean') {
          syncPromises.push(likhaLmsApi.academicStructure.updateCollege(unitId, { dean_id: successorId }).catch(() => {}));
        } else if (roleType === 'chairperson') {
          syncPromises.push(likhaLmsApi.academicStructure.updateDepartment(unitId, { chairperson_id: successorId }).catch(() => {}));
        }
      }
      if (syncPromises.length > 0) {
        await Promise.allSettled(syncPromises);
      }
    } catch (_) {}

    return {
      success: true,
      message: `Leadership transferred successfully to ${roleType === 'dean' ? 'Dean' : 'Chairperson'} successor.`,
    };
  };

  const addCollege = async (college: College, initialDeanId?: string): Promise<College> => {
    if (currentUser) {
      const isSuperadminOrChancellor = activeRole === 'superadmin' || currentUser.adminSubrole === 'chancellor';
      if (!isSuperadminOrChancellor) {
        const isChair =
          (currentUser.role === 'admin' && currentUser.adminSubrole === 'chairperson') ||
          isChairRole(currentUser, activeRole);
        const isDean =
          (currentUser.role === 'admin' && currentUser.adminSubrole === 'dean') ||
          isDeanRole(currentUser, activeRole);
        if (isChair || isDean) {
          throw new Error('Permission denied: Chairpersons and Deans cannot create academic colleges.');
        }
      }
    }
    const effectiveDeanId = (initialDeanId && initialDeanId.trim() !== '' && initialDeanId !== 'none')
      ? initialDeanId.trim()
      : (initialDeanId === 'none' ? undefined : (college.deanId && college.deanId !== 'none' ? college.deanId : undefined));
    const hasDean = Boolean(effectiveDeanId);

    const existingInState = colleges.find(
      c => c.id === college.id || (c.code && college.code && c.code.toLowerCase() === college.code.toLowerCase())
    );
    let predecessorId = existingInState?.deanId && existingInState.deanId !== effectiveDeanId ? existingInState.deanId : undefined;

    const targetCollege: College = { ...college };
    if (hasDean && effectiveDeanId) {
      targetCollege.deanId = effectiveDeanId;
    } else {
      delete targetCollege.deanId;
    }

    setColleges(prev => {
      const existing = prev.find(
        c => c.id === college.id || (c.code && college.code && c.code.toLowerCase() === college.code.toLowerCase())
      );
      if (existing?.deanId && existing.deanId !== effectiveDeanId) {
        predecessorId = existing.deanId;
      }

      let nextColleges: College[];
      if (existing) {
        nextColleges = prev.map(c => {
          if (c.id === college.id || (c.code && college.code && c.code.toLowerCase() === college.code.toLowerCase())) {
            return { ...c, ...targetCollege };
          }
          if (hasDean && c.deanId === effectiveDeanId) {
            return { ...c, deanId: undefined };
          }
          return c;
        });
      } else {
        const cleanedPrev = prev.map(c => (hasDean && c.deanId === effectiveDeanId ? { ...c, deanId: undefined } : c));
        nextColleges = [...cleanedPrev, targetCollege];
      }
      safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(nextColleges));
      return nextColleges;
    });

    if (hasDean && effectiveDeanId) {
      // Vacate any prior leadership seat held by effectiveDeanId in any department
      setDepartments(prev => {
        const hasMatch = prev.some(d => d.chairpersonId === effectiveDeanId);
        if (!hasMatch) return prev;
        const nextDepts = prev.map(d => (d.chairpersonId === effectiveDeanId ? { ...d, chairpersonId: undefined } : d));
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(nextDepts));
        return nextDepts;
      });

      // Update db.users: promote candidate, step predecessor down if any
      setDb(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (predecessorId && u.id === predecessorId) {
            return {
              ...u,
              role: 'faculty' as UserRole,
              adminSubrole: undefined,
            };
          }
          if (u.id === effectiveDeanId) {
            return {
              ...u,
              role: 'admin' as UserRole,
              adminSubrole: 'dean',
              collegeId: college.id,
              collegeName: college.name,
            };
          }
          return u;
        }),
      }));

      // Update currentUser session if candidate or predecessor is active
      setCurrentUser(prev => {
        if (!prev) return prev;
        if (predecessorId && prev.id === predecessorId) {
          return { ...prev, role: 'faculty' as UserRole, adminSubrole: undefined };
        }
        if (prev.id === effectiveDeanId) {
          return {
            ...prev,
            role: 'admin' as UserRole,
            adminSubrole: 'dean',
            collegeId: college.id,
            collegeName: college.name,
          };
        }
        return prev;
      });

      // Best effort API sync if reachable
      try {
        const syncPromises = [
          likhaLmsApi.users.updateUser(effectiveDeanId, { role: 'admin' }),
        ];
        if (predecessorId) {
          syncPromises.push(likhaLmsApi.users.updateUser(predecessorId, { role: 'faculty' }));
        }
        await Promise.allSettled(syncPromises);
      } catch (_) {}
    }

    // Best effort Likha ERP academicStructure sync
    try {
      if (likhaLmsApi?.academicStructure) {
        if (existingInState) {
          await likhaLmsApi.academicStructure.updateCollege(targetCollege.id, {
            name: targetCollege.name,
            code: targetCollege.code,
            dean_id: effectiveDeanId || null,
          }).catch(() => {});
        } else {
          const remoteCol = await likhaLmsApi.academicStructure.createCollege({
            id: targetCollege.id,
            name: targetCollege.name,
            code: targetCollege.code,
            dean_id: effectiveDeanId || null,
          }).catch(() => null);

          if (remoteCol && remoteCol.id && remoteCol.id !== targetCollege.id) {
            const oldId = targetCollege.id;
            targetCollege.id = String(remoteCol.id);
            setColleges(prev => {
              const updated = prev.map(c => (c.id === oldId || (c.code && targetCollege.code && c.code.toLowerCase() === targetCollege.code.toLowerCase()) ? { ...c, id: targetCollege.id } : c));
              safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
    } catch (_) {}

    return targetCollege;
  };

  const addDepartment = async (department: Department, initialChairId?: string): Promise<Department> => {
    if (currentUser) {
      const isSuperadminOrChancellor = activeRole === 'superadmin' || currentUser.adminSubrole === 'chancellor';
      if (!isSuperadminOrChancellor) {
        const isChair =
          (currentUser.role === 'admin' && currentUser.adminSubrole === 'chairperson') ||
          isChairRole(currentUser, activeRole);
        if (isChair) {
          throw new Error('Permission denied: Program Chairpersons cannot create academic programs.');
        }
      }
    }
    const effectiveChairId = (initialChairId && initialChairId.trim() !== '' && initialChairId !== 'none')
      ? initialChairId.trim()
      : (initialChairId === 'none' ? undefined : (department.chairpersonId && department.chairpersonId !== 'none' ? department.chairpersonId : undefined));
    const hasChair = Boolean(effectiveChairId);

    const existingInState = departments.find(
      d => d.id === department.id || (d.collegeId === department.collegeId && d.code && department.code && d.code.toLowerCase() === department.code.toLowerCase())
    );
    let predecessorId = existingInState?.chairpersonId && existingInState.chairpersonId !== effectiveChairId ? existingInState.chairpersonId : undefined;

    const targetDept: Department = { ...department, name: normalizeProgramName(department.name) };
    if (hasChair && effectiveChairId) {
      targetDept.chairpersonId = effectiveChairId;
    } else {
      delete targetDept.chairpersonId;
    }

    setDepartments(prev => {
      const existing = prev.find(
        d => d.id === department.id || (d.collegeId === department.collegeId && d.code && department.code && d.code.toLowerCase() === department.code.toLowerCase())
      );
      if (existing?.chairpersonId && existing.chairpersonId !== effectiveChairId) {
        predecessorId = existing.chairpersonId;
      }

      let nextDepts: Department[];
      if (existing) {
        nextDepts = prev.map(d => {
          if (d.id === department.id || (d.collegeId === department.collegeId && d.code && department.code && d.code.toLowerCase() === department.code.toLowerCase())) {
            return { ...d, ...targetDept };
          }
          if (hasChair && d.chairpersonId === effectiveChairId) {
            return { ...d, chairpersonId: undefined };
          }
          return d;
        });
      } else {
        const cleanedPrev = prev.map(d => (hasChair && d.chairpersonId === effectiveChairId ? { ...d, chairpersonId: undefined } : d));
        nextDepts = [...cleanedPrev, targetDept];
      }
      safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(nextDepts));
      return nextDepts;
    });

    if (hasChair && effectiveChairId) {
      // Vacate any prior leadership seat held by effectiveChairId in any college
      setColleges(prev => {
        const hasMatch = prev.some(c => c.deanId === effectiveChairId);
        if (!hasMatch) return prev;
        const nextColleges = prev.map(c => (c.deanId === effectiveChairId ? { ...c, deanId: undefined } : c));
        safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(nextColleges));
        return nextColleges;
      });

      // Update db.users: promote candidate, step predecessor down if any
      setDb(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (predecessorId && u.id === predecessorId) {
            return {
              ...u,
              role: 'faculty' as UserRole,
              adminSubrole: undefined,
            };
          }
          if (u.id === effectiveChairId) {
            return {
              ...u,
              role: 'admin' as UserRole,
              adminSubrole: 'chairperson',
              collegeId: department.collegeId,
              department: department.name,
            };
          }
          return u;
        }),
      }));

      // Update currentUser session if candidate or predecessor is active
      setCurrentUser(prev => {
        if (!prev) return prev;
        if (predecessorId && prev.id === predecessorId) {
          return { ...prev, role: 'faculty' as UserRole, adminSubrole: undefined };
        }
        if (prev.id === effectiveChairId) {
          return {
            ...prev,
            role: 'admin' as UserRole,
            adminSubrole: 'chairperson',
            collegeId: department.collegeId,
            department: department.name,
          };
        }
        return prev;
      });

      // Best effort API sync if reachable
      try {
        const syncPromises = [
          likhaLmsApi.users.updateUser(effectiveChairId, { role: 'admin' }),
        ];
        if (predecessorId) {
          syncPromises.push(likhaLmsApi.users.updateUser(predecessorId, { role: 'faculty' }));
        }
        await Promise.allSettled(syncPromises);
      } catch (_) {}
    }

    // Best effort Likha ERP academicStructure sync
    try {
      if (likhaLmsApi?.academicStructure) {
        if (existingInState) {
          await likhaLmsApi.academicStructure.updateDepartment(targetDept.id, {
            college_id: targetDept.collegeId,
            name: targetDept.name,
            code: targetDept.code,
            chairperson_id: effectiveChairId || null,
          }).catch(() => {});
        } else {
          let syncCollegeId = targetDept.collegeId;
          const parentCollege = colleges.find(
            c => c.id === targetDept.collegeId || (c.code && targetDept.collegeId && c.code.toLowerCase() === targetDept.collegeId.toLowerCase())
          );
          if (parentCollege && isValidUuid(parentCollege.id)) {
            syncCollegeId = parentCollege.id;
          }

          const remoteDept = await likhaLmsApi.academicStructure.createDepartment({
            id: targetDept.id,
            college_id: syncCollegeId,
            name: targetDept.name,
            code: targetDept.code,
            chairperson_id: effectiveChairId || null,
          }).catch(() => null);

          if (remoteDept && remoteDept.id && remoteDept.id !== targetDept.id) {
            const oldId = targetDept.id;
            targetDept.id = String(remoteDept.id);
            setDepartments(prev => {
              const updated = prev.map(d => (d.id === oldId || (d.collegeId === targetDept.collegeId && d.code && targetDept.code && d.code.toLowerCase() === targetDept.code.toLowerCase()) ? { ...d, id: targetDept.id } : d));
              safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
    } catch (_) {}

    return targetDept;
  };

  const getDepartmentDeleteBlockers = (departmentId: string): string[] => {
    const dept = departments.find(d => d.id === departmentId);
    if (!dept) return ['Program not found.'];
    const blockers: string[] = [];

    // 1. Leader check
    if (dept.chairpersonId && dept.chairpersonId !== 'none') {
      const chair = db.users.find(u => u.id === dept.chairpersonId);
      const chairName = chair?.name || chair?.email || 'an active program chairperson';
      blockers.push(`Program has an assigned Program Chairperson (${chairName}).`);
    }

    // 2. Affiliated users check
    const affiliatedUsers = db.users.filter(u => {
      const uDept = u.department?.trim().toLowerCase();
      const uProg = u.program?.trim().toLowerCase();
      const deptName = dept.name?.trim().toLowerCase();
      const deptCode = dept.code?.trim().toLowerCase();
      return (
        (uDept && (uDept === deptName || uDept === deptCode)) ||
        (uProg && (uProg === deptName || uProg === deptCode)) ||
        (u as any).departmentId === dept.id ||
        (u as any).programId === dept.id
      );
    });
    if (affiliatedUsers.length > 0) {
      blockers.push(`Program has ${affiliatedUsers.length} affiliated or enrolled user(s).`);
    }

    // 3. Pending registrations check
    const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
    const affiliatedPending = pendingList.filter(p => {
      const pDept = p.department?.trim().toLowerCase();
      const pProg = p.program?.trim().toLowerCase();
      const deptName = dept.name?.trim().toLowerCase();
      const deptCode = dept.code?.trim().toLowerCase();
      return (
        p.status !== 'rejected' &&
        p.status !== 'expired' &&
        ((pDept && (pDept === deptName || pDept === deptCode)) ||
         (pProg && (pProg === deptName || pProg === deptCode)))
      );
    });
    if (affiliatedPending.length > 0) {
      blockers.push(`Program has ${affiliatedPending.length} pending user registration(s).`);
    }

    return blockers;
  };

  const getCollegeDeleteBlockers = (collegeId: string): string[] => {
    const col = colleges.find(c => c.id === collegeId);
    if (!col) return ['College not found.'];
    const blockers: string[] = [];

    // 1. Dean check
    if (col.deanId && col.deanId !== 'none') {
      const dean = db.users.find(u => u.id === col.deanId);
      const deanName = dean?.name || dean?.email || 'an active Dean';
      blockers.push(`College has an assigned Dean (${deanName}).`);
    }

    // 2. Child programs chairperson check
    const childDepts = departments.filter(d => d.collegeId === collegeId);
    for (const d of childDepts) {
      if (d.chairpersonId && d.chairpersonId !== 'none') {
        const chair = db.users.find(u => u.id === d.chairpersonId);
        const chairName = chair?.name || chair?.email || d.chairpersonId;
        blockers.push(`Program "${d.name}" has an assigned Program Chairperson (${chairName}).`);
      }
    }

    // 3. Affiliated users check across college and child programs
    const colName = col.name?.trim().toLowerCase();
    const colCode = col.code?.trim().toLowerCase();
    const childDeptNames = childDepts.map(d => d.name?.trim().toLowerCase()).filter(Boolean);
    const childDeptCodes = childDepts.map(d => d.code?.trim().toLowerCase()).filter(Boolean);

    const affiliatedUsers = db.users.filter(u => {
      if (u.collegeId === col.id) return true;
      if (u.collegeName && u.collegeName.trim().toLowerCase() === colName) return true;
      const uDept = u.department?.trim().toLowerCase();
      const uProg = u.program?.trim().toLowerCase();
      if (uDept) {
        if (uDept === colName || uDept === colCode) return true;
        if (childDeptNames.includes(uDept) || childDeptCodes.includes(uDept)) return true;
      }
      if (uProg) {
        if (uProg === colName || uProg === colCode) return true;
        if (childDeptNames.includes(uProg) || childDeptCodes.includes(uProg)) return true;
      }
      if ((u as any).departmentId && childDepts.some(d => d.id === (u as any).departmentId)) return true;
      if ((u as any).programId && childDepts.some(d => d.id === (u as any).programId)) return true;
      return false;
    });

    if (affiliatedUsers.length > 0) {
      blockers.push(`College or its programs have ${affiliatedUsers.length} affiliated or enrolled user(s).`);
    }

    // 4. Pending registrations check
    const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
    const affiliatedPending = pendingList.filter(p => {
      if (p.status === 'rejected' || p.status === 'expired') return false;
      if (p.collegeId === col.id) return true;
      if (p.collegeName && p.collegeName.trim().toLowerCase() === colName) return true;
      const pDept = p.department?.trim().toLowerCase();
      const pProg = p.program?.trim().toLowerCase();
      if (pDept) {
        if (pDept === colName || pDept === colCode) return true;
        if (childDeptNames.includes(pDept) || childDeptCodes.includes(pDept)) return true;
      }
      if (pProg) {
        if (pProg === colName || pProg === colCode) return true;
        if (childDeptNames.includes(pProg) || childDeptCodes.includes(pProg)) return true;
      }
      return false;
    });

    if (affiliatedPending.length > 0) {
      blockers.push(`College has ${affiliatedPending.length} pending user registration(s).`);
    }

    return blockers;
  };

  const deleteDepartment = async (departmentId: string): Promise<{ success: boolean; message: string; blockers?: string[] }> => {
    const targetDept = departments.find(d => d.id === departmentId);
    if (!targetDept) {
      return { success: false, message: 'Program not found.' };
    }

    if (currentUser) {
      const isSuperadminOrChancellor = activeRole === 'superadmin' || currentUser.adminSubrole === 'chancellor';
      const isDean = (currentUser.role === 'admin' && currentUser.adminSubrole === 'dean') || isDeanRole(currentUser, activeRole);

      if (!isSuperadminOrChancellor && !isDean) {
        return { success: false, message: 'Permission denied: Only Administrators and Deans can delete academic programs.' };
      }

      if (isDean && !isSuperadminOrChancellor) {
        const deanColId = currentUser.collegeId || colleges.find(c => c.deanId === currentUser.id || (currentUser.collegeName && c.name?.toLowerCase() === currentUser.collegeName.toLowerCase()))?.id;
        if (!deanColId || targetDept.collegeId !== deanColId) {
          return { success: false, message: 'Permission denied: Deans can only delete programs within their assigned college.' };
        }
      }
    }

    const blockers = getDepartmentDeleteBlockers(departmentId);
    if (blockers.length > 0) {
      return {
        success: false,
        message: 'Cannot delete program while it has assigned leaders or affiliated users.',
        blockers,
      };
    }

    setDepartments(prev => {
      const next = prev.filter(d => d.id !== departmentId);
      safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
      return next;
    });

    try {
      if (likhaLmsApi?.academicStructure?.deleteDepartment) {
        await likhaLmsApi.academicStructure.deleteDepartment(targetDept.id).catch(() => {});
      }
    } catch (_) {}

    return {
      success: true,
      message: `Program "${targetDept.name}" (${targetDept.code}) was deleted successfully.`,
    };
  };

  const addProgram = addDepartment;
  const deleteProgram = deleteDepartment;
  const getProgramDeleteBlockers = getDepartmentDeleteBlockers;

  const deleteCollege = async (collegeId: string): Promise<{ success: boolean; message: string; blockers?: string[] }> => {
    const targetCollege = colleges.find(c => c.id === collegeId);
    if (!targetCollege) {
      return { success: false, message: 'College not found.' };
    }

    if (currentUser) {
      const isSuperadminOrChancellor = activeRole === 'superadmin' || currentUser.adminSubrole === 'chancellor';
      if (!isSuperadminOrChancellor) {
        return { success: false, message: 'Permission denied: Only University Administrators and the Chancellor can delete academic colleges.' };
      }
    }

    const blockers = getCollegeDeleteBlockers(collegeId);
    if (blockers.length > 0) {
      return {
        success: false,
        message: 'Cannot delete college while it or its programs have assigned leaders or affiliated users.',
        blockers,
      };
    }

    const childDepts = departments.filter(d => d.collegeId === collegeId);

    setColleges(prev => {
      const next = prev.filter(c => c.id !== collegeId);
      safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(next));
      return next;
    });

    if (childDepts.length > 0) {
      setDepartments(prev => {
        const next = prev.filter(d => d.collegeId !== collegeId);
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
        return next;
      });
    }

    try {
      if (likhaLmsApi?.academicStructure) {
        for (const child of childDepts) {
          if (likhaLmsApi.academicStructure.deleteDepartment) {
            await likhaLmsApi.academicStructure.deleteDepartment(child.id).catch(() => {});
          }
        }
        if (likhaLmsApi.academicStructure.deleteCollege) {
          await likhaLmsApi.academicStructure.deleteCollege(targetCollege.id).catch(() => {});
        }
      }
    } catch (_) {}

    const deptSuffix = childDepts.length > 0 ? ` along with ${childDepts.length} department(s)` : '';
    return {
      success: true,
      message: `College "${targetCollege.name}" (${targetCollege.code})${deptSuffix} was deleted successfully.`,
    };
  };

  const getSchoolYearsByCollege = useCallback(
    (_collegeId?: string): SchoolYear[] => {
      const list = schoolYearsRef.current || schoolYears;
      // All school years created by Admin (or assigned to this college) are accessible throughout all colleges
      return list;
    },
    [schoolYears]
  );

  const getActiveSchoolYearForCollege = useCallback(
    (collegeId: string): SchoolYear | undefined => {
      const list = schoolYearsRef.current || schoolYears;
      const activeYearName = collegeActiveSYRef.current?.[collegeId] || collegeActiveSchoolYears?.[collegeId];
      if (activeYearName) {
        const found = list.find(sy => sy.year.trim().toLowerCase() === activeYearName.trim().toLowerCase());
        if (found) return { ...found, isActive: true };
      }
      // If college has no explicit active year recorded, default to 2025-2026 so admin baseline changes
      // do not inadvertently roll over colleges without Dean action
      const initialDefault = list.find(sy => sy.year === '2025-2026') || list.find(sy => sy.isActive) || list[0];
      return initialDefault ? { ...initialDefault, isActive: true } : undefined;
    },
    [schoolYears, collegeActiveSchoolYears]
  );

  const getBaselineSchoolYear = useCallback((): SchoolYear | undefined => {
    const list = schoolYearsRef.current || schoolYears;
    const found = list.find(sy => !sy.collegeId && sy.isActive);
    return found || list.find(sy => sy.isActive) || list[0];
  }, [schoolYears]);

  const setBaselineSchoolYear = async (
    schoolYearIdOrYear: string
  ): Promise<{ success: boolean; message?: string }> => {
    const list = schoolYearsRef.current || schoolYears;
    const target = list.find(
      sy => sy.id === schoolYearIdOrYear || sy.year.trim().toLowerCase() === schoolYearIdOrYear.trim().toLowerCase()
    );
    if (!target) {
      return { success: false, message: 'School year not found.' };
    }

    // Set the new baseline active flag across universal school years
    setSchoolYears(prev => {
      const next = prev.map(sy => {
        if (!sy.collegeId) {
          return { ...sy, isActive: sy.id === target.id || sy.year === target.year };
        }
        return sy;
      });
      schoolYearsRef.current = next;
      safeSetLocalStorage(STORAGE_KEY_SCHOOL_YEARS, JSON.stringify(next));
      return next;
    });

    // Sync with Likha ERP if possible
    if (likhaLmsApi?.academicStructure?.updateSchoolYear) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.id)) {
          await likhaLmsApi.academicStructure.updateSchoolYear(target.id, { is_active: true }).catch(() => {});
        }
        for (const item of list) {
          if (item.id !== target.id && item.isActive && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
            await likhaLmsApi.academicStructure.updateSchoolYear(item.id, { is_active: false }).catch(() => {});
          }
        }
      } catch {}
    }

    return {
      success: true,
      message: `University-Wide Default Baseline Academic Year updated to ${target.year}.`,
    };
  };

  const addSchoolYear = async (
    collegeIdOrYear: string,
    yearMaybe?: string
  ): Promise<{ success: boolean; message?: string }> => {
    // School years created by admin can be passed as (year) or (collegeId, year)
    const hasCollege = Boolean(yearMaybe);
    const collegeId = hasCollege ? collegeIdOrYear : undefined;
    const yearToUse = (yearMaybe || collegeIdOrYear).trim();
    const list = schoolYearsRef.current || schoolYears;
    const existing = list.find(
      sy => (collegeId ? (sy.collegeId === collegeId || !sy.collegeId) : true) &&
            sy.year.toLowerCase() === yearToUse.toLowerCase()
    );
    if (existing) {
      return { success: false, message: `School year "${yearToUse}" already exists.` };
    }

    const hasActive = list.some(sy => (collegeId ? sy.collegeId === collegeId : true) && sy.isActive);
    const newSY: SchoolYear = {
      id: `sy-${collegeId || 'univ'}-${yearToUse.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now().toString(36)}`,
      collegeId,
      year: yearToUse,
      isActive: !hasActive, // Make active if none exists yet
      createdAt: new Date().toISOString(),
    };

    setSchoolYears(prev => {
      const next = [...prev, newSY];
      schoolYearsRef.current = next;
      safeSetLocalStorage(STORAGE_KEY_SCHOOL_YEARS, JSON.stringify(next));
      return next;
    });

    return { success: true, message: `School year "${yearToUse}" added successfully.` };
  };

  const setActiveSchoolYear = async (
    collegeId: string,
    schoolYearIdOrYear: string
  ): Promise<{ success: boolean; message?: string }> => {
    const list = schoolYearsRef.current || schoolYears;
    const target = list.find(
      sy => sy.id === schoolYearIdOrYear || sy.year.toLowerCase() === schoolYearIdOrYear.toLowerCase()
    );
    if (!target) {
      return { success: false, message: 'School year not found.' };
    }

    const baseline = getBaselineSchoolYear();
    if (baseline && target.year.trim().toLowerCase() !== baseline.year.trim().toLowerCase()) {
      return {
        success: false,
        message: `Colleges can only roll over to the current university baseline academic year (SY ${baseline.year}).`,
      };
    }

    // Rollover: Set the target school year as the active school year for this college
    setCollegeActiveSchoolYears(prev => {
      const next = { ...prev, [collegeId]: target.year };
      safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SY, JSON.stringify(next));
      return next;
    });

    // Also update isActive flag in schoolYears list only for college-scoped setups if any
    setSchoolYears(prev => {
      const next = prev.map(sy => {
        if (sy.collegeId && sy.collegeId === collegeId) {
          return { ...sy, isActive: sy.id === target.id || sy.year === target.year };
        }
        return sy;
      });
      schoolYearsRef.current = next;
      safeSetLocalStorage(STORAGE_KEY_SCHOOL_YEARS, JSON.stringify(next));
      return next;
    });

    // Auto-increment student year levels and collegiate personnel teaching experience for matching college
    setDb(prev => {
      const updatedUsers = (prev.users || []).map(u => {
        const matchesCollege = u.collegeId === collegeId || (!u.collegeId && collegeId === 'col-ccs');
        if (u.role === 'student' && matchesCollege) {
          return {
            ...u,
            yearLevel: Math.min(4, (u.yearLevel ?? 1) + 1),
          };
        }
        if (u.role !== 'student' && matchesCollege) {
          return {
            ...u,
            yearsOfTeaching: (u.yearsOfTeaching ?? 0) + 1,
          };
        }
        return u;
      });
      const nextDb = { ...prev, users: updatedUsers };
      safeSetLocalStorage(STORAGE_KEY_DB, JSON.stringify(nextDb));
      return nextDb;
    });

    // Update currentUser if affected
    setCurrentUser(prev => {
      if (!prev) return prev;
      const matchesCollege = prev.collegeId === collegeId || (!prev.collegeId && collegeId === 'col-ccs');
      if (prev.role === 'student' && matchesCollege) {
        return {
          ...prev,
          yearLevel: Math.min(4, (prev.yearLevel ?? 1) + 1),
        };
      }
      if (prev.role !== 'student' && matchesCollege) {
        return {
          ...prev,
          yearsOfTeaching: (prev.yearsOfTeaching ?? 0) + 1,
        };
      }
      return prev;
    });

    return { success: true, message: `College rolled over to school year "${target.year}".` };
  };

  const joinCourseByCode = async (code: string): Promise<{ success: boolean; message: string; course?: Course }> => {
    const cleanCode = code.trim().toUpperCase();
    // Likha rows carry join_code (cached courses may predate the joinCode
    // mapping), so match both spellings.
    const targetCourse = db.courses.find(
      c => (((c.joinCode || (c as unknown as { join_code?: string }).join_code) || '').toUpperCase() === cleanCode)
    );

    const currentEnrolled = activeUser.enrolledCourseIds || [];
    if (targetCourse && currentEnrolled.includes(targetCourse.id)) {
      return {
        success: false,
        message: `You are already enrolled in ${targetCourse.code} (${targetCourse.title}).`,
        course: targetCourse
      };
    }

    const existingPending = targetCourse
      ? (db.enrollmentRequests || []).find(
        r => r.studentId === activeUser.id && r.courseId === targetCourse.id && r.status === 'pending'
      )
      : undefined;
    if (targetCourse && existingPending) {
      return {
        success: false,
        message: `You already have a pending join request for ${targetCourse.code}.`,
        course: targetCourse
      };
    }

    // Likha ERP is the source of truth for the code (the course may not be in
    // the local cache); the success shape stays { success, message, course? }.
    try {
      let courseId = targetCourse?.id;
      if (!courseId) {
        // Not cached locally — resolve the code through Likha ERP.
        const courses = await likhaLmsApi.courses.getCourses();
        const match = (courses || []).find(
          (c: any) => (((c.join_code || c.joinCode) || '').toUpperCase() === cleanCode)
        );
        if (!match) {
          return { success: false, message: `No course found matching code "${cleanCode}". Please verify with your instructor.` };
        }
        courseId = String(match.id);
      }
      const row = await likhaLmsApi.requests.createRequest({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'self_join',
        status: 'pending'
      });
      const request = mapLikhaRequestRow({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'self_join',
        status: 'pending',
        requested_at: new Date().toISOString(),
        ...(row as any)
      });
      setDb(prev => mergeEnrollmentRequest(prev, request));

      return {
        success: true,
        message: targetCourse
          ? `Join request sent for ${targetCourse.code} - ${targetCourse.title}. Waiting for instructor approval.`
          : `Join request sent for code "${cleanCode}". Waiting for instructor approval.`,
        course: targetCourse
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send join request.';
      setLastError(message);
      return { success: false, message };
    }
  };

  const regenerateCourseJoinCode = async (courseId: string): Promise<string> => {
    const targetCourse = db.courses.find(c => c.id === courseId);
    const newCode = generateCourseJoinCode(db.courses, targetCourse?.code);
    // Client generates the code string; Likha ERP persists it via PATCH.
    try {
      const row = await likhaLmsApi.courses.updateCourse(courseId, { join_code: newCode });
      const resolved = (row as any)?.join_code || newCode;
      setDb(prev => ({
        ...prev,
        courses: prev.courses.map(c => (c.id === courseId ? { ...c, joinCode: resolved } : c))
      }));
      return resolved;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to regenerate join code.';
      setLastError(message);
      showAlert(message, 'Regenerate Failed');
      return targetCourse?.joinCode || newCode;
    }
  };

  const applySyllabusEnvelope = (courseId: string, envelope: SyllabusRevisionResponse): void => {
    const boundSyllabus: OfficialSyllabusData = { ...envelope.syllabus, courseId };
    const instructorFromSyllabus = boundSyllabus.facultyMembers?.[0]?.name;
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? {
        ...c,
        syllabus: boundSyllabus,
        ...(instructorFromSyllabus ? { instructorName: instructorFromSyllabus } : {})
      } : c))
    }));
    setSyllabusRevisions(prev => ({ ...prev, [courseId]: envelope.revision }));
  };

  const clearSyllabusRevision = (courseId: string): void => {
    setSyllabusRevisions(prev => {
      if (!(courseId in prev)) return prev;
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  const isRevisionConflict = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 409 || err.code === 'revision_conflict');

  const recoverSyllabusFromPublished = async (courseId: string): Promise<void> => {
    try {
      const envelope = await syllabusApi.getPublished(courseId);
      if (envelope) applySyllabusEnvelope(courseId, envelope);
      else clearSyllabusRevision(courseId);
    } catch {
      return;
    }
  };

  const failSyllabus = (err: unknown, fallback: string, title: string): never => {
    const message = err instanceof ApiError ? err.message : fallback;
    setLastError(message);
    showAlert(message, title);
    throw err;
  };

  const syllabusSectionEntries = (syllabus: OfficialSyllabusData): Array<[SyllabusSectionKey, unknown]> => {
    const entries: Array<[SyllabusSectionKey, unknown]> = [
      ['institution', syllabus.institution],
      ['courseInfo', syllabus.courseInfo],
      ['faculty', syllabus.facultyMembers],
      ['institutionalStatements', syllabus.institutionalStatements],
      ['programOutcomes', syllabus.programOutcomes],
      ['courseOutcomes', syllabus.courseOutcomes],
      ['requirements', syllabus.courseRequirements],
      ['gradingSystem', syllabus.gradingSystem],
      ['rubrics', syllabus.projectRubrics],
      ['policies', syllabus.classroomPolicies],
      ['outline', syllabus.courseOutline],
      ['learningPlan', syllabus.learningPlan],
      ['courseMap', syllabus.courseMap],
      ['references', syllabus.references],
      ['signatories', syllabus.signatories],
    ];
    if (syllabus.sourceDocument !== undefined) entries.push(['sourceDocument', syllabus.sourceDocument]);
    return entries.filter(([, value]) => value !== undefined);
  };

  const updateCourseSyllabus = async (courseId: string, syllabus: OfficialSyllabusData): Promise<void> => {
    const boundSyllabus: OfficialSyllabusData = {
      ...syllabus,
      courseId
    };
    let draftId: string | null = null;
    try {
      const active = syllabusRevisionsRef.current[courseId] ?? null;
      let sourceId: string | undefined = active?.id;
      if (!sourceId) {
        const current = await syllabusApi.getPublished(courseId);
        sourceId = current?.revision.id;
      }
      let envelope = await syllabusApi.createDraft(courseId, sourceId);
      draftId = envelope.revision.id;
      for (const [section, value] of syllabusSectionEntries(boundSyllabus)) {
        envelope = await syllabusApi.updateSection(
          courseId, envelope.revision.id, envelope.revision.rowVersion, section, value
        );
      }
      draftId = null;
      applySyllabusEnvelope(courseId, envelope);
    } catch (err) {
      if (isRevisionConflict(err)) {
        if (draftId) await deleteDraft(courseId, draftId).catch(() => undefined);
        await recoverSyllabusFromPublished(courseId);
      }
      failSyllabus(err, 'Failed to update syllabus.', 'Update Syllabus Failed');
    }
  };

  const removeCourseSyllabus = async (courseId: string): Promise<void> => {
    try {
      await withdrawSyllabus(courseId);
      clearSyllabusRevision(courseId);
      setDb(prev => ({
        ...prev,
        courses: prev.courses.map(c => (c.id === courseId ? { ...c, syllabus: null } : c))
      }));
    } catch (err) {
      failSyllabus(err, 'Failed to remove syllabus.', 'Remove Syllabus Failed');
    }
  };

  const refreshPublishedSyllabus = async (courseId: string): Promise<void> => {
    try {
      const envelope = await syllabusApi.getPublished(courseId);
      if (envelope) applySyllabusEnvelope(courseId, envelope);
      else clearSyllabusRevision(courseId);
    } catch (err) {
      failSyllabus(err, 'Failed to load syllabus.', 'Load Syllabus Failed');
    }
  };

  const updateSyllabusSection = async (courseId: string, section: SyllabusSectionKey, value: unknown): Promise<void> => {
    try {
      let active = syllabusRevisionsRef.current[courseId] ?? null;
      if (!active || active.status !== 'draft') {
        const draft = await syllabusApi.createDraft(courseId, active?.id);
        active = draft.revision;
        setSyllabusRevisions(prev => ({ ...prev, [courseId]: active as SyllabusRevisionHeader }));
      }
      const envelope = await syllabusApi.updateSection(courseId, active.id, active.rowVersion, section, value);
      applySyllabusEnvelope(courseId, envelope);
    } catch (err) {
      if (isRevisionConflict(err)) await recoverSyllabusFromPublished(courseId);
      failSyllabus(err, 'Failed to update syllabus.', 'Update Syllabus Failed');
    }
  };

  const publishSyllabusDraft = async (courseId: string): Promise<void> => {
    const active = syllabusRevisionsRef.current[courseId];
    if (!active || active.status !== 'draft') {
      const message = 'No active syllabus draft for this course.';
      setLastError(message);
      showAlert(message, 'Publish Syllabus Failed');
      throw new Error(message);
    }
    try {
      const envelope = await syllabusApi.publish(courseId, active.id, active.rowVersion);
      applySyllabusEnvelope(courseId, envelope);
    } catch (err) {
      if (isRevisionConflict(err)) await recoverSyllabusFromPublished(courseId);
      failSyllabus(err, 'Failed to publish syllabus.', 'Publish Syllabus Failed');
    }
  };

  const updateCourseGradingTerms = async (courseId: string, gradingTerms: TermId[] | null): Promise<void> => {
    // Server stores the override as a JSON string (null clears to auto-detect);
    // the array/null is sent verbatim and the response row is re-normalized.
    try {
      const row = await likhaLmsApi.courses.updateCourse(courseId, { gradingTerms });
      const terms = normalizeCourseGradingTerms((row as any)?.gradingTerms ?? gradingTerms);
      setDb(prev => ({
        ...prev,
        courses: prev.courses.map(c => (c.id === courseId ? { ...c, gradingTerms: terms } : c))
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update grading terms.';
      setLastError(message);
      showAlert(message, 'Update Grading Terms Failed');
      throw err;
    }
  };

  const setGradesReleased = async (courseId: string, term: TermId, released: boolean): Promise<void> => {
    const prev = db.courses.find(c => c.id === courseId)?.gradesReleased;
    const optimistic = { ...(prev || {}), [term]: released };
    setDb(prevDb => ({
      ...prevDb,
      courses: prevDb.courses.map(c => (c.id === courseId ? { ...c, gradesReleased: optimistic } : c))
    }));
    await likhaLmsApi.courses.updateCourse(courseId, { grades_released: optimistic }).catch(() => {});
    showAlert({
      title: released ? 'Grades Released' : 'Grades Un-released',
      message: `${term} grades are now ${released ? 'visible to students' : 'hidden from students'}.`,
      type: 'success'
    });
  };

  const importCommonsTemplate = async (templateId: string, targetCourseId: string): Promise<{ success: boolean; message: string }> => {
    // Template ships from the static catalog;
    // the module + blueprint item persist via the modules endpoints.
    const tmpl = commonsTemplates.find(t => t.id === templateId);
    const targetCourse = db.courses.find(c => c.id === targetCourseId);

    if (!tmpl || !targetCourse) {
      return { success: false, message: 'Invalid template or course target' };
    }

    try {
      const newMod = await createModule(targetCourseId, `[Imported] ${tmpl.title}`);
      await addModuleItem(newMod.id, {
        title: `${tmpl.title} Blueprint & Rubric Guidelines`,
        type: 'page',
        content: `${tmpl.description}\n\nAlignment: ${tmpl.chedAlignment}\nTags: ${tmpl.tags.join(', ')}`
      });

      return {
        success: true,
        message: `Successfully imported "${tmpl.title}" into ${targetCourse.code} (${targetCourse.section})!`
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to import template.';
      setLastError(message);
      showAlert(message, 'Import Failed');
      return { success: false, message };
    }
  };

  const gradeSubmission = async (
    submissionId: string,
    grade: number,
    rubricScores: Record<string, number>,
    commentText?: string
  ): Promise<void> => {
    // Grade persists via submissions.gradeSubmission (score only — passing the
    // feedback text there too would store it twice: the submissions.feedback
    // column AND the submission_comments row). Feedback rides
    // submissions.addSubmissionComment exactly once (see likhaLmsApi.ts
    // gradeSubmission PATCHes { score, feedback, status, graded_at }).
    try {
      if (!Number.isFinite(grade)) {
        throw new Error('Grade must be a number.');
      }
      // Likha ERP is the source of truth for submissions.
      const saved = await likhaLmsApi.submissions.gradeSubmission(submissionId, grade);
      const criteria = Object.entries(rubricScores || {});
      if (criteria.length > 0) {
        // Grade is already persisted above, so a criterion failure must not
        // roll it back — surface partial success instead of throwing.
        const results = await Promise.allSettled(
          criteria.map(([criterionId, points]) =>
            likhaLmsApi.submissions.addRubricScore(submissionId, criterionId, points)
          )
        );
        if (results.some(r => r.status === 'rejected')) {
          showAlert({
            title: 'Partial Rubric Save',
            message: 'Grade saved; some rubric scores failed to persist.',
            type: 'warning',
          });
        }
      }
      let appended: SubmissionComment | null = null;
      if (commentText && commentText.trim()) {
        const comment = await likhaLmsApi.submissions.addSubmissionComment(
          submissionId,
          activeUser.id,
          commentText.trim()
        );
        appended = normalizeSubmissionComment(
          mapLikhaSubmissionCommentRow(comment, {
            id: activeUser.id,
            name: activeUser.name,
            role: activeUser.role,
          })
        );
      }
      const courseId = dbRef.current.submissions?.find(s => s.id === submissionId)?.courseId;
      const graded = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => ({
        ...prev,
        submissions: prev.submissions.map(sub =>
          sub.id === submissionId
            ? {
                ...graded,
                // Likha echoes the patched row; fall back to the
                // just-submitted values if the row predates the column.
                rubricScores:
                  graded.rubricScores && Object.keys(graded.rubricScores).length > 0
                    ? graded.rubricScores
                    : rubricScores,
                comments: [...(sub.comments ?? []), ...(appended ? [appended] : [])],
              }
            : sub
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to grade submission.';
      setLastError(message);
      showAlert(message, 'Grade Submission Failed');
      throw err;
    }
  };

  const upsertManualExamGrade = async (examId: string, studentId: string, grade: number): Promise<void> => {
    try {
      if (!Number.isFinite(grade) || grade < 0) {
        throw new Error('Grade must be a non-negative number.');
      }
      // Likha ERP is the source of truth: grade the cached submission row,
      // creating it first when the student has not submitted yet.
      const cached = (dbRef.current.submissions || []).find(
        s => (s.examId === examId || s.activityKey === `asg-exam-${examId}`) && s.studentId === studentId
      );
      let targetId = cached?.id;
      let courseId = cached?.courseId;
      if (!targetId) {
        courseId = dbRef.current.exams?.find(e => e.id === examId)?.courseId;
        const created = await likhaLmsApi.submissions.submitAssessment({
          exam_id: examId,
          student_id: studentId,
          answers: {},
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });
        targetId = (created as any)?.id;
        if (!targetId) throw new Error('Failed to save manual exam grade.');
        const seeded = normalizeSubmission(mapLikhaSubmissionRow(created, courseId));
        setDb(prev => ({ ...prev, submissions: [seeded, ...(prev.submissions || [])] }));
      }
      const saved = await likhaLmsApi.submissions.gradeSubmission(targetId, grade);
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const idx = (prev.submissions || []).findIndex(
          s => s.activityKey === merged.activityKey && s.studentId === merged.studentId
        );
        if (idx >= 0) {
          const updated = [...prev.submissions];
          updated[idx] = merged;
          return { ...prev, submissions: updated };
        }
        return { ...prev, submissions: [merged, ...prev.submissions] };
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save manual exam grade.';
      setLastError(message);
      showAlert(message, 'Manual Grade Failed');
      throw err;
    }
  };

  // Contract for the 5th param: `answers` is for question-set activities
  // only. When `answers` is provided the question-set submit path is used;
  // otherwise the cached `format` decides — a cache MISS (unknown format)
  // takes the question-set path, never the classic path, so a
  // not-yet-hydrated question-set activity can never be mis-submitted as a
  // classic file/text row. Only a positively-known `classic` format uses
  // the classic file/text payload. Both persist via Likha ERP.
  const submitActivity = async (
    activityId: string,
    submissionType: 'file' | 'online_text',
    content?: string,
    fileName?: string,
    answers?: Record<string, string>
  ): Promise<void> => {
    const cached = dbRef.current.activities?.find(a => a.id === activityId);
    const useQuestionSetPath = answers !== undefined || cached?.format !== 'classic';
    try {
      // Likha ERP is the source of truth for submissions.
      const saved = useQuestionSetPath
        ? await likhaLmsApi.submissions.submitAssessment({
            activity_id: activityId,
            student_id: activeUser.id,
            answers: answers ?? {},
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
        : await likhaLmsApi.submissions.submitAssessment({
            activity_id: activityId,
            student_id: activeUser.id,
            submission_type: submissionType,
            ...(content !== undefined ? { content } : {}),
            ...(fileName !== undefined ? { file_name: fileName } : {}),
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          });
      const courseId = dbRef.current.activities?.find(a => a.id === activityId)?.courseId;
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const idx = prev.submissions.findIndex(
          s => merged.activityKey !== undefined && s.activityKey === merged.activityKey && s.studentId === merged.studentId
        );
        if (idx >= 0) {
          const updated = [...prev.submissions];
          updated[idx] = merged;
          return { ...prev, submissions: updated };
        }
        return { ...prev, submissions: [merged, ...prev.submissions] };
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit activity.';
      setLastError(message);
      showAlert(message, 'Submit Activity Failed');
      throw err;
    }
  };

  const toggleModulePublish = async (moduleId: string): Promise<void> => {
    const current = (db.modules || []).find(m => m.id === moduleId);
    try {
      // Likha ERP is the source of truth for modules.
      const row = await likhaLmsApi.modules.updateModule(moduleId, {
        published: !(current?.published ?? false),
      });
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).map(m =>
          m.id === moduleId
            ? mapLikhaModuleRow({ ...m, ...(row as any), items: m.items, comments: m.comments })
            : m
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle publish.';
      setLastError(message);
      showAlert(message, 'Publish Failed');
      throw err;
    }
  };

  const toggleItemCompletion = async (moduleId: string, itemId: string): Promise<void> => {
    const current = (db.modules || []).find(m => m.id === moduleId)?.items.find(i => i.id === itemId);
    try {
      // Likha ERP is the source of truth for module items.
      const row = await likhaLmsApi.modules.updateModuleItem(itemId, {
        completed: !(current?.completed ?? false),
      });
      setDb(prev => ({
        ...prev,
        modules: (prev.modules || []).map(mod =>
          mod.id === moduleId
            ? { ...mod, items: mod.items.map(it => (it.id === itemId ? mapLikhaModuleItemRow({ ...it, ...(row as any) }) : it)) }
            : mod
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle completion.';
      setLastError(message);
      showAlert(message, 'Completion Failed');
      throw err;
    }
  };

  const addModuleComment = async (moduleId: string, content: string, parentId?: string): Promise<void> => {
    if (!content.trim()) return;
    // Server creates the reply notification inline (no client call needed).
    // Likha ERP is the source of truth for module comments; the cached row
    // falls back to request/active-user values for author fields the write
    // response may omit.
    try {
      const trimmed = content.trim();
      const row = await likhaLmsApi.modules.addComment({
        module_id: moduleId,
        author_id: activeUser.id,
        content: trimmed,
        ...(parentId ? { parent_id: parentId } : {}),
      });
      const comment = mapLikhaModuleCommentRow(
        {
          module_id: moduleId,
          author_id: activeUser.id,
          author_name: activeUser.name,
          author_avatar: activeUser.avatar,
          author_role: activeUser.role,
          content: trimmed,
          parent_id: parentId ?? null,
          ...(row as any),
        },
        moduleId
      );
      setDb(prev => ({
        ...prev,
        modules: prev.modules.map(mod =>
          mod.id === moduleId
            ? { ...mod, comments: [...(mod.comments || []), comment] }
            : mod
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to post comment.';
      setLastError(message);
      showAlert(message, 'Comment Failed');
      throw err;
    }
  };

  const editModuleComment = async (moduleId: string, commentId: string, newContent: string): Promise<void> => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod =>
        mod.id === moduleId
          ? {
              ...mod,
              comments: (mod.comments || []).map(c =>
                c.id === commentId
                  ? { ...c, content: trimmed, isEdited: true, editedAt: new Date().toISOString() }
                  : c
              )
            }
          : mod
      )
    }));
    await likhaLmsApi.modules.updateComment(commentId, { content: trimmed }).catch(() => {});
  };

  const deleteModuleComment = async (moduleId: string, commentId: string): Promise<void> => {
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod =>
        mod.id === moduleId
          ? { ...mod, comments: (mod.comments || []).filter(c => c.id !== commentId) }
          : mod
      )
    }));
    await likhaLmsApi.modules.deleteComment(commentId).catch(() => {});
  };

  const toggleLikeModuleComment = async (moduleId: string, commentId: string): Promise<void> => {
    const mod = (db.modules || []).find(m => m.id === moduleId);
    const comment = (mod?.comments || []).find(c => c.id === commentId);
    const prevLikedBy = comment?.likedBy || [];
    const isLiked = prevLikedBy.includes(activeUser.id);
    const nextLikedBy = isLiked
      ? prevLikedBy.filter(id => id !== activeUser.id)
      : [...new Set([...prevLikedBy, activeUser.id])];
    const nextLikes = nextLikedBy.length;

    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(m => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          comments: (m.comments || []).map(c =>
            c.id === commentId ? { ...c, likedBy: nextLikedBy, likes: nextLikes } : c
          )
        };
      })
    }));
    await likhaLmsApi.modules.updateComment(commentId, {
      liked_by: nextLikedBy,
      likes: nextLikes,
    }).catch(() => {});
  };

  const sendMessage = async (
    recipientId: string,
    subject: string,
    body: string,
    courseId?: string,
    attachmentName?: string,
    attachmentSize?: string,
    isGroupParam?: boolean,
    groupIdParam?: string
  ): Promise<void> => {
    const matchedGroup = (db.chatGroups || []).find(g => g.id === (groupIdParam || recipientId));
    const isGroup = isGroupParam !== undefined ? isGroupParam : !!matchedGroup;
    try {
      const targetGroupId = isGroup && matchedGroup ? matchedGroup.id : (isGroupParam && groupIdParam ? groupIdParam : undefined);
      const row = await likhaLmsApi.communications.sendMessage({
        sender_id: activeUser?.id,
        ...(targetGroupId ? { group_id: targetGroupId } : { receiver_id: recipientId }),
        subject,
        body,
        ...(courseId !== undefined ? { course_id: courseId } : {}),
      });
      const mapped = mapLikhaMessageRow(row);
      const merged: Message = {
        ...mapped,
        ...(attachmentName !== undefined ? { attachmentName } : {}),
        ...(attachmentSize !== undefined ? { attachmentSize } : {}),
      };
      setDb(prev => ({ ...prev, messages: [merged, ...(prev.messages || [])] }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send message.';
      setLastError(message);
      showAlert(message, 'Send Message Failed');
      throw err;
    }
  };

  const createChatGroup = async (name: string, memberIds: string[], courseId?: string): Promise<ChatGroup> => {
    try {
      const groupRow = await likhaLmsApi.communications.createChatGroup({
        name: name.trim() || 'New Study Group',
        member_ids: Array.from(new Set([activeUser.id, ...memberIds])),
        created_by: activeUser.id,
        ...(courseId !== undefined ? { course_id: courseId } : {}),
      });
      const merged: ChatGroup = mapLikhaChatGroupRow(groupRow, activeUser.id);
      if (!merged.memberIds.includes(activeUser.id)) {
        merged.memberIds = Array.from(new Set([activeUser.id, ...memberIds]));
      }

      // Welcome message rides the communications.sendMessage endpoint; best-effort
      try {
        const welcomeRow = await likhaLmsApi.communications.sendMessage({
          group_id: merged.id,
          sender_id: activeUser.id,
          subject: `Welcome to ${merged.name}`,
          body: `Group created by ${activeUser.name}. Welcome everyone!`,
          ...(courseId !== undefined ? { course_id: courseId } : {}),
        });
        const welcomeMsg = mapLikhaMessageRow(welcomeRow);
        setDb(prev => ({
          ...prev,
          chatGroups: [merged, ...(prev.chatGroups || [])],
          messages: [welcomeMsg, ...(prev.messages || [])]
        }));
      } catch {
        setDb(prev => ({
          ...prev,
          chatGroups: [merged, ...(prev.chatGroups || [])]
        }));
      }
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create group.';
      setLastError(message);
      showAlert(message, 'Create Group Failed');
      throw err;
    }
  };

  const markThreadAsRead = async (partnerId: string): Promise<void> => {
    const isGroup = (db.chatGroups || []).some(g => g.id === partnerId);
    const unreadTargetIds = (db.messages || [])
      .filter(m => {
        if (isGroup) {
          return (m.groupId === partnerId || m.recipientId === partnerId) && m.senderId !== activeUser.id && !m.read;
        }
        return m.senderId === partnerId && m.recipientId === activeUser.id && !m.read;
      })
      .map(m => m.id);

    setDb(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m =>
        unreadTargetIds.includes(m.id) ? { ...m, read: true } : m
      )
    }));
    // Read path: stay silent (no modal) on failure; cache already updated.
    try {
      if (unreadTargetIds.length > 0 && likhaLmsApi?.communications?.markThreadRead) {
        await likhaLmsApi.communications.markThreadRead(unreadTargetIds);
      }
    } catch (err) {
      setLastError(err instanceof ApiError ? err.message : 'Failed to mark thread read.');
    }
  };

  const toggleMessageReaction = async (messageId: string, reaction: string): Promise<void> => {
    const current = (db.messages || []).find(m => m.id === messageId)?.reaction;
    const nextReaction = current === reaction ? null : reaction;
    setDb(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m =>
        m.id === messageId ? { ...m, reaction: nextReaction ?? undefined } : m
      )
    }));
    await likhaLmsApi.communications.updateMessageReaction(messageId, nextReaction).catch(() => {});
  };

  const bookAdvisingSlot = async (slotId: string): Promise<void> => {
    try {
      const slot = await likhaLmsApi.communications.bookAdvisingSlot(slotId, activeUser.id);
      const mapped = mapLikhaAdvisingSlotRow(slot);
      setDb(prev => ({
        ...prev,
        advisingSlots: prev.advisingSlots.map(s => (s.id === slotId ? { ...s, ...mapped } : s))
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to book advising slot.';
      setLastError(message);
      showAlert(message, 'Booking Failed');
      throw err;
    }
  };

  const createAdvisingSlot = async (date: string, timeSlot: string, location: string): Promise<void> => {
    try {
      const row = await likhaLmsApi.communications.createAdvisingSlot({
        instructor_id: activeUser.id,
        instructor_name: activeUser.name,
        date,
        time_slot: timeSlot,
        location,
        status: 'available',
      });
      const slot = mapLikhaAdvisingSlotRow(row);
      setDb(prev => ({
        ...prev,
        advisingSlots: [...prev.advisingSlots, slot]
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create advising slot.';
      setLastError(message);
      showAlert(message, 'Create Slot Failed');
      throw err;
    }
  };

  const addCalendarEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    try {
      const row = await likhaLmsApi.communications.createCalendarEvent({
        title: event.title,
        date: event.date,
        time: event.time,
        course_id: event.courseId,
        type: event.type,
        description: event.description,
        ...(event.courseCode !== undefined ? { course_code: event.courseCode } : {}),
        ...(event.startAt !== undefined ? { start_at: event.startAt } : {}),
        ...(event.endAt !== undefined ? { end_at: event.endAt } : {}),
        ...(event.isAllDay !== undefined ? { all_day: event.isAllDay } : {}),
        ...(event.colorHex !== undefined ? { color_hex: event.colorHex } : {}),
        ...(event.location !== undefined ? { location: event.location } : {}),
      });
      const created: CalendarEvent = {
        ...mapLikhaCalendarEventRow(row),
        ...(event as any),
        id: String(row?.id || (row as any)?.event?.id || `ev-${Date.now()}`),
      };
      setDb(prev => ({
        ...prev,
        calendarEvents: [...prev.calendarEvents, created]
      }));
      return created;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create event.';
      setLastError(message);
      showAlert(message, 'Create Event Failed');
      throw err;
    }
  };

  const updateCalendarEvent = async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
    const patch: any = { ...updates };
    if (updates.courseId !== undefined) patch.course_id = updates.courseId;
    if (updates.courseCode !== undefined) patch.course_code = updates.courseCode;
    if (updates.startAt !== undefined) patch.start_at = updates.startAt;
    if (updates.endAt !== undefined) patch.end_at = updates.endAt;
    if (updates.isAllDay !== undefined) patch.all_day = updates.isAllDay;
    if (updates.colorHex !== undefined) patch.color_hex = updates.colorHex;
    try {
      const row = await likhaLmsApi.communications.updateCalendarEvent(id, patch);
      const mapped = row && typeof row === 'object' ? mapLikhaCalendarEventRow(row) : {};
      setDb(prev => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map(evt =>
          evt.id === id ? { ...evt, ...mapped, ...updates } : evt
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update event.';
      setLastError(message);
      showAlert(message, 'Update Event Failed');
      throw err;
    }
  };

  const deleteCalendarEvent = async (id: string): Promise<void> => {
    try {
      await likhaLmsApi.communications.deleteCalendarEvent(id);
      setDb(prev => ({
        ...prev,
        calendarEvents: prev.calendarEvents.filter(evt => evt.id !== id)
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete event.';
      setLastError(message);
      showAlert(message, 'Delete Event Failed');
      throw err;
    }
  };

  // ==========================================
  // ANNOUNCEMENTS CRUD
  // ==========================================

  const createAnnouncement = async (data: Partial<Announcement>): Promise<Announcement> => {
    const courseId = data.courseId || activeCourseId || 'crs-cmsc131';
    try {
      const row = await likhaLmsApi.communications.createAnnouncement({
        course_id: courseId,
        title: data.title || 'Untitled Announcement',
        content: data.content || '',
        author_id: activeUser.id,
        author_name: activeUser.name,
        date: new Date().toISOString(),
        pinned: data.pinned ?? false,
        section_id: data.sectionId || 'all',
      });
      const mapped = mapLikhaAnnouncementRow(row, courseId);
      const merged: Announcement = {
        ...mapped,
        courseId,
        sectionId: data.sectionId || mapped.sectionId || 'all',
        sectionRestriction: data.sectionRestriction || 'All Sections',
        delayedUntil: data.delayedUntil,
        allowComments: data.allowComments ?? true,
        usersMustPostBeforeReplies: data.usersMustPostBeforeReplies ?? false,
        allowLiking: data.allowLiking ?? true,
        likes: mapped.likes ?? 0,
        likedBy: mapped.likedBy || [],
        pinned: data.pinned ?? mapped.pinned ?? false,
        attachments: data.attachments || mapped.attachments || [],
        replies: mapped.replies || [],
        readBy: mapped.readBy?.length ? mapped.readBy : [activeUser.id]
      };
      setDb(prev => ({
        ...prev,
        announcements: [merged, ...(prev.announcements || [])]
      }));
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create announcement.';
      setLastError(message);
      showAlert(message, 'Create Announcement Failed');
      throw err;
    }
  };

  const deleteAnnouncement = async (id: string): Promise<void> => {
    try {
      await likhaLmsApi.communications.deleteAnnouncement(id);
      setDb(prev => ({
        ...prev,
        announcements: (prev.announcements || []).filter(a => a.id !== id)
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete announcement.';
      setLastError(message);
      showAlert(message, 'Delete Announcement Failed');
      throw err;
    }
  };

  const togglePinAnnouncement = async (id: string): Promise<void> => {
    const current = (db.announcements || []).find(a => a.id === id);
    const newPinned = !(current?.pinned ?? false);
    try {
      const row = await likhaLmsApi.communications.updateAnnouncement(id, { pinned: newPinned });
      setDb(prev => ({
        ...prev,
        announcements: (prev.announcements || []).map(a =>
          a.id === id ? { ...a, pinned: newPinned, ...(row && typeof row === 'object' ? mapLikhaAnnouncementRow(row, a.courseId) : {}) } : a
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle pin.';
      setLastError(message);
      showAlert(message, 'Pin Failed');
      throw err;
    }
  };

  const toggleLikeAnnouncement = async (id: string): Promise<void> => {
    const target = (db.announcements || []).find(a => a.id === id);
    const prevLikedBy = target?.likedBy || [];
    const isLiked = prevLikedBy.includes(activeUser.id);
    const nextLikedBy = isLiked
      ? prevLikedBy.filter(uid => uid !== activeUser.id)
      : [...new Set([...prevLikedBy, activeUser.id])];
    const nextLikes = nextLikedBy.length;

    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === id ? { ...a, likedBy: nextLikedBy, likes: nextLikes } : a
      )
    }));
    await likhaLmsApi.communications.updateAnnouncement(id, {
      liked_by: nextLikedBy,
      likes: nextLikes,
    }).catch(() => {});
  };

  const addAnnouncementReply = async (announcementId: string, content: string, parentId?: string): Promise<void> => {
    try {
      const row = await likhaLmsApi.communications.addAnnouncementReply(announcementId, {
        author_id: activeUser.id,
        author_name: activeUser.name,
        author_avatar: activeUser.avatar || '',
        author_role: activeUser.role,
        content,
        created_at: new Date().toISOString(),
        ...(parentId ? { parent_id: parentId } : {}),
      });
      const reply = mapLikhaAnnouncementReplyRow(row, announcementId);
      setDb(prev => ({
        ...prev,
        announcements: (prev.announcements || []).map(a =>
          a.id === announcementId
            ? { ...a, replies: [...a.replies, reply] }
            : a
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to post reply.';
      setLastError(message);
      showAlert(message, 'Reply Failed');
      throw err;
    }
  };

  const markAnnouncementRead = async (id: string): Promise<void> => {
    const target = (db.announcements || []).find(a => a.id === id);
    const readBy = target?.readBy || [];
    if (readBy.includes(activeUser.id)) return;
    const nextReadBy = [...readBy, activeUser.id];

    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === id ? { ...a, readBy: nextReadBy } : a
      )
    }));
    await likhaLmsApi.communications.updateAnnouncement(id, {
      read_by: nextReadBy,
    }).catch(() => {});
  };

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  const getUnreadNotificationCount = (userId: string, type?: string): number => {
    const userNotifications = (notifications || [])
      .filter(n => n.recipientId === userId && !n.read);

    if (!type) return userNotifications.length;

    return userNotifications.filter(n => n.type === type).length;
  };

  const markNotificationRead = async (id: string): Promise<void> => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    setDb(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.id === id ? { ...n, read: true } : n
      )
    }));

    // Read path: stay silent (no modal) on failure; cache already updated.
    try {
      if (likhaLmsApi?.communications?.markNotificationRead) {
        await likhaLmsApi.communications.markNotificationRead(id);
      }
    } catch (err) {
      setLastError(err instanceof ApiError ? err.message : 'Failed to mark notification read.');
    }
  };

  const markAllNotificationsRead = async (userId: string, type?: string): Promise<void> => {
    setNotifications(prev =>
      prev.map(n =>
        n.recipientId === userId && (!type || n.type === type) ? { ...n, read: true } : n
      )
    );

    setDb(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.recipientId === userId && (!type || n.type === type) ? { ...n, read: true } : n
      )
    }));

    // Read path: stay silent (no modal) on failure; cache already updated.
    // The server marks the caller's own rows (userId is a client-side filter).
    try {
      const targets = Array.from(new Set([
        ...(db.notifications || []).filter(n => n.recipientId === userId && (!type || n.type === type)).map(n => n.id),
        ...(notifications || []).filter(n => n.recipientId === userId && (!type || n.type === type)).map(n => n.id),
      ]));
      if (targets.length > 0 && likhaLmsApi?.communications?.markAllNotificationsRead) {
        await likhaLmsApi.communications.markAllNotificationsRead(targets);
      }
    } catch (err) {
      setLastError(err instanceof ApiError ? err.message : 'Failed to mark notifications read.');
    }
  };

  const markTabVisited = (tab: string, courseId?: string) => {
    const key = courseId ? `${tab}:${courseId}` : tab;
    const stamp = new Date().toISOString();
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u =>
        u.id === activeUser.id
          ? { ...u, lastVisitedAt: { ...(u.lastVisitedAt || {}), [key]: stamp } }
          : u
      )
    }));
    // Badges read activeUser.lastVisitedAt (from currentUser, not db.users) —
    // sync it so the badge clears instantly without a page reload.
    setCurrentUser(prev =>
      prev && prev.id === activeUser.id
        ? { ...prev, lastVisitedAt: { ...(prev.lastVisitedAt || {}), [key]: stamp } }
        : prev
    );
  };

  const markModuleCommentsRead = async (moduleId: string): Promise<void> => {
    // Mark matching cached rows locally, then mark each server-side per id
    // (no bulk/type call — client semantics clear only this module's rows).
    const targets = (notifications || []).filter(
      n => n.recipientId === activeUser.id && n.relatedId === moduleId && !n.read
    );
    setNotifications(prev =>
      prev.map(n =>
        n.recipientId === activeUser.id && n.relatedId === moduleId && !n.read
          ? { ...n, read: true }
          : n
      )
    );
    setDb(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.recipientId === activeUser.id && n.relatedId === moduleId && !n.read
          ? { ...n, read: true }
          : n
      )
    }));
    if (likhaLmsApi?.communications?.markNotificationRead) {
      await Promise.allSettled(
        targets.map(n => likhaLmsApi.communications.markNotificationRead(n.id))
      );
    }
  };

  const getNotifications = (userId: string, type?: string, limit?: number): Notification[] => {
    const userNotifications = (notifications || [])
      .filter(n => n.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (type) {
      return userNotifications.filter(n => n.type === type).slice(0, limit);
    }

    return userNotifications.slice(0, limit);
  };

  // ==========================================
  // DISCUSSIONS CRUD
  // ==========================================

  const createDiscussion = async (data: Partial<Discussion>): Promise<Discussion> => {
    const courseId = data.courseId || activeCourseId || 'crs-cmsc131';
    try {
      const row = await likhaLmsApi.communications.createDiscussion({
        course_id: courseId,
        title: data.title || 'Untitled Discussion Topic',
        content: data.prompt || '',
        author_id: activeUser.id,
        author_name: activeUser.name,
        date: new Date().toISOString(),
        pinned: data.pinned ?? false,
        locked: data.locked ?? false,
      });
      const mapped = mapLikhaDiscussionRow(row, courseId);
      const merged: Discussion = {
        ...mapped,
        courseId,
        prompt: data.prompt || mapped.prompt || '',
        isGraded: data.isGraded ?? mapped.isGraded ?? false,
        pointsPossible: data.pointsPossible ?? mapped.pointsPossible,
        dueDate: data.dueDate ?? mapped.dueDate,
        pinned: data.pinned ?? mapped.pinned ?? false,
        locked: data.locked ?? mapped.locked ?? false,
        usersMustPostBeforeReplies: data.usersMustPostBeforeReplies ?? mapped.usersMustPostBeforeReplies ?? false,
        groupActivity: data.groupActivity || mapped.groupActivity || 'All Students',
        replies: mapped.replies || [],
      };
      setDb(prev => ({
        ...prev,
        discussions: [merged, ...(prev.discussions || [])]
      }));
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create discussion.';
      setLastError(message);
      showAlert(message, 'Create Discussion Failed');
      throw err;
    }
  };

  const deleteDiscussion = async (id: string): Promise<void> => {
    try {
      await likhaLmsApi.communications.deleteDiscussion(id);
      setDb(prev => ({
        ...prev,
        discussions: (prev.discussions || []).filter(d => d.id !== id)
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete discussion.';
      setLastError(message);
      showAlert(message, 'Delete Discussion Failed');
      throw err;
    }
  };

  const togglePinDiscussion = async (id: string): Promise<void> => {
    const current = (db.discussions || []).find(d => d.id === id);
    const newPinned = !(current?.pinned ?? false);
    try {
      const row = await likhaLmsApi.communications.updateDiscussion(id, { pinned: newPinned });
      setDb(prev => ({
        ...prev,
        discussions: (prev.discussions || []).map(d =>
          d.id === id ? { ...d, pinned: newPinned, ...(row && typeof row === 'object' ? mapLikhaDiscussionRow(row, d.courseId) : {}) } : d
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle pin.';
      setLastError(message);
      showAlert(message, 'Pin Failed');
      throw err;
    }
  };

  const toggleLockDiscussion = async (id: string): Promise<void> => {
    const current = (db.discussions || []).find(d => d.id === id);
    const newLocked = !(current?.locked ?? false);
    try {
      const row = await likhaLmsApi.communications.updateDiscussion(id, { locked: newLocked });
      setDb(prev => ({
        ...prev,
        discussions: (prev.discussions || []).map(d =>
          d.id === id ? { ...d, locked: newLocked, ...(row && typeof row === 'object' ? mapLikhaDiscussionRow(row, d.courseId) : {}) } : d
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle lock.';
      setLastError(message);
      showAlert(message, 'Lock Failed');
      throw err;
    }
  };

  const addDiscussionReply = async (
    discussionId: string,
    content: string,
    parentId?: string,
    attachment?: { name: string; url?: string }
  ): Promise<void> => {
    try {
      const row = await likhaLmsApi.communications.addDiscussionReply(discussionId, {
        author_id: activeUser.id,
        author_name: activeUser.name,
        author_avatar: activeUser.avatar || '',
        author_role: activeUser.role,
        content,
        created_at: new Date().toISOString(),
        ...(parentId ? { parent_id: parentId } : {}),
      });
      const reply = mapLikhaDiscussionReplyRow(row, discussionId);
      const merged: DiscussionReply = attachment
        ? { ...reply, attachments: [attachment] }
        : reply;
      setDb(prev => ({
        ...prev,
        discussions: (prev.discussions || []).map(d =>
          d.id === discussionId
            ? { ...d, replies: [...d.replies, merged] }
            : d
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to post reply.';
      setLastError(message);
      showAlert(message, 'Reply Failed');
      throw err;
    }
  };

  const toggleLikeDiscussionReply = async (discussionId: string, replyId: string): Promise<void> => {
    const disc = (db.discussions || []).find(d => d.id === discussionId);
    const reply = (disc?.replies || []).find(r => r.id === replyId);
    const prevLikedBy = reply?.likedBy || [];
    const isLiked = prevLikedBy.includes(activeUser.id);
    const nextLikedBy = isLiked
      ? prevLikedBy.filter(uid => uid !== activeUser.id)
      : [...new Set([...prevLikedBy, activeUser.id])];
    const nextLikes = nextLikedBy.length;

    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).map(d => {
        if (d.id !== discussionId) return d;
        return {
          ...d,
          replies: (d.replies || []).map(r =>
            r.id === replyId ? { ...r, likedBy: nextLikedBy, likes: nextLikes } : r
          )
        };
      })
    }));
    await likhaLmsApi.communications.updateDiscussionReply(replyId, {
      liked_by: nextLikedBy,
      likes: nextLikes,
    }).catch(() => {});
  };

  // ==========================================
  // COURSE FILES & FOLDERS CRUD
  // ==========================================

  const createCourseFolder = async (courseId: string, name: string, parentId?: string | null, autoKey?: string): Promise<CourseFolder> => {
    try {
      const payload: Record<string, any> = {
        course_id: courseId,
        name,
      };
      if (parentId) payload.parent_id = parentId;
      const res = await likhaLmsApi.files.createCourseFolder(payload);
      const folder = mapLikhaCourseFolderRow(res, courseId);
      // Server stores name/parent only — autoKey stays a client cache overlay.
      const merged: CourseFolder = autoKey ? { ...folder, autoKey } : folder;
      setDb(prev => ({
        ...prev,
        courseFolders: [...(prev.courseFolders || []), merged]
      }));
      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create folder.';
      setLastError(message);
      showAlert(message, 'Create Folder Failed');
      throw err;
    }
  };

  const uploadCourseFile = async (
    fileData: Partial<CourseFile> & { rawFile?: File | Blob; area?: string; moduleId?: string; moduleTitle?: string; silent?: boolean }
  ): Promise<CourseFile> => {
    const courseId = fileData.courseId || activeCourseId || 'crs-cmsc131';
    // Metadata-only calls (no raw bytes)
    if (!fileData.rawFile) {
      try {
        const payload: Record<string, any> = {
          course_id: courseId,
          name: fileData.name,
        };
        if (fileData.url !== undefined) payload.url = fileData.url;
        if (fileData.fileUrl !== undefined) payload.file_url = fileData.fileUrl;
        if (fileData.size !== undefined) payload.size = fileData.size;
        if (fileData.formattedSize !== undefined) payload.formatted_size = fileData.formattedSize;
        if (fileData.type !== undefined) payload.type = fileData.type;
        if (fileData.visibility !== undefined) payload.visibility = fileData.visibility;
        if (fileData.folderId !== undefined) payload.folder_id = fileData.folderId;
        if (fileData.area !== undefined) payload.source_area = fileData.area;
        if (fileData.moduleId !== undefined) payload.source_id = fileData.moduleId;
        if (fileData.content !== undefined) payload.content = fileData.content;
        const res = await likhaLmsApi.files.createCourseFile(payload);
        const file = mapLikhaCourseFileRow(res, courseId);
        setDb(prev => ({
          ...prev,
          courseFiles: [...(prev.courseFiles || []), file]
        }));
        return file;
      } catch (err) {
        if (!fileData.silent) {
          const message = err instanceof ApiError ? err.message : 'Failed to upload file.';
          setLastError(message);
          showAlert(message, 'Upload File Failed');
        }
        throw err;
      }
    }
    // Real file upload: upload asset to Likha storage first, then create CourseFile row
    try {
      const rawFileToUpload = fileData.rawFile instanceof File
        ? fileData.rawFile
        : new File([fileData.rawFile], fileData.name || 'uploaded_asset.bin');
      const asset = await likhaLmsApi.files.uploadFile(rawFileToUpload);
      const payload: Record<string, any> = {
        course_id: courseId,
        name: fileData.name || asset.filename_download || rawFileToUpload.name,
        file: asset.id,
        url: asset.url,
        visibility: fileData.visibility || 'published',
      };
      if (fileData.folderId) payload.folder_id = fileData.folderId;
      if (fileData.area) {
        payload.source_area = fileData.area;
        if (fileData.moduleId) payload.source_id = fileData.moduleId;
      }
      if (fileData.size !== undefined) payload.size = fileData.size;
      const res = await likhaLmsApi.files.createCourseFile(payload);
      const file = mapLikhaCourseFileRow(res, courseId);
      setDb(prev => ({
        ...prev,
        courseFiles: [...(prev.courseFiles || []), file]
      }));
      return file;
    } catch (err) {
      if (!fileData.silent) {
        const message = err instanceof ApiError ? err.message : 'Failed to upload file.';
        setLastError(message);
        showAlert(message, 'Upload File Failed');
      }
      throw err;
    }
  };

  const deleteCourseFile = async (fileId: string): Promise<void> => {
    // Virtual ids (mod-file-*, ann-file-*, act-file-*, sub-file-*, quiz-*)
    // are cache-only aggregations from useCourseFiles — they clear the source
    // fields locally. Real CourseFile rows delete via the files endpoint.
    const isVirtual = /^(mod-file-|ann-file-|act-file-|sub-file-|quiz-file-|quiz-q-file-)/.test(fileId);
    if (!isVirtual) {
      try {
        await likhaLmsApi.files.deleteCourseFile(fileId);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to delete file.';
        setLastError(message);
        showAlert(message, 'Delete File Failed');
        throw err;
      }
      setDb(prev => ({
        ...prev,
        courseFiles: (prev.courseFiles || []).filter(f => f.id !== fileId)
      }));
      return;
    }
    setDb(prev => {
      // 1. Direct course files
      const updatedCourseFiles = (prev.courseFiles || []).filter(f => f.id !== fileId);

      // 2. Module item file
      let updatedModules = prev.modules;
      if (fileId.startsWith('mod-file-')) {
        const itemId = fileId.replace('mod-file-', '');
        updatedModules = (prev.modules || []).map(m => ({
          ...m,
          items: m.items
            .map(item => {
              if (item.id === itemId) {
                return {
                  ...item,
                  fileName: undefined,
                  fileUrl: undefined,
                  fileSize: undefined,
                  fileType: undefined
                };
              }
              return item;
            })
            .filter(item => !(item.type === 'file' && item.id === itemId))
        }));
      }

      // 3. Announcement attachment
      let updatedAnnouncements = prev.announcements;
      if (fileId.startsWith('ann-file-')) {
        const parts = fileId.split('-');
        const attIdx = Number(parts[parts.length - 1]);
        updatedAnnouncements = (prev.announcements || []).map(ann => {
          if (fileId.includes(ann.id)) {
            return {
              ...ann,
              attachments: (ann.attachments || []).filter((_, idx) => idx !== attIdx)
            };
          }
          return ann;
        });
      }

      // 4. Classic activity handout file (link-key values preserved)
      let updatedActivities = prev.activities;
      if (fileId.startsWith('act-file-')) {
        const actId = fileId.replace('act-file-', '');
        updatedActivities = (prev.activities || []).map(act => {
          if (act.id === actId) {
            return {
              ...act,
              fileName: undefined,
              fileUrl: undefined,
              fileSize: undefined
            };
          }
          return act;
        });
      }

      // 5. Submission file
      let updatedSubmissions = prev.submissions;
      if (fileId.startsWith('sub-file-')) {
        const subId = fileId.replace('sub-file-', '');
        updatedSubmissions = (prev.submissions || []).map(sub => {
          if (sub.id === subId) {
            return {
              ...sub,
              fileName: undefined,
              fileUrl: undefined
            };
          }
          return sub;
        });
      }

      // 6. Quiz reference or question file
      let updatedQuizzes = prev.quizzes;
      if (fileId.startsWith('quiz-file-')) {
        const quizId = fileId.replace('quiz-file-', '');
        updatedQuizzes = (prev.quizzes || []).map(q => {
          if (q.id === quizId) {
            return {
              ...q,
              fileName: undefined,
              fileUrl: undefined,
              fileSize: undefined
            } as any;
          }
          return q;
        });
      } else if (fileId.startsWith('quiz-q-file-')) {
        updatedQuizzes = (prev.quizzes || []).map(q => {
          if (fileId.includes(q.id)) {
            return {
              ...q,
              questions: (q.questions || []).map((question: any) => {
                if (fileId.includes(question.id)) {
                  return {
                    ...question,
                    imageUrl: undefined,
                    imageName: undefined,
                    fileUrl: undefined,
                    fileName: undefined
                  };
                }
                return question;
              })
            };
          }
          return q;
        });
      }

      return {
        ...prev,
        courseFiles: updatedCourseFiles,
        modules: updatedModules,
        announcements: updatedAnnouncements,
        activities: updatedActivities,
        submissions: updatedSubmissions,
        quizzes: updatedQuizzes
      };
    });
  };

  const deleteCourseFolder = async (folderId: string): Promise<void> => {
    try {
      await likhaLmsApi.files.deleteCourseFolder(folderId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete folder.';
      setLastError(message);
      showAlert(message, 'Delete Folder Failed');
      throw err;
    }
    setDb(prev => ({
      ...prev,
      courseFolders: (prev.courseFolders || []).filter(f => f.id !== folderId && f.parentId !== folderId),
      courseFiles: (prev.courseFiles || []).filter(f => f.folderId !== folderId)
    }));
  };

  const updateFileVisibility = async (fileId: string, visibility: 'published' | 'unpublished' | 'restricted'): Promise<void> => {
    try {
      const res = await likhaLmsApi.files.updateCourseFile(fileId, { visibility });
      const updated = mapLikhaCourseFileRow(res);
      setDb(prev => ({
        ...prev,
        courseFiles: (prev.courseFiles || []).map(f =>
          f.id === fileId ? { ...f, ...updated, visibility } : f
        )
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update visibility.';
      setLastError(message);
      showAlert(message, 'Visibility Failed');
      throw err;
    }
  };

  const renameCourseFile = async (fileId: string, newName: string): Promise<void> => {
    // Real CourseFile rows rename via the files endpoint; virtual
    // aggregation ids (mod-file-*, ann-file-*, act-file-*) rename the source
    // fields locally below.
    const isVirtual = /^(mod-file-|ann-file-|act-file-|sub-file-|quiz-file-|quiz-q-file-)/.test(fileId);
    if (!isVirtual) {
      try {
        const res = await likhaLmsApi.files.updateCourseFile(fileId, { name: newName });
        const updated = mapLikhaCourseFileRow(res);
        setDb(prev => ({
          ...prev,
          courseFiles: (prev.courseFiles || []).map(f =>
            f.id === fileId ? { ...f, ...updated, name: newName } : f
          )
        }));
        return;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to rename file.';
        setLastError(message);
        showAlert(message, 'Rename Failed');
        throw err;
      }
    }
    setDb(prev => {
      const updatedCourseFiles = (prev.courseFiles || []).map(f =>
        f.id === fileId ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f
      );

      let updatedModules = prev.modules;
      if (fileId.startsWith('mod-file-')) {
        const itemId = fileId.replace('mod-file-', '');
        updatedModules = (prev.modules || []).map(m => ({
          ...m,
          items: m.items.map(item =>
            item.id === itemId ? { ...item, fileName: newName } : item
          )
        }));
      }

      let updatedAnnouncements = prev.announcements;
      if (fileId.startsWith('ann-file-')) {
        const parts = fileId.split('-');
        const attIdx = Number(parts[parts.length - 1]);
        updatedAnnouncements = (prev.announcements || []).map(ann => {
          if (fileId.includes(ann.id)) {
            return {
              ...ann,
              attachments: (ann.attachments || []).map((att, idx) =>
                idx === attIdx ? { ...att, name: newName } : att
              )
            };
          }
          return ann;
        });
      }

      let updatedActivities = prev.activities;
      if (fileId.startsWith('act-file-')) {
        const actId = fileId.replace('act-file-', '');
        updatedActivities = (prev.activities || []).map(act =>
          act.id === actId ? { ...act, fileName: newName } : act
        );
      }

      return {
        ...prev,
        courseFiles: updatedCourseFiles,
        modules: updatedModules,
        announcements: updatedAnnouncements,
        activities: updatedActivities
      };
    });
  };

  const setCourseStudentGrade = async (
    courseId: string,
    studentId: string,
    type: 'midterm' | 'final',
    score: number | null
  ): Promise<void> => {
    try {
      // Likha holds the grade on its course_grades row (the cells carry the
      // scores; grades.* exposes no term-scalar write), so persist by
      // ensuring the row, then merge the derived scalar into the cache.
      await likhaLmsApi.grades.saveGradeWithCells(courseId, studentId, []);
      const patch = type === 'midterm' ? { midtermGrade: score } : { finalGrade: score };
      setDb(prev => {
        const existingGrades = prev.courseGrades || [];
        const index = existingGrades.findIndex(
          g => g.courseId === courseId && g.studentId === studentId
        );
        // Merge the derived scalar over the cached row so the untouched
        // term survives (the server no longer echoes the full row back).
        const merged = normalizeCourseGrade({
          ...(index >= 0 ? existingGrades[index] : { courseId, studentId }),
          ...patch,
        });
        if (index >= 0) {
          const updatedList = [...existingGrades];
          updatedList[index] = merged;
          return { ...prev, courseGrades: updatedList };
        }
        return { ...prev, courseGrades: [...existingGrades, merged] };
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update grade.';
      setLastError(message);
      showAlert(message, 'Update Grade Failed');
      throw err;
    }
  };

  // ==========================================
  // SPR GRADEBOOK STORE
  // ==========================================

  // Lazy per-course fill: config + manual cells from the Likha course_grades
  // rows' spr_cells relation (no dedicated cells endpoint exists).
  // Ref-guarded so first-access triggers never refetch in a loop.
  const ensureSPRCourse = async (courseId: string): Promise<void> => {
    if (sprHydratedRef.current.has(courseId)) return;
    sprHydratedRef.current.add(courseId);
    try {
      const [configRow, gradeRows] = await Promise.all([
        likhaLmsApi?.grades?.getSPRConfig?.(courseId) ?? null,
        likhaLmsApi?.grades?.getCourseGrades?.(courseId) ?? [],
      ]);
      const config = mapLikhaSPRConfigRow(configRow, courseId);
      const cells: Record<string, SPRStudentCells> = {};
      const grades: CourseStudentGrade[] = [];
      for (const r of (Array.isArray(gradeRows) ? gradeRows : []) as any[]) {
        const mapped = mapLikhaGradeRow(r, courseId);
        grades.push(normalizeCourseGrade(mapped));
        const parsed = parseLikhaSprCellRows(r.spr_cells ?? r.sprCells ?? [], config);
        if (parsed && mapped.studentId) cells[mapped.studentId] = parsed;
      }
      setDb(prev => ({
        ...prev,
        sprConfigs: config ? { ...(prev.sprConfigs ?? {}), [courseId]: config } : (prev.sprConfigs ?? {}),
        sprScores: mergeSPRCourseMaps(prev.sprScores, Object.keys(cells).length > 0 ? { [courseId]: cells } : {}),
        courseGrades: mergeSPRGrades(prev.courseGrades, grades),
      }));
    } catch (err) {
      // Lazy-only failure: never pop an alert over the workspace; sync
      // getters read whatever the cache holds.
      console.warn('[ensureSPRCourse] background sync failed:', err instanceof ApiError ? err.message : err);
    }
  };

  const getSPRConfig = (courseId: string): SPRConfig | null => {
    // Lazy fill on first Grades-tab access for this course.
    void ensureSPRCourse(courseId);
    return db.sprConfigs?.[courseId] ?? null;
  };

  const saveSPRConfig = async (courseId: string, config: Omit<SPRConfig, 'courseId'>): Promise<void> => {
    try {
      // Likha ERP is the gradebook store (no Express fallback on this
      // path) — the saved spr_configs row maps back into the cache.
      const saved = await likhaLmsApi.grades.saveSPRConfig(courseId, config);
      const mapped = mapLikhaSPRConfigRow(saved, courseId) ?? { ...config, courseId };
      setDb(prev => ({
        ...prev,
        sprConfigs: { ...(prev.sprConfigs ?? {}), [courseId]: mapped },
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save SPR config.';
      setLastError(message);
      showAlert(message, 'Save SPR Config Failed');
      throw err;
    }
  };

  // Recompute both term grades for a student from the given snapshot
  // (manual map entry wins, else Task 1 autoScoreFraction) and sync them
  // through the existing term-grade path. Sync failures propagate with the
  // existing setCourseStudentGrade alert; the cell write is NOT rolled back.
  const recomputeAndSyncSPR = async (
    snapshot: LMSDatabase,
    courseId: string,
    studentId: string
  ): Promise<void> => {
    const config = snapshot.sprConfigs?.[courseId];
    if (!config) return;
    const course = snapshot.courses.find(c => c.id === courseId);
    const weights = resolveSPRWeights(course?.syllabus?.gradingSystem ?? null);
    const cells = snapshot.sprScores?.[courseId]?.[studentId];
    const resolveTerm = (term: 'midterm' | 'final'): number | null => {
      const columns = term === 'midterm' ? config.midtermColumns : config.finalColumns;
      const examPerfect = term === 'midterm' ? config.mtExamPerfect : config.ftExamPerfect;
      const manual = term === 'midterm' ? cells?.midterm ?? {} : cells?.final ?? {};
      const scores: Array<number | null> = [];
      const perfects: number[] = [];
      for (const col of columns) {
        const manualValue = manual[col.id];
        if (typeof manualValue === 'number') {
          scores.push(manualValue);
        } else {
          const fraction = autoScoreFraction({
            column: col,
            studentId,
            submissions: snapshot.submissions,
            activities: snapshot.activities ?? [],
            quizzes: snapshot.quizzes,
          });
          scores.push(fraction === null ? null : fraction * col.perfectScore);
        }
        perfects.push(col.perfectScore);
      }
      const cs = classStandingPercent(scores, perfects);
      const exam = term === 'midterm' ? cells?.mtExam ?? null : cells?.ftExam ?? null;
      const hasCSData = scores.some(s => s !== null);
      return termGrade(cs, exam, examPerfect, weights, hasCSData || exam !== null);
    };
    const mtGrade = resolveTerm('midterm');
    const ftGrade = resolveTerm('final');
    await setCourseStudentGrade(courseId, studentId, 'midterm', mtGrade === null ? null : round2(mtGrade));
    await setCourseStudentGrade(courseId, studentId, 'final', ftGrade === null ? null : round2(ftGrade));
  };

  const setSPRCell = async (
    courseId: string,
    studentId: string,
    term: 'midterm' | 'final',
    key: string,
    value: number | null
  ): Promise<void> => {
    const snapshot = dbRef.current;
    const prevCell = snapshot.sprScores?.[courseId]?.[studentId];
    const nextCell: SPRStudentCells = {
      midterm: { ...(prevCell?.midterm ?? {}) },
      mtExam: prevCell?.mtExam ?? null,
      final: { ...(prevCell?.final ?? {}) },
      ftExam: prevCell?.ftExam ?? null,
    };
    if (key === '__mtExam') {
      nextCell.mtExam = value;
    } else if (key === '__ftExam') {
      nextCell.ftExam = value;
    } else {
      // Store ONLY explicit manual numbers — a null/reset deletes the map
      // entry so auto resolution wins again (manual tagging).
      const map = term === 'midterm' ? nextCell.midterm : nextCell.final;
      if (value === null) delete map[key];
      else map[key] = value;
    }
    try {
      // Likha ERP is the gradebook store (no Express fallback on this
      // path) — the changed cell upserts with the column/exam key as its
      // task_id. A reset (null) has no delete path in grades.*, so it
      // applies to the local cache only.
      // likha-gap: spr cell reset needs a cell-delete in likhaLmsApi.grades (browser_subagent follow-up — no delete exposed today)
      if (value !== null) {
        await likhaLmsApi.grades.saveGradeWithCells(courseId, studentId, [
          { task_id: key, score: value },
        ]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save SPR cell.';
      setLastError(message);
      showAlert(message, 'Save SPR Cell Failed');
      throw err;
    }
    const nextDb: LMSDatabase = {
      ...snapshot,
      sprScores: mergeSPRCourseMaps(snapshot.sprScores, { [courseId]: { [studentId]: nextCell } }),
    };
    setDb(prev => ({
      ...prev,
      sprScores: mergeSPRCourseMaps(prev.sprScores, { [courseId]: { [studentId]: nextCell } }),
    }));

    await recomputeAndSyncSPR(nextDb, courseId, studentId);
  };

  const resetSPRCell = async (
    courseId: string,
    studentId: string,
    term: 'midterm' | 'final',
    key: string
  ): Promise<void> => {
    await setSPRCell(courseId, studentId, term, key, null);
  };

  const bulkImportSPRColumns = async (courseId: string, term: 'midterm' | 'final'): Promise<void> => {
    const snapshot = dbRef.current;
    const base = snapshot.sprConfigs?.[courseId];
    const config: SPRConfig = base ?? {
      courseId,
      midtermColumns: [],
      finalColumns: [],
      mtExamPerfect: 100,
      ftExamPerfect: 100,
    };
    // Sources already linked in EITHER term list are skipped.
    const linked = new Set<string>();
    for (const col of [...config.midtermColumns, ...config.finalColumns]) {
      if (col.linkedSource) linked.add(`${col.linkedSource.kind}:${col.linkedSource.sourceId}`);
    }
    const next: SPRColumn[] = [...(term === 'midterm' ? config.midtermColumns : config.finalColumns)];
    for (const a of snapshot.activities ?? []) {
      if (a.courseId !== courseId || linked.has(`activity:${a.id}`)) continue;
      linked.add(`activity:${a.id}`);
      next.push({
        id: crypto.randomUUID(),
        title: a.title,
        perfectScore: a.pointsPossible,
        linkedSource: { kind: 'activity', sourceId: a.id },
      });
    }
    for (const q of snapshot.quizzes) {
      if (q.courseId !== courseId || !q.published || linked.has(`quiz:${q.id}`)) continue;
      linked.add(`quiz:${q.id}`);
      const points = (q.questions || []).reduce((sum, qq) => sum + (qq.points ?? 0), 0);
      next.push({
        id: crypto.randomUUID(),
        title: q.title,
        perfectScore: Math.max(1, points),
        linkedSource: { kind: 'quiz', sourceId: q.id },
      });
    }
    await saveSPRConfig(courseId, {
      midtermColumns: term === 'midterm' ? next : config.midtermColumns,
      finalColumns: term === 'final' ? next : config.finalColumns,
      mtExamPerfect: config.mtExamPerfect,
      ftExamPerfect: config.ftExamPerfect,
    });
  };

  const clearHistory = () => {
    setDb(prev => ({
      ...prev,
      historyLogs: []
    }));
  };

  // ==========================================
  // SECTIONS CRUD
  // ==========================================

  const createSection = async (courseId: string, data: Partial<CourseSection>): Promise<CourseSection> => {
    try {
      // Likha ERP is the source of truth (Express /api/courses is RAG-only now).
      const row = await likhaLmsApi.sections.createSection({
        course_id: courseId,
        name: data.name || 'New Section',
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.schedule ? { schedule: data.schedule } : {}),
        ...(data.location ? { room: data.location } : {})
      });

      // Server stores name/capacity only — schedule/location ride along in cache.
      const section: CourseSection = {
        ...mapLikhaSectionRow({ course_id: courseId, ...(row as any) }),
        id: String((row as any)?.id ?? `sec-${Date.now().toString(36)}`),
        schedule: data.schedule || '',
        location: data.location || ''
      };

      setDb(prev => ({
        ...prev,
        courseSections: [...(prev.courseSections || []), section],
        courses: prev.courses.map(c =>
          c.id === courseId
            ? { ...c, sectionIds: [...(c.sectionIds || []), section.id] }
            : c
        )
      }));

      return section;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create section.';
      setLastError(message);
      showAlert(message, 'Create Section Failed');
      throw err;
    }
  };

  const updateSection = async (sectionId: string, updates: Partial<CourseSection>): Promise<boolean> => {
    const patchBody: Record<string, string | number> = {};
    if (updates.name !== undefined) patchBody.name = updates.name;
    if (updates.capacity !== undefined) patchBody.capacity = updates.capacity;
    if (updates.schedule !== undefined) patchBody.schedule = updates.schedule;
    if (updates.location !== undefined) patchBody.room = updates.location;
    try {
      // Likha ERP is the source of truth (Express /api/sections is RAG-only now).
      // location maps to the Directus `room` field (same mapping as createSection).
      const row = await likhaLmsApi.sections.updateSection(sectionId, patchBody);
      setDb(prev => ({
        ...prev,
        courseSections: (prev.courseSections || []).map((s: CourseSection) =>
          s.id === sectionId
            ? {
                ...s,
                name: (row as any)?.name ?? s.name,
                capacity: (row as any)?.capacity ?? s.capacity,
                schedule: (row as any)?.schedule ?? s.schedule,
                location: (row as any)?.room ?? (row as any)?.location ?? s.location
              }
            : s
        )
      }));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update section.';
      setLastError(message);
      showAlert(message, 'Update Section Failed');
      return false;
    }
  };

  const deleteSection = async (sectionId: string): Promise<boolean> => {
    const section = (db.courseSections || []).find((s: CourseSection) => s.id === sectionId);
    const isOccupied = db.users.some(u =>
      Object.values(u.courseSections || {}).includes(sectionId)
    );
    const hasPendingRequests = section
      ? (db.enrollmentRequests || []).some(
          (r: EnrollmentRequest) => r.courseId === section.courseId && r.status === 'pending'
        )
      : false;
    if (isOccupied || hasPendingRequests) {
      showAlert(
        'This section cannot be deleted because students are assigned to it or there are pending enrollment requests for this course.',
        'Delete Blocked'
      );
      return false;
    }
    try {
      // Likha ERP is the source of truth (Express /api/sections is RAG-only now).
      await likhaLmsApi.sections.deleteSection(sectionId);
      setDb(prev => ({
        ...prev,
        courseSections: (prev.courseSections || []).filter((s: CourseSection) => s.id !== sectionId),
        courses: prev.courses.map(c => ({
          ...c,
          sectionIds: (c.sectionIds || []).filter(id => id !== sectionId)
        }))
      }));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete section.';
      setLastError(message);
      showAlert(message, 'Delete Section Failed');
      return false;
    }
  };

  const getCourseSections = (courseId: string): CourseSection[] => {
    return (db.courseSections || []).filter((s: CourseSection) => s.courseId === courseId);
  };

  const getStudentSection = (courseId: string): CourseSection | null => {
    const sectionId = activeUser.courseSections?.[courseId];
    if (!sectionId) return null;
    return (db.courseSections || []).find((s: CourseSection) => s.id === sectionId) || null;
  };

  // ==========================================
  // ENROLLMENT REQUEST WORKFLOW
  // ==========================================

  const createEnrollmentRequest = async (courseId: string, type: 'self_join' | 'faculty_enroll'): Promise<EnrollmentRequest> => {
    try {
      if (type === 'self_join') {
        // The join code comes from cache, but bootstrap rows predate the
        // joinCode mapping — a codeless cached course resolves via the same
        // getCourses() fallback joinCourseByCode uses.
        const course = db.courses.find(c => c.id === courseId);
        let joinCode =
          course?.joinCode ?? (course as unknown as { join_code?: string })?.join_code;
        if (!joinCode) {
          const courses = await likhaLmsApi.courses.getCourses().catch(() => []);
          const match = (courses || []).find((c: any) => String(c.id) === courseId);
          joinCode = match?.join_code ?? match?.joinCode;
        }
        if (!joinCode) {
          throw new ApiError(400, 'bad_request', 'Join code for this course is not available.');
        }
        const row = await likhaLmsApi.requests.createRequest({
          course_id: courseId,
          student_id: activeUser.id,
          student_name: activeUser.name,
          type,
          status: 'pending'
        });
        const request = mapLikhaRequestRow({
          course_id: courseId,
          student_id: activeUser.id,
          student_name: activeUser.name,
          type,
          status: 'pending',
          requested_at: new Date().toISOString(),
          ...(row as any)
        });
        setDb(prev => mergeEnrollmentRequest(prev, request));

        return request;
      }
      const row = await likhaLmsApi.requests.createRequest({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type,
        status: 'pending'
      });
      const request = mapLikhaRequestRow({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type,
        status: 'pending',
        requested_at: new Date().toISOString(),
        ...(row as any)
      });
      setDb(prev => mergeEnrollmentRequest(prev, request));

      return request;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create enrollment request.';
      setLastError(message);
      showAlert(message, 'Request Failed');
      throw err;
    }
  };

  const approveEnrollmentRequests = async (requestIds: string[]): Promise<boolean> => {
    if (activeRole !== 'faculty' && activeRole !== 'admin' && activeRole !== 'superadmin') return false;
    const succeeded: string[] = [];
    try {
      // Likha ERP is the source of truth — per-id status PATCH, in sequence.
      for (const requestId of requestIds) {
        await likhaLmsApi.requests.updateRequest(requestId, { status: 'approved' });
        succeeded.push(requestId);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to approve requests.';
      setLastError(message);
      showAlert(message, 'Approve Failed');
      if (succeeded.length === 0) return false;
    }
    const effectiveIds = succeeded.length > 0 ? succeeded : requestIds;

    setDb(prev => {
      const now = new Date().toISOString();
      const existingRequests = prev.enrollmentRequests || [];
      const requestsToApprove = existingRequests.filter(
        (r: EnrollmentRequest) => effectiveIds.includes(r.id) && r.status === 'pending'
      );

      const enrollmentApprovals = requestsToApprove.filter(
        (r: EnrollmentRequest) => r.type !== 'section_switch'
      );
      const switchApprovals = requestsToApprove.filter(
        (r: EnrollmentRequest) => r.type === 'section_switch'
      );

      const studentIds = enrollmentApprovals.map((r: EnrollmentRequest) => r.studentId);
      const courseIds = [...new Set(enrollmentApprovals.map((r: EnrollmentRequest) => r.courseId))];

      let updatedUsers = prev.users;
      let updatedCourses = prev.courses;
      let updatedSections = prev.courseSections || [];

      for (const courseId of courseIds) {
        const courseStudents = studentIds.filter((sid: string) =>
          enrollmentApprovals.find((r: EnrollmentRequest) => r.studentId === sid && r.courseId === courseId)
        );

        updatedUsers = updatedUsers.map(u => {
          if (courseStudents.includes(u.id)) {
            const currentCourses: string[] = u.enrolledCourseIds || [];
            if (!currentCourses.includes(courseId)) {
              return { ...u, enrolledCourseIds: [...currentCourses, courseId] };
            }
          }
          return u;
        });

        updatedCourses = updatedCourses.map(c => {
          if (c.id === courseId) {
            return { ...c, enrolledCount: (c.enrolledCount || 0) + courseStudents.length };
          }
          return c;
        });
      }

      const skippedSwitchIds: string[] = [];

      for (const req of switchApprovals) {
        const target = (updatedSections || []).find((s: CourseSection) => s.id === req.targetSectionId);
        if (!target || !canPickSection(target)) {
          skippedSwitchIds.push(req.id);
          continue;
        }
        const student = updatedUsers.find(u => u.id === req.studentId);
        const oldSectionId = student?.courseSections?.[req.courseId];
        if (oldSectionId && oldSectionId !== req.targetSectionId) {
          updatedSections = updatedSections.map((s: CourseSection) =>
            s.id === oldSectionId ? { ...s, enrolledCount: Math.max(0, s.enrolledCount - 1) } : s
          );
          updatedSections = updatedSections.map((s: CourseSection) =>
            s.id === req.targetSectionId ? { ...s, enrolledCount: s.enrolledCount + 1 } : s
          );
        } else if (!oldSectionId) {
          updatedSections = updatedSections.map((s: CourseSection) =>
            s.id === req.targetSectionId ? { ...s, enrolledCount: s.enrolledCount + 1 } : s
          );
        }
        if (oldSectionId !== req.targetSectionId) {
          updatedUsers = updatedUsers.map(u =>
            u.id === req.studentId
              ? { ...u, courseSections: { ...(u.courseSections || {}), [req.courseId]: req.targetSectionId as string } }
              : u
          );
        }
      }

      const skippedSet = new Set(skippedSwitchIds);

      return {
        ...prev,
        users: updatedUsers,
        courses: updatedCourses,
        courseSections: updatedSections,
        enrollmentRequests: existingRequests.map((r: EnrollmentRequest) =>
          effectiveIds.includes(r.id) && r.status === 'pending' && !skippedSet.has(r.id)
            ? { ...r, status: 'approved' as const, resolvedAt: now, resolvedBy: activeUser.id }
            : r
        )
      };
    });
    return true;
  };

  const rejectEnrollmentRequests = async (requestIds: string[]): Promise<boolean> => {
    if (activeRole !== 'faculty' && activeRole !== 'admin' && activeRole !== 'superadmin') return false;
    const succeeded: string[] = [];
    try {
      // Likha ERP is the source of truth — per-id status PATCH, in sequence.
      for (const requestId of requestIds) {
        await likhaLmsApi.requests.updateRequest(requestId, { status: 'rejected' });
        succeeded.push(requestId);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to reject requests.';
      setLastError(message);
      showAlert(message, 'Reject Failed');
      if (succeeded.length === 0) return false;
    }
    const effective = new Set(succeeded.length > 0 ? succeeded : requestIds);

    setDb(prev => ({
      ...prev,
      enrollmentRequests: (prev.enrollmentRequests || []).map((r: EnrollmentRequest) =>
        effective.has(r.id) && r.status === 'pending'
          ? { ...r, status: 'rejected' as const, resolvedAt: new Date().toISOString(), resolvedBy: activeUser.id }
          : r
      )
    }));
    return true;
  };

  const removeStudentFromCourse = async (courseId: string, studentId: string): Promise<boolean> => {
    if (activeRole !== 'faculty' && activeRole !== 'admin' && activeRole !== 'superadmin') return false;
    // Likha ERP is the source of truth: delete the approved request rows.
    // Synthetic `enr-` ids come from the Course_Enrollments read model and
    // have no deletable request row, so only real ids are deleted remotely.
    // No-op when nothing is actually approved for the pair: previously this
    // decremented the course count and reported success with zero remote
    // calls (success-with-nothing), so bail out before touching any counts.
    const approvedForPair = (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) =>
        r.courseId === courseId && r.studentId === studentId && r.status === 'approved'
    );
    if (approvedForPair.length === 0) return false;
    const approvedIds = approvedForPair
      .filter((r: EnrollmentRequest) => !r.id.startsWith('enr-'))
      .map((r: EnrollmentRequest) => r.id);
    try {
      for (const id of approvedIds) {
        await likhaLmsApi.requests.deleteRequest(id);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to remove student.';
      setLastError(message);
      showAlert(message, 'Remove Failed');
      return false;
    }
    // Coursework (submissions, grades) stays intact — only membership is
    // revoked, so the student can rejoin later via code or invite.
    setDb(prev => {
      const freedSectionIds = new Set(
        (prev.enrollmentRequests || [])
          .filter(
            (r: EnrollmentRequest) =>
              r.courseId === courseId && r.studentId === studentId && r.status === 'approved' && r.targetSectionId
          )
          .map((r: EnrollmentRequest) => r.targetSectionId as string)
      );
      return {
        ...prev,
        users: (prev.users || []).map(u => {
          if (u.id !== studentId) return u;
          const next: User = {
            ...u,
            enrolledCourseIds: (u.enrolledCourseIds || []).filter(id => id !== courseId)
          };
          if (next.courseSections && next.courseSections[courseId]) {
            const { [courseId]: _dropped, ...rest } = next.courseSections;
            next.courseSections = rest;
          }
          return next;
        }),
        courses: (prev.courses || []).map(c =>
          c.id === courseId ? { ...c, enrolledCount: Math.max(0, (c.enrolledCount || 0) - 1) } : c
        ),
        courseSections: (prev.courseSections || []).map((s: CourseSection) =>
          freedSectionIds.has(s.id) ? { ...s, enrolledCount: Math.max(0, s.enrolledCount - 1) } : s
        ),
        enrollmentRequests: (prev.enrollmentRequests || []).filter(
          (r: EnrollmentRequest) =>
            !(r.courseId === courseId && r.studentId === studentId && r.status === 'approved')
        )
      };
    });
    return true;
  };

  const studentApproveInvitation = async (requestId: string): Promise<boolean> => {
    try {
      // Likha ERP is the source of truth (Express /api/requests is RAG-only now).
      // PATCH may return a partial row — merge over the cached request so the
      // ids the mapping needs survive a thin response.
      const row = await likhaLmsApi.requests.updateRequest(requestId, { status: 'approved' });
      const cached = (db.enrollmentRequests || []).find((r: EnrollmentRequest) => r.id === requestId);
      const request = mapLikhaRequestRow({ ...(cached ?? {}), ...(row as any) });
      if (request.studentId !== activeUser.id) return false;

      const updatedUser = {
        ...activeUser,
        enrolledCourseIds: [...new Set([...(activeUser.enrolledCourseIds || []), request.courseId])]
      };
      setCurrentUser(updatedUser);

      // Fetch the newly-approved course so it appears without a page refresh.
      // Student course lists are scoped to db.courses (enrolled only), so a
      // map-only update would be a no-op when the course isn't cached yet.
      let freshCourse: Course | null = null;
      try {
        const courseRow = await likhaLmsApi.courses.getCourse(request.courseId);
        freshCourse = courseRow ? normalizeCourseSyllabus(courseRow) : null;
      } catch {
        freshCourse = null;
      }

      setDb(prev => ({
        ...mergeEnrollmentRequest(prev, request),
        users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u),
        courses: (() => {
          const exists = prev.courses.some(c => c.id === request.courseId);
          if (exists) {
            return prev.courses.map(c =>
              c.id === request.courseId
                ? { ...c, enrolledCount: (c.enrolledCount || 0) + 1 }
                : c
            );
          }
          if (freshCourse) {
            return [...prev.courses, { ...freshCourse, enrolledCount: (freshCourse.enrolledCount || 0) + 1 } as Course];
          }
          // Fallback: minimal row from request payload so lists still update.
          const fallback = {
            id: request.courseId,
            code: (request as unknown as { courseCode?: string }).courseCode || request.courseId,
            title: (request as unknown as { courseTitle?: string }).courseTitle || request.courseId,
            section: '',
            enrolledCount: 1,
          } as unknown as Course;
          return [...prev.courses, fallback];
        })()
      }));
      setActiveCourseId(request.courseId);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to accept invitation.';
      setLastError(message);
      showAlert(message, 'Accept Failed');
      return false;
    }
  };

  const studentDeclineInvitation = async (requestId: string): Promise<boolean> => {
    try {
      // Likha ERP is the source of truth — declined invites are deleted.
      await likhaLmsApi.requests.deleteRequest(requestId);
      // Mirror by dropping the row from cache.
      setDb(prev => ({
        ...prev,
        enrollmentRequests: (prev.enrollmentRequests || []).filter(
          (r: EnrollmentRequest) => !(r.id === requestId && r.studentId === activeUser.id)
        )
      }));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to decline invitation.';
      setLastError(message);
      showAlert(message, 'Decline Failed');
      return false;
    }
  };

  const selectSection = async (courseId: string, sectionId: string): Promise<boolean> => {
    const bypassGate = activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin';
    if (!bypassGate) {
      const hasApproval = (db.enrollmentRequests || []).some(
        (r: EnrollmentRequest) =>
          r.studentId === activeUser.id && r.courseId === courseId && r.status === 'approved'
      );
      if (!hasApproval) {
        showAlert(
          'You need an approved enrollment request before selecting a section.',
          'Section Selection Blocked'
        );
        return false;
      }
    }

    const targetSection = (db.courseSections || []).find((s: CourseSection) => s.id === sectionId);
    if (!targetSection) return false;
    if (!canPickSection(targetSection)) {
      showAlert('This section is full. Please choose another section.', 'Section Full');
      return false;
    }

    try {
      // likha-gap: client-created approved section_switch with no server
      // capacity enforcement and no enrolled_count increment. The old
      // choose-section endpoint is gone (server/routes is RAG-only) and
      // Likha has no atomic check-and-increment, so faithful parity would be
      // a racy read-modify-write PATCH of enrolled_count. The client-side
      // canPickSection gate + authoritative section refresh below is the
      // minimum — revisit if Likha gains a transactional section-pick op.
      // Likha ERP is the source of truth: record the section choice as an
      // effective-immediately request, then refresh the authoritative counts.
      const row = await likhaLmsApi.requests.createRequest({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'section_switch',
        target_section_id: sectionId,
        status: 'approved'
      });
      const request = mapLikhaRequestRow({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'section_switch',
        target_section_id: sectionId,
        status: 'approved',
        requested_at: new Date().toISOString(),
        ...(row as any)
      });

      // Section counts are authoritative in Likha — refresh them, keeping
      // the client-only schedule/location overlay.
      try {
        const rows = await likhaLmsApi.sections.getSections(courseId);
        const sections = (rows || []).map(mapLikhaSectionRow);
        setDb(prev => {
          const prevById = new Map((prev.courseSections || []).map(s => [s.id, s]));
          const refreshed = sections.map(s => ({
            ...s,
            schedule: s.schedule || prevById.get(s.id)?.schedule || '',
            location: s.location || prevById.get(s.id)?.location || ''
          }));
          return {
            ...prev,
            courseSections: [
              ...(prev.courseSections || []).filter(s => s.courseId !== courseId),
              ...refreshed
            ]
          };
        });
      } catch {
        // Keep cached counts when the refresh fails.
      }

      // User.courseSections stays a client-side cache, maintained from the
      // section-choice response.
      const chosenId = request.targetSectionId || sectionId;
      const updatedSections = { ...(activeUser.courseSections || {}), [courseId]: chosenId };
      const updatedUser = { ...activeUser, courseSections: updatedSections };
      setCurrentUser(updatedUser);

      setDb(prev => ({
        ...mergeEnrollmentRequest(prev, request),
        users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u)
      }));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to select section.';
      setLastError(message);
      showAlert(message, 'Section Selection Failed');
      return false;
    }
  };

  const requestSectionSwitch = async (courseId: string, targetSectionId: string): Promise<boolean> => {
    if (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') return false;
    const currentSectionId = activeUser.courseSections?.[courseId];
    if (currentSectionId === targetSectionId) return false;
    const duplicate = (db.enrollmentRequests || []).some(
      (r: EnrollmentRequest) =>
        r.studentId === activeUser.id &&
        r.courseId === courseId &&
        r.type === 'section_switch' &&
        r.targetSectionId === targetSectionId &&
        r.status === 'pending'
    );
    if (duplicate) return false;
    try {
      // Likha ERP is the source of truth — a pending section_switch request.
      const row = await likhaLmsApi.requests.createRequest({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'section_switch',
        target_section_id: targetSectionId,
        status: 'pending'
      });
      const request = mapLikhaRequestRow({
        course_id: courseId,
        student_id: activeUser.id,
        student_name: activeUser.name,
        type: 'section_switch',
        target_section_id: targetSectionId,
        status: 'pending',
        requested_at: new Date().toISOString(),
        ...(row as any)
      });
      setDb(prev => mergeEnrollmentRequest(prev, request));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to request section switch.';
      setLastError(message);
      showAlert(message, 'Switch Request Failed');
      return false;
    }
  };

  const getPendingRequestsForCourse = async (courseId: string): Promise<EnrollmentRequest[]> => {
    try {
      // Likha ERP is the source of truth (Express /api/courses is RAG-only now).
      const rows = await likhaLmsApi.requests.getRequests(courseId, 'pending');
      const requests = (rows || []).map(mapLikhaRequestRow);
      setDb(prev => ({
        ...prev,
        // REPLACE (not merge) this course's cached pendings with server truth.
        enrollmentRequests: [
          ...(prev.enrollmentRequests || []).filter(
            (r: EnrollmentRequest) => !(r.courseId === courseId && r.status === 'pending')
          ),
          ...requests,
        ],
      }));
      return requests;
    } catch (err) {
      // Read path: stay silent (no modal) and serve the cache.
      setLastError(err instanceof ApiError ? err.message : 'Failed to load requests.');
      return (db.enrollmentRequests || []).filter((r: EnrollmentRequest) => r.courseId === courseId && r.status === 'pending');
    }
  };

  const getPendingRequestsForStudent = (): EnrollmentRequest[] => {
    return (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.status === 'pending' && (r.type === 'faculty_enroll' || r.type === 'self_join' || r.type === 'section_switch')
    );
  };

  const getApprovedRequestsForCourse = async (courseId: string): Promise<EnrollmentRequest[]> => {
    try {
      const rows = await likhaLmsApi.requests.getRequests(courseId, 'approved');
      if (Array.isArray(rows)) {
        const mapped = rows.map((r: any) => ({
          id: String(r.id),
          courseId: String(r.course_id ?? r.courseId ?? courseId),
          studentId: String(r.student_id ?? r.studentId ?? ''),
          status: 'approved',
          type: r.type ?? 'self_join',
          requestedAt: r.requested_at ?? r.requestedAt,
        })) as EnrollmentRequest[];
        setDb(prev => ({
          ...prev,
          enrollmentRequests: [
            ...(prev.enrollmentRequests || []).filter(
              (rr: EnrollmentRequest) => !(rr.courseId === courseId && rr.status === 'approved')
            ),
            ...mapped,
          ],
        }));
        return mapped;
      }
    } catch {
      // Fall through to cache.
    }
    return (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.courseId === courseId && r.status === 'approved'
    );
  };

  const requestJoinCourse = async (courseId: string): Promise<boolean> => {
    if (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') return false;
    const mine = (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.courseId === courseId
    );
    if (mine.some((r: EnrollmentRequest) => r.status === 'pending')) return false;
    if (
      mine.some((r: EnrollmentRequest) => r.status === 'approved') &&
      (activeUser.enrolledCourseIds || []).includes(courseId)
    ) return false;
    try {
      await createEnrollmentRequest(courseId, 'self_join');
      return true;
    } catch {
      // createEnrollmentRequest already surfaced the alert.
      return false;
    }
  };

  const getMyRequest = (courseId: string): EnrollmentRequest | null => {
    const mine = (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.courseId === courseId
    );
    return mine.length > 0 ? mine[mine.length - 1] : null;
  };

  const getPendingRequests = (courseId: string): Promise<EnrollmentRequest[]> => {
    return getPendingRequestsForCourse(courseId);
  };

  return (
    <LMSContext.Provider
      value={{
        theme,
        toggleTheme,
        accent,
        customAccentHex,
        setAccent,
        setCustomAccentHex,
        resetAccent,
        isAuthenticated,
        currentUser,
        activeUser,
        activeRole,
        login,
        logout,
        switchRole,
        isLoading,
        isSyncing,
        authReady,
        lastError,
        activeCourseId,
        setActiveCourseId,
        hydrateCourse,
        db,
        activeSpeedGraderSubmissionId,
        openSpeedGrader,
        closeSpeedGrader,
        isHistoryDrawerOpen,
        setIsHistoryDrawerOpen,
        isHelpDrawerOpen,
        setIsHelpDrawerOpen,
        isRoleModalOpen,
        setIsRoleModalOpen,
        isUserProfileModalOpen,
        setIsUserProfileModalOpen,
        showAlert,
        showConfirm,
        closeAlert,
        createCourse,
        deleteCourse,
        createModule,
        updateModule,
        deleteModule,
        addModuleItem,
        updateModuleItem,
        deleteModuleItem,
        createQuiz,
        recordQuizSubmission,
        createExam,
        recordExamSubmission,
        createActivity,
        updateActivity,
        recordActivitySubmission,
        deleteActivity,
        enrollPerson,
        enrollStudentsInCourse,
        createUser,
        updateUser,
        deleteUser,
        joinCourseByCode,
        regenerateCourseJoinCode,
        updateCourseSyllabus,
        removeCourseSyllabus,
        syllabusRevisions,
        refreshPublishedSyllabus,
        updateSyllabusSection,
        publishSyllabusDraft,
        updateCourseGradingTerms,
        setGradesReleased,
        effectiveTermsForCourse,
        isCourseGradeReady,
        importCommonsTemplate,
        gradeSubmission,
        upsertManualExamGrade,
        submitActivity,
        toggleModulePublish,
        toggleItemCompletion,
        addModuleComment,
        editModuleComment,
        deleteModuleComment,
        toggleLikeModuleComment,
        sendMessage,
        createChatGroup,
        markThreadAsRead,
        toggleMessageReaction,
        bookAdvisingSlot,
        createAdvisingSlot,
        addCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        createAnnouncement,
        deleteAnnouncement,
        togglePinAnnouncement,
        toggleLikeAnnouncement,
        addAnnouncementReply,
        markAnnouncementRead,
        notifications,
        getUnreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        markTabVisited,
        markModuleCommentsRead,
        getNotifications,
        createDiscussion,
        deleteDiscussion,
        togglePinDiscussion,
        toggleLockDiscussion,
        addDiscussionReply,
        toggleLikeDiscussionReply,
        createCourseFolder,
        uploadCourseFile,
        deleteCourseFile,
        deleteCourseFolder,
        updateFileVisibility,
        renameCourseFile,
        setCourseStudentGrade,
        getSPRConfig,
        saveSPRConfig,
        setSPRCell,
        resetSPRCell,
        bulkImportSPRColumns,
        createSection,
        updateSection,
        deleteSection,
        getCourseSections,
        getStudentSection,
        createEnrollmentRequest,
        approveEnrollmentRequests,
        rejectEnrollmentRequests,
        removeStudentFromCourse,
        studentApproveInvitation,
        studentDeclineInvitation,
        selectSection,
        requestSectionSwitch,
        getPendingRequestsForCourse,
        getApprovedRequestsForCourse,
        getPendingRequestsForStudent,
        requestJoinCourse,
        getMyRequest,
        getPendingRequests,
        colleges,
        departments,
        programs: departments,
        pendingRegistrations,
        registerAccount,
        activateEmail,
        verifyRegistration,
        rejectRegistration,
        purgeExpiredRegistrations,
        transferLeadership,
        addCollege,
        addDepartment,
        addProgram,
        deleteCollege,
        deleteDepartment,
        deleteProgram,
        getCollegeDeleteBlockers,
        getDepartmentDeleteBlockers,
        getProgramDeleteBlockers,
        schoolYears,
        addSchoolYear,
        setActiveSchoolYear,
        getSchoolYearsByCollege,
        getActiveSchoolYearForCollege,
        setBaselineSchoolYear,
        getBaselineSchoolYear,
        logHistory,
        clearHistory,
        isSessionExpired,
        dismissSessionExpired: handleSessionExpiredBackToLogin
      }}
    >
      {children}
      <AlertModal
        isOpen={isAlertOpen}
        options={alertOptions}
        onClose={closeAlert}
      />
      <SessionExpiredModal
        isOpen={isSessionExpired}
        onBackToLogin={handleSessionExpiredBackToLogin}
      />
    </LMSContext.Provider>
  );
};

export const useLMS = () => {
  const context = useContext(LMSContext);
  if (!context) {
    throw new Error('useLMS must be used within an LMSProvider');
  }
  return context;
};
