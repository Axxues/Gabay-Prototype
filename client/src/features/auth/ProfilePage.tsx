import { likhaLmsApi } from '../../shared/api/likhaLmsApi';
import React, { useRef, useState } from 'react';
import { useLMS, ACCENT_PRESETS } from '../../shared/context/LMSContext';
import { uploadFileToPublic } from '../../shared/utils/fileUploader';
import { hasCustomAvatar } from '../../shared/utils/avatar';
import { getDisplayRoleLabel, isAdministrativeMonitor } from '../../shared/utils/roles';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import {
  Building,
  UserCheck,
  ShieldCheck,
  GraduationCap,
  LogOut,
  ArrowLeft,
  Lock,
  Sliders,
  Eye,
  EyeOff,
  Palette,
  RotateCcw,
  Check,
  Sun,
  Moon,
  Camera,
  Trash2,
  Loader2
} from 'lucide-react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { StudentProfileForm } from './components/StudentProfileForm';
import { FacultyProfileForm } from './components/FacultyProfileForm';
import { ImageCropModal } from './components/ImageCropModal';

type ProfileTab = 'overview' | 'preferences';

const SettingSwitch: React.FC<{ checked: boolean; onChange: (value: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
      checked ? 'bg-primary' : 'bg-muted-foreground/30'
    }`}
  >
    <span
      className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all ${
        checked ? 'left-[21px]' : 'left-[3px]'
      }`}
    />
  </button>
);

