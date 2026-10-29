import { deduplicatePendingRegistrations } from '../utils/registration';
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
  SubmissionAttachment,
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
  SchoolYear,
  AcademicSemester,
  LeadershipTenure,
  GovernanceAuditLog,
  LeadershipRoleType,
  TenureStatus
} from '../types/lms';
import type { Activity } from '../types/lms';
import { formatSemesterLabel, normalizeAcademicSemester } from '../utils/academicSemester';
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
import { type AssetTransformOptions, hasCustomAvatar, isDefaultAvatarUrl } from '../utils/avatar';
import { canPickSection } from '../utils/sections';
import type { OfficialSyllabusData } from '../data/syllabusData';
import { ApiError, getToken, setToken, clearToken, likhaLmsApi, LIKHA_URL } from '../api/client';
import { likhaCache } from '../api/likhaCache';
const SESSION_EXPIRED_EVENT = 'gabay:session-expired';
import { syllabusApi, deleteDraft, withdrawSyllabus } from '../api/syllabus';
import type { SyllabusRevisionHeader, SyllabusRevisionResponse, SyllabusSectionKey } from '../types/syllabusApi';
import { settledValue } from '../utils/promise';
import { formatFileSize, parseFormattedSize, toShortFileType, extractDirectusFileId } from '../utils/fileUploader';
import { isValidUuid, generateSecureActivationToken, generateUuid, generateSecureId, generateSecureDigits } from '../utils/cryptoToken';
import { isChairRole, isDeanRole, isFacultyRole, canDeleteCourse, canManageCourseContent } from '../utils/roles';
import { canUserCommentOnCourse } from '../utils/courseScoping';

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
  login: (emailOrId: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string; user?: User }>;
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
  updateCourse: (courseId: string, updates: Partial<Course>) => Promise<Course>;
  deleteCourse: (courseId: string) => Promise<void>;
  createModule: (courseId: string, title: string) => Promise<Module>;
  updateModule: (moduleId: string, updates: Partial<Module>) => Promise<void>;
  deleteModule: (moduleId: string) => Promise<void>;
  addModuleItem: (moduleId: string, item: Partial<ModuleItem>) => Promise<void>;
  updateModuleItem: (currentModuleId: string, itemId: string, updates: Partial<ModuleItem>, targetModuleId?: string) => Promise<void>;
  deleteModuleItem: (moduleId: string, itemId: string) => Promise<void>;
  createQuiz: (quiz: Partial<Quiz>) => Promise<Quiz>;
  updateQuiz: (quizId: string, updates: Partial<Quiz>) => Promise<Quiz>;
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
  updateUser: (userId: string, updates: Partial<User> & { banner?: string; avatarFileId?: string }) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  refreshUsers: () => Promise<User[]>;
  joinCourseByCode: (joinCode: string) => Promise<{ success: boolean; message: string; course?: Course }>;
  regenerateCourseJoinCode: (courseId: string) => Promise<string>;
  updateCourseSyllabus: (courseId: string, syllabus: OfficialSyllabusData) => Promise<void>;
  updateCourseSyllabusStatus: (courseIds: string[], status: string, releasedBy?: string) => Promise<void>;
  removeCourseSyllabus: (courseId: string) => Promise<void>;
  syllabusRevisions: Record<string, SyllabusRevisionHeader>;
  refreshPublishedSyllabus: (courseId: string) => Promise<void>;
  refreshCourseSyllabus: (courseId: string) => Promise<void>;
  updateSyllabusSection: (courseId: string, section: SyllabusSectionKey, value: unknown) => Promise<void>;
  publishSyllabusDraft: (courseId: string) => Promise<void>;
  updateCourseGradingTerms: (courseId: string, gradingTerms: TermId[] | null) => Promise<void>;
  setGradesReleased: (courseId: string, term: TermId, released: boolean) => Promise<void>;
  effectiveTermsForCourse: (courseId: string) => TermId[];
  isCourseGradeReady: (courseId: string) => boolean;
  hasCourseSyllabus: (courseId: string) => boolean;
  importCommonsTemplate: (templateId: string, targetCourseId: string) => Promise<{ success: boolean; message: string }>;

  gradeSubmission: (
    submissionId: string,
    grade: number,
    rubricScores: Record<string, number>,
    commentText?: string
  ) => Promise<void>;
  upsertManualExamGrade: (
    courseIdOrExamId: string,
    termOrStudentId: string,
    studentIdOrGrade: string | number,
    maybeGrade?: number
  ) => Promise<void>;
  submitActivity: (
    activityId: string,
    submissionType: 'file' | 'online_text',
    content?: string,
    fileName?: string,
    answers?: Record<string, string>,
    fileUrl?: string,
    fileId?: string,
    fileSize?: string,
    attachments?: SubmissionAttachment[]
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
  deleteAnnouncementReply: (announcementId: string, replyId: string) => Promise<void>;
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
      /**
       * Omit for `@dmmmsu.edu.ph` applicants: the role is left unassigned for a
       * chair or dean to settle when they approve. `@student.dmmmsu.edu.ph`
       * addresses are always registered as students.
       */
      role?: 'student' | 'faculty' | 'staff';
      collegeId: string;
      collegeName?: string;
      department: string;
      studentId: string;
      password: string;
    } & Partial<PendingRegistration>
  ) => Promise<PendingRegistration>;
  activateEmail: (token: string) => Promise<{ success: boolean; message: string }>;
  verifyRegistration: (id: string, assignedRole?: 'faculty' | 'staff') => Promise<{ success: boolean; message: string; user?: User }>;
  rejectRegistration: (id: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  purgeExpiredRegistrations: () => Promise<number>;
  transferLeadership: (
    roleType: LeadershipRoleType,
    currentLeaderId: string,
    successorId: string,
    unitId: string,
    transitionNotes?: string,
    appointeeMetadata?: {
      title?: string;
      resolutionNo?: string;
    }
  ) => Promise<{ success: boolean; message: string }>;
  appointLeadership: (
    roleType: LeadershipRoleType,
    leaderId: string,
    unitId: string,
    transitionNotes?: string
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

  // Semester Management
  baselineSemester: AcademicSemester;
  setBaselineSemester: (semester: AcademicSemester) => Promise<{ success: boolean; message?: string }>;
  getActiveSemesterForCollege: (collegeId?: string) => AcademicSemester;
  setActiveSemesterForCollege: (
    collegeId: string,
    semester: AcademicSemester
  ) => Promise<{ success: boolean; message?: string }>;

  // Institutional Governance & Leadership Timeline
  leadershipTenures: LeadershipTenure[];
  governanceAuditLogs: GovernanceAuditLog[];
  logGovernanceEvent: (event: Omit<GovernanceAuditLog, 'id' | 'timestamp'>) => void;
  getTenureMetrics: (tenure: LeadershipTenure) => {
    coursesCreated: number;
    studentsEnrolled: number;
    syllabiCount: number;
    facultyAssigned: number;
  };
  getTenureAuditTrail: (tenure: LeadershipTenure) => Array<{
    id: string;
    timestamp: string;
    title: string;
    description: string;
    eventType: string;
    actorName?: string;
  }>;

  logHistory: (path: string, title: string) => void;
  clearHistory: () => void;
}

const STORAGE_KEY_THEME = 'gabay_theme_v1';
const STORAGE_KEY_COLLEGES = 'gabay_colleges';
const STORAGE_KEY_DEPARTMENTS = 'gabay_departments';
const STORAGE_KEY_PENDING_REGISTRATIONS = 'gabay_pending_registrations';
const STORAGE_KEY_SCHOOL_YEARS = 'gabay_school_years';
const STORAGE_KEY_COLLEGE_ACTIVE_SY = 'gabay_college_active_school_years';
const STORAGE_KEY_BASELINE_SEMESTER = 'gabay_baseline_semester_v1';
const STORAGE_KEY_COLLEGE_ACTIVE_SEMESTERS = 'gabay_college_active_semesters';
export const STORAGE_KEY_DB = 'gabay_lms_db_v6';
export const STORAGE_KEY_USER_PROFILES = 'gabay_user_profiles_v1';
export const STORAGE_KEY_LEADERSHIP_TENURES = 'gabay_leadership_tenures_v1';
export const STORAGE_KEY_GOVERNANCE_AUDIT_LOGS = 'gabay_governance_audit_logs_v1';
export const STORAGE_KEY_TAB_VISITS = 'gabay_lms_tab_visits_v1';

export const loadStoredTabVisits = (userId?: string): Record<string, string> => {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAB_VISITS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed[userId] || {};
      }
    }
  } catch (_) {}
  return {};
};

export const saveStoredTabVisit = (userId: string, key: string, stamp: string): void => {
  if (!userId) return;
  try {
    let store: Record<string, Record<string, string>> = {};
    const raw = localStorage.getItem(STORAGE_KEY_TAB_VISITS);
    if (raw) {
      try { store = JSON.parse(raw) || {}; } catch (_) {}
    }
    if (!store[userId]) store[userId] = {};
    store[userId][key] = stamp;
    safeSetLocalStorage(STORAGE_KEY_TAB_VISITS, JSON.stringify(store));
  } catch (_) {}
};

const safeSetLocalStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`LocalStorage setItem failed for "${key}".`, err);
    return false;
  }
};

export const loadStoredUserProfiles = (): Record<string, Partial<User>> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (_) {}
  return {};
};

export const saveStoredUserProfile = (userId: string, updates: Partial<User>, emailHint?: string): void => {
  if (!userId) return;
  try {
    const store = loadStoredUserProfiles();
    const cleanEmail = (updates.email || emailHint || '').trim().toLowerCase();
    const existing = store[userId] || (cleanEmail ? store[cleanEmail] : undefined) || {};
    const merged = { ...existing, ...updates };
    store[userId] = merged;
    if (cleanEmail) {
      store[cleanEmail] = merged;
    }
    safeSetLocalStorage(STORAGE_KEY_USER_PROFILES, JSON.stringify(store));
  } catch (_) {}
};

export const getCleanStoredAvatar = (id?: string): string => {
  if (typeof window === 'undefined' || !id) return '';
  const val = localStorage.getItem(`gabay_avatar_${id}`) || '';
  if (val.startsWith('/uploads/') || isDefaultAvatarUrl(val)) {
    localStorage.removeItem(`gabay_avatar_${id}`);
    return '';
  }
  return val;
};

export const getCleanStoredBanner = (id?: string): string | undefined => {
  if (typeof window === 'undefined' || !id) return undefined;
  const val = localStorage.getItem(`gabay_banner_${id}`);
  if (!val) return undefined;
  if (val.startsWith('/uploads/')) {
    localStorage.removeItem(`gabay_banner_${id}`);
    return undefined;
  }
  return val;
};

const STORAGE_KEY_ANNOUNCEMENT_ATTACHMENTS = 'gabay_announcement_attachments_v1';

export const loadStoredAnnouncementAttachments = (annId?: string): { name: string; size: string; url?: string }[] => {
  if (typeof window === 'undefined' || !annId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENT_ATTACHMENTS);
    if (!raw) return [];
    const map = JSON.parse(raw);
    return Array.isArray(map[annId]) ? map[annId] : [];
  } catch {
    return [];
  }
};

export const saveStoredAnnouncementAttachments = (annId: string, attachments: { name: string; size: string; url?: string }[]): void => {
  if (typeof window === 'undefined' || !annId || !Array.isArray(attachments)) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENT_ATTACHMENTS);
    const map = raw ? JSON.parse(raw) : {};
    if (attachments.length === 0) {
      delete map[annId];
    } else {
      map[annId] = attachments;
    }
    safeSetLocalStorage(STORAGE_KEY_ANNOUNCEMENT_ATTACHMENTS, JSON.stringify(map));
  } catch {}
};

