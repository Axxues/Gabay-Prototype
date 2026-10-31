import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useLMS } from '../../shared/context/LMSContext';
import { JoinCourseModal } from '../../shared/components/common/JoinCourseModal';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { CoursesSkeleton } from '../../shared/components/common';
import { COURSE_CHILDREN, isVisible, isAssessmentTab, ASSESSMENT_TAB_IDS } from '../../shared/config/navigation';
import { getScopedCourses } from '../../shared/utils/courseScoping';
import { SectionSelectionPage } from './SectionSelectionPage';
import {
  countNewFiles,
  countNewGrades,
  countPendingPeople,
  countStudentAssessmentBadge,
  countFacultyGradingBadge,
  countTotalAssessmentBadge,
  countUpcomingCalendar,
  countUnreadAnnouncements,
  countUnreadMessages,
} from '../../shared/utils/notifiers';


const ModulesView = React.lazy(() => import('../modules').then(m => ({ default: m.ModulesView })));
const SyllabusView = React.lazy(() => import('../syllabus').then(m => ({ default: m.SyllabusView })));
const AssessmentsOverviewView = React.lazy(() => import('../assessments').then(m => ({ default: m.AssessmentsOverviewView })));
const ActivitiesView = React.lazy(() => import('../assessments').then(m => ({ default: m.ActivitiesView })));
const AssignmentsView = React.lazy(() => import('../assessments').then(m => ({ default: m.AssignmentsView })));
const ProjectsView = React.lazy(() => import('../assessments').then(m => ({ default: m.ProjectsView })));
const PresentationsView = React.lazy(() => import('../assessments').then(m => ({ default: m.PresentationsView })));
const QuizzesView = React.lazy(() => import('../assessments').then(m => ({ default: m.QuizzesView })));
const PeopleView = React.lazy(() => import('../people').then(m => ({ default: m.PeopleView })));
const AnnouncementsView = React.lazy(() => import('../inbox').then(m => ({ default: m.AnnouncementsView })));
const FilesView = React.lazy(() => import('../files').then(m => ({ default: m.FilesView })));
const FacultyGradebook = React.lazy(() => import('../assessments').then(m => ({ default: m.FacultyGradebook })));
const StudentGradebook = React.lazy(() => import('../assessments').then(m => ({ default: m.StudentGradebook })));

