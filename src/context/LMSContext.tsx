import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  User,
  UserRole,
  Course,
  Module,
  ModuleItem,
  ModuleComment,
  Assignment,
  Quiz,
  MockDatabase,
  CalendarEvent,
  Submission,
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
  EnrollmentRequest
} from '../types/lms';
import initialMockData from '../data/mockData.json';
import { AlertModal, type AlertModalOptions } from '../components/common/AlertModal';
import { canPickSection } from '../utils/sections';
import type { OfficialSyllabusData } from '../data/syllabusData';

interface LMSContextType {
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
  login: (emailOrId: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => void; // Keep for testing convenience if needed

  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  db: MockDatabase;
  
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
  createCourse: (course: Partial<Course>) => Course;
  createAssignment: (asg: Partial<Assignment>) => Assignment;
  deleteAssignment: (asgId: string) => void;
  createModule: (courseId: string, title: string) => Module;
  updateModule: (moduleId: string, updates: Partial<Module>) => void;
  deleteModule: (moduleId: string) => void;
  addModuleItem: (moduleId: string, item: Partial<ModuleItem>) => void;
  updateModuleItem: (currentModuleId: string, itemId: string, updates: Partial<ModuleItem>, targetModuleId?: string) => void;
  deleteModuleItem: (moduleId: string, itemId: string) => void;
  createQuiz: (quiz: Partial<Quiz>) => Quiz;
  recordQuizSubmission: (quizId: string, studentId: string, score: number, answers: Record<string, string>) => void;
  enrollPerson: (person: Partial<User>, courseId?: string) => void;
  enrollStudentsInCourse: (studentIds: string[], courseId: string) => void;
  createUser: (userData: Partial<User>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => { success: boolean; message?: string };
  joinCourseByCode: (joinCode: string) => { success: boolean; message: string; course?: Course };
  regenerateCourseJoinCode: (courseId: string) => string;
  updateSyllabus: (courseId: string, updates: Partial<Course>) => void;
  updateCourseSyllabus: (courseId: string, syllabus: OfficialSyllabusData) => void;
  removeCourseSyllabus: (courseId: string) => void;
  importCommonsTemplate: (templateId: string, targetCourseId: string) => { success: boolean; message: string };

  gradeSubmission: (
    submissionId: string,
    grade: number,
    rubricScores: Record<string, number>,
    commentText?: string
  ) => void;
  submitAssignment: (
    assignmentId: string,
    submissionType: 'file' | 'online_text',
    content?: string,
    fileName?: string
  ) => void;
  toggleModulePublish: (moduleId: string) => void;
  toggleItemCompletion: (moduleId: string, itemId: string) => void;
  addModuleComment: (moduleId: string, content: string) => void;
  editModuleComment: (moduleId: string, commentId: string, newContent: string) => void;
  deleteModuleComment: (moduleId: string, commentId: string) => void;
  toggleLikeModuleComment: (moduleId: string, commentId: string) => void;
  sendMessage: (recipientId: string, subject: string, body: string, courseId?: string, attachmentName?: string, attachmentSize?: string, isGroup?: boolean, groupId?: string) => void;
  createChatGroup: (name: string, memberIds: string[], courseId?: string) => ChatGroup;
  markThreadAsRead: (partnerId: string) => void;
  toggleMessageReaction: (messageId: string, reaction: string) => void;
  bookAdvisingSlot: (slotId: string) => void;
  createAdvisingSlot: (date: string, timeSlot: string, location: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;

  // Announcements CRUD
  createAnnouncement: (data: Partial<Announcement>) => Announcement;
  deleteAnnouncement: (id: string) => void;
  togglePinAnnouncement: (id: string) => void;
  toggleLikeAnnouncement: (id: string) => void;
  addAnnouncementReply: (announcementId: string, content: string) => void;
  markAnnouncementRead: (id: string) => void;

  // Notifications
  notifications: Notification[];
  createNotification: (notification: Partial<Notification>) => Notification;
  getUnreadNotificationCount: (userId: string, type?: string) => number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string, type?: string) => void;
  getNotifications: (userId: string, type?: string, limit?: number) => Notification[];

  // Discussions CRUD
  createDiscussion: (data: Partial<Discussion>) => Discussion;
  deleteDiscussion: (id: string) => void;
  togglePinDiscussion: (id: string) => void;
  toggleLockDiscussion: (id: string) => void;
  addDiscussionReply: (discussionId: string, content: string, parentId?: string, attachment?: { name: string; url?: string }) => void;
  toggleLikeDiscussionReply: (discussionId: string, replyId: string) => void;

  // Course Files & Folders CRUD
  createCourseFolder: (courseId: string, name: string, parentId?: string | null) => CourseFolder;
  uploadCourseFile: (fileData: Partial<CourseFile>) => CourseFile;
  deleteCourseFile: (fileId: string) => void;
  deleteCourseFolder: (folderId: string) => void;
  updateFileVisibility: (fileId: string, visibility: 'published' | 'unpublished' | 'restricted') => void;
  renameCourseFile: (fileId: string, newName: string) => void;

  // Course Grades CRUD (Midterm 40%, Final 60%)
  setCourseStudentGrade: (
    courseId: string,
    studentId: string,
    type: 'midterm' | 'final',
    score: number | null
  ) => void;

  // Sections CRUD
  createSection: (courseId: string, data: Partial<CourseSection>) => CourseSection;
  updateSection: (sectionId: string, updates: Partial<CourseSection>) => void;
  deleteSection: (sectionId: string) => void;
  getCourseSections: (courseId: string) => CourseSection[];
  getStudentSection: (courseId: string) => CourseSection | null;

  // Enrollment Requests
  createEnrollmentRequest: (courseId: string, type: 'self_join' | 'faculty_enroll') => EnrollmentRequest;
  approveEnrollmentRequests: (requestIds: string[]) => void;
  rejectEnrollmentRequests: (requestIds: string[]) => void;
  studentApproveInvitation: (requestId: string) => void;
  studentDeclineInvitation: (requestId: string) => void;
  selectSection: (courseId: string, sectionId: string) => void;
  requestSectionSwitch: (courseId: string, targetSectionId: string) => void;
  getPendingRequestsForCourse: (courseId: string) => EnrollmentRequest[];
  getPendingRequestsForStudent: () => EnrollmentRequest[];
  requestJoinCourse: (courseId: string) => void;
  getMyRequest: (courseId: string) => EnrollmentRequest | null;
  getPendingRequests: (courseId: string) => EnrollmentRequest[];

  logHistory: (path: string, title: string) => void;
  clearHistory: () => void;
  resetData: () => void;
}

const STORAGE_KEY_DB = 'gabay_lms_db_v6';
const STORAGE_KEY_THEME = 'gabay_theme_v1';
const STORAGE_KEY_SESSION = 'gabay_auth_session_v1';

// Aggressive cleanup of bloated past storage keys to reclaim browser quota
const purgeOldStorageKeys = () => {
  try {
    const legacyKeys = [
      'gabay_lms_db',
      'gabay_lms_db_v1',
      'gabay_lms_db_v2',
      'gabay_lms_db_v3',
      'gabay_lms_db_v4',
      'gabay_lms_db_backup'
    ];
    legacyKeys.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });
  } catch (_) {}
};

// Immediately run purge on module evaluation
purgeOldStorageKeys();

const safeSetLocalStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`LocalStorage quota reached when setting "${key}". Purging legacy caches...`, err);
    try {
      purgeOldStorageKeys();
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.warn(`LocalStorage setItem retry failed for "${key}".`, retryErr);
      return false;
    }
  }
};

