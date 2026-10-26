import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { formatIdNumber, isValidIdNumber, ID_NUMBER_EXAMPLE } from '../../shared/utils/idNumber';
import type { UserRole } from '../../shared/types/lms';
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
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface CreateAccountPageProps {
  onNavigateTab: (tab: string) => void;
}

export const CreateAccountPage: React.FC<CreateAccountPageProps> = ({ onNavigateTab }) => {
  const {
    createUser,
    showAlert,
    programs,
    departments,
    colleges,
    schoolYears,
    activeUser,
    getActiveSchoolYearForCollege,
    getSchoolYearsByCollege
  } = useLMS();

  const [formEmail, setFormEmail] = useState('');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('faculty');
  const [formDepartment, setFormDepartment] = useState('Computer Science');

  // Determine current college (considering selected program when applicable)
  const currentCollegeId = useMemo(() => {
    if (formDepartment && departments) {
      const prog = departments.find(d => d.name === formDepartment || d.code === formDepartment);
      if (prog?.collegeId) return prog.collegeId;
    }
    if (activeUser?.collegeId) return activeUser.collegeId;
    if (activeUser?.collegeName && colleges) {
      const match = colleges.find(c => c.name.toLowerCase() === activeUser.collegeName?.toLowerCase());
      if (match) return match.id;
    }
    return colleges?.[0]?.id || 'col-ccs';
  }, [formDepartment, departments, activeUser, colleges]);

  // Initial active school year
  const defaultSchoolYear = useMemo(() => {
    if (currentCollegeId) {
      const activeSy = getActiveSchoolYearForCollege?.(currentCollegeId);
      if (activeSy?.year) return activeSy.year;
      const list = getSchoolYearsByCollege?.(currentCollegeId) || (schoolYears || []).filter(sy => sy.collegeId === currentCollegeId);
      const active = list.find(s => s.isActive);
      if (active?.year) return active.year;
      if (list[0]?.year) return list[0].year;
    }
    const ccsActive = getActiveSchoolYearForCollege?.('col-ccs');
    return ccsActive?.year || '2025-2026';
  }, [currentCollegeId, getActiveSchoolYearForCollege, getSchoolYearsByCollege, schoolYears]);

  const [formSchoolYear, setFormSchoolYear] = useState(defaultSchoolYear);
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default school year if it loads asynchronously
  useEffect(() => {
    if (!formSchoolYear && defaultSchoolYear) {
      setFormSchoolYear(defaultSchoolYear);
    }
  }, [defaultSchoolYear, formSchoolYear]);

  // School Year options
  const schoolYearSelectOptions: DropdownOption[] = useMemo(() => {
    const list = new Set<string>();
    if (currentCollegeId) {
      const cList = getSchoolYearsByCollege?.(currentCollegeId) || (schoolYears || []).filter(sy => sy.collegeId === currentCollegeId);
      cList.forEach(sy => { if (sy.year) list.add(sy.year.trim()); });
    }
    (schoolYears || []).forEach(sy => { if (sy.year) list.add(sy.year.trim()); });
    list.add('2024-2025');
    list.add('2025-2026');
    list.add('2026-2027');

    return Array.from(list).sort((a, b) => b.localeCompare(a)).map(yr => ({
      value: yr,
      label: yr,
      icon: <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
    }));
  }, [currentCollegeId, getSchoolYearsByCollege, schoolYears]);

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
    const roleLabel = formRole === 'admin' ? 'ADMIN' : formRole === 'faculty' ? 'FACULTY' : formRole === 'staff' ? 'STAFF' : 'STUDENT';
    return { defaultTitle, roleLabel };
  }, [formRole]);

  const handleBack = () => onNavigateTab('accounts');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const created = await createUser({
        name: cleanEmail,
        email: cleanEmail,
        role: formRole,
        department: formDepartment,
        program: formDepartment,
        schoolYear: formSchoolYear || undefined,
        collegeId: currentCollegeId,
        title: previewMeta.defaultTitle,
        studentId: cleanIdNumber,
        password: formPassword.trim(),
        avatar: ''
      }).catch(() => null);
      if (!created) return;

      showAlert({
        title: 'Account Provisioned',
        message: `User account for "${created.email}" (${created.role.toUpperCase()}) has been created successfully.`,
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
              New Account
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span>Provision college account</span>
              </h1>
              <p className="text-[13px] text-muted-foreground font-normal pl-0.5">
                Create an official institutional account with role, academic program, and access credentials.
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
                form="create-account-form"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <form id="create-account-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: form cards */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/70 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                1. Account identity
              </span>
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
                The email address will also be used as the account display name.
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
                Format XXX-XXXX-X (e.g. {ID_NUMBER_EXAMPLE}). Assigned by the administrator upon account creation. Shown on the user's profile.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/70 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                2. Role & program selection
              </span>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Account role *
              </label>
              <CustomDropdown
                value={formRole}
                onChange={val => setFormRole(val as UserRole)}
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
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                School Year *
              </label>
              <CustomDropdown
                value={formSchoolYear}
                onChange={setFormSchoolYear}
                options={schoolYearSelectOptions}
                placeholder="Select School Year"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-border/70 pb-3">
              <span className="text-[12px] font-semibold text-muted-foreground">
                3. Access credentials
              </span>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Initial account password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Min. 8 characters"
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
                Enter a secure temporary password (at least 8 characters) for the user to sign in.
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
                  name={formEmail.trim() || 'name@dmmmsu.edu.ph'}
                  src=""
                  className="w-10 h-10 rounded-full object-cover border border-border shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-xs text-foreground truncate">
                    {formEmail.trim() || 'name@dmmmsu.edu.ph'}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formEmail.trim() || 'Institutional email'}
                  </div>
                </div>
              </div>
              <div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-muted text-muted-foreground border-border">
                  {formRole === 'admin' ? 'Admin' : formRole === 'faculty' ? 'Faculty' : formRole === 'staff' ? 'Staff' : 'Student'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground truncate">{formDepartment}</div>
                <div className="truncate">{previewMeta.defaultTitle}</div>
                <div className="truncate">AY: {formSchoolYear}</div>
                <div className="truncate">ID: {formIdNumber.trim() || ID_NUMBER_EXAMPLE}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-2.5">
            <span className="text-[12px] font-semibold text-muted-foreground block">
              Before you provision
            </span>
            <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Use an official <span className="font-semibold text-foreground">@dmmmsu.edu.ph</span> address so the user can sign in.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Enter the official <span className="font-semibold text-foreground">ID Number</span> above — it will appear on the user's profile.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>You can edit email, role, program, and password later from the accounts table.</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