interface CoursesPageProps {
  initialSubTab?: string;
  initialPeopleTab?: 'pending' | 'roster';
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules', initialPeopleTab }) => {
  const {
    activeCourseId,
    setActiveCourseId,
    hydrateCourse,
    db,
    activeRole,
    activeUser,
    colleges,
    departments,
    getUnreadNotificationCount,
    markTabVisited,
    hasCourseSyllabus
  } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Defense-in-depth: enrollment truth is approved request rows. Fall back
  // to them when activeUser.enrolledCourseIds is stale (e.g. approved on
  // another machine before this session re-hydrated).
  const approvedCourseIds = new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.studentId === activeUser.id && r.status === 'approved')
      .map(r => r.courseId)
  );
  // Scoped courses
  const availableCourses = activeRole === 'staff'
    ? db.courses
    : getScopedCourses({
        courses: db.courses,
        users: db.users,
        activeUser,
        activeRole,
        approvedCourseIds,
        colleges,
        departments,
      });

  const activeCourse = availableCourses.find(c => c.id === activeCourseId) || availableCourses[0];
  const courseHasSyllabus = activeCourse
    ? (hasCourseSyllabus ? hasCourseSyllabus(activeCourse.id) : Boolean(activeCourse.syllabus))
    : false;

  // Student explicitly navigated to a course they are not enrolled in
  // (stale activeCourseId from history/search), or has no enrollments at
  // all (db.courses is scoped to enrolled courses, so availableCourses is
  // empty and activeCourse is undefined -> previously crashed on
  // activeCourse.id with an Application Recovery error).
  // Only show the unenrolled message when the student has zero enrolled
  // courses; otherwise fall back to one of their enrolled courses so the
  // default activeCourseId doesn't block navigation.
  const hasNoEnrollments =
    activeRole === 'student' && availableCourses.length === 0;

  useEffect(() => {
    setSubTab(initialSubTab);
    if (activeCourse) markTabVisited?.(initialSubTab, activeCourse.id);
  }, [initialSubTab, activeCourse?.id]);

  useEffect(() => {
    if (activeCourse && subTab) {
      markTabVisited?.(subTab, activeCourse.id);
    }
  }, [subTab, activeCourse?.id]);

  useEffect(() => {
    if (activeRole === 'student' && subTab === 'pending-requests') {
      setSubTab('modules');
    }
    // Legacy guard: 'pending-requests' was removed as a standalone
    // course sub-tab (now handled inside People). Redirect any stale
    // navigation (history, search) to People instead of a blank view.
    if (subTab === 'pending-requests' && (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin')) {
      setSubTab('people');
    }
  }, [activeRole, subTab]);

  useEffect(() => {
    if (subTab === 'section-selection' && activeCourse) {
      const sections = (db.courseSections || []).filter(s => s.courseId === activeCourse.id);
      if (sections.length === 0) {
        setSubTab('modules');
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', `/courses/${encodeURIComponent(activeCourse.id)}/modules`);
        }
      }
    }
  }, [subTab, activeCourse?.id, db.courseSections]);

  useEffect(() => {
    const recognized = [
      ...COURSE_CHILDREN.map(c => c.id),
      ...ASSESSMENT_TAB_IDS,
      'section-selection'
    ];
    if (subTab && !recognized.includes(subTab as any) && activeCourse) {
      setSubTab('modules');
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', `/courses/${encodeURIComponent(activeCourse.id)}/modules`);
      }
    }
  }, [subTab, activeCourse?.id]);

  useEffect(() => {
    if (activeCourse?.id && typeof hydrateCourse === 'function') {
      void hydrateCourse(activeCourse.id);
    }
  }, [activeCourse?.id, hydrateCourse]);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(() => { void import('../syllabus'); });
    } else {
      setTimeout(() => { void import('../syllabus'); }, 1000);
    }
  }, []);

  const tabBadges = useMemo(() => {
    const badges: Record<string, number> = {};
    if (!activeCourse) return badges;
    const cid = activeCourse.id;
    const visits = activeUser.lastVisitedAt || {};
    for (const tab of COURSE_CHILDREN) {
      if (!isVisible(tab, activeRole)) continue;
      let badgeCount = 0;
      if (tab.id === 'inbox') {
        badgeCount = countUnreadMessages(db.messages, activeUser.id)
          + getUnreadNotificationCount(activeUser.id, 'module_comment_reply')
          + getUnreadNotificationCount(activeUser.id, 'announcement_reply');
      } else if (tab.id === 'modules') {
        badgeCount = getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
      } else if (tab.id === 'announcements') {
        badgeCount = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId: null }, cid, visits);
      } else if (tab.id === 'assessments') {
        badgeCount = countTotalAssessmentBadge({
          activities: db.activities || [],
          quizzes: db.quizzes || [],
          exams: [],
          submissions: db.submissions || [],
          userId: activeUser.id,
          role: activeRole,
          courseId: cid,
        });
      } else if (tab.id === 'activities') {
        const courseActivities = (db.activities || []).filter(a => a.courseId === cid);
        const publishedActivities = courseActivities.filter(a => a.published);
        const publishedIds = [
          ...publishedActivities.filter(a => a.format === 'classic').map(a => a.id),
          ...publishedActivities.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
        ];
        const allIds = [
          ...courseActivities.filter(a => a.format === 'classic').map(a => a.id),
          ...courseActivities.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
        ];
        const courseSubs = db.submissions.filter(s => s.courseId === cid);
        badgeCount = (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin')
          ? countFacultyGradingBadge(courseSubs, allIds)
          : countStudentAssessmentBadge(publishedIds, courseSubs.filter(s => s.studentId === activeUser.id).map(s => s.activityKey ?? ''));
      } else if (tab.id === 'quizzes') {
        badgeCount = (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin')
          ? countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), (db.quizzes || []).filter(q => q.courseId === cid).map(q => `asg-quiz-${q.id}`))
          : (db.quizzes || []).filter(q => q.courseId === cid && q.published && !db.submissions.some(s => s.activityKey === `asg-quiz-${q.id}` && s.studentId === activeUser.id)).length;
      } else if (tab.id === 'files') {
        badgeCount = countNewFiles(db.courseFiles || [], cid, visits, activeUser.id);
      } else if (tab.id === 'grades') {
        badgeCount = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
      } else if (tab.id === 'people') {
        badgeCount = (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? countPendingPeople(db.enrollmentRequests || [], cid, visits) : 0;
      } else if (tab.id === 'calendar') {
        badgeCount = countUpcomingCalendar(db.calendarEvents || [], cid, visits);
      }
      badges[tab.id] = badgeCount;
    }
    return badges;
  }, [activeCourse, activeRole, activeUser, db, getUnreadNotificationCount]);

  if (hasNoEnrollments || !activeCourse) {
    const showJoinAction = activeRole === 'student';
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 p-6 overflow-y-auto bg-background custom-scrollbar">
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title={
              activeRole === 'student'
                ? 'You are not enrolled in this course yet.'
                : 'No courses created yet.'
            }
            body={
              showJoinAction
                ? 'You still haven\u2019t been enrolled in a course. Please ask your instructor for the course join code, then click below to join.'
                : 'No course shells are currently available under this view.'
            }
            actionLabel={showJoinAction ? 'Enter Course Join Code' : undefined}
            onAction={showJoinAction ? () => setIsJoinModalOpen(true) : undefined}
          />
        </main>

        <JoinCourseModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
          onNavigateCourse={(id) => {
            setActiveCourseId(id);
            setSubTab('modules');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {/* Main Content Area */}
      <main className="min-h-0 flex-1 p-6 overflow-y-auto bg-background custom-scrollbar">
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(tab => {
            const badgeCount = tabBadges[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onMouseEnter={() => {
                  if (tab.id === 'syllabus') {
                    void import('../syllabus');
                  }
                }}
                onClick={() => { setSubTab(tab.id); setReturnToTab(null); markTabVisited(tab.id, activeCourse.id); }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer relative ${subTab === tab.id ? 'bg-foreground text-background' : 'bg-card text-muted-foreground border border-border'}`}
              >
                {tab.label}
                {badgeCount > 0 && (
                  <span
                    key={tab.id + '-badge'}
                    className="absolute right-0 top-0 h-4 w-4 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center -translate-half"
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="w-full min-w-0">
        <React.Suspense fallback={<CoursesSkeleton />}>
        {subTab === 'modules' && activeCourse && !courseHasSyllabus && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center" data-testid="modules-syllabus-gate">
            <h3 className="text-sm font-bold text-foreground">Syllabus required for modules</h3>
            <p className="text-xs text-muted-foreground mt-1">Course modules and items are derived from the official course syllabus. {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? 'Upload a syllabus to enable creating modules and items.' : 'Waiting for your instructor to upload the syllabus.'}</p>
            {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') && (
              <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
            )}
          </div>
        )}

        {subTab === 'modules' && activeCourse && courseHasSyllabus && (
          <ModulesView
            courseId={activeCourse.id}
            onSelectActivity={actId => {
              setSelectedActivityId(actId);
              setReturnToTab('modules');
              setSubTab('activities');
            }}
            onSelectQuiz={quizId => {
              setSelectedQuizId(quizId);
              setReturnToTab('modules');
              setSubTab('quizzes');
            }}
            onSelectAssignment={asgId => {
              setSelectedAssignmentId(asgId);
              setReturnToTab('modules');
              setSubTab('assignments');
            }}
            onSelectProject={projId => {
              setSelectedProjectId(projId);
              setReturnToTab('modules');
              setSubTab('projects');
            }}
            onSelectPresentation={presId => {
              setSelectedPresentationId(presId);
              setReturnToTab('modules');
              setSubTab('presentations');
            }}
          />
        )}

        {subTab === 'syllabus' && <SyllabusView courseId={activeCourse.id} />}

        {subTab === 'announcements' && <AnnouncementsView courseId={activeCourse.id} />}

        {isAssessmentTab(subTab) && activeCourse && !courseHasSyllabus && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center" data-testid="assessments-syllabus-gate">
            <h3 className="text-sm font-bold text-foreground">Syllabus required for assessments</h3>
            <p className="text-xs text-muted-foreground mt-1">Course assessments and items are derived from the official course syllabus. {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? 'Upload a syllabus to enable creating assessment items.' : 'Waiting for your instructor to upload the syllabus.'}</p>
            {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') && (
              <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
            )}
          </div>
        )}

        {subTab === 'assessments' && activeCourse && courseHasSyllabus && (
          <AssessmentsOverviewView
            courseId={activeCourse.id}
            onNavigateCategory={(cat, itemId) => {
              if (cat === 'activities') setSelectedActivityId(itemId || null);
              if (cat === 'assignments') setSelectedAssignmentId(itemId || null);
              if (cat === 'projects') setSelectedProjectId(itemId || null);
              if (cat === 'presentations') setSelectedPresentationId(itemId || null);
              if (cat === 'quizzes') setSelectedQuizId(itemId || null);
              setSubTab(cat);
            }}
          />
        )}

        {subTab === 'activities' && activeCourse && courseHasSyllabus && (
          <ActivitiesView
            courseId={activeCourse.id}
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivityId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedActivityId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'assignments' && activeCourse && courseHasSyllabus && (
          <AssignmentsView
            courseId={activeCourse.id}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedAssignmentId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'projects' && activeCourse && courseHasSyllabus && (
          <ProjectsView
            courseId={activeCourse.id}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedProjectId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'presentations' && activeCourse && courseHasSyllabus && (
          <PresentationsView
            courseId={activeCourse.id}
            selectedPresentationId={selectedPresentationId}
            onSelectPresentation={setSelectedPresentationId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedPresentationId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'quizzes' && activeCourse && courseHasSyllabus && (
          <QuizzesView
            courseId={activeCourse.id}
            selectedQuizId={selectedQuizId}
            onSelectQuiz={setSelectedQuizId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedQuizId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'files' && <FilesView courseId={activeCourse.id} />}

        {subTab === 'grades' && activeCourse && !courseHasSyllabus && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center" data-testid="grades-syllabus-gate">
            <h3 className="text-sm font-bold text-foreground">Syllabus required for grades</h3>
            <p className="text-xs text-muted-foreground mt-1">The grading formula lives in the syllabus under Course Requirements &amp; Official Grading Formula. {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? 'Upload a syllabus to enable the gradebook.' : 'Waiting for your instructor to upload the syllabus.'}</p>
            {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') && (
              <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
            )}
          </div>
        )}

        {subTab === 'grades' && activeCourse && courseHasSyllabus && (
          activeRole === 'student' ? (
            <StudentGradebook courseId={activeCourse.id} />
          ) : (
            <FacultyGradebook courseId={activeCourse.id} />
          )
        )}

        {subTab === 'people' && <PeopleView courseId={activeCourse.id} initialTab={initialPeopleTab} />}

        {subTab === 'section-selection' && activeCourse && (
          <SectionSelectionPage
            courseId={activeCourse.id}
            onSectionSelected={() => {
              setSubTab('modules');
              if (typeof window !== 'undefined' && window.history?.replaceState) {
                window.history.replaceState(null, '', `/courses/${encodeURIComponent(activeCourse.id)}/modules`);
              }
            }}
          />
        )}
        </React.Suspense>
        </div>

      </main>

      <JoinCourseModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onNavigateCourse={(id) => {
          setActiveCourseId(id);
          setSubTab('modules');
        }}
      />
    </div>
  );
};
