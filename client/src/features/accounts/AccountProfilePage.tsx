import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import type { User, College, Department } from '../../shared/types/lms';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { getDisplayRoleLabel, isFacultyRole, isAdministrativeMonitor, isDeanRole, isChairRole } from '../../shared/utils/roles';
import { formatAddress, parseAddress, DEGREE_LABELS } from '../../shared/utils/profileCompletion';
import {
  ArrowLeft,
  Edit3,
  Mail,
  Phone,
  MapPin,
  Building,
  GraduationCap,
  Users,
  Award,
  BookOpen,
  CheckCircle2,
  UserCheck,
  IdCard,
} from 'lucide-react';

interface AccountProfilePageProps {
  user: User;
  onNavigateTab?: (tab: string) => void;
  onEditAccount?: (user: User) => void;
}

type AccountProfileTab = 'overview' | 'records' | 'courses';

export const AccountProfilePage: React.FC<AccountProfilePageProps> = ({
  user,
  onNavigateTab,
  onEditAccount,
}) => {
  const navigate = useNavigate();
  const { colleges, departments, db, activeUser } = useLMS();
  const [activeTab, setActiveTab] = useState<AccountProfileTab>('overview');

  const roleLabel = getDisplayRoleLabel(user, user.role);
  const isAdministrative = isAdministrativeMonitor(user, user.role);

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

  const handleBack = () => {
    if (onNavigateTab) {
      onNavigateTab('accounts');
    } else {
      navigate('/accounts');
    }
  };

  const handleEdit = () => {
    if (onEditAccount) {
      onEditAccount(user);
    } else {
      navigate(`/accounts/${encodeURIComponent(user.id)}/edit`);
    }
  };

  const tabs: { id: AccountProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview & Placement', icon: <UserCheck className="w-4 h-4" /> },
    ...(!isAdministrative ? [{
      id: 'records' as AccountProfileTab,
      label: user.role === 'student' ? 'Family & Guardian' : 'Educational Background',
      icon: user.role === 'student' ? <Users className="w-4 h-4" /> : <Award className="w-4 h-4" />,
      count: user.role !== 'student' ? (user.educationalBackground?.length || 0) : undefined,
    }] : []),
    { id: 'courses', label: 'Courses & Shells', icon: <BookOpen className="w-4 h-4" />, count: userCourses.length },
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
          <span>Back to Accounts</span>
        </button>

        <div className="flex-1">
          <PageHeader
            title={`${user.name}'s Profile`}
            description="Institutional records, academic credentials, and directory details."
            actions={
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center space-x-1.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground px-3.5 py-2 rounded-xl transition-all shadow-none cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Account</span>
              </button>
            }
          />
        </div>
      </div>

      {/* Identity Hero Card (matching ProfilePage) */}
      <div className="bg-card border border-border rounded-3xl shadow-card overflow-hidden">
        {/* Banner Cover */}
        <div className="relative h-44 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent overflow-hidden">
          {user.banner ? (
            <>
              <img
                src={user.banner}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            </>
          ) : (
            <>
              <div aria-hidden="true" className="absolute -right-16 -top-24 w-72 h-72 rounded-full bg-primary/15 blur-2xl" />
              <div aria-hidden="true" className="absolute right-40 -bottom-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
            </>
          )}

          <div className="relative flex items-center justify-between p-5">
            <span className="px-3 py-1 text-[11px] font-semibold bg-card/80 backdrop-blur text-foreground rounded-full border border-border">
              AY {user.schoolYear || '2025-2026'}
            </span>
            <span className="flex items-center space-x-2 px-3 py-1 bg-card/80 backdrop-blur rounded-full border border-border">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active Account</span>
            </span>
          </div>
        </div>

        {/* Identity Row */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 -mt-12 sm:-mt-14">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0">
              <UserAvatar
                name={user.name}
                src={user.avatar}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl border-4 border-card shadow-elevated shrink-0 object-cover"
              />
              <div className="space-y-1 min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">
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
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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

            <div className="flex items-center gap-2 shrink-0 pb-1">
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center space-x-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Account Information</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 bg-card border border-border rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Role & Designation
          </span>
          <div className="text-sm font-extrabold text-foreground truncate">
            {user.title || (user.role === 'student' ? 'Undergraduate Student' : roleLabel)}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {user.adminSubrole ? `Subrole: ${user.adminSubrole}` : `Role: ${user.role}`}
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Department / Program
          </span>
          <div className="text-sm font-extrabold text-foreground truncate">
            {programMatch}
          </div>
          <span className="text-[10px] text-muted-foreground block truncate">
            {collegeMatch}
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            {user.role === 'student'
              ? 'Current Year Level'
              : isAdministrative
              ? 'Jurisdiction'
              : 'Teaching Experience'}
          </span>
          <div className="text-sm font-extrabold text-primary truncate">
            {user.role === 'student'
              ? `Year ${user.yearLevel ?? 1}`
              : isAdministrative
              ? (isChairRole(user, user.role)
                  ? 'Program-Wide'
                  : isDeanRole(user, user.role)
                  ? 'College-Wide'
                  : 'University-Wide')
              : `${user.yearsOfTeaching ?? 0} ${Number(user.yearsOfTeaching) === 1 ? 'Year' : 'Years'}`}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {isAdministrative ? 'Administrative Scope' : `AY ${user.schoolYear || '2025-2026'}`}
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Course Shells
          </span>
          <div className="text-sm font-extrabold text-foreground">
            {userCourses.length} {userCourses.length === 1 ? 'Course' : 'Courses'}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {isFacultyRole(user, user.role) ? 'Assigned to teach' : user.role === 'student' ? 'Active enrollments' : 'Monitored courses'}
          </span>
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

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Collegiate Affiliation
                </span>
                <span className="font-semibold text-foreground text-xs truncate block">{collegeMatch}</span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Program / Department
                </span>
                <span className="font-semibold text-foreground text-xs truncate block">{programMatch}</span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Active School Year
                </span>
                <span className="font-semibold text-foreground text-xs">{user.schoolYear || '2025-2026'}</span>
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

              {isAdministrative && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Administrative Scope
                  </span>
                  <span className="font-bold text-primary text-xs">
                    {isChairRole(user, user.role)
                      ? 'Program Monitor'
                      : isDeanRole(user, user.role)
                      ? 'College Monitor'
                      : 'University Monitor'}
                  </span>
                </div>
              )}

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Designation / Title
                </span>
                <span className="font-medium text-foreground text-xs">{user.title || 'Standard Member'}</span>
              </div>
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

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Registration Date
                </span>
                <span className="font-medium text-foreground text-xs">
                  {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Verified Active'}
                </span>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                  Account Status
                </span>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Provisioned & Active</span>
                </div>
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
      <div className="flex items-center justify-between pt-4 border-t border-border/70">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Manage Accounts</span>
        </button>

        <button
          type="button"
          onClick={handleEdit}
          className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit User Account</span>
        </button>
      </div>
    </div>
  );
};
