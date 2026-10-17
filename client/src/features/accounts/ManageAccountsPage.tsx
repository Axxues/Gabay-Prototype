import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { User, UserRole } from '../../shared/types/lms';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import { getDisplayRoleLabel, compareUsersByAuthority } from '../../shared/utils/roles';
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
  ChevronDown,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Inbox
} from 'lucide-react';


interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  icon,
  className = '',
  buttonClassName = '',
  searchable = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase().trim()))
    : options;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-2.5 bg-background border rounded-xl text-xs font-sans transition-all cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed border-border' : ''
        } ${
          isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-none'
            : 'border-border hover:border-primary/50 text-foreground'
        } ${buttonClassName}`}
      >
        <div className="flex items-center space-x-2 truncate mr-2">
          {icon || selectedOption?.icon}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-elevated overflow-hidden animate-scale-in">
          {searchable && (
            <div className="p-2 border-b border-border bg-muted/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter..."
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs font-sans text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground font-sans">
                No matching options
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-foreground hover:bg-primary/10 hover:text-primary font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ManageAccountsPageProps {
  onNavigateTab?: (tab: string) => void;
  onEditAccount?: (user: User) => void;
}

export const ManageAccountsPage: React.FC<ManageAccountsPageProps> = ({ onNavigateTab, onEditAccount }) => {
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
    departments
  } = useLMS();

  // Navigation tab state
  const [activeMainTab, setActiveMainTab] = useState<'active-directory' | 'pending-verifications'>('active-directory');

  // Search & Filter state for Active Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Modal state (delete only — editing lives on dedicated Edit Account page)
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Verification queue action states
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);

  // Scoped Pending Registrations calculation
  const scopedPendingRegistrations = useMemo(() => {
    const list = (pendingRegistrations || []).filter(r => r.status === 'pending' || !r.status);

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

    // Chairperson: sees all pending registrations in their department
    if (activeRole === 'admin' && activeUser?.adminSubrole === 'chairperson') {
      return list.filter(r => {
        if (
          activeUser?.department &&
          r.department &&
          r.department.toLowerCase() === activeUser.department.toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    }

    // Fallbacks for other roles
    if (activeUser?.department) {
      return list.filter(
        r => r.department && r.department.toLowerCase() === activeUser.department.toLowerCase()
      );
    }
    if (activeUser?.collegeId) {
      return list.filter(r => r.collegeId === activeUser.collegeId);
    }

    return list;
  }, [pendingRegistrations, activeRole, activeUser]);

  // Role scoping helpers
  const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
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

  // Dynamically aggregated departments from registered hierarchy and all active users
  const allDepartments = useMemo(() => {
    const deptSet = new Set<string>();
    (departments || []).forEach(d => {
      if (d.name) deptSet.add(d.name.trim());
    });
    if (deptSet.size === 0) {
      deptSet.add('Department of Computer Science');
    }
    (db?.users || []).forEach(u => {
      if (u?.department && typeof u.department === 'string') {
        deptSet.add(u.department.trim());
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

      // Department filter
      if (departmentFilter !== 'all' && (user.department || '') !== departmentFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (user.name || '').toLowerCase().includes(q);
        const matchEmail = (user.email || '').toLowerCase().includes(q);
        const matchDept = (user.department || '').toLowerCase().includes(q);
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
  }, [scopedDirectoryUsers, roleFilter, departmentFilter, searchQuery]);

  // Custom Dropdown option definitions scoped by available departments
  const departmentFilterOptions: DropdownOption[] = useMemo(() => {
    if (isDean) {
      return [
        { value: 'all', label: 'All Departments', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
        ...availableDepartments.map(d => ({
          value: d.name,
          label: d.name,
          icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
        }))
      ];
    }

    if (availableDepartments && availableDepartments.length > 0) {
      return [
        { value: 'all', label: 'All Departments', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
        ...availableDepartments.map(d => ({
          value: d.name,
          label: d.name,
          icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
        }))
      ];
    }

    return [
      { value: 'all', label: 'All Departments', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
      ...allDepartments.map(d => ({
        value: d,
        label: d,
        icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
      }))
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

  // Handle Verify Registration
  const handleVerify = async (id: string) => {
    if (isVerifyingId) return;
    setIsVerifyingId(id);
    try {
      const res = await verifyRegistration(id);
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

  // Handle Reject Registration
  const handleReject = async (id: string) => {
    if (isRejectingId) return;
    setIsRejectingId(id);
    try {
      const res = await rejectRegistration(id);
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
      </div>

      {/* TAB 1: ACTIVE DIRECTORY */}
      {activeMainTab === 'active-directory' && (
        <div className="space-y-6">
          {/* 5-Card Metric Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {/* Card 1: Total Accounts */}
            <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-primary/40 rounded-2xl shadow-none flex flex-col justify-between transition-all duration-200 group col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground truncate">
                  Total Accounts
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight">
                  {stats.total}
                </div>
              </div>
            </div>

            {/* Card 2: Faculty Instructors */}
            <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-emerald-500/40 rounded-2xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground truncate">
                  Faculty Instructors
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight">
                  {stats.faculty}
                </div>
              </div>
            </div>

            {/* Card 3: Enrolled Students */}
            <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-blue-500/40 rounded-2xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground truncate">
                  Enrolled Students
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight">
                  {stats.students}
                </div>
              </div>
            </div>

            {/* Card 4: College Administrators */}
            <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-primary/40 rounded-2xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground truncate">
                  College Administrators
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Building className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight">
                  {stats.admin}
                </div>
              </div>
            </div>

            {/* Card 5: Non-Teaching Staff */}
            <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-amber-500/40 rounded-2xl shadow-none flex flex-col justify-between transition-all duration-200 group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground truncate">
                  Non-Teaching Staff
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground font-sans tracking-tight">
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
                placeholder="Search by name, email, student ID, or department..."
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
                placeholder="All Departments"
                className="w-full sm:w-64"
                buttonClassName="py-2 px-3 bg-muted/60"
              />
            </div>
          </div>

          {/* Accounts List Table / Cards */}
          <div className="bg-card border border-border rounded-2xl shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold text-[12px]">
                    <th className="py-3.5 px-4">User Account</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department & Position</th>
                    <th className="py-3.5 px-4">Academic ID</th>
                    <th className="py-3.5 px-4">Courses / Attachments</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
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
                    filteredUsers.map(user => {
                      const roleMeta = getRoleBadge(user.role, user);
                      const isCurrent = activeUser ? user.id === activeUser.id : false;

                      // Course count
                      let courseCount = 0;
                      if (user.role === 'faculty') {
                        courseCount = (db?.courses || []).filter(c => c.instructorId === user.id).length;
                      } else if (user.role === 'student') {
                        courseCount = (user.enrolledCourseIds || []).length;
                      }

                      const userName = user.name || 'Unnamed Account';
                      const userEmail = user.email || 'no-email@dmmmsu.edu.ph';
                      const userDept = user.department || 'Department of Computer Science';
                      const userTitle = user.title || (user.role === 'student' ? 'Student' : 'Faculty Instructor');

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

                          {/* Role Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                              {roleMeta.icon}
                              <span>{roleMeta.label}</span>
                            </span>
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
                              {user.role === 'faculty' ? (
                                <span className="text-foreground font-semibold">
                                  {courseCount} {courseCount === 1 ? 'assigned shell' : 'assigned shells'}
                                </span>
                              ) : user.role === 'student' ? (
                                <span className="text-foreground font-semibold">
                                  {courseCount} {courseCount === 1 ? 'enrolled course' : 'enrolled courses'}
                                </span>
                              ) : (
                                <span>All Departmental Access</span>
                              )}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditPage(user)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
                                title="Edit Account Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingUser(user)}
                                disabled={isCurrent}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isCurrent
                                    ? 'text-muted-foreground/30 cursor-not-allowed'
                                    : 'text-red-500/80 hover:text-red-600 hover:bg-red-500/10'
                                }`}
                                title={isCurrent ? 'Cannot delete current session' : 'Delete Account'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                              {reg.department}
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
                                disabled={isExpired || isVerifyingId === reg.id}
                                onClick={() => handleVerify(reg.id)}
                                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
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
              {deletingUser.role} • {deletingUser.department}
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
