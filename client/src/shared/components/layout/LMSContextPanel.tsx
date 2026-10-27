import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Inbox,
  History,
  HelpCircle,
  Layers,
  FileText,
  Megaphone,
  FileCheck2,
  HelpCircle as QuizIcon,
  Folder,
  Award,
  Users,
  Copy,
  Check,
  ClipboardList,
  Briefcase,
  Presentation,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import type { UserRole } from '../../types/lms';
import {
  LMS_CHILDREN,
  COURSE_CHILDREN,
  ASSESSMENT_SUB_ITEMS,
  isAssessmentTab,
  isVisible,
  isLmsSectionTab,
} from '../../config/navigation';
import { getScopedCourses } from '../../utils/courseScoping';
import {
  countFacultyGradingBadge,
  countNewFiles,
  countNewGrades,
  countUpcomingCalendar,
  countUnreadAnnouncements,
  countAssessmentCategoryBadge,
  countTotalAssessmentBadge,
  countPendingPeople,
} from '../../utils/notifiers';
import { getDisplaySectionName } from '../../utils/sections';
const LMS_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />, courses: <BookOpen className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />, inbox: <Inbox className="h-4 w-4" />,
  history: <History className="h-4 w-4" />, help: <HelpCircle className="h-4 w-4" />,
};
const COURSE_ICONS: Record<string, React.ReactNode> = {
  modules: <Layers className="h-4 w-4" />,
  syllabus: <FileText className="h-4 w-4" />,
  announcements: <Megaphone className="h-4 w-4" />,
  assessments: <ClipboardList className="h-4 w-4" />,
  activities: <FileCheck2 className="h-4 w-4" />,
  quizzes: <QuizIcon className="h-4 w-4" />,
  assignments: <FileText className="h-4 w-4" />,
  projects: <Briefcase className="h-4 w-4" />,
  presentations: <Presentation className="h-4 w-4" />,
  files: <Folder className="h-4 w-4" />,
  grades: <Award className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
  'pending-requests': <Users className="h-4 w-4" />,
};

interface CourseNavigationPanelProps {
  courseSubTab: string;
  onSelectCourseTab: (t: string) => void;
  lmsNav: React.ReactNode;
  visibleCourses: any[];
  activeCourseId: string | null;
  activeRole: UserRole;
  activeUser: any;
  db: any;
  getUnreadNotificationCount: (userId: string, type: any) => number;
  minimizeButton?: React.ReactNode;
  isMinimized?: boolean;
}

