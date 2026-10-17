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
  Search,
  Mail,
  X,
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
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filtered views based on search query
  const filteredFaculty = useMemo(() => {
    if (!searchQuery.trim()) return departmentFaculty;
    const q = searchQuery.toLowerCase().trim();
    return departmentFaculty.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      (f.title || '').toLowerCase().includes(q)
    );
  }, [departmentFaculty, searchQuery]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return departmentCourses;
    const q = searchQuery.toLowerCase().trim();
    return departmentCourses.filter(c =>
      (c.code || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.instructorName || '').toLowerCase().includes(q)
    );
  }, [departmentCourses, searchQuery]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return departmentStudents;
    const q = searchQuery.toLowerCase().trim();
    return departmentStudents.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q)
    );
  }, [departmentStudents, searchQuery]);

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
    <div className="w-full space-y-6 animate-fade-in pb-16 font-sans" data-testid="department-details-page">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1 font-semibold"
        >
          <FolderTree className="w-3.5 h-3.5 text-primary" />
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
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to Academic Governance"
            className="w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0 border border-border active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                {dept.name}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-primary/10 text-primary rounded-lg border border-primary/20">
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

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-muted/60 text-muted-foreground border border-border flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Unit</span>
          </span>
        </div>
      </div>

      {/* Chairperson Leadership Management Card */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15 mt-0.5">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground flex items-center space-x-2">
                <span>Department Leadership</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supervise the academic chairperson entrusted with curriculum, faculty, and student coordination.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCandidateId('');
              setIsAppointModalOpen(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-primary-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
          >
            <span>{incumbentChair ? 'Reassign Chairperson' : 'Appoint Chairperson'}</span>
          </button>
        </div>

        {incumbentChair ? (
          <div data-testid="incumbent-chairperson-card" className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4.5 bg-muted/20 border border-border rounded-xl">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  name={incumbentChair.name}
                  src={incumbentChair.avatar}
                  className="w-12 h-12 rounded-full border-2 border-border shadow-xs"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full" title="Active Chairperson" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-extrabold text-foreground text-sm tracking-tight">{incumbentChair.name}</div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                    Active Chairperson
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="truncate">{incumbentChair.email}</span>
                </div>
                <div className="text-[11px] font-semibold text-primary mt-0.5">
                  Department Chairperson
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground border-t md:border-t-0 md:border-l border-border/70 pt-3 md:pt-0 md:pl-5 shrink-0">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Academic Division</div>
                <div className="text-foreground font-medium text-xs mt-0.5">{college ? `${college.code} · ${dept.code}` : dept.code}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-4.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold">No Chairperson Appointed.</span> This department currently operates without an appointed executive head. Appoint a faculty member to restore administrative governance.
            </div>
          </div>
        )}
      </div>

      {/* Key Department Metrics Grid (4 Stat Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faculty */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-none space-y-3 hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Total Faculty</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              data-testid="metric-total-faculty"
              className="text-2xl sm:text-3xl font-black text-foreground tracking-tight"
            >
              {departmentFaculty.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Academic teaching staff
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-none space-y-3 hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Total Students</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              data-testid="metric-total-students"
              className="text-2xl sm:text-3xl font-black text-foreground tracking-tight"
            >
              {departmentStudents.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Enrolled majors
            </div>
          </div>
        </div>

        {/* Active Courses */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-none space-y-3 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Active Courses</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              data-testid="metric-active-courses"
              className="text-2xl sm:text-3xl font-black text-foreground tracking-tight"
            >
              {departmentCourses.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {departmentCourses.filter(c => c.published).length} published · {departmentCourses.filter(c => !c.published).length} draft
            </div>
          </div>
        </div>

        {/* Class Sections */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-none space-y-3 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Class Sections</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              data-testid="metric-class-sections"
              className="text-2xl sm:text-3xl font-black text-foreground tracking-tight"
            >
              {totalSectionsCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Scheduled lecture & lab blocks
            </div>
          </div>
        </div>
      </div>

      {/* Department Directories & Catalog (Tabbed Views) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-none">
        {/* Tab Headers and Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-1.5 p-1 bg-background/80 border border-border rounded-xl shrink-0" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'faculty'}
              onClick={() => setActiveTab('faculty')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'faculty'
                  ? 'bg-card text-foreground shadow-xs font-extrabold border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
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
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'courses'
                  ? 'bg-card text-foreground shadow-xs font-extrabold border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
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
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'students'
                  ? 'bg-card text-foreground shadow-xs font-extrabold border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student Directory</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
                {departmentStudents.length}
              </span>
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeTab === 'faculty' ? 'faculty members' : activeTab === 'courses' ? 'courses' : 'students'}...`}
              className="w-full pl-9 pr-8 py-1.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: FACULTY ROSTER */}
        {activeTab === 'faculty' && (
          <div className="divide-y divide-border/60">
            {filteredFaculty.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
                <Users className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                <div className="font-semibold text-foreground">
                  {searchQuery ? 'No matching faculty members found' : 'No faculty members affiliated with this department yet'}
                </div>
                {searchQuery && (
                  <p className="text-[11px]">Try adjusting your search query.</p>
                )}
              </div>
            ) : (
              filteredFaculty.map(faculty => {
                const isCurrentChair = faculty.id === dept.chairpersonId;
                const assignedCoursesCount = departmentCourses.filter(
                  c => c.instructorId === faculty.id
                ).length;

                return (
                  <div
                    key={faculty.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <UserAvatar
                        name={faculty.name}
                        src={faculty.avatar}
                        className="w-10 h-10 rounded-full border border-border shrink-0 shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground text-xs truncate">{faculty.name}</span>
                          {isCurrentChair && (
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded-md border border-primary/20 shrink-0">
                              Chairperson
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {faculty.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-xs shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Designation
                        </div>
                        <div className="font-medium text-foreground mt-0.5">
                          {faculty.title || (isCurrentChair ? 'Department Chairperson' : 'Faculty Member')}
                        </div>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Courses
                        </div>
                        <div className={`font-bold mt-0.5 ${assignedCoursesCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
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
            {filteredCourses.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
                <BookOpen className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                <div className="font-semibold text-foreground">
                  {searchQuery ? 'No matching courses found' : 'No courses registered under this department yet'}
                </div>
                {searchQuery && (
                  <p className="text-[11px]">Try searching for another course code or title.</p>
                )}
              </div>
            ) : (
              filteredCourses.map(course => {
                const instructor = (db?.users || []).find(u => u.id === course.instructorId);
                const sections = departmentSections.filter(s => s.courseId === course.id);
                const sectionsCount = sections.length > 0 ? sections.length : (course.sectionIds?.length || 1);

                return (
                  <div
                    key={course.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                        <BookOpen className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-foreground text-xs">{course.code}</span>
                          <span className="text-xs text-foreground font-semibold truncate">
                            {course.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          Instructor: {instructor ? instructor.name : course.instructorName || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-5 text-xs shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Sections
                        </div>
                        <div className="font-medium text-foreground mt-0.5">
                          {sectionsCount} {sectionsCount === 1 ? 'Section' : 'Sections'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Enrolled
                        </div>
                        <div className="font-medium text-foreground mt-0.5">
                          {course.enrolledCount || 0} students
                        </div>
                      </div>
                      <div className="min-w-[85px] text-right">
                        {course.published ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
                            Published
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20">
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
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
                <GraduationCap className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                <div className="font-semibold text-foreground">
                  {searchQuery ? 'No matching students found' : 'No students currently enrolled in this department'}
                </div>
                {searchQuery && (
                  <p className="text-[11px]">Try searching by student name, ID, or email.</p>
                )}
              </div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={student.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <UserAvatar
                      name={student.name}
                      src={student.avatar}
                      className="w-10 h-10 rounded-full border border-border shrink-0 shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-xs truncate">{student.name}</span>
                        {student.studentId && (
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-muted text-muted-foreground rounded-md border border-border">
                            {student.studentId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {student.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-xs shrink-0 self-end sm:self-center">
                    <span className="px-2.5 py-1 text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg border border-sky-500/20">
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
