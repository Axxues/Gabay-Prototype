import React, { useState } from 'react';
import { useLMS, LMSProvider } from './context/LMSContext';
import { GlobalSidebar } from './components/layout/GlobalSidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { CommonsPage } from './pages/CommonsPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { HistoryPage } from './pages/HistoryPage';
import { HelpPage } from './pages/HelpPage';
import { SpeedGraderModal } from './components/grading/SpeedGraderModal';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [courseSubTab, setCourseSubTab] = useState<string>('modules');
  const { activeCourseId, setActiveCourseId, logHistory, isAuthenticated } = useLMS();

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
    <div className="flex h-screen w-full overflow-hidden bg-background font-sans">
      {/* Global GABAY Left Sidebar */}
      <GlobalSidebar
        currentTab={currentTab}
        setCurrentTab={handleNavigateTab}
        onNavigateCourse={handleNavigateCourse}
        courseSubTab={courseSubTab}
        setCourseSubTab={(tab) => {
          setCourseSubTab(tab);
          logHistory(`/lms/courses/${activeCourseId}/${tab}`, `LMS > Course > ${tab}`);
        }}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          currentTab={currentTab}
          courseTab={currentTab === 'courses' ? courseSubTab : undefined}
          onNavigateCourse={handleNavigateCourse}
          onSelectCourseTab={(tab) => {
            setCourseSubTab(tab);
            logHistory(`/lms/courses/${activeCourseId}/${tab}`, `LMS > Course > ${tab}`);
          }}
          onNavigateTab={handleNavigateTab}
        />

        {/* Dynamic Page Views */}
        <div className={`flex-1 min-h-0 ${currentTab === 'courses' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {currentTab === 'dashboard' && (
            <DashboardPage onNavigateCourse={handleNavigateCourse} />
          )}

          {currentTab === 'courses' && (
            <CoursesPage initialSubTab={courseSubTab} />
          )}

          {currentTab === 'calendar' && <CalendarPage />}

          {currentTab === 'inbox' && <InboxPage />}

          {currentTab === 'commons' && <CommonsPage />}

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
        </div>
      </div>

      {/* Global Modals */}
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
