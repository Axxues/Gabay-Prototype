import React, { useMemo } from 'react';
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
  exams: <QuizIcon className="h-4 w-4" />,
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
}) => {
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
    map['announcements'] = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId }, cid);
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
    if (activeRole === 'faculty' || activeRole === 'admin') {
      const ids = (db.exams || []).filter((e: any) => e.courseId === cid).map((e: any) => `asg-exam-${e.id}`);
      map['exams'] = countFacultyGradingBadge(db.submissions.filter((s: any) => s.courseId === cid), ids);
    } else {
      const pub = (db.exams || []).filter((e: any) => e.courseId === cid && e.published).map((e: any) => e.id);
      const taken = db.submissions.filter((s: any) => s.courseId === cid && s.studentId === activeUser.id && (s.activityKey ?? '').startsWith('asg-exam-')).map((s: any) => (s.activityKey ?? '').replace('asg-exam-', ''));
      const submitted = new Set(taken);
      map['exams'] = pub.filter((id: any) => !submitted.has(id)).length;
    }
    map['files'] = countNewFiles(db.courseFiles || [], cid, visits);
    map['grades'] = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
    map['people'] = (activeRole === 'faculty' || activeRole === 'admin') ? (db.enrollmentRequests || []).filter((r: any) => r.courseId === cid && r.status === 'pending').length : 0;
    map['pending-requests'] = map['people'];
    map['calendar'] = countUpcomingCalendar(db.calendarEvents || [], cid, visits);
    return map;
  }, [course, activeUser, activeRole, db, getUnreadNotificationCount]);

  const courseBadgeFor = (tabId: string): number => courseBadges[tabId] ?? 0;

  if (!course) {
    return (
      <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
          {lmsNav}
        </div>
        <div className="px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; courses</div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
        {lmsNav}
        <div className="mx-1 my-2 border-t border-border" />
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Course Navigation</div>
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
                            onClick={() => onSelectCourseTab(subItem.id)}
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
                onClick={() => onSelectCourseTab(item.id)}
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
      <div className="px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; courses &gt; {courseSubTab}</div>
    </aside>
  );
};

export const LMSContextPanel: React.FC<{ currentTab: string; courseSubTab: string; onNavigateTab: (t: string) => void; onSelectCourseTab: (t: string) => void; onNavigateCourse: (id: string, sub?: string) => void }> = React.memo((p) => {
  const { db, activeCourseId, activeRole, activeUser, colleges, departments, getUnreadNotificationCount } = useLMS();

  // LMS navigations (Dashboard, Courses, Calendar, Inbox, History, Help) belong
  // to the Learning Management section only — hide the whole context panel on
  // top-level pages outside it (Page 1/2/3, Manage College Accounts).
  if (!isLmsSectionTab(p.currentTab)) return null;

  const unread = (db.messages || []).filter(m => m.recipientId === activeUser.id && !m.read).length;

  // Enrollment truth is approved request rows, falling back to enrolledCourseIds when stale.
  const approvedCourseIds = useMemo(() => new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.studentId === activeUser.id && r.status === 'approved')
      .map(r => r.courseId)
  ), [db.enrollmentRequests, activeUser.id]);

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

  const hasNoCourses = visibleCourses.length === 0;

  const lmsNav = (
    <>
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Learning Management</div>
      <nav className="space-y-1">
        {LMS_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => (
          <button key={item.id} type="button" onClick={() => p.onNavigateTab(item.id)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition-all duration-150 ${p.currentTab === item.id ? 'bg-primary text-primary-foreground shadow-primary-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'}`}>
            <span className="flex items-center gap-2.5">{LMS_ICONS[item.id]}<span>{item.label}</span></span>
            {item.id === 'inbox' && unread > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
        ))}
      </nav>
    </>
  );

  if (p.currentTab === 'courses') {
    // When there are no courses yet (e.g. unenrolled students, faculty without created courses),
    // show LMS nav only — no Course Navigation header, join code, or course sub-tabs.
    if (hasNoCourses) {
      return (
        <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
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
      />
    );
  }
  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
      {lmsNav}
      <div className="mt-auto px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; {p.currentTab}</div>
    </aside>
  );
});
