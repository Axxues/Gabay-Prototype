import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import {
  Building,
  ChevronRight,
  ArrowLeft,
  Users,
  BookOpen,
  GraduationCap,
  Layers,
  ShieldAlert,
  AlertCircle,
  UserCheck,
  FolderTree,
} from 'lucide-react';

interface DepartmentDetailsPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const DepartmentDetailsPage: React.FC<DepartmentDetailsPageProps> = ({ onNavigateTab }) => {
  const navigate = useNavigate();
  const { deptId } = useParams<{ deptId: string }>();

  const {
    colleges,
    departments,
    db,
    activeRole,
    activeUser,
    transferLeadership,
    showAlert,
  } = useLMS();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'faculty' | 'courses' | 'students'>('faculty');

  // Leadership handover modal state
  const [isAppointModalOpen, setIsAppointModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [isSubmittingLeader, setIsSubmittingLeader] = useState(false);

  // Department and College resolution
  const dept = useMemo(() => {
    return (departments || []).find(d => d.id === deptId);
  }, [departments, deptId]);

  const college = useMemo(() => {
    if (!dept) return undefined;
    return (colleges || []).find(c => c.id === dept.collegeId);
  }, [colleges, dept]);

  // Role and collegiate scoping
  const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
  const viewerCollegeId = activeUser?.collegeId;
  const viewerCollegeName = activeUser?.collegeName?.toLowerCase();

  const deanCollege = useMemo(() => {
    if (!isDean) return undefined;
    return (colleges || []).find(
      c =>
        (viewerCollegeId && c.id === viewerCollegeId) ||
        (viewerCollegeName && c.name?.toLowerCase() === viewerCollegeName) ||
        (activeUser?.id && c.deanId === activeUser.id)
    );
  }, [isDean, colleges, viewerCollegeId, viewerCollegeName, activeUser]);

  const effectiveDeanCollegeId = viewerCollegeId || deanCollege?.id;

  const isUnauthorizedDean =
    isDean && dept && effectiveDeanCollegeId && dept.collegeId !== effectiveDeanCollegeId;

  // Incumbent chairperson
  const incumbentChair = useMemo(() => {
    const chairId = dept?.chairpersonId;
    if (!chairId) return undefined;
    return (db?.users || []).find(u => u.id === chairId);
  }, [db?.users, dept]);

  // Department faculty list
  const departmentFaculty = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      const isFaculty = u.role === 'faculty' || u.id === dept.chairpersonId;
      if (!isFaculty) return false;
      return (
        u.department?.toLowerCase() === dept.name.toLowerCase() ||
        u.department?.toLowerCase() === dept.code.toLowerCase() ||
        u.id === dept.chairpersonId
      );
    });
  }, [db?.users, dept]);

  // Department students list
  const departmentStudents = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      if (u.role !== 'student') return false;
      return (
        u.department?.toLowerCase() === dept.name.toLowerCase() ||
        u.department?.toLowerCase() === dept.code.toLowerCase()
      );
    });
  }, [db?.users, dept]);

  // Department courses list
  const departmentFacultyIds = useMemo(
    () => new Set(departmentFaculty.map(u => u.id)),
    [departmentFaculty]
  );

  const departmentCourses = useMemo(() => {
    if (!dept) return [];
    return (db?.courses || []).filter(c => {
      return (
        departmentFacultyIds.has(c.instructorId) ||
        (dept.code && c.code?.toLowerCase().startsWith(dept.code.toLowerCase()))
      );
    });
  }, [db?.courses, departmentFacultyIds, dept]);

  // Department sections count
  const departmentSections = useMemo(() => {
    if (!dept) return [];
    const deptCourseIds = new Set(departmentCourses.map(c => c.id));
    return (db?.courseSections || []).filter(s => deptCourseIds.has(s.courseId));
  }, [db?.courseSections, departmentCourses, dept]);

  const totalSectionsCount = useMemo(() => {
    if (departmentSections.length > 0) return departmentSections.length;
    return departmentCourses.reduce((acc, c) => acc + (c.sectionIds?.length || 1), 0);
  }, [departmentSections, departmentCourses]);

  // Candidates eligible for Chairperson appointment
  const eligibleCandidates = useMemo(() => {
    const currentChairId = dept?.chairpersonId;
    return (db?.users || []).filter(u => {
      if (currentChairId && u.id === currentChairId) return false;
      const isEligibleRole = u.role === 'faculty' || u.role === 'admin';
      if (!isEligibleRole) return false;

      if (isDean) {
        return (
          u.collegeId === effectiveDeanCollegeId ||
          (deanCollege && u.collegeName?.toLowerCase() === deanCollege.name.toLowerCase())
        );
      }
      return true;
    });
  }, [db?.users, dept, isDean, effectiveDeanCollegeId, deanCollege]);

  // Back navigation handler
  const handleBack = () => {
    if (onNavigateTab) {
      onNavigateTab('governance');
    }
    navigate('/governance');
  };

  // Submit appointment / handover
  const handleAppointChair = async () => {
    if (!dept || !selectedCandidateId || isSubmittingLeader) return;

    setIsSubmittingLeader(true);
    try {
      const res = await transferLeadership(
        'chairperson',
        dept.chairpersonId || 'none',
        selectedCandidateId,
        dept.id
      );

      if (res.success) {
        showAlert({
          title: 'Leadership Appointed',
          message: res.message || 'Department Chairperson appointed successfully.',
          type: 'success',
        });
        setIsAppointModalOpen(false);
        setSelectedCandidateId('');
      } else {
        showAlert({
          title: 'Appointment Failed',
          message: res.message || 'Could not appoint chairperson.',
          type: 'error',
        });
      }
    } finally {
      setIsSubmittingLeader(false);
    }
  };

  // If department does not exist
  if (!dept) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="department-details-page">
        <div className="p-8 bg-card border border-border rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Department Not Found</h2>
            <p className="text-xs text-muted-foreground mt-1">
              The requested academic department could not be located in the institutional structure.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Academic Governance</span>
          </button>
        </div>
      </div>
    );
  }

  // If Dean is trying to access department outside their assigned college
  if (isUnauthorizedDean) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="department-details-page">
        <div className="p-8 bg-card border border-destructive/20 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Collegiate Scope Invariant: You only have administrative access to departments within your assigned college.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Academic Governance</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in" data-testid="department-details-page">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1 font-semibold"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Academic Governance</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
        <span className="font-semibold text-foreground/80 truncate max-w-[200px]">
          {college?.name || 'Academic College'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
        <span className="font-bold text-primary truncate max-w-[240px]">
          {dept.name}
        </span>
      </nav>

      {/* Main Header & Context */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to Academic Governance"
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                {dept.name}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-primary/10 text-primary rounded-md border border-primary/20">
                {dept.code}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>
                {college ? `${college.name} (${college.code})` : 'Affiliated College'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chairperson Leadership Management Card */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-foreground flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <span>Department Leadership</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supervise the academic chairperson entrusted with curriculum, faculty, and student coordination.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCandidateId('');
              setIsAppointModalOpen(true);
            }}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
          >
            <span>{incumbentChair ? 'Reassign Chairperson' : 'Appoint Chairperson'}</span>
          </button>
        </div>

        {incumbentChair ? (
          <div data-testid="incumbent-chairperson-card" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/30 border border-border rounded-xl">
            <div className="flex items-center space-x-3.5">
              <UserAvatar
                name={incumbentChair.name}
                src={incumbentChair.avatar}
                className="w-11 h-11 rounded-full border border-border shrink-0 shadow-xs"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <div className="font-bold text-foreground text-sm">{incumbentChair.name}</div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                    Active Chairperson
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{incumbentChair.email}</div>
                <div className="text-[11px] font-semibold text-primary mt-0.5">
                  Department Chairperson
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">No Chairperson Appointed.</span> This department currently operates without an appointed executive head. Appoint a faculty member to restore administrative governance.
            </div>
          </div>
        )}
      </div>

      {/* Key Department Metrics Grid (4 Stat Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faculty */}
        <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Faculty</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div
            data-testid="metric-total-faculty"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {departmentFaculty.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Academic teaching staff
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Students</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div
            data-testid="metric-total-students"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {departmentStudents.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Enrolled majors
          </div>
        </div>

        {/* Active Courses */}
        <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Active Courses</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div
            data-testid="metric-active-courses"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {departmentCourses.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {departmentCourses.filter(c => c.published).length} published · {departmentCourses.filter(c => !c.published).length} draft
          </div>
        </div>

        {/* Class Sections */}
        <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Class Sections</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div
            data-testid="metric-class-sections"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {totalSectionsCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Scheduled lecture & lab blocks
          </div>
        </div>
      </div>

      {/* Department Directories & Catalog (Tabbed Views) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {/* Tab Headers */}
        <div className="flex border-b border-border bg-muted/30 px-3 pt-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'faculty'}
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'faculty'
                ? 'border-primary text-primary bg-background/50 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Roster</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
              {departmentFaculty.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'courses'
                ? 'border-primary text-primary bg-background/50 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Course Catalog</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
              {departmentCourses.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'students'}
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'students'
                ? 'border-primary text-primary bg-background/50 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Directory</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
              {departmentStudents.length}
            </span>
          </button>
        </div>

        {/* TAB 1: FACULTY ROSTER */}
        {activeTab === 'faculty' && (
          <div className="divide-y divide-border/60">
            {departmentFaculty.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No faculty members affiliated with this department yet.
              </div>
            ) : (
              departmentFaculty.map(faculty => {
                const isCurrentChair = faculty.id === dept.chairpersonId;
                const assignedCoursesCount = departmentCourses.filter(
                  c => c.instructorId === faculty.id
                ).length;

                return (
                  <div
                    key={faculty.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      <UserAvatar
                        name={faculty.name}
                        src={faculty.avatar}
                        className="w-9 h-9 rounded-full border border-border shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground text-xs">{faculty.name}</span>
                          {isCurrentChair && (
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded-md border border-primary/20">
                              Chairperson
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {faculty.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-xs">
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold">
                          Designation
                        </div>
                        <div className="font-medium text-foreground">
                          {faculty.title || (isCurrentChair ? 'Department Chairperson' : 'Faculty Member')}
                        </div>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold">
                          Courses
                        </div>
                        <div className="font-bold text-primary">
                          {assignedCoursesCount} {assignedCoursesCount === 1 ? 'course' : 'courses'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: COURSE CATALOG */}
        {activeTab === 'courses' && (
          <div className="divide-y divide-border/60">
            {departmentCourses.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No courses registered under this department yet.
              </div>
            ) : (
              departmentCourses.map(course => {
                const instructor = (db?.users || []).find(u => u.id === course.instructorId);
                const sections = departmentSections.filter(s => s.courseId === course.id);
                const sectionsCount = sections.length > 0 ? sections.length : (course.sectionIds?.length || 1);

                return (
                  <div
                    key={course.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground text-xs">{course.code}</span>
                          <span className="text-xs text-foreground font-semibold">
                            {course.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Instructor: {instructor ? instructor.name : course.instructorName || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-xs">
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold">
                          Sections
                        </div>
                        <div className="font-medium text-foreground">
                          {sectionsCount} {sectionsCount === 1 ? 'Section' : 'Sections'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold">
                          Enrolled
                        </div>
                        <div className="font-medium text-foreground">
                          {course.enrolledCount || 0} students
                        </div>
                      </div>
                      <div className="min-w-[80px] text-right">
                        {course.published ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20">
                            Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: STUDENT DIRECTORY */}
        {activeTab === 'students' && (
          <div className="divide-y divide-border/60">
            {departmentStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No students currently enrolled in this department.
              </div>
            ) : (
              departmentStudents.map(student => (
                <div
                  key={student.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <UserAvatar
                      name={student.name}
                      src={student.avatar}
                      className="w-9 h-9 rounded-full border border-border shrink-0"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground text-xs">{student.name}</span>
                        {student.studentId && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-muted text-muted-foreground rounded border border-border">
                            {student.studentId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {student.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md border border-sky-500/20">
                      {student.verificationStatus || 'Active'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* APPOINT / REASSIGN CHAIRPERSON MODAL */}
      {isAppointModalOpen && (
        <DialogFrame
          title="Appoint Chairperson"
          subtitle={`Designate unit administrative leader for ${dept.name}`}
          onClose={() => setIsAppointModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsAppointModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedCandidateId || isSubmittingLeader}
                onClick={handleAppointChair}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{isSubmittingLeader ? 'Appointing...' : 'Confirm Appointment'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-muted/60 border border-border rounded-xl">
              <div className="font-bold text-foreground">Department: {dept.name}</div>
              <div className="text-muted-foreground text-[11px]">
                College: {college ? college.name : 'Affiliated College'}
              </div>
            </div>

            <div>
              <label htmlFor="select-candidate" className="block font-bold text-foreground mb-1.5">
                Select Candidate
              </label>
              <select
                id="select-candidate"
                value={selectedCandidateId}
                onChange={e => setSelectedCandidateId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select faculty member...</option>
                {eligibleCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) - {c.department || 'Faculty'}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Appointing a new leader automatically steps down any previous incumbent to faculty,
                strictly adhering to the single-seat leadership invariant.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
