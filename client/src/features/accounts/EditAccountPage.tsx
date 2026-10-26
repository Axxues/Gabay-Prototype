import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { formatIdNumber, isValidIdNumber, ID_NUMBER_EXAMPLE } from '../../shared/utils/idNumber';
import type { User, UserRole } from '../../shared/types/lms';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { CustomDropdown, type DropdownOption } from '../../shared/components/common/CustomDropdown';
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Eye,
  EyeOff,
  Check,
  Building,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface EditAccountPageProps {
  user: User;
  onNavigateTab: (tab: string) => void;
}

const parseInitialName = (u: User) => {
  if (u.firstName !== undefined || u.lastName !== undefined) {
    return {
      firstName: u.firstName || '',
      middleName: u.middleName || '',
      lastName: u.lastName || '',
    };
  }
  const parts = (u.name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

export const EditAccountPage: React.FC<EditAccountPageProps> = ({ user, onNavigateTab }) => {
  const { updateUser, showAlert, programs, departments, colleges } = useLMS();

  const isLeadershipSeat = useMemo(() => {
    return (
      user.adminSubrole === 'dean' ||
      user.adminSubrole === 'chairperson' ||
      user.adminSubrole === 'chancellor' ||
      (colleges || []).some(c => c.deanId === user.id) ||
      (departments || []).some(d => d.chairpersonId === user.id)
    );
  }, [user, colleges, departments]);

  const initialNames = parseInitialName(user);
  const [formFirstName, setFormFirstName] = useState(initialNames.firstName);
  const [formMiddleName, setFormMiddleName] = useState(initialNames.middleName);
  const [formLastName, setFormLastName] = useState(initialNames.lastName);

  const [formEmail, setFormEmail] = useState(user.email || '');
  const [formIdNumber, setFormIdNumber] = useState(user.studentId || '');
  const [formRole, setFormRole] = useState<UserRole>(user.role);
  const [formYearLevel, setFormYearLevel] = useState<number>(user.yearLevel ?? 1);
  const rawUserDept = user.program || user.department || 'Computer Science';
  const initialDept = rawUserDept.replace(/^Program in\s+/i, '');
  const [formDepartment, setFormDepartment] = useState(initialDept);
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departmentSelectOptions: DropdownOption[] = useMemo(() => {
    const list = (programs || departments || []).map(p => p.name);
    const defaultList = list.length > 0 ? list : ['Computer Science'];
    const extras = ['College of Computer Science', 'Office of the College Registrar', 'Office of the Dean'];
    const combined = Array.from(new Set([...defaultList, ...extras]));
    return combined.map(d => ({
      value: d,
      label: d,
      icon: <Building className="w-3.5 h-3.5 text-muted-foreground" />
    }));
  }, [programs, departments]);

  const roleOptions: DropdownOption[] = [
    { value: 'faculty', label: 'Faculty Instructor', icon: <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> },
    { value: 'student', label: 'Enrolled Student', icon: <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> },
    { value: 'staff', label: 'Non-Teaching Staff', icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> },
    { value: 'admin', label: 'Administrator', icon: <Building className="w-3.5 h-3.5 text-primary" /> }
  ];

  const previewMeta = useMemo(() => {
    const defaultTitle = formRole === 'student' ? 'Student' : formRole === 'faculty' ? 'Faculty Instructor' : formRole === 'admin' ? 'Administrator' : 'Staff';
    const roleLabel = formRole === 'admin' ? 'Admin' : formRole === 'faculty' ? 'Faculty' : formRole === 'staff' ? 'Staff' : 'Student';
    return { defaultTitle, roleLabel };
  }, [formRole]);

  const previewFullName = [formFirstName.trim(), formMiddleName.trim(), formLastName.trim()].filter(Boolean).join(' ') || user.name || formEmail.trim() || 'Unnamed Account';

  const handleBack = () => onNavigateTab('accounts');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirstName = formFirstName.trim();
    const cleanMiddleName = formMiddleName.trim();
    const cleanLastName = formLastName.trim();
    const cleanEmail = formEmail.trim();
    const cleanIdNumber = formIdNumber.trim();
    if (!cleanEmail) {
      showAlert({
        title: 'Required Information',
        message: 'Please provide an Institutional Email.',
        type: 'warning'
      });
      return;
    }
    if (!cleanIdNumber) {
      showAlert({
        title: 'Required Information',
        message: 'Please provide an ID Number for this account.',
        type: 'warning'
      });
      return;
    }
    if (!isValidIdNumber(cleanIdNumber)) {
      showAlert({
        title: 'Invalid ID Number',
        message: `ID Number must follow the format XXX-XXXX-X (e.g. ${ID_NUMBER_EXAMPLE}).`,
        type: 'warning'
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const computedName = [cleanFirstName, cleanMiddleName, cleanLastName].filter(Boolean).join(' ') || user.name?.trim() || cleanEmail;
      const ok = await updateUser(user.id, {
        firstName: cleanFirstName,
        middleName: cleanMiddleName,
        lastName: cleanLastName,
        name: computedName,
        email: cleanEmail,
        role: isLeadershipSeat ? 'admin' : formRole,
        adminSubrole: isLeadershipSeat ? (user.adminSubrole || 'chancellor') : undefined,
        department: formDepartment,
        program: formDepartment,
        studentId: cleanIdNumber,
        ...(formPassword.trim() ? { password: formPassword.trim() } : {}),
        ...(formRole === 'student' ? { yearLevel: formYearLevel } : {})
      });
      if (!ok) return;

      showAlert({
        title: 'Account Updated',
        message: `Account settings for "${cleanEmail}" (name, email, password, role, program, ID number) have been saved successfully.`,
        type: 'success'
      });
      onNavigateTab('accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in max-w-5xl mx-auto pt-2 pb-24 px-2 sm:px-4 font-sans select-none">
      {/* Breadcrumb + header */}
      <div className="pb-4 border-b border-border/80">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={handleBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Manage College Accounts</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-primary font-bold px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px]">
              Edit Account
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span>Edit college account</span>
              </h1>
              <p className="text-[13px] text-muted-foreground font-normal pl-0.5">
                Modifying record for {user.name || user.email}. Changes apply as soon as you save.
              </p>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-card hover:bg-muted/60 border border-border rounded-xl transition-all shadow-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-account-form"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <form id="edit-account-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: form cards */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/60 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                1. Account identity
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="edit-first-name" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="edit-first-name"
                  type="text"
                  required
                  value={formFirstName}
                  onChange={e => setFormFirstName(e.target.value)}
                  placeholder="e.g. Maria"
                  className="w-full px-3.5 py-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-none"
                />
              </div>
              <div>
                <label htmlFor="edit-middle-name" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Middle Name <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                </label>
                <input
                  id="edit-middle-name"
                  type="text"
                  value={formMiddleName}
                  onChange={e => setFormMiddleName(e.target.value)}
                  placeholder="e.g. Delos"
                  className="w-full px-3.5 py-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-none"
                />
              </div>
              <div>
                <label htmlFor="edit-last-name" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="edit-last-name"
                  type="text"
                  required
                  value={formLastName}
                  onChange={e => setFormLastName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3.5 py-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Institutional email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="e.g. jdoe@dmmmsu.edu.ph"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                If no full name is set on the account, this email will be used as their name.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                ID Number *
              </label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={formIdNumber}
                  onChange={e => setFormIdNumber(formatIdNumber(e.target.value))}
                  placeholder={`e.g. ${ID_NUMBER_EXAMPLE}`}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="\d{3}-\d{4}-\d"
                  title={`ID Number format: XXX-XXXX-X (e.g. ${ID_NUMBER_EXAMPLE})`}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Format XXX-XXXX-X (e.g. {ID_NUMBER_EXAMPLE}). Shown on the user's profile.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/60 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                2. Role & program selection
              </span>
            </div>
            {isLeadershipSeat && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Institutional Leadership Office Seat</span>
                </div>
                <p>
                  This account is an official leadership seat ({user.adminSubrole === 'dean' ? 'Dean' : user.adminSubrole === 'chairperson' ? 'Program Chairperson' : 'Administrator'}).
                  Under university policy, leadership accounts never step down to faculty or student.
                  To reassign this office seat, use Leadership Authority Transfer in Academic Governance.
                </p>
              </div>
            )}
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Account role *
              </label>
              <CustomDropdown
                value={isLeadershipSeat ? 'admin' : formRole}
                onChange={val => {
                  if (!isLeadershipSeat) setFormRole(val as UserRole);
                }}
                disabled={isLeadershipSeat}
                options={roleOptions}
                placeholder="Select Account Role"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Program *
              </label>
              <CustomDropdown
                value={formDepartment}
                onChange={setFormDepartment}
                options={departmentSelectOptions}
                searchable
                placeholder="Select Program"
              />
            </div>
            {formRole === 'student' && (
              <div>
                <label htmlFor="edit-student-year-level" className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Year Level *
                </label>
                <CustomDropdown
                  id="edit-student-year-level"
                  ariaLabel="Year Level"
                  value={String(formYearLevel)}
                  onChange={v => setFormYearLevel(Number(v))}
                  options={[
                    { value: '1', label: '1 - 1st Year' },
                    { value: '2', label: '2 - 2nd Year' },
                    { value: '3', label: '3 - 3rd Year' },
                    { value: '4', label: '4 - 4th Year' },
                  ]}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Students cannot modify their own year level. Only Dean, Chairperson, or Administrators can update this.
                </p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/60 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                3. Access credentials
              </span>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Account password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Leave unchanged or enter new password"
                  className="w-full pr-10 p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Enter a new password to update account credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <span className="text-[12px] font-semibold text-muted-foreground">
                Account preview
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">Live</span>
            </div>
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5 shadow-none">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  name={previewFullName}
                  src={user.avatar}
                  className="w-10 h-10 rounded-full object-cover border border-border shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-xs text-foreground truncate">
                    {previewFullName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formEmail.trim() || 'Institutional email'}
                  </div>
                </div>
              </div>
              <div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-muted text-muted-foreground border-border">
                  {previewMeta.roleLabel}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground truncate">{formDepartment}</div>
                <div className="truncate">{user.title || previewMeta.defaultTitle}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-2.5">
              <span className="text-[12px] font-semibold text-muted-foreground block">
              Before you save
            </span>
            <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Changes to <span className="font-semibold text-foreground">email, role, program, and password</span> apply immediately.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Role controls access — switching roles changes what the user can see.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Use <span className="font-semibold text-foreground">Cancel</span> to return without saving.</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
