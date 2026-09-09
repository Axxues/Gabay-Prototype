import React, { useState, useEffect } from 'react';
import { useLMS, LMSProvider } from './context/LMSContext';
import { GlobalSidebar } from './components/layout/GlobalSidebar';
import { TopNavbar } from './components/layout/TopNavbar';
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
import { SpeedGraderModal } from './components/grading/SpeedGraderModal';
import { RoleSwitcherModal } from './components/common/RoleSwitcherModal';
import { GlobalSearchDialog } from './components/common/GlobalSearchDialog';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [courseSubTab, setCourseSubTab] = useState<string>('modules');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { activeCourseId, setActiveCourseId, logHistory, isAuthenticated } = useLMS();

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
      {/* Fixed Full-Width Top Navbar (Cellwego Layout) */}
      <TopNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTab={currentTab}
        courseTab={currentTab === 'courses' ? courseSubTab : undefined}
        onNavigateCourse={handleNavigateCourse}
        onSelectCourseTab={(tab) => {
          setCourseSubTab(tab);
          logHistory(`/lms/courses/${activeCourseId}/${tab}`, `LMS > Course > ${tab}`);
        }}
        onNavigateTab={handleNavigateTab}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Main App Canvas underneath TopNavbar */}
      <div className="relative flex min-w-0 flex-1 overflow-hidden pt-16">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 overlay-backdrop z-10 lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Collapsible Global Sidebar */}
        <div className="w-0 flex-[0_0_0px] overflow-visible lg:w-auto lg:flex-shrink-0">
          <GlobalSidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            currentTab={currentTab}
            setCurrentTab={handleNavigateTab}
          />
        </div>

        {/* Dynamic Page Views Canvas with Cellwego Scrollbar & Container */}
        <main className={`relative min-w-0 w-full flex-1 ${currentTab === 'courses' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
          <div className={currentTab === 'courses' ? "h-full flex-1 min-w-0 animate-fade-in-up" : "p-5 sm:p-8 lg:p-10 max-w-[1600px] mx-auto animate-fade-in-up w-full"}>
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

export const App: React.FC = () => {
  return (
    <LMSProvider>
      <AppContent />
    </LMSProvider>
  );
};

export default App;
