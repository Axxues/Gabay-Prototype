import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { EnrollmentRequest } from '../../shared/types/lms';
import { getDisplaySectionName } from '../../shared/utils/sections';
import { resolveDirectusAssetUrl } from '../../shared/utils/avatar';
import { getScopedCourses } from '../../shared/utils/courseScoping';
import { JoinCourseModal } from '../../shared/components/common/JoinCourseModal';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { CustomDropdown } from '../../shared/components/common/CustomDropdown';
import {
  BookOpen,
  Clock,
  Award,
  ArrowRight,
  Megaphone,
  Folder,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Pencil,
  Loader2,
  UploadCloud,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building,
  Layers,
  Lock,
  GraduationCap
} from 'lucide-react';
import { isChairRole, isDeanRole, isFacultyRole, canManageCourseContent, canDeleteCourse } from '../../shared/utils/roles';
import { courseMatchesProgram } from '../../shared/utils/courseScoping';
import { useProcessing } from '../../shared/hooks/useProcessing';
import { useModalAnimate } from '../../shared/hooks/useModalAnimate';
import { normalizeAssignedSemester } from '../courses/utils/chairSheetParser';

const SEMESTER_FILTERS = [
  { value: 'all', label: 'All Semesters' },
  { value: 'First', label: 'First Semester' },
  { value: 'Second', label: 'Second Semester' },
  { value: 'Mid-Year', label: 'Mid-Year' },
] as const;

// Parse starting calendar year from string (e.g. "2025-2026" -> 2025)
const parseStartYear = (sy: string): number => {
  const match = sy.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
};

