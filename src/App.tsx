import React, { useState, useEffect } from 'react';
import { useLMS, LMSProvider } from './context/LMSContext';
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
import { SpeedGraderModal } from './components/grading/SpeedGraderModal';
import { RoleSwitcherModal } from './components/common/RoleSwitcherModal';
import { GlobalSearchDialog } from './components/common/GlobalSearchDialog';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [courseSubTab, setCourseSubTab] = useState<string>('modules');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { setActiveCourseId, logHistory, isAuthenticated, activeRole } = useLMS();

  // Role-based active tab auto-guarding
  useEffect(() => {
    if (activeRole === 'staff') {
      const allowedStaffTabs = ['inbox', 'calendar', 'history', 'help', 'profile'];
      if (!allowedStaffTabs.includes(currentTab)) {
        setCurrentTab('inbox');
      }
    } else if (activeRole !== 'admin') {
      if (currentTab === 'accounts') {
        setCurrentTab('dashboard');
      }
    }
  }, [activeRole, currentTab]);

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

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleNavigateTab = (tab: string) => {
    setCurrentTab(tab);
    logHistory(`/lms/${tab}`, `LMS > ${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  };

  const handleNavigateCourse = (courseId: string, subTab: string = 'modules') => {
    setActiveCourseId(courseId);
    setCourseSubTab(subTab);
    setCurrentTab('courses');
    logHistory(`/lms/courses/${courseId}/${subTab}`, `LMS > Course > ${subTab}`);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted font-sans selection:bg-primary/20 dark:bg-background">
      {/* Fixed Full-Width Topbar */}
      <Topbar
        currentTab={currentTab}
        onNavigateTab={handleNavigateTab}
        onNavigateCourse={handleNavigateCourse}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main App Canvas underneath Topbar */}
      <div className="relative flex min-w-0 flex-1 overflow-hidden pt-16">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 overlay-backdrop z-10 lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Rail + Context Panel (desktop) / drawer (mobile) */}
        <div className="hidden lg:flex"><AppRail currentTab={currentTab} onNavigateTab={handleNavigateTab} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={handleNavigateTab} onSelectCourseTab={(t) => setCourseSubTab(t)} onNavigateCourse={handleNavigateCourse} /></div>
        {sidebarOpen && <div className="fixed left-0 top-16 bottom-0 z-20 flex lg:hidden"><AppRail currentTab={currentTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} onSelectCourseTab={(t) => { setCourseSubTab(t); setSidebarOpen(false); }} onNavigateCourse={(id, sub) => { handleNavigateCourse(id, sub); setSidebarOpen(false); }} /></div>}

        {/* Dynamic Page Views Canvas with Cellwego Scrollbar & Container */}
        <main className={`relative min-w-0 w-full flex-1 ${currentTab === 'courses' || currentTab === 'inbox' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
          <div className={currentTab === 'courses' || currentTab === 'inbox' ? "h-full flex-1 min-w-0 flex flex-col" : "p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto animate-fade-in-up w-full"}>
            {currentTab === 'dashboard' && (
              <DashboardPage
                onNavigateCourse={handleNavigateCourse}
                onNavigateTab={handleNavigateTab}
              />
            )}

            {currentTab === 'create-course' && (
              <CreateCoursePage
                onNavigateCourse={handleNavigateCourse}
                onNavigateTab={handleNavigateTab}
              />
            )}

            {currentTab === 'courses' && (
              <CoursesPage initialSubTab={courseSubTab} />
            )}

            {currentTab === 'calendar' && <CalendarPage />}

            {currentTab === 'inbox' && <InboxPage />}

            {currentTab === 'profile' && (
              <ProfilePage
                onNavigateCourse={handleNavigateCourse}
                onNavigateTab={handleNavigateTab}
              />
            )}

            {currentTab === 'history' && (
              <HistoryPage
                onNavigateCourse={handleNavigateCourse}
                onNavigateTab={handleNavigateTab}
              />
            )}

            {currentTab === 'help' && (
              <HelpPage onNavigateTab={handleNavigateTab} />
            )}

            {currentTab === 'accounts' && (
              <ManageAccountsPage onNavigateTab={handleNavigateTab} />
            )}

            {currentTab === 'page1' && (
              <EmptyPage title="Page 1" onNavigateTab={handleNavigateTab} />
            )}

            {currentTab === 'page2' && (
              <EmptyPage title="Page 2" onNavigateTab={handleNavigateTab} />
            )}

            {currentTab === 'page3' && (
              <EmptyPage title="Page 3" onNavigateTab={handleNavigateTab} />
            )}
          </div>
        </main>
      </div>

      {/* Global Modals & Dialogs */}
      <GlobalSearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigateCourse={handleNavigateCourse}
        onNavigateTab={handleNavigateTab}
      />
      <RoleSwitcherModal />
      <SpeedGraderModal />
    </div>
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
        <AppContent />
      </LMSProvider>
    </AppErrorBoundary>
  );
};

export default App;
