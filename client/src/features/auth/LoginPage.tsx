import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import { isProfileComplete } from '../../shared/utils/profileCompletion';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle
} from 'lucide-react';

type LoginField = 'identifier' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, theme, toggleTheme, showAlert, currentUser } = useLMS();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  /** Input-caused problems only. Anything else stays in the top banner. */
  const validateField = (field: LoginField, value: string): string | undefined => {
    if (field === 'identifier') {
      return value.trim() ? undefined : 'Please enter your email or ID.';
    }
    return value ? undefined : 'Please enter your password.';
  };

  const applyFieldError = (field: LoginField, error: string | undefined) => {
    setFieldErrors(prev => {
      if (!error) {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      if (prev[field] === error) return prev;
      return { ...prev, [field]: error };
    });
  };

  /** Fired when the user moves onto another field. */
  const handleBlur = (field: LoginField, value: string) => {
    applyFieldError(field, validateField(field, value));
  };

  /** Once a field is flagged, keep it in sync while the user fixes it. */
  const handleChange = (field: LoginField, value: string, setter: (v: string) => void) => {
    setter(value);
    if (errorMessage) setErrorMessage('');
    if (fieldErrors[field]) {
      applyFieldError(field, validateField(field, value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const nextErrors: LoginFieldErrors = {};
    (['identifier', 'password'] as LoginField[]).forEach(field => {
      const message = validateField(field, field === 'identifier' ? identifier : password);
      if (message) nextErrors[field] = message;
    });

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(identifier, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Invalid credentials. Please try again.');
      } else {
        const loggedUser = res.user || currentUser;
        const targetRoute = isProfileComplete(loggedUser) ? '/dashboard' : '/profile';
        navigate(targetRoute, { replace: true });
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (email: string, pw = 'gabay2026') => {
    setIdentifier(email);
    setPassword(pw);
    setErrorMessage('');
    setFieldErrors({});
    setIsLoading(true);
    setTimeout(async () => {
      const res = await login(email, pw);
      setIsLoading(false);
      if (res?.success) {
        const loggedUser = res.user || currentUser;
        const targetRoute = isProfileComplete(loggedUser) ? '/dashboard' : '/profile';
        navigate(targetRoute, { replace: true });
      }
    }, 200);
  };

  return (
    <div className="h-screen max-h-screen w-full bg-muted flex flex-col items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden text-foreground font-sans custom-scrollbar">
      {/* Subtle Background Glows */}
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Theme Button */}
      <div className="fixed top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer shadow-xs"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-amber-500" />
          )}
        </button>
      </div>

      {/* Cellwego Glass Login Card */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6 z-10 animate-scale-in my-auto shadow-sm">
        {/* Simple Brand Header */}
        <div className="text-center space-y-2">
          <img
            src="/gabay-logo.png"
            alt="GABAY logo"
            className="w-16 h-16 mx-auto rounded-2xl object-contain bg-transparent"
          />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground font-sans">
              GABAY
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign in to your academic portal
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-2 text-xs text-destructive animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-muted-foreground">
              Email or ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                value={identifier}
                onChange={e => handleChange('identifier', e.target.value, setIdentifier)}
                onBlur={() => handleBlur('identifier', identifier)}
                aria-invalid={fieldErrors.identifier ? true : undefined}
                aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
                placeholder="name@dmmmsu.edu.ph"
                className={`w-full pl-9 pr-3 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                  fieldErrors.identifier
                    ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                    : 'border-border focus:ring-primary/30 focus:border-primary'
                }`}
                disabled={isLoading}
              />
            </div>
            {fieldErrors.identifier && (
              <p
                id="login-identifier-error"
                className="text-[11px] font-medium text-destructive animate-fade-in"
              >
                {fieldErrors.identifier}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-muted-foreground">Password</label>
              <button
                type="button"
                onClick={() => {
                  showAlert({
                    title: "Reset Password",
                    message: (
                      <div className="space-y-2">
                        <p>To reset your account password, please contact the chairperson or visit dean's office.</p>
                        <div className="p-2.5 bg-muted rounded-xl text-xs font-sans text-foreground select-text">
                          Email: it.support@dmmmsu.edu.ph
                        </div>
                      </div>
                    ),
                    type: "info",
                    confirmText: "Understood"
                  });
                }}
                className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => handleChange('password', e.target.value, setPassword)}
                onBlur={() => handleBlur('password', password)}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                placeholder="••••••••"
                className={`w-full pl-9 pr-10 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 transition-all font-sans ${
                  fieldErrors.password
                    ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                    : 'border-border focus:ring-primary/30 focus:border-primary'
                }`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p
                id="login-password-error"
                className="text-[11px] font-medium text-destructive animate-fade-in"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="flex items-center text-xs">
            <label className="flex items-center space-x-2 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded border-border accent-primary"
              />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Self-Registration Link */}
        <div className="text-center text-xs text-muted-foreground pt-1">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            Register here
          </Link>
        </div>

        {/* Clean Demo Accounts */}
        <div className="pt-3 border-t border-border space-y-2">
          <span className="text-[12px] font-semibold text-muted-foreground block text-center font-sans">
            Quick demo login
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('jayveegenetareyes@gmail.com', 'qwerty12345')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('dean1@dmmmsu.edu.ph', 'gabay2026')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Dean
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('chair1@dmmmsu.edu.ph', 'gabay2026')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Chairperson
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('faculty1@dmmmsu.edu.ph', 'gabay2026')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Faculty 1
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('staff1@dmmmsu.edu.ph', 'gabay2026')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Staff 1
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('student1@dmmmsu.edu.ph', 'gabay2026')}
              className="py-1.5 px-2 bg-muted/50 hover:bg-primary/10 hover:border-primary/30 border border-border rounded-lg text-xs font-semibold text-foreground transition-all text-center cursor-pointer"
            >
              Student 1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
