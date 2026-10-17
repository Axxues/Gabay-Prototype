import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';

import { useLMS } from '../../shared/context/LMSContext';
import { formatIdNumber, isValidIdNumber, ID_NUMBER_EXAMPLE } from '../../shared/utils/idNumber';
import { isValidInstitutionalEmail, INSTITUTIONAL_EMAIL_REQUIREMENT } from '../../shared/utils/institutionalEmail';
import type { PendingRegistration } from '../../shared/types/lms';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { sendActivationEmail } from '../../shared/api/emailApi';

export const RegisterPage: React.FC = () => {
  const {
    registerAccount,
    activateEmail,
    colleges,
    departments,
    schoolYears,
    getActiveSchoolYearForCollege,
    getSchoolYearsByCollege,
    theme,
    toggleTheme,
    logout
  } = useLMS();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const tokenFromUrl = searchParams.get('token');
  const isActivationRoute = location.pathname === '/activate' || Boolean(tokenFromUrl);

  // Activation State
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form State
  const [role, setRole] = useState<'student' | 'faculty' | 'staff'>('student');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State after registration
  const [registeredRecord, setRegisteredRecord] = useState<PendingRegistration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  // Filter departments based on selected college
  const filteredDepartments = useMemo(() => {
    if (!collegeId) return [];
    return departments.filter(d => d.collegeId === collegeId);
  }, [departments, collegeId]);


  // Handle email activation when token is present
  const activatedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tokenFromUrl) return;
    if (activatedTokenRef.current === tokenFromUrl) return;
    activatedTokenRef.current = tokenFromUrl;

    setIsActivating(true);

    void activateEmail(tokenFromUrl)
      .then(res => {
        setIsActivating(false);
        setActivationResult(res);
      })
      .catch(err => {
        console.error('Email activation error:', err);
        setIsActivating(false);
        setActivationResult({
          success: false,
          message: 'An unexpected error occurred during email activation.'
        });
      });
  }, [tokenFromUrl, activateEmail]);

  const handleBackToSignIn = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      logout?.();
    } catch (err) {
      console.warn('Error during logout:', err);
    }
    navigate('/login', { replace: true });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Please enter your last name.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your institutional email.');
      return;
    }
    if (!isValidInstitutionalEmail(cleanEmail)) {
      setErrorMessage(INSTITUTIONAL_EMAIL_REQUIREMENT);
      return;
    }

    const cleanIdNumber = idNumber.trim();
    if (!cleanIdNumber) {
      setErrorMessage('Please enter your ID Number.');
      return;
    }
    if (!isValidIdNumber(cleanIdNumber)) {
      setErrorMessage(`ID Number must follow the format XXX-XXXX-X (e.g. ${ID_NUMBER_EXAMPLE}).`);
      return;
    }

    if (!collegeId) {
      setErrorMessage('Please select your college.');
      return;
    }

    if (!department) {
      setErrorMessage('Please select your program.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const matchedCollege = colleges.find(c => c.id === collegeId);
      const collegeName = matchedCollege?.name || collegeId;

      const result = await registerAccount({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        email: cleanEmail.toLowerCase(),
        role,
        collegeId,
        collegeName,
        department,
        program: department,
        studentId: cleanIdNumber,
        password,
        schoolYear: schoolYear.trim() || undefined,
      });

      // Dispatch activation link directly to user's institutional email and confirm delivery
      const origin = window.location.origin;
      const activationUrl = `${origin}/activate?token=${result.activationToken}`;
      const recipientName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');

      const emailResult = await sendActivationEmail({
        email: cleanEmail.toLowerCase(),
        recipientName,
        activationUrl,
      });

      if (!emailResult.success) {
        setErrorMessage(
          emailResult.message || 'Failed to send activation email. Please check your institutional email address or try again.'
        );
        return;
      }

      setRegisteredRecord(result);
      setIsModalOpen(true);
    } catch {
      setErrorMessage('An unexpected error occurred while submitting your registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  // Render Token Activation Flow Screen
  if (isActivationRoute) {
    return (
      <div className="h-screen max-h-screen w-full bg-muted flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto overflow-x-hidden text-foreground font-sans custom-scrollbar">
        {/* Subtle Background Glows */}
        <div className="fixed -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed -bottom-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Floating Theme Button */}
        <div className="fixed top-5 right-5 z-20">
          <button
            type="button"
            onClick={toggleTheme}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer shadow-xs"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-500" />}
          </button>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6 z-10 animate-scale-in text-center my-auto">
          <div className="space-y-2">
            <img
              src="/gabay-logo.png"
              alt="GABAY logo"
              className="w-16 h-16 mx-auto rounded-2xl object-contain bg-transparent"
            />
            <h1 className="text-xl font-extrabold tracking-tight text-foreground font-sans">
              GABAY
            </h1>
            <p className="text-xs text-muted-foreground">
              Institutional Email Verification
            </p>
          </div>

          {!tokenFromUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-2">
                <AlertCircle className="w-6 h-6 mx-auto" />
                <p className="font-semibold text-sm">Missing Activation Token</p>
                <p>No activation token was provided in the link. Please open the complete link sent to your institutional email.</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={handleBackToSignIn}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all text-center block cursor-pointer"
                >
                  Back to Sign In
                </Link>
                <Link
                  to="/register"
                  className="w-full py-2.5 bg-muted text-foreground font-semibold rounded-xl text-xs border border-border hover:bg-muted/80 transition-all text-center"
                >
                  Go to Registration
                </Link>
              </div>
            </div>
          ) : isActivating ? (
            <div className="py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">
                Verifying your activation link...
              </p>
            </div>
          ) : activationResult?.success ? (
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-foreground">Email Verified</h2>
                <p className="text-xs text-muted-foreground">
                  {activationResult.message}
                </p>
                <p className="text-[11px] text-muted-foreground/80 pt-1">
                  Your registration is now pending review by your program chairperson or college dean. Once approved, you will be able to sign in.
                </p>
              </div>
              <Link
                to="/login"
                onClick={handleBackToSignIn}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all flex items-center justify-center space-x-1.5 cursor-pointer text-center"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-foreground">Activation Failed</h2>
                <p className="text-xs text-destructive">
                  {activationResult?.message || 'Invalid or expired activation link.'}
                </p>
                <p className="text-[11px] text-muted-foreground pt-1">
                  The link may have already been used, expired after 30 days, or was entered incorrectly.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={handleBackToSignIn}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all text-center block cursor-pointer"
                >
                  Back to Sign In
                </Link>
                <Link
                  to="/register"
                  className="w-full py-2.5 bg-muted text-foreground font-semibold rounded-xl text-xs border border-border hover:bg-muted/80 transition-all text-center"
                >
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Registration Form Screen
  return (
    <div className="h-screen max-h-screen w-full bg-muted flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-y-auto overflow-x-hidden text-foreground font-sans custom-scrollbar">
      {/* Subtle Background Glows */}
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="fixed top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer shadow-xs"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-500" />}
        </button>
      </div>

      <div
        data-testid="register-card"
        className="w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col z-10 animate-scale-in my-auto shadow-sm overflow-hidden"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2 shrink-0 pb-3">
          <img
            src="/gabay-logo.png"
            alt="GABAY logo"
            className="w-14 h-14 mx-auto rounded-2xl object-contain bg-transparent"
          />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground font-sans">
              Create Account
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Register for an institutional GABAY account
            </p>
          </div>
        </div>

        {/* Scrollable Card Body */}
        <div
          data-testid="register-card-scrollable"
          className="overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1.5 -mr-1.5 space-y-4"
        >
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-2 text-xs text-destructive animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Role Selector */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-muted-foreground block">
              Account Role
            </label>
            <div role="radiogroup" aria-label="Account Role" className="grid grid-cols-3 gap-2">
              {[
                { id: 'student', label: 'Student', icon: GraduationCap },
                { id: 'faculty', label: 'Faculty', icon: UserCheck },
                { id: 'staff', label: 'Staff', icon: ShieldCheck },
              ].map(item => {
                const Icon = item.icon;
                const isSelected = role === item.id;
                return (
                  <label
                    key={item.id}
                    htmlFor={`role-${item.id}`}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                        : 'bg-background border-border text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <input
                      type="radio"
                      id={`role-${item.id}`}
                      name="accountRole"
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setRole(item.id as 'student' | 'faculty' | 'staff')}
                      className="sr-only"
                    />
                    <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Full Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="reg-firstName" className="text-[12px] font-semibold text-muted-foreground">
                First Name
              </label>
              <input
                id="reg-firstName"
                type="text"
                value={firstName}
                onChange={e => {
                  setFirstName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Juan"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reg-middleName" className="text-[12px] font-semibold text-muted-foreground">
                Middle Name <span className="text-muted-foreground/60 text-[11px] font-normal">(Optional)</span>
              </label>
              <input
                id="reg-middleName"
                type="text"
                value={middleName}
                onChange={e => {
                  setMiddleName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Protacio"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reg-lastName" className="text-[12px] font-semibold text-muted-foreground">
                Last Name
              </label>
              <input
                id="reg-lastName"
                type="text"
                value={lastName}
                onChange={e => {
                  setLastName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Dela Cruz"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Institutional Email & ID Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="reg-email" className="text-[12px] font-semibold text-muted-foreground">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="name@dmmmsu.edu.ph"
                  className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="reg-idNumber" className="text-[12px] font-semibold text-muted-foreground">
                ID Number
              </label>
              <input
                id="reg-idNumber"
                type="text"
                value={idNumber}
                onChange={e => {
                  const formatted = formatIdNumber(e.target.value);
                  setIdNumber(formatted);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="231-1082-3"
                maxLength={10}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* College and Program selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="reg-college" className="text-[12px] font-semibold text-muted-foreground">
                College *
              </label>
              <select
                id="reg-college"
                required
                value={collegeId}
                onChange={e => {
                  const nextCol = e.target.value;
                  setCollegeId(nextCol);
                  setDepartment('');
                  if (nextCol) {
                    const activeSy = getActiveSchoolYearForCollege?.(nextCol);
                    if (activeSy?.year) {
                      setSchoolYear(activeSy.year);
                    } else {
                      const list = getSchoolYearsByCollege?.(nextCol) || (schoolYears || []).filter(sy => sy.collegeId === nextCol);
                      const active = list.find(s => s.isActive);
                      setSchoolYear(active?.year || list[0]?.year || '2025-2026');
                    }
                  } else {
                    setSchoolYear('');
                  }
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans cursor-pointer"
                disabled={isSubmitting}
              >
                <option value="">Select College</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="reg-department" className="text-[12px] font-semibold text-muted-foreground">
                Program *
              </label>
              <select
                id="reg-department"
                required
                value={department}
                disabled={!collegeId || isSubmitting}
                onChange={e => {
                  setDepartment(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{collegeId ? 'Select Program' : 'Select a College first'}</option>
                {filteredDepartments.map(d => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="reg-password" className="text-[12px] font-semibold text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="reg-confirmPassword" className="text-[12px] font-semibold text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  id="reg-confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sending Activation Email...</span>
              </div>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        {/* Existing account link */}
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline cursor-pointer">
            Sign In
          </Link>
        </div>
      </div>
    </div>

      {/* Email-Only Activation Modal */}
      {isModalOpen && registeredRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl text-center animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground font-sans">
                Registration Submitted
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An activation link is sent to your email (<span className="font-semibold text-foreground">{registeredRecord.email}</span>). Please check your inbox and spam folder to verify your account.
              </p>
              <div className="p-3 bg-muted/60 border border-border rounded-xl text-left text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-xs">Next Steps:</p>
                <p>1. Open the activation link in your email to verify your address.</p>
                <p>2. Your application will be reviewed by your program chairperson or college dean.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleBackToSignIn()}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer shadow-xs"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
