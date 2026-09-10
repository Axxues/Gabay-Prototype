import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import type { User, UserRole } from '../types/lms';
import { PageHeader } from '../components/common/PageHeader';
import { DialogFrame } from '../components/common/DialogFrame';
import {
  Users,
  UserPlus,
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
  Eye,
  EyeOff,
  ChevronDown,
  Check
} from 'lucide-react';

const PRESET_AVATARS = [
  { label: 'Avatar 1 (Dean)', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { label: 'Avatar 2 (Faculty Male)', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'Avatar 3 (Faculty Female)', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { label: 'Avatar 4 (Student Male)', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { label: 'Avatar 5 (Student Female)', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { label: 'Avatar 6 (Academic)', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' }
];

const DEPARTMENTS = [
  'Department of Computer Science',
  'Department of Information Technology',
  'Department of Information Systems',
  'College of Computer Science',
  'Office of the College Registrar',
  'Office of the Dean'
];

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
            ? 'border-primary ring-2 ring-primary/20 shadow-subtle'
            : 'border-border hover:border-primary/50 text-foreground'
        } ${buttonClassName}`}
      >
        <div className="flex items-center space-x-2 truncate min-w-0 mr-2">
          {selectedOption?.icon || icon ? (
            <span className="shrink-0">{selectedOption?.icon || icon}</span>
          ) : null}
          <span className="truncate font-semibold text-foreground">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div
          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          }`}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 dropdown-panel p-1.5 z-[120] animate-dropdown max-h-64 flex flex-col shadow-xl">
          {searchable && options.length > 4 && (
            <div className="p-1 pb-1.5 border-b border-border/60 mb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter options..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-sans outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto custom-scrollbar space-y-0.5 max-h-52">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
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
}

export const ManageAccountsPage: React.FC<ManageAccountsPageProps> = () => {
  const { db, activeUser, activeRole, createUser, updateUser, deleteUser, showAlert, setIsRoleModalOpen, resetData } = useLMS();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Form states (Create & Edit - restricted to Email, Role, Department, Password)
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('faculty');
  const [formDepartment, setFormDepartment] = useState('Department of Computer Science');
  const [formPassword, setFormPassword] = useState('gabay2026');
  const [showPassword, setShowPassword] = useState(false);

  // Dynamically aggregated departments from base list and all active users
  const allDepartments = useMemo(() => {
    const deptSet = new Set<string>(DEPARTMENTS);
    (db?.users || []).forEach(u => {
      if (u?.department && typeof u.department === 'string') {
        deptSet.add(u.department.trim());
      }
    });
    return Array.from(deptSet).sort();
  }, [db?.users]);

  // Computed summary metrics - 5 distinct unmerged metrics
  const stats = useMemo(() => {
    const userList = db?.users || [];
    const total = userList.length;
    const faculty = userList.filter(u => u?.role === 'faculty').length;
    const students = userList.filter(u => u?.role === 'student').length;
    const admin = userList.filter(u => u?.role === 'admin').length;
    const staff = userList.filter(u => u?.role === 'staff').length;
    return { total, faculty, students, admin, staff };
  }, [db?.users]);

  // Filtered accounts list with complete null safety
  const filteredUsers = useMemo(() => {
    const userList = db?.users || [];
    return userList.filter(user => {
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
        if (!matchName && !matchEmail && !matchDept && !matchTitle && !matchStudentId) {
          return false;
        }
      }

      return true;
    });
  }, [db?.users, roleFilter, departmentFilter, searchQuery]);

  // Custom Dropdown option definitions
  const departmentFilterOptions: DropdownOption[] = useMemo(() => [
    { value: 'all', label: 'All Departments', icon: <Building className="w-3.5 h-3.5 text-muted-foreground" /> },
    ...allDepartments.map(d => ({
      value: d,
      label: d,
      icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
    }))
  ], [allDepartments]);

  const departmentSelectOptions: DropdownOption[] = useMemo(() => DEPARTMENTS.map(d => ({
    value: d,
    label: d,
    icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
  })), []);

  const roleOptions: DropdownOption[] = [
    {
      value: 'faculty',
      label: 'Faculty Instructor',
      icon: <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
    },
    {
      value: 'student',
      label: 'Enrolled Student',
      icon: <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    },
    {
      value: 'staff',
      label: 'Non-Teaching Staff',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
    },
    {
      value: 'admin',
      label: 'Dean / Administrator',
      icon: <Building className="w-3.5 h-3.5 text-primary" />
    }
  ];

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormEmail('');
    setFormRole('faculty');
    setFormDepartment('Department of Computer Science');
    setFormPassword('gabay2026');
    setShowPassword(false);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email || '');
    setFormRole(user.role);
    setFormDepartment(user.department || 'Department of Computer Science');
    setFormPassword(user.password || 'gabay2026');
    setShowPassword(false);
  };

  // Submit Create Account
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = formEmail.trim();
    if (!cleanEmail) {
      showAlert({
        title: 'Required Information',
        message: 'Please provide an Institutional Email.',
        type: 'warning'
      });
      return;
    }

    const defaultTitle = formRole === 'student' ? 'Student' : formRole === 'faculty' ? 'Faculty Instructor' : formRole === 'admin' ? 'Dean / Administrator' : 'Staff / Registrar Aide';
    const defaultAvatar = formRole === 'student' ? PRESET_AVATARS[3].url : formRole === 'faculty' ? PRESET_AVATARS[1].url : formRole === 'admin' ? PRESET_AVATARS[0].url : PRESET_AVATARS[2].url;

    const created = createUser({
      name: cleanEmail,
      email: cleanEmail,
      role: formRole,
      department: formDepartment,
      title: defaultTitle,
      studentId: formRole === 'student' ? `2026-SLUC-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
      password: formPassword.trim() || 'gabay2026',
      avatar: defaultAvatar
    });

    setIsCreateModalOpen(false);
    showAlert({
      title: 'Account Provisioned',
      message: `User account for "${created.email}" (${created.role.toUpperCase()}) has been created successfully.`,
      type: 'success'
    });
  };

  // Submit Edit Account
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanEmail = formEmail.trim();
    if (!cleanEmail) {
      showAlert({
        title: 'Required Information',
        message: 'Please provide an Institutional Email.',
        type: 'warning'
      });
      return;
    }

    const finalName = editingUser.name?.trim() || cleanEmail;

    updateUser(editingUser.id, {
      name: finalName,
      email: cleanEmail,
      role: formRole,
      department: formDepartment,
      password: formPassword.trim() || editingUser.password || 'gabay2026'
    });

    setEditingUser(null);
    showAlert({
      title: 'Account Updated',
      message: `Account settings for "${cleanEmail}" (email, password, role, department) have been saved successfully.`,
      type: 'success'
    });
  };

  // Submit Delete Account
  const handleDeleteConfirm = () => {
    if (!deletingUser) return;
    const res = deleteUser(deletingUser.id);
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
  };

  const getRoleBadge = (role?: string) => {
    const normalized = (role || '').toLowerCase();
    switch (normalized) {
      case 'admin':
        return {
          label: 'DEAN / ADMIN',
          badgeClass: 'bg-primary/10 text-primary border-primary/20',
          icon: <Building className="w-3 h-3" />
        };
      case 'faculty':
      case 'instructor':
        return {
          label: 'FACULTY',
          badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          icon: <UserCheck className="w-3 h-3" />
        };
      case 'staff':
        return {
          label: 'REGISTRAR / STAFF',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          icon: <ShieldCheck className="w-3 h-3" />
        };
      case 'student':
        return {
          label: 'STUDENT',
          badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
          icon: <GraduationCap className="w-3 h-3" />
        };
      default:
        return {
          label: (role || 'USER').toUpperCase(),
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: <Building className="w-3 h-3" />
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Role Notice if viewing as non-admin */}
      {activeRole !== 'admin' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Administrative Console Preview:</span> You are currently browsing as <strong>{activeRole.toUpperCase()}</strong>. Full college account creation and editing are enabled for demonstration.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-500 text-white dark:text-amber-950 font-bold text-xs rounded-xl shadow-xs hover:bg-amber-600 transition-colors shrink-0 cursor-pointer"
          >
            Switch to Dean / Admin
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <PageHeader
        title="Manage College Accounts"
        description="Centrally provision, edit, configure, and manage user accounts across all College of Computer Science departments."
        actions={
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl transition-all shadow-primary-sm flex items-center justify-center space-x-2 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New Account</span>
          </button>
        }
      />

      {/* 5-Card Metric Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Total Accounts */}
        <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-primary/40 rounded-2xl shadow-subtle flex flex-col justify-between transition-all duration-200 group col-span-2 sm:col-span-1">
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
        <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-emerald-500/40 rounded-2xl shadow-subtle flex flex-col justify-between transition-all duration-200 group">
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
        <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-blue-500/40 rounded-2xl shadow-subtle flex flex-col justify-between transition-all duration-200 group">
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
        <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-primary/40 rounded-2xl shadow-subtle flex flex-col justify-between transition-all duration-200 group">
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
        <div className="p-4 sm:p-4.5 bg-card border border-border hover:border-amber-500/40 rounded-2xl shadow-subtle flex flex-col justify-between transition-all duration-200 group">
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
      <div className="p-4 bg-card border border-border rounded-2xl shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                  ? 'bg-card text-foreground shadow-subtle font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({db.users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('faculty')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                roleFilter === 'faculty'
                  ? 'bg-card text-foreground shadow-subtle font-bold'
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
                  ? 'bg-card text-foreground shadow-subtle font-bold'
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
                  ? 'bg-card text-foreground shadow-subtle font-bold'
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
                  ? 'bg-card text-foreground shadow-subtle font-bold'
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
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
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
                        onClick={resetData}
                        className="mt-3 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-primary-sm hover:bg-primary/90 transition-all cursor-pointer"
                      >
                        Restore Institutional Accounts
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const roleMeta = getRoleBadge(user.role);
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
                  const userAvatar = user.avatar || PRESET_AVATARS[0].url;
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
                          <img
                            src={userAvatar}
                            alt={userName}
                            className="w-9 h-9 rounded-full object-cover border border-border shadow-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-foreground truncate block">
                                {userName}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-primary/20 text-primary rounded-md border border-primary/30">
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
                        <div className="font-medium text-foreground truncate max-w-xs">{userDept}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{userTitle}</div>
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
                            onClick={() => handleOpenEditModal(user)}
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

      {/* CREATE ACCOUNT MODAL */}
      {isCreateModalOpen && (
          <DialogFrame
            title="Provision College Account"
            subtitle="Create an official institutional account with access credentials."
            onClose={() => setIsCreateModalOpen(false)}
          >
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {/* Institutional Email */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="e.g. jdoe@dmmmsu.edu.ph"
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    The email address will also be used as the account display name.
                  </span>
                </div>

                {/* Role & Department */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Account Role *
                    </label>
                    <CustomDropdown
                      value={formRole}
                      onChange={val => setFormRole(val as UserRole)}
                      options={roleOptions}
                      placeholder="Select Account Role"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Department *
                    </label>
                    <CustomDropdown
                      value={formDepartment}
                      onChange={setFormDepartment}
                      options={departmentSelectOptions}
                      searchable={true}
                      placeholder="Select Department"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Initial Account Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="gabay2026"
                      className="w-full pr-10 p-2.5 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Default demo password is "gabay2026". Users can use this to sign into Gabay LMS.
                  </span>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-primary-sm transition-all cursor-pointer"
                  >
                    Create Account
                  </button>
                </div>
              </form>
          </DialogFrame>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingUser && (
          <DialogFrame
            title="Edit Account Details"
            subtitle={`Modifying record for ${editingUser.name}`}
            onClose={() => setEditingUser(null)}
          >
              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* Institutional Email */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="e.g. jdoe@dmmmsu.edu.ph"
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    If no full name is set on the account, this email will be used as their name.
                  </span>
                </div>

                {/* Role & Department */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Account Role *
                    </label>
                    <CustomDropdown
                      value={formRole}
                      onChange={val => setFormRole(val as UserRole)}
                      options={roleOptions}
                      placeholder="Select Account Role"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Department *
                    </label>
                    <CustomDropdown
                      value={formDepartment}
                      onChange={setFormDepartment}
                      options={departmentSelectOptions}
                      searchable={true}
                      placeholder="Select Department"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Account Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="Leave unchanged or enter new password"
                      className="w-full pr-10 p-2.5 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Enter a new password to update account credentials.
                  </span>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-primary-sm transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
          </DialogFrame>
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Delete Account
                </button>
              </>
            }
          >
              <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-1 text-xs font-sans">
                <div className="font-bold text-foreground">{deletingUser.name}</div>
                <div className="text-muted-foreground">{deletingUser.email}</div>
                <div className="text-[11px] font-semibold text-primary uppercase">{deletingUser.role} • {deletingUser.department}</div>
              </div>
          </DialogFrame>
      )}
    </div>
  );
};