const CourseNavigationPanel: React.FC<CourseNavigationPanelProps> = ({
  courseSubTab,
  onSelectCourseTab,
  lmsNav,
  visibleCourses,
  activeCourseId,
  activeRole,
  activeUser,
  db,
  getUnreadNotificationCount,
  minimizeButton,
  isMinimized,
}) => {
  const { markTabVisited } = useLMS();
  const [copied, setCopied] = React.useState(false);
  const [prevCourseSubTab, setPrevCourseSubTab] = React.useState(courseSubTab);
  const [isAssessmentsOpen, setIsAssessmentsOpen] = React.useState(() => isAssessmentTab(courseSubTab));

  if (prevCourseSubTab !== courseSubTab) {
    setPrevCourseSubTab(courseSubTab);
    if (isAssessmentTab(courseSubTab)) {
      setIsAssessmentsOpen(true);
    }
  }

  const course = visibleCourses.find(c => c.id === activeCourseId) ?? visibleCourses[0];
  const sectionsForCourse = course ? (db.courseSections || []).filter((s: any) => s.courseId === course.id) : [];
  const studentSection = activeRole === 'student' && activeCourseId
    ? (db.courseSections || []).find((s: any) => s.id === activeUser.courseSections?.[activeCourseId])
    : null;
  const displaySection = (studentSection?.name || (course ? getDisplaySectionName(course, sectionsForCourse) : '')).trim();

  const courseBadges = useMemo(() => {
    const map: Record<string, number> = {};
    if (!course) return map;
    const cid = course.id;
    const visits = activeUser.lastVisitedAt || {};
    map['inbox'] = 0;
    map['modules'] = getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
    const sectionId = activeUser.courseSections?.[cid] ?? null;
    map['announcements'] = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId }, cid, visits);
    map['assessments'] = countTotalAssessmentBadge({
      activities: db.activities || [],
      quizzes: db.quizzes || [],
      exams: db.exams || [],
      submissions: db.submissions || [],
      userId: activeUser.id,
      role: activeRole,
      courseId: cid,
    });
    for (const cat of ['activity', 'assignment', 'project', 'presentation'] as const) {
      const tabId = cat === 'activity' ? 'activities' : cat === 'assignment' ? 'assignments' : cat === 'project' ? 'projects' : 'presentations';
      map[tabId] = countAssessmentCategoryBadge(
        db.activities || [],
        db.submissions || [],
        cat,
        activeUser.id,
        activeRole,
        cid
      );
    }
    if (activeRole === 'faculty' || activeRole === 'admin') {
      const ids = (db.quizzes || []).filter((q: any) => q.courseId === cid).map((q: any) => `asg-quiz-${q.id}`);
      map['quizzes'] = countFacultyGradingBadge(db.submissions.filter((s: any) => s.courseId === cid), ids);
    } else {
      const pub = (db.quizzes || []).filter((q: any) => q.courseId === cid && q.published).map((q: any) => q.id);
      const taken = db.submissions.filter((s: any) => s.courseId === cid && s.studentId === activeUser.id && (s.activityKey ?? '').startsWith('asg-quiz-')).map((s: any) => (s.activityKey ?? '').replace('asg-quiz-', ''));
      const submitted = new Set(taken);
      map['quizzes'] = pub.filter((id: any) => !submitted.has(id)).length;
    }
    map['files'] = countNewFiles(db.courseFiles || [], cid, visits, activeUser.id);
    map['grades'] = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
    map['people'] = (activeRole === 'faculty' || activeRole === 'admin') ? countPendingPeople(db.enrollmentRequests || [], cid, visits) : 0;
    map['pending-requests'] = map['people'];
    map['calendar'] = countUpcomingCalendar(db.calendarEvents || [], cid, visits);
    return map;
  }, [course, activeUser, activeRole, db, getUnreadNotificationCount]);

  const courseBadgeFor = (tabId: string): number => courseBadges[tabId] ?? 0;

  if (isMinimized) {
    return (
      <aside
        data-testid="lms-context-panel"
        aria-label="Course navigation"
        className="relative flex w-[60px] flex-shrink-0 flex-col items-center border-r border-border/60 bg-card/50 py-3 px-2 transition-[width] duration-200"
      >
        {minimizeButton}
        <div className="custom-scrollbar mt-8 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto no-scrollbar">
          {lmsNav}
          {course && (
            <>
              <div className="my-2 w-6 border-t border-border" />
              <div
                title={`${course.code} - ${course.title}`}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shadow-xs shrink-0 cursor-default"
                style={{ backgroundColor: course.color ?? '#64748b' }}
              >
                {course.code?.slice(0, 2) ?? 'C'}
              </div>
              <nav className="flex flex-col items-center gap-1.5 mt-1">
                {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => {
                  const isActive = courseSubTab === item.id || (item.id === 'assessments' && isAssessmentTab(courseSubTab));
                  const badge = courseBadgeFor(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      onClick={() => {
                        if (course) markTabVisited?.(item.id, course.id);
                        onSelectCourseTab(item.id);
                      }}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-primary-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {COURSE_ICONS[item.id]}
                      {badge > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </>
          )}
        </div>
      </aside>
    );
  }

  if (!course) {
    return (
      <aside className="relative flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3 transition-[width] duration-200">
        {minimizeButton}
        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
          {lmsNav}
        </div>
        <div className="px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; courses</div>
      </aside>
    );
  }

  return (
    <aside className="relative flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3 transition-[width] duration-200">
      {minimizeButton}
      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
        {lmsNav}
        <div className="mx-1 my-2 border-t border-border" />
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Course Navigation</div>
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
          <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: course?.color ?? '#64748b' }} />
          <div className="min-w-0"><div className="truncate text-xs font-extrabold">{course?.code}</div><div className="truncate text-[11px] text-muted-foreground">{course?.title}</div>
            {displaySection && (
              <div className="truncate text-[10px] text-primary font-bold mt-0.5">
                Section {displaySection}
              </div>
            )}</div>
        </div>
        {course?.joinCode && <button type="button" onClick={() => { try { navigator.clipboard.writeText(course.joinCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 font-mono text-[11px] font-bold cursor-pointer">{course.joinCode}{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}</button>}
        <nav className="space-y-1">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => {
            if (item.id === 'assessments') {
              const isParentActive = isAssessmentTab(courseSubTab);
              const totalBadge = courseBadgeFor('assessments');

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssessmentsOpen(prev => !prev);
                      if (course) markTabVisited?.('assessments', course.id);
                      onSelectCourseTab('assessments');
                    }}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition-all duration-150 ${
                      courseSubTab === 'assessments'
                        ? 'bg-primary text-primary-foreground shadow-primary-sm'
                        : isParentActive
                        ? 'bg-accent/70 text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {COURSE_ICONS[item.id]}
                      <span>{item.label}</span>
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {!isAssessmentsOpen && totalBadge > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {totalBadge}
                        </span>
                      )}
                      {isAssessmentsOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isAssessmentsOpen && (
                    <div className="ml-3 pl-2 border-l border-border/70 space-y-1 py-0.5">
                      {ASSESSMENT_SUB_ITEMS.map(subItem => {
                        const isSubActive = courseSubTab === subItem.id;
                        const subBadge = courseBadgeFor(subItem.id);

                        return (
                          <button
                            key={subItem.id}
                            type="button"
                            onClick={() => {
                            if (course) markTabVisited?.(subItem.id, course.id);
                            onSelectCourseTab(subItem.id);
                          }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer transition-all duration-150 ${
                              isSubActive
                                ? 'bg-primary text-primary-foreground shadow-primary-sm'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              {COURSE_ICONS[subItem.id]}
                              <span className="truncate">{subItem.label}</span>
                            </span>
                            {subBadge > 0 && (
                              <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                                {subBadge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                if (course) markTabVisited?.(item.id, course.id);
                onSelectCourseTab(item.id);
              }}
                className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition-all duration-150 ${
                  courseSubTab === item.id
                    ? 'bg-primary text-primary-foreground shadow-primary-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {COURSE_ICONS[item.id]}
                  <span>{item.label}</span>
                </span>
                {(() => {
                  const n = courseBadgeFor(item.id);
                  return n > 0 ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {n}
                    </span>
                  ) : null;
                })()}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export const LMSContextPanel: React.FC<{ currentTab: string; courseSubTab: string; onNavigateTab: (t: string) => void; onSelectCourseTab: (t: string) => void; onNavigateCourse: (id: string, sub?: string) => void }> = React.memo((p) => {
  const { db, activeCourseId, activeRole, activeUser, colleges, departments, getUnreadNotificationCount } = useLMS();

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gabay_lms_nav_minimized') === 'true';
    }
    return false;
  });

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('gabay_lms_nav_minimized', String(next));
      }
      return next;
    });
  };

  // Enrollment truth is approved request rows, falling back to enrolledCourseIds when stale.
  const approvedCourseIds = useMemo(() => new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.studentId === activeUser?.id && r.status === 'approved')
      .map(r => r.courseId)
  ), [db.enrollmentRequests, activeUser?.id]);

  const visibleCourses = useMemo(() => (
    activeRole === 'staff'
      ? (db.courses || [])
      : getScopedCourses({
          courses: db.courses || [],
          users: db.users || [],
          activeUser,
          activeRole,
          approvedCourseIds,
          colleges: colleges || [],
          departments: departments || [],
        })
  ), [activeRole, db.courses, db.users, activeUser, approvedCourseIds, colleges, departments]);

  // LMS navigations (Dashboard, Courses, Calendar, Inbox, History, Help) belong
  // to the Learning Management section only — hide the whole context panel on
  // top-level pages outside it (Page 1/2/3, Manage College Accounts).
  if (!isLmsSectionTab(p.currentTab)) return null;

  const minimizeButton = (
    <button
      type="button"
      onClick={toggleMinimized}
      title={isMinimized ? 'Expand Learning Management navigation' : 'Minimize Learning Management navigation'}
      aria-label={isMinimized ? 'Expand Learning Management navigation' : 'Minimize Learning Management navigation'}
      className="absolute -right-3.5 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground transition-all cursor-pointer"
    >
      {isMinimized ? (
        <PanelLeftOpen className="h-3.5 w-3.5" />
      ) : (
        <PanelLeftClose className="h-3.5 w-3.5" />
      )}
    </button>
  );

  const unread = (db.messages || []).filter(m => m.recipientId === activeUser?.id && !m.read).length;
  const hasNoCourses = visibleCourses.length === 0;

  const lmsNav = (
    <>
      {!isMinimized && (
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Learning Management</div>
      )}
      <nav className={isMinimized ? "flex flex-col items-center gap-1.5" : "space-y-1"}>
        {LMS_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => {
          const isActive = p.currentTab === item.id;
          if (isMinimized) {
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => p.onNavigateTab(item.id)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-primary-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {LMS_ICONS[item.id]}
                {item.id === 'inbox' && unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => p.onNavigateTab(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition-all duration-150 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-primary-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {LMS_ICONS[item.id]}
                <span>{item.label}</span>
              </span>
              {item.id === 'inbox' && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );

  if (p.currentTab === 'courses') {
    // When there are no courses yet (e.g. unenrolled students, faculty without created courses),
    // show LMS nav only — no Course Navigation header, join code, or course sub-tabs.
    if (hasNoCourses) {
      if (isMinimized) {
        return (
          <aside
            data-testid="lms-context-panel"
            aria-label="Learning Management navigation"
            className="relative flex w-[60px] flex-shrink-0 flex-col items-center border-r border-border/60 bg-card/50 py-3 px-2 transition-[width] duration-200"
          >
            {minimizeButton}
            <div className="mt-8 flex flex-col items-center">
              {lmsNav}
            </div>
          </aside>
        );
      }

      return (
        <aside className="relative flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3 transition-[width] duration-200">
          {minimizeButton}
          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
            {lmsNav}
          </div>
          <div className="px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; courses</div>
        </aside>
      );
    }

    return (
      <CourseNavigationPanel
        courseSubTab={p.courseSubTab}
        onSelectCourseTab={p.onSelectCourseTab}
        lmsNav={lmsNav}
        visibleCourses={visibleCourses}
        activeCourseId={activeCourseId}
        activeRole={activeRole}
        activeUser={activeUser}
        db={db}
        getUnreadNotificationCount={getUnreadNotificationCount}
        minimizeButton={minimizeButton}
        isMinimized={isMinimized}
      />
    );
  }

  if (isMinimized) {
    return (
      <aside
        data-testid="lms-context-panel"
        aria-label="Learning Management navigation"
        className="relative flex w-[60px] flex-shrink-0 flex-col items-center border-r border-border/60 bg-card/50 py-3 px-2 transition-[width] duration-200"
      >
        {minimizeButton}
        <div className="mt-8 flex flex-col items-center">
          {lmsNav}
        </div>
      </aside>
    );
  }

  return (
    <aside className="relative flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3 transition-[width] duration-200">
      {minimizeButton}
      {lmsNav}
      <div className="mt-auto px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; {p.currentTab}</div>
    </aside>
  );
});