interface DashboardPageProps {
  onNavigateCourse: (courseId: string, subTab?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateCourse,
  onNavigateTab
}) => {
  const {
    activeRole,
    activeUser,
    db,
    colleges,
    departments,
    isLoading,
    getPendingRequestsForStudent,
    studentApproveInvitation,
    studentDeclineInvitation,
    deleteCourse,
    showConfirm,
    showAlert,
    getApprovedRequestsForCourse,
    schoolYears,
    getSchoolYearsByCollege,
    getActiveSchoolYearForCollege,
    getBaselineSchoolYear
  } = useLMS();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCodeCourseId, setCopiedCodeCourseId] = useState<string | null>(null);
  const { isProcessing, run } = useProcessing();
  const pendingInvitations = getPendingRequestsForStudent();
  const facultyInvites = pendingInvitations.filter(req => req.type === 'faculty_enroll');
  const selfJoinRequests = pendingInvitations.filter(req => req.type === 'self_join');
  const switchRequests = pendingInvitations.filter(req => req.type === 'section_switch');

  // Filter courses based on user role (approved requests are the
  // enrollment truth — fall back to them when enrolledCourseIds is stale).
  const approvedCourseIds = useMemo(() => new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.studentId === activeUser.id && r.status === 'approved')
      .map(r => r.courseId)
  ), [db.enrollmentRequests, activeUser.id]);

  const isDean = isDeanRole(activeUser, activeRole);
  const isChair = isChairRole(activeUser, activeRole);
  const isAdmin =
    (activeRole === 'admin' ||
      activeRole === 'superadmin' ||
      activeUser?.adminSubrole === 'chancellor') &&
    !isDean &&
    !isChair;

  const effectiveDeanCollegeId = useMemo(() => {
    if (!isDean) return undefined;
    return (
      activeUser?.collegeId ||
      colleges?.find(
        c =>
          c.deanId === activeUser?.id ||
          (activeUser?.collegeName &&
            c.name?.toLowerCase() === activeUser.collegeName.toLowerCase())
      )?.id
    );
  }, [isDean, activeUser, colleges]);

  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');

  /**
   * Admins may switch colleges freely; deans are fixed to their home college
   * (role-separation design §2). Every scoping read uses this derived value so a
   * dean can never drift outside their jurisdiction, even from stale state.
   */
  const scopedCollegeId = isDean ? (effectiveDeanCollegeId || '') : selectedCollegeId;

  const deanCollege = useMemo(() => {
    if (!effectiveDeanCollegeId) return undefined;
    return (colleges || []).find(c => c.id === effectiveDeanCollegeId);
  }, [colleges, effectiveDeanCollegeId]);

  const chairDept = useMemo(() => {
    if (!isChair) return undefined;
    return (departments || []).find(
      d =>
        d.chairpersonId === activeUser?.id ||
        (activeUser?.department &&
          (d.name.toLowerCase() === activeUser.department.toLowerCase() ||
            d.id === activeUser.department ||
            d.code.toLowerCase() === activeUser.department.toLowerCase())) ||
        (activeUser?.program &&
          (d.name.toLowerCase() === activeUser.program.toLowerCase() ||
            d.id === activeUser.program ||
            d.code.toLowerCase() === activeUser.program.toLowerCase()))
    );
  }, [isChair, activeUser, departments]);

  const availablePrograms = useMemo(() => {
    if (isDean || isAdmin) {
      if (scopedCollegeId === 'all') {
        return (departments || []).filter(d => d && d.name && d.name !== 'null');
      }
      return (departments || []).filter(d => d && d.collegeId === scopedCollegeId && d.name && d.name !== 'null');
    }
    return [];
  }, [isDean, isAdmin, scopedCollegeId, departments]);

  const userCollegeId = useMemo(() => {
    if (scopedCollegeId && scopedCollegeId !== 'all') return scopedCollegeId;
    if (isDean && effectiveDeanCollegeId) return effectiveDeanCollegeId;
    if (isChair && chairDept?.collegeId) return chairDept.collegeId;
    if (activeUser?.collegeId) return activeUser.collegeId;
    if (activeUser?.department && departments) {
      const match = departments.find(
        d =>
          d.id === activeUser.department ||
          d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.code?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.chairpersonId === activeUser.id
      );
      if (match?.collegeId) return match.collegeId;
    }
    if (colleges) {
      const deanMatch = colleges.find(
        c =>
          c.deanId === activeUser?.id ||
          (activeUser?.collegeName && c.name?.toLowerCase() === activeUser.collegeName.toLowerCase())
      );
      if (deanMatch?.id) return deanMatch.id;
    }
    return 'col-ccs';
  }, [scopedCollegeId, isDean, isChair, effectiveDeanCollegeId, chairDept, activeUser, departments, colleges]);

  const baseMonitoredCourses = useMemo(() => getScopedCourses({
    courses: db.courses,
    users: db.users,
    activeUser,
    activeRole,
    approvedCourseIds,
    colleges,
    departments,
    // College selection is an admin-only control; deans are pinned to their
    // home college by the scoping utility.
    selectedCollegeId: isAdmin ? scopedCollegeId : undefined,
    selectedProgramId: 'all',
  }), [db.courses, db.users, activeUser, activeRole, approvedCourseIds, colleges, departments, isAdmin, scopedCollegeId]);

  const currentActiveSchoolYear = useMemo(() => {
    // 1. If a specific college is selected (by Admin or Dean), use that college's active school year
    if (scopedCollegeId && scopedCollegeId !== 'all') {
      const activeSy = getActiveSchoolYearForCollege?.(scopedCollegeId);
      if (activeSy?.year) return activeSy.year;
    }

    // 2. If user is Dean or Chair or Faculty with an assigned college, check their college
    if (!isAdmin && userCollegeId) {
      const activeSy = getActiveSchoolYearForCollege?.(userCollegeId);
      if (activeSy?.year) return activeSy.year;
      const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : [];
      const active = list.find(sy => sy.isActive);
      if (active?.year) return active.year;
    }

    // 3. For Admin (University-Wide) or when looking across all colleges:
    // If courses exist, default to the latest year where courses are present
    const courseYears = baseMonitoredCourses
      .map(c => c.schoolYear || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0])
      .filter(Boolean) as string[];
    if (courseYears.length > 0) {
      courseYears.sort((a, b) => parseStartYear(b) - parseStartYear(a));
      return courseYears[0];
    }

    // 4. Check if any college has an active school year that is newer
    if (colleges && colleges.length > 0 && getActiveSchoolYearForCollege) {
      const collegeActiveYears = colleges
        .map(col => getActiveSchoolYearForCollege(col.id)?.year)
        .filter(Boolean) as string[];
      if (collegeActiveYears.length > 0) {
        collegeActiveYears.sort((a, b) => parseStartYear(b) - parseStartYear(a));
        return collegeActiveYears[0];
      }
    }

    // 5. University baseline school year
    const baseline = getBaselineSchoolYear ? getBaselineSchoolYear() : undefined;
    if (baseline?.year) return baseline.year;

    // 6. User college fallback
    if (getActiveSchoolYearForCollege) {
      const activeSy = getActiveSchoolYearForCollege(userCollegeId);
      if (activeSy?.year) return activeSy.year;
    }

    return '2025-2026';
  }, [
    scopedCollegeId,
    getActiveSchoolYearForCollege,
    isAdmin,
    userCollegeId,
    getSchoolYearsByCollege,
    baseMonitoredCourses,
    colleges,
    getBaselineSchoolYear,
  ]);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(() => currentActiveSchoolYear);
  const [isScopeCollapsed, setIsScopeCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('gabay_academic_scope_collapsed') === 'true' ||
        localStorage.getItem('gabay_academic_scope_hidden') === 'true'
      );
    }
    return false;
  });

  const handleCollapseScope = () => {
    setIsScopeCollapsed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gabay_academic_scope_collapsed', 'true');
      localStorage.setItem('gabay_academic_scope_hidden', 'true');
    }
  };

  const { isClosing: isScopeClosing, startClose: startCollapseScope } = useModalAnimate(handleCollapseScope, 200);

  const handleExpandScope = () => {
    setIsScopeCollapsed(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gabay_academic_scope_collapsed', 'false');
      localStorage.setItem('gabay_academic_scope_hidden', 'false');
    }
  };

  const prevActiveSYRef = useRef(currentActiveSchoolYear);
  useEffect(() => {
    if (prevActiveSYRef.current !== currentActiveSchoolYear) {
      prevActiveSYRef.current = currentActiveSchoolYear;
      setSelectedSchoolYear(currentActiveSchoolYear);
    } else if (!selectedSchoolYear) {
      setSelectedSchoolYear(currentActiveSchoolYear);
    }
  }, [currentActiveSchoolYear, selectedSchoolYear]);

  const currentStartYear = useMemo(() => parseStartYear(currentActiveSchoolYear), [currentActiveSchoolYear]);

  const baselineSchoolYear = useMemo(() => {
    return getBaselineSchoolYear ? getBaselineSchoolYear() : undefined;
  }, [getBaselineSchoolYear]);

  const baselineYear = baselineSchoolYear?.year?.trim();

  const isBaselineDifferent = Boolean(
    baselineYear &&
    currentActiveSchoolYear &&
    baselineYear.toLowerCase() !== currentActiveSchoolYear.trim().toLowerCase()
  );

  // Distinct school years for the horizontal scrollable wheel:
  // Sorted ascending starting with the current active school year first, then future (disabled) / historical
  // Or: sorted in chronological order with current active school year at the start of the view
  const availableSchoolYears = useMemo(() => {
    const years = new Set<string>();
    const list = isAdmin
      ? (schoolYears || [])
      : (getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : (schoolYears || []));
    list.forEach(sy => {
      if (sy.year) years.add(sy.year.trim());
    });
    baseMonitoredCourses.forEach(c => {
      const y = c.schoolYear || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0];
      if (y) {
        years.add(y.trim());
      } else {
        years.add('2025-2026');
      }
    });
    (colleges || []).forEach(col => {
      const activeSy = getActiveSchoolYearForCollege?.(col.id);
      if (activeSy?.year) years.add(activeSy.year.trim());
    });
    years.add('2025-2026');
    if (baselineYear) {
      years.add(baselineYear);
    }

    // Sort ascending by year number:
    // With current active school year pinned as the start of the list, followed by past/other years in ascending order,
    // and any future years at the end (disabled).
    const arr = Array.from(years);
    const nonCurrent = arr.filter(y => y !== currentActiveSchoolYear).sort((a, b) => {
      return parseStartYear(a) - parseStartYear(b);
    });
    return [currentActiveSchoolYear, ...nonCurrent];
  }, [isAdmin, getSchoolYearsByCollege, userCollegeId, schoolYears, baseMonitoredCourses, colleges, getActiveSchoolYearForCollege, currentActiveSchoolYear, baselineYear]);

  const wheelTrackRef = useRef<HTMLDivElement>(null);

  const scrollWheel = (direction: 'left' | 'right') => {
    if (wheelTrackRef.current) {
      const scrollAmount = 140;
      wheelTrackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const baseMonitoredCoursesInYear = useMemo(() => {
    const activeYearToFilter = selectedSchoolYear || currentActiveSchoolYear;
    return baseMonitoredCourses.filter(c => {
      const courseYear = c.schoolYear || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0] || '2025-2026';
      return courseYear === activeYearToFilter;
    });
  }, [baseMonitoredCourses, selectedSchoolYear, currentActiveSchoolYear]);

  const programCourseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dept of availablePrograms) {
      counts[dept.id] = baseMonitoredCoursesInYear.filter(c =>
        courseMatchesProgram(c, dept, db.users)
      ).length;
    }
    return counts;
  }, [availablePrograms, baseMonitoredCoursesInYear, db.users]);

  const [selectedSemester, setSelectedSemester] = useState<string>('all');

  // Filter courses by selected school year and selected program tab
  const programFilteredCourses = useMemo(() => {
    if ((isDean || isAdmin) && selectedProgramId !== 'all') {
      const targetDept = (departments || []).find(d => d.id === selectedProgramId);
      if (targetDept) {
        return baseMonitoredCoursesInYear.filter(c =>
          courseMatchesProgram(c, targetDept, db.users)
        );
      }
    }
    return baseMonitoredCoursesInYear;
  }, [isDean, isAdmin, selectedProgramId, departments, baseMonitoredCoursesInYear, db.users]);

  // Semester course counts
  const semesterCourseCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: programFilteredCourses.length,
      First: 0,
      Second: 0,
      'Mid-Year': 0,
    };
    programFilteredCourses.forEach(c => {
      const sem = normalizeAssignedSemester(c.semester || c.term);
      if (counts[sem] !== undefined) {
        counts[sem]++;
      }
    });
    return counts;
  }, [programFilteredCourses]);

  // Filter courses by selected semester
  const filteredCourses = useMemo(() => {
    if (selectedSemester === 'all') {
      return programFilteredCourses;
    }
    return programFilteredCourses.filter(c => {
      const sem = normalizeAssignedSemester(c.semester || c.term);
      return sem === selectedSemester;
    });
  }, [programFilteredCourses, selectedSemester]);

  const [coursePage, setCoursePage] = useState(1);
  const COURSES_PER_PAGE = 12;
  const totalCoursePages = useMemo(() => Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE)), [filteredCourses.length]);
  const paginatedCourses = useMemo(() => filteredCourses.slice((coursePage - 1) * COURSES_PER_PAGE, coursePage * COURSES_PER_PAGE), [filteredCourses, coursePage]);

  // Reset page when school year, program tab, or semester changes
  useEffect(() => {
    setCoursePage(1);
  }, [selectedSchoolYear, selectedProgramId, selectedSemester]);

  useEffect(() => {
    setSelectedProgramId('all');
    setCoursePage(1);
  }, [scopedCollegeId]);

  // Pending rows can reference courses outside the cached (enrolled-only)
  // list — prefer the live cache, fall back to the server snapshot, and
  // never render a bare "—".
  const requestCourseLabel = (req: EnrollmentRequest): string => {
    const course = db.courses.find(c => c.id === req.courseId);
    const code = course?.code ?? req.courseCode ?? undefined;
    const title = course?.title ?? req.courseTitle ?? undefined;
    if (code || title) return `${code ?? ''}${code && title ? ' — ' : ''}${title ?? ''}`;
    return 'Pending course request';
  };

  const todoItems = useMemo(() => {
    const publishedActivities = (db.activities || []).filter(a => a.published);
    return [
      ...publishedActivities.filter(a => a.format === 'classic').map(act => ({
        id: act.id,
        courseId: act.courseId,
        title: act.title,
        category: act.category || 'Activity',
        pointsLabel: `${act.pointsPossible} pts`,
        dueDate: act.dueDate,
        submitted: db.submissions.some(s => s.activityKey === act.id && s.studentId === activeUser.id)
      })),
      ...publishedActivities.filter(a => a.format !== 'classic').map(a => ({
        id: a.id,
        courseId: a.courseId,
        title: a.title,
        category: 'Question Set',
        pointsLabel: `${a.pointsPossible} pts`,
        dueDate: a.dueDate,
        submitted: db.submissions.some(s => s.activityKey === `asg-activity-${a.id}` && s.studentId === activeUser.id)
      }))
    ];
  }, [db.activities, db.submissions, activeUser.id]);
  const hasRightSidebar = activeRole === 'student';

  // Dynamic Instructor Name Resolution
  const getCourseInstructorName = (course: (typeof db.courses)[0]) => {
    if (isFacultyRole(activeUser, activeRole) && (course.instructorId === activeUser.id || !course.instructorId)) {
      return activeUser.name;
    }
    const instructor = db.users.find(u => u.id === course.instructorId);
    if (instructor) return instructor.name;
    return course.instructorName || (isFacultyRole(activeUser, activeRole) ? activeUser.name : 'Unassigned Faculty');
  };

  // Dynamic Enrolled Students Count Resolution
  // Same roster truth as the gradebook/People page: approved enrollment
  // requests plus cached course lists. Never the drift-prone enrolledCount
  // counter, and no wildcard for students missing enrolledCourseIds.
  const getCourseStudentCount = (course: (typeof db.courses)[0]) => {
    const approvedIds = new Set(
      (db.enrollmentRequests || [])
        .filter(r => r.courseId === course.id && r.status === 'approved')
        .map(r => r.studentId)
    );
    return db.users.filter(u =>
      u.role === 'student' &&
      ((u.enrolledCourseIds || []).includes(course.id) || approvedIds.has(u.id))
    ).length;
  };

  // Faculty delete flow: strong confirmation when students are enrolled or
  // content exists, simple confirm for empty shells.
  // Student count comes from approved enrollment requests (server truth),
  // not the drift-prone local enrolledCount counter.
  const handleDeleteCourse = async (courseId: string) => {
    const course = db.courses.find(c => c.id === courseId);
    if (!course || (!canDeleteCourse(activeUser, activeRole) && !canManageCourseContent(course, activeUser))) return;
    let studentCount: number | null = null;
    try {
      studentCount = (await getApprovedRequestsForCourse(courseId)).length;
    } catch {
      studentCount = null;
    }
    const contentCount =
      db.modules.filter(m => m.courseId === courseId).length +
      (db.activities || []).filter(a => a.courseId === courseId).length +
      (db.quizzes || []).filter(q => q.courseId === courseId).length;
    const doDelete = () => {
      void run(`delete:${courseId}`, async () => {
        try {
          await deleteCourse(courseId);
          showAlert({
            title: 'Course Deleted',
            message: `"${course.code} — ${course.title}" has been permanently deleted.`,
            type: 'success'
          });
        } catch {
          // deleteCourse already surfaces the error via showAlert.
        }
      });
    };
    // Unknown count (fetch failed) takes the strong confirmation path —
    // the safe direction.
    if ((studentCount ?? 1) > 0 || contentCount > 0) {
      const studentPhrase = studentCount === null
        ? 'enrolled students'
        : `${studentCount} enrolled student(s)`;
      showAlert({
        title: 'Delete Course Permanently?',
        message: `"${course.code} — ${course.title}" has ${studentPhrase} and ${contentCount} content item(s). Deleting will permanently remove the course, all its modules, activities, quizzes, files, grades, and student enrollments. This cannot be undone.`,
        type: 'confirm',
        confirmText: 'Delete Permanently',
        cancelText: 'Keep Course',
        onConfirm: doDelete
      });
    } else {
      showConfirm(
        `Are you sure you want to permanently delete "${course.code} — ${course.title}"? This cannot be undone.`,
        doDelete,
        'Delete Course'
      );
    }
  };

  const pageHeaderProps = useMemo(() => {
    if (isChair) {
      return {
        title: 'Program Course Monitoring',
        description: chairDept
          ? `Monitoring academic course offerings for ${chairDept.name}`
          : 'Monitoring program courses under your jurisdiction',
      };
    }
    if (isDean) {
      // Deans have a fixed, college-wide jurisdiction (role-separation design §2).
      return {
        title: 'Collegiate Course Monitoring',
        description: `Monitoring academic course offerings for ${deanCollege?.name || 'your collegiate jurisdiction'}`,
      };
    }
    if (isAdmin) {
      return {
        title: 'University Course Monitoring',
        description: 'Monitor academic course offerings across all university colleges and degree programs',
      };
    }
    if (activeRole === 'faculty') {
      return {
        title: 'My Teaching Courses',
        description: 'Your assigned teaching course shells',
      };
    }
    return {
      title: 'My courses',
      description: 'Your enrolled course shells',
    };
  }, [isChair, isDean, isAdmin, activeRole, chairDept, deanCollege]);

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-8">
      {/* Main Grid Section */}
      <div className={hasRightSidebar ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-6"}>
        {/* Left Pane: Enrolled Course Cards */}
        <div className={hasRightSidebar ? "lg:col-span-2 space-y-4 relative" : "space-y-4 relative"}>
          {/* Header & Minimized Academic Scope Anchor */}
          <div className="relative">
            <PageHeader
              title={pageHeaderProps.title}
              description={pageHeaderProps.description}
              actions={
                <>
                  {activeRole === 'student' && (
                    <button
                      type="button"
                      onClick={() => setIsJoinModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Join course</span>
                    </button>
                  )}
                  {isChair && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('assigned-courses')}
                      className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload Assigned Courses</span>
                    </button>
                  )}
                  <span className="text-xs font-sans text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border tabular-nums">
                    {filteredCourses.length} courses
                  </span>
                </>
              }
            />

            {/* Minimized Academic Scope: Centered vertically on the header's bottom divider line */}
            {isScopeCollapsed && (
              <div className="absolute -left-5 sm:-left-8 lg:-left-10 top-full -translate-y-1/2 z-20">
                <div className="animate-slide-in-left">
                  <button
                    type="button"
                    onClick={handleExpandScope}
                    title={`Show Academic Scope (AY ${selectedSchoolYear || currentActiveSchoolYear})`}
                    aria-label="Show Academic Scope"
                    className="group relative flex items-center gap-1.5 pl-2.5 sm:pl-3 pr-2 py-2 bg-card hover:bg-muted/80 text-foreground border-y border-r border-border/80 rounded-r-xl shadow-xs transition-all cursor-pointer hover:shadow-sm hover:translate-x-1"
                  >
                    <span className="sr-only">Academic Scope</span>
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Option 1: Jurisdiction & Program Filters */}
          {(isDean || isAdmin) && (
            <div data-testid="course-monitoring-controls" className="p-4 bg-card border border-border/80 rounded-2xl shadow-xs space-y-3">
              {/* College Selector (Admin) / Fixed College Badge (Dean) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {isDean ? 'College Jurisdiction:' : 'University College:'}
                  </span>
                </div>
                {isDean ? (
                  // Deans are fixed to their home college; switching colleges is
                  // an admin-only capability (role-separation design §2).
                  <span
                    data-testid="dean-college-badge"
                    title="Your college jurisdiction is fixed"
                    className="inline-flex items-center gap-2 min-w-[220px] sm:max-w-xs px-3 py-2.5 text-xs font-bold text-foreground bg-muted/50 border border-border rounded-xl"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {deanCollege
                        ? `${deanCollege.name} (${deanCollege.code || 'COL'})`
                        : 'No college assigned'}
                    </span>
                  </span>
                ) : (
                  <CustomDropdown
                    value={selectedCollegeId}
                    onChange={(val) => {
                      setSelectedCollegeId(val);
                      setSelectedProgramId('all');
                    }}
                    testId="college-scope-selector"
                    searchable
                    placeholder="All Colleges (University-Wide)"
                    className="min-w-[220px] sm:max-w-xs"
                    options={[
                      { value: 'all', label: 'All Colleges (University-Wide)' },
                      ...(colleges || [])
                        .filter(col => col && col.name && typeof col.name === 'string' && col.name.trim() && col.name !== 'null' && col.name.toLowerCase() !== 'null')
                        .map((col) => ({
                          value: col.id,
                          label: `${col.name} (${col.code || 'COL'})`,
                        })),
                    ]}
                  />
                )}
              </div>

              {/* Horizontal Program Tabs with Live Counts */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" data-testid="program-tabs-container">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Programs:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProgramId('all')}
                  data-testid="program-tab-all"
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    selectedProgramId === 'all'
                      ? 'bg-foreground text-background border-foreground shadow-2xs'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <span>All Programs</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${
                      selectedProgramId === 'all'
                        ? 'bg-background/20 text-background border-transparent'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {baseMonitoredCoursesInYear.length}
                  </span>
                </button>

                {availablePrograms.map((dept) => {
                  const isSelected = selectedProgramId === dept.id;
                  const count = programCourseCounts[dept.id] || 0;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedProgramId(dept.id)}
                      data-testid={`program-tab-${dept.id}`}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground shadow-2xs'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <span>{dept.code || dept.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${
                          isSelected
                            ? 'bg-background/20 text-background border-transparent'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chair Jurisdiction Badge */}
          {isChair && (
            <div data-testid="chair-jurisdiction-banner" className="flex items-center justify-between p-3.5 bg-card border border-border/80 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Program Jurisdiction
                  </span>
                  <span className="text-xs font-extrabold text-foreground">
                    {chairDept?.name || activeUser?.department || activeUser?.program || 'Academic Program'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border tabular-nums">
                  {filteredCourses.length} courses
                </span>
              </div>
            </div>
          )}

          {/* Academic Scope Card: Expanded */}
          {!isScopeCollapsed && (
            <div
              className={`flex flex-col gap-3 p-3.5 bg-card border border-border/80 rounded-2xl shadow-xs transition-all ${
                isScopeClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startCollapseScope()}
                    title="Hide Academic Scope"
                    aria-label="Hide Academic Scope"
                    className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Academic Scope
                    </span>
                    <span className="text-xs font-extrabold text-foreground">
                      AY {selectedSchoolYear || currentActiveSchoolYear}
                    </span>
                  </div>
                </div>

                {/* Horizontal Scrollable Wheel Track */}
                <div className="relative flex items-center min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => scrollWheel('left')}
                    aria-label="Scroll years left"
                    className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0 mr-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div
                    ref={wheelTrackRef}
                    data-testid="academic-scope-wheel"
                    className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {availableSchoolYears.map((yr) => {
                      const isSelected = (selectedSchoolYear || currentActiveSchoolYear) === yr;
                      const isCurrent = yr === currentActiveSchoolYear;
                      const isBaseline = Boolean(
                        isBaselineDifferent &&
                        baselineYear &&
                        yr.trim().toLowerCase() === baselineYear.toLowerCase()
                      );
                      const baselineStartYear = parseStartYear(baselineYear || '');
                      const hasCoursesInYr = baseMonitoredCourses.some(
                        c => (c.schoolYear || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0] || '2025-2026') === yr
                      );
                      const isCollegeActiveYr = (colleges || []).some(
                        col => getActiveSchoolYearForCollege?.(col.id)?.year === yr
                      );
                      const maxActiveStartYear = Math.max(
                        currentStartYear,
                        baselineStartYear,
                        ...baseMonitoredCourses.map(c => parseStartYear(c.schoolYear || c.term?.match(/\b\d{4}-\d{4}\b/)?.[0] || '')),
                        ...(colleges || []).map(col => parseStartYear(getActiveSchoolYearForCollege?.(col.id)?.year || ''))
                      );
                      const isFuture = !isBaseline && !hasCoursesInYr && !isCollegeActiveYr && parseStartYear(yr) > maxActiveStartYear;

                      if (isFuture) {
                        return (
                          <button
                            key={yr}
                            type="button"
                            disabled
                            aria-disabled="true"
                            title="Future academic year cannot be navigated yet"
                            className="px-3 py-1.5 text-xs rounded-xl font-bold border flex items-center gap-1.5 whitespace-nowrap shrink-0 opacity-40 bg-muted/30 text-muted-foreground/60 border-border/40 cursor-not-allowed select-none"
                          >
                            <span>AY {yr}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded font-semibold border bg-muted/50 text-muted-foreground/60 border-border/40">
                              Upcoming
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedSchoolYear(yr)}
                          title={
                            isCurrent
                              ? `Current Academic Year (AY ${yr})`
                              : isBaseline
                              ? `University Baseline Academic Year (AY ${yr})`
                              : `Academic Year (AY ${yr})`
                          }
                          className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-foreground text-background border-foreground shadow-2xs'
                              : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <span>AY {yr}</span>
                          {isCurrent && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-semibold border ${
                                isSelected
                                  ? 'bg-background/20 text-background border-transparent'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              Current
                            </span>
                          )}
                          {isBaseline && (
                            <span
                              data-testid="academic-scope-baseline-badge"
                              className={`text-[9px] px-1 py-0.2 rounded font-semibold border ${
                                isSelected
                                  ? 'bg-background/20 text-background border-transparent'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              Baseline
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollWheel('right')}
                    aria-label="Scroll years right"
                    className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0 ml-1 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal Semester Filter Tabs */}
              <div
                data-testid="semester-filter-container"
                className="flex items-center gap-1.5 pt-2.5 border-t border-border/60 overflow-x-auto no-scrollbar py-0.5"
              >
                <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground mr-1 shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>Semester:</span>
                </div>
                {SEMESTER_FILTERS.map((sem) => {
                  const isSelected = selectedSemester === sem.value;
                  const count = semesterCourseCounts[sem.value] ?? 0;
                  return (
                    <button
                      key={sem.value}
                      type="button"
                      onClick={() => setSelectedSemester(sem.value)}
                      data-testid={`semester-tab-${sem.value}`}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground shadow-2xs'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <span>{sem.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${
                          isSelected
                            ? 'bg-background/20 text-background border-transparent'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State or Course Cards Grid */}
          {isLoading && filteredCourses.length === 0 ? (
            <div data-testid="dashboard-courses-loading" className={`grid gap-5 ${hasRightSidebar ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`} aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`dashboard-courses-skeleton-${i}`} className="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden flex flex-col justify-between animate-pulse">
                  <div>
                    <div className="h-20 p-4 flex flex-col justify-between bg-muted/40 border-b border-border/40">
                      <div className="h-5 w-36 rounded-full bg-muted/70" />
                      <div className="h-5 w-4/5 rounded-md bg-muted" />
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-16 rounded bg-muted/50" />
                          <div className="h-3.5 w-28 rounded bg-muted" />
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-16 rounded bg-muted/50" />
                          <div className="h-3.5 w-20 rounded bg-muted" />
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
                          <div className="h-3 w-16 rounded bg-muted/50" />
                          <div className="h-4 w-10 rounded bg-muted/70" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-muted/60" />
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-muted/40" />
                      <div className="h-6 w-6 rounded-lg bg-muted/40" />
                      <div className="h-6 w-6 rounded-lg bg-muted/40" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={
                baseMonitoredCourses.length === 0
                  ? "No enrolled courses"
                  : selectedSemester !== 'all'
                  ? `No courses for ${selectedSemester} Semester`
                  : "No courses in this academic year"
              }
              body={
                baseMonitoredCourses.length === 0
                  ? (activeRole === 'student'
                      ? 'You are not enrolled in any courses yet. Ask your faculty instructor for the course join code and click below to enter your code.'
                      : (isDean || isChair || isAdmin)
                      ? 'No courses are currently available under your monitoring jurisdiction.'
                      : 'No course shells assigned to your account.')
                  : selectedSemester !== 'all'
                  ? `You do not have any courses for ${selectedSemester} Semester in AY ${selectedSchoolYear || currentActiveSchoolYear}. Select another semester or academic year.`
                  : `You do not have any courses for AY ${selectedSchoolYear || currentActiveSchoolYear}. Select another academic year from above.`
              }
              actionLabel={baseMonitoredCourses.length === 0 && activeRole === 'student' ? 'Enter course join code' : undefined}
              onAction={baseMonitoredCourses.length === 0 && activeRole === 'student' ? () => setIsJoinModalOpen(true) : undefined}
            />
          ) : (
            <div className={`grid gap-5 ${hasRightSidebar ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {paginatedCourses.map(course => {
              const deleting = isProcessing(`delete:${course.id}`);
              return (
              <div
                key={course.id}
                onClick={() => { if (!deleting) onNavigateCourse(course.id, 'modules'); }}
                aria-busy={deleting || undefined}
                className={`group relative bg-card text-card-foreground border border-border rounded-2xl overflow-hidden hover:ring-1 hover:ring-primary/15 flex flex-col justify-between ${deleting ? 'opacity-60 pointer-events-none cursor-wait' : 'cursor-pointer'}`}
              >
                {deleting && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-card/70 backdrop-blur-[1px]">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">Deleting…</span>
                  </div>
                )}
                <div>
                  {/* Card Color Header */}
                  <div
                    className="h-20 p-4 flex flex-col justify-between relative overflow-hidden bg-muted/50"
                    style={
                      course.color
                        ? {
                            backgroundColor: `${course.color}14`,
                            boxShadow: `0 12px 32px -12px color-mix(in srgb, ${course.color} 45%, transparent), inset 0 -28px 36px -24px color-mix(in srgb, ${course.color} 55%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {course.image && (
                      <img
                        src={resolveDirectusAssetUrl(course.image, { width: 640, quality: 80, format: 'webp' }) || course.image}
                        alt={course.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                      />
                    )}
                    {course.image && course.color && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(180deg, transparent 25%, color-mix(in srgb, ${course.color} 34%, transparent) 100%)`,
                        }}
                      />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <span className="px-2.5 py-0.5 text-[10px] font-sans font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                        {course.code} • {getDisplaySectionName(course, (db.courseSections || []).filter(s => s.courseId === course.id))}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-[14px] leading-tight truncate relative z-10">
                      {course.title}
                    </h3>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Instructor</span>
                        <span className="font-semibold text-foreground">{getCourseInstructorName(course)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground font-sans text-[12px]">
                        <span>Enrollment</span>
                        <span className="text-foreground font-semibold tabular-nums">
                          {getCourseStudentCount(course)} {getCourseStudentCount(course) === 1 ? 'student' : 'students'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground font-sans text-[12px] pt-1.5 border-t border-border/50">
                        <span className="flex items-center space-x-1">
                          <KeyRound className="w-3 h-3 text-muted-foreground" />
                          <span>Join code</span>
                        </span>
                        {(() => {
                          const effectiveJoinCode = course.joinCode || (course as any).join_code || '';
                          return (
                            <div className="flex items-center space-x-1">
                              <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border text-[10px]">
                                {effectiveJoinCode || 'N/A'}
                              </span>
                              {effectiveJoinCode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(effectiveJoinCode);
                                    setCopiedCodeCourseId(course.id);
                                    setTimeout(() => setCopiedCodeCourseId(null), 2000);
                                  }}
                                  className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Copy Join Code"
                                >
                                  {copiedCodeCourseId === course.id ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs group-hover:bg-muted/60 transition-colors">
                  <span className="font-semibold text-foreground flex items-center space-x-1.5">
                    <span>View modules</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                  </span>

                  {/* Quick Action Icons */}
                  <div
                    className="flex items-center space-x-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Announcements"
                      onClick={() => onNavigateCourse(course.id, 'announcements')}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-card rounded-lg transition-colors cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Course Files"
                      onClick={() => onNavigateCourse(course.id, 'files')}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-card rounded-lg transition-colors cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                    {canManageCourseContent(course, activeUser) && (
                      <button
                        type="button"
                        title="Edit Course"
                        onClick={() => onNavigateCourse(course.id, 'edit')}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-card rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteCourse(activeUser, activeRole) && (
                      <button
                        type="button"
                        title={deleting ? 'Deleting course…' : 'Delete Course'}
                        onClick={() => handleDeleteCourse(course.id)}
                        disabled={deleting}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                      >
                        {deleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          )}

          {totalCoursePages > 1 && (
            <div className="flex items-center justify-between pt-3 px-1 border-t border-border/60">
              <span className="text-xs text-muted-foreground font-medium">
                Showing {(coursePage - 1) * COURSES_PER_PAGE + 1}–{Math.min(coursePage * COURSES_PER_PAGE, filteredCourses.length)} of {filteredCourses.length} courses
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCoursePage(p => Math.max(1, p - 1))}
                  disabled={coursePage === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-card hover:bg-muted disabled:opacity-40 rounded-xl border border-border cursor-pointer transition-all"
                >
                  Previous
                </button>
                <span className="text-xs font-semibold px-2">
                  {coursePage} / {totalCoursePages}
                </span>
                <button
                  type="button"
                  onClick={() => setCoursePage(p => Math.min(totalCoursePages, p + 1))}
                  disabled={coursePage === totalCoursePages}
                  className="px-3 py-1.5 text-xs font-semibold bg-card hover:bg-muted disabled:opacity-40 rounded-xl border border-border cursor-pointer transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Widgets */}
        {hasRightSidebar && (
          <div className="space-y-6">
            {/* STUDENT WIDGETS */}
          {activeRole === 'student' && (
            <>
              {/* Pending Invitations Card */}
              {activeRole === 'student' && pendingInvitations.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" /> {facultyInvites.length > 0 ? 'Pending invitations' : 'Pending requests'}
                  </h3>
                  {facultyInvites.map(req => {
                    const course = db.courses.find(c => c.id === req.courseId);
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{requestCourseLabel(req)}</div>
                          <div className="text-[11px] text-muted-foreground">Invited by {course?.instructorName}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              void run(`accept:${req.id}`, async () => {
                                const ok = await studentApproveInvitation(req.id);
                                if (ok) onNavigateCourse(req.courseId, 'section-selection');
                              });
                            }}
                            disabled={isProcessing(`accept:${req.id}`) || isProcessing(`decline:${req.id}`)}
                            className="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1"
                          >
                            {isProcessing(`accept:${req.id}`) && <Loader2 className="w-3 h-3 animate-spin" />}
                            {isProcessing(`accept:${req.id}`) ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => {
                              void run(`decline:${req.id}`, () => studentDeclineInvitation(req.id));
                            }}
                            disabled={isProcessing(`accept:${req.id}`) || isProcessing(`decline:${req.id}`)}
                            className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1"
                          >
                            {isProcessing(`decline:${req.id}`) && <Loader2 className="w-3 h-3 animate-spin" />}
                            {isProcessing(`decline:${req.id}`) ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {selfJoinRequests.map(req => {
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{requestCourseLabel(req)}</div>
                          <div className="text-[11px] text-muted-foreground">Request sent — waiting for instructor approval</div>
                        </div>
                        <button
                          onClick={() => {
                            void run(`withdraw:${req.id}`, () => studentDeclineInvitation(req.id));
                          }}
                          disabled={isProcessing(`withdraw:${req.id}`)}
                          className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1"
                        >
                          {isProcessing(`withdraw:${req.id}`) && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isProcessing(`withdraw:${req.id}`) ? 'Withdrawing...' : 'Withdraw request'}
                        </button>
                      </div>
                    );
                  })}
                  {switchRequests.map(req => {
                    const targetName = (db.courseSections || []).find(s => s.id === req.targetSectionId)?.name;
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{requestCourseLabel(req)}</div>
                          <div className="text-[11px] text-muted-foreground">Switch pending{targetName ? ` → ${targetName}` : ''}</div>
                        </div>
                        <button
                          onClick={() => {
                            void run(`withdraw:${req.id}`, () => studentDeclineInvitation(req.id));
                          }}
                          disabled={isProcessing(`withdraw:${req.id}`)}
                          className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1"
                        >
                          {isProcessing(`withdraw:${req.id}`) && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isProcessing(`withdraw:${req.id}`) ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* To-Do List Card */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>To-do list</span>
                  </h3>
                  <span className="text-[11px] font-sans font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border tabular-nums">
                    {todoItems.length} pending
                  </span>
                </div>

                <div className="space-y-2.5">
                  {todoItems.map(item => {
                    return (
                      <div
                        key={item.id}
                        onClick={() => onNavigateCourse(item.courseId, 'activities')}
                        className="p-3.5 bg-muted/50 rounded-xl border border-border hover:ring-1 hover:ring-primary/15 cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-[14px] font-semibold text-foreground leading-tight">
                            {item.title}
                          </h4>
                          {item.submitted ? (
                            <span className="px-2 py-0.5 text-[11px] font-sans font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                              Submitted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] font-sans font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                              Due soon
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[12px] font-sans text-muted-foreground">
                          <span>{item.category} • {item.pointsLabel}</span>
                          <span>Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Alerts Card */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span>Recent feedback</span>
                  </h3>
                </div>

                <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Lab 1: Full-Stack SPA</span>
                    <span className="font-sans font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">96/100</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "Great work on the lab activity! Code is clean and well structured."
                  </p>
                  <div className="text-[10px] font-sans text-muted-foreground pt-1 border-t border-emerald-500/20">
                    Graded by {db.users.find(u => isFacultyRole(u, u.role))?.name || (isFacultyRole(activeUser, activeRole) ? activeUser.name : 'Faculty Instructor')}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>

    <JoinCourseModal
      isOpen={isJoinModalOpen}
      onClose={() => setIsJoinModalOpen(false)}
      onNavigateCourse={onNavigateCourse}
    />
  </div>
  );
};
