import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Inbox,
  History,
  Grid,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Building,
  BarChart3,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  UserCheck,
  ShieldCheck
} from 'lucide-react';

interface GlobalSidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    theme,
    toggleTheme,
    activeUser,
    activeRole,
    setIsRoleModalOpen,
    setIsHistoryDrawerOpen,
    setIsHelpDrawerOpen,
    db
  } = useLMS();

  const [isLmsExpanded, setIsLmsExpanded] = useState(true);

  const unreadMessageCount = db.messages.filter(
    m => m.recipientId === activeUser.id && !m.read
  ).length;

  const roleBadges: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
    admin: {
      label: 'DEAN / ADMIN',
      style: 'bg-red-900/40 text-red-300 border-red-700/50',
      icon: <Building className="w-3 h-3" />
    },
    faculty: {
      label: 'INSTRUCTOR',
      style: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
      icon: <UserCheck className="w-3 h-3" />
    },
    staff: {
      label: 'REGISTRAR AIDE',
      style: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
      icon: <ShieldCheck className="w-3 h-3" />
    },
    student: {
      label: 'STUDENT',
      style: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
      icon: <GraduationCap className="w-3 h-3" />
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'courses', label: 'Courses', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4" />,
      badge: unreadMessageCount > 0 ? unreadMessageCount : null
    },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" />, action: () => setIsHistoryDrawerOpen(true) },
    {
      id: 'commons',
      label: 'Commons',
      icon: <Grid className="w-4 h-4" />,
      restricted: activeRole === 'student'
    },
    { id: 'help', label: 'Help', icon: <HelpCircle className="w-4 h-4" />, action: () => setIsHelpDrawerOpen(true) }
  ];

  return (
    <aside className="w-64 bg-zinc-900 text-zinc-300 border-r border-zinc-800 flex flex-col h-screen shrink-0 select-none">
      {/* Header Branding */}
      <div className="p-4 border-b border-zinc-800 flex items-center space-x-3 bg-zinc-950/80">
        <div className="w-9 h-9 rounded bg-red-800 flex items-center justify-center font-black text-white text-lg tracking-tighter shadow-inner">
          G
        </div>
        <div>
          <h1 className="font-bold text-sm text-zinc-100 tracking-tight leading-none">
            GABAY SYSTEM
          </h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
            DMMMSU-SLUC CCS
          </p>
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 text-xs">
        {/* Parent GABAY Modules Accordion */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
            Institutional Modules
          </div>

          {/* Dummy Module 1 */}
          <div
            onClick={() => alert("College Management module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              <Building className="w-4 h-4 text-zinc-500" />
              <span>College Management</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              ERP
            </span>
          </div>

          {/* Dummy Module 2 */}
          <div
            onClick={() => alert("Decision Support & Analytics module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              <BarChart3 className="w-4 h-4 text-zinc-500" />
              <span>Analytics & Decision</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              BI
            </span>
          </div>

          {/* Dummy Module 3 */}
          <div
            onClick={() => alert("Institutional Reporting module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              <FileCheck2 className="w-4 h-4 text-zinc-500" />
              <span>Institutional Reporting</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              CHED
            </span>
          </div>

          {/* Module 4: LMS (Active Parent Item) */}
          <div className="pt-2">
            <button
              onClick={() => setIsLmsExpanded(!isLmsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded bg-zinc-800 text-zinc-100 font-semibold hover:bg-zinc-700/80 transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <GraduationCap className="w-4 h-4 text-red-500" />
                <span>Learning Management (LMS)</span>
              </div>
              {isLmsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {/* Canvas Sub-navigation */}
            {isLmsExpanded && (
              <div className="mt-1 ml-3 pl-3 border-l border-zinc-800 space-y-1">
                {navItems.map(item => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          setCurrentTab(item.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-all duration-150 ${
                        isActive
                          ? 'bg-red-900/60 text-white font-semibold shadow-sm border-l-2 border-red-500'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {item.restricted && (
                          <span className="text-[9px] px-1 py-0.2 font-mono uppercase bg-zinc-800 text-amber-400 rounded">
                            Restricted
                          </span>
                        )}
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sidebar Utilities */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition-colors"
        >
          <div className="flex items-center space-x-2">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="capitalize">{theme} Mode Active</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Toggle</span>
        </button>

        {/* Current User Card & Role Switcher Trigger */}
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
          <div className="flex items-center space-x-2.5">
            <img
              src={activeUser.avatar}
              alt={activeUser.name}
              className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-xs text-zinc-100 truncate">
                {activeUser.name}
              </p>
              <div className="flex items-center space-x-1 mt-0.5">
                <span
                  className={`inline-flex items-center space-x-1 px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${
                    roleBadges[activeRole]?.style
                  }`}
                >
                  {roleBadges[activeRole]?.icon}
                  <span>{roleBadges[activeRole]?.label}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="w-full flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded bg-red-900/50 hover:bg-red-900 text-red-200 text-xs font-semibold border border-red-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Switch Role / Session</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
