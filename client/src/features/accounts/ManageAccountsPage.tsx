import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import type { User, UserRole, PendingRegistration } from '../../shared/types/lms';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import { getDisplayRoleLabel, compareUsersByAuthority, isFacultyRole, isChairRole, isDeanRole } from '../../shared/utils/roles';
import { normalizeProgramName } from '../../shared/data/collegesData';
import { CustomDropdown, type DropdownOption } from '../../shared/components/common/CustomDropdown';
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  Building,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Inbox,
  MoreVertical,
  Eye
} from 'lucide-react';


interface ManageAccountsPageProps {
  onNavigateTab?: (tab: string) => void;
  onEditAccount?: (user: User) => void;
  onViewAccount?: (user: User) => void;
}

export const ManageAccountsPage: React.FC<ManageAccountsPageProps> = ({ onNavigateTab, onEditAccount, onViewAccount }) => {
  let navigate: ReturnType<typeof useNavigate>;
  try {
    navigate = useNavigate();
  } catch {
    navigate = (() => {}) as any;
  }
  const {
    db,
    activeUser,
    activeRole,
    deleteUser,
    showAlert,
    setIsRoleModalOpen,
    logout,
    pendingRegistrations,
    verifyRegistration,
    rejectRegistration,
    colleges,
    departments,
    schoolYears
  } = useLMS();

  // Navigation tab state
  const [activeMainTab, setActiveMainTab] = useState<'active-directory' | 'pending-verifications'>('active-directory');

  // Search & Filter state for Active Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('all');

  // Modal & menu states
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down');

  // Close actions menu on outside click or escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-actions-menu]')) {
        setOpenMenuUserId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuUserId(null);
      }
    };

    if (openMenuUserId) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuUserId]);

  // Verification queue action states
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [verifyingReg, setVerifyingReg] = useState<PendingRegistration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Scoped Pending Registrations calculation. Applicants who have not yet confirmed their
  // email stay in the queue (flagged, and blocked from approval) so leadership can see them.
  const scopedPendingRegistrations = useMemo(() => {
    const list = (pendingRegistrations || []).filter(
      r => r.status === 'pending' || !r.status
    );

    // Chancellor / Superadmin sees all registrations across all colleges & departments
    if (activeRole === 'superadmin' || activeUser?.adminSubrole === 'chancellor') {
      return list;
    }

    // Dean: sees all pending registrations in their college
    if (activeRole === 'admin' && activeUser?.adminSubrole === 'dean') {
      return list.filter(r => {
        if (activeUser?.collegeId && r.collegeId === activeUser.collegeId) return true;
        if (
          activeUser?.collegeName &&
          r.collegeName &&
          r.collegeName.toLowerCase() === activeUser.collegeName.toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    }

    // Chairperson: sees all pending registrations in their program
    if (activeRole === 'admin' && activeUser?.adminSubrole === 'chairperson') {
      const activeUnit = activeUser?.program || activeUser?.department;
      return list.filter(r => {
        const regUnit = r.program || r.department;
        if (
          activeUnit &&
          regUnit &&
          regUnit.toLowerCase() === activeUnit.toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    }

    // Fallbacks for other roles
    const fallbackUnit = activeUser?.program || activeUser?.department;
    if (fallbackUnit) {
      return list.filter(
        r => {
          const regUnit = r.program || r.department;
          return regUnit && regUnit.toLowerCase() === fallbackUnit.toLowerCase();
        }
      );
    }
    if (activeUser?.collegeId) {
      return list.filter(r => r.collegeId === activeUser.collegeId);
    }

    return list;
  }, [pendingRegistrations, activeRole, activeUser]);

  // Role scoping helpers
  const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
  const isChair =
    (activeRole === 'admin' && activeUser?.adminSubrole === 'chairperson') ||
    isChairRole(activeUser, activeRole);
  const canCreateLeadership =
    (activeRole === 'superadmin' || activeRole === 'admin') && !isDean && !isChair;
  const deanCollegeId = activeUser?.collegeId;
  const deanCollegeName = activeUser?.collegeName?.toLowerCase();
  const effectiveDeanCollegeId =
    deanCollegeId ||
    colleges?.find(
      c => (deanCollegeName && c.name?.toLowerCase() === deanCollegeName) || c.deanId === activeUser?.id
    )?.id;

  // Scoped directory users for collegiate scoping (Dean sees only their college; Chancellor sees all)
  const scopedDirectoryUsers = useMemo(() => {
    const allUsers = db?.users || [];
    if (!isDean) return allUsers;
    return allUsers.filter(u => {
      if (effectiveDeanCollegeId && u.collegeId === effectiveDeanCollegeId) return true;
      if (deanCollegeName && u.collegeName && u.collegeName.toLowerCase() === deanCollegeName) return true;
      return false;
    });
  }, [db?.users, isDean, effectiveDeanCollegeId, deanCollegeName]);

  // Dynamically aggregated programs from registered hierarchy and all active users
  const allDepartments = useMemo(() => {
    const deptSet = new Set<string>();
    (departments || []).forEach(d => {
      if (d.name) deptSet.add(normalizeProgramName(d.name.trim()));
    });
    if (deptSet.size === 0) {
      deptSet.add('Computer Science');
    }
    (db?.users || []).forEach(u => {
      const uProg = u?.program || u?.department;
      if (uProg && typeof uProg === 'string') {
        deptSet.add(normalizeProgramName(uProg.trim()));
      }
    });
    return Array.from(deptSet).sort();
  }, [departments, db?.users]);

  // Available departments scoped to Dean's college when viewing as Dean
  const availableDepartments = useMemo(() => {
    if (isDean && effectiveDeanCollegeId) {
      return (departments || []).filter(d => d.collegeId === effectiveDeanCollegeId);
    }
    return departments || [];
  }, [departments, isDean, effectiveDeanCollegeId]);

  // Computed summary metrics - scoped to college for Deans, university-wide for Chancellor
  const stats = useMemo(() => {
    const userList = scopedDirectoryUsers;
    const total = userList.length;
    const faculty = userList.filter(u => u?.role === 'faculty').length;
    const students = userList.filter(u => u?.role === 'student').length;
    const admin = userList.filter(u => u?.role === 'admin').length;
    const staff = userList.filter(u => u?.role === 'staff').length;
    return { total, faculty, students, admin, staff };
  }, [scopedDirectoryUsers]);

  // Filtered accounts list with complete null safety
  const filteredUsers = useMemo(() => {
    const userList = scopedDirectoryUsers;
    const filtered = userList.filter(user => {
      if (!user) return false;

      // Role filter
      if (roleFilter !== 'all' && (user.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }

      // Program filter
      if (departmentFilter !== 'all') {
        const uProg = normalizeProgramName(user.program || user.department || '');
        const targetFilter = normalizeProgramName(departmentFilter);
        if (uProg !== targetFilter) {
          return false;
        }
      }

      // School Year filter
      if (schoolYearFilter !== 'all') {
        const uSy = user.schoolYear || '2025-2026';
        if (uSy !== schoolYearFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (user.name || '').toLowerCase().includes(q);
        const matchEmail = (user.email || '').toLowerCase().includes(q);
        const matchDept = (user.program || user.department || '').toLowerCase().includes(q);
        const matchTitle = (user.title || '').toLowerCase().includes(q);
        const matchStudentId = (user.studentId || '').toLowerCase().includes(q);
        const matchRole = getDisplayRoleLabel(user, user.role).toLowerCase().includes(q) || (user.adminSubrole || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDept && !matchTitle && !matchStudentId && !matchRole) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort(compareUsersByAuthority);
  }, [scopedDirectoryUsers, roleFilter, departmentFilter, schoolYearFilter, searchQuery]);

  // Custom Dropdown option definitions for School Years
  const schoolYearFilterOptions: DropdownOption[] = useMemo(() => {
    const yearsSet = new Set<string>();
    // Collect distinct school years from schoolYears list
    (schoolYears || []).forEach(sy => {
      if (sy.year) yearsSet.add(sy.year.trim());
    });
    // Collect distinct school years from users in active directory
    (scopedDirectoryUsers || []).forEach(u => {
      if (u.schoolYear) {
        yearsSet.add(u.schoolYear.trim());
      } else {
        yearsSet.add('2025-2026');
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    return [
      { value: 'all', label: 'All School Years', icon: <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> },
      ...sortedYears.map(yr => ({
        value: yr,
        label: yr,
        icon: <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
      }))
    ];
  }, [schoolYears, scopedDirectoryUsers]);

  // Custom Dropdown option definitions scoped by available departments/programs
  const departmentFilterOptions: DropdownOption[] = useMemo(() => {
    if (isDean) {
      return [
        { value: 'all', label: 'All Programs', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
        ...availableDepartments.map(d => {
          const name = normalizeProgramName(d.name);
          return {
            value: name,
            label: name,
            icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
          };
        })
      ];
    }

    if (availableDepartments && availableDepartments.length > 0) {
      return [
        { value: 'all', label: 'All Programs', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
        ...availableDepartments.map(d => {
          const name = normalizeProgramName(d.name);
          return {
            value: name,
            label: name,
            icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
          };
        })
      ];
    }

    return [
      { value: 'all', label: 'All Programs', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
      ...allDepartments.map(d => {
        const name = normalizeProgramName(d);
        return {
          value: name,
          label: name,
          icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
        };
      })
    ];
  }, [isDean, availableDepartments, allDepartments]);

  // Go to dedicated Edit Account page
  const handleOpenEditPage = (user: User) => {
    if (onEditAccount) {
      onEditAccount(user);
    } else if (onNavigateTab) {
      onNavigateTab('edit-account');
    }
  };

  // Go to dedicated View Profile page
  const handleOpenViewPage = (user: User) => {
    if (onViewAccount) {
      onViewAccount(user);
    } else {
      navigate(`/accounts/${encodeURIComponent(user.id)}/view`);
    }
  };

  // Submit Delete Account
  const handleDeleteConfirm = async () => {
    if (!deletingUser || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await deleteUser(deletingUser.id);
      setDeletingUser(null);

      if (res.success) {
        showAlert({
          title: 'Account Deleted',
          message: res.message || 'User account was successfully removed.',
          type: 'success'
        });
      } else {
        showAlert({
          title: 'Action Denied',
          message: res.message || 'Cannot delete this account.',
          type: 'error'
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Verify Modal
  const handleVerify = (id: string) => {
    if (isVerifyingId) return;
    const target = (pendingRegistrations || []).find(r => r.id === id);
    if (target && !target.emailVerified) {
      showAlert({
        title: 'Email Verification Required',
        message: 'Cannot verify registration: applicant must verify their email address before approval.',
        type: 'error'
      });
      return;
    }
    if (target) {
      setVerifyingReg(target);
    }
  };

  // Confirm Verify Registration (from modal)
  const handleConfirmVerify = async () => {
    if (!verifyingReg || isVerifyingId) return;
    if (!verifyingReg.emailVerified) {
      showAlert({
        title: 'Email Verification Required',
        message: 'Cannot verify registration: applicant must verify their email address before approval.',
        type: 'error'
      });
      setVerifyingReg(null);
      return;
    }
    const targetId = verifyingReg.id;
    setIsVerifyingId(targetId);
    try {
      const res = await verifyRegistration(targetId);
      setVerifyingReg(null);
      if (res.success) {
        showAlert({
          title: 'Account Verified',
          message: res.message || 'User registration verified and active account provisioned.',
          type: 'success'
        });
      } else {
        showAlert({
          title: 'Verification Failed',
          message: res.message || 'Unable to verify registration.',
          type: 'error'
        });
      }
    } finally {
      setIsVerifyingId(null);
    }
  };

  // Open Reject Modal
  const handleReject = (id: string) => {
    if (isRejectingId) return;
    const target = (pendingRegistrations || []).find(r => r.id === id);
    if (target) {
      setRejectReason('');
      setRejectingReg(target);
    }
  };

  // Confirm Reject Registration (from modal)
  const handleConfirmReject = async () => {
    if (!rejectingReg || isRejectingId) return;
    const targetId = rejectingReg.id;
    const reason = rejectReason.trim() || undefined;
    setIsRejectingId(targetId);
    try {
      const res = await rejectRegistration(targetId, reason);
      setRejectingReg(null);
      setRejectReason('');
      if (res.success) {
        showAlert({
          title: 'Registration Rejected',
          message: res.message || 'Registration has been rejected.',
          type: 'info'
        });
      } else {
        showAlert({
          title: 'Action Failed',
          message: res.message || 'Unable to reject registration.',
          type: 'error'
        });
      }
    } finally {
      setIsRejectingId(null);
    }
  };

  const getRoleBadge = (role?: string, user?: User) => {
    const displayLabel = getDisplayRoleLabel(user, role);
    switch (displayLabel) {
      case 'Dean':
        return {
          label: 'Dean',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <Building className="w-3 h-3" />
        };
      case 'Chair':
        return {
          label: 'Chair',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <Building className="w-3 h-3" />
        };
      case 'Admin':
        return {
          label: 'Admin',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <Building className="w-3 h-3" />
        };
      case 'Faculty':
        return {
          label: 'Faculty',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <UserCheck className="w-3 h-3" />
        };
      case 'Staff':
        return {
          label: 'Staff',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <ShieldCheck className="w-3 h-3" />
        };
      case 'Student':
        return {
          label: 'Student',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <GraduationCap className="w-3 h-3" />
        };
      default:
        return {
          label: displayLabel || role || 'User',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <Building className="w-3 h-3" />
        };
    }
  };

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16">
      {/* Role Notice if viewing as non-admin */}
      {activeRole !== 'admin' && activeRole !== 'superadmin' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Administrative console preview:</span> You are currently browsing as <strong>{activeRole}</strong>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-500 text-white dark:text-amber-950 font-bold text-xs rounded-xl shadow-xs hover:bg-amber-600 transition-colors shrink-0 cursor-pointer"
          >
            Switch to Admin
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <PageHeader
        title="Manage College Accounts"
        description="Verify pending applicants within the 30-day window and audit collegiate directory accounts."
      />

      {/* Primary Tab Switcher */}
      <div role="tablist" className="flex items-center space-x-2 border-b border-border/70 pb-3">
        <button
          role="tab"
          aria-selected={activeMainTab === 'active-directory'}
          onClick={() => setActiveMainTab('active-directory')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            activeMainTab === 'active-directory'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Directory</span>
        </button>

        <button
          role="tab"
          aria-label="Pending Verifications (Verification Queue)"
          aria-selected={activeMainTab === 'pending-verifications'}
          onClick={() => setActiveMainTab('pending-verifications')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            activeMainTab === 'pending-verifications'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Verifications</span>
          {scopedPendingRegistrations.length > 0 && (
            <span
              className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                activeMainTab === 'pending-verifications'
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary/20 text-primary'
              }`}
            >
              {scopedPendingRegistrations.length}
            </span>
          )}
        </button>

        {canCreateLeadership && (
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) {
                onNavigateTab('create-leadership');
              } else {
                navigate('/accounts/create-leadership');
              }
            }}
            className="ml-auto px-3.5 py-1.5 sm:px-4 sm:py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Create Leadership Account</span>
          </button>
        )}
      </div>

      {/* TAB 1: ACTIVE DIRECTORY */}
      {activeMainTab === 'active-directory' && (
        <div className="space-y-6">
          {/* 5-Card Metric Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Total Accounts */}
            <div className="p-3.5 bg-card border border-border hover:border-primary/40 rounded-xl shadow-none flex flex-col justify-between transition-all duration-200 group col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  Total Accounts
                </span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black text-foreground font-sans tracking-tight">
                  {stats.total}
                </div>
              </div>
            </div>

            {/* Card 2: Faculty Instructors */}
            <div className="p-3.5 bg-card border border-border hover:border-emerald-500/40 rounded-xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  Faculty Instructors
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black text-foreground font-sans tracking-tight">
                  {stats.faculty}
                </div>
              </div>
            </div>

            {/* Card 3: Enrolled Students */}
            <div className="p-3.5 bg-card border border-border hover:border-blue-500/40 rounded-xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  Enrolled Students
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black text-foreground font-sans tracking-tight">
                  {stats.students}
                </div>
              </div>
            </div>

            {/* Card 4: College Administrators */}
            <div className="p-3.5 bg-card border border-border hover:border-primary/40 rounded-xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  College Administrators
                </span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Building className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black text-foreground font-sans tracking-tight">
                  {stats.admin}
                </div>
              </div>
            </div>

            {/* Card 5: Non-Teaching Staff */}
            <div className="p-3.5 bg-card border border-border hover:border-amber-500/40 rounded-xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  Non-Teaching Staff
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black text-foreground font-sans tracking-tight">
                  {stats.staff}
                </div>
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="p-4 bg-card border border-border rounded-2xl shadow-none flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, student ID, or program..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-sans placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter Tabs & Department Selector */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Role pills */}
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'all'
                      ? 'bg-card text-foreground shadow-none font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({scopedDirectoryUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('faculty')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'faculty'
                      ? 'bg-card text-foreground shadow-none font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('student')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'student'
                      ? 'bg-card text-foreground shadow-none font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('staff')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'staff'
                      ? 'bg-card text-foreground shadow-none font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'admin'
                      ? 'bg-card text-foreground shadow-none font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Admin
                </button>
              </div>

              {/* Department Custom Dropdown */}
              <CustomDropdown
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={departmentFilterOptions}
                searchable={true}
                placeholder="All Programs"
                className="w-full sm:w-56"
                buttonClassName="py-2 px-3 bg-muted/60"
              />

              {/* School Year Custom Dropdown */}
              <CustomDropdown
                value={schoolYearFilter}
                onChange={setSchoolYearFilter}
                options={schoolYearFilterOptions}
                searchable={false}
                placeholder="All School Years"
                className="w-full sm:w-44"
                buttonClassName="py-2 px-3 bg-muted/60"
              />
            </div>
          </div>

          {/* Accounts List Table / Cards */}
          <div className="bg-card border border-border rounded-2xl shadow-none">
            <div className="overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold text-[12px]">
                    <th className="py-3.5 px-4 rounded-tl-2xl">User Account</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Program & Position</th>
                    <th className="py-3.5 px-4">Academic ID</th>
                    <th className="py-3.5 px-4">Courses / Attachments</th>
                    <th className="py-3.5 px-4 text-right rounded-tr-2xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-foreground">No accounts found</p>
                        <p className="text-[11px] mt-1">Try adjusting your search query or role filter.</p>
                        {(db?.users || []).length === 0 && (
                          <button
                            type="button"
                            onClick={logout}
                            className="mt-3 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-primary-sm hover:bg-primary/90 transition-all cursor-pointer"
                          >
                            Sign Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => {
                      const roleMeta = getRoleBadge(user.role, user);
                      const isCurrent = activeUser ? user.id === activeUser.id : false;

                      // Course count
                      let courseCount = 0;
                      if (isFacultyRole(user, user.role)) {
                        courseCount = (db?.courses || []).filter(c => c.instructorId === user.id).length;
                      } else if (user.role === 'student') {
                        courseCount = (user.enrolledCourseIds || []).length;
                      }

                      const userName = user.name || 'Unnamed Account';
                      const userEmail = user.email || 'no-email@dmmmsu.edu.ph';
                      const userDept = normalizeProgramName(user.program || user.department || 'Computer Science');
                      const userTitle = user.title || (
                        user.role === 'student'
                          ? 'Student'
                          : isChairRole(user, user.role)
                            ? 'Department Chairperson'
                            : isDeanRole(user, user.role)
                              ? 'College Dean'
                              : user.role === 'admin' || user.role === 'superadmin'
                                ? 'University Administrator'
                                : user.role === 'staff'
                                  ? 'University Staff'
                                  : 'Faculty Instructor'
                      );

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-muted/40 transition-colors ${isCurrent ? 'bg-primary/5' : ''}`}
                        >
                          {/* User Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <UserAvatar
                                name={userName}
                                src={user.avatar}
                                className="w-9 h-9 rounded-full object-cover border border-border shadow-xs shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-bold text-foreground truncate block">
                                    {userName}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1 text-muted-foreground text-[11px] truncate">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{userEmail}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge & School Year Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                                {roleMeta.icon}
                                <span>{roleMeta.label}</span>
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 w-fit">
                                AY {user.schoolYear || '2025-2026'}
                              </span>
                            </div>
                          </td>

                          {/* Department & Title */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-foreground truncate max-w-xs">
                              {roleMeta.label === 'Admin' ? 'Admin' : userDept}
                            </div>
                            {roleMeta.label !== 'Admin' && (
                              <div className="text-[11px] text-muted-foreground truncate">{userTitle}</div>
                            )}
                          </td>

                          {/* Student ID / Identifier */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-foreground">
                            {user.studentId ? (
                              <span className="bg-muted px-2 py-0.5 rounded border border-border font-bold">
                                {user.studentId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-sans text-[11px]">—</span>
                            )}
                          </td>

                          {/* Course Shells */}
                          <td className="py-3.5 px-4">
                            <span className="font-sans text-[11px] text-muted-foreground">
                              {isFacultyRole(user, user.role) ? (
                                <span className="text-foreground font-semibold">
                                  {courseCount} {courseCount === 1 ? 'assigned shell' : 'assigned shells'}
                                </span>
                              ) : user.role === 'student' ? (
                                <span className="text-foreground font-semibold">
                                  {courseCount} {courseCount === 1 ? 'enrolled course' : 'enrolled courses'}
                                </span>
                              ) : (
                                <span>All Institutional Access</span>
                              )}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className={`py-3.5 px-4 text-right whitespace-nowrap relative ${openMenuUserId === user.id ? 'z-30' : ''}`}>
                            <div className="inline-block text-left relative" data-actions-menu>
                              <button
                                type="button"
                                aria-label={`Actions for ${userName}`}
                                aria-haspopup="true"
                                aria-expanded={openMenuUserId === user.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openMenuUserId === user.id) {
                                    setOpenMenuUserId(null);
                                  } else {
                                    const triggerRect = e.currentTarget.getBoundingClientRect();
                                    const windowHeight = window.innerHeight;
                                    const spaceBelow = windowHeight - triggerRect.bottom;
                                    const isTopRow = index === 0;
                                    const isShortList = filteredUsers.length <= 2;
                                    const isNearBottom = filteredUsers.length > 2 && index >= filteredUsers.length - 2;
                                    const shouldOpenUp = !isTopRow && !isShortList && (spaceBelow < 185 || isNearBottom);
                                    setMenuPlacement(shouldOpenUp ? 'up' : 'down');
                                    setOpenMenuUserId(user.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  openMenuUserId === user.id
                                    ? 'bg-accent text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                }`}
                                title="Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openMenuUserId === user.id && (
                                <div
                                  role="menu"
                                  aria-orientation="vertical"
                                  className={`absolute right-0 ${
                                    menuPlacement === 'up'
                                      ? 'bottom-full mb-1.5 origin-bottom-right'
                                      : 'top-full mt-1.5 origin-top-right'
                                  } w-36 bg-card text-foreground border border-border rounded-xl shadow-elevated z-40 py-1 font-sans text-xs animate-scale-in`}
                                >
                                  {!isCurrent && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuUserId(null);
                                        handleOpenViewPage(user);
                                      }}
                                      className="w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span className="font-medium">View</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={isCurrent}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCurrent) return;
                                      setOpenMenuUserId(null);
                                      handleOpenEditPage(user);
                                    }}
                                    className={`w-full flex items-center space-x-2 px-3 py-2 text-left transition-colors ${
                                      isCurrent
                                        ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                        : 'hover:bg-accent hover:text-foreground cursor-pointer'
                                    }`}
                                    title={isCurrent ? 'Cannot edit own account from directory' : 'Edit Account'}
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-medium">Edit</span>
                                  </button>

                                  <div className="my-1 border-t border-border/60" />

                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={isCurrent}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuUserId(null);
                                      if (!isCurrent) {
                                        setDeletingUser(user);
                                      }
                                    }}
                                    className={`w-full flex items-center space-x-2 px-3 py-2 text-left transition-colors ${
                                      isCurrent
                                        ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                        : 'text-red-500/90 hover:text-red-600 hover:bg-red-500/10 cursor-pointer'
                                    }`}
                                    title={isCurrent ? 'Cannot delete current session' : 'Delete Account'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="font-medium">Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING VERIFICATIONS QUEUE */}
      {activeMainTab === 'pending-verifications' && (
        <div className="space-y-6">
          <div className="p-4 bg-muted/40 border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-foreground">30-Day Registration Verification Window:</span>
                <span className="text-muted-foreground ml-1">
                  Registrations not verified by collegiate leadership within 30 days are automatically cancelled.
                </span>
              </div>
            </div>
            <div className="font-mono text-[11px] font-bold text-primary px-3 py-1 bg-background border border-border rounded-xl shrink-0">
              {scopedPendingRegistrations.length} {scopedPendingRegistrations.length === 1 ? 'applicant' : 'applicants'} queued
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold text-[12px]">
                    <th className="py-3.5 px-4">Applicant</th>
                    <th className="py-3.5 px-4">Role & ID</th>
                    <th className="py-3.5 px-4">Academic Unit</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-4">Countdown Window</th>
                    <th className="py-3.5 px-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scopedPendingRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-foreground">No pending registrations</p>
                        <p className="text-[11px] mt-1">
                          No applicants are currently awaiting verification in your administrative queue.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    scopedPendingRegistrations.map(reg => {
                      const daysRemaining = Math.ceil(
                        (new Date(reg.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const isExpired = daysRemaining <= 0 || reg.status === 'expired';
                      const isEmailVerified = Boolean(reg.emailVerified);
                      const applicantName = reg.fullName || `${reg.firstName} ${reg.lastName}`;

                      return (
                        <tr key={reg.id} className="hover:bg-muted/40 transition-colors">
                          {/* Applicant Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <UserAvatar
                                name={applicantName}
                                src=""
                                className="w-9 h-9 rounded-full object-cover border border-border shadow-xs shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-foreground truncate block">
                                  {applicantName}
                                </span>
                                <div className="flex items-center space-x-1 text-muted-foreground text-[11px] truncate">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{reg.email}</span>
                                </div>
                                {isEmailVerified ? (
                                  <div className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>Email verified</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center space-x-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Email unverified</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Role & ID */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md uppercase bg-primary/10 text-primary border border-primary/20">
                              {reg.role}
                            </span>
                            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                              {reg.studentId || '—'}
                            </div>
                          </td>

                          {/* Academic Unit */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground truncate max-w-xs">
                              {reg.program || reg.department}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {reg.collegeName || reg.collegeId}
                            </div>
                          </td>

                          {/* Registered At */}
                          <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center space-x-1 text-[11px]">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>{new Date(reg.registeredAt).toLocaleDateString()}</span>
                            </div>
                          </td>

                          {/* Expiration Countdown Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isExpired ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                                <XCircle className="w-3 h-3" />
                                <span>Expired / Cancelled</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>Expires in {daysRemaining} days</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                disabled={isExpired || !isEmailVerified || isVerifyingId === reg.id}
                                onClick={() => handleVerify(reg.id)}
                                title={
                                  !isEmailVerified
                                    ? 'Cannot approve: applicant email is unverified'
                                    : isExpired
                                    ? 'Cannot approve: registration has expired'
                                    : 'Verify and activate account'
                                }
                                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isVerifyingId === reg.id ? 'Verifying...' : 'Verify'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isRejectingId === reg.id}
                                onClick={() => handleReject(reg.id)}
                                className="px-3 py-1.5 bg-muted hover:bg-red-500/10 hover:text-red-600 text-muted-foreground font-semibold text-xs rounded-xl border border-border transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{isRejectingId === reg.id ? 'Rejecting...' : 'Reject'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}





      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <DialogFrame
          title="Delete User Account?"
          subtitle="This action will permanently remove this account from the college database."
          onClose={() => setDeletingUser(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </>
          }
        >
          <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-1 text-xs font-sans">
            <div className="font-bold text-foreground">{deletingUser.name}</div>
            <div className="text-muted-foreground">{deletingUser.email}</div>
            <div className="text-[11px] font-semibold text-primary uppercase">
              {deletingUser.role} • {deletingUser.program || deletingUser.department}
            </div>
          </div>
        </DialogFrame>
      )}

      {/* VERIFY / APPROVE CONFIRMATION MODAL */}
      {verifyingReg && (
        <DialogFrame
          title="Verify & Approve Account"
          subtitle="Confirm verification to approve this applicant and provision their active institutional account."
          onClose={() => setVerifyingReg(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setVerifyingReg(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={isVerifyingId === verifyingReg.id}
                className="px-4 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isVerifyingId === verifyingReg.id ? 'Approving...' : 'Confirm Verification'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs font-sans">
            <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-2.5">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  name={verifyingReg.fullName || `${verifyingReg.firstName} ${verifyingReg.lastName}`}
                  src=""
                  className="w-10 h-10 rounded-full object-cover border border-border shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-foreground text-sm truncate">
                    {verifyingReg.fullName || `${verifyingReg.firstName} ${verifyingReg.lastName}`}
                  </div>
                  <div className="text-muted-foreground truncate">{verifyingReg.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Role:</span>
                  <span className="font-bold uppercase text-primary">{verifyingReg.role}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Student / Employee ID:</span>
                  <span className="font-mono font-semibold text-foreground">{verifyingReg.studentId || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Academic Program:</span>
                  <span className="font-semibold text-foreground truncate block">{verifyingReg.program || verifyingReg.department}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Email Verification:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Approving this applicant will activate their account in the institutional directory, allowing them to sign in and access the LMS immediately.
            </p>
          </div>
        </DialogFrame>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {rejectingReg && (
        <DialogFrame
          title="Reject Registration"
          subtitle="Are you sure you want to decline this registration? This will mark the registration as rejected."
          onClose={() => {
            setRejectingReg(null);
            setRejectReason('');
          }}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setRejectingReg(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejectingId === rejectingReg.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isRejectingId === rejectingReg.id ? 'Rejecting...' : 'Reject Registration'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs font-sans">
            <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-2">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  name={rejectingReg.fullName || `${rejectingReg.firstName} ${rejectingReg.lastName}`}
                  src=""
                  className="w-10 h-10 rounded-full object-cover border border-border shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-foreground text-sm truncate">
                    {rejectingReg.fullName || `${rejectingReg.firstName} ${rejectingReg.lastName}`}
                  </div>
                  <div className="text-muted-foreground truncate">{rejectingReg.email}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {rejectingReg.role.toUpperCase()} • {rejectingReg.program || rejectingReg.department}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Reason for Rejection <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Provide a reason for declining this applicant (e.g. invalid credentials, duplicate submission)..."
                className="w-full text-xs p-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
