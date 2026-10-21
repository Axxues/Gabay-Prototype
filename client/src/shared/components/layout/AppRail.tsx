import React, { useContext } from 'react';
import { LayoutDashboard, BookOpen, Calendar, Inbox, History, HelpCircle, Building, BarChart3, FileCheck2, Users, LogOut, GraduationCap, Sparkles, Landmark } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { GabayChatContext } from '../../context/GabayChatContext';
import { MAIN_NAV, isVisible, type NavIcon } from '../../config/navigation';
import { isDeanRole, isChairRole } from '../../utils/roles';
import type { AcademicSemester } from '../../types/lms';
import { formatSemesterLabel } from '../../utils/academicSemester';

const ICONS: Record<NavIcon, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />, courses: <BookOpen className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />, inbox: <Inbox className="h-5 w-5" />,
  history: <History className="h-5 w-5" />, help: <HelpCircle className="h-5 w-5" />,
  modules: <BookOpen className="h-5 w-5" />, syllabus: <BookOpen className="h-5 w-5" />,
  announcements: <BookOpen className="h-5 w-5" />, activities: <BookOpen className="h-5 w-5" />,
  quizzes: <BookOpen className="h-5 w-5" />, exams: <BookOpen className="h-5 w-5" />, files: <BookOpen className="h-5 w-5" />,
  grades: <BookOpen className="h-5 w-5" />, people: <Users className="h-5 w-5" />,
  'pending-requests': <Users className="h-5 w-5" />,
  'gabay-rag': <Sparkles className="h-5 w-5" />,
  assessments: <BookOpen className="h-5 w-5" />,
  assignments: <BookOpen className="h-5 w-5" />,
  projects: <BookOpen className="h-5 w-5" />,
  presentations: <BookOpen className="h-5 w-5" />,
  governance: <Landmark className="h-5 w-5" />,
  accounts: <Users className="h-5 w-5" />, page1: <Building className="h-5 w-5" />,
  page2: <BarChart3 className="h-5 w-5" />, page3: <FileCheck2 className="h-5 w-5" />,
};

const AppRailComponent: React.FC<{ currentTab: string; onNavigateTab: (t: string) => void }> = ({ currentTab, onNavigateTab }) => {
  const { activeRole, activeUser, logout, showConfirm, db, departments, getBaselineSchoolYear, getActiveSchoolYearForCollege, baselineSemester, getActiveSemesterForCollege } = useLMS();
  const chatCtx = useContext(GabayChatContext);
  const hasOngoingProcess = (chatCtx?.executingSessionIds.length ?? 0) > 0;
  const unread = db.messages.filter(m => m.recipientId === activeUser.id && !m.read).length;
  const lmsActive = ['dashboard','courses','calendar','inbox','history','help'].includes(currentTab);
  const go = (id: string) => { if (id === 'lms') onNavigateTab(activeRole === 'staff' ? 'inbox' : 'dashboard'); else onNavigateTab(id); };

  const isDean = isDeanRole(activeUser, activeRole);
  const isChair = isChairRole(activeUser, activeRole);
  const isDeanOrChair = isDean || isChair;
  const effectiveCollegeId =
    activeUser?.collegeId ||
    (isChair
      ? (departments || []).find(d => d.id === activeUser?.department || d.name === activeUser?.department || d.id === activeUser?.program || d.name === activeUser?.program)?.collegeId || 'col-ccs'
      : undefined);
  const baselineYear = getBaselineSchoolYear?.()?.year;
  const collegeYear = effectiveCollegeId ? getActiveSchoolYearForCollege?.(effectiveCollegeId)?.year : undefined;
  const baselineSem: AcademicSemester = (baselineSemester as AcademicSemester) || 'First';
  const collegeSem: AcademicSemester = (effectiveCollegeId && getActiveSemesterForCollege ? getActiveSemesterForCollege(effectiveCollegeId) : 'First') as AcademicSemester;

  const isYearDiff = Boolean(
    baselineYear &&
    collegeYear &&
    baselineYear.trim().toLowerCase() !== collegeYear.trim().toLowerCase()
  );
  const isSemDiff = Boolean(baselineSem !== collegeSem);

  const hasBaselineMismatch = Boolean(isDeanOrChair && (isYearDiff || isSemDiff));

  return (
    <aside className="flex w-[68px] flex-shrink-0 flex-col items-center border-r border-border/70 bg-background py-3">
      <nav className="flex flex-1 flex-col items-center gap-1">
        {MAIN_NAV.filter(i => isVisible(i, activeRole)).map(item => {
          const active =
            item.id === 'lms'
              ? lmsActive
              : currentTab === item.id ||
                (item.id === 'accounts' &&
                  ['accounts', 'create-account', 'create-leadership', 'edit-account', 'account-profile'].includes(currentTab));
          const isGabayOngoing = item.id === 'gabay-rag' && hasOngoingProcess;

          return (
            <button
              key={item.id}
              type="button"
              title={
                item.id === 'governance' && hasBaselineMismatch
                  ? `The University A.Y. and University Semester (AY ${baselineYear} · ${formatSemesterLabel(baselineSem)}) differ from your college's active academic term (AY ${collegeYear} · ${formatSemesterLabel(collegeSem)})`
                  : isGabayOngoing
                  ? 'GABAY is processing an inquiry…'
                  : item.label
              }
              onClick={() => go(item.id)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'bg-muted text-foreground ring-1 ring-primary/15'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {item.id === 'lms' ? (
                <GraduationCap className="h-5 w-5" />
              ) : item.id === 'gabay-rag' ? (
                <Sparkles
                  className={`h-5 w-5 transition-transform ${
                    isGabayOngoing ? 'animate-spin text-primary' : ''
                  }`}
                />
              ) : (
                ICONS[item.icon]
              )}
              {item.id === 'lms' && unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
              {item.id === 'governance' && hasBaselineMismatch && (
                <span
                  data-testid="governance-baseline-warning"
                  aria-label="University A.Y. and University Semester mismatch warning"
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background shadow-xs pointer-events-none"
                />
              )}
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        title="Sign Out"
        onClick={() => showConfirm('Are you sure you want to sign out of GABAY LMS?', () => logout(), 'Sign Out')}
        className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
};

export const AppRail = React.memo(AppRailComponent);

