import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Building,
  UserCheck,
  ShieldCheck,
  GraduationCap,
  Mail,
  Layers,
  Folder,
  LogOut,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Lock,
  Bell,
  Sliders,
  ExternalLink,
  Edit3,
  Save
} from 'lucide-react';
import { FilesView } from './FilesView';

interface ProfilePageProps {
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigateCourse,
  onNavigateTab
}) => {
  const { activeUser, activeRole, db, logout, showConfirm } = useLMS();

  // Active tab within the profile page
  const [profileTab, setProfileTab] = useState<'overview' | 'courses' | 'files' | 'preferences' | 'security'>('overview');

  // Interactive bio editing state
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(
    activeRole === 'admin'
      ? 'Overseeing academic programs and curriculum development for the College of Computer Science.'
      : activeRole === 'faculty'
      ? 'Specializing in Theoretical Computer Science, Automata Theory, and High-Performance Distributed Computing Systems.'
      : activeRole === 'staff'
      ? 'Managing student academic records and section allocations.'
      : 'Undergraduate student in BS Computer Science, specialized in Systems Software and Intelligent Distributed Applications.'
  );
  const [saveAlert, setSaveAlert] = useState(false);

  // Preference switches
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [speedGraderAlerts, setSpeedGraderAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);

  const currentUser = activeUser;

  const roleBadges: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
    admin: {
      label: 'DEAN / ACADEMIC ADMIN',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <Building className="w-4 h-4" />
    },
    faculty: {
      label: 'FACULTY INSTRUCTOR',
      style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      icon: <UserCheck className="w-4 h-4" />
    },
    staff: {
      label: 'REGISTRAR AIDE (LIKHA)',
      style: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      icon: <ShieldCheck className="w-4 h-4" />
    },
    student: {
      label: 'ENROLLED STUDENT',
      style: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      icon: <GraduationCap className="w-4 h-4" />
    }
  };

  const badge = roleBadges[activeRole] || roleBadges.student;

  const userCourses = db.courses.filter(c => {
    if (activeRole === 'student') return (currentUser.enrolledCourseIds || []).includes(c.id);
    if (activeRole === 'faculty') return c.instructorId === currentUser.id;
    return true;
  });

  const handleSaveBio = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingBio(false);
    setSaveAlert(true);
    setTimeout(() => setSaveAlert(false), 3000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-16 select-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border px-3.5 py-2 rounded-xl transition-all shadow-subtle cursor-pointer active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              showConfirm("Are you sure you want to sign out of your GABAY LMS session?", () => {
                logout();
              }, "Sign Out");
            }}
            className="inline-flex items-center space-x-1.5 text-xs font-bold bg-destructive hover:bg-destructive/90 active:scale-[0.98] text-destructive-foreground px-3.5 py-2 rounded-xl transition-all shadow-subtle cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Cover Banner & Profile Card */}
      <div className="bg-card border border-border rounded-2xl shadow-elevated overflow-hidden">
        {/* Profile Cover Gradient */}
        <div className="h-36 bg-gradient-to-r from-primary/90 via-primary to-zinc-900 relative p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 text-[11px] font-sans font-bold uppercase bg-black/40 text-white rounded-lg backdrop-blur-md border border-white/10 shadow-soft">
              Profile
            </span>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-sans font-bold text-white/90">Online</span>
            </div>
          </div>
        </div>

        {/* Profile Details Header */}
        <div className="p-6 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between -mt-14 mb-4 gap-4">
            <div className="flex items-end space-x-4">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-28 h-28 rounded-2xl object-cover border-4 border-card shadow-elevated bg-card shrink-0"
              />
              <div className="mb-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  {currentUser.name}
                </h1>
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  {currentUser.title} • {currentUser.department}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              <div className={`px-3.5 py-1.5 text-xs font-sans font-bold rounded-xl border flex items-center space-x-2 shadow-soft ${badge.style}`}>
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation Menu */}
          <div className="flex items-center space-x-2 border-b border-border pt-2 overflow-x-auto">
            <button
              onClick={() => setProfileTab('overview')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                profileTab === 'overview'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setProfileTab('courses')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                profileTab === 'courses'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Courses ({userCourses.length})</span>
            </button>

            <button
              onClick={() => setProfileTab('files')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                profileTab === 'files'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Personal Files</span>
            </button>

            <button
              onClick={() => setProfileTab('preferences')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                profileTab === 'preferences'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Preferences</span>
            </button>

            <button
              onClick={() => setProfileTab('security')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                profileTab === 'security'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Security</span>
            </button>
          </div>
        </div>
      </div>

      {saveAlert && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-2 text-xs font-sans font-bold text-emerald-700 dark:text-emerald-400 animate-fade-in shadow-soft">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile changes updated and saved to GABAY session database!</span>
        </div>
      )}

      {/* Tab 1: Overview */}
      {profileTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Left 2 Columns: Details & Bio */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity Grid */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
              <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
                Identity & Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex items-center space-x-2 text-muted-foreground font-medium">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>Email Address</span>
                  </div>
                  <div className="font-sans text-foreground font-bold truncate">
                    {currentUser.email}
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex items-center space-x-2 text-muted-foreground font-medium">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                    <span>Official ID Number</span>
                  </div>
                  <div className="font-sans text-foreground font-bold">
                    {currentUser.studentId || '2026-FAC-0012'}
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex items-center space-x-2 text-muted-foreground font-medium">
                    <Building className="w-3.5 h-3.5 text-primary" />
                    <span>Campus Location</span>
                  </div>
                  <div className="font-sans text-foreground font-bold">
                    SLUC South Compound, Agoo, La Union
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex items-center space-x-2 text-muted-foreground font-medium">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Academic Term</span>
                  </div>
                  <div className="font-sans text-foreground font-bold">
                    1st Semester AY 2026-2027
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Bio & Philosophy Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
                  Academic Statement & Biography
                </h3>
                {!isEditingBio && (
                  <button
                    onClick={() => setIsEditingBio(true)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Bio</span>
                  </button>
                )}
              </div>

              {isEditingBio ? (
                <form onSubmit={handleSaveBio} className="space-y-3">
                  <textarea
                    rows={4}
                    value={bioText}
                    onChange={e => setBioText(e.target.value)}
                    className="w-full p-3.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground leading-relaxed shadow-inner font-sans outline-none"
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(false)}
                      className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Bio</span>
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-foreground leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/80">
                  {bioText}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Session & Account Information */}
          <div className="space-y-6">

            {/* Quick Session Stats */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-3">
              <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
                Active Session Summary
              </h3>
              <div className="text-xs font-sans space-y-2 text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span>Session Status:</span>
                  <span className="text-emerald-600 font-bold">Active</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span>Authentication:</span>
                  <span className="text-foreground font-bold">DMMMSU SSO</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span>Enrolled Courses:</span>
                  <span className="text-foreground font-bold">{userCourses.length} shells</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Security Protocol:</span>
                  <span className="text-foreground font-bold">TLS 1.3 AES-256</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Course Attachments */}
      {profileTab === 'courses' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
              Active Course Shells & Curriculum Allocations ({userCourses.length})
            </h3>
            <span className="text-xs font-sans text-muted-foreground">
              Semester 1 • Academic Year 2026-2027
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userCourses.map(course => (
              <div
                key={course.id}
                className="p-5 bg-card border border-border rounded-2xl shadow-subtle card-hover flex flex-col justify-between space-y-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-soft"
                      style={{ backgroundColor: course.color || '#64748b' }}
                    />
                    <div>
                      <div className="font-sans font-extrabold text-primary text-sm">
                        {course.code}
                      </div>
                      <h4 className="font-bold text-foreground text-xs mt-0.5">
                        {course.title}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                    {course.credits} Units
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-sans text-muted-foreground pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground/60 block">Section:</span>
                    <span className="text-foreground font-bold">{course.section}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/60 block">Instructor:</span>
                    <span className="text-foreground font-bold truncate block">{course.instructorName}</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateCourse && onNavigateCourse(course.id, 'modules')}
                  className="w-full py-2.5 px-3 bg-muted/60 hover:bg-primary hover:text-primary-foreground rounded-xl text-xs font-bold text-foreground transition-all flex items-center justify-center space-x-1.5 shadow-subtle cursor-pointer active:scale-[0.98] group"
                >
                  <span>Enter Course Shell</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Personal Files */}
      {profileTab === 'files' && (
        <div className="animate-fade-in bg-card border border-border rounded-2xl p-6 shadow-subtle">
          <FilesView courseId="personal" />
        </div>
      )}

      {/* Tab 3: Preferences */}
      {profileTab === 'preferences' && (
        <div className="max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-6 animate-fade-in">
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
              GABAY Learning Management Preferences
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize real-time alerts, email digests, and accessibility settings.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-start space-x-3">
                <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-foreground">Instant Email Notifications</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Receive immediate notifications for announcement postings and urgent advising messages.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={e => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-start space-x-3">
                <Sliders className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-foreground">SpeedGrader & Submission Alerts</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Trigger desktop toast alerts when assignments are graded or submitted for evaluation.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={speedGraderAlerts}
                onChange={e => setSpeedGraderAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-start space-x-3">
                <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-foreground">Weekly Academic Activity Digest</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Summary of upcoming module deadlines, quizzes, and office advising sessions.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={weeklyDigest}
                onChange={e => setWeeklyDigest(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                setSaveAlert(true);
                setTimeout(() => setSaveAlert(false), 3000);
              }}
              className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-primary-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              Update Notification Settings
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Security & Sessions */}
      {profileTab === 'security' && (
        <div className="max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-6 animate-fade-in">
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
              Security & Active Session Gateway
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review active login endpoints and manage two-factor authentication.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-foreground flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Two-Factor Authentication (2FA)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 text-[10px] font-sans font-bold rounded border ${
                    twoFactorAuth
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {twoFactorAuth ? 'Enforced' : 'Disabled'}
                  </span>
                  <input
                    type="checkbox"
                    checked={twoFactorAuth}
                    onChange={e => setTwoFactorAuth(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Single sign-on requires hardware token or registered authenticator code for all faculty and administrative access.
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="font-bold text-foreground">Current Active Browser Session</div>
              <div className="font-sans text-[11px] text-muted-foreground space-y-1">
                <div>Client Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)</div>
                <div>IP Address: 192.168.1.42 (DMMMSU-SLUC Gateway)</div>
                <div>Session Authenticated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <span className="text-[11px] font-sans text-muted-foreground">
              Last password change: 14 days ago
            </span>
            <button
              onClick={() => {
                showConfirm("Are you sure you want to sign out and revoke this session?", () => {
                  logout();
                }, "Terminate Session");
              }}
              className="px-4 py-2 text-xs font-bold bg-card border border-border hover:bg-muted text-foreground rounded-xl transition-all shadow-subtle cursor-pointer active:scale-[0.98]"
            >
              Terminate Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
