import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { getDisplayRoleLabel } from '../../shared/utils/roles';
import type { User } from '../../shared/types/lms';
import {
  Building,
  ChevronRight,
  ArrowLeft,
  Users,
  BookOpen,
  GraduationCap,
  Layers,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  Briefcase,
  FolderTree,
  Search,
  Mail,
  X,
  UserX,
} from 'lucide-react';

/** Roster filters. Administrative seats (dean, chair, admin) share the Admin filter. */
type RosterFilter = 'all' | 'admin' | 'faculty' | 'staff' | 'student';

/** Plural noun used in the roster search placeholder and empty state. */
function rosterFilterNoun(filter: RosterFilter): string {
  switch (filter) {
    case 'admin':
      return 'admin accounts';
    case 'faculty':
      return 'faculty members';
    case 'staff':
      return 'staff accounts';
    case 'student':
      return 'students';
    default:
      return 'members';
  }
}

/** Designation shown when a roster member has no explicit title. */
function defaultDesignation(roleLabel: string): string {
  switch (roleLabel) {
    case 'Dean':
      return 'College Dean';
    case 'Chair':
      return 'Program Chairperson';
    case 'Admin':
      return 'Administrator';
    case 'Staff':
      return 'Staff';
    case 'Student':
      return 'Student';
    default:
      return 'Faculty Member';
  }
}

export interface ProgramDetailsPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const ProgramDetailsPage: React.FC<ProgramDetailsPageProps> = ({ onNavigateTab }) => {
  const navigate = useNavigate();
  const { deptId, programId } = useParams<{ deptId?: string; programId?: string }>();
  const activeProgramId = programId || deptId;

  const {
    colleges,
    departments,
    programs,
    db,
    activeRole,
    activeUser,
    transferLeadership,
    showAlert,
  } = useLMS();

