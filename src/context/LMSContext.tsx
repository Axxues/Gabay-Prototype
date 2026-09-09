import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  User,
  UserRole,
  Course,
  Module,
  ModuleItem,
  Assignment,
  Quiz,
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

  // Real CRUD & Interactive Actions
  createCourse: (course: Partial<Course>) => Course;
  createAssignment: (asg: Partial<Assignment>) => Assignment;
  deleteAssignment: (asgId: string) => void;
  createModule: (courseId: string, title: string) => Module;
  addModuleItem: (moduleId: string, item: Partial<ModuleItem>) => void;
  createQuiz: (quiz: Partial<Quiz>) => Quiz;
  recordQuizSubmission: (quizId: string, studentId: string, score: number, answers: Record<string, string>) => void;
  enrollPerson: (person: Partial<User>, courseId?: string) => void;
  updateSyllabus: (courseId: string, updates: Partial<Course>) => void;
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
  sendMessage: (recipientId: string, subject: string, body: string, courseId?: string) => void;
  bookAdvisingSlot: (slotId: string) => void;
  createAdvisingSlot: (date: string, timeSlot: string, location: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  logHistory: (path: string, title: string) => void;
  clearHistory: () => void;
  resetData: () => void;
}

const STORAGE_KEY_DB = 'gabay_lms_db_v1';
const STORAGE_KEY_THEME = 'gabay_theme_v1';
const STORAGE_KEY_SESSION = 'gabay_auth_session_v1';

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
        const parsed = JSON.parse(saved) as MockDatabase;
        // Keep demo users aligned with latest names
        parsed.users = initialMockData.users as unknown as User[];
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved LMS db', e);
      }
    }
    return initialMockData as unknown as MockDatabase;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(db));
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
        message: 'No account found with this institutional email or ID.' 
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
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(matchedUser));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    setIsUserProfileModalOpen(false);
    setIsRoleModalOpen(false);
  };

  const switchRole = (role: UserRole) => {
    const userWithRole = db.users.find(u => u.role === role);
    if (userWithRole) {
      setCurrentUser(userWithRole);
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(userWithRole));
    }
  };

  // Course state
  const [activeCourseId, setActiveCourseId] = useState<string | null>('crs-cmsc131');

  // UI Drawers & Modals
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

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
    const newCourse: Course = {
      id: `crs-${Date.now().toString(36)}`,
      code: courseData.code || 'CMSC 199',
      title: courseData.title || 'Advanced Computer Science Topics',
      section: courseData.section || 'BSCS 4-1',
      term: courseData.term || '1st Sem AY 2026-2027',
      instructorId: courseData.instructorId || activeUser.id,
      instructorName: courseData.instructorName || activeUser.name,
      published: courseData.published ?? true,
      color: courseData.color || '#be185d',
      enrolledCount: courseData.enrolledCount || 1,
      credits: courseData.credits || 3,
      chedComplianceCode: courseData.chedComplianceCode || 'CMO-25-2015'
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
      items: []
    };

    setDb(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));

    return newModule;
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
      title: person.title || (person.role === 'student' ? 'Enrolled Student' : 'Instructor')
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

  const updateSyllabus = (courseId: string, updates: Partial<Course>) => {
    setDb(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === courseId ? { ...c, ...updates } : c))
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

  const clearHistory = () => {
    setDb(prev => ({
      ...prev,
      historyLogs: []
    }));
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
        createCourse,
        createAssignment,
        deleteAssignment,
        createModule,
        addModuleItem,
        createQuiz,
        recordQuizSubmission,
        enrollPerson,
        updateSyllabus,
        importCommonsTemplate,
        gradeSubmission,
        submitAssignment,
        toggleModulePublish,
        toggleItemCompletion,
        sendMessage,
        bookAdvisingSlot,
        createAdvisingSlot,
        addCalendarEvent,
        logHistory,
        clearHistory,
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