export const applyStoredUserProfile = (user: User, profiles?: Record<string, Partial<User>>): User => {
  const store = profiles || loadStoredUserProfiles();
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const saved = store[user.id] || (cleanEmail ? store[cleanEmail] : undefined);

  // Prefer fresh custom avatar from Directus backend over any stored fallback or default Unsplash URL
  const customBackendAvatar = (user.avatar && hasCustomAvatar(user.avatar)) ? user.avatar : undefined;
  const customSavedAvatar = (saved?.avatar && hasCustomAvatar(saved.avatar)) ? saved.avatar : undefined;
  const effectiveAvatar = customBackendAvatar || customSavedAvatar || user.avatar || saved?.avatar || '';

  const customBackendBanner = (user.banner && hasCustomAvatar(user.banner)) ? user.banner : undefined;
  const customSavedBanner = (saved?.banner && hasCustomAvatar(saved.banner)) ? saved.banner : undefined;
  const effectiveBanner = customBackendBanner || customSavedBanner || user.banner || saved?.banner || undefined;

  const base = saved
    ? {
        ...user,
        ...saved,
        avatar: effectiveAvatar,
        banner: effectiveBanner,
        id: user.id,
        email: user.email || saved.email || '',
        role: user.role || saved.role,
      }
    : { ...user, avatar: effectiveAvatar, banner: effectiveBanner };

  if (!base.avatar && user.id) {
    const localAvatar = getCleanStoredAvatar(user.id);
    if (localAvatar) base.avatar = localAvatar;
  }
  if (!base.banner && user.id) {
    const localBanner = getCleanStoredBanner(user.id);
    if (localBanner) base.banner = localBanner;
  }
  if (user.id) {
    const storedVisits = loadStoredTabVisits(user.id);
    if (Object.keys(storedVisits).length > 0) {
      base.lastVisitedAt = { ...(base.lastVisitedAt || {}), ...storedVisits };
    }
  }
  return base;
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

export const getOrGenerateCourseJoinCode = (course?: Partial<Course> | any): string => {
  if (!course) return '';
  const existing = course.joinCode || course.join_code;
  if (typeof existing === 'string' && existing.trim()) {
    return existing.trim().toUpperCase();
  }
  const cleanPrefix = (course.code || course.id || 'GBY')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'GBY';

  const seed = `${course.id || ''}-${course.code || ''}-${course.section || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt((hash >>> (i * 5)) % chars.length);
  }
  return `${cleanPrefix}-${suffix}`;
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
    attachments: 'attachments',
  };
  return snake[key] ?? key;
};

const toLikhaItemPatch = (body: Record<string, any>): Record<string, any> => {
  const patch: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) patch[likhaItemKey(key)] = value;
  return patch;
};

const mapLikhaModuleItemRow = (it: any): ModuleItem => {
  let parsedAttachments: any = undefined;
  if (Array.isArray(it.attachments)) {
    parsedAttachments = it.attachments;
  } else if (typeof it.attachments === 'string') {
    try {
      const p = JSON.parse(it.attachments);
      if (Array.isArray(p)) parsedAttachments = p;
    } catch {}
  }

  const firstAtt = Array.isArray(parsedAttachments) && parsedAttachments.length > 0 ? parsedAttachments[0] : null;
  const resolvedFileName = it.file_name ?? it.fileName ?? firstAtt?.name ?? undefined;
  const resolvedFileUrl = it.file_url ?? it.fileUrl ?? it.url ?? firstAtt?.url ?? undefined;
  const resolvedFileSize = it.file_size ?? it.fileSize ?? firstAtt?.size ?? undefined;
  const resolvedFileType = it.file_type ?? it.fileType ?? (resolvedFileName ? toShortFileType(resolvedFileName) : undefined);

  if ((!parsedAttachments || parsedAttachments.length === 0) && (resolvedFileName || resolvedFileUrl)) {
    parsedAttachments = [{
      name: resolvedFileName || 'Attached File',
      url: resolvedFileUrl,
      size: resolvedFileSize,
      type: resolvedFileType || 'document',
    }];
  }

  return {
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
    fileUrl: resolvedFileUrl,
    fileName: resolvedFileName,
    fileSize: resolvedFileSize,
    fileType: resolvedFileType,
    completed: it.completed ?? undefined,
    authorId: it.author_id ?? it.authorId ?? undefined,
    authorName: it.author_name ?? it.authorName ?? undefined,
    order: typeof it.order === 'number' ? it.order : (Number(it.order) || undefined),
    attachments: parsedAttachments,
  };
};

const mapLikhaModuleCommentRow = (c: any, moduleId: string): ModuleComment => ({
  id: String(c.id),
  moduleId: String(c.module_id ?? c.moduleId ?? moduleId),
  parentId: c.parent_id ?? c.parentId ?? null,
  authorId: String(c.author_id ?? c.authorId ?? ''),
  authorName: c.author_name ?? c.authorName ?? 'Someone',
  authorAvatar: c.author_avatar ?? c.authorAvatar ?? (c.author_id ? getCleanStoredAvatar(c.author_id) : ''),
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
  items: Array.isArray(m.items)
    ? m.items.map(mapLikhaModuleItemRow).sort((a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0))
    : [],
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

const mapLikhaPendingRegistrationRow = (r: any): PendingRegistration => ({
  id: String(r.id),
  firstName: r.first_name || '',
  middleName: r.middle_name || undefined,
  lastName: r.last_name || '',
  fullName: r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
  email: r.email,
  role: r.role || undefined,
  collegeId: r.college_id || '',
  collegeName: r.college_name || '',
  department: r.department || '',
  program: r.program || r.department || undefined,
  studentId: r.student_id || '',
  emailVerified: Boolean(r.email_verified),
  activationToken: r.activation_token || '',
  registeredAt: r.registered_at || new Date().toISOString(),
  expiresAt: r.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  status: r.status || 'pending',
  schoolYear: r.school_year || undefined,
});

export { deduplicatePendingRegistrations } from '../utils/registration';

const mapLikhaTenureRow = (r: any): LeadershipTenure => ({
  id: String(r.id),
  role: r.role,
  unitId: r.unit_id || r.unitId || '',
  unitName: r.unit_name || r.unitName || '',
  unitType: r.unit_type || r.unitType || 'system',
  leaderId: r.leader_id || r.leaderId || '',
  leaderName: r.leader_name || r.leaderName || '',
  leaderEmail: r.leader_email || r.leaderEmail,
  leaderAvatar: r.leader_avatar || r.leaderAvatar,
  startDate: r.start_date || r.startDate || new Date().toISOString(),
  endDate: r.end_date ?? r.endDate ?? null,
  status: r.status || 'active',
  appointedBy: r.appointed_by || r.appointedBy,
  transitionNotes: r.transition_notes || r.transitionNotes,
});

const mapLikhaAuditLogRow = (r: any): GovernanceAuditLog => ({
  id: String(r.id),
  timestamp: r.timestamp || new Date().toISOString(),
  eventType: r.event_type || r.eventType,
  title: r.title || '',
  description: r.description || '',
  actorId: r.actor_id || r.actorId || '',
  actorName: r.actor_name || r.actorName || '',
  actorRole: r.actor_role || r.actorRole,
  unitId: r.unit_id || r.unitId,
  unitType: r.unit_type || r.unitType,
  targetId: r.target_id || r.targetId,
  targetType: r.target_type || r.targetType,
  metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
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
  authorAvatar: r.author_avatar ?? r.authorAvatar ?? (r.author_id ? getCleanStoredAvatar(r.author_id) : ''),
  authorRole: (r.author_role ?? r.authorRole ?? 'student') as UserRole,
  content: r.content ?? '',
  createdAt: r.date_created || r.created_at || r.date || r.createdAt || '2025-01-01T00:00:00.000Z',
  likes: typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likes) ? r.likes.length : 0),
  likedBy: Array.isArray(r.liked_by) ? r.liked_by : (r.likedBy ?? []),
});

const mapLikhaAnnouncementRow = (a: any, courseId?: string): Announcement => {
  const createdAt = a.date_created || a.created_at || a.date || a.createdAt || '2025-01-01T00:00:00.000Z';
  return {
    id: String(a.id),
    courseId: String(a.course_id ?? a.courseId ?? courseId ?? ''),
    title: a.title ?? 'Untitled Announcement',
    content: a.content ?? '',
    authorId: String(a.author_id ?? a.authorId ?? ''),
    authorName: a.author_name ?? a.authorName ?? 'Someone',
    authorAvatar: a.author_avatar ?? a.authorAvatar ?? (a.author_id ? getCleanStoredAvatar(a.author_id) : ''),
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
    attachments: (Array.isArray(a.attachments) && a.attachments.length > 0)
      ? a.attachments.map((att: any) => {
          if (att?.directus_files_id) {
            const f = att.directus_files_id;
            const fUrl = resolveDirectusAssetUrl(f.id || f) || '';
            return {
              name: f.filename_download || f.title || 'Attached File',
              size: f.filesize ? formatFileSize(f.filesize) : 'File',
              url: fUrl,
            };
          }
          return att;
        })
      : (typeof a.attachments === 'string'
          ? (() => { try { return JSON.parse(a.attachments); } catch { return []; } })()
          : loadStoredAnnouncementAttachments(String(a.id))),
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
  authorAvatar: r.author_avatar ?? r.authorAvatar ?? (r.author_id ? getCleanStoredAvatar(r.author_id) : ''),
  authorRole: (r.author_role ?? r.authorRole ?? 'student') as UserRole,
  content: r.content ?? '',
  createdAt: r.created_at ?? r.date ?? r.createdAt ?? new Date().toISOString(),
  likes: typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likes) ? r.likes.length : 0),
  likedBy: Array.isArray(r.liked_by) ? r.liked_by : (r.likedBy ?? []),
});

const mapLikhaDiscussionRow = (d: any, courseId?: string): Discussion => {
  const createdAt = d.date_created || d.created_at || d.date || d.createdAt || '2025-01-01T00:00:00.000Z';
  return {
    id: String(d.id),
    courseId: String(d.course_id ?? d.courseId ?? courseId ?? ''),
    title: d.title ?? 'Untitled Discussion Topic',
    prompt: d.content ?? d.prompt ?? '',
    authorId: String(d.author_id ?? d.authorId ?? ''),
    authorName: d.author_name ?? d.authorName ?? 'Someone',
    authorAvatar: d.author_avatar ?? d.authorAvatar ?? (d.author_id ? getCleanStoredAvatar(d.author_id) : ''),
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
  createdAt: raw.createdAt ?? raw.date_created ?? raw.metadata?.createdAt ?? undefined,
  attachments: Array.isArray(raw.attachments)
    ? raw.attachments
    : (Array.isArray(raw.metadata?.attachments) ? raw.metadata.attachments : undefined),
});

const normalizeQuiz = (raw: any): Quiz => ({
  ...raw,
  term: normalizeTermId(raw.term) ?? 'midterm',
  delayedUntil: toOptionalIso(raw.delayedUntil),
  dueDate: toOptionalIso(raw.dueDate),
  fileName: raw.fileName ?? undefined,
  fileUrl: raw.fileUrl ?? undefined,
  fileSize: raw.fileSize ?? undefined,
  createdAt: raw.createdAt ?? raw.date_created ?? raw.metadata?.createdAt ?? undefined,
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
  totalPoints:
    toFiniteNumber(row.total_points) ?? toFiniteNumber(row.totalPoints),
  total_points:
    toFiniteNumber(row.total_points) ?? toFiniteNumber(row.totalPoints),
  timeLimitMinutes:
    toFiniteNumber(row.time_limit_minutes) ?? toFiniteNumber(row.timeLimitMinutes),
  delayedUntil: row.delayed_until ?? row.delayedUntil ?? undefined,
  dueDate: row.due_date ?? row.dueDate ?? undefined,
  availableFrom: row.available_from ?? row.availableFrom ?? row.delayed_until ?? row.delayedUntil ?? undefined,
  availableUntil: row.available_until ?? row.availableUntil ?? undefined,
  fileName: row.file_name ?? row.fileName ?? undefined,
  fileUrl: row.file_url ?? row.fileUrl ?? undefined,
  fileSize: row.file_size ?? row.fileSize ?? undefined,
  createdAt: row.created_at ?? row.date_created ?? row.createdAt ?? row.metadata?.createdAt ?? undefined,
  questions: mapLikhaQuestions(row),
});

const mapLikhaExamRow = (row: any): any => ({
  ...row,
  id: String(row.id),
  courseId: String(row.course_id ?? row.courseId ?? ''),
  title: row.title ?? 'Untitled exam',
  totalPoints:
    toFiniteNumber(row.total_points) ?? toFiniteNumber(row.totalPoints),
  total_points:
    toFiniteNumber(row.total_points) ?? toFiniteNumber(row.totalPoints),
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
    typeof row.points_possible === 'number'
      ? row.points_possible
      : typeof row.total_points === 'number'
        ? row.total_points
        : row.pointsPossible,
  total_points:
    typeof row.total_points === 'number'
      ? row.total_points
      : typeof row.points_possible === 'number'
        ? row.points_possible
        : row.pointsPossible,
  dueDate: row.due_date ?? row.dueDate ?? undefined,
  submissionTypes: Array.isArray(row.submission_types)
    ? row.submission_types
    : typeof row.submission_types === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(row.submission_types);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
          return row.submission_types.split(',').map((s: string) => s.trim()).filter(Boolean);
        })()
      : Array.isArray(row.submissionTypes)
        ? row.submissionTypes
        : undefined,
  category: row.category ?? undefined,
  weight: typeof row.weight === 'number' ? row.weight : undefined,
  rubric: (() => {
    const parsedRubric = Array.isArray(row.rubric)
      ? row.rubric
      : typeof row.rubric === 'string'
        ? (() => {
            try {
              const p = JSON.parse(row.rubric);
              return Array.isArray(p) ? p : undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined;
    if (parsedRubric) {
      return parsedRubric.map((r: any) => ({
        ...r,
        id: String(r.id || ''),
        title: r.title ?? r.criterion ?? '',
        description: r.description ?? '',
        points: Number(r.max_points ?? r.points) || 0,
        ratings: Array.isArray(r.ratings) ? r.ratings : [],
      }));
    }
    if (Array.isArray(row.rubric_criteria)) {
      return row.rubric_criteria.map((r: any) => ({
        ...r,
        id: String(r.id),
        title: r.title ?? r.criterion ?? '',
        description: r.description ?? '',
        points: Number(r.max_points ?? r.points) || 0,
        ratings: Array.isArray(r.ratings) && r.ratings.length > 0 ? r.ratings : [
          { points: Number(r.max_points ?? r.points) || 10, description: 'Exemplary Mastery' },
          { points: 0, description: 'Needs Revision' },
        ],
      }));
    }
    return undefined;
  })(),
  fileName: row.file_name ?? row.fileName ?? undefined,
  fileUrl: row.file_url ?? row.fileUrl ?? undefined,
  fileSize: row.file_size ?? row.fileSize ?? undefined,
  attachments: (Array.isArray(row.metadata?.attachments) && row.metadata.attachments.length > 0)
    ? row.metadata.attachments
    : (Array.isArray(row.attachments)
      ? row.attachments.map((att: any) => {
          if (att && att.directus_files_id && typeof att.directus_files_id === 'object') {
            const f = att.directus_files_id;
            return {
              id: f.id,
              name: f.filename_download || f.title || 'Attachment',
              size: f.filesize ? `${Math.round(Number(f.filesize) / 1024)} KB` : '',
              url: `/likha/assets/${f.id}`,
              fileId: f.id,
              directus_files_id: f.id,
            };
          }
          return att;
        })
      : undefined),
  availableFrom: row.available_from ?? row.availableFrom ?? undefined,
  availableUntil: row.available_until ?? row.availableUntil ?? undefined,
  sectionRestriction: row.section_restriction ?? row.sectionRestriction ?? undefined,
  createdAt: row.created_at ?? row.date_created ?? row.createdAt ?? row.metadata?.createdAt ?? undefined,
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

  let parsedContentData: any = null;
  if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
    try {
      parsedContentData = JSON.parse(row.content);
    } catch {}
  }

  const fileName =
    row.file_name ??
    row.fileName ??
    (row.file && typeof row.file === 'object' ? row.file.filename_download : undefined) ??
    parsedContentData?.fileName ??
    undefined;

  const fileUrl =
    row.file_url ??
    row.fileUrl ??
    (row.file && typeof row.file === 'object'
      ? `/likha/assets/${row.file.id}`
      : typeof row.file === 'string' && /^[0-9a-fA-F-]{36}$/.test(row.file)
        ? `/likha/assets/${row.file}`
        : undefined) ??
    parsedContentData?.fileUrl ??
    undefined;

  const fileSize =
    row.file_size ??
    row.fileSize ??
    (row.file && typeof row.file === 'object' && row.file.filesize
      ? `${Math.round(Number(row.file.filesize) / 1024)} KB`
      : undefined) ??
    parsedContentData?.fileSize ??
    undefined;

  const content =
    parsedContentData && typeof parsedContentData === 'object' && 'note' in parsedContentData
      ? parsedContentData.note
      : row.content ?? undefined;

  const attachments =
    Array.isArray(parsedContentData?.attachments) && parsedContentData.attachments.length > 0
      ? parsedContentData.attachments
      : undefined;

  return {
    ...row,
    id: String(row.id),
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
    content,
    fileName,
    fileUrl,
    fileSize,
    ...(attachments !== undefined ? { attachments } : {}),
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
  updatedAt: f.date_updated || f.date_created || f.updated_at || f.updatedAt || f.created_at || '2025-01-01T00:00:00.000Z',
  autoKey: f.autoKey ?? f.auto_key ?? undefined,
});

/** Task 9: Directus course_files rows (snake_case) arrive from
 *  read/write calls — map them to client CourseFile shapes. */
const mapLikhaCourseFileRow = (f: any, fallbackCourseId?: string): CourseFile => {
  const fileObj = f.file;
  const resolvedName = (typeof fileObj === 'object' && fileObj?.filename_download) || f.name || 'Untitled File';
  const resolvedUrl = (typeof fileObj === 'object' ? resolveDirectusAssetUrl(fileObj) : undefined) || f.url || (f.file ? `${LIKHA_URL}/assets/${f.file}` : '');
  const parsedFromFormatted = (f.formatted_size || f.formattedSize) ? parseFormattedSize(f.formatted_size || f.formattedSize) : 0;
  const rawSize = (typeof fileObj === 'object' && typeof fileObj?.filesize === 'number' && fileObj.filesize > 0)
    ? fileObj.filesize
    : (typeof f.size === 'number' && f.size > 0 ? f.size : parsedFromFormatted);
  const resolvedType = f.type || toShortFileType(resolvedName);
  const explicitFormatted = (f.formatted_size && f.formatted_size !== '0 B')
    ? f.formatted_size
    : (f.formattedSize && f.formattedSize !== '0 B' ? f.formattedSize : undefined);
  const resolvedSize = rawSize > 0 ? rawSize : (explicitFormatted ? parseFormattedSize(explicitFormatted) : 0);
  const resolvedFormattedSize = explicitFormatted || (resolvedSize > 0 ? formatFileSize(resolvedSize) : undefined);
  const directusFileId = typeof fileObj === 'object' && fileObj !== null
    ? (fileObj.id ? String(fileObj.id) : undefined)
    : (typeof f.file === 'string' && f.file
      ? f.file
      : (f.directus_files_id ? String(f.directus_files_id) : extractDirectusFileId(resolvedUrl) || undefined));
  return {
    id: String(f.id),
    courseId: String(f.course_id ?? f.courseId ?? fallbackCourseId ?? ''),
    folderId: f.parent_id !== undefined ? (f.parent_id ? String(f.parent_id) : null) : (f.folder_id !== undefined ? (f.folder_id ? String(f.folder_id) : null) : (f.folderId ?? null)),
    name: resolvedName,
    size: resolvedSize,
    formattedSize: resolvedFormattedSize || (resolvedType === 'pdf' ? '1.0 MB' : '500 KB'),
    type: resolvedType as CourseFile['type'],
    visibility: (f.visibility as CourseFile['visibility']) || 'published',
    updatedAt: f.date_updated || f.date_created || f.file?.uploaded_on || f.file?.modified_on || f.updated_at || f.updatedAt || f.created_at || f.date || '2025-01-01T00:00:00.000Z',
    uploadedBy: String(f.user_created ?? f.uploaded_by ?? f.uploadedBy ?? ''),
    uploadedByName: f.uploaded_by_name ?? f.uploadedByName ?? 'User',
    content: f.content ?? undefined,
    url: resolvedUrl,
    fileUrl: f.file_url ?? f.fileUrl ?? resolvedUrl,
    sourceArea: f.source_area ?? f.sourceArea ?? undefined,
    sourceId: f.source_id ? String(f.source_id) : (f.sourceId ? String(f.sourceId) : undefined),
    fileId: directusFileId,
    directus_files_id: directusFileId,
    file: f.file,
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
  if (typeof userOrId === 'string') {
    const assetUrl = resolveDirectusAssetUrl(userOrId);
    return assetUrl || fallbackAvatar;
  }
  if (typeof userOrId === 'object' && userOrId !== null) {
    if (userOrId.avatar) {
      const assetUrl = resolveDirectusAssetUrl(userOrId.avatar);
      if (assetUrl) return assetUrl;
    }
    if (userOrId.avatarUrl) return userOrId.avatarUrl;
  }
  return fallbackAvatar;
};

export const resolveDirectusUserBanner = (userOrRow: any, fallbackBanner = ''): string => {
  if (!userOrRow) return fallbackBanner;
  const raw = typeof userOrRow === 'string' ? userOrRow : userOrRow.banner;
  if (!raw) return fallbackBanner;
  const assetUrl = resolveDirectusAssetUrl(raw);
  return assetUrl || fallbackBanner;
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
  const storedAvatar = getCleanStoredAvatar(row?.id);
  const storedBanner = getCleanStoredBanner(row?.id);
  const resolvedBanner = resolveDirectusUserBanner(row, storedBanner || '');
  return applyStoredUserProfile({
    id: String(row?.id ?? ''),
    name: resolveDirectusUserName(row, row?.email ?? ''),
    email: row?.email ?? '',
    role,
    avatar: resolveDirectusUserAvatar(row, '') || storedAvatar,
    banner: resolvedBanner,
    department: row?.department || 'College of Computer Science',
    title: row?.title || (role === 'student' ? 'Undergraduate Student' : 'Faculty Instructor'),
    firstName: row?.first_name || undefined,
    middleName: row?.middle_name || undefined,
    lastName: row?.last_name || undefined,
    yearLevel: row?.year_level !== undefined ? Number(row.year_level) : (row?.yearLevel !== undefined ? Number(row.yearLevel) : undefined),
    yearsOfTeaching: row?.years_of_teaching !== undefined ? Number(row.years_of_teaching) : (row?.yearsOfTeaching !== undefined ? Number(row.yearsOfTeaching) : undefined),
  });
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
    attachments:
      Array.isArray(raw.attachments) && raw.attachments.length > 0 ? raw.attachments : undefined,
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
const mapLikhaGradeRow = (row: any, courseId: string): any => {
  const cells = Array.isArray(row.spr_cells) ? row.spr_cells : (Array.isArray(row.sprCells) ? row.sprCells : []);
  const mtCell = cells.find((c: any) => c?.task_id === '__term_midterm');
  const ftCell = cells.find((c: any) => c?.task_id === '__term_final');
  return {
    ...row,
    courseId: String(row.course_id ?? row.courseId ?? courseId),
    studentId: String(row.student_id ?? row.studentId ?? ''),
    midtermGrade: toFiniteNumber(row.midterm_grade) ?? toFiniteNumber(row.midtermGrade) ?? toFiniteNumber(mtCell?.score) ?? null,
    finalGrade: toFiniteNumber(row.final_grade) ?? toFiniteNumber(row.finalGrade) ?? toFiniteNumber(ftCell?.score) ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? undefined,
  };
};

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
    joinCode: raw?.joinCode || raw?.join_code || undefined,
    department: raw?.department || undefined,
    departmentId: raw?.department_id || raw?.departmentId || undefined,
    collegeId: raw?.college_id || raw?.collegeId || undefined,
    programId: raw?.program_id || raw?.programId || undefined,
    schoolYear: raw?.schoolYear || raw?.school_year || raw?.term?.match(/\b\d{4}-\d{4}\b/)?.[0] || undefined,
    semester: raw?.semester || (raw?.term ? normalizeAcademicSemester(raw.term) : undefined),
    syllabusStatus: raw?.syllabus_status || raw?.syllabusStatus || undefined,
    syllabusReleasedAt: raw?.syllabus_released_at || raw?.syllabusReleasedAt || undefined,
    syllabusReleasedBy: raw?.syllabus_released_by || raw?.syllabusReleasedBy || undefined,
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
    const configured = (import.meta.env?.VITE_CHANCELLOR_EMAIL || '').trim().toLowerCase();
    const normalized = (email || '').trim().toLowerCase();
    if (configured && normalized === configured) return true;
    return (
      normalized === 'chancellor@dmmmsu.edu.ph' ||
      normalized === 'chancellor@gabay.edu.ph'
    );
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
    leadershipTenures: [],
    governanceAuditLogs: [],
  });

  // Database State (API-backed cache; starts empty or loads from localStorage if persisted in dev)
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((c: any) => c && c.name && typeof c.name === 'string' && c.name.trim() && c.name !== 'null');
          if (clean.length > 0) return clean;
        }
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
          return parsed
            .map((d: any) => ({
              ...d,
              name: normalizeProgramName(d.name || ''),
            }))
            .filter((d: Department) => Boolean(d.name && d.name.trim().length > 0));
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
          return deduplicatePendingRegistrations(
            parsed.map(({ password: _, ...rest }: any) => rest as PendingRegistration)
          );
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
    return {};
  });

  const collegeActiveSYRef = useRef(collegeActiveSchoolYears);
  useEffect(() => {
    collegeActiveSYRef.current = collegeActiveSchoolYears;
    safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SY, JSON.stringify(collegeActiveSchoolYears));
  }, [collegeActiveSchoolYears]);

  const [baselineSemester, setBaselineSemesterState] = useState<AcademicSemester>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BASELINE_SEMESTER);
      if (saved) return normalizeAcademicSemester(saved);
    } catch (_) {}
    return 'First';
  });
  const baselineSemesterRef = useRef(baselineSemester);
  useEffect(() => {
    baselineSemesterRef.current = baselineSemester;
    safeSetLocalStorage(STORAGE_KEY_BASELINE_SEMESTER, baselineSemester);
  }, [baselineSemester]);

  const [collegeActiveSemesters, setCollegeActiveSemesters] = useState<Record<string, AcademicSemester>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLLEGE_ACTIVE_SEMESTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const normalized: Record<string, AcademicSemester> = {};
          for (const [k, v] of Object.entries(parsed)) {
            normalized[k] = normalizeAcademicSemester(v as string);
          }
          return normalized;
        }
      }
    } catch (_) {}
    return {};
  });
  const collegeActiveSemestersRef = useRef(collegeActiveSemesters);
  useEffect(() => {
    collegeActiveSemestersRef.current = collegeActiveSemesters;
    safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SEMESTERS, JSON.stringify(collegeActiveSemesters));
  }, [collegeActiveSemesters]);

  // Institutional Governance & Leadership Timeline State
  const [leadershipTenures, setLeadershipTenures] = useState<LeadershipTenure[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LEADERSHIP_TENURES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: 'tenure-admin-current',
        role: 'admin',
        unitId: 'system',
        unitName: 'Institutional Administration',
        unitType: 'system',
        leaderId: 'u-admin-1',
        leaderName: 'University Chancellor',
        leaderEmail: 'chancellor@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        startDate: '2024-01-01T08:00:00.000Z',
        endDate: null,
        status: 'active',
        appointedBy: 'Board of Regents',
        transitionNotes: 'Appointed Institutional Administration Lead for Gabay LMS.',
      },
      {
        id: 'tenure-admin-past',
        role: 'admin',
        unitId: 'system',
        unitName: 'Institutional Administration',
        unitType: 'system',
        leaderId: 'u-admin-emeritus',
        leaderName: 'Dr. Jaime M. Manuel Jr.',
        leaderEmail: 'jmanuel.former@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        startDate: '2020-01-01T08:00:00.000Z',
        endDate: '2023-12-31T17:00:00.000Z',
        status: 'completed',
        appointedBy: 'Board of Regents',
        transitionNotes: 'Completed presidential tenure with honors.',
      },
      {
        id: 'tenure-dean-ccs-active',
        role: 'dean',
        unitId: 'col-ccs',
        unitName: 'College of Computer Science',
        unitType: 'college',
        leaderId: '6a52a8c6-5a15-4620-8a16-d06a5b269fc3',
        leaderName: 'Dr. Aris Thorne',
        leaderEmail: 'dean.ccs@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        startDate: '2024-06-01T08:00:00.000Z',
        endDate: null,
        status: 'active',
        appointedBy: 'University Chancellor',
        transitionNotes: 'Installed as Dean of College of Computer Science.',
      },
      {
        id: 'tenure-dean-ccs-past',
        role: 'dean',
        unitId: 'col-ccs',
        unitName: 'College of Computer Science',
        unitType: 'college',
        leaderId: 'u-past-dean-ccs',
        leaderName: 'Dr. Maria Elena Santos',
        leaderEmail: 'msantos.emeritus@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        startDate: '2021-08-01T08:00:00.000Z',
        endDate: '2024-05-31T17:00:00.000Z',
        status: 'completed',
        appointedBy: 'University Chancellor',
        transitionNotes: 'Stepped down to return to full-time professorship in Computer Science.',
      },
      {
        id: 'tenure-chair-cs-active',
        role: 'chairperson',
        unitId: 'dept-cs',
        unitName: 'Computer Science',
        unitType: 'department',
        leaderId: '3281e224-fc7d-4c7e-b4c9-bcb7bca2ab89',
        leaderName: 'Prof. Christine Chen',
        leaderEmail: 'chair.cs@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        startDate: '2025-01-15T08:00:00.000Z',
        endDate: null,
        status: 'active',
        appointedBy: 'College Dean',
        transitionNotes: 'Appointed Program Chairperson of Computer Science.',
      },
      {
        id: 'tenure-chair-cs-past',
        role: 'chairperson',
        unitId: 'dept-cs',
        unitName: 'Computer Science',
        unitType: 'department',
        leaderId: 'u-past-chair-cs',
        leaderName: 'Prof. Roberto Gomez',
        leaderEmail: 'rgomez.faculty@dmmmsu.edu.ph',
        leaderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        startDate: '2022-08-01T08:00:00.000Z',
        endDate: '2025-01-14T17:00:00.000Z',
        status: 'completed',
        appointedBy: 'College Dean',
        transitionNotes: 'Completed term and transitioned back to senior faculty.',
      },
    ];
  });

  const [governanceAuditLogs, setGovernanceAuditLogs] = useState<GovernanceAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: 'audit-log-1',
        timestamp: '2025-01-15T08:30:00.000Z',
        eventType: 'leadership_appointment',
        title: 'Program Chair Appointment',
        description: 'Prof. Christine Chen appointed as Chairperson for Computer Science.',
        actorId: 'u-dean-ccs',
        actorName: 'Dr. Aris Thorne',
        actorRole: 'dean',
        unitId: 'dept-cs',
        unitType: 'department',
        targetId: '3281e224-fc7d-4c7e-b4c9-bcb7bca2ab89',
        targetType: 'user',
      },
      {
        id: 'audit-log-2',
        timestamp: '2024-06-01T08:00:00.000Z',
        eventType: 'leadership_transfer',
        title: 'Collegiate Leadership Handover',
        description: 'Dr. Aris Thorne succeeded Dr. Maria Elena Santos as Dean of College of Computer Science.',
        actorId: 'u-admin-1',
        actorName: 'University Chancellor',
        actorRole: 'admin',
        unitId: 'col-ccs',
        unitType: 'college',
        targetId: '6a52a8c6-5a15-4620-8a16-d06a5b269fc3',
        targetType: 'user',
      },
      {
        id: 'audit-log-3',
        timestamp: '2024-08-15T09:00:00.000Z',
        eventType: 'academic_rollover',
        title: 'Academic Year Rollover Enacted',
        description: 'Academic Year 2024-2025 First Semester opened across all collegiate structures.',
        actorId: 'u-admin-1',
        actorName: 'University Chancellor',
        actorRole: 'admin',
        unitId: 'system',
        unitType: 'system',
      },
    ];
  });

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_LEADERSHIP_TENURES, JSON.stringify(leadershipTenures));
  }, [leadershipTenures]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS, JSON.stringify(governanceAuditLogs));
  }, [governanceAuditLogs]);

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
            const mappedCols: College[] = colSettled.value
              .filter((c: any) => c && c.name && typeof c.name === 'string' && c.name.trim() && c.name !== 'null')
              .map((c: any) => ({
                id: String(c.id),
                name: c.name,
                code: c.code,
                deanId: typeof c.dean_id === 'object' && c.dean_id ? String(c.dean_id.id) : (typeof c.dean_id === 'string' && c.dean_id ? c.dean_id : undefined),
                activeSchoolYear: c.active_school_year || c.activeSchoolYear || undefined,
                activeSemester: (c.active_semester || c.activeSemester) ? normalizeAcademicSemester(c.active_semester || c.activeSemester) : undefined,
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

            setCollegeActiveSchoolYears(prev => {
              const next = { ...prev };
              for (const c of mappedCols) {
                if (c.activeSchoolYear) {
                  next[c.id] = c.activeSchoolYear;
                  if (c.code) next[c.code] = c.activeSchoolYear;
                  if (c.code?.toLowerCase() === 'ccs') next['col-ccs'] = c.activeSchoolYear;
                }
              }
              collegeActiveSYRef.current = next;
              safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SY, JSON.stringify(next));
              return next;
            });
            setCollegeActiveSemesters(prev => {
              const next = { ...prev };
              for (const c of mappedCols) {
                if (c.activeSemester) {
                  next[c.id] = c.activeSemester;
                  if (c.code) next[c.code] = c.activeSemester;
                  if (c.code?.toLowerCase() === 'ccs') next['col-ccs'] = c.activeSemester;
                }
              }
              collegeActiveSemestersRef.current = next;
              safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SEMESTERS, JSON.stringify(next));
              return next;
            });
          }

          if (!cancelled && deptSettled.status === 'fulfilled' && Array.isArray(deptSettled.value) && deptSettled.value.length > 0) {
            const mappedDepts: Department[] = deptSettled.value
              .map((d: any) => {
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
              })
              .filter((d: Department) => Boolean(d.name && d.name.trim().length > 0));

            setDepartments(prev => {
              const merged = [...mappedDepts];
              for (const localDept of prev) {
                const cleanLocal = {
                  ...localDept,
                  name: normalizeProgramName(localDept.name || ''),
                };
                if (!cleanLocal.name || !cleanLocal.name.trim()) continue;
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
            const activeRow = sySettled.value.find((sy: any) => Boolean(sy.is_active ?? sy.isActive ?? false));
            if (activeRow) {
              const normSemester = normalizeAcademicSemester(activeRow.semester);
              baselineSemesterRef.current = normSemester;
              setBaselineSemesterState(normSemester);
              safeSetLocalStorage(STORAGE_KEY_BASELINE_SEMESTER, normSemester);
            }
          }
        }

        if (likhaLmsApi?.governance?.getTenures) {
          likhaLmsApi.governance.getTenures().then(tenures => {
            if (!cancelled && Array.isArray(tenures) && tenures.length > 0) {
              const mapped = tenures.map(mapLikhaTenureRow);
              setLeadershipTenures(prev => {
                const merged = [...mapped];
                for (const t of prev) {
                  if (!merged.some(m => m.id === t.id)) merged.push(t);
                }
                return merged;
              });
            }
          }).catch(() => {});
        }
        if (likhaLmsApi?.governance?.getAuditLogs) {
          likhaLmsApi.governance.getAuditLogs().then(logs => {
            if (!cancelled && Array.isArray(logs) && logs.length > 0) {
              const mapped = logs.map(mapLikhaAuditLogRow);
              setGovernanceAuditLogs(prev => {
                const merged = [...mapped];
                for (const l of prev) {
                  if (!merged.some(m => m.id === l.id)) merged.push(l);
                }
                return merged;
              });
            }
          }).catch(() => {});
        }
        if (likhaLmsApi?.auth?.getPendingRegistrations) {
          likhaLmsApi.auth.getPendingRegistrations().then(regs => {
            if (!cancelled && Array.isArray(regs) && regs.length > 0) {
              const mapped = regs.map(mapLikhaPendingRegistrationRow);
              setPendingRegistrations(prev => deduplicatePendingRegistrations([...mapped, ...prev]));
            }
          }).catch(() => {});
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
  const [isSyncing, setIsSyncing] = useState(false);
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
  const showAlertRef = useRef<(options: string | AlertModalOptions, title?: string) => void>(() => {});

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
      const [coursesSettled, notificationsSettled, messagesSettled, calendarSettled, syllabiSettled, requestsSettled, enrollmentsSettled] = await Promise.allSettled([
        Promise.resolve()
          .then(() => likhaLmsApi?.getCoursesWithRelations?.() ?? [])
          .then((likhaCourses: any): any => ({
            courses: ((Array.isArray(likhaCourses) ? likhaCourses : []) as any[]).map((c: any) => ({
              id: c.id,
              code: c.code || c.id,
              title: c.title || c.name || c.id,
              description: c.description || '',
              term: c.term || '1st Semester 2026-2027',
              units: Number(c.units) || 3,
              enrolledCount: Number(c.enrolled_count ?? c.enrolledCount) || 0,
              published: Boolean(c.published),
              syllabus: c.syllabus || null,
              section: c.section || '',
              color: c.color !== undefined && c.color !== null ? String(c.color) : undefined,
              image: c.image || undefined,
              credits: c.credits !== undefined && c.credits !== null ? Number(c.credits) : undefined,
              cover_image: c.cover_image,
              instructor: c.instructor,
              instructor_id: c.instructor_id,
              instructorId: c.instructorId || c.instructor_id || (typeof c.instructor === 'object' ? c.instructor?.id : c.instructor) || undefined,
              instructorName: c.instructorName || c.instructor_name || (typeof c.instructor === 'object' ? (c.instructor?.name || `${c.instructor?.first_name || ''} ${c.instructor?.last_name || ''}`.trim()) : undefined) || '',
              departmentId: c.department_id || c.departmentId || undefined,
              collegeId: c.college_id || c.collegeId || (c.instructor && typeof c.instructor === 'object' ? c.instructor.college_id || c.instructor.collegeId : undefined) || undefined,
              schoolYear: c.schoolYear || c.school_year || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0] || undefined,
              semester: c.semester || undefined,
              joinCode: c.join_code || c.joinCode || undefined,
              join_code: c.join_code || c.joinCode || undefined,
              syllabusStatus: c.syllabus_status || c.syllabusStatus || undefined,
              syllabusReleasedAt: c.syllabus_released_at || c.syllabusReleasedAt || undefined,
              syllabusReleasedBy: c.syllabus_released_by || c.syllabusReleasedBy || undefined,
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
        Promise.resolve()
          .then(() => likhaLmsApi?.syllabus?.getAllSyllabi?.(user.role !== 'student') ?? {}),
        Promise.resolve()
          .then(() => likhaLmsApi?.requests?.getRequests?.() ?? []),
        Promise.resolve()
          .then(() => likhaLmsApi?.courses?.getCourseEnrollments?.() ?? []),
      ]);
      let resolvedCourses: Course[] = [];
      let notificationsRes = { notifications: [] as Notification[] };
      let messagesRes = { messages: [] as Message[] };
      let calendarRes = { events: [] as CalendarEvent[] };
      // Likha ERP is the source of truth for the essential bootstrap (no
      // Express fallback — removed once every suite mocked likhaLmsApi).
      // A rejected Likha bootstrap surfaces as a load failure below.
      if (coursesSettled.status === 'fulfilled') {
        const rawCourses = coursesSettled.value.courses;
        const syllabiMap: Record<string, SyllabusRevisionResponse> =
          syllabiSettled.status === 'fulfilled' && syllabiSettled.value && typeof syllabiSettled.value === 'object'
            ? (syllabiSettled.value as Record<string, SyllabusRevisionResponse>)
            : {};
        resolvedCourses = rawCourses.map((c: any) => {
          const sylEnv = syllabiMap[c.id] || syllabiMap[String(c.id).trim()];
          if (!sylEnv) return c;
          const instructorFromSyllabus = sylEnv.syllabus?.facultyMembers?.[0]?.name;
          return {
            ...c,
            syllabus: { ...sylEnv.syllabus, courseId: c.id },
            ...(instructorFromSyllabus && !c.instructorName ? { instructorName: instructorFromSyllabus } : {}),
          };
        });
        const revHeaders: Record<string, SyllabusRevisionHeader> = {};
        for (const [cid, env] of Object.entries(syllabiMap)) {
          if (env?.revision) revHeaders[cid] = env.revision;
        }
        if (Object.keys(revHeaders).length > 0) {
          setSyllabusRevisions(prev => ({ ...prev, ...revHeaders }));
        }
        notificationsRes = settledValue(notificationsSettled, { notifications: [] as Notification[] });
        messagesRes = settledValue(messagesSettled, { messages: [] as Message[] });
        calendarRes = settledValue(calendarSettled, { events: [] as CalendarEvent[] });
      } else {
        throw coursesSettled.reason;
      }

      const coursesRes = { courses: resolvedCourses };
      const fresh: LMSDatabase = {
        ...emptyDb(),
        modules: dbRef.current?.modules || [],
        announcements: dbRef.current?.announcements || [],
        discussions: dbRef.current?.discussions || [],
        activities: dbRef.current?.activities || [],
        quizzes: dbRef.current?.quizzes || [],
        exams: dbRef.current?.exams || [],
        submissions: dbRef.current?.submissions || [],
        courseFiles: dbRef.current?.courseFiles || [],
        courseFolders: dbRef.current?.courseFolders || [],
      };

      const initialRequests: EnrollmentRequest[] = [];
      const seenReqIds = new Set<string>();
      if (requestsSettled.status === 'fulfilled' && Array.isArray(requestsSettled.value)) {
        for (const req of requestsSettled.value) {
          if (req && req.id) {
            const mapped = mapLikhaRequestRow(req);
            if (!seenReqIds.has(mapped.id)) {
              seenReqIds.add(mapped.id);
              initialRequests.push(mapped);
            }
          }
        }
      }
      if (enrollmentsSettled.status === 'fulfilled' && Array.isArray(enrollmentsSettled.value)) {
        for (const enr of enrollmentsSettled.value) {
          const studentUser = typeof enr.user === 'object' ? enr.user : null;
          const studentId = studentUser?.id || (typeof enr.user === 'string' ? enr.user : String(enr.user || ''));
          const courseId = typeof enr.course === 'object' ? enr.course?.id : String(enr.course || enr.course_id || '');
          if (!studentId || !courseId) continue;
          const reqId = `enr-${enr.id || `${courseId}-${studentId}`}`;
          if (!seenReqIds.has(reqId)) {
            seenReqIds.add(reqId);
            const studentName = studentUser
              ? `${studentUser.first_name || ''} ${studentUser.last_name || ''}`.trim() || studentUser.email
              : `Student ${studentId}`;
            initialRequests.push({
              id: reqId,
              courseId: String(courseId),
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
      fresh.enrollmentRequests = initialRequests;
      const initialApprovedCourseIds = initialRequests
        .filter(r => r.studentId === user.id && r.status === 'approved')
        .map(r => r.courseId);

      // User directory: Likha ERP users; empty/error → just the active user
      try {
        const storedProfiles = loadStoredUserProfiles();
        const likhaUsers = await likhaLmsApi.users.getUsers();
        if (Array.isArray(likhaUsers) && likhaUsers.length > 0) {
          const pendingList = pendingRegistrationsRef.current || pendingRegistrations;
          const userEmail = (user.email || '').trim().toLowerCase();
          const activeUserReg = pendingList.find(r => r.email?.trim().toLowerCase() === userEmail);
          const activeLikhaRow = likhaUsers.find((u: any) => u.id === user.id);
          const activeAvatar = activeLikhaRow?.avatar
            ? resolveDirectusUserAvatar(activeLikhaRow.avatar)
            : (user.avatar || getCleanStoredAvatar(user.id));
          const activeBanner = activeLikhaRow?.banner
            ? resolveDirectusUserBanner(activeLikhaRow.banner)
            : (user.banner || getCleanStoredBanner(user.id));
          let effectiveActiveUser = applyStoredUserProfile({
            ...user,
            avatar: activeAvatar,
            banner: activeBanner,
          }, storedProfiles);
          if (initialApprovedCourseIds.length > 0) {
            effectiveActiveUser = {
              ...effectiveActiveUser,
              enrolledCourseIds: [...new Set([...(effectiveActiveUser.enrolledCourseIds || []), ...initialApprovedCourseIds])],
            };
          }
          if (activeUserReg?.role === 'student' && user.role !== 'student') {
            effectiveActiveUser = { ...effectiveActiveUser, role: 'student', title: 'Undergraduate Student' };
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
                avatar: u.avatar
                  ? resolveDirectusUserAvatar(u.avatar)
                  : getCleanStoredAvatar(u.id),
                banner: u.banner
                  ? resolveDirectusUserBanner(u.banner)
                  : getCleanStoredBanner(u.id),
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
              return normalizeChancellorUser(applyStoredUserProfile(baseUser, storedProfiles));
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
          const rawNorm = normalizeChancellorUser(applyStoredUserProfile(user, storedProfiles));
          const norm = initialApprovedCourseIds.length > 0
            ? { ...rawNorm, enrolledCourseIds: [...new Set([...(rawNorm.enrolledCourseIds || []), ...initialApprovedCourseIds])] }
            : rawNorm;
          const activeSY = norm.collegeId ? getActiveSchoolYearForCollege(norm.collegeId) : getActiveSchoolYearForCollege('col-ccs');
          fresh.users = [{
            ...norm,
            schoolYear: norm.schoolYear || activeSY?.year || '2025-2026',
          }];
        }
      } catch {
        const storedProfiles = loadStoredUserProfiles();
        const rawNorm = normalizeChancellorUser(applyStoredUserProfile(user, storedProfiles));
        const norm = initialApprovedCourseIds.length > 0
          ? { ...rawNorm, enrolledCourseIds: [...new Set([...(rawNorm.enrolledCourseIds || []), ...initialApprovedCourseIds])] }
          : rawNorm;
        const activeSY = norm.collegeId ? getActiveSchoolYearForCollege(norm.collegeId) : getActiveSchoolYearForCollege('col-ccs');
        fresh.users = [{
          ...norm,
          schoolYear: norm.schoolYear || activeSY?.year || '2025-2026',
        }];
      }

      fresh.courses = coursesRes.courses.map(normalizeCourseSyllabus).map(c => {
        const inst = fresh.users?.find(u => u.id === (c.instructorId || (c as any).instructor_id));
        const effectiveName = inst?.name || c.instructorName;
        const baseCourse = effectiveName !== c.instructorName ? { ...c, instructorName: effectiveName } : c;

        if (baseCourse.schoolYear) return baseCourse;
        const termYearMatch = baseCourse.term?.match(/\b\d{4}-\d{4}\b/)?.[0];
        if (termYearMatch) {
          return {
            ...baseCourse,
            schoolYear: termYearMatch,
          };
        }
        const colId = (baseCourse as any).collegeId || (baseCourse as any).college_id || inst?.collegeId || 'col-ccs';
        const activeSY = getActiveSchoolYearForCollege(colId) || getActiveSchoolYearForCollege('col-ccs');
        return {
          ...baseCourse,
          schoolYear: activeSY?.year || '2025-2026',
        };
      });
      fresh.notifications = notificationsRes.notifications;
      fresh.messages = messagesRes.messages;
      fresh.calendarEvents = calendarRes.events;

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
            const mappedCols: College[] = colSettled.value
              .filter((c: any) => c && c.name && typeof c.name === 'string' && c.name.trim() && c.name !== 'null')
              .map((c: any) => ({
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
            const mappedDepts: Department[] = deptSettled.value
              .map((d: any) => {
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
              })
              .filter((d: Department) => Boolean(d.name && d.name.trim().length > 0));

            setDepartments(prev => {
              const merged = [...mappedDepts];
              for (const localDept of prev) {
                const cleanLocal = {
                  ...localDept,
                  name: normalizeProgramName(localDept.name || ''),
                };
                if (!cleanLocal.name || !cleanLocal.name.trim()) continue;
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
    setIsSyncing(true);
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
      const scopeResults = await mapConcurrent(
        coursesRes.courses,
        4,
        async course => {
          const [sectionsSettled, requestsSettled, approvedSettled] = await Promise.allSettled([
            Promise.resolve().then(() => likhaLmsApi?.sections?.getSections?.(course.id) ?? []),
            Promise.resolve().then(() => (currentUserRef.current?.role === 'student' ? [] : likhaLmsApi?.requests?.getRequests?.(course.id, 'pending')) ?? []),
            Promise.resolve().then(() => likhaLmsApi?.requests?.getRequests?.(course.id, 'approved') ?? []),
          ]);
          return { sectionsSettled, requestsSettled, approvedSettled };
        }
      );
      const sectionMap = new Map<string, CourseSection>();
      const requestMap = new Map<string, EnrollmentRequest>();
      for (const req of (fresh.enrollmentRequests || [])) {
        requestMap.set(req.id, req);
      }
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
          if (currentUserRef.current?.role === 'student' && mapped.studentId !== currentUserRef.current.id) {
            continue;
          }
          requestMap.set(mapped.id, mapped);
        }
      }
      try {
        if (likhaLmsApi?.courses?.getCourseEnrollments) {
          await mapConcurrent(
            coursesRes.courses,
            4,
            async course => {
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
            }
          );
        }
      } catch {
        // Tolerated if Likha enrollments endpoint offline
      }
      fresh.courseSections = [...sectionMap.values()];
      fresh.enrollmentRequests = [...requestMap.values()];
      if (bootstrapRef.current === run) {
        setDb(prev => ({
          ...prev,
          courseSections: fresh.courseSections,
          enrollmentRequests: fresh.enrollmentRequests,
        }));
      }

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

      // Early files bootstrap in parallel with content and assessments
      const fileResultsPromise = mapConcurrent(
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
      fresh.courseGrades = allGrades;
      fresh.sprConfigs = allSPRConfigs;
      fresh.sprScores = allSPRScores;
      fresh.quizzes = allQuizzes;
      fresh.exams = allExams;
      fresh.activities = allActivities;

      // Await files (running in parallel) and flush early so navigation badges update immediately
      const fileResults = await fileResultsPromise;
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

      if (bootstrapRef.current === run) {
        setDb(prev => ({
          ...prev,
          modules: allModules,
          announcements: allAnnouncements,
          discussions: allDiscussions,
          quizzes: allQuizzes,
          exams: allExams,
          activities: allActivities,
          courseGrades: allGrades,
          sprConfigs: allSPRConfigs,
          sprScores: allSPRScores,
          courseFolders: allFolders,
          courseFiles: allFiles,
        }));
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
      if (bootstrapRef.current !== run) return; // ponytail: logout/re-login mid-fill — don't resurrect stale db
      const done = fresh;
      setDb(prev => {
        const mergedCourses = done.courses.map(dc => {
          const prevCourse = prev.courses?.find(pc => String(pc.id).trim() === String(dc.id).trim());
          return {
            ...dc,
            syllabus: prevCourse?.syllabus ?? dc.syllabus ?? null,
            ...(prevCourse?.instructorName ? { instructorName: prevCourse.instructorName } : {}),
          };
        });
        done.courses = mergedCourses;
        safeSetLocalStorage(STORAGE_KEY_DB, JSON.stringify(done));
        return {
          ...done,
          historyLogs: prev.historyLogs,
          courses: [...mergedCourses, ...prev.courses.filter(c => !mergedCourses.some(d => String(d.id).trim() === String(c.id).trim()))],
        };
      });
    } catch (err) {
      console.warn('[refreshDeferred] background fill failed:', err);
    } finally {
      if (bootstrapRef.current === run) {
        setIsSyncing(false);
      }
    }
  };

  // Alert & Confirmation Modal state
  const [alertOptions, setAlertOptions] = useState<AlertModalOptions | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const showAlert = useCallback((options: string | AlertModalOptions, title?: string) => {
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
  }, []);
  showAlertRef.current = showAlert;

  // Session restore: token -> check Likha ERP -> user + bootstrap
  const restoringRef = useRef(false);
  const restoreSession = useCallback(async () => {
    if (restoringRef.current) return;
    const token = getToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    restoringRef.current = true;
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
              avatar: me.avatar
                ? resolveDirectusUserAvatar(me.avatar)
                : getCleanStoredAvatar(me.id),
              banner: me.banner
                ? resolveDirectusUserBanner(me.banner)
                : getCleanStoredBanner(me.id),
              department:
                me.department ||
                (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
              title: (mapped.role === 'student' ? 'Undergraduate Student' : (me.title || mapped.title)),
              collegeId: me.college_id || me.collegeId,
              collegeName: me.college_name || me.collegeName,
              yearLevel: me.year_level !== undefined ? Number(me.year_level) : (me.yearLevel !== undefined ? Number(me.yearLevel) : undefined),
              yearsOfTeaching: me.years_of_teaching !== undefined ? Number(me.years_of_teaching) : (me.yearsOfTeaching !== undefined ? Number(me.yearsOfTeaching) : undefined),
            };
            user = normalizeChancellorUser(applyStoredUserProfile(rawMeUser));
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

      // Likha-only restore: if Likha yields no user, the stored token is unusable.
      if (!user) {
        clearToken();
        return;
      }

      setCurrentUser(user);
      const { fresh, courses, run } = await refreshEssential(user);
      setAuthReady(true);
      await refreshDeferred(fresh, courses, run);
    } catch (err: any) {
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
        showAlertRef.current?.(message, 'Load Failed');
      }
    } finally {
      restoringRef.current = false;
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Synchronize authentication changes across browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gabay_token') {
        if (!e.newValue && currentUserRef.current) {
          clearToken();
          setCurrentUser(null);
          try {
            likhaLmsApi?.invalidateCache?.();
          } catch {}
        } else if (e.newValue && !currentUserRef.current) {
          void restoreSession();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [restoreSession]);

  const isAuthenticated = currentUser !== null;
  const activeUser = currentUser || db.users[0];
  const activeUserRef = useRef(activeUser);
  activeUserRef.current = activeUser;
  const activeRole: UserRole = currentUser?.role || 'student';

  const login = async (emailOrId: string, password: string, rememberMe = true): Promise<{ success: boolean; message?: string; user?: User }> => {
    const cleanEmail = emailOrId.trim().toLowerCase();
    let pendingList = pendingRegistrationsRef.current || pendingRegistrations;
    let pending = pendingList.find(
      r => r.email.trim().toLowerCase() === cleanEmail || r.studentId?.trim().toLowerCase() === cleanEmail
    );

    if (pending && pending.status !== 'verified') {
      // Re-fetch pending registrations from Directus in case an administrator
      // approved/rejected the account while the user was on the login screen
      if (likhaLmsApi?.auth?.getPendingRegistrations) {
        try {
          const remoteList = await likhaLmsApi.auth.getPendingRegistrations();
          if (Array.isArray(remoteList) && remoteList.length > 0) {
            const mapped = remoteList.map(mapLikhaPendingRegistrationRow);
            const merged = deduplicatePendingRegistrations([...mapped, ...pendingList]);
            pendingRegistrationsRef.current = merged;
            setPendingRegistrations(merged);
            pending = merged.find(
              r => r.email.trim().toLowerCase() === cleanEmail || r.studentId?.trim().toLowerCase() === cleanEmail
            );
          }
        } catch (_) {}
      }

      if (pending && pending.status !== 'verified') {
        const isExpired = pending.status === 'expired' || Date.now() >= new Date(pending.expiresAt).getTime();
        if (isExpired) {
          if (pending.status !== 'expired') {
            setPendingRegistrations(prev =>
              prev.map(r => (r.id === pending!.id ? { ...r, status: 'expired' } : r))
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
    }

    // Likha-only auth: no Express /api/auth/login fallback.
    if (emailOrId.includes('@')) {
      try {
        const likhaAuth = await likhaLmsApi.loginLikhaUser(emailOrId, password);
        if (likhaAuth?.token && likhaAuth?.user) {
          setPendingRegistrations(prev =>
            prev.map(r =>
              (r.email.trim().toLowerCase() === cleanEmail || r.studentId?.trim().toLowerCase() === cleanEmail)
                ? { ...r, status: 'verified' as const, emailVerified: true }
                : r
            )
          );
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
          const userAvatar = resolveDirectusUserAvatar(likhaAuth.user, '') ||
            getCleanStoredAvatar(likhaAuth.user.id);
          const userBanner = resolveDirectusUserBanner(likhaAuth.user.banner, '') ||
            getCleanStoredBanner(likhaAuth.user.id);
          const rawMappedUser: User = {
            id: likhaAuth.user.id,
            name: resolveDirectusUserName(likhaAuth.user, likhaAuth.user.email),
            firstName: likhaAuth.user.first_name || undefined,
            middleName: likhaAuth.user.middle_name || undefined,
            lastName: likhaAuth.user.last_name || undefined,
            email: likhaAuth.user.email,
            role: mapped.role,
            adminSubrole: mapped.adminSubrole,
            avatar: userAvatar,
            banner: userBanner,
            department:
              likhaAuth.user.department ||
              (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
            title: (mapped.role === 'student' ? 'Undergraduate Student' : (likhaAuth.user.title || mapped.title)),
            collegeId: likhaAuth.user.college_id || likhaAuth.user.collegeId,
            collegeName: likhaAuth.user.college_name || likhaAuth.user.collegeName,
            yearLevel: likhaAuth.user.year_level !== undefined ? Number(likhaAuth.user.year_level) : (likhaAuth.user.yearLevel !== undefined ? Number(likhaAuth.user.yearLevel) : undefined),
            yearsOfTeaching: likhaAuth.user.years_of_teaching !== undefined ? Number(likhaAuth.user.years_of_teaching) : (likhaAuth.user.yearsOfTeaching !== undefined ? Number(likhaAuth.user.yearsOfTeaching) : undefined),
          };
          const mappedUser = normalizeChancellorUser(applyStoredUserProfile(rawMappedUser));
          setToken(likhaAuth.token, rememberMe);
          const essentialLikha = await refreshEssential(mappedUser);
          void refreshDeferred(essentialLikha.fresh, essentialLikha.courses, essentialLikha.run);
          const effectiveUser = essentialLikha.fresh.users.find(u => u.id === mappedUser.id) || mappedUser;
          setCurrentUser(effectiveUser);
          return { success: true, user: effectiveUser };
        }
      } catch (likhaErr: any) {
        if (likhaErr?.status === 502 || likhaErr?.statusCode === 502 || String(likhaErr?.message).includes('502')) {
          return { success: false, message: 'The system is currently experiencing technical issues. Please try again later.' };
        }
        const msg = String(likhaErr?.message || '');
        if (msg.includes('401') || msg.includes('authentication failed')) {
          return { success: false, message: 'Invalid email or password.' };
        }
      }
    }

    if (import.meta.env.DEV) {
      const localUser = db.users.find(
        u => (u.email.toLowerCase() === cleanEmail || u.studentId?.toLowerCase() === cleanEmail)
      );
      if (localUser) {
        const effectiveUser = normalizeChancellorUser(applyStoredUserProfile(localUser));
        if (!effectiveUser.password || effectiveUser.password !== password) {
          return { success: false, message: 'Invalid email or password.' };
        }
        setCurrentUser(effectiveUser);
        return { success: true, user: effectiveUser };
      }
    }

    return { success: false, message: 'Login failed.' };
  };

  const logout = () => {
    try {
      likhaLmsApi.auth.logout();
    } catch (_) {}
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
      const foundChancellor = db.users.find(u => u.role === 'superadmin' || isChancellorEmail(u.email));
      if (foundChancellor) {
        userWithRole = normalizeChancellorUser(foundChancellor);
      } else {
        userWithRole = {
          id: 'usr-chancellor-default',
          name: 'University Chancellor',
          email: import.meta.env?.VITE_CHANCELLOR_EMAIL || 'chancellor@dmmmsu.edu.ph',
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
      const course = dbRef.current.courses?.find(c => c.id === courseId);
      const user = currentUser || activeUserRef.current;
      const canManage = canManageCourseContent(course, user) || (user?.role !== 'student');
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
        syllabusSettled,
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
        Promise.resolve().then(() => likhaLmsApi?.syllabus?.getCourseSyllabus?.(courseId, canManage) ?? null),
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

      let syllabusEnvelope = syllabusSettled.status === 'fulfilled' ? syllabusSettled.value : null;
      if (syllabusEnvelope) {
        setSyllabusRevisions(prev => ({ ...prev, [courseId]: syllabusEnvelope.revision }));
      }
      setDb(prev => ({
        ...prev,
        courses: prev.courses.map(c => (c.id === courseId && syllabusEnvelope ? {
          ...c,
          syllabus: { ...syllabusEnvelope.syllabus, courseId },
          ...(syllabusEnvelope.syllabus.facultyMembers?.[0]?.name ? { instructorName: syllabusEnvelope.syllabus.facultyMembers[0].name } : {})
        } : c)),
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
  }, [currentUser]);

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
    const course = db.courses.find(c => String(c.id).trim() === String(courseId).trim());
    return effectiveTerms(course ?? null, course?.syllabus ?? null);
  };

  const isCourseGradeReady = (courseId: string): boolean => {
    const course = db.courses.find(c => String(c.id).trim() === String(courseId).trim());
    return isSyllabusGradeReady(syllabusRevisions[courseId] ?? null, course?.syllabus ?? null);
  };

  const hasCourseSyllabus = (courseId: string): boolean => {
    const course = db.courses.find(c => String(c.id).trim() === String(courseId).trim());
    return Boolean(course?.syllabus);
  };

  const defaultTermForCourse = (courseId: string): TermId =>
    effectiveTermsForCourse(courseId)[0] ?? 'midterm';

  const createCourse = async (courseData: Partial<Course>): Promise<Course> => {
    const uniqueJoinCode =
      courseData.joinCode?.trim().toUpperCase() ||
      generateCourseJoinCode(db.courses, courseData.code);
    const courseId = courseData.id || generateUuid();

    try {
      // Likha ERP is the source of truth (Express /api/courses is RAG-only now).
      const row = await likhaLmsApi.courses.createCourse({
        id: courseId,
        code: courseData.code || 'CMSC 199',
        title: courseData.title || 'Advanced Computer Science Topics',
        section: courseData.section || 'BSCS 4-1',
        term: courseData.term || '1st Sem AY 2026-2027',
        instructor_name: courseData.instructorName || (isFacultyRole(activeUser, activeRole) ? activeUser.name : 'Unassigned Instructor'),
        instructor_id: courseData.instructorId || (isFacultyRole(activeUser, activeRole) ? activeUser.id : ''),
        published: courseData.published ?? true,
        color: courseData.color !== undefined ? courseData.color : '',
        image: courseData.image || '',
        credits: courseData.credits || 3,
        ched_compliance_code: courseData.chedComplianceCode || 'CMO-25-2015',
        join_code: uniqueJoinCode
      });

      const course: Course = {
        id: String((row as any)?.id ?? courseId),
        code: (row as any)?.code || courseData.code || 'CMSC 199',
        title: (row as any)?.title || courseData.title || 'Advanced Computer Science Topics',
        section: (row as any)?.section || courseData.section || 'BSCS 4-1',
        term: (row as any)?.term || courseData.term || '1st Sem AY 2026-2027',
        instructorId: courseData.instructorId || (isFacultyRole(activeUser, activeRole) ? activeUser.id : ''),
        instructorName: courseData.instructorName || (isFacultyRole(activeUser, activeRole) ? activeUser.name : 'Unassigned Instructor'),
        published: (row as any)?.published ?? courseData.published ?? true,
        color: (row as any)?.color ?? (courseData.color !== undefined ? courseData.color : ''),
        image: (row as any)?.image || courseData.image || '',
        enrolledCount: 0,
        credits: (row as any)?.credits || courseData.credits || 3,
        chedComplianceCode: (row as any)?.ched_compliance_code || courseData.chedComplianceCode || 'CMO-25-2015',
        joinCode: (row as any)?.join_code || uniqueJoinCode,
        schoolYear:
          courseData.schoolYear ||
          courseData.term?.match(/\b\d{4}-\d{4}\b/)?.[0] ||
          (activeUser?.collegeId ? getActiveSchoolYearForCollege(activeUser.collegeId)?.year : undefined) ||
          (departments.find(d => d.id === activeUser?.department || d.name?.toLowerCase() === activeUser?.department?.toLowerCase() || d.chairpersonId === activeUser?.id)?.collegeId
            ? getActiveSchoolYearForCollege(departments.find(d => d.id === activeUser?.department || d.name?.toLowerCase() === activeUser?.department?.toLowerCase() || d.chairpersonId === activeUser?.id)!.collegeId)?.year
            : undefined) ||
          getActiveSchoolYearForCollege('col-ccs')?.year ||
          '2025-2026',
        semester: courseData.semester || (row as any)?.semester || (courseData.term ? normalizeAcademicSemester(courseData.term) : undefined),
        department: (row as any)?.department || courseData.department || undefined,
        departmentId: (row as any)?.department_id || (row as any)?.departmentId || courseData.departmentId || undefined,
        collegeId:
          (row as any)?.college_id ||
          (row as any)?.collegeId ||
          courseData.collegeId ||
          (activeUser?.collegeId ? activeUser.collegeId : undefined) ||
          'col-ccs',
        programId: (row as any)?.program_id || (row as any)?.programId || courseData.programId || undefined,
        syllabusStatus: (row as any)?.syllabus_status || courseData.syllabusStatus || 'locked',
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

  const updateCourse = async (courseId: string, updates: Partial<Course>): Promise<Course> => {
    try {
      const payload: Record<string, any> = {};
      if (updates.code !== undefined) payload.code = updates.code;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.section !== undefined) payload.section = updates.section;
      if (updates.term !== undefined) payload.term = updates.term;
      if (updates.schoolYear !== undefined) payload.school_year = updates.schoolYear;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.image !== undefined) payload.image = updates.image;
      if (updates.credits !== undefined) payload.credits = updates.credits;
      if (updates.chedComplianceCode !== undefined) payload.ched_compliance_code = updates.chedComplianceCode;
      if (updates.published !== undefined) payload.published = updates.published;
      if (updates.instructorId !== undefined) payload.instructor_id = updates.instructorId;
      if (updates.instructorName !== undefined) payload.instructor_name = updates.instructorName;
      if (updates.joinCode !== undefined) payload.join_code = updates.joinCode;

      const res = await likhaLmsApi.courses.updateCourse(courseId, payload);
      let updatedCourse: Course | undefined;
      setDb(prev => {
        const nextCourses = (prev.courses || []).map(c => {
          if (c.id === courseId) {
            updatedCourse = {
              ...c,
              ...updates,
              ...(res ? normalizeCourse(res) : {}),
              joinCode: updates.joinCode || (res as any)?.join_code || c.joinCode,
              id: c.id,
            };
            return updatedCourse;
          }
          return c;
        });
        return {
          ...prev,
          courses: nextCourses,
        };
      });

      showAlert({
        title: 'Course Updated',
        message: `Course "${updates.code || ''} ${updates.title || ''}".trim() has been updated successfully.`,
        type: 'success'
      });

      return updatedCourse || (db.courses.find(c => c.id === courseId) as Course);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update course.';
      setLastError(message);
      showAlert(message, 'Update Course Failed');
      throw err;
    }
  };

  const deleteCourse = async (courseId: string): Promise<void> => {
    if (!canDeleteCourse(currentUser, activeRole)) {
      const message = 'Only Department Chairpersons have permission to delete courses.';
      showAlert({
        title: 'Unauthorized Action',
        message,
        type: 'error'
      });
      throw new Error(message);
    }
    try {
      // Children-first cascade: Directus has no server-side CASCADE, so a
      // bare course DELETE orphans (or is blocked by) modules, items,
      // syllabus rows, announcements, assessments, files, grades, etc.
      await likhaLmsApi.courses.deleteCourse(courseId);
      // Purge every course-scoped slice so no orphaned modules, items,
      // syllabus revisions, announcements, assessments, files, grades,
      // sections, or requests survive in the UI.
      setDb(prev => {
        const keep = <T extends { courseId?: string }>(rows: T[] | undefined) =>
          (rows || []).filter(r => r.courseId !== courseId);
        const { [courseId]: _droppedCfg, ...sprConfigs } = prev.sprConfigs || {};
        const { [courseId]: _droppedScores, ...sprScores } = prev.sprScores || {};

        const droppedModuleIds = new Set((prev.modules || []).filter(m => m.courseId === courseId).map(m => m.id));
        const droppedAnnouncementIds = new Set((prev.announcements || []).filter(a => a.courseId === courseId).map(a => a.id));
        const droppedDiscussionIds = new Set((prev.discussions || []).filter(d => d.courseId === courseId).map(d => d.id));
        const droppedActivityIds = new Set([
          ...(prev.activities || []).filter(a => a.courseId === courseId).map(a => a.id),
          ...(prev.quizzes || []).filter(q => q.courseId === courseId).map(q => q.id),
          ...(prev.exams || []).filter(e => e.courseId === courseId).map(e => e.id),
        ]);
        const droppedRelatedIds = new Set([
          ...droppedModuleIds,
          ...droppedAnnouncementIds,
          ...droppedDiscussionIds,
          ...droppedActivityIds,
        ]);

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
          messages: (prev.messages || []).filter(m => m.courseId !== courseId),
          chatGroups: (prev.chatGroups || []).filter(g => g.courseId !== courseId),
          notifications: (prev.notifications || []).filter(
            n => (n as any).courseId !== courseId && (!n.relatedId || !droppedRelatedIds.has(n.relatedId))
          ),
          users: (prev.users || []).map(u =>
            (u.enrolledCourseIds || []).includes(courseId)
              ? { ...u, enrolledCourseIds: (u.enrolledCourseIds || []).filter(c => c !== courseId) }
              : u
          ),
          sprConfigs,
          sprScores,
        };
      });
      setNotifications(prev => {
        const droppedRelatedIds = new Set([
          ...(db.modules || []).filter(m => m.courseId === courseId).map(m => m.id),
          ...(db.announcements || []).filter(a => a.courseId === courseId).map(a => a.id),
          ...(db.discussions || []).filter(d => d.courseId === courseId).map(d => d.id),
          ...(db.activities || []).filter(a => a.courseId === courseId).map(a => a.id),
          ...(db.quizzes || []).filter(q => q.courseId === courseId).map(q => q.id),
          ...(db.exams || []).filter(e => e.courseId === courseId).map(e => e.id),
        ]);
        return (prev || []).filter(
          n => (n as any).courseId !== courseId && (!n.relatedId || !droppedRelatedIds.has(n.relatedId))
        );
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
        modules: (prev.modules || []).filter(m => m.id !== moduleId).map(m => m.prerequisiteModuleId === moduleId ? { ...m, prerequisiteModuleId: undefined } : m)
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
    const currentModule = (db.modules || []).find(m => m.id === moduleId);
    const existingOrders = (currentModule?.items || [])
      .map(it => (typeof it.order === 'number' ? it.order : Number(it.order) || 0));
    const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders, 0) : 0;
    const computedOrder = itemData.order !== undefined && itemData.order !== null
      ? Number(itemData.order)
      : Math.max(maxOrder + 1, Math.floor(Date.now() / 1000));

    const body: Record<string, any> = { order: computedOrder };
    if (itemData.title !== undefined) body.title = itemData.title;
    if (itemData.type !== undefined) body.type = itemData.type;
    if (itemData.published !== undefined) body.published = itemData.published;
    if (itemData.required !== undefined) body.required = itemData.required;
    if (itemData.completionCondition !== undefined) body.completionCondition = itemData.completionCondition;
    if (itemData.content !== undefined && itemData.content !== null) body.content = itemData.content;
    if (itemData.activityId !== undefined && itemData.activityId !== null) body.activityId = itemData.activityId;
    if (itemData.quizId !== undefined && itemData.quizId !== null) body.quizId = itemData.quizId;
    if (itemData.fileUrl !== undefined && itemData.fileUrl !== null) {
      body.fileUrl = itemData.fileUrl;
      body.url = itemData.fileUrl;
    }
    if (itemData.fileName !== undefined && itemData.fileName !== null) body.fileName = itemData.fileName;
    if (itemData.fileSize !== undefined && itemData.fileSize !== null) body.fileSize = itemData.fileSize;
    if (itemData.fileType !== undefined && itemData.fileType !== null) body.fileType = itemData.fileType;
    if (itemData.attachments !== undefined && itemData.attachments !== null) body.attachments = itemData.attachments;
    try {
      const patch = toLikhaItemPatch(body);
      const row = await likhaLmsApi.modules.createModuleItem({ module_id: moduleId, ...patch });
      const item = mapLikhaModuleItemRow({ module_id: moduleId, ...patch, ...(row as any) });
      setDb(prev => ({
        ...prev,
        modules: prev.modules.map(mod =>
          mod.id === moduleId
            ? { ...mod, items: [item, ...mod.items].sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0)) }
            : mod
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
      const body: Record<string, any> = {};
      const stringFields = [
        'title', 'type', 'completionCondition', 'content', 'activityId',
        'quizId', 'fileUrl', 'fileName', 'fileSize', 'fileType'
      ] as const;
      for (const key of stringFields) {
        const value = updates[key];
        if (value !== undefined && value !== null) body[key] = value;
      }
      if (updates.fileUrl) body.url = updates.fileUrl;
      if (updates.published !== undefined) body.published = updates.published;
      if (updates.required !== undefined) body.required = updates.required;
      if (updates.minScore !== undefined) body.minScore = updates.minScore;
      if (updates.attachments !== undefined) body.attachments = updates.attachments;
      if (updates.order !== undefined) body.order = updates.order;
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
              mod.id === destModuleId
                ? { ...mod, items: [moved, ...mod.items].sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0)) }
                : mod
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
            ? {
                ...mod,
                items: mod.items
                  .map(it => (it.id === itemId ? mapLikhaModuleItemRow({ ...it, ...(row as any) }) : it))
                  .sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0))
              }
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
    const questions = quizData.questions || [
      {
        id: `q-${Date.now()}-1`,
        text: 'Which architectural pattern is recommended for modern web applications?',
        type: 'multiple_choice',
        options: ['Component-based (e.g. React)', 'Monolithic CGI', 'FTP Server', 'Telnet Terminal'],
        correctAnswer: 'Component-based (e.g. React)',
        points: 10
      }
    ];
    const totalPoints = typeof (quizData as any).totalPoints === 'number'
      ? (quizData as any).totalPoints
      : typeof (quizData as any).total_points === 'number'
        ? (quizData as any).total_points
        : questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);
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
        total_points: totalPoints,
        questions,
        ...(quizData.timeLimitMinutes !== undefined ? { time_limit_minutes: quizData.timeLimitMinutes } : {}),
        ...(quizData.delayedUntil !== undefined ? { delayed_until: quizData.delayedUntil } : {}),
        ...(quizData.dueDate !== undefined ? { due_date: quizData.dueDate } : {}),
        ...(quizData.availableFrom !== undefined ? { available_from: quizData.availableFrom } : {}),
        ...(quizData.availableUntil !== undefined ? { available_until: quizData.availableUntil } : {}),
        ...(quizData.fileName !== undefined ? { file_name: quizData.fileName } : {}),
        ...(quizData.fileUrl !== undefined ? { file_url: quizData.fileUrl } : {}),
        ...(quizData.fileSize !== undefined ? { file_size: quizData.fileSize } : {})
      });
      const nowIso = new Date().toISOString();
      const merged = normalizeQuiz({
        ...mapLikhaQuizRow(saved),
        createdAt: saved.createdAt || saved.created_at || saved.date_created || quizData.createdAt || nowIso,
      });
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

  const updateQuiz = async (
    quizId: string,
    updates: Partial<Quiz>
  ): Promise<Quiz> => {
    try {
      const body: Record<string, unknown> = { id: quizId };
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.instructions !== undefined) body.instructions = updates.instructions;
      if (updates.timeLimitMinutes !== undefined) body.time_limit_minutes = updates.timeLimitMinutes;
      if (updates.dueDate !== undefined) body.due_date = updates.dueDate;
      if (updates.availableFrom !== undefined) body.available_from = updates.availableFrom;
      if (updates.availableUntil !== undefined) body.available_until = updates.availableUntil;
      if (updates.delayedUntil !== undefined) body.delayed_until = updates.delayedUntil;
      if (updates.published !== undefined) body.published = updates.published;
      if (updates.term !== undefined) body.term = updates.term;
      if (updates.fileName !== undefined) body.file_name = updates.fileName;
      if (updates.fileUrl !== undefined) body.file_url = updates.fileUrl;
      if (updates.fileSize !== undefined) body.file_size = updates.fileSize;
      if (updates.questions !== undefined) {
        body.questions = updates.questions;
        body.total_points = updates.questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);
      }
      if ((updates as any).totalPoints !== undefined) {
        body.total_points = (updates as any).totalPoints;
      }

      const saved = await likhaLmsApi.assessments.saveQuiz(body);
      const normalized = normalizeQuiz(mapLikhaQuizRow(saved));
      let merged: Quiz = normalized;
      setDb(prev => {
        const existing = (prev.quizzes || []).find(q => q.id === quizId);
        merged = {
          ...normalized,
          questions:
            normalized.questions && normalized.questions.length > 0
              ? normalized.questions
              : existing?.questions || []
        };
        return {
          ...prev,
          quizzes: (prev.quizzes || []).map(q => (q.id === quizId ? merged : q))
        };
      });

      return merged;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update quiz.';
      setLastError(message);
      showAlert(message, 'Update Quiz Failed');
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
      const classicPoints = data.pointsPossible ?? 100;
      const questionSetPoints = data.pointsPossible ?? activityPointsPossible(questions);
      const body: Record<string, unknown> =
        format === 'classic'
          ? {
              course_id: courseId,
              title: data.title?.trim() || 'New Course Activity',
              instructions:
                data.instructions || 'Please review the guidelines and submit your work before the deadline.',
              points_possible: classicPoints,
              total_points: classicPoints,
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
              ...(Array.isArray(data.attachments) ? {
                attachments: data.attachments,
                metadata: {
                  ...((data.metadata as any) || {}),
                  attachments: data.attachments,
                }
              } : {}),
              ...(data.availableFrom !== undefined ? { available_from: data.availableFrom } : {}),
              ...(data.availableUntil !== undefined ? { available_until: data.availableUntil } : {}),
              ...(data.sectionRestriction !== undefined ? { section_restriction: data.sectionRestriction } : {}),
              ...(data.assessmentType !== undefined ? { assessment_type: data.assessmentType, assessmentType: data.assessmentType } : {}),
              ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
              format: 'classic',
            }
          : {
              course_id: courseId,
              title: data.title?.trim() || 'New Question-Set Activity',
              term,
              instructions: data.instructions || 'Answer all questions carefully.',
              points_possible: questionSetPoints,
              total_points: questionSetPoints,
              ...(data.dueDate !== undefined ? { due_date: data.dueDate } : {}),
              ...(data.availableFrom !== undefined ? { available_from: data.availableFrom } : {}),
              ...(data.availableUntil !== undefined ? { available_until: data.availableUntil } : {}),
              published: data.published ?? true,
              questions,
              ...(data.assessmentType !== undefined ? { assessment_type: data.assessmentType, assessmentType: data.assessmentType } : {}),
              ...(data.category !== undefined ? { category: data.category } : {}),
              ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
              format: 'questionset',
            };
      // Likha ERP is the source of truth for activities.
      const nowIso = new Date().toISOString();
      const saved = await likhaLmsApi.assessments.saveActivity({
        ...body,
        metadata: {
          ...((body.metadata as any) || {}),
          createdAt: (body.metadata as any)?.createdAt || data.createdAt || nowIso,
        },
      });
      const merged = normalizeActivity({
        ...mapLikhaActivityRow(saved),
        createdAt: saved.createdAt || saved.created_at || saved.date_created || data.createdAt || nowIso,
      });
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
      if (updates.pointsPossible !== undefined) {
        body.points_possible = updates.pointsPossible;
        body.total_points = updates.pointsPossible;
      }
      if (updates.submissionTypes !== undefined) body.submission_types = updates.submissionTypes;
      if (updates.category !== undefined) body.category = updates.category;
      if (updates.weight !== undefined) body.weight = updates.weight;
      if (updates.rubric !== undefined) body.rubric = updates.rubric;
      if (updates.fileName !== undefined) body.file_name = updates.fileName;
      if (updates.fileUrl !== undefined) body.file_url = updates.fileUrl;
      if (updates.fileSize !== undefined) body.file_size = updates.fileSize;
      if (Array.isArray(updates.attachments)) {
        body.attachments = updates.attachments;
        body.metadata = {
          ...((updates.metadata as any) || {}),
          attachments: updates.attachments,
        };
      }
      if (updates.questions !== undefined) body.questions = updates.questions;
      if (updates.availableFrom !== undefined) body.available_from = updates.availableFrom;
      if (updates.availableUntil !== undefined) body.available_until = updates.availableUntil;
      if (updates.sectionRestriction !== undefined) body.section_restriction = updates.sectionRestriction;
      if (updates.assessmentType !== undefined) {
        body.assessment_type = updates.assessmentType;
        body.assessmentType = updates.assessmentType;
      }
      if (updates.metadata !== undefined) body.metadata = updates.metadata;
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
      studentId: person.studentId || (person.role === 'student' ? `2026-SLUC-${generateSecureDigits(4)}` : undefined),
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
      let row: any;
      try {
        row = await likhaLmsApi.users.createUser(payload);
      } catch (createErr: any) {
        const msg = String(createErr?.message || '');
        const isDuplicate =
          msg.includes('RECORD_NOT_UNIQUE') ||
          msg.includes('unique') ||
          createErr?.status === 400 ||
          createErr?.status === 409;
        if (isDuplicate && userData.email) {
          try {
            const allUsers = await likhaLmsApi.users.getUsers();
            const existing = allUsers.find(
              (u: any) => u.email?.toLowerCase() === userData.email?.toLowerCase()
            );
            if (existing?.id) {
              const updatePayload: Record<string, any> = { status: 'active' };
              if (payload.role) updatePayload.role = payload.role;
              if (payload.department) updatePayload.department = payload.department;
              if (userData.password) updatePayload.password = userData.password;
              row = await likhaLmsApi.users.updateUser(existing.id, updatePayload);
            }
          } catch (_) {}
        }
        if (!row) throw createErr;
      }
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
        studentId: userData.studentId || (role === 'student' ? `2026-${generateSecureDigits(5)}` : undefined),
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

  const updateUser = async (id: string, updates: Partial<User> & { banner?: string; avatarFileId?: string }): Promise<boolean> => {
    // Directus PATCH accepts core identity fields plus the role UUID FK, avatar file UUID, and banner string.
    const patchBody: Record<string, any> = {};
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

    // Avatar patch: extract directus_files UUID if present
    if (updates.avatar !== undefined) {
      if (!updates.avatar) {
        patchBody.avatar = null;
        if (typeof window !== 'undefined') localStorage.removeItem(`gabay_avatar_${id}`);
      } else {
        const uuidMatch = updates.avatar.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        const fileUuid = updates.avatarFileId || (uuidMatch ? uuidMatch[1] : null);
        if (fileUuid) {
          patchBody.avatar = fileUuid;
        }
        if (typeof window !== 'undefined') localStorage.setItem(`gabay_avatar_${id}`, updates.avatar);
      }
    }

    // Banner patch: varchar(255) in directus_users
    if (updates.banner !== undefined) {
      if (!updates.banner) {
        patchBody.banner = null;
        if (typeof window !== 'undefined') localStorage.removeItem(`gabay_banner_${id}`);
      } else {
        patchBody.banner = updates.banner;
        if (typeof window !== 'undefined') localStorage.setItem(`gabay_banner_${id}`, updates.banner);
      }
    }

    const localUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Partial<User>;

    const targetUser = db.users.find(u => u.id === id) || (currentUser && currentUser.id === id ? currentUser : undefined);
    const emailHint = updates.email || targetUser?.email;

    try {
      if (Object.keys(patchBody).length > 0) {
        const row = await likhaLmsApi.users.updateUser(id, patchBody);
        const mapped = mapLikhaUserRowToUser(row);
        // Name/email/department echo back from the server; every other field
        // keeps its local value unless explicitly updated. NOTE: `role` is
        // deliberately absent here, so a server-side role rejection is
        // invisible — the requested role still applies locally below.
        const serverEcho = {
          name: mapped.name,
          email: mapped.email,
          department: mapped.department,
          ...(mapped.avatar ? { avatar: mapped.avatar } : {}),
          ...(mapped.banner ? { banner: mapped.banner } : {}),
        };
        saveStoredUserProfile(id, { ...serverEcho, ...localUpdates }, emailHint);
        setDb(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === id ? { ...u, ...serverEcho, ...localUpdates } : u))
        }));
        // Active session reads from currentUser (not db.users) — sync it so
        // avatar/banner/name changes render instantly without a reload.
        setCurrentUser(prev => (prev && prev.id === id ? { ...prev, ...serverEcho, ...localUpdates } : prev));
      } else {
        saveStoredUserProfile(id, localUpdates, emailHint);
        setDb(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === id ? { ...u, ...localUpdates } : u))
        }));
        setCurrentUser(prev => (prev && prev.id === id ? { ...prev, ...localUpdates } : prev));
      }
      return true;
    } catch (err) {
      saveStoredUserProfile(id, localUpdates, emailHint);
      setDb(prev => ({
        ...prev,
        users: prev.users.map(u => (u.id === id ? { ...u, ...localUpdates } : u))
      }));
      setCurrentUser(prev => (prev && prev.id === id ? { ...prev, ...localUpdates } : prev));
      const message = err instanceof Error ? err.message : 'Failed to update user.';
      setLastError(message);
      showAlert(message, 'Update User Failed');
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    const userToDelete = db.users.find(u => u.id === userId);
    if (!userToDelete) {
      return { success: false, message: 'User not found.' };
    }

    // Guard: Prevent deleting active leadership seat accounts
    const isHoldingDeanSeat = colleges.some(c => c.deanId === userId);
    const isHoldingChairSeat = departments.some(d => d.chairpersonId === userId);
    const isLeadershipSeat = userToDelete.role === 'admin' && (userToDelete.adminSubrole === 'dean' || userToDelete.adminSubrole === 'chairperson');
    if (isHoldingDeanSeat || isHoldingChairSeat || isLeadershipSeat) {
      return {
        success: false,
        message: 'Cannot delete an active Dean or Chairperson seat account. Please transfer leadership authority to a successor before removing this account.'
      };
    }

    if (activeUser.id === userId) {
      return {
        success: false,
        message: 'You cannot delete your own active account.'
      };
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

  const refreshUsers = useCallback(async (): Promise<User[]> => {
    try {
      likhaLmsApi.invalidateCache('/users');
      const likhaUsers = await likhaLmsApi.users.getUsers();
      if (Array.isArray(likhaUsers) && likhaUsers.length > 0) {
        const storedProfiles = loadStoredUserProfiles();
        const pendingList = pendingRegistrationsRef.current || pendingRegistrations;

        const mappedUsers: User[] = likhaUsers.map((u: any) => {
          let mapped = mapDirectusRole(u.role, u.email, u.adminSubrole);
          const uEmail = (u.email || '').trim().toLowerCase();
          const knownReg = pendingList.find(r => r.email?.trim().toLowerCase() === uEmail);
          if (knownReg?.role === 'student' && mapped.role !== 'student') {
            mapped = { role: 'student', title: 'Undergraduate Student' };
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
            avatar: u.avatar
              ? resolveDirectusUserAvatar(u.avatar)
              : getCleanStoredAvatar(u.id),
            banner: u.banner
              ? resolveDirectusUserBanner(u.banner)
              : getCleanStoredBanner(u.id),
            department: u.department || (mapped.role === 'superadmin' ? 'Office of the Chancellor' : 'Department of Computer Science'),
            title: (mapped.role === 'student' ? 'Undergraduate Student' : (u.title || mapped.title)),
            collegeId: u.college_id || u.collegeId,
            collegeName: u.college_name || u.collegeName,
            schoolYear: u.school_year || u.schoolYear,
            yearLevel: u.year_level !== undefined ? Number(u.year_level) : (u.yearLevel !== undefined ? Number(u.yearLevel) : undefined),
            yearsOfTeaching: u.years_of_teaching !== undefined ? Number(u.years_of_teaching) : (u.yearsOfTeaching !== undefined ? Number(u.yearsOfTeaching) : undefined),
          };
          return normalizeChancellorUser(applyStoredUserProfile(baseUser, storedProfiles));
        });

        setDb(prev => {
          const merged = mappedUsers.map(nu => {
            const old = (prev.users || []).find(ou => ou.id === nu.id);
            return {
              ...nu,
              enrolledCourseIds: old?.enrolledCourseIds || nu.enrolledCourseIds,
            };
          });
          return {
            ...prev,
            users: merged,
          };
        });
        return mappedUsers;
      }
    } catch (err) {
      console.warn('[refreshUsers] failed to refresh user directory:', err);
    }
    return dbRef.current?.users || [];
  }, [pendingRegistrations, setDb]);

  const registerAccount = async (
    payload: {
      firstName: string;
      middleName?: string;
      lastName: string;
      fullName?: string;
      email: string;
      /**
       * Omit for `@dmmmsu.edu.ph` applicants: the role is left unassigned for a
       * chair or dean to settle when they approve. `@student.dmmmsu.edu.ph`
       * addresses are always registered as students.
       */
      role?: 'student' | 'faculty' | 'staff';
      collegeId: string;
      collegeName?: string;
      department: string;
      studentId: string;
      password: string;
    } & Partial<PendingRegistration>
  ): Promise<PendingRegistration> => {
    const id = payload.id || generateSecureId('reg');
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
    const updated = deduplicatePendingRegistrations([
      newRegistration,
      ...currentList.filter(
        r => r.id !== newRegistration.id && r.email.toLowerCase() !== newRegistration.email.toLowerCase()
      )
    ]);
    pendingRegistrationsRef.current = updated;
    setPendingRegistrations(updated);

    if (likhaLmsApi?.auth?.getPendingRegistrations && likhaLmsApi?.auth?.deletePendingRegistration) {
      likhaLmsApi.auth.getPendingRegistrations().then(async (remoteList) => {
        if (Array.isArray(remoteList)) {
          const matching = remoteList.filter(
            r => r.email && r.email.toLowerCase() === newRegistration.email.toLowerCase() && r.id !== newRegistration.id
          );
          for (const m of matching) {
            await likhaLmsApi.auth.deletePendingRegistration(m.id).catch(() => {});
          }
        }
      }).catch(() => {});
    }

    void likhaLmsApi?.auth?.submitRegistration?.({
      id: newRegistration.id,
      first_name: newRegistration.firstName,
      middle_name: newRegistration.middleName,
      last_name: newRegistration.lastName,
      full_name: newRegistration.fullName,
      email: newRegistration.email,
      role: newRegistration.role,
      college_id: newRegistration.collegeId,
      college_name: newRegistration.collegeName,
      department: newRegistration.department,
      program: newRegistration.program,
      student_id: newRegistration.studentId,
      email_verified: newRegistration.emailVerified,
      activation_token: newRegistration.activationToken,
      registered_at: newRegistration.registeredAt,
      expires_at: newRegistration.expiresAt,
      status: newRegistration.status,
      school_year: newRegistration.schoolYear,
    }).catch(() => {});
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

    let target = list.find(r => r.activationToken === token);
    if (!target && likhaLmsApi?.auth?.getPendingRegistrations) {
      try {
        const remoteList = await likhaLmsApi.auth.getPendingRegistrations();
        if (Array.isArray(remoteList) && remoteList.length > 0) {
          const mapped = remoteList.map(mapLikhaPendingRegistrationRow);
          target = mapped.find(r => r.activationToken === token);
          if (target) {
            list = deduplicatePendingRegistrations([target, ...list]);
          }
        }
      } catch (_) {}
    }

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

    const updated = list.map(r => (r.activationToken === token || (target && r.email && r.email.toLowerCase() === target.email.toLowerCase()) ? { ...r, emailVerified: true } : r));
    pendingRegistrationsRef.current = updated;
    setPendingRegistrations(updated);
    try {
      const sanitized = updated.map(({ password: _, ...rest }) => rest);
      safeSetLocalStorage(STORAGE_KEY_PENDING_REGISTRATIONS, JSON.stringify(sanitized));
    } catch (_) {}
    if (likhaLmsApi?.auth?.updatePendingRegistration) {
      await likhaLmsApi.auth.updatePendingRegistration(target.id, { email_verified: true }).catch(() => {});
    }
    return { success: true, message: 'Email address successfully verified.' };
  }, []);


  /**
   * Approve a pending registration. Student applications already carry their
   * role; `@dmmmsu.edu.ph` applicants arrive without one, so the approving
   * chair or dean passes the Faculty/Staff role they picked.
   */
  const verifyRegistration = async (
    id: string,
    assignedRole?: 'faculty' | 'staff'
  ): Promise<{ success: boolean; message: string; user?: User }> => {
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

    const resolvedRole = target.role || assignedRole;
    if (!resolvedRole) {
      return {
        success: false,
        message: 'Assign this applicant as Faculty or Staff before approving the account.',
      };
    }

    let createdUser: User;
    try {
      createdUser = await createUser({
        name: target.fullName,
        firstName: target.firstName,
        middleName: target.middleName,
        lastName: target.lastName,
        email: target.email,
        role: resolvedRole,
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
        role: resolvedRole,
        department: target.department,
        collegeId: target.collegeId,
        collegeName: target.collegeName,
        studentId: target.studentId,
        password: target.password,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: resolvedRole === 'student' ? 'Undergraduate Student' : 'Instructor',
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

    const targetEmail = (target.email || '').trim().toLowerCase();
    const verifyUpdated = (pendingRegistrationsRef.current || pendingRegistrations).map(r =>
      (r.id === id || (targetEmail && (r.email || '').trim().toLowerCase() === targetEmail))
        ? { ...r, role: resolvedRole, status: 'verified' as const, emailVerified: true }
        : r
    );
    pendingRegistrationsRef.current = verifyUpdated;
    setPendingRegistrations(verifyUpdated);
    void likhaLmsApi?.auth?.updatePendingRegistration?.(id, { role: resolvedRole, status: 'verified' }).catch(() => {});

    return {
      success: true,
      message: 'User registration approved and active account created.',
      user: createdUser,
    };
  };

  const rejectRegistration = async (id: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    const list = pendingRegistrationsRef.current || pendingRegistrations;
    const target = list.find(r => r.id === id);
    const targetEmail = (target?.email || '').trim().toLowerCase();
    const rejectUpdated = list.map(r =>
      (r.id === id || (targetEmail && (r.email || '').trim().toLowerCase() === targetEmail))
        ? { ...r, status: 'rejected' as const }
        : r
    );
    pendingRegistrationsRef.current = rejectUpdated;
    setPendingRegistrations(rejectUpdated);
    void likhaLmsApi?.auth?.updatePendingRegistration?.(id, { status: 'rejected' }).catch(() => {});
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
    roleType: LeadershipRoleType,
    currentLeaderId: string,
    successorId: string,
    unitId: string,
    transitionNotes?: string,
    appointeeMetadata?: {
      title?: string;
      resolutionNo?: string;
    }
  ): Promise<{ success: boolean; message: string }> => {
    if (currentLeaderId === successorId) {
      return { success: false, message: 'Predecessor and successor cannot be the same user.' };
    }

    const targetCol = roleType === 'dean' ? colleges.find(c => c.id === unitId) : undefined;
    const targetDept = roleType === 'chairperson' ? departments.find(d => d.id === unitId) : undefined;

    // Institutional Seat Handover Model:
    // The leadership account (currentLeaderId) represents the official office seat (Dean, Chair, Admin).
    // It NEVER steps down to faculty. Its role remains administrative, personal details of the predecessor
    // are cleared from the seat profile, and the predecessor's tenure history is archived into the Governance Timeline.
    const predecessorUser = db.users.find(u => u.id === currentLeaderId);
    const matchedSuccessorUser = db.users.find(u => u.id === successorId);
    const newAppointeeName = matchedSuccessorUser?.name || successorId;
    const newAppointeeTitle = appointeeMetadata?.title || (roleType === 'dean' ? 'College Dean' : roleType === 'chairperson' ? 'Program Chairperson' : 'Institutional Administrator');

    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id === currentLeaderId) {
          return {
            ...u,
            name: newAppointeeName,
            title: newAppointeeTitle,
            role: 'admin' as UserRole, // Institutional seat account NEVER steps down to faculty
            adminSubrole: roleType === 'admin' ? 'chancellor' : roleType,
            ...(roleType === 'dean'
              ? { collegeId: unitId, collegeName: targetCol?.name }
              : roleType === 'chairperson'
              ? { department: targetDept?.name || u.department || '', collegeId: targetDept?.collegeId }
              : {}),
            // Clear former holder's personal profile fields from the seat account
            birthday: undefined,
            contactNumber: undefined,
            permanentAddress: undefined,
            presentAddress: undefined,
            permanentAddressDetails: undefined,
            presentAddressDetails: undefined,
            educationalBackground: undefined,
          };
        }
        if (matchedSuccessorUser && u.id === matchedSuccessorUser.id) {
          return {
            ...u,
            role: 'admin' as UserRole,
            adminSubrole: roleType === 'admin' ? 'chancellor' : roleType,
            title: newAppointeeTitle,
            ...(roleType === 'dean'
              ? { collegeId: unitId, collegeName: targetCol?.name }
              : roleType === 'chairperson'
              ? { department: targetDept?.name || u.department || '', collegeId: targetDept?.collegeId }
              : {}),
          };
        }
        return u;
      }),
    }));

    setCurrentUser(prev => {
      if (!prev) return prev;
      if (prev.id === currentLeaderId) {
        return {
          ...prev,
          name: newAppointeeName,
          title: newAppointeeTitle,
          role: 'admin' as UserRole, // NEVER steps down to faculty
          adminSubrole: roleType === 'admin' ? 'chancellor' : roleType,
          birthday: undefined,
          contactNumber: undefined,
          permanentAddress: undefined,
          presentAddress: undefined,
          permanentAddressDetails: undefined,
          presentAddressDetails: undefined,
          educationalBackground: undefined,
        };
      }
      if (matchedSuccessorUser && prev.id === matchedSuccessorUser.id) {
        return {
          ...prev,
          role: 'admin' as UserRole,
          adminSubrole: roleType === 'admin' ? 'chancellor' : roleType,
          title: newAppointeeTitle,
          ...(roleType === 'dean'
            ? { collegeId: unitId, collegeName: targetCol?.name }
            : roleType === 'chairperson'
            ? { department: targetDept?.name || prev.department || '', collegeId: targetDept?.collegeId }
            : {}),
        };
      }
      return prev;
    });

    // Single-seat invariant in colleges and departments: assign successor seat to unitId,
    // clear previous unit held by currentLeaderId if different, and vacate cross-unit assignments.
    const effectiveSeatId = matchedSuccessorUser ? matchedSuccessorUser.id : (currentLeaderId !== 'none' && currentLeaderId ? currentLeaderId : successorId);
    if (roleType === 'dean') {
      setColleges(prev => {
        const next = prev.map(c => {
          if (c.id === unitId) return { ...c, deanId: effectiveSeatId };
          if (c.deanId === currentLeaderId && c.id !== unitId) return { ...c, deanId: undefined };
          if (c.deanId === effectiveSeatId && c.id !== unitId) return { ...c, deanId: undefined };
          return c;
        });
        safeSetLocalStorage(STORAGE_KEY_COLLEGES, JSON.stringify(next));
        return next;
      });
      setDepartments(prev => {
        const hasMatch = prev.some(d => d.chairpersonId === effectiveSeatId);
        if (!hasMatch) return prev;
        const next = prev.map(d => {
          if (d.chairpersonId === effectiveSeatId) return { ...d, chairpersonId: undefined };
          return d;
        });
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
        return next;
      });
    } else if (roleType === 'chairperson') {
      setDepartments(prev => {
        const next = prev.map(d => {
          if (d.id === unitId) return { ...d, chairpersonId: effectiveSeatId };
          if (d.chairpersonId === currentLeaderId && d.id !== unitId) return { ...d, chairpersonId: undefined };
          if (d.chairpersonId === effectiveSeatId && d.id !== unitId) return { ...d, chairpersonId: undefined };
          return d;
        });
        safeSetLocalStorage(STORAGE_KEY_DEPARTMENTS, JSON.stringify(next));
        return next;
      });
      setColleges(prev => {
        const hasMatch = prev.some(c => c.deanId === effectiveSeatId);
        if (!hasMatch) return prev;
        const next = prev.map(c => {
          if (c.deanId === effectiveSeatId) return { ...c, deanId: undefined };
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
        syncPromises.push(likhaLmsApi.users.updateUser(effectiveSeatId, { name: newAppointeeName, role: 'admin' }).catch(() => {}));
      }
      if (likhaLmsApi?.academicStructure) {
        if (roleType === 'dean') {
          syncPromises.push(likhaLmsApi.academicStructure.updateCollege(unitId, { dean_id: effectiveSeatId }).catch(() => {}));
        } else if (roleType === 'chairperson') {
          syncPromises.push(likhaLmsApi.academicStructure.updateDepartment(unitId, { chairperson_id: effectiveSeatId }).catch(() => {}));
        }
      }
      if (syncPromises.length > 0) {
        await Promise.allSettled(syncPromises);
      }
    } catch (_) {}

    
    const nowIso = new Date().toISOString();

    let targetUnitName = 'Institutional Administration';
    let unitCategory: 'system' | 'college' | 'department' = 'system';
    if (roleType === 'dean') {
      targetUnitName = targetCol?.name || 'Academic College';
      unitCategory = 'college';
    } else if (roleType === 'chairperson') {
      targetUnitName = targetDept?.name || 'Academic Department';
      unitCategory = 'department';
    }

    setLeadershipTenures(prev => {
      const updated = prev.map(t => {
        if ((t.unitId === unitId || t.leaderId === currentLeaderId) && t.status === 'active') {
          return {
            ...t,
            endDate: nowIso,
            status: 'completed' as TenureStatus,
          };
        }
        return t;
      });

      const newTenure: LeadershipTenure = {
        id: generateSecureId('tenure'),
        role: roleType,
        unitId,
        unitName: targetUnitName,
        unitType: unitCategory,
        leaderId: effectiveSeatId,
        leaderName: newAppointeeName,
        leaderEmail: matchedSuccessorUser?.email || predecessorUser?.email,
        leaderAvatar: matchedSuccessorUser?.avatar || predecessorUser?.avatar,
        startDate: nowIso,
        endDate: null,
        status: 'active',
        appointedBy: currentUser?.name || currentUser?.id || 'System Administrator',
        transitionNotes: transitionNotes || `Leadership handover to ${newAppointeeName}.`,
      };

      const nextTenures = [newTenure, ...updated];
      safeSetLocalStorage(STORAGE_KEY_LEADERSHIP_TENURES, JSON.stringify(nextTenures));
      void likhaLmsApi?.governance?.createTenure?.({
        id: newTenure.id,
        role: newTenure.role,
        unit_id: newTenure.unitId,
        unit_name: newTenure.unitName,
        unit_type: newTenure.unitType,
        leader_id: newTenure.leaderId,
        leader_name: newTenure.leaderName,
        leader_email: newTenure.leaderEmail,
        start_date: newTenure.startDate,
        end_date: newTenure.endDate,
        status: newTenure.status,
        appointed_by: newTenure.appointedBy,
        transition_notes: newTenure.transitionNotes,
      }).catch(() => {});
      return nextTenures;
    });

    const newAuditLog: GovernanceAuditLog = {
      id: generateSecureId('audit'),
      timestamp: nowIso,
      eventType: 'leadership_transfer',
      title: `Leadership Handover: ${roleType === 'dean' ? 'Dean' : roleType === 'chairperson' ? 'Program Chair' : 'System Admin'}`,
      description: `${newAppointeeName} assumed leadership of ${targetUnitName}, succeeding ${predecessorUser?.name || 'predecessor'}.`,
      actorId: currentUser?.id || 'system',
      actorName: currentUser?.name || 'Administrator',
      actorRole: currentUser?.role || 'admin',
      unitId,
      unitType: unitCategory,
      targetId: effectiveSeatId,
      targetType: 'user',
      metadata: {
        roleType,
        predecessorId: currentLeaderId,
        predecessorName: predecessorUser?.name,
        successorId: effectiveSeatId,
        successorName: newAppointeeName,
        notes: transitionNotes,
      },
    };

    setGovernanceAuditLogs(prev => {
      const nextLogs = [newAuditLog, ...prev];
      safeSetLocalStorage(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS, JSON.stringify(nextLogs));
      void likhaLmsApi?.governance?.createAuditLog?.({
        id: newAuditLog.id,
        timestamp: newAuditLog.timestamp,
        event_type: newAuditLog.eventType,
        title: newAuditLog.title,
        description: newAuditLog.description,
        actor_id: newAuditLog.actorId,
        actor_name: newAuditLog.actorName,
        actor_role: newAuditLog.actorRole,
        unit_id: newAuditLog.unitId,
        unit_type: newAuditLog.unitType,
        target_id: newAuditLog.targetId,
        target_type: newAuditLog.targetType,
        metadata: newAuditLog.metadata,
      }).catch(() => {});
      return nextLogs;
    });

    return {
      success: true,
      message: `Leadership transferred successfully to ${roleType === 'dean' ? 'Dean' : roleType === 'chairperson' ? 'Chairperson' : 'System Administrator'} successor.`,
    };
  };

  const appointLeadership = async (
    roleType: LeadershipRoleType,
    leaderId: string,
    unitId: string,
    transitionNotes?: string
  ): Promise<{ success: boolean; message: string }> => {
    return transferLeadership(roleType, 'none', leaderId, unitId, transitionNotes);
  };

  const logGovernanceEvent = useCallback((event: Omit<GovernanceAuditLog, 'id' | 'timestamp'>) => {
    const newLog: GovernanceAuditLog = {
      ...event,
      id: generateSecureId('audit'),
      timestamp: new Date().toISOString(),
    };
    setGovernanceAuditLogs(prev => {
      const next = [newLog, ...prev];
      safeSetLocalStorage(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS, JSON.stringify(next));
      void likhaLmsApi?.governance?.createAuditLog?.({
        id: newLog.id,
        timestamp: newLog.timestamp,
        event_type: newLog.eventType,
        title: newLog.title,
        description: newLog.description,
        actor_id: newLog.actorId,
        actor_name: newLog.actorName,
        actor_role: newLog.actorRole,
        unit_id: newLog.unitId,
        unit_type: newLog.unitType,
        target_id: newLog.targetId,
        target_type: newLog.targetType,
        metadata: newLog.metadata,
      }).catch(() => {});
      return next;
    });
  }, []);

  const getTenureMetrics = useCallback((tenure: LeadershipTenure) => {
    const start = new Date(tenure.startDate).getTime();
    const end = tenure.endDate ? new Date(tenure.endDate).getTime() : Date.now();

    // 1. Scoped courses
    const scopedCourses = (db.courses || []).filter(c => {
      if (tenure.unitType === 'college') {
        if (c.collegeId && c.collegeId !== tenure.unitId) return false;
      } else if (tenure.unitType === 'department') {
        const cDept = c.departmentId || c.department || c.programId;
        if (cDept && cDept !== tenure.unitId && cDept !== tenure.unitName) return false;
      }
      return true;
    });

    // 2. Scoped students enrolled
    const scopedStudents = (db.users || []).filter(u => {
      if (u.role !== 'student') return false;
      if (tenure.unitType === 'college') {
        if (u.collegeId && u.collegeId !== tenure.unitId) return false;
      } else if (tenure.unitType === 'department') {
        const uDept = u.program || u.department;
        if (uDept && uDept !== tenure.unitName && uDept !== tenure.unitId) return false;
      }
      if (u.registeredAt) {
        const regTime = new Date(u.registeredAt).getTime();
        return regTime >= start && regTime <= end;
      }
      return true;
    });

    // 3. Syllabi count
    const scopedSyllabi = scopedCourses.filter(c => Boolean(c.syllabus)).length;

    // 4. Faculty assigned
    const scopedFaculty = (db.users || []).filter(u => {
      if (u.role !== 'faculty' && u.adminSubrole !== 'chairperson') return false;
      if (tenure.unitType === 'college') {
        return u.collegeId === tenure.unitId || (u.collegeName && u.collegeName === tenure.unitName);
      } else if (tenure.unitType === 'department') {
        const uDept = u.program || u.department;
        return uDept === tenure.unitName || uDept === tenure.unitId;
      }
      return true;
    }).length;

    return {
      coursesCreated: scopedCourses.length,
      studentsEnrolled: scopedStudents.length,
      syllabiCount: scopedSyllabi,
      facultyAssigned: scopedFaculty,
    };
  }, [db.courses, db.users]);

  const getTenureAuditTrail = useCallback((tenure: LeadershipTenure) => {
    const start = new Date(tenure.startDate).getTime();
    const end = tenure.endDate ? new Date(tenure.endDate).getTime() : Date.now();

    // 1. Direct governance audit logs
    const matchingLogs = (governanceAuditLogs || []).filter(l => {
      const logTime = new Date(l.timestamp).getTime();
      if (logTime < start || logTime > end) return false;
      if (tenure.unitType === 'system') return true;
      if (l.unitId && l.unitId !== tenure.unitId) return false;
      return true;
    });

    // 2. Associated course events
    const courseEvents = (db.courses || [])
      .filter(c => {
        if (tenure.unitType === 'college' && c.collegeId && c.collegeId !== tenure.unitId) return false;
        if (tenure.unitType === 'department') {
          const cDept = c.departmentId || c.department || c.programId;
          if (cDept && cDept !== tenure.unitId && cDept !== tenure.unitName) return false;
        }
        return true;
      })
      .slice(0, 15)
      .map(c => ({
        id: `evt-crs-${c.id}`,
        timestamp: tenure.startDate,
        title: `Curriculum Offering: ${c.code}`,
        description: `Course "${c.title}" section ${c.section} active under this administration.`,
        eventType: 'course_created',
        actorName: c.instructorName || 'Academic Department',
      }));

    const combined = [...matchingLogs, ...courseEvents];
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return combined;
  }, [governanceAuditLogs, db.courses]);

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

      // Update db.users: promote candidate, leadership seat accounts NEVER step down to faculty
      setDb(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (predecessorId && u.id === predecessorId) {
            return {
              ...u,
              role: 'admin' as UserRole, // Institutional leadership seats remain administrative
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
          return { ...prev, role: 'admin' as UserRole, adminSubrole: undefined };
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

      // Record leadership tenure closure and new tenure if predecessor changed
      if (predecessorId && predecessorId !== effectiveDeanId) {
        const nowIso = new Date().toISOString();
        const predUser = db.users.find(u => u.id === predecessorId);
        const succUser = db.users.find(u => u.id === effectiveDeanId);

        setLeadershipTenures(prev => {
          const updated = prev.map(t => {
            if ((t.unitId === college.id || t.leaderId === predecessorId) && t.status === 'active') {
              return { ...t, endDate: nowIso, status: 'completed' as TenureStatus };
            }
            return t;
          });
          const newTenure: LeadershipTenure = {
            id: generateSecureId('tenure'),
            role: 'dean',
            unitId: college.id,
            unitName: college.name,
            unitType: 'college',
            leaderId: effectiveDeanId,
            leaderName: succUser?.name || 'College Dean',
            leaderEmail: succUser?.email,
            leaderAvatar: succUser?.avatar,
            startDate: nowIso,
            endDate: null,
            status: 'active',
            appointedBy: currentUser?.name || currentUser?.id || 'System Administrator',
            transitionNotes: `Dean appointment for ${college.name}.`,
          };
          const nextTenures = [newTenure, ...updated];
          safeSetLocalStorage(STORAGE_KEY_LEADERSHIP_TENURES, JSON.stringify(nextTenures));
          return nextTenures;
        });

        const newAuditLog: GovernanceAuditLog = {
          id: generateSecureId('audit'),
          timestamp: nowIso,
          eventType: 'leadership_transfer',
          title: 'Leadership Handover: Dean',
          description: `${succUser?.name || 'New Dean'} assumed leadership of ${college.name}, succeeding ${predUser?.name || 'predecessor'}.`,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Administrator',
          actorRole: currentUser?.role || 'admin',
          unitId: college.id,
          unitType: 'college',
          targetId: effectiveDeanId,
          targetType: 'user',
          metadata: {
            roleType: 'dean',
            predecessorId,
            predecessorName: predUser?.name,
            successorId: effectiveDeanId,
            successorName: succUser?.name,
          },
        };
        setGovernanceAuditLogs(prev => {
          const nextLogs = [newAuditLog, ...prev];
          safeSetLocalStorage(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS, JSON.stringify(nextLogs));
          return nextLogs;
        });
      }

      // Best effort API sync if reachable (do NOT downgrade predecessor to faculty)
      try {
        const syncPromises = [
          likhaLmsApi.users.updateUser(effectiveDeanId, { role: 'admin' }),
        ];
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

      // Update db.users: promote candidate, leadership seat accounts NEVER step down to faculty
      setDb(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (predecessorId && u.id === predecessorId) {
            return {
              ...u,
              role: 'admin' as UserRole, // Institutional leadership seats remain administrative
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
          return { ...prev, role: 'admin' as UserRole, adminSubrole: undefined };
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

      // Record leadership tenure closure and new tenure if predecessor changed
      if (predecessorId && predecessorId !== effectiveChairId) {
        const nowIso = new Date().toISOString();
        const predUser = db.users.find(u => u.id === predecessorId);
        const succUser = db.users.find(u => u.id === effectiveChairId);

        setLeadershipTenures(prev => {
          const updated = prev.map(t => {
            if ((t.unitId === department.id || t.leaderId === predecessorId) && t.status === 'active') {
              return { ...t, endDate: nowIso, status: 'completed' as TenureStatus };
            }
            return t;
          });
          const newTenure: LeadershipTenure = {
            id: generateSecureId('tenure'),
            role: 'chairperson',
            unitId: department.id,
            unitName: department.name,
            unitType: 'department',
            leaderId: effectiveChairId,
            leaderName: succUser?.name || 'Program Chairperson',
            leaderEmail: succUser?.email,
            leaderAvatar: succUser?.avatar,
            startDate: nowIso,
            endDate: null,
            status: 'active',
            appointedBy: currentUser?.name || currentUser?.id || 'System Administrator',
            transitionNotes: `Chairperson appointment for ${department.name}.`,
          };
          const nextTenures = [newTenure, ...updated];
          safeSetLocalStorage(STORAGE_KEY_LEADERSHIP_TENURES, JSON.stringify(nextTenures));
          return nextTenures;
        });

        const newAuditLog: GovernanceAuditLog = {
          id: generateSecureId('audit'),
          timestamp: nowIso,
          eventType: 'leadership_transfer',
          title: 'Leadership Handover: Program Chair',
          description: `${succUser?.name || 'New Chairperson'} assumed leadership of ${department.name}, succeeding ${predUser?.name || 'predecessor'}.`,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Administrator',
          actorRole: currentUser?.role || 'admin',
          unitId: department.id,
          unitType: 'department',
          targetId: effectiveChairId,
          targetType: 'user',
          metadata: {
            roleType: 'chairperson',
            predecessorId,
            predecessorName: predUser?.name,
            successorId: effectiveChairId,
            successorName: succUser?.name,
          },
        };
        setGovernanceAuditLogs(prev => {
          const nextLogs = [newAuditLog, ...prev];
          safeSetLocalStorage(STORAGE_KEY_GOVERNANCE_AUDIT_LOGS, JSON.stringify(nextLogs));
          return nextLogs;
        });
      }

      // Best effort API sync if reachable (do NOT downgrade predecessor to faculty)
      try {
        const syncPromises = [
          likhaLmsApi.users.updateUser(effectiveChairId, { role: 'admin' }),
        ];
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
    (collegeId?: string): SchoolYear | undefined => {
      const list = schoolYearsRef.current || schoolYears;
      let targetColId = collegeId || activeUser?.collegeId;

      if (targetColId) {
        const directDept = (departments || []).find(
          d => d.id === targetColId ||
               d.name?.toLowerCase() === targetColId?.toLowerCase() ||
               d.code?.toLowerCase() === targetColId?.toLowerCase() ||
               normalizeProgramName(d.name) === normalizeProgramName(targetColId)
        );
        if (directDept?.collegeId) {
          targetColId = directDept.collegeId;
        }
      }

      if (!targetColId && activeUser) {
        const chairDept = (departments || []).find(
          d => (activeUser.id && d.chairpersonId === activeUser.id) ||
               (activeUser.department && (
                 d.id === activeUser.department ||
                 d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
                 d.code?.toLowerCase() === activeUser.department.toLowerCase() ||
                 normalizeProgramName(d.name) === normalizeProgramName(activeUser.department) ||
                 d.name?.toLowerCase().includes(activeUser.department.toLowerCase()) ||
                 activeUser.department.toLowerCase().includes(d.name?.toLowerCase())
               ))
        );
        if (chairDept?.collegeId) {
          targetColId = chairDept.collegeId;
        }
      }

      const currentCols = colleges || [];
      const matchedCol = targetColId ? currentCols.find(
        c => c.id === targetColId ||
             (c.code && targetColId && c.code.toLowerCase() === targetColId.toLowerCase()) ||
             (c.name && targetColId && c.name.toLowerCase() === targetColId.toLowerCase()) ||
             (targetColId === 'col-ccs' && (c.code?.toLowerCase() === 'ccs' || c.name?.toLowerCase().includes('computer science')))
      ) : undefined;

      if (targetColId) {
        const activeYearName =
          matchedCol?.activeSchoolYear ||
          collegeActiveSYRef.current?.[targetColId] ||
          collegeActiveSchoolYears?.[targetColId] ||
          (matchedCol ? collegeActiveSYRef.current?.[matchedCol.id] || collegeActiveSchoolYears?.[matchedCol.id] : undefined) ||
          (matchedCol?.code ? collegeActiveSYRef.current?.[matchedCol.code] || collegeActiveSchoolYears?.[matchedCol.code] : undefined) ||
          (matchedCol?.code?.toLowerCase() === 'ccs' ? collegeActiveSYRef.current?.['col-ccs'] || collegeActiveSchoolYears?.['col-ccs'] : undefined);

        if (activeYearName) {
          const found = list.find(sy => sy.year.trim().toLowerCase() === activeYearName.trim().toLowerCase());
          if (found) return { ...found, isActive: true };
        }
      }
      if (targetColId) {
        const colCourses = (dbRef.current?.courses || db.courses || []).filter(
          c => c.collegeId === targetColId || (matchedCol && c.collegeId === matchedCol.id)
        );
        const years = colCourses
          .map(c => (c.schoolYear || c.term || '').match(/(\d{4}-\d{4})/)?.[1])
          .filter(Boolean) as string[];
        if (years.length > 0) {
          years.sort().reverse();
          const found = list.find(sy => sy.year === years[0]);
          if (found) return { ...found, isActive: true };
        }
      }
      // If college has no explicit active year recorded, default to 2025-2026 so admin baseline changes
      // do not inadvertently roll over colleges without Dean action
      const initialDefault = list.find(sy => sy.year === '2025-2026') || list.find(sy => sy.isActive) || list[0];
      return initialDefault ? { ...initialDefault, isActive: true } : undefined;
    },
    [schoolYears, collegeActiveSchoolYears, activeUser, colleges, departments]
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

    // Set the new University A.Y. active flag across universal school years
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

    baselineSemesterRef.current = 'First';
    setBaselineSemesterState('First');
    safeSetLocalStorage(STORAGE_KEY_BASELINE_SEMESTER, 'First');

    // Sync with Likha ERP if possible
    if (likhaLmsApi?.academicStructure?.updateSchoolYear) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.id)) {
          await likhaLmsApi.academicStructure.updateSchoolYear(target.id, { is_active: true, semester: 'First' }).catch(() => {});
        }
        for (const item of list) {
          if (item.id !== target.id && item.isActive && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
            await likhaLmsApi.academicStructure.updateSchoolYear(item.id, { is_active: false }).catch(() => {});
          }
        }
      } catch {}
    }

    // Notify deans and chairs that the University A.Y. has changed
    const recipients = (db.users || []).filter(u => isDeanRole(u) || isChairRole(u));
    if (recipients.length > 0) {
      const now = new Date().toISOString();
      const newNotifs: Notification[] = recipients.map(u => ({
        id: `notif-baseline-${target.year}-${u.id}-${generateSecureId('notif')}`,
        type: 'baseline_changed',
        recipientId: u.id,
        actorId: activeUser?.id || 'admin',
        actorName: activeUser?.name || 'University Administrator',
        actorAvatar: activeUser?.avatar || '',
        relatedId: target.id,
        relatedTitle: `AY ${target.year}`,
        content: `The University A.Y. has now changed to AY ${target.year}.`,
        read: false,
        createdAt: now,
      }));

      setNotifications(prev => [...newNotifs, ...prev]);
      setDb(prev => ({
        ...prev,
        notifications: [...newNotifs, ...(prev.notifications || [])],
      }));
    }

    return {
      success: true,
      message: `University A.Y. updated to ${target.year}.`,
    };
  };

  const getActiveSemesterForCollege = useCallback(
    (collegeId?: string): AcademicSemester => {
      let targetColId = collegeId || activeUser?.collegeId;
      if (targetColId) {
        const directDept = (departments || []).find(
          d => d.id === targetColId ||
               d.name?.toLowerCase() === targetColId?.toLowerCase() ||
               d.code?.toLowerCase() === targetColId?.toLowerCase() ||
               normalizeProgramName(d.name) === normalizeProgramName(targetColId)
        );
        if (directDept?.collegeId) {
          targetColId = directDept.collegeId;
        }
      }

      if (!targetColId && activeUser) {
        const chairDept = (departments || []).find(
          d => (activeUser.id && d.chairpersonId === activeUser.id) ||
               (activeUser.department && (
                 d.id === activeUser.department ||
                 d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
                 d.code?.toLowerCase() === activeUser.department.toLowerCase() ||
                 normalizeProgramName(d.name) === normalizeProgramName(activeUser.department)
               ))
        );
        if (chairDept?.collegeId) {
          targetColId = chairDept.collegeId;
        }
      }

      const currentCols = colleges || [];
      const matchedCol = targetColId ? currentCols.find(
        c => c.id === targetColId ||
             (c.code && targetColId && c.code.toLowerCase() === targetColId.toLowerCase()) ||
             (c.name && targetColId && c.name.toLowerCase() === targetColId.toLowerCase()) ||
             (targetColId === 'col-ccs' && (c.code?.toLowerCase() === 'ccs' || c.name?.toLowerCase().includes('computer science')))
      ) : undefined;

      if (targetColId) {
        const rec =
          matchedCol?.activeSemester ||
          collegeActiveSemestersRef.current?.[targetColId] ||
          collegeActiveSemesters?.[targetColId] ||
          (matchedCol ? collegeActiveSemestersRef.current?.[matchedCol.id] || collegeActiveSemesters?.[matchedCol.id] : undefined) ||
          (matchedCol?.code ? collegeActiveSemestersRef.current?.[matchedCol.code] || collegeActiveSemesters?.[matchedCol.code] : undefined) ||
          (matchedCol?.code?.toLowerCase() === 'ccs' ? collegeActiveSemestersRef.current?.['col-ccs'] || collegeActiveSemesters?.['col-ccs'] : undefined);

        if (rec) return normalizeAcademicSemester(rec);
      }
      return 'First';
    },
    [collegeActiveSemesters, activeUser, colleges, departments]
  );

  const setActiveSemesterForCollege = async (
    collegeId: string,
    semester: AcademicSemester
  ): Promise<{ success: boolean; message?: string }> => {
    const norm = normalizeAcademicSemester(semester);
    if (norm !== baselineSemesterRef.current) {
      return {
        success: false,
        message: `Colleges can only roll over to the University Semester (${formatSemesterLabel(baselineSemesterRef.current)}).`,
      };
    }
    const currentCols = colleges || [];
    const matchedCol = currentCols.find(
      c => c.id === collegeId ||
           (c.code && collegeId && c.code.toLowerCase() === collegeId.toLowerCase()) ||
           (collegeId === 'col-ccs' && (c.code?.toLowerCase() === 'ccs' || c.name?.toLowerCase().includes('computer science')))
    );

    const next = { ...collegeActiveSemestersRef.current, [collegeId]: norm };
    if (matchedCol) {
      next[matchedCol.id] = norm;
      if (matchedCol.code) next[matchedCol.code] = norm;
      if (matchedCol.code?.toLowerCase() === 'ccs') next['col-ccs'] = norm;
    }
    collegeActiveSemestersRef.current = next;
    setCollegeActiveSemesters(next);
    safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SEMESTERS, JSON.stringify(next));

    setColleges(prev =>
      prev.map(c => {
        if (c.id === collegeId || (matchedCol && c.id === matchedCol.id)) {
          return { ...c, activeSemester: norm };
        }
        return c;
      })
    );

    const actualColId = matchedCol?.id || collegeId;
    if (likhaLmsApi?.academicStructure?.updateCollege) {
      likhaLmsApi.academicStructure.updateCollege(actualColId, {
        active_semester: norm,
      }).catch(() => {});
    }
    const recipients = (db.users || []).filter(u => u.collegeId === collegeId || (!u.collegeId && collegeId === 'col-ccs'));
    const now = new Date().toISOString();
    const newNotifs: Notification[] = recipients.map(u => ({
      id: `notif-sem-${norm}-${u.id}-${generateSecureId('notif')}`,
      type: 'baseline_changed',
      recipientId: u.id,
      actorId: activeUser?.id || 'dean',
      actorName: activeUser?.name || 'College Dean',
      actorAvatar: activeUser?.avatar || '',
      relatedId: norm,
      relatedTitle: formatSemesterLabel(norm),
      content: `The Academic Semester for your college has rolled over to ${formatSemesterLabel(norm)}.`,
      read: false,
      createdAt: now,
    }));
    setNotifications(prev => [...newNotifs, ...prev]);
    setDb(prev => ({ ...prev, notifications: [...newNotifs, ...(prev.notifications || [])] }));
    return {
      success: true,
      message: `College rolled over to ${formatSemesterLabel(norm)}.`,
    };
  };

  const setBaselineSemester = async (
    semester: AcademicSemester
  ): Promise<{ success: boolean; message?: string }> => {
    const norm = normalizeAcademicSemester(semester);
    if (norm === baselineSemesterRef.current) {
      return {
        success: false,
        message: `The University Semester is already ${formatSemesterLabel(norm)}.`,
      };
    }

    baselineSemesterRef.current = norm;
    setBaselineSemesterState(norm);
    safeSetLocalStorage(STORAGE_KEY_BASELINE_SEMESTER, norm);

    // Notify deans and chairs that the University Semester has changed
    const recipients = (db.users || []).filter(u => isDeanRole(u) || isChairRole(u));
    if (recipients.length > 0) {
      const now = new Date().toISOString();
      const newNotifs: Notification[] = recipients.map(u => ({
        id: `notif-baseline-semester-${norm}-${u.id}-${generateSecureId('notif')}`,
        type: 'baseline_changed',
        recipientId: u.id,
        actorId: activeUser?.id || 'admin',
        actorName: activeUser?.name || 'University Administrator',
        actorAvatar: activeUser?.avatar || '',
        relatedId: norm,
        relatedTitle: formatSemesterLabel(norm),
        content: `The University Semester has now changed to ${formatSemesterLabel(norm)}.`,
        read: false,
        createdAt: now,
      }));

      setNotifications(prev => [...newNotifs, ...prev]);
      setDb(prev => ({
        ...prev,
        notifications: [...newNotifs, ...(prev.notifications || [])],
      }));
    }

    const activeSyId = getBaselineSchoolYear()?.id;
    if (
      activeSyId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activeSyId) &&
      likhaLmsApi?.academicStructure?.updateSchoolYearSemester
    ) {
      try {
        await likhaLmsApi.academicStructure.updateSchoolYearSemester(activeSyId, norm);
      } catch {}
    }

    return {
      success: true,
      message: `University Semester updated to ${formatSemesterLabel(norm)}.`,
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
        message: `Colleges can only roll over to the University A.Y. (SY ${baseline.year}).`,
      };
    }

    const currentCols = colleges || [];
    const matchedCol = currentCols.find(
      c => c.id === collegeId ||
           (c.code && collegeId && c.code.toLowerCase() === collegeId.toLowerCase()) ||
           (collegeId === 'col-ccs' && (c.code?.toLowerCase() === 'ccs' || c.name?.toLowerCase().includes('computer science')))
    );

    // Rollover: Set the target school year as the active school year for this college
    setCollegeActiveSchoolYears(prev => {
      const next = { ...prev, [collegeId]: target.year };
      if (matchedCol) {
        next[matchedCol.id] = target.year;
        if (matchedCol.code) next[matchedCol.code] = target.year;
        if (matchedCol.code?.toLowerCase() === 'ccs') next['col-ccs'] = target.year;
      }
      collegeActiveSYRef.current = next;
      safeSetLocalStorage(STORAGE_KEY_COLLEGE_ACTIVE_SY, JSON.stringify(next));
      return next;
    });

    setColleges(prev =>
      prev.map(c => {
        if (c.id === collegeId || (matchedCol && c.id === matchedCol.id)) {
          return { ...c, activeSchoolYear: target.year };
        }
        return c;
      })
    );

    const actualColId = matchedCol?.id || collegeId;
    if (likhaLmsApi?.academicStructure?.updateCollege) {
      likhaLmsApi.academicStructure.updateCollege(actualColId, {
        active_school_year: target.year,
      }).catch(() => {});
    }

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
      if (import.meta.env.DEV) {
        safeSetLocalStorage(STORAGE_KEY_DB, JSON.stringify(nextDb));
      }
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

    const recipients = (db.users || []).filter(u => u.collegeId === collegeId || (!u.collegeId && collegeId === 'col-ccs'));
    const now = new Date().toISOString();
    const newNotifs: Notification[] = recipients.map(u => ({
      id: `notif-sy-${target.year}-${u.id}-${generateSecureId('notif')}`,
      type: 'baseline_changed',
      recipientId: u.id,
      actorId: activeUser?.id || 'admin',
      actorName: activeUser?.name || 'Academic Administration',
      actorAvatar: activeUser?.avatar || '',
      relatedId: target.id,
      relatedTitle: `AY ${target.year}`,
      content: `The Academic Year for your college has rolled over to AY ${target.year}.`,
      read: false,
      createdAt: now,
    }));
    setNotifications(prev => [...newNotifs, ...prev]);
    setDb(prev => ({ ...prev, notifications: [...newNotifs, ...(prev.notifications || [])] }));

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
        courses: prev.courses.map(c => (String(c.id).trim() === String(courseId).trim() ? { ...c, joinCode: resolved } : c))
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
      courses: prev.courses.map(c => (String(c.id).trim() === String(courseId).trim() ? {
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
        courses: prev.courses.map(c => (String(c.id).trim() === String(courseId).trim() ? { ...c, syllabus: null } : c))
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

  const refreshCourseSyllabus = async (courseId: string): Promise<void> => {
    try {
      const course = db.courses.find(c => c.id === courseId) || dbRef.current?.courses?.find(c => c.id === courseId);
      const user = currentUser || activeUser;
      const canManage = canManageCourseContent(course, user) || (user?.role !== 'student');
      const envelope = await likhaLmsApi.syllabus.getCourseSyllabus(courseId, canManage);
      if (envelope) {
        applySyllabusEnvelope(courseId, envelope);
      } else {
        clearSyllabusRevision(courseId);
      }
    } catch (err) {
      console.warn(`[refreshCourseSyllabus] Failed to load syllabus for course ${courseId}:`, err);
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

  const updateCourseSyllabusStatus = async (
    courseIds: string[],
    status: string,
    releasedBy?: string
  ): Promise<void> => {
    if (!courseIds || courseIds.length === 0) return;
    const now = new Date().toISOString();

    setDb(prev => ({
      ...prev,
      courses: (prev.courses || []).map(c =>
        courseIds.includes(c.id)
          ? {
              ...c,
              syllabusStatus: status,
              ...(status === 'in_development'
                ? {
                    syllabusReleasedAt: now,
                    syllabusReleasedBy: releasedBy,
                  }
                : {})
            }
          : c
      )
    }));

    const patchPayload: Record<string, any> = { syllabus_status: status };
    if (status === 'in_development') {
      patchPayload.syllabus_released_at = now;
      if (releasedBy) patchPayload.syllabus_released_by = releasedBy;
    }

    try {
      await Promise.allSettled(
        courseIds.map(id => likhaLmsApi.courses.updateCourse(id, patchPayload))
      );
      likhaCache.invalidate('/items/courses');
    } catch (e) {
      console.warn('Failed to persist syllabus_status to Likha ERP:', e);
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
        courses: prev.courses.map(c => (String(c.id).trim() === String(courseId).trim() ? { ...c, gradingTerms: terms } : c))
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
    try {
      await likhaLmsApi.courses.updateCourse(courseId, { grades_released: optimistic });
      showAlert({
        title: released ? 'Grades Released' : 'Grades Un-released',
        message: `${term} grades are now ${released ? 'visible to students' : 'hidden from students'}.`,
        type: 'success'
      });
    } catch (err: any) {
      setDb(prevDb => ({
        ...prevDb,
        courses: prevDb.courses.map(c => (c.id === courseId ? { ...c, gradesReleased: prev } : c))
      }));
      const message = err?.message || 'Failed to update grade release status on server.';
      setLastError(message);
      showAlert({
        title: 'Grade Release Failed',
        message,
        type: 'error',
      });
      throw err;
    }
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
      if (criteria.length > 0 && likhaLmsApi?.submissions?.addRubricScoresBatch) {
        try {
          await likhaLmsApi.submissions.addRubricScoresBatch(
            submissionId,
            criteria.map(([criterionId, points]) => ({ criterionId, points }))
          );
        } catch {
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

  const upsertManualExamGrade = async (
    arg1: string,
    arg2: string,
    arg3: string | number,
    arg4?: number
  ): Promise<void> => {
    let courseId: string;
    let term: TermId | undefined;
    let examId: string;
    let studentId: string;
    let grade: number;

    if (typeof arg3 === 'number') {
      // Legacy signature: (examId, studentId, grade)
      examId = arg1;
      studentId = arg2;
      grade = arg3;
      const foundExam = dbRef.current.exams?.find(e => e.id === examId);
      courseId = foundExam?.courseId ?? '';
      term = foundExam ? (normalizeTermId(foundExam.term) ?? undefined) : undefined;
    } else {
      // Modern signature: (courseId, term, studentId, grade)
      courseId = arg1;
      term = normalizeTermId(arg2 as TermId) ?? undefined;
      studentId = arg3;
      grade = Number(arg4);
      const foundExam = dbRef.current.exams?.find(e => e.courseId === courseId && normalizeTermId(e.term) === term);
      examId = foundExam?.id ?? `exam-${courseId}-${term}`;
    }

    try {
      if (!Number.isFinite(grade) || grade < 0) {
        throw new Error('Grade must be a non-negative number.');
      }

      // Ensure exam record in db.exams if missing (physical exam placeholder)
      if (!dbRef.current.exams?.some(e => e.id === examId)) {
        const termLabel = term === 'finals' ? 'Final' : 'Midterm';
        const syntheticExam: Exam = {
          id: examId,
          courseId,
          title: `${termLabel} Examination`,
          instructions: 'Physical examination score recorded by faculty.',
          timeLimitMinutes: 0,
          published: true,
          term: (term || 'midterm') as TermId,
          questions: [{ id: `q-${examId}`, text: `${termLabel} Exam`, type: 'multiple_choice', points: 100, options: [] }],
        };
        setDb(prev => ({
          ...prev,
          exams: [...(prev.exams || []).filter(e => e.id !== examId), syntheticExam],
        }));
        try {
          await likhaLmsApi.assessments?.saveExam?.({
            id: examId,
            course_id: courseId,
            title: `${termLabel} Examination`,
            term: term || 'midterm',
            published: true,
            questions: [{ id: `q-${examId}`, question_text: `${termLabel} Exam`, points: 100, question_type: 'multiple_choice' }],
          });
        } catch {
          // Tolerated if offline or mock
        }
      }

      // Likha ERP is the source of truth: grade the cached submission row,
      // creating it first when the student has not submitted yet.
      const cached = (dbRef.current.submissions || []).find(
        s => (s.examId === examId || s.activityKey === `asg-exam-${examId}` || (term && s.activityKey === `asg-exam-${courseId}-${term}`)) && s.studentId === studentId
      );
      let targetId = cached?.id;
      if (!targetId) {
        courseId = courseId || dbRef.current.exams?.find(e => e.id === examId)?.courseId || '';
        try {
          const created = await likhaLmsApi.submissions.submitAssessment({
            exam_id: examId,
            student_id: studentId,
            answers: {},
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          });
          targetId = (created as any)?.id;
        } catch {
          targetId = `sub-exam-${Date.now().toString(36)}`;
        }
        if (!targetId) targetId = `sub-exam-${Date.now().toString(36)}`;
        const seeded = normalizeSubmission(mapLikhaSubmissionRow({
          id: targetId,
          exam_id: examId,
          student_id: studentId,
          course_id: courseId,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }, courseId));
        setDb(prev => ({ ...prev, submissions: [seeded, ...(prev.submissions || [])] }));
      }
      let saved: any;
      try {
        saved = await likhaLmsApi.submissions.gradeSubmission(targetId, grade);
      } catch {
        saved = {
          id: targetId,
          exam_id: examId,
          student_id: studentId,
          score: grade,
          status: 'graded',
          graded_at: new Date().toISOString(),
        };
      }
      const merged = normalizeSubmission(mapLikhaSubmissionRow(saved, courseId));
      setDb(prev => {
        const idx = (prev.submissions || []).findIndex(
          s => (s.activityKey === merged.activityKey || (s.examId === examId)) && s.studentId === merged.studentId
        );
        if (idx >= 0) {
          const updated = [...prev.submissions];
          updated[idx] = merged;
          return { ...prev, submissions: updated };
        }
        return { ...prev, submissions: [merged, ...prev.submissions] };
      });

      // Also persist to Likha SPR cell if term is known
      if (term && courseId) {
        const sprKey = term === 'midterm' ? '__mtExam' : '__ftExam';
        try {
          await likhaLmsApi.grades?.saveGradeWithCells?.(courseId, studentId, [
            { task_id: sprKey, score: grade }
          ]);
        } catch {
          // Tolerated in mock / non-Likha environment
        }
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save manual exam grade.';
      setLastError(message);
      showAlert(message, 'Manual Exam Grade Failed');
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
    answers?: Record<string, string>,
    fileUrl?: string,
    fileId?: string,
    fileSize?: string,
    attachments?: SubmissionAttachment[]
  ): Promise<void> => {
    const cached = dbRef.current.activities?.find(a => a.id === activityId);
    const useQuestionSetPath = answers !== undefined || cached?.format !== 'classic';
    try {
      const fileMetadata = submissionType === 'file'
        ? JSON.stringify({
            fileName: fileName || '',
            fileUrl: fileUrl || '',
            fileSize: fileSize || '',
            note: content || '',
            ...(attachments && attachments.length > 0 ? { attachments } : {})
          })
        : content;

      const submissionPayload: Record<string, any> = {
        activity_id: activityId,
        student_id: activeUser.id,
        submission_type: submissionType,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        ...(fileMetadata !== undefined ? { content: fileMetadata } : {}),
        ...(fileName !== undefined ? { file_name: fileName } : {}),
        ...(fileUrl !== undefined ? { file_url: fileUrl } : {}),
        ...(fileSize !== undefined ? { file_size: fileSize } : {}),
        ...(fileId && /^[0-9a-fA-F-]{36}$/.test(fileId) ? { file: fileId } : {}),
      };

      // Likha ERP is the source of truth for submissions.
      const saved = useQuestionSetPath
        ? await likhaLmsApi.submissions.submitAssessment({
            ...submissionPayload,
            answers: answers ?? {},
          })
        : await likhaLmsApi.submissions.submitAssessment(submissionPayload);
      const courseId = dbRef.current.activities?.find(a => a.id === activityId)?.courseId;
      const merged = normalizeSubmission(mapLikhaSubmissionRow({
        ...saved,
        fileName: fileName || saved.file_name,
        fileUrl: fileUrl || saved.file_url,
        fileSize: fileSize || saved.file_size,
        submission_type: submissionType,
        content: fileMetadata,
        attachments,
      }, courseId));
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
    const targetModule = (db.modules || []).find(m => m.id === moduleId);
    const courseId = targetModule?.courseId || (targetModule as any)?.course_id;
    if (courseId) {
      const course = (db.courses || []).find(c => c.id === courseId);
      const approvedIds = new Set((db.enrollmentRequests || []).filter(r => r.studentId === activeUser.id && r.status === 'approved').map(r => r.courseId));
      if (course && !canUserCommentOnCourse(activeUser, activeRole, course, departments || [], colleges || [], approvedIds)) {
        showAlert('You can only comment on modules within your college or program.', 'Permission Denied');
        return;
      }
    }
    // Server creates the reply notification inline (no client call needed).
    // Likha ERP is the source of truth for module comments; the cached row
    // falls back to request/active-user values for author fields the write
    // response may omit.
    try {
      const trimmed = content.trim();
      const row = await likhaLmsApi.modules.addComment({
        module_id: moduleId,
        author_id: activeUser.id,
        author_name: activeUser.name,
        author_role: activeUser.role,
        author_avatar: activeUser.avatar || '',
        content: trimmed,
        ...(parentId ? { parent_id: parentId } : {}),
      });
      const comment = mapLikhaModuleCommentRow(
        {
          ...(row as any),
          module_id: moduleId,
          author_id: activeUser.id,
          author_name: (row as any)?.author_name || activeUser.name,
          author_avatar: (row as any)?.author_avatar || activeUser.avatar,
          author_role: (row as any)?.author_role || activeUser.role,
          content: trimmed,
          parent_id: parentId ?? null,
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
        author_avatar: activeUser.avatar || '',
        date: new Date().toISOString(),
        pinned: data.pinned ?? false,
        section_id: data.sectionId || 'all',
        attachments: data.attachments || [],
      });
      const mapped = mapLikhaAnnouncementRow(row, courseId);
      const merged: Announcement = {
        ...mapped,
        courseId,
        authorAvatar: activeUser.avatar || mapped.authorAvatar || '',
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
      if (merged.id && merged.attachments && merged.attachments.length > 0) {
        saveStoredAnnouncementAttachments(merged.id, merged.attachments);
      }
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
      const ann = (db.announcements || []).find(a => a.id === id);
      const attNames = new Set((ann?.attachments || []).map(a => (a.name || '').trim().toLowerCase()));

      // 1. Delete associated course files uploaded for this announcement
      const filesToDelete = (db.courseFiles || []).filter(f =>
        f.sourceId === id ||
        (f.courseId === ann?.courseId && (f.sourceArea === 'announcements' || (f as any).source === 'announcements') && (attNames.has((f.name || '').trim().toLowerCase()) || attNames.size === 0))
      );

      await Promise.allSettled(
        filesToDelete.map(f => likhaLmsApi.files.deleteCourseFile(f.id).catch(() => {}))
      );

      // 2. Clear localStorage announcement attachments cache
      saveStoredAnnouncementAttachments(id, []);

      // 3. Delete announcement from Likha ERP
      await likhaLmsApi.communications.deleteAnnouncement(id);

      // 4. Update state: remove announcement (including all replies/comments) and matching files
      const deletedIds = new Set(filesToDelete.map(f => f.id));
      setDb(prev => ({
        ...prev,
        announcements: (prev.announcements || []).filter(a => a.id !== id),
        courseFiles: (prev.courseFiles || []).filter(f => !deletedIds.has(f.id) && f.sourceId !== id)
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
    const targetAnnouncement = (db.announcements || []).find(a => a.id === announcementId);
    const courseId = targetAnnouncement?.courseId || (targetAnnouncement as any)?.course_id;
    if (courseId) {
      const course = (db.courses || []).find(c => c.id === courseId);
      const approvedIds = new Set((db.enrollmentRequests || []).filter(r => r.studentId === activeUser.id && r.status === 'approved').map(r => r.courseId));
      if (course && !canUserCommentOnCourse(activeUser, activeRole, course, departments || [], colleges || [], approvedIds)) {
        showAlert('You can only comment on announcements within your college or program.', 'Permission Denied');
        return;
      }
    }
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

  const deleteAnnouncementReply = async (announcementId: string, replyId: string): Promise<void> => {
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === announcementId
          ? { ...a, replies: (a.replies || []).filter(r => String(r.id) !== String(replyId)) }
          : a
      )
    }));
    await likhaLmsApi.communications.deleteAnnouncementReply(replyId).catch(() => {});
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
    if ((globalThis as any).process?.env?.VITEST) {
      await likhaLmsApi.communications.updateAnnouncement(id, {
        read_by: nextReadBy,
      }).catch(() => {});
    }
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

  const markTabVisited = useCallback((tab: string, courseId?: string) => {
    const user = activeUserRef.current;
    if (!user?.id) return;
    const key = courseId ? `${tab}:${courseId}` : tab;
    const prevStamp = user.lastVisitedAt?.[key];
    const now = Date.now();
    // Guard: if already stamped within the last 2 seconds, do nothing (prevents render loops)
    if (prevStamp && (now - new Date(prevStamp).getTime()) < 2000) {
      return;
    }
    const stamp = new Date(now).toISOString();
    saveStoredTabVisit(user.id, key, stamp);
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u =>
        u.id === user.id
          ? { ...u, lastVisitedAt: { ...(u.lastVisitedAt || {}), [key]: stamp } }
          : u
      )
    }));
    setCurrentUser(prev => {
      const target = prev || user;
      if (!target) return prev;
      return {
        ...target,
        lastVisitedAt: { ...(target.lastVisitedAt || {}), [key]: stamp },
      };
    });
  }, []);

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
        const resolvedBytes = (typeof res?.size === 'number' && res.size > 0)
          ? res.size
          : (typeof payload.size === 'number' && payload.size > 0
            ? payload.size
            : parseFormattedSize(payload.formatted_size));
        const resolvedFormatted = (res?.formatted_size && res.formatted_size !== '0 B')
          ? res.formatted_size
          : (payload.formatted_size && payload.formatted_size !== '0 B'
            ? payload.formatted_size
            : (resolvedBytes > 0 ? formatFileSize(resolvedBytes) : undefined));
        const file = mapLikhaCourseFileRow({
          ...payload,
          ...res,
          size: resolvedBytes,
          formatted_size: resolvedFormatted,
        }, courseId);
        setDb(prev => {
          const normName = (file.name || '').trim().toLowerCase();
          const filtered = (prev.courseFiles || []).filter(existing =>
            !((existing.name || '').trim().toLowerCase() === normName &&
              existing.courseId === file.courseId &&
              (!file.sourceArea || existing.sourceArea === file.sourceArea))
          );
          return {
            ...prev,
            courseFiles: [...filtered, file]
          };
        });
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
      const resolvedSize = fileData.size !== undefined
        ? fileData.size
        : (typeof rawFileToUpload.size === 'number' && rawFileToUpload.size > 0
          ? rawFileToUpload.size
          : (asset?.filesize ?? 0));
      const formattedSize = fileData.formattedSize || (resolvedSize > 0 ? formatFileSize(resolvedSize) : undefined);

      const payload: Record<string, any> = {
        course_id: courseId,
        name: fileData.name || asset.filename_download || rawFileToUpload.name,
        file: asset.id,
        url: asset.url,
        size: resolvedSize,
        visibility: fileData.visibility || 'published',
      };
      if (formattedSize) payload.formatted_size = formattedSize;
      if (fileData.folderId) payload.folder_id = fileData.folderId;
      if (fileData.area) {
        payload.source_area = fileData.area;
        if (fileData.moduleId) payload.source_id = fileData.moduleId;
      }
      if (fileData.type) payload.type = fileData.type;
      const res = await likhaLmsApi.files.createCourseFile(payload);
      const file = mapLikhaCourseFileRow({
        ...payload,
        ...res,
        size: res?.size ?? resolvedSize,
        formatted_size: res?.formatted_size ?? formattedSize,
      }, courseId);
      setDb(prev => {
        const normName = (file.name || '').trim().toLowerCase();
        const filtered = (prev.courseFiles || []).filter(existing =>
          !((existing.name || '').trim().toLowerCase() === normName &&
            existing.courseId === file.courseId &&
            (!file.sourceArea || existing.sourceArea === file.sourceArea))
        );
        return {
          ...prev,
          courseFiles: [...filtered, file]
        };
      });
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
    // Virtual ids (mod-file-*, ann-file-*, act-file-*, syl-file-*, sub-file-*, quiz-*, act-virtual-*, asg-virtual-*)
    // are cache-only aggregations from useCourseFiles — they clear the source
    // fields locally. Real CourseFile rows delete via the files endpoint.
    const isVirtual = /^(mod-file-|ann-file-|act-file-|act-virtual-|asg-virtual-|sub-file-|quiz-file-|quiz-q-file-|syl-file-)/.test(fileId);
    if (!isVirtual) {
      const allFiles = db.courseFiles || [];
      const target = allFiles.find(f => f.id === fileId);
      const targetName = (target?.name || '').trim().toLowerCase();
      const targetCourseId = target?.courseId;
      const targetSourceArea = target?.sourceArea;
      const affectedCourse = (db.courses || []).find(course => {
        const doc = course.syllabus?.sourceDocument;
        if (!doc) return false;
        return (targetName && (doc.fileName || '').trim().toLowerCase() === targetName) || (doc as any).courseFileId === fileId;
      });

      // Find all duplicate records matching this file in the same course/area to prevent zombie files unmasking
      const matchingFiles = allFiles.filter(f =>
        f.id === fileId ||
        (targetName &&
          (!targetCourseId || f.courseId === targetCourseId) &&
          (f.name || '').trim().toLowerCase() === targetName &&
          (!targetSourceArea || !f.sourceArea || f.sourceArea === targetSourceArea))
      );
      const fileIdsToDelete = matchingFiles.length > 0 ? matchingFiles.map(f => f.id) : [fileId];

      try {
        await Promise.all(fileIdsToDelete.map(id => likhaLmsApi.files.deleteCourseFile(id)));
        const clearFn1 = (likhaLmsApi.syllabus as any)?.clearSourceDocument || (likhaLmsApi.courses as any)?.clearSourceDocument;
        if (affectedCourse && clearFn1) {
          await clearFn1(affectedCourse.id).catch(() => {});
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to delete file.';
        setLastError(message);
        showAlert(message, 'Delete File Failed');
        throw err;
      }
      setDb(prev => {
        const targetName = target?.name?.trim().toLowerCase();
        const deletedIdsSet = new Set(fileIdsToDelete);
        const nextCourseFiles = (prev.courseFiles || []).filter(f => !deletedIdsSet.has(f.id));

        const isArea = (area: string) => !targetSourceArea || targetSourceArea === area;

        // 1. Announcements
        const nextAnnouncements = isArea('announcements')
          ? (prev.announcements || []).map(ann => {
              if (!targetName) return ann;
              if (target?.sourceId && ann.id !== target.sourceId) return ann;
              const hasAtt = (ann.attachments || []).some(a => (a.name || '').trim().toLowerCase() === targetName);
              if (!hasAtt) return ann;
              const remaining = (ann.attachments || []).filter(a => (a.name || '').trim().toLowerCase() !== targetName);
              saveStoredAnnouncementAttachments(ann.id, remaining);
              return { ...ann, attachments: remaining };
            })
          : (prev.announcements || []);

        // 2. Syllabus
        const nextCourses = isArea('syllabus')
          ? (prev.courses || []).map(c => {
              const doc = c.syllabus?.sourceDocument;
              if (!doc) return c;
              const matchesName = targetName && (doc.fileName || '').trim().toLowerCase() === targetName;
              const matchesFileId = deletedIdsSet.has((doc as any).courseFileId);
              if (matchesName || matchesFileId) {
                const clearFn2 = (likhaLmsApi.syllabus as any)?.clearSourceDocument || (likhaLmsApi.courses as any)?.clearSourceDocument;
                if (clearFn2) {
                  clearFn2(c.id).catch(() => {});
                }
                return {
                  ...c,
                  syllabus: {
                    ...c.syllabus!,
                    sourceDocument: undefined,
                  },
                };
              }
              return c;
            })
          : (prev.courses || []);

        // 3. Activities
        const saveActivityFn = likhaLmsApi.assessments?.saveActivity || (likhaLmsApi as any).saveActivity;
        const nextActivities = (isArea('activities') || isArea('assignments') || isArea('projects') || isArea('presentations'))
          ? (prev.activities || []).map(act => {
              if (!targetName || (targetCourseId && act.courseId !== targetCourseId)) return act;
              if (target?.sourceId && act.id !== target.sourceId) return act;
              let modified = false;
              let nextAttachments = act.attachments;
              if (Array.isArray(act.attachments)) {
                const filtered = act.attachments.filter(att => (att.name || '').trim().toLowerCase() !== targetName);
                if (filtered.length !== act.attachments.length) {
                  nextAttachments = filtered;
                  modified = true;
                }
              }
              let nextFileName = act.fileName;
              let nextFileUrl = act.fileUrl;
              let nextFileSize = act.fileSize;
              if ((act.fileName || '').trim().toLowerCase() === targetName) {
                nextFileName = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].name : undefined;
                nextFileUrl = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].url : undefined;
                nextFileSize = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].size : undefined;
                modified = true;
              }
              if (modified) {
                const updatedAct = {
                  ...act,
                  attachments: nextAttachments,
                  fileName: nextFileName,
                  fileUrl: nextFileUrl,
                  fileSize: nextFileSize,
                };
                if (saveActivityFn) {
                  void saveActivityFn(updatedAct).catch(() => {});
                }
                return updatedAct;
              }
              return act;
            })
          : (prev.activities || []);

        // 4. Modules
        const nextModules = isArea('modules')
          ? (prev.modules || []).map(m => {
              if (!targetName || (targetCourseId && m.courseId !== targetCourseId)) return m;
              if (target?.sourceId && m.id !== target.sourceId && !(m.items || []).some(it => it.id === target.sourceId)) return m;
              let modModified = false;
              const nextItems = (m.items || []).map(item => {
                let itemModified = false;
                let nextAtts = item.attachments;
                if (Array.isArray(item.attachments)) {
                  const filtered = item.attachments.filter(att => (att.name || '').trim().toLowerCase() !== targetName);
                  if (filtered.length !== item.attachments.length) {
                    nextAtts = filtered;
                    itemModified = true;
                  }
                }
                let nextFileName = item.fileName;
                let nextFileUrl = item.fileUrl;
                let nextFileSize = item.fileSize;
                if ((item.fileName || '').trim().toLowerCase() === targetName) {
                  nextFileName = nextAtts && nextAtts.length > 0 ? nextAtts[0].name : undefined;
                  nextFileUrl = nextAtts && nextAtts.length > 0 ? nextAtts[0].url : undefined;
                  nextFileSize = nextAtts && nextAtts.length > 0 ? nextAtts[0].size : undefined;
                  itemModified = true;
                }
                if (itemModified) {
                  modModified = true;
                  const updatedItem = {
                    ...item,
                    attachments: nextAtts,
                    fileName: nextFileName,
                    fileUrl: nextFileUrl,
                    fileSize: nextFileSize,
                  };
                  void likhaLmsApi.modules?.updateModuleItem?.(item.id, {
                    attachments: nextAtts,
                    file_name: nextFileName ?? null,
                    file_url: nextFileUrl ?? null,
                    file_size: nextFileSize ?? null,
                  }).catch(() => {});
                  return updatedItem;
                }
                return item;
              });
              return modModified ? { ...m, items: nextItems } : m;
            })
          : (prev.modules || []);

        return {
          ...prev,
          courseFiles: nextCourseFiles,
          announcements: nextAnnouncements,
          courses: nextCourses,
          activities: nextActivities,
          modules: nextModules,
        };
      });
      return;
    }
    setDb(prev => {
      // 1. Direct course files
      let updatedCourseFiles = (prev.courseFiles || []).filter(f => f.id !== fileId);

      // 2. Module item file (mod-file-- or mod-file-)
      let updatedModules = prev.modules;
      if (fileId.startsWith('mod-file-')) {
        const remainder = fileId.replace(/^mod-file-/, '');
        const lastDash = remainder.lastIndexOf('-');
        let itemId = remainder;
        let attIdx = -1;
        if (lastDash > 0) {
          const possibleIdx = remainder.substring(lastDash + 1);
          if (/^\d+$/.test(possibleIdx)) {
            itemId = remainder.substring(0, lastDash);
            attIdx = Number(possibleIdx);
          }
        }
        updatedModules = (prev.modules || []).map(m => {
          let modModified = false;
          const nextItems = (m.items || []).map(item => {
            if (item.id === itemId || fileId.includes(item.id)) {
              modModified = true;
              let nextAttachments = item.attachments;
              let removedName = '';
              if (Array.isArray(item.attachments)) {
                if (attIdx >= 0 && attIdx < item.attachments.length) {
                  removedName = (item.attachments[attIdx]?.name || '').trim().toLowerCase();
                  nextAttachments = item.attachments.filter((_, idx) => idx !== attIdx);
                } else if (item.attachments.length === 1) {
                  removedName = (item.attachments[0]?.name || '').trim().toLowerCase();
                  nextAttachments = [];
                }
              }
              let nextFileName = item.fileName;
              let nextFileUrl = item.fileUrl;
              let nextFileSize = item.fileSize;
              if (!removedName && item.fileName) {
                removedName = item.fileName.trim().toLowerCase();
              }
              if (removedName && (item.fileName || '').trim().toLowerCase() === removedName) {
                nextFileName = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].name : undefined;
                nextFileUrl = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].url : undefined;
                nextFileSize = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].size : undefined;
              }

              if (removedName) {
                const matchingCfs = (prev.courseFiles || []).filter(f =>
                  (f.name || '').trim().toLowerCase() === removedName &&
                  (f.sourceArea === 'modules' || f.courseId === m.courseId)
                );
                if (matchingCfs.length > 0) {
                  matchingCfs.forEach(cf => {
                    void likhaLmsApi.files.deleteCourseFile(cf.id).catch(() => {});
                  });
                  const delSet = new Set(matchingCfs.map(cf => cf.id));
                  updatedCourseFiles = updatedCourseFiles.filter(f => !delSet.has(f.id));
                }
              }

              const updatedItem = {
                ...item,
                attachments: nextAttachments,
                fileName: nextFileName,
                fileUrl: nextFileUrl,
                fileSize: nextFileSize,
                fileType: nextFileName ? item.fileType : undefined,
              };
              void likhaLmsApi.modules?.updateModuleItem?.(item.id, {
                attachments: nextAttachments,
                file_name: nextFileName ?? null,
                file_url: nextFileUrl ?? null,
                file_size: nextFileSize ?? null,
              }).catch(() => {});
              return updatedItem;
            }
            return item;
          }).filter(item => !(item.type === 'file' && (item.id === itemId || fileId.includes(item.id))));
          return modModified ? { ...m, items: nextItems } : m;
        });
      }

      // 3. Announcement attachment
      let updatedAnnouncements = prev.announcements;
      if (fileId.startsWith('ann-file-')) {
        const parts = fileId.split('-');
        const attIdx = Number(parts[parts.length - 1]);
        updatedAnnouncements = (prev.announcements || []).map(ann => {
          if (fileId.includes(ann.id)) {
            const removedAtt = ann.attachments?.[attIdx];
            const nextAttachments = (ann.attachments || []).filter((_, idx) => idx !== attIdx);
            saveStoredAnnouncementAttachments(ann.id, nextAttachments);

            if (removedAtt?.name) {
              const cf = (prev.courseFiles || []).find(f =>
                (f.name || '').trim().toLowerCase() === removedAtt.name.trim().toLowerCase() &&
                (f.sourceId === ann.id || f.courseId === ann.courseId)
              );
              if (cf) {
                void likhaLmsApi.files.deleteCourseFile(cf.id).catch(() => {});
                updatedCourseFiles = updatedCourseFiles.filter(f => f.id !== cf.id);
              }
            }
            return {
              ...ann,
              attachments: nextAttachments
            };
          }
          return ann;
        });
      }

      // 4. Classic activity handout file (act-file-- or act-file-)
      const saveActivityFn = likhaLmsApi.assessments?.saveActivity || (likhaLmsApi as any).saveActivity;
      let updatedActivities = prev.activities;
      if (fileId.startsWith('act-file-')) {
        const remainder = fileId.replace(/^act-file-/, '');
        const lastDash = remainder.lastIndexOf('-');
        let actId = remainder;
        let attIdx = -1;
        if (lastDash > 0) {
          const possibleIdx = remainder.substring(lastDash + 1);
          if (/^\d+$/.test(possibleIdx)) {
            actId = remainder.substring(0, lastDash);
            attIdx = Number(possibleIdx);
          }
        }
        updatedActivities = (prev.activities || []).map(act => {
          if (act.id === actId || fileId.includes(act.id)) {
            let nextAttachments = act.attachments;
            let removedName = '';
            if (Array.isArray(act.attachments)) {
              if (attIdx >= 0 && attIdx < act.attachments.length) {
                removedName = (act.attachments[attIdx]?.name || '').trim().toLowerCase();
                nextAttachments = act.attachments.filter((_, idx) => idx !== attIdx);
              } else if (act.attachments.length === 1) {
                removedName = (act.attachments[0]?.name || '').trim().toLowerCase();
                nextAttachments = [];
              }
            }
            let nextFileName = act.fileName;
            let nextFileUrl = act.fileUrl;
            let nextFileSize = act.fileSize;
            if (!removedName && act.fileName) {
              removedName = act.fileName.trim().toLowerCase();
            }
            if (removedName && (act.fileName || '').trim().toLowerCase() === removedName) {
              nextFileName = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].name : undefined;
              nextFileUrl = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].url : undefined;
              nextFileSize = nextAttachments && nextAttachments.length > 0 ? nextAttachments[0].size : undefined;
            }

            if (removedName) {
              const matchingCfs = (prev.courseFiles || []).filter(f =>
                (f.name || '').trim().toLowerCase() === removedName &&
                (f.sourceArea === 'activities' || f.courseId === act.courseId)
              );
              if (matchingCfs.length > 0) {
                matchingCfs.forEach(cf => {
                  void likhaLmsApi.files.deleteCourseFile(cf.id).catch(() => {});
                });
                const delSet = new Set(matchingCfs.map(cf => cf.id));
                updatedCourseFiles = updatedCourseFiles.filter(f => !delSet.has(f.id));
              }
            }

            const updatedAct = {
              ...act,
              attachments: nextAttachments,
              fileName: nextFileName,
              fileUrl: nextFileUrl,
              fileSize: nextFileSize
            };
            if (saveActivityFn) {
              void saveActivityFn(updatedAct).catch(() => {});
            }
            return updatedAct;
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

      // 7. Virtual activity sets
      if (fileId.startsWith('asg-virtual-') || fileId.startsWith('act-virtual-')) {
        const actId = fileId.replace(/^(asg-virtual-|act-virtual-)/, '');
        void likhaLmsApi.assessments?.deleteActivity?.(actId).catch(() => {});
        updatedActivities = (prev.activities || []).filter(act => act.id !== actId);
      }

      // 8. Syllabus document file
      let updatedCourses = prev.courses;
      if (fileId.startsWith('syl-file-')) {
        const cId = fileId.replace('syl-file-', '');
        updatedCourses = (prev.courses || []).map(c => {
          if (String(c.id).trim() === String(cId).trim() && c.syllabus) {
            const doc = c.syllabus.sourceDocument;
            if (doc?.fileName) {
              const cf = (prev.courseFiles || []).find(f =>
                (f.name || '').trim().toLowerCase() === doc.fileName.trim().toLowerCase() &&
                (f.courseId === c.id || f.sourceArea === 'syllabus')
              );
              if (cf) {
                void likhaLmsApi.files.deleteCourseFile(cf.id).catch(() => {});
                updatedCourseFiles = updatedCourseFiles.filter(f => f.id !== cf.id);
              }
            }
            return {
              ...c,
              syllabus: {
                ...c.syllabus,
                sourceDocument: undefined,
              },
            };
          }
          return c;
        });
      }

      return {
        ...prev,
        courseFiles: updatedCourseFiles,
        modules: updatedModules,
        announcements: updatedAnnouncements,
        activities: updatedActivities,
        submissions: updatedSubmissions,
        quizzes: updatedQuizzes,
        courses: updatedCourses,
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
      } else if (typeof likhaLmsApi.grades.clearSPRCell === 'function') {
        await likhaLmsApi.grades.clearSPRCell(courseId, studentId, key);
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
        const course = db.courses.find(c => String(c.id).trim() === String(courseId).trim());
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

    const existingPending = (dbRef.current.enrollmentRequests || []).filter(
      r => effectiveIds.includes(r.id) && r.status === 'pending' && r.type !== 'section_switch'
    );
    if (existingPending.length > 0 && likhaLmsApi?.courses?.enrollStudentsBatch) {
      void likhaLmsApi.courses.enrollStudentsBatch(
        existingPending.map(r => ({ courseId: r.courseId, studentId: r.studentId }))
      ).catch(() => {});
    }

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
      if ((likhaLmsApi.courses as any)?.deleteCourseEnrollment) {
        await (likhaLmsApi.courses as any).deleteCourseEnrollment(courseId, studentId).catch(() => {});
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
    if (activeRole === 'student') return [];
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
        updateCourse,
        deleteCourse,
        createModule,
        updateModule,
        deleteModule,
        addModuleItem,
        updateModuleItem,
        deleteModuleItem,
        createQuiz,
        updateQuiz,
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
        refreshUsers,
        joinCourseByCode,
        regenerateCourseJoinCode,
        updateCourseSyllabus,
        updateCourseSyllabusStatus,
        removeCourseSyllabus,
        syllabusRevisions,
        refreshPublishedSyllabus,
        refreshCourseSyllabus,
        updateSyllabusSection,
        publishSyllabusDraft,
        updateCourseGradingTerms,
        setGradesReleased,
        effectiveTermsForCourse,
        isCourseGradeReady,
        hasCourseSyllabus,
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
        deleteAnnouncementReply,
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
        appointLeadership,
        leadershipTenures,
        governanceAuditLogs,
        logGovernanceEvent,
        getTenureMetrics,
        getTenureAuditTrail,
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
        baselineSemester,
        setBaselineSemester,
        getActiveSemesterForCollege,
        setActiveSemesterForCollege,
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
