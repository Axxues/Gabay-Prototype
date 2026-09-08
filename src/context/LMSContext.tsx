import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  User,
  UserRole,
  MockDatabase,
  CalendarEvent,
  Submission,
  Message,
  AdvisingSlot,
  HistoryLog
} from '../types/lms';
import initialMockData from '../data/mockData.json';

interface LMSContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeUser: User;
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
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

  // Actions
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
  sendMessage: (recipientId: string, subject: string, body: string, courseId?: string) => void;
  bookAdvisingSlot: (slotId: string) => void;
  createAdvisingSlot: (date: string, timeSlot: string, location: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  logHistory: (path: string, title: string) => void;
  resetData: () => void;
}

const STORAGE_KEY_DB = 'gabay_lms_db_v1';
const STORAGE_KEY_THEME = 'gabay_theme_v1';
const STORAGE_KEY_ROLE = 'gabay_role_v1';

const LMSContext = createContext<LMSContextType | undefined>(undefined);

export const LMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Database State
  const [db, setDb] = useState<MockDatabase>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DB);
    if (saved) {
      try {
        return JSON.parse(saved) as MockDatabase;
      } catch (e) {
        console.error('Failed to parse saved LMS db', e);
      }
    }
    return initialMockData as unknown as MockDatabase;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(db));
  }, [db]);

  // Active Role State
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROLE) as UserRole;
    return saved && ['admin', 'faculty', 'staff', 'student'].includes(saved) ? saved : 'student';
  });

  const activeUser = db.users.find(u => u.role === activeRole) || db.users[3]; // default student

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
    localStorage.setItem(STORAGE_KEY_ROLE, role);
  };

  // Course state
  const [activeCourseId, setActiveCourseId] = useState<string | null>('crs-cmsc131');

  // UI Drawers & Modals
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

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

  // Actions
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
      return { ...prev, submissions: updatedSubmissions };
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

  const sendMessage = (recipientId: string, subject: string, body: string, courseId?: string) => {
    const recipient = db.users.find(u => u.id === recipientId);
    if (!recipient) return;
    const course = db.courses.find(c => c.id === courseId);

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: activeUser.id,
      senderName: activeUser.name,
      senderRole: activeRole,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      courseId,
      courseCode: course?.code,
      subject,
      body,
      timestamp: new Date().toISOString(),
      read: false
    };

    setDb(prev => ({ ...prev, messages: [newMsg, ...prev.messages] }));
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

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY_DB);
    setDb(initialMockData as unknown as MockDatabase);
  };

  return (
    <LMSContext.Provider
      value={{
        theme,
        toggleTheme,
        activeUser,
        activeRole,
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
        gradeSubmission,
        submitAssignment,
        toggleModulePublish,
        toggleItemCompletion,
        sendMessage,
        bookAdvisingSlot,
        createAdvisingSlot,
        addCalendarEvent,
        logHistory,
        resetData
      }}
    >
      {children}
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
