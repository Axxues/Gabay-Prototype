import React, { useState } from 'react';
import { useLMS } from './context/LMSContext';
import { GlobalSidebar } from './components/layout/GlobalSidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { CommonsPage } from './pages/CommonsPage';
import { SpeedGraderModal } from './components/grading/SpeedGraderModal';
import { RoleSwitcherModal } from './components/common/RoleSwitcherModal';
import { HistoryDrawer } from './components/common/HistoryDrawer';
import { HelpDrawer } from './components/common/HelpDrawer';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [courseSubTab, setCourseSubTab] = useState<string>('modules');
  const { setActiveCourseId, logHistory } = useLMS();

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
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950 font-sans">
      {/* Global GABAY Left Sidebar */}
      <GlobalSidebar
        currentTab={currentTab}
        setCurrentTab={handleNavigateTab}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          currentTab={currentTab}
          courseTab={currentTab === 'courses' ? courseSubTab : undefined}
        />

        {/* Dynamic Page Views */}
        <div className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage onNavigateCourse={handleNavigateCourse} />
          )}

          {currentTab === 'courses' && (
            <CoursesPage initialSubTab={courseSubTab} />
          )}

          {currentTab === 'calendar' && <CalendarPage />}

          {currentTab === 'inbox' && <InboxPage />}

          {currentTab === 'commons' && <CommonsPage />}
        </div>
      </div>

      {/* Global Modals & Drawers */}
      <SpeedGraderModal />
      <RoleSwitcherModal />
      <HistoryDrawer />
      <HelpDrawer />
    </div>
  );
};
