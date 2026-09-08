import React from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  ChevronRight,
  History,
  HelpCircle,
  RefreshCw,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface TopNavbarProps {
  currentTab: string;
  courseTab?: string;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ currentTab, courseTab }) => {
  const {
    activeRole,
    activeUser,
    setIsRoleModalOpen,
    setIsHistoryDrawerOpen,
    setIsHelpDrawerOpen,
    db,
    activeCourseId
  } = useLMS();

  const activeCourse = db.courses.find(c => c.id === activeCourseId);

  const formatTabName = (tab: string) => {
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  return (
    <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
        <div className="flex items-center space-x-1 text-zinc-900 dark:text-zinc-100 font-bold">
          <Building2 className="w-4 h-4 text-red-700 dark:text-red-500" />
          <span>GABAY</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-zinc-700 dark:text-zinc-300">LMS Module</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        {currentTab === 'courses' && activeCourse ? (
          <>
            <span className="font-bold font-mono text-red-700 dark:text-red-400">
              {activeCourse.code}
            </span>
            {courseTab && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-900 dark:text-zinc-100 font-semibold capitalize">
                  {courseTab}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
            {formatTabName(currentTab)}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Compliance Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>CHED CMO 25 s. 2015</span>
        </div>

        {/* Active Role Quick Pill */}
        <button
          onClick={() => setIsRoleModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 hover:bg-red-100 dark:hover:bg-red-900 transition-colors text-xs font-semibold text-red-800 dark:text-red-300"
        >
          <span className="capitalize">{activeRole} Mode</span>
          <RefreshCw className="w-3 h-3" />
        </button>

        {/* History Drawer Trigger */}
        <button
          onClick={() => setIsHistoryDrawerOpen(true)}
          title="Session Trail History"
          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Help Drawer Trigger */}
        <button
          onClick={() => setIsHelpDrawerOpen(true)}
          title="Institutional User Manual & Help"
          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center space-x-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <img
            src={activeUser.avatar}
            alt={activeUser.name}
            className="w-7 h-7 rounded-full object-cover border border-zinc-300 dark:border-zinc-700"
          />
          <span className="hidden sm:inline text-xs font-medium text-zinc-800 dark:text-zinc-200">
            {activeUser.name.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  );
};
