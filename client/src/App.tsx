import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLMS, LMSProvider } from './context/LMSContext';
import { GabayChatProvider } from './context/GabayChatContext';
import { AppRail } from './components/layout/AppRail';
import { LMSContextPanel } from './components/layout/LMSContextPanel';
import { Topbar } from './components/layout/Topbar';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { HistoryPage } from './pages/HistoryPage';
import { HelpPage } from './pages/HelpPage';
import { EmptyPage } from './pages/EmptyPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { ManageAccountsPage } from './pages/ManageAccountsPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { EditAccountPage } from './pages/EditAccountPage';
import { GabayRAGPage } from './pages/GabayRAGPage';
import { SpeedGraderModal } from './components/grading/SpeedGraderModal';
import { RoleSwitcherModal } from './components/common/RoleSwitcherModal';
import { GlobalSearchDialog } from './components/common/GlobalSearchDialog';
import { PageTransition } from './components/common/PageTransition';
import { AppSkeleton } from './components/common/AppSkeleton';
import { tabToPath, courseToPath, pathToTab } from './config/routes';

function useAppNavigation() {
  const navigate = useNavigate();
  const { activeCourseId, setActiveCourseId, logHistory } = useLMS();

  const handleNavigateTab = (tab: string) => {
    if (tab === 'edit-account') {
      navigate('/accounts');
      logHistory('/accounts', 'LMS > Edit Account');
      return;
    }
    const path = tabToPath(tab, activeCourseId);
    navigate(path);
    logHistory(path, `LMS > ${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  };

  const handleNavigateCourse = (courseId: string, subTab = 'modules') => {
    setActiveCourseId(courseId);
    const path = courseToPath(courseId, subTab);
    navigate(path);
    logHistory(path, `LMS > Course > ${subTab}`);
  };

  const handleSelectCourseTab = (subTab: string) => {
    if (activeCourseId) {
      handleNavigateCourse(activeCourseId, subTab);
    }
  };

  const handleEditAccount = (user: { id: string }) => {
    const path = `/accounts/${encodeURIComponent(user.id)}/edit`;
    navigate(path);
    logHistory(path, 'LMS > Edit Account');
  };

  return { handleNavigateTab, handleNavigateCourse, handleSelectCourseTab, handleEditAccount };
}

const AuthLoadingScreen: React.FC = () => <AppSkeleton />;

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authReady } = useLMS();
  const location = useLocation();
  if (!authReady) {
    return <AuthLoadingScreen />;
  }
  if (!isAuthenticated) {
    const fromPath = location.pathname === '/gabay-rag' ? '/dashboard' : (location.pathname + location.search);
    return <Navigate to="/login" replace state={{ from: fromPath }} />;
  }
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRole } = useLMS();
  if (activeRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const LoginRoute: React.FC = () => {
  const { isAuthenticated, isLoading, authReady } = useLMS();
  const location = useLocation();
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const from = (stateFrom && stateFrom !== '/gabay-rag' && stateFrom !== '/login') ? stateFrom : '/dashboard';

  if (!authReady || (isAuthenticated && isLoading)) {
    return <AuthLoadingScreen />;
  }
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }
  return <LoginPage />;
};

const CoursesRoute: React.FC = () => {
  const { courseId, subTab } = useParams<{ courseId?: string; subTab?: string }>();
  const { activeCourseId, setActiveCourseId } = useLMS();

  useEffect(() => {
    if (courseId && courseId !== activeCourseId) {
      setActiveCourseId(decodeURIComponent(courseId));
    }
  }, [courseId, activeCourseId, setActiveCourseId]);

  const effectiveSubTab = subTab ? decodeURIComponent(subTab) : 'modules';
  return <CoursesPage key={`${courseId ?? activeCourseId ?? 'none'}-${effectiveSubTab}`} initialSubTab={effectiveSubTab} />;
};

const EditAccountRoute: React.FC<{ nav: ReturnType<typeof useAppNavigation> }> = ({ nav }) => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useLMS();
  const decodedId = userId ? decodeURIComponent(userId) : undefined;
  const user = decodedId ? db.users.find(u => u.id === decodedId) : undefined;
  if (!user) {
    return <ManageAccountsPage onNavigateTab={nav.handleNavigateTab} onEditAccount={nav.handleEditAccount} />;
  }
  return <EditAccountPage key={user.id} user={user} onNavigateTab={nav.handleNavigateTab} />;
};

export const AppShell: React.FC = () => {
  const location = useLocation();
  const { activeCourseId, setActiveCourseId, isLoading, activeRole, isAuthenticated } = useLMS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const parsed = pathToTab(location.pathname);
  const currentTab = parsed.tab === 'login' ? 'dashboard' : parsed.tab;
  const courseSubTab = parsed.subTab ?? 'modules';

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
    } else if (activeRole !== 'admin') {
      if (currentTab === 'accounts' || currentTab === 'create-account' || currentTab === 'edit-account') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [activeRole, currentTab, navigate]);

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

  if (isAuthenticated && isLoading) {
    return <AppSkeleton />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted font-sans selection:bg-primary/20 dark:bg-background">
      <Topbar
        currentTab={currentTab}
        onNavigateTab={nav.handleNavigateTab}
        onNavigateCourse={nav.handleNavigateCourse}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden pt-16">
        {sidebarOpen && (
          <div
            className="fixed inset-0 overlay-backdrop z-10 lg:hidden transition-opacity animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="hidden lg:flex"><AppRail currentTab={currentTab} onNavigateTab={nav.handleNavigateTab} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={nav.handleNavigateTab} onSelectCourseTab={nav.handleSelectCourseTab} onNavigateCourse={nav.handleNavigateCourse} /></div>
        {sidebarOpen && <div className="fixed left-0 top-16 bottom-0 z-20 flex lg:hidden animate-slide-in-right"><AppRail currentTab={currentTab} onNavigateTab={(t) => { nav.handleNavigateTab(t); setSidebarOpen(false); }} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={(t) => { nav.handleNavigateTab(t); setSidebarOpen(false); }} onSelectCourseTab={(t) => { nav.handleSelectCourseTab(t); setSidebarOpen(false); }} onNavigateCourse={(id, sub) => { nav.handleNavigateCourse(id, sub); setSidebarOpen(false); }} /></div>}

        <main className={`relative min-h-0 min-w-0 w-full flex-1 ${currentTab === 'courses' || currentTab === 'inbox' || currentTab === 'gabay-rag' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
          <div className={currentTab === 'courses' || currentTab === 'inbox' || currentTab === 'gabay-rag' ? "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col" : "mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-5 sm:p-8 lg:p-10"}>
            <PageTransition pageKey={location.pathname} className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <Outlet context={nav} />
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
      <RoleSwitcherModal />
      <SpeedGraderModal />
    </div>
  );
};

// Small wrapper so route elements can share one navigation object without prop drilling.
function RouteWithNav({ element }: { element: (nav: ReturnType<typeof useAppNavigation>) => React.ReactNode }) {
  const nav = useAppNavigation();
  return <>{element(nav)}</>;
}

export const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RouteWithNav element={(nav) => <DashboardPage onNavigateCourse={nav.handleNavigateCourse} onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/courses/new" element={<RouteWithNav element={(nav) => <CreateCoursePage onNavigateCourse={nav.handleNavigateCourse} onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/courses" element={<CoursesRoute />} />
        <Route path="/courses/:courseId" element={<CoursesRoute />} />
        <Route path="/courses/:courseId/:subTab" element={<CoursesRoute />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/gabay-rag" element={<GabayRAGPage />} />
        <Route path="/profile" element={<RouteWithNav element={(nav) => <ProfilePage onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/history" element={<RouteWithNav element={(nav) => <HistoryPage onNavigateCourse={nav.handleNavigateCourse} onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/help" element={<RouteWithNav element={(nav) => <HelpPage onNavigateTab={nav.handleNavigateTab} />} />} />
        <Route path="/accounts" element={<RequireAdmin><RouteWithNav element={(nav) => <ManageAccountsPage onNavigateTab={nav.handleNavigateTab} onEditAccount={nav.handleEditAccount} />} /></RequireAdmin>} />
        <Route path="/accounts/new" element={<RequireAdmin><RouteWithNav element={(nav) => <CreateAccountPage onNavigateTab={nav.handleNavigateTab} />} /></RequireAdmin>} />
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
    } catch (_) {
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