  // Active roster filter
  const [roleFilter, setRoleFilter] = useState<RosterFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Leadership handover modal state
  const [isAppointModalOpen, setIsAppointModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [isSubmittingLeader, setIsSubmittingLeader] = useState(false);

  // Program and College resolution
  const programList = programs || departments || [];
  const dept = useMemo(() => {
    return programList.find(d => d.id === activeProgramId);
  }, [programList, activeProgramId]);

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

  // Program faculty list
  const programFaculty = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      const isFaculty = u.role === 'faculty' || u.id === dept.chairpersonId;
      if (!isFaculty) return false;
      const uDept = (u.program || u.department || '').toLowerCase();
      return (
        uDept === dept.name.toLowerCase() ||
        uDept === dept.code.toLowerCase() ||
        u.id === dept.chairpersonId
      );
    });
  }, [db?.users, dept]);

  // Program students list
  const programStudents = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      if (u.role !== 'student') return false;
      const uDept = (u.program || u.department || '').toLowerCase();
      return (
        uDept === dept.name.toLowerCase() ||
        uDept === dept.code.toLowerCase()
      );
    });
  }, [db?.users, dept]);

  // Program courses list
  const programFacultyIds = useMemo(
    () => new Set(programFaculty.map(u => u.id)),
    [programFaculty]
  );

  const programCourses = useMemo(() => {
    if (!dept) return [];
    return (db?.courses || []).filter(c => {
      return (
        programFacultyIds.has(c.instructorId) ||
        (dept.code && c.code?.toLowerCase().startsWith(dept.code.toLowerCase()))
      );
    });
  }, [db?.courses, programFacultyIds, dept]);

  // Program sections count
  const programSections = useMemo(() => {
    if (!dept) return [];
    const deptCourseIds = new Set(programCourses.map(c => c.id));
    return (db?.courseSections || []).filter(s => deptCourseIds.has(s.courseId));
  }, [db?.courseSections, programCourses, dept]);

  const totalSectionsCount = useMemo(() => {
    if (programSections.length > 0) return programSections.length;
    return programCourses.reduce((acc, c) => acc + (c.sectionIds?.length || 1), 0);
  }, [programSections, programCourses]);

  // The college dean oversees the program, so they belong on its roster too
  const isCollegeDean = useMemo(
    () => (u: User) => {
      const holdsDeanSeat = u.adminSubrole === 'dean' || getDisplayRoleLabel(u, u.role) === 'Dean';
      if (!holdsDeanSeat) return false;

      const sameCollege =
        (college?.deanId && u.id === college.deanId) ||
        (dept?.collegeId && u.collegeId === dept.collegeId) ||
        (!!college?.name && u.collegeName?.toLowerCase() === college.name.toLowerCase());

      return Boolean(sameCollege);
    },
    [college, dept]
  );

  // Program roster: every account affiliated with this program
  const programMembers = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      const uDept = (u.program || u.department || '').toLowerCase();
      return (
        uDept === dept.name.toLowerCase() ||
        uDept === dept.code.toLowerCase() ||
        u.id === dept.chairpersonId ||
        isCollegeDean(u)
      );
    });
  }, [db?.users, dept, isCollegeDean]);

  // The sitting chairperson reads as "Chair" regardless of their raw role field
  const memberRoleLabel = useMemo(
    () => (u: User) => (u.id === dept?.chairpersonId ? 'Chair' : getDisplayRoleLabel(u, u.role)),
    [dept]
  );

  // Administrative seats (dean, chair, admin) share the Admin filter
  const isAdminMember = useMemo(
    () => (u: User) => ['Dean', 'Chair', 'Admin'].includes(memberRoleLabel(u)),
    [memberRoleLabel]
  );

  // Roster counts per filter (administrative seats collapse into "Admin")
  const rosterCounts = useMemo(() => {
    const matches = (u: User, filter: RosterFilter) => {
      if (filter === 'all') return true;
      if (filter === 'admin') return isAdminMember(u);
      return memberRoleLabel(u).toLowerCase() === filter;
    };

    return {
      all: programMembers.length,
      admin: programMembers.filter(u => matches(u, 'admin')).length,
      faculty: programMembers.filter(u => matches(u, 'faculty')).length,
      staff: programMembers.filter(u => matches(u, 'staff')).length,
      student: programMembers.filter(u => matches(u, 'student')).length,
    };
  }, [programMembers, isAdminMember, memberRoleLabel]);

  // Roster rows for the active filter and search query
  const filteredMembers = useMemo(() => {
    const byRole = programMembers.filter(u => {
      if (roleFilter === 'all') return true;
      if (roleFilter === 'admin') return isAdminMember(u);
      return memberRoleLabel(u).toLowerCase() === roleFilter;
    });

    if (!searchQuery.trim()) return byRole;
    const q = searchQuery.toLowerCase().trim();
    return byRole.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q))
    );
  }, [programMembers, roleFilter, searchQuery, isAdminMember, memberRoleLabel]);

  // Eligible faculty candidates for appointment to program chairperson
  const eligibleCandidates = useMemo(() => {
    if (!dept) return [];
    return (db?.users || []).filter(u => {
      if (u.id === dept.chairpersonId) return false;
      const isFaculty = u.role === 'faculty';
      const uDept = (u.program || u.department || '').toLowerCase();
      const inProgram =
        uDept === dept.name.toLowerCase() ||
        uDept === dept.code.toLowerCase() ||
        u.collegeId === dept.collegeId;
      return isFaculty && inProgram;
    });
  }, [db?.users, dept]);

  const handleBackToGovernance = () => {
    if (onNavigateTab) {
      onNavigateTab('governance');
    } else {
      navigate('/governance');
    }
  };

  const handleAppointChair = async () => {
    if (!dept || !selectedCandidateId) return;
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
          title: 'Appointment Confirmed',
          message: res.message,
          type: 'success',
        });
        setIsAppointModalOpen(false);
      } else {
        showAlert({
          title: 'Appointment Failed',
          message: res.message,
          type: 'error',
        });
      }
    } finally {
      setIsSubmittingLeader(false);
    }
  };

  // Guard: Unauthorized Dean attempting to view a program outside their college
  if (isUnauthorizedDean) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold text-destructive">
              Access Restricted to Your Assigned College
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              As a College Dean, you are authorized to supervise academic programs within{' '}
              <strong className="text-foreground">{deanCollege?.name || 'your assigned college'}</strong> only.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleBackToGovernance}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Academic Governance</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Guard: Program Not Found
  if (!dept) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-none">
          <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold text-foreground">
              Academic Program Not Found
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              The requested academic program ID could not be located in the university academic structure.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleBackToGovernance}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Academic Governance</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground"
      >
        <button
          type="button"
          onClick={handleBackToGovernance}
          className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Academic Governance</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        {college && (
          <>
            <span className="text-muted-foreground/80">{college.code}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          </>
        )}
        <span className="text-foreground font-bold truncate max-w-[200px] sm:max-w-none">
          {dept.name}
        </span>
      </nav>

      {/* Program Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-none">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={handleBackToGovernance}
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
                <span>Program Leadership</span>
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
          <div data-testid="incumbent-chairperson-card" className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-7 bg-muted/20 border border-border rounded-2xl">
            <div className="flex items-center space-x-5 min-w-0">
              <div className="shrink-0">
                <UserAvatar
                  name={incumbentChair.name}
                  src={incumbentChair.avatar}
                  className="w-14 h-14 rounded-full border-2 border-border shadow-xs"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="font-extrabold text-foreground text-base sm:text-lg tracking-tight">
                  {incumbentChair.name}
                </div>
                <div className="text-xs font-semibold text-primary">
                  Program Chairperson
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                  <span className="truncate">{incumbentChair.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t md:border-t-0 md:border-l border-border/70 pt-4 md:pt-0 md:pl-8 shrink-0">
              <div>
                <div className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                  Academic Division
                </div>
                <div className="text-foreground font-semibold text-sm mt-1">
                  {college ? `${college.code} · ${dept.code}` : dept.code}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            data-testid="unappointed-chairperson-card"
            className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-7 bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border border-amber-500/25 dark:border-amber-500/30 rounded-2xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                <UserX className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-extrabold text-foreground text-base sm:text-lg tracking-tight">
                    No Chairperson Appointed
                  </h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-md border border-amber-500/30">
                    Seat Vacant
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  This program currently operates without an appointed executive head. Appoint a faculty member to restore administrative governance, oversee curriculum, and manage academic advising.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t md:border-t-0 md:border-l border-amber-500/20 pt-4 md:pt-0 md:pl-8 shrink-0">
              <div>
                <div className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                  Academic Division
                </div>
                <div className="text-foreground font-semibold text-sm mt-1">
                  {college ? `${college.code} · ${dept.code}` : dept.code}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Program Metrics Grid (4 Stat Cards) */}
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
              {programFaculty.length}
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
              {programStudents.length}
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
              {programCourses.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {programCourses.filter(c => c.published).length} published · {programCourses.filter(c => !c.published).length} draft
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

      {/* Program Roster (filterable directory) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-none">
        {/* Roster Filters and Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-5 border-b border-border bg-muted/20">
          <div
            className="flex items-center gap-1.5 p-1 bg-background/80 border border-border rounded-xl shrink-0 overflow-x-auto"
            role="group"
            aria-label="Filter roster by role"
          >
            {[
              { key: 'all' as RosterFilter, label: 'All', icon: Users, count: rosterCounts.all },
              { key: 'admin' as RosterFilter, label: 'Admin', icon: ShieldCheck, count: rosterCounts.admin },
              { key: 'faculty' as RosterFilter, label: 'Faculty', icon: UserCheck, count: rosterCounts.faculty },
              { key: 'staff' as RosterFilter, label: 'Staff', icon: Briefcase, count: rosterCounts.staff },
              { key: 'student' as RosterFilter, label: 'Student', icon: GraduationCap, count: rosterCounts.student },
            ].map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                type="button"
                aria-pressed={roleFilter === key}
                onClick={() => setRoleFilter(key)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
                  roleFilter === key
                    ? 'bg-card text-foreground shadow-xs font-extrabold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Filter ${
                roleFilter === 'all'
                  ? 'members'
                  : roleFilter === 'admin'
                    ? 'admin accounts'
                    : roleFilter === 'faculty'
                      ? 'faculty members'
                      : roleFilter === 'staff'
                        ? 'staff accounts'
                        : 'students'
              }...`}
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

        {/* PROGRAM ROSTER */}
        <div className="divide-y divide-border/60">
          {filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
              <Users className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
              <div className="font-semibold text-foreground">
                {searchQuery
                  ? 'No matching members found'
                  : roleFilter === 'all'
                    ? 'No accounts affiliated with this program yet'
                    : `No ${rosterFilterNoun(roleFilter)} in this program yet`}
              </div>
              {searchQuery && (
                <p className="text-[11px]">Try adjusting your search query.</p>
              )}
            </div>
          ) : (
            filteredMembers.map(member => {
              const isCurrentChair = member.id === dept.chairpersonId;
              const roleLabel = memberRoleLabel(member);
              const isStudent = roleLabel === 'Student';
              const assignedCoursesCount = programCourses.filter(
                c => c.instructorId === member.id
              ).length;

              return (
                <div
                  key={member.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <UserAvatar
                      name={member.name}
                      src={member.avatar}
                      className="w-10 h-10 rounded-full border border-border shrink-0 shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-xs truncate">{member.name}</span>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded-md border shrink-0 ${
                            isCurrentChair
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {roleLabel}
                        </span>
                        {isStudent && member.studentId && (
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-muted text-muted-foreground rounded-md border border-border shrink-0">
                            {member.studentId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                        Designation
                      </div>
                      <div className="font-medium text-foreground mt-0.5">
                        {member.title || (isCurrentChair ? 'Program Chairperson' : defaultDesignation(roleLabel))}
                      </div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      {isStudent ? (
                        <>
                          <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                            Status
                          </div>
                          <div className="font-medium text-foreground mt-0.5">
                            {member.verificationStatus || 'Active'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                            Courses
                          </div>
                          <div className={`font-bold mt-0.5 ${assignedCoursesCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {assignedCoursesCount} {assignedCoursesCount === 1 ? 'course' : 'courses'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
              <div className="font-bold text-foreground">Program: {dept.name}</div>
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
                    {c.name} ({c.email}) - {c.program || c.department || 'Faculty'}
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
