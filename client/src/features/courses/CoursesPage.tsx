import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Calendar, ChevronDown } from 'lucide-react';
import { useLMS } from '../../shared/context/LMSContext';
import { JoinCourseModal } from '../../shared/components/common/JoinCourseModal';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { PageTransition } from '../../shared/components/common/PageTransition';
import { COURSE_CHILDREN, isVisible } from '../../shared/config/navigation';
import { getScopedCourses } from '../../shared/utils/courseScoping';
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

const CourseSubTabSkeleton: React.FC = () => (
  <div className="flex-1 p-6 space-y-5 animate-pulse" data-testid="course-subtab-skeleton">
    <div className="h-8 w-48 bg-muted rounded-xl" />
    <div className="h-32 bg-card border border-border rounded-2xl" />
    <div className="space-y-3 pt-2">
      <div className="h-16 bg-card border border-border rounded-2xl" />
      <div className="h-16 bg-card border border-border rounded-2xl" />
      <div className="h-16 bg-card border border-border rounded-2xl" />
    </div>
  </div>
);

const ModulesView = React.lazy(() => import('../modules/ModulesView').then(m => ({ default: m.ModulesView })));
const SyllabusView = React.lazy(() => import('../syllabus/SyllabusView').then(m => ({ default: m.SyllabusView })));
const AssessmentsOverviewView = React.lazy(() => import('../assessments/AssessmentsOverviewView').then(m => ({ default: m.AssessmentsOverviewView })));
const ActivitiesView = React.lazy(() => import('../assessments/ActivitiesView').then(m => ({ default: m.ActivitiesView })));
const AssignmentsView = React.lazy(() => import('../assessments/AssignmentsView').then(m => ({ default: m.AssignmentsView })));
const ProjectsView = React.lazy(() => import('../assessments/ProjectsView').then(m => ({ default: m.ProjectsView })));
const PresentationsView = React.lazy(() => import('../assessments/PresentationsView').then(m => ({ default: m.PresentationsView })));
const QuizzesView = React.lazy(() => import('../assessments/QuizzesView').then(m => ({ default: m.QuizzesView })));
const ExamsView = React.lazy(() => import('../assessments/ExamsView').then(m => ({ default: m.ExamsView })));
const PeopleView = React.lazy(() => import('../people/PeopleView').then(m => ({ default: m.PeopleView })));
const AnnouncementsView = React.lazy(() => import('../inbox/AnnouncementsView').then(m => ({ default: m.AnnouncementsView })));
const FilesView = React.lazy(() => import('../files/FilesView').then(m => ({ default: m.FilesView })));
const FacultyGradebook = React.lazy(() => import('../assessments/components/grading/FacultyGradebook').then(m => ({ default: m.FacultyGradebook })));
const StudentGradebook = React.lazy(() => import('../assessments/components/grading/StudentGradebook').then(m => ({ default: m.StudentGradebook })));

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const {
    activeCourseId,
    setActiveCourseId,
    hydrateCourse,
    db,
    activeRole,
    activeUser,
    colleges,
    departments,
    schoolYears,
    getActiveSchoolYearForCollege,
    getSchoolYearsByCollege,
    getUnreadNotificationCount,
    markTabVisited,
    isCourseGradeReady
  } = useLMS();

  // Determine active school year for current college context (defaults to '2025-2026')
  const userCollegeId = activeUser?.collegeId || 'col-ccs';
  const currentActiveSchoolYear = useMemo(() => {
    if (getActiveSchoolYearForCollege) {
      const activeSy = getActiveSchoolYearForCollege(userCollegeId);
      if (activeSy?.year) return activeSy.year;
    }
    const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : [];
    const active = list.find(sy => sy.isActive);
    return active?.year || '2025-2026';
  }, [getActiveSchoolYearForCollege, getSchoolYearsByCollege, userCollegeId]);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(() => currentActiveSchoolYear);

  // Sync selectedSchoolYear if currentActiveSchoolYear changes and user hasn't chosen a past year
  useEffect(() => {
    if (!selectedSchoolYear) {
      setSelectedSchoolYear(currentActiveSchoolYear);
    }
  }, [currentActiveSchoolYear, selectedSchoolYear]);

  const [isSchoolYearDropdownOpen, setIsSchoolYearDropdownOpen] = useState(false);
  const [subTab, setSubTab] = useState(initialSubTab);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Defense-in-depth: enrollment truth is approved request rows. Fall back
  // to them when activeUser.enrolledCourseIds is stale (e.g. approved on
  // another machine before this session re-hydrated).
  const approvedCourseIds = new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.studentId === activeUser.id && r.status === 'approved')
      .map(r => r.courseId)
  );
  const allScopedCourses = activeRole === 'staff'
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

  // Filter scoped courses by selectedSchoolYear
  const availableCourses = useMemo(() => {
    if (selectedSchoolYear === 'all') {
      return allScopedCourses;
    }
    return allScopedCourses.filter(c => {
      const courseYear = c.schoolYear || '2025-2026';
      return courseYear === selectedSchoolYear;
    });
  }, [allScopedCourses, selectedSchoolYear]);

  // Distinct school years for selector dropdown
  const availableSchoolYears = useMemo(() => {
    const years = new Set<string>();
    // Add collegiate school years
    const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : (schoolYears || []);
    list.forEach(sy => {
      if (sy.year) years.add(sy.year.trim());
    });
    // Add distinct years from courses
    allScopedCourses.forEach(c => {
      if (c.schoolYear) {
        years.add(c.schoolYear.trim());
      } else {
        years.add('2025-2026');
      }
    });
    years.add('2025-2026');
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [getSchoolYearsByCollege, userCollegeId, schoolYears, allScopedCourses]);

  const activeCourse = availableCourses.find(c => c.id === activeCourseId) || availableCourses[0];

  // If the activeCourseId does not match the chosen school year, update activeCourseId
  useEffect(() => {
    if (availableCourses.length > 0) {
      const match = availableCourses.some(c => c.id === activeCourseId);
      if (!match) {
        setActiveCourseId(availableCourses[0].id);
      }
    }
  }, [availableCourses, activeCourseId, setActiveCourseId]);

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
    if (activeCourse) markTabVisited(initialSubTab, activeCourse.id);
  }, [initialSubTab]);

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
    if (activeCourse?.id && typeof hydrateCourse === 'function') {
      void hydrateCourse(activeCourse.id);
    }
  }, [activeCourse?.id, hydrateCourse]);

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
        badgeCount = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId: null }, cid);
      } else if (tab.id === 'assessments') {
        badgeCount = countTotalAssessmentBadge({
          activities: db.activities || [],
          quizzes: db.quizzes || [],
          exams: db.exams || [],
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
        badgeCount = countNewFiles(db.courseFiles || [], cid, visits);
      } else if (tab.id === 'grades') {
        badgeCount = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
      } else if (tab.id === 'people') {
        badgeCount = (activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? countPendingPeople(db.enrollmentRequests || [], cid) : 0;
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
                : 'You have not created any courses yet. Please create a course from the Dashboard.'
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

  const syDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (syDropdownRef.current && !syDropdownRef.current.contains(e.target as Node)) {
        setIsSchoolYearDropdownOpen(false);
      }
    };
    if (isSchoolYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSchoolYearDropdownOpen]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {/* Main Content Area */}
      <main className="min-h-0 flex-1 p-6 overflow-y-auto bg-background custom-scrollbar">
        {/* School Year Scoping & Course Navigation Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3.5 bg-card border border-border/80 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Academic Scope
                </span>
                <span className="text-xs font-extrabold text-foreground">
                  {selectedSchoolYear === 'all' ? 'All Academic Years' : `AY ${selectedSchoolYear}`}
                </span>
              </div>
            </div>

            {/* School Year Dropdown Selector */}
            <div className="relative ml-2" ref={syDropdownRef}>
              <button
                type="button"
                data-testid="courses-school-year-filter"
                onClick={() => setIsSchoolYearDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-muted/60 border border-border rounded-xl text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
              >
                <span>{selectedSchoolYear === 'all' ? 'All School Years' : selectedSchoolYear}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSchoolYearDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSchoolYearDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-elevated z-30 p-1.5 animate-scale-in">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchoolYear('all');
                      setIsSchoolYearDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedSchoolYear === 'all' ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <span>All School Years</span>
                  </button>
                  {availableSchoolYears.map(yr => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedSchoolYear(yr);
                        setIsSchoolYearDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        selectedSchoolYear === yr ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <span>{yr}</span>
                      {yr === currentActiveSchoolYear && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          Current
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Course Selector Strip / Active Course Badge in Header */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block shrink-0">Courses:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {availableCourses.map(c => {
                const isActive = c.id === activeCourse.id;
                const cYear = c.schoolYear || '2025-2026';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCourseId(c.id)}
                    className={`px-3 py-1 text-xs rounded-xl font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-foreground text-background border-foreground shadow-2xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <span>{c.code}</span>
                    <span className="opacity-80 font-normal truncate max-w-[140px]">{c.title}</span>
                    <span className="text-[10px] opacity-70">({cYear})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(tab => {
            const badgeCount = tabBadges[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
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
        <PageTransition pageKey={`${subTab}:${activeCourse.id}`} className="w-full min-w-0">
        <React.Suspense fallback={<CourseSubTabSkeleton />}>
        {subTab === 'modules' && (
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
          />
        )}

        {subTab === 'syllabus' && <SyllabusView courseId={activeCourse.id} />}

        {subTab === 'announcements' && <AnnouncementsView courseId={activeCourse.id} />}

        {subTab === 'assessments' && (
          <AssessmentsOverviewView
            courseId={activeCourse.id}
            onNavigateCategory={(cat, itemId) => {
              if (cat === 'activities') setSelectedActivityId(itemId || null);
              if (cat === 'assignments') setSelectedAssignmentId(itemId || null);
              if (cat === 'projects') setSelectedProjectId(itemId || null);
              if (cat === 'presentations') setSelectedPresentationId(itemId || null);
              if (cat === 'quizzes') setSelectedQuizId(itemId || null);
              if (cat === 'exams') setSelectedExamId(itemId || null);
              setSubTab(cat);
            }}
          />
        )}

        {subTab === 'activities' && (
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

        {subTab === 'assignments' && (
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

        {subTab === 'projects' && (
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

        {subTab === 'presentations' && (
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

        {subTab === 'quizzes' && (
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

        {subTab === 'exams' && (
          <ExamsView
            courseId={activeCourse.id}
            selectedExamId={selectedExamId}
            onSelectExam={setSelectedExamId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedExamId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'files' && <FilesView courseId={activeCourse.id} />}

        {subTab === 'grades' && activeCourse && !isCourseGradeReady(activeCourse.id) && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center" data-testid="grades-syllabus-gate">
            <h3 className="text-sm font-bold text-foreground">Syllabus required for grades</h3>
            <p className="text-xs text-muted-foreground mt-1">The grading formula lives in the syllabus under Course Requirements &amp; Official Grading Formula. {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') ? 'Upload a syllabus to enable the gradebook.' : 'Waiting for your instructor to upload the syllabus.'}</p>
            {(activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin') && (
              <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
            )}
          </div>
        )}
        {subTab === 'grades' && activeCourse && isCourseGradeReady(activeCourse.id) && (
          activeRole === 'student' ? (
            <StudentGradebook courseId={activeCourse.id} />
          ) : (
            <FacultyGradebook courseId={activeCourse.id} onGoToSyllabus={() => setSubTab('syllabus')} />
          )
        )}

        {subTab === 'people' && <PeopleView courseId={activeCourse.id} />}

        </React.Suspense>
        </PageTransition>

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