interface ProfilePageProps {
  onNavigateTab?: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigateTab
}) => {
  const { activeUser, activeRole, logout, showConfirm, showAlert, updateUser, accent, customAccentHex, setAccent, setCustomAccentHex, resetAccent, theme, toggleTheme } = useLMS();
  const currentUser = activeUser;

  // Active tab within the profile page
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  // Preference switches
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);

  // Profile photo upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    file: File | null;
  }>({
    isOpen: false,
    file: null,
  });

  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert({
        title: 'Invalid File',
        message: 'Please choose an image file (PNG, JPG, or WEBP).',
        type: 'warning'
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showAlert({
        title: 'File Too Large',
        message: 'Please choose an image under 5MB.',
        type: 'warning'
      });
      return;
    }
    setCropModal({
      isOpen: true,
      file,
    });
  };

  const handleSaveCroppedPhoto = async (croppedFile: File) => {
    setIsUploadingAvatar(true);
    try {
      const { url, fileId } = await uploadFileToPublic(croppedFile);
      const ok = await updateUser(
        currentUser.id,
        { avatar: url, avatarFileId: fileId }
      );
      if (ok) {
        showAlert({
          title: 'Profile Photo Updated',
          message: 'Your new profile photo is now visible across the app.',
          type: 'success'
        });
      }
    } catch {
      // updateUser / upload already surfaced the alert.
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemovePhoto = () => {
    showConfirm(
      'Are you sure you want to remove your profile picture? Your profile will revert to displaying your initial.',
      async () => {
        const ok = await updateUser(currentUser.id, { avatar: '' });
        if (ok) {
          showAlert({
            title: 'Profile Photo Removed',
            message: 'Your profile now shows your initial.',
            type: 'info'
          });
        }
      },
      'Remove Photo'
    );
  };

  // Change password form state (email is read-only — no change email here)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [lastPasswordChange, setLastPasswordChange] = useState('14 days ago');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({
        title: 'Required Information',
        message: 'Please fill in your current password, new password, and confirmation.',
        type: 'warning'
      });
      return;
    }
    let isCurrentValid = false;
    if (currentUser.email) {
      isCurrentValid = await likhaLmsApi.auth.verifyPassword(currentUser.email, currentPassword);
    }
    if (!isCurrentValid && currentUser.password && currentUser.password === currentPassword) {
      isCurrentValid = true;
    }

    if (!isCurrentValid) {
      showAlert({
        title: 'Incorrect Password',
        message: 'Your current password does not match our records.',
        type: 'warning'
      });
      return;
    }
    if (newPassword.length < 8) {
      showAlert({
        title: 'Weak Password',
        message: 'Your new password must be at least 8 characters long.',
        type: 'warning'
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({
        title: 'Passwords Do Not Match',
        message: 'The new password and confirmation do not match.',
        type: 'warning'
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      const ok = await updateUser(currentUser.id, { password: newPassword });
      if (!ok) return;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLastPasswordChange('Just now');
      showAlert({
        title: 'Password Updated',
        message: 'Your account password has been changed successfully.',
        type: 'success'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const roleBadges: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
    admin: {
      label: getDisplayRoleLabel(currentUser, 'admin'),
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <Building className="w-3.5 h-3.5" />
    },
    superadmin: {
      label: 'Admin',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <Building className="w-3.5 h-3.5" />
    },
    faculty: {
      label: 'Faculty instructor',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <UserCheck className="w-3.5 h-3.5" />
    },
    staff: {
      label: 'Staff',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <ShieldCheck className="w-3.5 h-3.5" />
    },
    student: {
      label: 'Enrolled student',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <GraduationCap className="w-3.5 h-3.5" />
    }
  };

  const badge = roleBadges[activeRole] || roleBadges.student;

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Basic Information', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences & Security', icon: <Sliders className="w-4 h-4" /> }
  ];

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16 select-none">
      {/* Top Action Bar */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border px-3.5 py-2 rounded-xl transition-all shadow-none cursor-pointer active:scale-[0.98] shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex-1">
          <PageHeader
            title="Profile"
            actions={
              <button
                onClick={() => {
                  showConfirm("Are you sure you want to sign out of your GABAY LMS session?", () => {
                    logout();
                  }, "Sign Out");
                }}
                className="inline-flex items-center space-x-1.5 text-xs font-bold bg-destructive hover:bg-destructive/90 active:scale-[0.98] text-destructive-foreground px-3.5 py-2 rounded-xl transition-all shadow-none cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            }
          />
        </div>
      </div>

      {/* Identity hero - centered design with accent-colored banner */}
      <div className="bg-card border border-border rounded-3xl shadow-card overflow-hidden">
        {/* Banner card behind the user profile - clean accent color without shadows */}
        <div className="relative h-40 sm:h-48 bg-gradient-to-r from-primary via-primary/85 to-primary/70 overflow-hidden">
          {/* Subtle ambient light highlights */}
          <div aria-hidden="true" className="absolute -right-10 -top-10 w-72 h-72 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div aria-hidden="true" className="absolute -left-10 -bottom-10 w-72 h-72 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative flex items-center justify-between p-5">
            <span className="px-3 py-1 text-[11px] font-semibold bg-white/20 backdrop-blur-md text-white rounded-full border border-white/25">
              Profile
            </span>
          </div>
        </div>

        {/* Identity content centered in front of & overlapping the banner */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pb-6 sm:pb-8">
          {/* Centered Avatar overlapping the banner bottom */}
          <div className="relative group/avatar shrink-0 -mt-14 sm:-mt-16 mb-4">
            <UserAvatar
              name={currentUser.name}
              src={currentUser.avatar}
              className="w-28 h-28 rounded-2xl object-cover border-4 border-card bg-card shadow-card"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              title="Change profile photo"
              className="absolute inset-0 rounded-2xl bg-black/55 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover/avatar:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer disabled:opacity-60"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Change</span>
                </>
              )}
            </button>
            {hasCustomAvatar(currentUser.avatar) && !isUploadingAvatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                title="Remove profile photo"
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 flex items-center justify-center shadow-card transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handlePhotoFile(file);
              }}
            />
          </div>

          {/* Centered User Details */}
          <div className="flex flex-col items-center max-w-xl">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {currentUser.name}
              </h1>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border inline-flex items-center space-x-1.5 ${badge.style}`}>
                {badge.icon}
                <span>{badge.label}</span>
              </span>
            </div>

            {(currentUser.title || currentUser.program || currentUser.department) && (
              <p className="text-sm font-medium text-muted-foreground mt-1.5">
                {[currentUser.title, currentUser.program || currentUser.department].filter(Boolean).join(' • ')}
              </p>
            )}

            <p className="text-xs text-muted-foreground/80 mt-1">
              {[currentUser.email, currentUser.studentId ? `ID: ${currentUser.studentId}` : null].filter(Boolean).join(' • ')}
            </p>
          </div>

          {/* Segmented tab control */}
          <div className="mt-6 flex p-1 bg-muted rounded-2xl gap-1 w-full max-w-md justify-center overflow-x-auto" role="tablist" aria-label="Profile sections">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={profileTab === t.id}
                onClick={() => setProfileTab(t.id)}
                className={`flex-1 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  profileTab === t.id
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`px-1.5 py-px text-[10px] font-bold tabular-nums rounded-full ${profileTab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab 1: Basic Information */}
      {profileTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Student Profile Form (Institutional Records) */}
          {activeRole === 'student' && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-none space-y-5">
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  Institutional Records & Student Information
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update your official student records, address details, and family contact information.
                </p>
              </div>
              <StudentProfileForm
                key={currentUser.id}
                user={currentUser}
                updateUser={updateUser}
                showAlert={showAlert}
              />
            </div>
          )}

          {/* Faculty, Staff, Admin, Dean, and Chairperson Profile Form (Credentials & Experience) */}
          {activeRole !== 'student' && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-none space-y-5">
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  {isAdministrativeMonitor(currentUser, activeRole)
                    ? 'Administrative & Leadership Profile'
                    : 'Faculty & Staff Credentials'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAdministrativeMonitor(currentUser, activeRole)
                    ? 'Update your executive account name, personal contact information, and address details.'
                    : 'Update your professional teaching experience, contact information, and educational background.'}
                </p>
              </div>
              <FacultyProfileForm
                key={currentUser.id}
                user={currentUser}
                updateUser={updateUser}
                showAlert={showAlert}
                isAdministrative={isAdministrativeMonitor(currentUser, activeRole)}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Preferences & Security */}
      {profileTab === 'preferences' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {/* Appearance group */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-5" aria-label="Appearance settings">
              <div>
                <h3 className="font-bold text-foreground text-[13px]">Appearance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Theme mode and accent color apply instantly across the app.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-xs">Color theme</div>
                  </div>
                </div>
                <div className="flex p-1 bg-muted rounded-xl gap-1 shrink-0" role="group" aria-label="Color theme">
                  {(['light', 'dark'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { if (theme !== mode) toggleTheme(); }}
                      aria-pressed={theme === mode}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        theme === mode
                          ? 'bg-card text-foreground shadow-soft'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      <span className="capitalize">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Palette className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-foreground text-xs">Accent color</div>
                </div>
                {accent !== 'pink' && (
                  <button
                    type="button"
                    onClick={resetAccent}
                    title="Reset to default color"
                    className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5 pl-7">
                {ACCENT_PRESETS.map(preset => {
                  const isActive = accent === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAccent(preset.id)}
                      title={preset.label}
                      aria-label={`Use ${preset.label} accent`}
                      aria-pressed={isActive}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-105'
                          : 'hover:scale-105 ring-1 ring-border'
                      }`}
                      style={{ backgroundColor: preset.swatch }}
                    >
                      {isActive && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
                <label
                  title="Custom color"
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 overflow-hidden ${
                    accent === 'custom'
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-105'
                      : 'hover:scale-105 ring-1 ring-border ring-dashed'
                  }`}
                  style={{ backgroundColor: customAccentHex }}
                >
                  <span className="text-white text-sm font-bold leading-none select-none">+</span>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(customAccentHex) ? customAccentHex : '#0E7A5C'}
                    onChange={e => setCustomAccentHex(e.target.value)}
                    aria-label="Pick a custom accent color"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <span className="text-[11px] text-muted-foreground ml-1">
                  {accent === 'custom'
                    ? `Custom ${customAccentHex}`
                    : ACCENT_PRESETS.find(p => p.id === accent)?.label ?? ''}
                  {` · ${theme === 'dark' ? 'Dark' : 'Light'} mode`}
                </span>
              </div>
              </div>
            </section>

            {/* Sign-in group */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4 text-xs" aria-label="Sign-in and verification">
              <div>
                <h3 className="font-bold text-foreground text-[13px]">Sign-in & verification</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Two-factor authentication for your account.
                </p>
              </div>
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-foreground flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Two-Factor Authentication (2FA)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SettingSwitch checked={twoFactorAuth} onChange={setTwoFactorAuth} label="Two-factor authentication" />
                </div>
              </div>
            </div>
            </section>

          </div>

          {/* Change password */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4 text-xs" aria-label="Change password">
            <div>
              <h3 className="font-bold text-foreground text-[13px]">Change password</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your current password, then choose a new one.
              </p>
            </div>
            <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    className="w-full pr-10 p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full pr-10 p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className="w-full pr-10 p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-primary-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
            <div className="flex justify-end">
              <span className="text-[11px] text-muted-foreground">
                Last password change: {lastPasswordChange}
              </span>
            </div>
          </section>
        </div>
      )}

      {/* Image preview & arrangement modal */}
      <ImageCropModal
        isOpen={cropModal.isOpen}
        onClose={() => setCropModal({ isOpen: false, file: null })}
        file={cropModal.file}
        kind="avatar"
        onSave={handleSaveCroppedPhoto}
      />
    </div>
  );
};