const LMSContext = createContext<LMSContextType | undefined>(undefined);

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

  // Database State
  const [db, setDb] = useState<MockDatabase>(() => {
    purgeOldStorageKeys();

    try {
      const saved = localStorage.getItem(STORAGE_KEY_DB);
      if (saved) {
        const parsed = JSON.parse(saved) as MockDatabase;
        // Merge saved users with initialMockData users to ensure base accounts exist and enrolled users persist
        const existingUserMap = new Map((parsed.users || []).map(u => [u.id, u]));
        initialMockData.users.forEach(u => {
          if (!existingUserMap.has(u.id)) {
            existingUserMap.set(u.id, u as unknown as User);
          }
        });
        parsed.users = Array.from(existingUserMap.values());
        parsed.submissions = parsed.submissions || [];

        // Ensure announcements, discussions, files, messages fall back to initialMockData if empty
        const initialMock = initialMockData as unknown as MockDatabase;
        if (!parsed.announcements || parsed.announcements.length === 0) {
          parsed.announcements = initialMock.announcements || [];
        }
        if (!parsed.discussions || parsed.discussions.length === 0) {
          parsed.discussions = initialMock.discussions || [];
        }
        if (!parsed.courseFiles || parsed.courseFiles.length === 0) {
          parsed.courseFiles = initialMock.courseFiles || [];
        }
        if (!parsed.courseFolders || parsed.courseFolders.length === 0) {
          parsed.courseFolders = initialMock.courseFolders || [];
        }

        // Merge messages with initialMockData messages
        if (!parsed.messages || parsed.messages.length === 0) {
          parsed.messages = (initialMock.messages || []) as Message[];
        } else {
          const initialMap = new Map(((initialMock.messages || []) as Message[]).map(m => [m.id, m]));
          const existingMsgMap = new Map((parsed.messages || []).map(m => {
            const initMsg = initialMap.get(m.id);
            if (initMsg) {
              return [m.id, { ...m, timestamp: initMsg.timestamp }];
            }
            return [m.id, m];
          }));
          ((initialMock.messages || []) as Message[]).forEach(m => {
            if (!existingMsgMap.has(m.id)) {
              existingMsgMap.set(m.id, m);
            }
          });
          parsed.messages = Array.from(existingMsgMap.values());
        }

        // Merge chatGroups with initialMockData chatGroups
        if (!parsed.chatGroups || parsed.chatGroups.length === 0) {
          parsed.chatGroups = (initialMock.chatGroups || []) as ChatGroup[];
        } else {
          const existingGroupMap = new Map((parsed.chatGroups || []).map(g => [g.id, g]));
          ((initialMock.chatGroups || []) as ChatGroup[]).forEach(g => {
            if (!existingGroupMap.has(g.id)) {
              existingGroupMap.set(g.id, g);
            }
          });
          parsed.chatGroups = Array.from(existingGroupMap.values());
        }

        // Ensure announcements have persistent attachment URLs in /uploads/
        if (parsed.announcements) {
          const initialAnnouncements = (initialMock.announcements || []) as Announcement[];
          parsed.announcements = parsed.announcements.map(ann => {
            const initialAnn = initialAnnouncements.find(ia => ia.id === ann.id);
            if (ann.attachments && ann.attachments.length > 0) {
              const updatedAttachments = ann.attachments.map(att => {
                if (!att.url) {
                  const initialAtt = initialAnn?.attachments?.find(ia => ia.name === att.name);
                  const resolvedUrl = initialAtt?.url || `/uploads/${att.name}`;
                  return { ...att, url: resolvedUrl };
                }
                return att;
              });
              return { ...ann, attachments: updatedAttachments };
            }
            return ann;
          });
        }

        // Ensure courseFiles have static /uploads/ URLs
        if (parsed.courseFiles) {
          parsed.courseFiles = parsed.courseFiles.map(cf => {
            if (!cf.fileUrl) {
              return { ...cf, fileUrl: `/uploads/${cf.name}` };
            }
            return cf;
          });
        }

        // Sync sample item attachment and comments if missing in local cache
        if (parsed.modules && parsed.modules.length > 0) {
          const mod1 = parsed.modules.find(m => m.id === 'mod-131-1');
          if (mod1 && (!mod1.comments || mod1.comments.length === 0)) {
            const initialMod1 = (initialMock.modules || []).find(m => m.id === 'mod-131-1');
            if (initialMod1?.comments) mod1.comments = initialMod1.comments;
          }

          const mod2 = parsed.modules.find(m => m.id === 'mod-131-2');
          if (mod2) {
            const itm = mod2.items.find(i => i.id === 'item-131-21');
            if (itm) {
              if (!itm.fileName) itm.fileName = 'CHED-CMO-25-Series-2015-Standards.pdf';
              if (!itm.fileUrl) itm.fileUrl = '/uploads/CHED-CMO-25-Series-2015-Standards.pdf';
              if (!itm.fileSize) itm.fileSize = '2.4 MB';
              if (!itm.fileType) itm.fileType = 'pdf';
            }
            if (!mod2.comments || mod2.comments.length === 0) {
              const initialMod2 = (initialMock.modules || []).find(m => m.id === 'mod-131-2');
              if (initialMod2?.comments) mod2.comments = initialMod2.comments;
            }
          }
        }

        if (parsed.courses) {
          const hasCspc = parsed.courses.some((c: Course) => c.id === 'crs-cspc112');
          if (!hasCspc) {
            const initialCspc = (initialMockData.courses as Course[]).find(c => c.id === 'crs-cspc112');
            if (initialCspc) parsed.courses.push(initialCspc);
          }

          // Ensure all courses have a unique joinCode
          const mockCourses = initialMockData.courses as Course[];
          parsed.courses = parsed.courses.map((c: Course) => {
            if (!c.joinCode) {
              const fromMock = mockCourses.find(mc => mc.id === c.id);
              return { ...c, joinCode: fromMock?.joinCode || generateCourseJoinCode(parsed.courses, c.code) };
            }
            return c;
          });
        }

        if (parsed.users) {
          const mockUsers = initialMockData.users as User[];
          parsed.users = parsed.users.map((u: User) => {
            if (u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.length === 0)) {
              const fromMock = mockUsers.find(mu => mu.id === u.id);
              return { ...u, enrolledCourseIds: fromMock?.enrolledCourseIds || ['crs-cmsc131', 'crs-cmsc150'] };
            }
            return u;
          });
        }

        // Load notifications from localStorage
        if (parsed.notifications) {
          // Ensure notifications have proper format
          parsed.notifications = parsed.notifications.map((n: Notification) => ({
            ...n,
            read: n.read !== undefined ? n.read : false
          }));
        } else {
          parsed.notifications = [];
        }

        // Section defaults
        parsed.courseSections = (parsed as any).courseSections || [];
        parsed.enrollmentRequests = (parsed as any).enrollmentRequests || [];

        // Migration: if courseSections missing, create from existing courses
        if (!parsed.courseSections || parsed.courseSections.length === 0) {
          const migratedSections: CourseSection[] = [];
          const migratedCourses = parsed.courses.map(c => {
            const sectionId = `sec-${c.id}-a`;
            migratedSections.push({
              id: sectionId,
              courseId: c.id,
              name: c.section || 'Section A',
              capacity: 60,
              enrolledCount: c.enrolledCount || 0,
              schedule: 'TBD',
              location: 'TBD'
            });
            return { ...c, sectionIds: [sectionId] };
          });
          parsed.courses = migratedCourses;
          parsed.courseSections = migratedSections;
        }
        if (!parsed.enrollmentRequests) {
          parsed.enrollmentRequests = [];
        }

        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved LMS db', e);
    }

    return initialMockData as unknown as MockDatabase;
  });

  useEffect(() => {
    try {
      // Sanitize database before saving: strip large data URLs from course syllabi
      const sanitizedCourses = (db.courses || []).map(course => {
        if (!course.syllabus) return course;
        if (course.syllabus.sourceDocument?.fileDataUrl?.startsWith('data:')) {
          return {
            ...course,
            syllabus: {
              ...course.syllabus,
              sourceDocument: {
                ...course.syllabus.sourceDocument,
                fileDataUrl: undefined
              }
            }
          };
        }
        return course;
      });

      const payload = JSON.stringify({
        ...db,
        courses: sanitizedCourses
      });

      const savedOk = safeSetLocalStorage(STORAGE_KEY_DB, payload);
      if (!savedOk) {
        // Tier 1 fallback: Prune heavy source document data from syllabus to fit quota
        const compactCourses = (db.courses || []).map(c => ({
          ...c,
          syllabus: c.syllabus ? {
            ...c.syllabus,
            sourceDocument: c.syllabus.sourceDocument ? {
              fileName: c.syllabus.sourceDocument.fileName,
              fileSize: c.syllabus.sourceDocument.fileSize,
              fileType: c.syllabus.sourceDocument.fileType,
              uploadedAt: c.syllabus.sourceDocument.uploadedAt
            } : undefined
          } : c.syllabus
        }));
        const compactPayload = JSON.stringify({ ...db, courses: compactCourses });
        const retry1 = safeSetLocalStorage(STORAGE_KEY_DB, compactPayload);

        if (!retry1) {
          // Tier 2 fallback: Strip syllabus objects entirely from storage
          const ultraTrimmed = (db.courses || []).map(c => ({
            ...c,
            syllabus: c.syllabus === null ? null : undefined
          }));
          safeSetLocalStorage(STORAGE_KEY_DB, JSON.stringify({ ...db, courses: ultraTrimmed }));
        }
      }
    } catch (err: any) {
      console.warn('LocalStorage save skipped; state maintained in memory safely:', err);
    }
  }, [db]);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const sessionUser = localStorage.getItem(STORAGE_KEY_SESSION);
    if (sessionUser) {
      try {
        const parsed = JSON.parse(sessionUser) as User;
        const exists = (initialMockData.users as User[]).find(u => u.id === parsed.id || u.role === parsed.role);
        return exists || parsed;
      } catch (e) {
        console.error('Failed to load session user', e);
      }
    }
    return null;
  });

  const isAuthenticated = currentUser !== null;
  const activeUser = currentUser || db.users[0];
  const activeRole: UserRole = currentUser?.role || 'student';

  const login = async (emailOrId: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const query = emailOrId.trim().toLowerCase();
    
    // Find matching user by email, studentId, name (e.g. "Dean 1", "Student 1"), or role
    const matchedUser = db.users.find(u => 
      u.email.toLowerCase() === query || 
      (u.studentId && u.studentId.toLowerCase() === query) ||
      u.name.toLowerCase() === query ||
      u.name.toLowerCase().replace(/\s+/g, '') === query.replace(/\s+/g, '') ||
      (query === 'dean' && u.role === 'admin') ||
      (query === 'admin' && u.role === 'admin') ||
      (query === 'faculty' && u.role === 'faculty') ||
      (query === 'staff' && u.role === 'staff') ||
      (query === 'student' && u.role === 'student')
    );

    if (!matchedUser) {
      return { 
        success: false, 
        message: 'No account found with this email or ID.' 
      };
    }

    // Check password (accept "gabay2026", user's password, or any non-empty input if demo)
    const validPassword = matchedUser.password || 'gabay2026';
    if (password !== validPassword && password !== 'gabay2026' && password !== 'admin') {
      return { 
        success: false, 
        message: 'Invalid password. (Hint: Demo password is "gabay2026")' 
      };
    }

    setCurrentUser(matchedUser);
    safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(matchedUser));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch (_) {}
    setIsUserProfileModalOpen(false);
    setIsRoleModalOpen(false);
  };

  const switchRole = (role: UserRole) => {
    const userWithRole = db.users.find(u => u.role === role);
    if (userWithRole) {
      setCurrentUser(userWithRole);
      safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(userWithRole));
    }
  };

  // Course state
  const [activeCourseId, setActiveCourseId] = useState<string | null>('crs-cmsc131');

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
    const stored = (db as MockDatabase).notifications;
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

  const createCourse = (courseData: Partial<Course>): Course => {
    const uniqueJoinCode =
      courseData.joinCode?.trim().toUpperCase() ||
      generateCourseJoinCode(db.courses, courseData.code);

    const newCourse: Course = {
      id: `crs-${Date.now().toString(36)}`,
      code: courseData.code || 'CMSC 199',
      title: courseData.title || 'Advanced Computer Science Topics',
      section: courseData.section || 'BSCS 4-1',
      term: courseData.term || '1st Sem AY 2026-2027',
      instructorId: activeUser.id,
      instructorName: activeUser.name,
      published: courseData.published ?? true,
      color: courseData.color !== undefined ? courseData.color : '',
      enrolledCount: courseData.enrolledCount || 1,
      credits: courseData.credits || 3,
      chedComplianceCode: courseData.chedComplianceCode || 'CMO-25-2015',
      image: courseData.image || '',
      joinCode: uniqueJoinCode
    };

    setDb(prev => ({
      ...prev,
      courses: [newCourse, ...prev.courses]
    }));

    setActiveCourseId(newCourse.id);
    return newCourse;
  };

  const createAssignment = (asgData: Partial<Assignment>): Assignment => {
    const newAssignment: Assignment = {
      id: `asg-${Date.now().toString(36)}`,
      courseId: asgData.courseId || activeCourseId || 'crs-cmsc131',
      title: asgData.title || 'New Course Assignment',
      instructions: asgData.instructions || 'Please review the guidelines and submit your work before the deadline.',
      pointsPossible: asgData.pointsPossible || 100,
      dueDate: asgData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      submissionTypes: asgData.submissionTypes || ['file', 'online_text'],
      published: asgData.published ?? true,
      category: asgData.category || 'Laboratory',
      weight: asgData.weight || 20,
      rubric: asgData.rubric || [
        {
          id: `rub-${Date.now()}-1`,
          title: 'CHED Learning Outcome Alignment',
          description: 'Demonstrates deep understanding of theoretical and practical concepts',
          points: 50,
          ratings: [
            { points: 50, description: 'Exemplary Mastery' },
            { points: 35, description: 'Proficient' },
            { points: 20, description: 'Needs Revision' }
          ]
        },
        {
          id: `rub-${Date.now()}-2`,
          title: 'Code Quality & Technical Execution',
          description: 'Follows clean code conventions, modular structure, and documentation',
          points: 50,
          ratings: [
            { points: 50, description: 'Industry Standards' },
            { points: 35, description: 'Adequate Quality' },
            { points: 20, description: 'Deficient' }
          ]
        }
      ]
    };

    setDb(prev => ({
      ...prev,
      assignments: [newAssignment, ...prev.assignments]
    }));

    // Also auto-create a corresponding calendar event
    const newCalEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: `Due: ${newAssignment.title}`,
      date: newAssignment.dueDate.split('T')[0],
      time: '11:59 PM',
      courseId: newAssignment.courseId,
      type: 'assignment',
      description: `Course assignment submission deadline for ${newAssignment.title}`
    };
    setDb(prev => ({
      ...prev,
      calendarEvents: [...prev.calendarEvents, newCalEvent]
    }));

    return newAssignment;
  };

  const deleteAssignment = (asgId: string) => {
    setDb(prev => ({
      ...prev,
      assignments: prev.assignments.filter(a => a.id !== asgId),
      submissions: prev.submissions.filter(s => s.assignmentId !== asgId)
    }));
  };

  const createModule = (courseId: string, title: string): Module => {
    const newModule: Module = {
      id: `mod-${Date.now().toString(36)}`,
      courseId,
      title,
      order: db.modules.filter(m => m.courseId === courseId).length + 1,
      published: true,
      authorId: activeUser.id,
      authorName: activeUser.name,
      items: []
    };

    setDb(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));

    return newModule;
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setDb(prev => ({
      ...prev,
      modules: (prev.modules || []).map(mod => {
        if (mod.id === moduleId) {
          return { ...mod, ...updates };
        }
        return mod;
      })
    }));
  };

  const deleteModule = (moduleId: string) => {
    setDb(prev => ({
      ...prev,
      modules: (prev.modules || []).filter(m => m.id !== moduleId)
    }));
  };

  const addModuleItem = (moduleId: string, itemData: Partial<ModuleItem>) => {
    const newItem: ModuleItem = {
      id: `item-${Date.now().toString(36)}`,
      title: itemData.title || 'New Learning Resource',
      type: itemData.type || 'page',
      published: itemData.published ?? true,
      required: itemData.required ?? false,
      completionCondition: itemData.completionCondition || 'view',
      content: itemData.content || 'Content guidelines aligned with course syllabus objectives.',
      assignmentId: itemData.assignmentId,
      quizId: itemData.quizId,
      fileUrl: itemData.fileUrl,
      fileName: itemData.fileName,
      fileSize: itemData.fileSize,
      fileType: itemData.fileType,
      authorId: itemData.authorId || activeUser.id,
      authorName: itemData.authorName || activeUser.name,
      completed: false
    };

    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            items: [...mod.items, newItem]
          };
        }
        return mod;
      })
    }));
  };

  const updateModuleItem = (
    currentModuleId: string,
    itemId: string,
    updates: Partial<ModuleItem>,
    targetModuleId?: string
  ) => {
    setDb(prev => {
      const destModuleId = targetModuleId || currentModuleId;

      // If item stays in the same module
      if (destModuleId === currentModuleId) {
        return {
          ...prev,
          modules: (prev.modules || []).map(mod => {
            if (mod.id === currentModuleId) {
              return {
                ...mod,
                items: mod.items.map(it => (it.id === itemId ? { ...it, ...updates } : it))
              };
            }
            return mod;
          })
        };
      }

      // If moving item to another module
      let movedItem: ModuleItem | null = null;
      const modulesWithItemRemoved = (prev.modules || []).map(mod => {
        if (mod.id === currentModuleId) {
          const item = mod.items.find(it => it.id === itemId);
          if (item) {
            movedItem = { ...item, ...updates };
          }
          return {
            ...mod,
            items: mod.items.filter(it => it.id !== itemId)
          };
        }
        return mod;
      });

      if (!movedItem) return prev;

      return {
        ...prev,
        modules: modulesWithItemRemoved.map(mod => {
          if (mod.id === destModuleId) {
            return {
              ...mod,
              items: [...mod.items, movedItem!]
            };
          }
          return mod;
        })
      };
    });
  };

  const deleteModuleItem = (moduleId: string, itemId: string) => {
    setDb(prev => ({
      ...prev,
      modules: (prev.modules || []).map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            items: mod.items.filter(it => it.id !== itemId)
          };
        }
        return mod;
      })
    }));
  };

  const createQuiz = (quizData: Partial<Quiz>): Quiz => {
    const newQuiz: Quiz = {
      id: `quiz-${Date.now().toString(36)}`,
      courseId: quizData.courseId || activeCourseId || 'crs-cmsc131',
      title: quizData.title || 'New Assessment Quiz',
      instructions: quizData.instructions || 'Answer all questions carefully. Time limit strictly enforced.',
      timeLimitMinutes: quizData.timeLimitMinutes || 30,
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
      ]
    };

    setDb(prev => ({
      ...prev,
      quizzes: [newQuiz, ...prev.quizzes]
    }));

    return newQuiz;
  };

  const recordQuizSubmission = (quizId: string, studentId: string, score: number, answers: Record<string, string>) => {
    const quiz = db.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    // Create or update a submission record for grading
    const mockAssignmentId = `asg-quiz-${quizId}`;
    const existingSubIndex = db.submissions.findIndex(s => s.assignmentId === mockAssignmentId && s.studentId === studentId);

    const submissionRecord: Submission = {
      id: existingSubIndex >= 0 ? db.submissions[existingSubIndex].id : `sub-quiz-${Date.now()}`,
      assignmentId: mockAssignmentId,
      courseId: quiz.courseId,
      studentId: studentId,
      studentName: activeUser.name,
      studentAvatar: activeUser.avatar,
      submittedAt: new Date().toISOString(),
      submissionType: 'online_text',
      content: `Automated Quiz Assessment Result: Score: ${score}%. Answers recorded: ${JSON.stringify(answers)}`,
      grade: score,
      gradedAt: new Date().toISOString(),
      gradedBy: 'GABAY Quiz Auto-Evaluator',
      status: 'graded',
      rubricScores: { 'automated_eval': score },
      comments: [
        {
          id: `comm-${Date.now()}`,
          authorId: 'sys-auto-grader',
          authorName: 'GABAY Evaluation Engine',
          authorRole: 'admin',
          createdAt: new Date().toISOString(),
          text: `Automatic grading completed. Student achieved ${score}% in assessment "${quiz.title}".`
        }
      ]
    };

    setDb(prev => {
      let updatedSubs: Submission[];
      if (existingSubIndex >= 0) {
        updatedSubs = [...prev.submissions];
        updatedSubs[existingSubIndex] = submissionRecord;
      } else {
        updatedSubs = [submissionRecord, ...prev.submissions];
      }
      return { ...prev, submissions: updatedSubs };
    });
  };

  const enrollPerson = (person: Partial<User>, courseId?: string) => {
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
  };

  const enrollStudentsInCourse = (studentIds: string[], courseId: string) => {
    const targetCourseId = courseId || activeCourseId;
    if (!targetCourseId || studentIds.length === 0) return;

    for (const studentId of studentIds) {
      setDb(prev => {
        const student = prev.users.find(u => u.id === studentId);
        if (!student) return prev;

        const alreadyEnrolled = (student.enrolledCourseIds || []).includes(targetCourseId);
        const alreadyPending = (prev.enrollmentRequests || []).find(
          r => r.studentId === studentId && r.courseId === targetCourseId && r.status === 'pending'
        );

        if (!alreadyEnrolled && !alreadyPending) {
          const newRequest: EnrollmentRequest = {
            id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            courseId: targetCourseId,
            studentId: student.id,
            studentName: student.name,
            type: 'faculty_enroll',
            status: 'pending',
            requestedAt: new Date().toISOString()
          };

          return {
            ...prev,
            enrollmentRequests: [...(prev.enrollmentRequests || []), newRequest]
          };
        }

        return prev;
      });
    }
  };

  const createUser = (userData: Partial<User>): User => {
    const role = userData.role || 'student';
    const newUser: User = {
      id: userData.id || `usr-${role.slice(0, 4)}-${Date.now().toString(36)}`,
      name: userData.name?.trim() || 'New User',
      email: userData.email?.trim() || `user.${Date.now()}@dmmmsu.edu.ph`,
      role,
      avatar: userData.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      department: userData.department || 'College of Computer Science',
      title: userData.title || (role === 'student' ? 'Undergraduate Student' : 'Faculty Instructor'),
      studentId: userData.studentId || (role === 'student' ? `2026-${Math.floor(10000 + Math.random() * 90000)}` : undefined),
      password: userData.password || 'password123',
      enrolledCourseIds: userData.enrolledCourseIds || []
    };

    setDb(prev => ({
      ...prev,
      users: [...prev.users, newUser]
    }));

    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === id ? { ...u, ...updates } : u))
    }));
  };

  const deleteUser = (userId: string): { success: boolean; message?: string } => {
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

  const joinCourseByCode = (code: string): { success: boolean; message: string; course?: Course } => {
    const cleanCode = code.trim().toUpperCase();
    const targetCourse = db.courses.find(c => (c.joinCode || '').toUpperCase() === cleanCode);
    
    if (!targetCourse) {
      return { success: false, message: `No course found matching code "${cleanCode}". Please verify with your instructor.` };
    }

    const currentEnrolled = activeUser.enrolledCourseIds || [];
    if (currentEnrolled.includes(targetCourse.id)) {
      return {
        success: false,
        message: `You are already enrolled in ${targetCourse.code} (${targetCourse.title}).`,
        course: targetCourse
      };
    }

    const existingPending = (db.enrollmentRequests || []).find(
      r => r.studentId === activeUser.id && r.courseId === targetCourse.id && r.status === 'pending'
    );
    if (existingPending) {
      return {
        success: false,
        message: `You already have a pending join request for ${targetCourse.code}.`,
        course: targetCourse
      };
    }

    createEnrollmentRequest(targetCourse.id, 'self_join');

    return {
      success: true,
      message: `Join request sent for ${targetCourse.code} - ${targetCourse.title}. Waiting for instructor approval.`,
      course: targetCourse
    };
  };

  const regenerateCourseJoinCode = (courseId: string): string => {
    const targetCourse = db.courses.find(c => c.id === courseId);
    const newCode = generateCourseJoinCode(db.courses, targetCourse?.code);
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? { ...c, joinCode: newCode } : c))
    }));
    return newCode;
  };

  const updateSyllabus = (courseId: string, updates: Partial<Course>) => {
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? { ...c, ...updates } : c))
    }));
  };

  const updateCourseSyllabus = (courseId: string, syllabus: OfficialSyllabusData) => {
    const boundSyllabus: OfficialSyllabusData = {
      ...syllabus,
      courseId
    };
    const instructorFromSyllabus = boundSyllabus.facultyMembers?.[0]?.name;
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? {
        ...c,
        syllabus: boundSyllabus,
        ...(instructorFromSyllabus ? { instructorName: instructorFromSyllabus } : {})
      } : c))
    }));
  };

  const removeCourseSyllabus = (courseId: string) => {
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? { ...c, syllabus: null } : c))
    }));
  };

  const importCommonsTemplate = (templateId: string, targetCourseId: string): { success: boolean; message: string } => {
    const tmpl = db.commonsTemplates.find(t => t.id === templateId);
    const targetCourse = db.courses.find(c => c.id === targetCourseId);
    
    if (!tmpl || !targetCourse) {
      return { success: false, message: 'Invalid template or course target' };
    }

    // Create a new module based on the imported template
    const newMod = createModule(targetCourseId, `[Imported] ${tmpl.title}`);
    addModuleItem(newMod.id, {
      title: `${tmpl.title} Blueprint & Rubric Guidelines`,
      type: 'page',
      content: `${tmpl.description}\n\nAlignment: ${tmpl.chedAlignment}\nTags: ${tmpl.tags.join(', ')}`
    });

    return { 
      success: true, 
      message: `Successfully imported "${tmpl.title}" into ${targetCourse.code} (${targetCourse.section})!` 
    };
  };

  const gradeSubmission = (
    submissionId: string,
    grade: number,
    rubricScores: Record<string, number>,
    commentText?: string
  ) => {
    setDb(prev => {
      const updatedSubmissions = prev.submissions.map(sub => {
        if (sub.id === submissionId) {
          const comments = [...sub.comments];
          if (commentText && commentText.trim()) {
            comments.push({
              id: `comm-${Date.now()}`,
              authorId: activeUser.id,
              authorName: activeUser.name,
              authorRole: activeRole,
              createdAt: new Date().toISOString(),
              text: commentText.trim()
            });
          }
          return {
            ...sub,
            grade,
            rubricScores,
            comments,
            status: 'graded' as const,
            gradedAt: new Date().toISOString(),
            gradedBy: activeUser.name
          };
        }
        return sub;
      });

      return {
        ...prev,
        submissions: updatedSubmissions
      };
    });
  };

  const submitAssignment = (
    assignmentId: string,
    submissionType: 'file' | 'online_text',
    content?: string,
    fileName?: string
  ) => {
    const assignment = db.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    const existingIndex = db.submissions.findIndex(
      s => s.assignmentId === assignmentId && s.studentId === activeUser.id
    );

    const newSubmission: Submission = {
      id: existingIndex >= 0 ? db.submissions[existingIndex].id : `sub-${Date.now()}`,
      assignmentId,
      courseId: assignment.courseId,
      studentId: activeUser.id,
      studentName: activeUser.name,
      studentAvatar: activeUser.avatar,
      submittedAt: new Date().toISOString(),
      submissionType,
      content,
      fileName: fileName || (submissionType === 'file' ? 'Assignment_Submission.pdf' : undefined),
      fileUrl: 'https://github.com/dmmmsu-sluc/gabay-lms-prototype',
      status: 'submitted',
      rubricScores: {},
      comments: []
    };

    setDb(prev => {
      let updated: Submission[];
      if (existingIndex >= 0) {
        updated = [...prev.submissions];
        updated[existingIndex] = newSubmission;
      } else {
        updated = [newSubmission, ...prev.submissions];
      }
      return { ...prev, submissions: updated };
    });
  };

  const toggleModulePublish = (moduleId: string) => {
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(m => (m.id === moduleId ? { ...m, published: !m.published } : m))
    }));
  };

  const toggleItemCompletion = (moduleId: string, itemId: string) => {
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            items: mod.items.map(it => (it.id === itemId ? { ...it, completed: !it.completed } : it))
          };
        }
        return mod;
      })
    }));
  };

  const addModuleComment = (moduleId: string, content: string) => {
    if (!content.trim()) return;
    const newComment: ModuleComment = {
      id: `mcom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      moduleId,
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorAvatar: activeUser.avatar,
      authorRole: activeRole,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };

    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            comments: [...(mod.comments || []), newComment]
          };
        }
        return mod;
      })
    }));
  };

  const editModuleComment = (moduleId: string, commentId: string, newContent: string) => {
    if (!newContent.trim()) return;
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            comments: (mod.comments || []).map(c => {
              if (c.id === commentId) {
                // Authority check: only author can edit
                if (c.authorId !== activeUser.id) return c;
                return {
                  ...c,
                  content: newContent.trim(),
                  isEdited: true,
                  editedAt: new Date().toISOString()
                };
              }
              return c;
            })
          };
        }
        return mod;
      })
    }));
  };

  const deleteModuleComment = (moduleId: string, commentId: string) => {
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            comments: (mod.comments || []).map(c => {
              if (c.id === commentId) {
                // Authority check: only author can delete
                if (c.authorId !== activeUser.id) return c;
                return {
                  ...c,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  content: 'This comment has been deleted by the author.'
                };
              }
              return c;
            })
          };
        }
        return mod;
      })
    }));
  };

  const toggleLikeModuleComment = (moduleId: string, commentId: string) => {
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            comments: (mod.comments || []).map(c => {
              if (c.id === commentId) {
                const likedBy = c.likedBy || [];
                const alreadyLiked = likedBy.includes(activeUser.id);
                return {
                  ...c,
                  likes: alreadyLiked ? Math.max(0, (c.likes || 1) - 1) : (c.likes || 0) + 1,
                  likedBy: alreadyLiked
                    ? likedBy.filter(id => id !== activeUser.id)
                    : [...likedBy, activeUser.id]
                };
              }
              return c;
            })
          };
        }
        return mod;
      })
    }));
  };

  const sendMessage = (
    recipientId: string,
    subject: string,
    body: string,
    courseId?: string,
    attachmentName?: string,
    attachmentSize?: string,
    isGroupParam?: boolean,
    groupIdParam?: string
  ) => {
    const matchedGroup = (db.chatGroups || []).find(g => g.id === (groupIdParam || recipientId));
    const recipient = db.users.find(u => u.id === recipientId);
    const isGroup = isGroupParam !== undefined ? isGroupParam : !!matchedGroup;
    if (!recipient && !matchedGroup) return;

    const course = db.courses.find(c => c.id === (courseId || matchedGroup?.courseId));

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: activeUser.id,
      senderName: activeUser.name,
      senderRole: activeRole,
      recipientId: isGroup ? matchedGroup!.id : recipient!.id,
      recipientName: isGroup ? matchedGroup!.name : recipient!.name,
      recipientRole: isGroup ? 'student' : recipient!.role,
      courseId: course?.id,
      courseCode: course?.code,
      subject,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      attachmentName,
      attachmentSize,
      isGroup,
      groupId: isGroup ? (groupIdParam || matchedGroup?.id) : undefined
    };

    setDb(prev => ({ ...prev, messages: [newMsg, ...(prev.messages || [])] }));
  };

  const createChatGroup = (name: string, memberIds: string[], courseId?: string): ChatGroup => {
    const course = db.courses.find(c => c.id === courseId);
    const allMembers = Array.from(new Set([activeUser.id, ...memberIds]));

    const newGroup: ChatGroup = {
      id: `grp-${Date.now()}`,
      name: name.trim() || 'New Study Group',
      memberIds: allMembers,
      courseId,
      courseCode: course?.code,
      createdAt: new Date().toISOString(),
      createdBy: activeUser.id
    };

    const welcomeMsg: Message = {
      id: `msg-${Date.now()}-welcome`,
      senderId: activeUser.id,
      senderName: activeUser.name,
      senderRole: activeRole,
      recipientId: newGroup.id,
      recipientName: newGroup.name,
      recipientRole: 'student',
      courseId: course?.id,
      courseCode: course?.code,
      subject: `Welcome to ${newGroup.name}`,
      body: `Group created by ${activeUser.name}. Welcome everyone!`,
      timestamp: new Date().toISOString(),
      read: true,
      groupId: newGroup.id,
      isGroup: true
    };

    setDb(prev => ({
      ...prev,
      chatGroups: [newGroup, ...(prev.chatGroups || [])],
      messages: [welcomeMsg, ...(prev.messages || [])]
    }));

    return newGroup;
  };

  const markThreadAsRead = (partnerId: string) => {
    setDb(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m => {
        if (m.senderId === partnerId && m.recipientId === activeUser.id && !m.read) {
          return { ...m, read: true };
        }
        return m;
      })
    }));
  };

  const toggleMessageReaction = (messageId: string, reaction: string) => {
    setDb(prev => ({
      ...prev,
      messages: (prev.messages || []).map(m => {
        if (m.id === messageId) {
          return { ...m, reaction: m.reaction === reaction ? undefined : reaction };
        }
        return m;
      })
    }));
  };

  const bookAdvisingSlot = (slotId: string) => {
    setDb(prev => ({
      ...prev,
      advisingSlots: prev.advisingSlots.map(slot => {
        if (slot.id === slotId) {
          return {
            ...slot,
            status: 'booked' as const,
            bookedByStudentId: activeUser.id,
            bookedByStudentName: activeUser.name,
            notes: `Advising requested by ${activeUser.name} (${activeUser.studentId || activeUser.email})`
          };
        }
        return slot;
      })
    }));
  };

  const createAdvisingSlot = (date: string, timeSlot: string, location: string) => {
    const newSlot: AdvisingSlot = {
      id: `adv-${Date.now()}`,
      instructorId: activeUser.id,
      instructorName: activeUser.name,
      date,
      timeSlot,
      location,
      status: 'available'
    };

    setDb(prev => ({
      ...prev,
      advisingSlots: [...prev.advisingSlots, newSlot]
    }));
  };

  const addCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEvt: CalendarEvent = {
      ...event,
      id: `evt-${Date.now()}`
    };
    setDb(prev => ({
      ...prev,
      calendarEvents: [...prev.calendarEvents, newEvt]
    }));
  };

  const updateCalendarEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setDb(prev => ({
      ...prev,
      calendarEvents: prev.calendarEvents.map(evt =>
        evt.id === id ? { ...evt, ...updates } : evt
      )
    }));
  };

  const deleteCalendarEvent = (id: string) => {
    setDb(prev => ({
      ...prev,
      calendarEvents: prev.calendarEvents.filter(evt => evt.id !== id)
    }));
  };

  // ==========================================
  // ANNOUNCEMENTS CRUD
  // ==========================================

  const createAnnouncement = (data: Partial<Announcement>): Announcement => {
    const newAnn: Announcement = {
      id: `ann-${Date.now().toString(36)}`,
      courseId: data.courseId || activeCourseId || 'crs-cmsc131',
      title: data.title || 'Untitled Announcement',
      content: data.content || '',
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorAvatar: activeUser.avatar,
      authorRole: activeRole,
      createdAt: new Date().toISOString(),
      sectionRestriction: data.sectionRestriction || 'All Sections',
      delayedUntil: data.delayedUntil,
      allowComments: data.allowComments ?? true,
      usersMustPostBeforeReplies: data.usersMustPostBeforeReplies ?? false,
      allowLiking: data.allowLiking ?? true,
      likes: 0,
      likedBy: [],
      pinned: data.pinned ?? false,
      attachments: data.attachments || [],
      replies: [],
      readBy: [activeUser.id]
    };

    setDb(prev => ({
      ...prev,
      announcements: [newAnn, ...(prev.announcements || [])]
    }));
    return newAnn;
  };

  const deleteAnnouncement = (id: string) => {
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).filter(a => a.id !== id)
    }));
  };

  const togglePinAnnouncement = (id: string) => {
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === id ? { ...a, pinned: !a.pinned } : a
      )
    }));
  };

  const toggleLikeAnnouncement = (id: string) => {
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a => {
        if (a.id !== id) return a;
        const liked = (a.likedBy || []).includes(activeUser.id);
        const newLikedBy = liked
          ? (a.likedBy || []).filter(uid => uid !== activeUser.id)
          : [...(a.likedBy || []), activeUser.id];
        return {
          ...a,
          likedBy: newLikedBy,
          likes: newLikedBy.length
        };
      })
    }));
  };

  const addAnnouncementReply = (announcementId: string, content: string) => {
    const newReply: AnnouncementReply = {
      id: `rep-${Date.now().toString(36)}`,
      announcementId,
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorAvatar: activeUser.avatar,
      authorRole: activeRole,
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };

    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === announcementId
          ? { ...a, replies: [...a.replies, newReply] }
          : a
      )
    }));
  };

  const markAnnouncementRead = (id: string) => {
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a => {
        if (a.id !== id) return a;
        const readBy = a.readBy || [];
        if (readBy.includes(activeUser.id)) return a;
        return { ...a, readBy: [...readBy, activeUser.id] };
      })
    }));
  };

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  const createNotification = (notificationData: Partial<Notification>): Notification => {
    const newNotification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: notificationData.type || 'module_comment_reply',
      recipientId: notificationData.recipientId || activeUser.id,
      actorId: notificationData.actorId || activeUser.id,
      actorName: notificationData.actorName || activeUser.name,
      actorAvatar: notificationData.actorAvatar || activeUser.avatar,
      relatedId: notificationData.relatedId || '',
      relatedTitle: notificationData.relatedTitle || '',
      content: notificationData.content || '',
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Also persist to db.notifications if available
    setDb(prev => {
      const notifications = (prev.notifications || []).concat(newNotification);
      return { ...prev, notifications };
    });

    return newNotification;
  };

  const getUnreadNotificationCount = (userId: string, type?: string): number => {
    const userNotifications = (notifications || [])
      .filter(n => n.recipientId === userId && !n.read);

    if (!type) return userNotifications.length;

    return userNotifications.filter(n => n.type === type).length;
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    setDb(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.id === id ? { ...n, read: true } : n
      )
    }));
  };

  const markAllNotificationsRead = (userId: string, type?: string) => {
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

  const createDiscussion = (data: Partial<Discussion>): Discussion => {
    const newDisc: Discussion = {
      id: `disc-${Date.now().toString(36)}`,
      courseId: data.courseId || activeCourseId || 'crs-cmsc131',
      title: data.title || 'Untitled Discussion Topic',
      prompt: data.prompt || '',
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorAvatar: activeUser.avatar,
      authorRole: activeRole,
      createdAt: new Date().toISOString(),
      isGraded: data.isGraded ?? false,
      pointsPossible: data.pointsPossible,
      dueDate: data.dueDate,
      pinned: data.pinned ?? false,
      locked: data.locked ?? false,
      usersMustPostBeforeReplies: data.usersMustPostBeforeReplies ?? false,
      groupAssignment: data.groupAssignment || 'All Students',
      replies: []
    };

    setDb(prev => ({
      ...prev,
      discussions: [newDisc, ...(prev.discussions || [])]
    }));
    return newDisc;
  };

  const deleteDiscussion = (id: string) => {
    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).filter(d => d.id !== id)
    }));
  };

  const togglePinDiscussion = (id: string) => {
    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).map(d =>
        d.id === id ? { ...d, pinned: !d.pinned } : d
      )
    }));
  };

  const toggleLockDiscussion = (id: string) => {
    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).map(d =>
        d.id === id ? { ...d, locked: !d.locked } : d
      )
    }));
  };

  const addDiscussionReply = (
    discussionId: string,
    content: string,
    parentId?: string,
    attachment?: { name: string; url?: string }
  ) => {
    const newReply: DiscussionReply = {
      id: `drep-${Date.now().toString(36)}`,
      discussionId,
      parentId,
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorAvatar: activeUser.avatar,
      authorRole: activeRole,
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      attachments: attachment ? [attachment] : []
    };

    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).map(d =>
        d.id === discussionId
          ? { ...d, replies: [...d.replies, newReply] }
          : d
      )
    }));
  };

  const toggleLikeDiscussionReply = (discussionId: string, replyId: string) => {
    setDb(prev => ({
      ...prev,
      discussions: (prev.discussions || []).map(d => {
        if (d.id !== discussionId) return d;
        return {
          ...d,
          replies: d.replies.map(r => {
            if (r.id !== replyId) return r;
            const liked = (r.likedBy || []).includes(activeUser.id);
            const newLikedBy = liked
              ? (r.likedBy || []).filter(uid => uid !== activeUser.id)
              : [...(r.likedBy || []), activeUser.id];
            return {
              ...r,
              likedBy: newLikedBy,
              likes: newLikedBy.length
            };
          })
        };
      })
    }));
  };

  // ==========================================
  // COURSE FILES & FOLDERS CRUD
  // ==========================================

  const createCourseFolder = (courseId: string, name: string, parentId?: string | null): CourseFolder => {
    const newFolder: CourseFolder = {
      id: `fld-${Date.now().toString(36)}`,
      courseId,
      name,
      parentId: parentId || null,
      updatedAt: new Date().toISOString()
    };
    setDb(prev => ({
      ...prev,
      courseFolders: [...(prev.courseFolders || []), newFolder]
    }));
    return newFolder;
  };

  const uploadCourseFile = (fileData: Partial<CourseFile>): CourseFile => {
    const size = fileData.size || 1024 * 512;
    const formattedSize = fileData.formattedSize || (size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`);
    const newFile: CourseFile = {
      id: `file-${Date.now().toString(36)}`,
      courseId: fileData.courseId || activeCourseId || 'crs-cmsc131',
      folderId: fileData.folderId || null,
      name: fileData.name || 'uploaded_asset.pdf',
      size,
      formattedSize,
      type: fileData.type || 'document',
      visibility: fileData.visibility || 'published',
      updatedAt: new Date().toISOString(),
      uploadedBy: activeUser.id,
      uploadedByName: activeUser.name,
      content: fileData.content || '',
      url: fileData.url
    };
    setDb(prev => ({
      ...prev,
      courseFiles: [...(prev.courseFiles || []), newFile]
    }));
    return newFile;
  };

  const deleteCourseFile = (fileId: string) => {
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

      // 4. Assignment / Activity handout file
      let updatedAssignments = prev.assignments;
      if (fileId.startsWith('asg-file-')) {
        const asgId = fileId.replace('asg-file-', '');
        updatedAssignments = (prev.assignments || []).map(asg => {
          if (asg.id === asgId) {
            return {
              ...asg,
              fileName: undefined,
              fileUrl: undefined,
              fileSize: undefined
            };
          }
          return asg;
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
        assignments: updatedAssignments,
        submissions: updatedSubmissions,
        quizzes: updatedQuizzes
      };
    });
  };

  const deleteCourseFolder = (folderId: string) => {
    setDb(prev => ({
      ...prev,
      courseFolders: (prev.courseFolders || []).filter(f => f.id !== folderId && f.parentId !== folderId),
      courseFiles: (prev.courseFiles || []).filter(f => f.folderId !== folderId)
    }));
  };

  const updateFileVisibility = (fileId: string, visibility: 'published' | 'unpublished' | 'restricted') => {
    setDb(prev => ({
      ...prev,
      courseFiles: (prev.courseFiles || []).map(f =>
        f.id === fileId ? { ...f, visibility } : f
      )
    }));
  };

  const renameCourseFile = (fileId: string, newName: string) => {
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

      let updatedAssignments = prev.assignments;
      if (fileId.startsWith('asg-file-')) {
        const asgId = fileId.replace('asg-file-', '');
        updatedAssignments = (prev.assignments || []).map(asg =>
          asg.id === asgId ? { ...asg, fileName: newName } : asg
        );
      }

      return {
        ...prev,
        courseFiles: updatedCourseFiles,
        modules: updatedModules,
        announcements: updatedAnnouncements,
        assignments: updatedAssignments
      };
    });
  };

  const setCourseStudentGrade = (
    courseId: string,
    studentId: string,
    type: 'midterm' | 'final',
    score: number | null
  ) => {
    setDb(prev => {
      const existingGrades = prev.courseGrades || [];
      const index = existingGrades.findIndex(
        g => g.courseId === courseId && g.studentId === studentId
      );

      let updatedList: CourseStudentGrade[];
      if (index >= 0) {
        const item = { ...existingGrades[index] };
        if (type === 'midterm') item.midtermGrade = score;
        if (type === 'final') item.finalGrade = score;
        item.updatedAt = new Date().toISOString();
        updatedList = [...existingGrades];
        updatedList[index] = item;
      } else {
        const newItem: CourseStudentGrade = {
          courseId,
          studentId,
          midtermGrade: type === 'midterm' ? score : null,
          finalGrade: type === 'final' ? score : null,
          updatedAt: new Date().toISOString()
        };
        updatedList = [...existingGrades, newItem];
      }

      return {
        ...prev,
        courseGrades: updatedList
      };
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

  const createSection = (courseId: string, data: Partial<CourseSection>): CourseSection => {
    const newSection: CourseSection = {
      id: `sec-${Date.now().toString(36)}`,
      courseId,
      name: data.name || 'New Section',
      capacity: data.capacity ?? undefined,
      enrolledCount: 0,
      schedule: data.schedule || '',
      location: data.location || ''
    };

    setDb(prev => ({
      ...prev,
      courseSections: [...(prev.courseSections || []), newSection],
      courses: prev.courses.map(c =>
        c.id === courseId
          ? { ...c, sectionIds: [...(c.sectionIds || []), newSection.id] }
          : c
      )
    }));

    return newSection;
  };

  const updateSection = (sectionId: string, updates: Partial<CourseSection>) => {
    setDb(prev => ({
      ...prev,
      courseSections: (prev.courseSections || []).map((s: CourseSection) =>
        s.id === sectionId ? { ...s, ...updates } : s
      )
    }));
  };

  const deleteSection = (sectionId: string) => {
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
      return;
    }
    setDb(prev => ({
      ...prev,
      courseSections: (prev.courseSections || []).filter((s: CourseSection) => s.id !== sectionId),
      courses: prev.courses.map(c => ({
        ...c,
        sectionIds: (c.sectionIds || []).filter(id => id !== sectionId)
      }))
    }));
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

  const createEnrollmentRequest = (courseId: string, type: 'self_join' | 'faculty_enroll'): EnrollmentRequest => {
    const newRequest: EnrollmentRequest = {
      id: `req-${Date.now().toString(36)}`,
      courseId,
      studentId: activeUser.id,
      studentName: activeUser.name,
      type,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    setDb(prev => ({
      ...prev,
      enrollmentRequests: [...(prev.enrollmentRequests || []), newRequest]
    }));

    return newRequest;
  };

  const approveEnrollmentRequests = (requestIds: string[]) => {
    setDb(prev => {
      const now = new Date().toISOString();
      const existingRequests = prev.enrollmentRequests || [];
      const requestsToApprove = existingRequests.filter(
        (r: EnrollmentRequest) => requestIds.includes(r.id) && r.status === 'pending'
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
          requestIds.includes(r.id) && r.status === 'pending' && !skippedSet.has(r.id)
            ? { ...r, status: 'approved' as const, resolvedAt: now, resolvedBy: activeUser.id }
            : r
        )
      };
    });
  };

  const rejectEnrollmentRequests = (requestIds: string[]) => {
    setDb(prev => ({
      ...prev,
      enrollmentRequests: (prev.enrollmentRequests || []).map((r: EnrollmentRequest) =>
        requestIds.includes(r.id) && r.status === 'pending'
          ? { ...r, status: 'rejected' as const, resolvedAt: new Date().toISOString(), resolvedBy: activeUser.id }
          : r
      )
    }));
  };

  const studentApproveInvitation = (requestId: string) => {
    setDb(prev => {
      const request = (prev.enrollmentRequests || []).find((r: EnrollmentRequest) => r.id === requestId);
      if (!request || request.studentId !== activeUser.id) return prev;

      const updatedUser = {
        ...activeUser,
        enrolledCourseIds: [...(activeUser.enrolledCourseIds || []), request.courseId]
      };
      setCurrentUser(updatedUser);
      safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(updatedUser));

      return {
        ...prev,
        users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u),
        courses: prev.courses.map(c =>
          c.id === request.courseId
            ? { ...c, enrolledCount: (c.enrolledCount || 0) + 1 }
            : c
        ),
        enrollmentRequests: (prev.enrollmentRequests || []).map((r: EnrollmentRequest) =>
          r.id === requestId ? { ...r, status: 'approved' as const, resolvedAt: new Date().toISOString() } : r
        )
      };
    });
  };

  const studentDeclineInvitation = (requestId: string) => {
    setDb(prev => ({
      ...prev,
      enrollmentRequests: (prev.enrollmentRequests || []).map((r: EnrollmentRequest) =>
        r.id === requestId && r.studentId === activeUser.id && r.status === 'pending'
          ? { ...r, status: 'rejected' as const, resolvedAt: new Date().toISOString(), resolvedBy: activeUser.id }
          : r
      )
    }));
  };

  const selectSection = (courseId: string, sectionId: string) => {
    const bypassGate = activeRole === 'faculty' || activeRole === 'admin';
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
        return;
      }
    }

    const targetSection = (db.courseSections || []).find((s: CourseSection) => s.id === sectionId);
    if (!targetSection) return;
    if (!canPickSection(targetSection)) {
      showAlert('This section is full. Please choose another section.', 'Section Full');
      return;
    }

    const oldSectionId = activeUser.courseSections?.[courseId];

    setDb(prev => {
      const section = (prev.courseSections || []).find((s: CourseSection) => s.id === sectionId);
      if (!section || !canPickSection(section)) return prev;

      let updatedSections = prev.courseSections || [];

      if (oldSectionId) {
        updatedSections = updatedSections.map((s: CourseSection) =>
          s.id === oldSectionId ? { ...s, enrolledCount: Math.max(0, s.enrolledCount - 1) } : s
        );
      }

      updatedSections = updatedSections.map((s: CourseSection) =>
        s.id === sectionId ? { ...s, enrolledCount: s.enrolledCount + 1 } : s
      );

      return {
        ...prev,
        courseSections: updatedSections
      };
    });

    const updatedSections = { ...(activeUser.courseSections || {}), [courseId]: sectionId };
    const updatedUser = { ...activeUser, courseSections: updatedSections };
    setCurrentUser(updatedUser);
    safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(updatedUser));

    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u)
    }));
  };

  const requestSectionSwitch = (courseId: string, targetSectionId: string): void => {
    if (activeRole === 'faculty' || activeRole === 'admin') return;
    const currentSectionId = activeUser.courseSections?.[courseId];
    if (currentSectionId === targetSectionId) return;
    const duplicate = (db.enrollmentRequests || []).some(
      (r: EnrollmentRequest) =>
        r.studentId === activeUser.id &&
        r.courseId === courseId &&
        r.type === 'section_switch' &&
        r.targetSectionId === targetSectionId &&
        r.status === 'pending'
    );
    if (duplicate) return;
    const newRequest: EnrollmentRequest = {
      id: `req-${Date.now().toString(36)}`,
      courseId,
      studentId: activeUser.id,
      studentName: activeUser.name,
      type: 'section_switch',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      targetSectionId
    };

    setDb(prev => ({
      ...prev,
      enrollmentRequests: [...(prev.enrollmentRequests || []), newRequest]
    }));
  };

  const getPendingRequestsForCourse = (courseId: string): EnrollmentRequest[] => {
    return (db.enrollmentRequests || []).filter((r: EnrollmentRequest) => r.courseId === courseId && r.status === 'pending');
  };

  const getPendingRequestsForStudent = (): EnrollmentRequest[] => {
    return (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.status === 'pending' && (r.type === 'faculty_enroll' || r.type === 'self_join')
    );
  };

  const requestJoinCourse = (courseId: string): void => {
    if (activeRole === 'faculty' || activeRole === 'admin') return;
    const existing = (db.enrollmentRequests || []).find(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.courseId === courseId
    );
    if (existing) return;
    createEnrollmentRequest(courseId, 'self_join');
  };

  const getMyRequest = (courseId: string): EnrollmentRequest | null => {
    const mine = (db.enrollmentRequests || []).filter(
      (r: EnrollmentRequest) => r.studentId === activeUser.id && r.courseId === courseId
    );
    return mine.length > 0 ? mine[mine.length - 1] : null;
  };

  const getPendingRequests = (courseId: string): EnrollmentRequest[] => {
    return getPendingRequestsForCourse(courseId);
  };

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY_DB);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    setDb(initialMockData as unknown as MockDatabase);
    setCurrentUser(null);
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
        activeCourseId,
        setActiveCourseId,
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
        createAssignment,
        deleteAssignment,
        createModule,
        updateModule,
        deleteModule,
        addModuleItem,
        updateModuleItem,
        deleteModuleItem,
        createQuiz,
        recordQuizSubmission,
        enrollPerson,
        enrollStudentsInCourse,
        createUser,
        updateUser,
        deleteUser,
        joinCourseByCode,
        regenerateCourseJoinCode,
        updateSyllabus,
        updateCourseSyllabus,
        removeCourseSyllabus,
        importCommonsTemplate,
        gradeSubmission,
        submitAssignment,
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
        createNotification,
        getUnreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
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
        createSection,
        updateSection,
        deleteSection,
        getCourseSections,
        getStudentSection,
        createEnrollmentRequest,
        approveEnrollmentRequests,
        rejectEnrollmentRequests,
        studentApproveInvitation,
        studentDeclineInvitation,
        selectSection,
        requestSectionSwitch,
        getPendingRequestsForCourse,
        getPendingRequestsForStudent,
        requestJoinCourse,
        getMyRequest,
        getPendingRequests,
        logHistory,
        clearHistory,
        resetData
      }}
    >
      {children}
      <AlertModal
        isOpen={isAlertOpen}
        options={alertOptions}
        onClose={closeAlert}
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
