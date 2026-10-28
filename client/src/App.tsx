import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLMS, LMSProvider } from './shared/context/LMSContext';
import { GabayChatProvider } from './shared/context/GabayChatContext';
import { AppRail } from './shared/components/layout/AppRail';
import { LMSContextPanel } from './shared/components/layout/LMSContextPanel';
import { Topbar } from './shared/components/layout/Topbar';
import { LoginPage, RegisterPage, ProfilePage } from './features/auth';
import { CourseInvitationAcceptModal } from './features/courses';
import { RoleSwitcherModal } from './shared/components/common/RoleSwitcherModal';
import { GlobalSearchDialog } from './shared/components/common/GlobalSearchDialog';
import { PageTransition } from './shared/components/common/PageTransition';
import { AppSkeleton, ProfileSkeleton, PageSkeleton, AuthCardSkeleton } from './shared/components/common/AppSkeleton';
import { tabToPath, courseToPath, pathToTab } from './shared/config/routes';
import { isProfileComplete } from './shared/utils/profileCompletion';
import { isChairRole, canManageCourseContent } from './shared/utils/roles';

const DashboardPage = React.lazy(() => import('./features/dashboard').then(m => ({ default: m.DashboardPage })));
const CoursesPage = React.lazy(() => import('./features/courses').then(m => ({ default: m.CoursesPage })));
const AssignedCoursesUploadView = React.lazy(() => import('./features/courses').then(m => ({ default: m.AssignedCoursesUploadView || m.ChairSheetUploadView })));
const EditCoursePage = React.lazy(() => import('./features/courses').then(m => ({ default: m.EditCoursePage })));
const CalendarPage = React.lazy(() => import('./features/calendar').then(m => ({ default: m.CalendarPage })));
const InboxPage = React.lazy(() => import('./features/inbox').then(m => ({ default: m.InboxPage })));
const HistoryPage = React.lazy(() => import('./features/system').then(m => ({ default: m.HistoryPage })));
const HelpPage = React.lazy(() => import('./features/system').then(m => ({ default: m.HelpPage })));
const EmptyPage = React.lazy(() => import('./features/system').then(m => ({ default: m.EmptyPage })));
const ManageAccountsPage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.ManageAccountsPage })));
const CreateLeadershipAccountPage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.CreateLeadershipAccountPage })));
const AcademicGovernancePage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.AcademicGovernancePage })));
const ProgramDetailsPage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.ProgramDetailsPage })));
const EditAccountPage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.EditAccountPage })));
const AccountProfilePage = React.lazy(() => import('./features/accounts').then(m => ({ default: m.AccountProfilePage })));
const GabayRAGPage = React.lazy(() => import('./features/rag').then(m => ({ default: m.GabayRAGPage })));
const SpeedGraderModal = React.lazy(() => import('./features/assessments').then(m => ({ default: m.SpeedGraderModal })));

