import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import { formatIdNumber, isValidIdNumber, EMPLOYEE_ID_EXAMPLE } from '../../shared/utils/idNumber';
import { isValidInstitutionalEmail } from '../../shared/utils/institutionalEmail';
import { CustomDropdown, type DropdownOption } from '../../shared/components/common/CustomDropdown';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import {
  ArrowLeft,
  Building,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  FolderTree,
  UserCheck,
  RefreshCw,
  Info,
} from 'lucide-react';

interface CreateLeadershipAccountPageProps {
  onNavigateTab?: (tab: string) => void;
}

type LeadershipRole = 'dean' | 'chairperson';

type LeadershipField =
  | 'role'
  | 'collegeId'
  | 'departmentId'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'idNumber'
  | 'password'
  | 'confirmPassword';

type FieldErrors = Partial<Record<LeadershipField, string>>;

const FieldError: React.FC<{ id: string; message: string }> = ({ id, message }) => (
  <p id={id} className="text-[11px] font-medium text-destructive animate-fade-in mt-1">
    {message}
  </p>
);

export const CreateLeadershipAccountPage: React.FC<CreateLeadershipAccountPageProps> = ({
  onNavigateTab,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    colleges,
    departments,
    db,
    createUser,
    appointLeadership,
    showAlert,
  } = useLMS();

  // Form Fields
  const [selectedRole, setSelectedRole] = useState<LeadershipRole>('dean');
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Pre-fill from query params (e.g. when coming from "Appoint" button in AcademicStructureTab)
  useEffect(() => {
    const roleParam = searchParams.get('role');
    const colIdParam = searchParams.get('collegeId');
    const deptIdParam = searchParams.get('departmentId') || searchParams.get('programId');

    if (roleParam === 'dean' || roleParam === 'chairperson') {
      setSelectedRole(roleParam);
    }

    if (colIdParam) {
      setSelectedCollegeId(colIdParam);
    }

    if (deptIdParam) {
      setSelectedDepartmentId(deptIdParam);
      // Auto-resolve college if needed
      const foundDept = (departments || []).find(d => d.id === deptIdParam);
      if (foundDept && foundDept.collegeId) {
        setSelectedCollegeId(foundDept.collegeId);
      }
    }
  }, [searchParams, departments]);

  // Filter unassigned units
  // Colleges with no active Dean
  const availableCollegesForDean = useMemo(() => {
    const users = db?.users || [];
    return (colleges || []).filter(c => {
      if (!c.deanId || c.deanId === 'none') return true;
      const leaderExists = users.some(u => u.id === c.deanId);
      return !leaderExists;
    });
  }, [colleges, db?.users]);

  // Programs in selected college with no active Chair
  const availableProgramsForChair = useMemo(() => {
    const users = db?.users || [];
    return (departments || []).filter(d => {
      if (selectedCollegeId && d.collegeId !== selectedCollegeId) return false;
      if (!d.chairpersonId || d.chairpersonId === 'none') return true;
      const leaderExists = users.some(u => u.id === d.chairpersonId);
      return !leaderExists;
    });
  }, [departments, selectedCollegeId, db?.users]);

  // Dropdown Options
  const collegeOptionsForDean: DropdownOption[] = useMemo(() => {
    return availableCollegesForDean.map(c => ({
      value: c.id,
      label: `${c.name} (${c.code})`,
      icon: <Building className="w-4 h-4 text-primary" />,
    }));
  }, [availableCollegesForDean]);

  const allCollegesOptions: DropdownOption[] = useMemo(() => {
    return (colleges || []).map(c => ({
      value: c.id,
      label: `${c.name} (${c.code})`,
      icon: <Building className="w-4 h-4 text-primary" />,
    }));
  }, [colleges]);

  const programOptionsForChair: DropdownOption[] = useMemo(() => {
    return availableProgramsForChair.map(p => ({
      value: p.id,
      label: `${p.name} (${p.code})`,
      icon: <FolderTree className="w-4 h-4 text-primary" />,
    }));
  }, [availableProgramsForChair]);

  const handleBackToAccounts = () => {
    if (onNavigateTab) {
      onNavigateTab('accounts');
    } else {
      navigate('/accounts');
    }
  };

  const handleRoleChange = (newRole: LeadershipRole) => {
    setSelectedRole(newRole);
    setFieldErrors({});
    setFormError('');
    // Reset unit selection when switching roles unless still valid
    if (newRole === 'dean') {
      if (!availableCollegesForDean.some(c => c.id === selectedCollegeId)) {
        setSelectedCollegeId('');
      }
      setSelectedDepartmentId('');
    } else {
      setSelectedDepartmentId('');
    }
  };

  const validateField = (field: LeadershipField): string | undefined => {
    switch (field) {
      case 'collegeId':
        if (selectedRole === 'dean' && !selectedCollegeId) {
          return 'Please select a college with no appointed Dean.';
        }
        if (selectedRole === 'chairperson' && !selectedCollegeId) {
          return 'Please select a college.';
        }
        return undefined;
      case 'departmentId':
        if (selectedRole === 'chairperson' && !selectedDepartmentId) {
          return 'Please select an academic program with no appointed Chairperson.';
        }
        return undefined;
      case 'firstName':
        return firstName.trim() ? undefined : 'First name is required.';
      case 'lastName':
        return lastName.trim() ? undefined : 'Last name is required.';
      case 'email': {
        const clean = email.trim();
        if (!clean) return 'Institutional email is required.';
        if (!isValidInstitutionalEmail(clean, 'faculty')) {
          return 'Institutional email must end with @dmmmsu.edu.ph.';
        }
        const exists = (db?.users || []).some(
          u => u.email.toLowerCase() === clean.toLowerCase()
        );
        if (exists) {
          return 'This institutional email is already in use by another user account.';
        }
        return undefined;
      }
      case 'idNumber': {
        const clean = idNumber.trim();
        if (!clean) return 'ID Number is required.';
        if (!isValidIdNumber(clean, 'faculty')) {
          return `ID Number must be exactly 4 digits (e.g. ${EMPLOYEE_ID_EXAMPLE}).`;
        }
        return undefined;
      }
      case 'password':
        if (!password) return 'Password is required.';
        if (password.length < 8) return 'Password must be at least 8 characters.';
        return undefined;
      case 'confirmPassword':
        if (!confirmPassword) return 'Please confirm password.';
        if (confirmPassword !== password) return 'Passwords do not match.';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (field: LeadershipField) => {
    const err = validateField(field);
    setFieldErrors(prev => ({ ...prev, [field]: err }));
  };

  const handleFieldChange = (
    field: LeadershipField,
    val: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setter(val);
    if (formError) setFormError('');
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Form Submission: Validate & Open Confirmation Modal
  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const fieldsToValidate: LeadershipField[] = [
      'collegeId',
      ...(selectedRole === 'chairperson' ? (['departmentId'] as LeadershipField[]) : []),
      'firstName',
      'lastName',
      'email',
      'idNumber',
      'password',
      'confirmPassword',
    ];

    const newErrors: FieldErrors = {};
    for (const f of fieldsToValidate) {
      const err = validateField(f);
      if (err) newErrors[f] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setFormError('Please resolve the errors highlighted below.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Modal Confirm: Directly provision user and assign leadership without email verification
  const handleConfirmCreate = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      const cleanEmail = email.trim();
      const cleanId = idNumber.trim();
      const computedFullName = [firstName.trim(), middleName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(' ');

      const targetCollege = colleges.find(c => c.id === selectedCollegeId);
      const targetDept = departments.find(d => d.id === selectedDepartmentId);

      // Provision user as Admin with dean or chairperson subrole
      const newUser = await createUser({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        name: computedFullName,
        email: cleanEmail,
        studentId: cleanId,
        password: password,
        role: 'admin',
        adminSubrole: selectedRole === 'dean' ? 'dean' : 'chairperson',
        collegeId: selectedCollegeId,
        collegeName: targetCollege?.name,
        department: selectedRole === 'chairperson' ? targetDept?.name : targetCollege?.name,
        program: selectedRole === 'chairperson' ? targetDept?.name : undefined,
        title: selectedRole === 'dean' ? 'College Dean' : 'Program Chairperson',
        emailVerified: true,
        verificationStatus: 'verified',
      });

      // Appoint leadership seat to the unit
      const unitId = selectedRole === 'dean' ? selectedCollegeId : selectedDepartmentId;
      await appointLeadership(selectedRole, newUser.id, unitId);

      const roleTitle = selectedRole === 'dean' ? 'Dean' : 'Chairperson';
      const unitName =
        selectedRole === 'dean'
          ? targetCollege?.name || 'College'
          : targetDept?.name || 'Program';

      showAlert({
        title: 'Leadership Account Created',
        message: `${roleTitle} ${computedFullName} has been appointed to ${unitName}.`,
        type: 'success',
      });

      setIsConfirmModalOpen(false);
      handleBackToAccounts();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to finalize leadership appointment. Please try again.');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetCollegeName = colleges.find(c => c.id === selectedCollegeId)?.name || 'Selected College';
  const targetProgramName = departments.find(d => d.id === selectedDepartmentId)?.name || 'Selected Program';

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pt-2 pb-24 px-3 sm:px-6 font-sans">
      {/* Top Breadcrumb & Header */}
      <div className="pb-4 border-b border-border/80">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={handleBackToAccounts}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Manage College Accounts</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-primary font-bold px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px]">
              Create Leadership Account
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span>Create Leadership Account</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Provision a new Dean or Chairperson account for an unassigned academic unit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FORM DETAILS */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs animate-scale-in">
        {/* Form Banner Error */}
        {formError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-2 text-xs text-destructive animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleOpenConfirmModal} noValidate className="space-y-5">
            {/* 1. Role Selection Pills */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted-foreground block">
                Administrative Leadership Role *
              </label>
              <div role="radiogroup" aria-label="Leadership Role" className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'dean' as const,
                    label: 'College Dean',
                    icon: Building,
                  },
                  {
                    id: 'chairperson' as const,
                    label: 'Department Chairperson',
                    icon: FolderTree,
                  },
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = selectedRole === item.id;
                  return (
                    <label
                      key={item.id}
                      htmlFor={`role-${item.id}`}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                          : 'bg-background border-border text-foreground hover:bg-muted/80'
                      }`}
                    >
                      <input
                        type="radio"
                        id={`role-${item.id}`}
                        name="leadershipRole"
                        value={item.id}
                        checked={isSelected}
                        onChange={() => handleRoleChange(item.id)}
                        className="sr-only"
                      />
                      <Icon
                        className={`w-5 h-5 mb-1.5 ${
                          isSelected ? 'text-primary-foreground' : 'text-primary'
                        }`}
                      />
                      <span className="font-bold">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. Unit Selection */}
            {selectedRole === 'dean' ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="college-select"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Target College (No Dean Appointed) *
                </label>
                {availableCollegesForDean.length === 0 ? (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start space-x-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      All registered colleges currently have an appointed Dean. You can create a new college in Academic Structure or appoint a Chairperson.
                    </span>
                  </div>
                ) : (
                  <>
                    <CustomDropdown
                      id="college-select"
                      value={selectedCollegeId}
                      onChange={val => {
                        setSelectedCollegeId(val);
                        if (fieldErrors.collegeId) {
                          setFieldErrors(prev => {
                            const next = { ...prev };
                            delete next.collegeId;
                            return next;
                          });
                        }
                      }}
                      options={collegeOptionsForDean}
                      placeholder="Select a College with no appointed Dean..."
                      icon={<Building className="w-4 h-4 text-muted-foreground" />}
                      invalid={Boolean(fieldErrors.collegeId)}
                    />
                    {fieldErrors.collegeId && (
                      <FieldError id="college-select-error" message={fieldErrors.collegeId} />
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="chair-college-select"
                    className="text-[12px] font-semibold text-muted-foreground block"
                  >
                    Parent College *
                  </label>
                  <CustomDropdown
                    id="chair-college-select"
                    value={selectedCollegeId}
                    onChange={val => {
                      setSelectedCollegeId(val);
                      setSelectedDepartmentId('');
                      if (fieldErrors.collegeId) {
                        setFieldErrors(prev => {
                          const next = { ...prev };
                          delete next.collegeId;
                          return next;
                        });
                      }
                    }}
                    options={allCollegesOptions}
                    placeholder="Select Parent College..."
                    icon={<Building className="w-4 h-4 text-muted-foreground" />}
                    invalid={Boolean(fieldErrors.collegeId)}
                  />
                  {fieldErrors.collegeId && (
                    <FieldError id="chair-col-error" message={fieldErrors.collegeId} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="chair-program-select"
                    className="text-[12px] font-semibold text-muted-foreground block"
                  >
                    Academic Program (No Chair) *
                  </label>
                  {!selectedCollegeId ? (
                    <div className="p-2.5 bg-muted/50 border border-border rounded-xl text-xs text-muted-foreground">
                      Select a parent college first to view unappointed programs.
                    </div>
                  ) : availableProgramsForChair.length === 0 ? (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                      All programs in this college have an appointed Chairperson.
                    </div>
                  ) : (
                    <>
                      <CustomDropdown
                        id="chair-program-select"
                        value={selectedDepartmentId}
                        onChange={val => {
                          setSelectedDepartmentId(val);
                          if (fieldErrors.departmentId) {
                            setFieldErrors(prev => {
                              const next = { ...prev };
                              delete next.departmentId;
                              return next;
                            });
                          }
                        }}
                        options={programOptionsForChair}
                        placeholder="Select Program with no Chair..."
                        icon={<FolderTree className="w-4 h-4 text-muted-foreground" />}
                        invalid={Boolean(fieldErrors.departmentId)}
                      />
                      {fieldErrors.departmentId && (
                        <FieldError id="chair-prog-error" message={fieldErrors.departmentId} />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 3. Personal Identity Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="lead-firstName"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="lead-firstName"
                  type="text"
                  value={firstName}
                  onChange={e => handleFieldChange('firstName', e.target.value, setFirstName)}
                  onBlur={() => handleBlur('firstName')}
                  aria-invalid={fieldErrors.firstName ? true : undefined}
                  placeholder="e.g. Maria"
                  className={`w-full px-3 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                    fieldErrors.firstName
                      ? 'border-destructive focus:ring-destructive/30'
                      : 'border-border focus:ring-primary/30'
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.firstName && (
                  <FieldError id="lead-firstName-error" message={fieldErrors.firstName} />
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lead-middleName"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Middle Name <span className="text-muted-foreground/60 text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  id="lead-middleName"
                  type="text"
                  value={middleName}
                  onChange={e => setMiddleName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-sans"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lead-lastName"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="lead-lastName"
                  type="text"
                  value={lastName}
                  onChange={e => handleFieldChange('lastName', e.target.value, setLastName)}
                  onBlur={() => handleBlur('lastName')}
                  aria-invalid={fieldErrors.lastName ? true : undefined}
                  placeholder="e.g. Dela Cruz"
                  className={`w-full px-3 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                    fieldErrors.lastName
                      ? 'border-destructive focus:ring-destructive/30'
                      : 'border-border focus:ring-primary/30'
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.lastName && (
                  <FieldError id="lead-lastName-error" message={fieldErrors.lastName} />
                )}
              </div>
            </div>

            {/* 4. Institutional Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="lead-email"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Institutional Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={e => handleFieldChange('email', e.target.value, setEmail)}
                    onBlur={() => handleBlur('email')}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    placeholder="leader@dmmmsu.edu.ph"
                    className={`w-full pl-9 pr-3 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                      fieldErrors.email
                        ? 'border-destructive focus:ring-destructive/30'
                        : 'border-border focus:ring-primary/30'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.email && (
                  <FieldError id="lead-email-error" message={fieldErrors.email} />
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lead-idNumber"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  ID Number / Employee ID *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lead-idNumber"
                    type="text"
                    value={idNumber}
                    onChange={e =>
                      handleFieldChange(
                        'idNumber',
                        formatIdNumber(e.target.value, 'faculty'),
                        setIdNumber
                      )
                    }
                    onBlur={() => handleBlur('idNumber')}
                    aria-invalid={fieldErrors.idNumber ? true : undefined}
                    maxLength={4}
                    placeholder={`e.g. ${EMPLOYEE_ID_EXAMPLE}`}
                    className={`w-full pl-9 pr-3 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                      fieldErrors.idNumber
                        ? 'border-destructive focus:ring-destructive/30'
                        : 'border-border focus:ring-primary/30'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.idNumber && (
                  <FieldError id="lead-idNumber-error" message={fieldErrors.idNumber} />
                )}
              </div>
            </div>

            {/* 5. Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="lead-password"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Account Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lead-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => handleFieldChange('password', e.target.value, setPassword)}
                    onBlur={() => handleBlur('password')}
                    aria-invalid={fieldErrors.password ? true : undefined}
                    placeholder="Min. 8 characters"
                    className={`w-full pl-9 pr-9 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                      fieldErrors.password
                        ? 'border-destructive focus:ring-destructive/30'
                        : 'border-border focus:ring-primary/30'
                    }`}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <FieldError id="lead-password-error" message={fieldErrors.password} />
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="lead-confirmPassword"
                  className="text-[12px] font-semibold text-muted-foreground block"
                >
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lead-confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e =>
                      handleFieldChange('confirmPassword', e.target.value, setConfirmPassword)
                    }
                    onBlur={() => handleBlur('confirmPassword')}
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                    placeholder="Re-enter password"
                    className={`w-full pl-9 pr-9 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                      fieldErrors.confirmPassword
                        ? 'border-destructive focus:ring-destructive/30'
                        : 'border-border focus:ring-primary/30'
                    }`}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <FieldError id="lead-confirmPassword-error" message={fieldErrors.confirmPassword} />
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-border">
              <button
                type="button"
                onClick={handleBackToAccounts}
                className="px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all shadow-xs cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Create Leadership Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <DialogFrame
          title="Confirm Leadership Appointment"
          subtitle="Please review the leadership details before finalizing this appointment."
          onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all shadow-xs cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Create Account</span>
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Appointed Leader:</span>
                <span className="font-bold text-foreground">
                  {[firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Position & Unit:</span>
                <span className="font-bold text-primary">
                  {selectedRole === 'dean'
                    ? `College Dean • ${targetCollegeName}`
                    : `Department Chairperson • ${targetProgramName}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Institutional Email:</span>
                <span className="font-mono text-foreground font-medium">{email.trim()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Employee ID:</span>
                <span className="font-mono text-foreground font-medium">{idNumber.trim()}</span>
              </div>
            </div>

            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary flex items-start space-x-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This will immediately provision the account with active administrative credentials and assign them as the official {selectedRole === 'dean' ? 'Dean' : 'Chairperson'}.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
