import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import type { User, College, Department } from '../../shared/types/lms';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { getDisplayRoleLabel, isFacultyRole, isAdministrativeMonitor, isDeanRole, isChairRole } from '../../shared/utils/roles';
import { formatAddress, parseAddress, DEGREE_LABELS } from '../../shared/utils/profileCompletion';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building,
  GraduationCap,
  Users,
  Award,
  BookOpen,
  UserCheck,
  IdCard,
} from 'lucide-react';

interface AccountProfilePageProps {
  user: User;
  onNavigateTab?: (tab: string) => void;
}

type AccountProfileTab = 'overview' | 'records' | 'courses';

export const AccountProfilePage: React.FC<AccountProfilePageProps> = ({
  user,
  onNavigateTab,
}) => {
  const navigate = useNavigate();
  const { colleges, departments, db, activeUser, leadershipTenures = [] } = useLMS();

  const userTenures = useMemo(() => {
    const cleanUserName = (user.name || '').trim().toLowerCase();
    return (leadershipTenures || []).filter(
      t =>
        t.leaderId === user.id ||
        (cleanUserName && t.leaderName && t.leaderName.trim().toLowerCase() === cleanUserName)
    );
  }, [leadershipTenures, user.id, user.name]);
  const [activeTab, setActiveTab] = useState<AccountProfileTab>('overview');

  const roleLabel = getDisplayRoleLabel(user, user.role);
  const isDean = isDeanRole(user, user.role);
  const isChair = isChairRole(user, user.role);
  const isAdmin = (user.role === 'admin' || user.role === 'superadmin') && !isDean && !isChair;
  const isFaculty = isFacultyRole(user, user.role);
  const isAdministrative = isAdministrativeMonitor(user, user.role);

  // Field visibility by role:
  const showCollege = !isAdmin;
  const showProgram = !isAdmin && !isDean;
  const showDesignation = isFaculty;
  const showCoursesTab = !isAdministrative;

  // Address normalization
  const permAddr = user.permanentAddressDetails || parseAddress(user.permanentAddress || user.address);
  const isSameAs = Boolean(
    user.sameAsPermanentAddress ||
    (user.permanentAddress && user.presentAddress && user.permanentAddress === user.presentAddress)
  );
  const presAddr = isSameAs
    ? permAddr
    : (user.presentAddressDetails || parseAddress(user.presentAddress || user.address));

  // College & Program matches
  const collegeMatch =
    (colleges || []).find((c: College) => c.id === user.collegeId)?.name ||
    user.collegeName ||
    'College of Computer Science';

  const normalizeProgramName = (rawName?: string) => {
    if (!rawName) return '—';
    const deptMatch = (departments || []).find((d: Department) => d.id === rawName || d.name === rawName);
    if (deptMatch) return deptMatch.name;
    const clean = rawName.replace(/^Department of\s+/i, '').trim();
    if (/^computer science$/i.test(clean)) return 'BS Computer Science';
    if (/^information technology$/i.test(clean)) return 'BS Information Technology';
    if (/^information systems$/i.test(clean)) return 'BS Information Systems';
    return rawName;
  };

  const programMatch = normalizeProgramName(user.program || user.department);

  // Courses matching
  const userCourses = (db?.courses || []).filter(c => {
    if (user.role === 'student') return (user.enrolledCourseIds || []).includes(c.id);
    if (isFacultyRole(user, user.role)) return c.instructorId === user.id;
    return false;
  });

  const location = useLocation();
  const locationState = location?.state as { from?: string; fromLabel?: string } | null;

  const backLabel = (() => {
    if (locationState?.fromLabel) {
      return `Back to ${locationState.fromLabel}`;
    }
    if (locationState?.from) {
      if (locationState.from.includes('/governance/programs')) return 'Back to Program';
      if (locationState.from.includes('/governance')) return 'Back to Governance';
      if (locationState.from.includes('/accounts')) return 'Back to Accounts';
      return 'Back';
    }
    if (typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      return 'Back';
    }
    return 'Back to Accounts';
  })();

  const handleBack = () => {
    // 1. If history exists in current session, go back in history to the originating page
    if (typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    // 2. If an origin path was explicitly passed in router state, navigate there
    if (locationState?.from) {
      navigate(locationState.from);
      return;
    }

    // 3. Fallback to tab navigation if available
    if (onNavigateTab) {
      onNavigateTab('accounts');
      return;
    }

    // 4. Default fallback
    navigate('/accounts');
  };

  const subtitleItems = [
    showDesignation && user.title ? user.title : null,
    showProgram && programMatch !== '—' ? programMatch : null,
    showCollege ? collegeMatch : null,
  ].filter(Boolean);

  const tabs: { id: AccountProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview & Placement', icon: <UserCheck className="w-4 h-4" /> },
    ...(!isAdministrative ? [{
      id: 'records' as AccountProfileTab,
      label: user.role === 'student' ? 'Family & Guardian' : 'Educational Background',
      icon: user.role === 'student' ? <Users className="w-4 h-4" /> : <Award className="w-4 h-4" />,
      count: user.role !== 'student' ? (user.educationalBackground?.length || 0) : undefined,
    }] : []),
    ...(showCoursesTab ? [{
      id: 'courses' as AccountProfileTab,
      label: 'Courses & Shells',
      icon: <BookOpen className="w-4 h-4" />,
      count: userCourses.length,
    }] : []),
  ];

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16 select-none">
      {/* Top Action Bar */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border px-3.5 py-2 rounded-xl transition-all shadow-none cursor-pointer active:scale-[0.98] shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <div className="flex-1">
          <PageHeader
            title={`${user.name}'s Profile`}
            description="Institutional records, academic credentials, and directory details."
          />
        </div>
      </div>

      {/* Identity Hero Card (matching ProfilePage) */}
      <div className="bg-card border border-border rounded-3xl shadow-card overflow-hidden">
        {/* Banner card behind the user profile - clean accent color without shadows */}
        <div className="relative h-40 sm:h-48 bg-gradient-to-r from-primary via-primary/85 to-primary/70 overflow-hidden">
          {/* Subtle ambient light highlights */}
          <div aria-hidden="true" className="absolute -right-10 -top-10 w-72 h-72 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div aria-hidden="true" className="absolute -left-10 -bottom-10 w-72 h-72 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative flex items-center justify-start p-5">
            <span className="px-3 py-1 text-[11px] font-semibold bg-white/20 backdrop-blur-md text-white rounded-full border border-white/25">
              AY {user.schoolYear || '2025-2026'}
            </span>
          </div>
        </div>

        {/* Identity content centered in front of & overlapping the banner */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pb-6 sm:pb-8">
          {/* Centered Avatar overlapping the banner bottom */}
          <div className="relative shrink-0 -mt-14 sm:-mt-16 mb-4">
            <UserAvatar
              name={user.name}
              src={user.avatar}
              className="w-28 h-28 rounded-2xl object-cover border-4 border-card bg-card shadow-card"
            />
          </div>

          {/* Centered User Details */}
          <div className="flex flex-col items-center max-w-xl">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {user.name}
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                {roleLabel}
              </span>
              {activeUser?.id === user.id && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                  You
                </span>
              )}
            </div>

            {subtitleItems.length > 0 && (
              <p className="text-sm font-medium text-muted-foreground mt-1.5">
                {subtitleItems.join(' • ')}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground mt-2">
              <div className="flex items-center space-x-1.5 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.studentId && (
                <div className="flex items-center space-x-1 font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border">
                  <IdCard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-bold text-foreground">{user.studentId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-border/70 pb-3" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & PLACEMENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Academic & Placement Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
              <Building className="w-4 h-4 text-primary" />
              <span>Academic & Institutional Placement</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Academic / ID Number
                </span>
                <span className="font-mono font-bold text-foreground text-xs">{user.studentId || '—'}</span>
              </div>

              {showCollege && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Collegiate Affiliation
                  </span>
                  <span className="font-semibold text-foreground text-xs truncate block">{collegeMatch}</span>
                </div>
              )}

              {showProgram && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Program / Department
                  </span>
                  <span className="font-semibold text-foreground text-xs truncate block">{programMatch}</span>
                </div>
              )}

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  School Year Registered
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {user.schoolYear ? (user.schoolYear.startsWith('AY') ? user.schoolYear : `AY ${user.schoolYear}`) : 'AY 2025-2026'}
                </span>
              </div>

              {user.role === 'student' && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Student Year Level
                  </span>
                  <span className="font-bold text-primary text-xs">Year {user.yearLevel ?? 1}</span>
                </div>
              )}

              {!isAdministrative && user.role !== 'student' && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Teaching Experience
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    {user.yearsOfTeaching ?? 0} {Number(user.yearsOfTeaching) === 1 ? 'Year' : 'Years'}
                  </span>
                </div>
              )}

              {showDesignation && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Designation / Title
                  </span>
                  <span className="font-medium text-foreground text-xs">{user.title || 'Standard Member'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Personal & Contact Information Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
              <Phone className="w-4 h-4 text-primary" />
              <span>Personal & Contact Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Full Legal Name
                </span>
                <span className="font-bold text-foreground text-xs">{user.name}</span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Institutional Email
                </span>
                <span className="font-medium text-foreground text-xs truncate block">{user.email}</span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Contact Number
                </span>
                <span className="font-mono font-medium text-foreground text-xs">{user.contactNumber || '—'}</span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Date of Birth
                </span>
                <span className="font-medium text-foreground text-xs">
                  {user.birthday ? new Date(user.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Residential Addresses Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <span>Residential Addresses</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Permanent Address */}
              <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    Permanent Address
                  </span>
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {formatAddress(permAddr) || user.permanentAddress || user.address || '—'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                  <div><span className="font-semibold text-foreground">Barangay:</span> {permAddr.barangay || '—'}</div>
                  <div><span className="font-semibold text-foreground">City/Mun:</span> {permAddr.municipalityCity || '—'}</div>
                  <div><span className="font-semibold text-foreground">Province:</span> {permAddr.province || '—'}</div>
                  <div><span className="font-semibold text-foreground">Street/Bldg:</span> {permAddr.houseStreet || '—'}</div>
                </div>
              </div>

              {/* Present Address */}
              <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    Present Address
                  </span>
                  {isSameAs && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-primary/10 text-primary border border-primary/20">
                      Same as Permanent
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {formatAddress(presAddr) || user.presentAddress || '—'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                  <div><span className="font-semibold text-foreground">Barangay:</span> {presAddr.barangay || '—'}</div>
                  <div><span className="font-semibold text-foreground">City/Mun:</span> {presAddr.municipalityCity || '—'}</div>
                  <div><span className="font-semibold text-foreground">Province:</span> {presAddr.province || '—'}</div>
                  <div><span className="font-semibold text-foreground">Street/Bldg:</span> {presAddr.houseStreet || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE RECORDS (Family for students, Educational background for faculty/staff) */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          {user.role === 'student' ? (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
                <Users className="w-4 h-4 text-primary" />
                <span>Family & Guardian Information</span>
              </div>

              <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-4">
                {user.hasGuardianOnly ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                      Designated Guardian
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {[user.guardianName?.firstName, user.guardianName?.middleName, user.guardianName?.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                        Mother's Name
                      </span>
                      <p className="text-xs font-bold text-foreground">
                        {[user.motherName?.firstName, user.motherName?.middleName, user.motherName?.lastName].filter(Boolean).join(' ') || '—'}
                      </p>
                    </div>

                    <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                        Father's Name
                      </span>
                      <p className="text-xs font-bold text-foreground">
                        {[user.fatherName?.firstName, user.fatherName?.middleName, user.fatherName?.lastName].filter(Boolean).join(' ') || '—'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                      Parent / Emergency Contact Number
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs">{user.parentContactNumber || '—'}</span>
                  </div>
                  <Phone className="w-4 h-4 text-primary opacity-60" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
                <Award className="w-4 h-4 text-primary" />
                <span>Educational Background & Academic Degrees</span>
              </div>

              {(!user.educationalBackground || user.educationalBackground.length === 0) ? (
                <div className="p-8 bg-muted/20 border border-dashed border-border rounded-xl text-center space-y-2">
                  <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-bold text-foreground">No Educational Degrees Recorded</p>
                  <p className="text-[11px] text-muted-foreground">
                    This member has not yet submitted their degree history.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {user.educationalBackground.map((deg, idx) => (
                    <div key={deg.id || idx} className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {DEGREE_LABELS[deg.degreeLevel] || deg.degreeLevel || 'Degree'}
                        </span>
                        {deg.yearGraduated && (
                          <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                            Class of {deg.yearGraduated}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-foreground">{deg.specialization || 'General Field'}</div>
                      <div className="text-xs text-muted-foreground flex items-center space-x-1.5">
                        <Building className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{deg.school}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Institutional Governance & Leadership Service History */}
          {userTenures.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
                <Award className="w-4 h-4 text-primary" />
                <span>Institutional Governance & Leadership Service History</span>
              </div>

              <div className="space-y-3">
                {userTenures.map((tenure) => (
                  <div
                    key={tenure.id}
                    className="p-3.5 bg-muted/30 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-foreground">
                          {tenure.role === 'admin'
                            ? 'University Administrator'
                            : tenure.role === 'dean'
                            ? `Dean, ${tenure.unitName}`
                            : `Chairperson, ${tenure.unitName}`}
                        </span>
                        {tenure.status === 'active' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Current Incumbent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground border border-border">
                            Archived Service
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Term:{' '}
                        {new Date(tenure.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}{' '}
                        –{' '}
                        {tenure.endDate
                          ? new Date(tenure.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : 'Present'}
                        {tenure.appointedBy && ` • Appointed by ${tenure.appointedBy}`}
                      </div>
                      {tenure.transitionNotes && (
                        <div className="text-[11px] text-muted-foreground italic">
                          "{tenure.transitionNotes}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COURSES & SHELLS */}
      {activeTab === 'courses' && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-none space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/60 pb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Associated Courses & Assigned Shells</span>
          </div>

          {userCourses.length === 0 ? (
            <div className="p-8 bg-muted/20 border border-dashed border-border rounded-xl text-center space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-bold text-foreground">No Course Shells Found</p>
              <p className="text-[11px] text-muted-foreground">
                This account is currently not enrolled in or assigned to teach any active courses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userCourses.map((c) => (
                <div key={c.id} className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {c.code}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {c.term || 'AY 2025-2026'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground line-clamp-1">{c.title}</h4>
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                    <span>Section {c.section}</span>
                    <span>{c.enrolledCount} {c.enrolledCount === 1 ? 'student' : 'students'} enrolled</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-start pt-4 border-t border-border/70">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </div>
    </div>
  );
};