function useAppNavigation() {
  const navigate = useNavigate();
  const { activeCourseId, setActiveCourseId, logHistory } = useLMS();

  const handleNavigateTab = React.useCallback((tab: string) => {
    if (tab === 'edit-account') {
      navigate('/accounts');
      logHistory('/accounts', 'LMS > Edit Account');
      return;
    }
    if (tab === 'create-leadership' || tab === 'create-account') {
      navigate('/accounts/create-leadership');
      logHistory('/accounts/create-leadership', 'LMS > Create Leadership Account');
      return;
    }
    const path = tabToPath(tab, activeCourseId);
    navigate(path);
    logHistory(path, `LMS > ${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  }, [navigate, activeCourseId, logHistory]);

  const handleNavigateCourse = React.useCallback((courseId: string, subTab = 'modules') => {
    setActiveCourseId(courseId);
    const path = courseToPath(courseId, subTab);
    navigate(path);
    logHistory(path, `LMS > Course > ${subTab}`);
  }, [navigate, setActiveCourseId, logHistory]);

  const handleSelectCourseTab = React.useCallback((subTab: string) => {
    if (activeCourseId) {
      handleNavigateCourse(activeCourseId, subTab);
    }
  }, [activeCourseId, handleNavigateCourse]);

  const handleEditAccount = React.useCallback((user: { id: string }) => {
    const path = `/accounts/${encodeURIComponent(user.id)}/edit`;
    navigate(path);
    logHistory(path, 'LMS > Edit Account');
  }, [navigate, logHistory]);

  const handleViewAccount = React.useCallback((user: { id: string }) => {
    const path = `/accounts/${encodeURIComponent(user.id)}/view`;
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/accounts';
    const isProgram = currentPath.includes('/governance/programs');
    const isGov = currentPath.includes('/governance');
    const fromLabel = isProgram ? 'Program' : isGov ? 'Governance' : currentPath.includes('/accounts') ? 'Accounts' : undefined;
    navigate(path, {
      state: {
        from: currentPath,
        fromLabel,
      },
    });
    logHistory(path, 'LMS > View Account Profile');
  }, [navigate, logHistory]);

  return { handleNavigateTab, handleNavigateCourse, handleSelectCourseTab, handleEditAccount, handleViewAccount };
}

const AuthLoadingScreen: React.FC = () => {
  const { pathname } = useLocation();
  if (pathname === '/login' || pathname === '/register' || pathname === '/activate') {
    return <AuthCardSkeleton />;
  }
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return <ProfileSkeleton />;
  }
  return <AppSkeleton />;
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authReady, isSessionExpired } = useLMS();
  if (!authReady) {
    return <AuthLoadingScreen />;
  }
  if (isSessionExpired && !isAuthenticated) {
    return <AuthLoadingScreen />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRole } = useLMS();
  if (activeRole !== 'admin' && activeRole !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export const isLeadershipCreator = (activeRole?: string, activeUser?: any): boolean => {
  const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
  const isChair = (activeRole === 'admin' && activeUser?.adminSubrole === 'chairperson') || isChairRole(activeUser, activeRole);
  return (activeRole === 'superadmin' || activeRole === 'admin') && !isDean && !isChair;
};

const RequireLeadershipCreator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRole, activeUser } = useLMS();
  if (!isLeadershipCreator(activeRole, activeUser)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const RequireChair: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeUser, activeRole } = useLMS();
  if (!isChairRole(activeUser, activeRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export const LoginRoute: React.FC = () => {
  const { isAuthenticated, authReady, isSessionExpired, currentUser, activeUser } = useLMS();

  if (!authReady) {
    return <AuthLoadingScreen />;
  }
  if (isSessionExpired) {
    return <LoginPage />;
  }
  if (isAuthenticated) {
    const user = currentUser || activeUser;
    return <Navigate to={isProfileComplete(user) ? '/dashboard' : '/profile'} replace />;
  }
  return <LoginPage />;
};

const preloadCourseSubTab = (subTab?: string) => {
  const tab = subTab ? decodeURIComponent(subTab) : 'modules';
  switch (tab) {
    case 'people':
      void import('./features/people');
      break;
    case 'modules':
      void import('./features/modules');
      break;
    case 'syllabus':
      void import('./features/syllabus');
      break;
    case 'announcements':
      void import('./features/inbox');
      break;
    case 'files':
      void import('./features/files');
      break;
    case 'activities':
    case 'assignments':
    case 'projects':
    case 'presentations':
    case 'quizzes':
    case 'assessments':
    case 'grades':
      void import('./features/assessments');
      break;
    default:
      void import('./features/modules');
      break;
  }
};

const CoursesRoute: React.FC = () => {
  const { courseId, subTab } = useParams<{ courseId?: string; subTab?: string }>();
  const [searchParams] = useSearchParams();
  const { activeCourseId, setActiveCourseId } = useLMS();

  // Eagerly preload subtab module chunk in parallel with CoursesPage to avoid sequential lazy waterfalls on refresh
  preloadCourseSubTab(subTab);

  useEffect(() => {
    if (courseId && courseId !== activeCourseId) {
      setActiveCourseId(decodeURIComponent(courseId));
    }
  }, [courseId, activeCourseId, setActiveCourseId]);

  const effectiveSubTab = subTab ? decodeURIComponent(subTab) : 'modules';
  const peopleTab = searchParams.get('tab') === 'pending' ? 'pending' : undefined;
  return (
    <CoursesPage
      key={`${courseId ?? activeCourseId ?? 'none'}-${effectiveSubTab}-${peopleTab ?? 'default'}`}
      initialSubTab={effectiveSubTab}
      initialPeopleTab={peopleTab}
    />
  );
};

const AssignedCoursesRoute: React.FC = () => {
  const nav = useAppNavigation();
  return (
    <AssignedCoursesUploadView
      onNavigateCourse={nav.handleNavigateCourse}
      onNavigateTab={nav.handleNavigateTab}
    />
  );
};

const EditCourseRoute: React.FC<{ nav: ReturnType<typeof useAppNavigation> }> = ({ nav }) => {
  const { courseId } = useParams<{ courseId: string }>();
  const { db, activeUser } = useLMS();
  const decodedId = courseId ? decodeURIComponent(courseId) : undefined;
  const course = decodedId ? db.courses.find(c => c.id === decodedId) : undefined;
  if (!course) {
    return <Navigate to="/dashboard" replace />;
  }
  if (!canManageCourseContent(course, activeUser)) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <EditCoursePage
      key={course.id}
      course={course}
      onNavigateTab={nav.handleNavigateTab}
      onNavigateCourse={nav.handleNavigateCourse}
    />
  );
};

const EditAccountRoute: React.FC<{ nav: ReturnType<typeof useAppNavigation> }> = ({ nav }) => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useLMS();
  const decodedId = userId ? decodeURIComponent(userId) : undefined;
  const user = decodedId ? db.users.find(u => u.id === decodedId) : undefined;
  if (!user) {
    return <ManageAccountsPage onNavigateTab={nav.handleNavigateTab} onEditAccount={nav.handleEditAccount} onViewAccount={nav.handleViewAccount} />;
  }
  return <EditAccountPage key={user.id} user={user} onNavigateTab={nav.handleNavigateTab} />;
};

const AccountProfileRoute: React.FC<{ nav: ReturnType<typeof useAppNavigation> }> = ({ nav }) => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useLMS();
  const decodedId = userId ? decodeURIComponent(userId) : undefined;
  const user = decodedId ? db.users.find(u => u.id === decodedId) : undefined;
  if (!user) {
    return <ManageAccountsPage onNavigateTab={nav.handleNavigateTab} onEditAccount={nav.handleEditAccount} onViewAccount={nav.handleViewAccount} />;
  }
  return <AccountProfilePage key={user.id} user={user} onNavigateTab={nav.handleNavigateTab} />;
};

export const AppShell: React.FC = () => {
  const location = useLocation();
  const { activeCourseId, setActiveCourseId, activeRole, activeUser, logout } = useLMS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [invitationModalData, setInvitationModalData] = useState<{
    courseId: string;
    requestId?: string;
    studentId?: string;
  } | null>(null);

  useEffect(() => {
    // 1. Direct query param on current route
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'join' && params.get('courseId')) {
      const courseId = params.get('courseId')!;
      const requestId = params.get('requestId') || undefined;
      const studentId = params.get('studentId') || undefined;
      setInvitationModalData({ courseId, requestId, studentId });
      sessionStorage.removeItem('gabay_pending_join');
      return;
    }

    // 2. Pending invitation stored from before sign-in
    const pending = sessionStorage.getItem('gabay_pending_join');
    if (pending) {
      try {
        const parsedJoin = JSON.parse(pending);
        if (parsedJoin.courseId) {
          setInvitationModalData(parsedJoin);
        }
      } catch {
        // ignore parse error
      }
      sessionStorage.removeItem('gabay_pending_join');
    }
  }, [location.search]);

  const parsed = pathToTab(location.pathname);
  const currentTab = parsed.tab === 'login' ? 'dashboard' : parsed.tab;
  const courseSubTab = parsed.subTab ?? 'modules';

  // Eagerly preload subtab module chunk in parallel as soon as AppShell renders on /courses
  if (currentTab === 'courses') {
    preloadCourseSubTab(courseSubTab);
  }

  // Keep context activeCourseId in sync with the URL so refresh / deep-link / back-forward restore the course.
  useEffect(() => {
    if (parsed.courseId && parsed.courseId !== activeCourseId) {
      setActiveCourseId(parsed.courseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.courseId]);

  const nav = useAppNavigation();

  // Role-based guard (preserves previous auto-guard behavior, now URL-driven).
  const navigate = useNavigate();
  useEffect(() => {
    if (activeRole === 'staff') {
      const allowedStaffTabs = ['inbox', 'calendar', 'gabay-rag', 'history', 'help', 'profile'];
      if (!allowedStaffTabs.includes(currentTab)) {
        navigate('/inbox', { replace: true });
      }
    } else if (currentTab === 'create-leadership' && !isLeadershipCreator(activeRole, activeUser)) {
      navigate('/dashboard', { replace: true });
    } else if (activeRole !== 'admin' && (activeRole as string) !== 'superadmin') {
      if (currentTab === 'accounts' || currentTab === 'create-account' || currentTab === 'edit-account' || currentTab === 'account-profile' || currentTab === 'governance') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [activeRole, activeUser, currentTab, navigate]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens search dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenSearch = React.useCallback(() => setSearchOpen(true), []);
  const handleOpenSidebar = React.useCallback(() => setSidebarOpen(true), []);
  const handleCloseSidebar = React.useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted font-sans selection:bg-primary/20 dark:bg-background">
      <Topbar
        currentTab={currentTab}
        onNavigateTab={nav.handleNavigateTab}
        onNavigateCourse={nav.handleNavigateCourse}
        onOpenSearch={handleOpenSearch}
        onOpenSidebar={handleOpenSidebar}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden pt-16">
        {sidebarOpen && (
          <div
            className="fixed inset-0 overlay-backdrop z-10 lg:hidden transition-opacity animate-fade-in"
            onClick={handleCloseSidebar}
          />
        )}

        <div className="hidden lg:flex"><AppRail currentTab={currentTab} onNavigateTab={nav.handleNavigateTab} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={nav.handleNavigateTab} onSelectCourseTab={nav.handleSelectCourseTab} onNavigateCourse={nav.handleNavigateCourse} /></div>
        {sidebarOpen && <div className="fixed left-0 top-16 bottom-0 z-20 flex lg:hidden animate-slide-in-right"><AppRail currentTab={currentTab} onNavigateTab={(t) => { nav.handleNavigateTab(t); handleCloseSidebar(); }} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={(t) => { nav.handleNavigateTab(t); handleCloseSidebar(); }} onSelectCourseTab={(t) => { nav.handleSelectCourseTab(t); handleCloseSidebar(); }} onNavigateCourse={(id, sub) => { nav.handleNavigateCourse(id, sub); handleCloseSidebar(); }} /></div>}

        <main className={`relative min-h-0 min-w-0 w-full flex-1 ${currentTab === 'courses' || currentTab === 'inbox' || currentTab === 'gabay-rag' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
          <div className={
            currentTab === 'courses' || currentTab === 'inbox' || currentTab === 'gabay-rag'
              ? "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
              : currentTab === 'assigned-courses' || currentTab === 'chair-sheet'
              ? "flex min-h-full w-full min-w-0 flex-1 flex-col p-5 sm:p-8 lg:p-10"
              : currentTab === 'profile' || currentTab === 'account-profile' || currentTab === 'create-leadership'
              ? "flex min-h-full w-full min-w-0 flex-1 flex-col p-5 sm:p-8 lg:p-10"
              : "mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-5 sm:p-8 lg:p-10"
          }>
            <PageTransition pageKey={location.pathname} className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <React.Suspense fallback={<PageSkeleton />}>
                <Outlet context={nav} />
              </React.Suspense>
            </PageTransition>
          </div>
        </main>
      </div>

      <GlobalSearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigateCourse={(id, sub) => { nav.handleNavigateCourse(id, sub); setSearchOpen(false); }}
        onNavigateTab={(t) => { nav.handleNavigateTab(t); setSearchOpen(false); }}
      />
      {import.meta.env.DEV && <RoleSwitcherModal />}
      <React.Suspense fallback={null}>
        <SpeedGraderModal />
      </React.Suspense>
      {invitationModalData && (
        <CourseInvitationAcceptModal
          isOpen={Boolean(invitationModalData)}
          onClose={() => setInvitationModalData(null)}
          courseId={invitationModalData.courseId}
          requestId={invitationModalData.requestId}
          targetStudentId={invitationModalData.studentId}
          onNavigateCourse={(id, sub) => {
            nav.handleNavigateCourse(id, sub);
            setInvitationModalData(null);
          }}
          onSwitchAccount={() => {
            setInvitationModalData(null);
            logout();
          }}
        />
      )}
    </div>
  );
};

// Small wrapper so route elements can share one navigation object without prop drilling.
function RouteWithNav({ element }: { element: (nav: ReturnType<typeof useAppNavigation>) => React.ReactNode }) {
  const nav = useAppNavigation();
  return <>{element(nav)}</>;
}

export const AppContent: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'join') {
      const courseId = params.get('courseId');
      const requestId = params.get('requestId') || '';
      const studentId = params.get('studentId') || '';
      if (courseId) {
        sessionStorage.setItem(
          'gabay_pending_join',
          JSON.stringify({ courseId, requestId, studentId })
        );
      }
    }
  }, [location.search]);

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/activate" element={<RegisterPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RouteWithNav element={(nav) => <DashboardPage onNavigateCourse={nav.handleNavigateCourse} onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/courses/assigned-courses" element={<RequireChair><AssignedCoursesRoute /></RequireChair>} />
        <Route path="/courses/chair-sheet" element={<RequireChair><AssignedCoursesRoute /></RequireChair>} />
        <Route path="/courses/new" element={<RequireChair><AssignedCoursesRoute /></RequireChair>} />
        <Route path="/courses/:courseId/edit" element={<RouteWithNav element={(nav) => <EditCourseRoute nav={nav} />} />} />
        <Route path="/courses" element={<CoursesRoute />} />
        <Route path="/courses/:courseId" element={<CoursesRoute />} />
        <Route path="/courses/:courseId/:subTab" element={<CoursesRoute />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/gabay-rag" element={<GabayRAGPage />} />
        <Route path="/profile" element={<RouteWithNav element={(nav) => <ProfilePage onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/history" element={<RouteWithNav element={(nav) => <HistoryPage onNavigateCourse={nav.handleNavigateCourse} onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/help" element={<RouteWithNav element={(nav) => <HelpPage onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/governance" element={<RequireAdmin><RouteWithNav element={(nav) => <AcademicGovernancePage onNavigateTab={nav.handleNavigateTab} />} /></RequireAdmin>} />
        <Route path="/governance/programs/:deptId" element={<RequireAdmin><RouteWithNav element={(nav) => <ProgramDetailsPage onNavigateTab={nav.handleNavigateTab} />} /></RequireAdmin>} />
        <Route path="/governance/departments/:deptId" element={<RequireAdmin><RouteWithNav element={(nav) => <ProgramDetailsPage onNavigateTab={nav.handleNavigateTab} />} /></RequireAdmin>} />
        <Route path="/accounts" element={<RequireAdmin><RouteWithNav element={(nav) => <ManageAccountsPage onNavigateTab={nav.handleNavigateTab} onEditAccount={nav.handleEditAccount} onViewAccount={nav.handleViewAccount} />} /></RequireAdmin>} />
        <Route path="/accounts/create-leadership" element={<RequireLeadershipCreator><RouteWithNav element={(nav) => <CreateLeadershipAccountPage onNavigateTab={nav.handleNavigateTab} />} /></RequireLeadershipCreator>} />
        <Route path="/accounts/new" element={<Navigate to="/accounts" replace />} />
        <Route path="/accounts/:userId/view" element={<RequireAdmin><RouteWithNav element={(nav) => <AccountProfileRoute nav={nav} />} /></RequireAdmin>} />
        <Route path="/accounts/:userId" element={<RequireAdmin><RouteWithNav element={(nav) => <AccountProfileRoute nav={nav} />} /></RequireAdmin>} />
        <Route path="/accounts/:userId/edit" element={<RequireAdmin><RouteWithNav element={(nav) => <EditAccountRoute nav={nav} />} /></RequireAdmin>} />
        <Route path="/page1" element={<RouteWithNav element={(nav) => <EmptyPage title="Page 1" onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/page2" element={<RouteWithNav element={(nav) => <EmptyPage title="Page 2" onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/page3" element={<RouteWithNav element={(nav) => <EmptyPage title="Page 3" onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  handleResetCache = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground font-sans">
          <div className="max-w-md w-full p-8 bg-card border border-border rounded-2xl shadow-xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xl font-black">
              !
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black">Application Recovery</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gabay encountered an issue while loading. You can refresh or reset the local cache to continue smoothly.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all cursor-pointer"
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const App: React.FC = () => {
  return (
    <AppErrorBoundary>
      <LMSProvider>
        <GabayChatProvider>
          <AppContent />
        </GabayChatProvider>
      </LMSProvider>
    </AppErrorBoundary>
  );
};

export default App;
