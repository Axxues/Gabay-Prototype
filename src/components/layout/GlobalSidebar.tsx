import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Inbox,
  History,
  ChevronDown,
  Building,
  BarChart3,
  FileCheck2,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  User
} from 'lucide-react';

interface GlobalSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  collapsed,
  onToggleCollapse,
  currentTab,
  setCurrentTab
}) => {
  const {
    activeUser,
    activeRole,
    logout,
    db,
    showConfirm
  } = useLMS();

  const [isLmsExpanded, setIsLmsExpanded] = useState(true);

  const unreadMessageCount = db.messages.filter(
    m => m.recipientId === activeUser.id && !m.read
  ).length;

  const roleBadges: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
    admin: {
      label: 'DEAN / ADMIN',
      style: 'bg-primary/10 text-primary border-primary/20',
      icon: <Building className="w-3 h-3" />
    },
    faculty: {
      label: 'INSTRUCTOR',
      style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      icon: <UserCheck className="w-3 h-3" />
    },
    staff: {
      label: 'REGISTRAR AIDE',
      style: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      icon: <ShieldCheck className="w-3 h-3" />
    },
    student: {
      label: 'STUDENT',
      style: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      icon: <GraduationCap className="w-3 h-3" />
    }
  };

  const handleNavigate = (tab: string) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  return (
    <aside
      className={`
        z-20 flex h-[calc(100vh-4rem)] flex-shrink-0 flex-col overflow-visible
        border-r border-border/60 bg-background/95 backdrop-blur-xl transition-all duration-300 ease-in-out
        w-72 min-w-72
        dark:bg-background/90 dark:border-border/40
        max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-16
        ${sidebarOpen ? 'max-lg:translate-x-0 max-lg:shadow-2xl' : 'max-lg:-translate-x-full'}
        lg:static lg:relative lg:translate-x-0
        ${collapsed ? 'lg:w-16 lg:min-w-16 lg:max-w-16 lg:whitespace-nowrap' : ''}
      `}
    >
      {/* Floating Circular Collapse Toggle (Cellwego Layout Pattern) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        className="hidden lg:flex absolute top-3 right-0 translate-x-1/2 z-30 h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-subtle transition-colors hover:bg-accent hover:text-foreground dark:bg-background dark:border-border/70 dark:text-muted-foreground dark:hover:bg-background/70 dark:hover:text-foreground cursor-pointer"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5 flex-shrink-0" />
        ) : (
          <PanelLeftClose className="h-5 w-5 flex-shrink-0" />
        )}
      </button>

      {/* Main Navigation Scroll Area */}
      <nav className={`custom-scrollbar flex-1 overflow-y-auto space-y-1 ${collapsed ? 'p-2 pt-4' : 'p-4'}`}>
        {!collapsed && (
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-sans mb-1">
            Navigation & Modules
          </div>
        )}

        {/* Page 1 */}
        <button
          type="button"
          onClick={() => handleNavigate('page1')}
          title="Page 1"
          className={`w-full flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'} rounded-xl cursor-pointer transition-all duration-150 ${
            currentTab === 'page1'
              ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent font-medium'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Building className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Page 1</span>}
          </div>
        </button>

        {/* Page 2 */}
        <button
          type="button"
          onClick={() => handleNavigate('page2')}
          title="Page 2"
          className={`w-full flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'} rounded-xl cursor-pointer transition-all duration-150 ${
            currentTab === 'page2'
              ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent font-medium'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Page 2</span>}
          </div>
        </button>

        {/* Page 3 */}
        <button
          type="button"
          onClick={() => handleNavigate('page3')}
          title="Page 3"
          className={`w-full flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'} rounded-xl cursor-pointer transition-all duration-150 ${
            currentTab === 'page3'
              ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent font-medium'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <FileCheck2 className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Page 3</span>}
          </div>
        </button>

        {/* Module 4: LMS */}
        <div className="pt-2">
          {!collapsed ? (
            <div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-subtle mb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('dashboard');
                    setIsLmsExpanded(true);
                  }}
                  className="flex items-center space-x-2.5 text-left flex-1 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-bold text-xs tracking-tight">Learning Management (LMS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLmsExpanded(!isLmsExpanded)}
                  className="p-1 text-primary hover:bg-primary/20 rounded-lg transition-colors ml-1 shrink-0 cursor-pointer"
                  title={isLmsExpanded ? "Collapse LMS menu" : "Expand LMS menu"}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isLmsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              </div>

              {/* LMS Sub-navigation */}
              {isLmsExpanded && (
                <div className="pl-3 border-l-2 border-border ml-3 dark:border-border/70 space-y-1">
                  {/* Dashboard */}
                  <button
                    type="button"
                    onClick={() => handleNavigate('dashboard')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      currentTab === 'dashboard'
                        ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                      <span>Dashboard</span>
                    </div>
                  </button>

                  {/* Courses */}
                  <button
                    type="button"
                    onClick={() => handleNavigate('courses')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      currentTab === 'courses' || currentTab === 'create-course'
                        ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <BookOpen className="w-4 h-4 flex-shrink-0" />
                      <span>Courses</span>
                    </div>
                  </button>

                  {/* Calendar */}
                  <button
                    type="button"
                    onClick={() => handleNavigate('calendar')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      currentTab === 'calendar'
                        ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>Calendar</span>
                    </div>
                  </button>

                  {/* Inbox */}
                  <button
                    type="button"
                    onClick={() => handleNavigate('inbox')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      currentTab === 'inbox'
                        ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Inbox className="w-4 h-4 flex-shrink-0" />
                      <span>Inbox</span>
                    </div>
                    {unreadMessageCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-sans font-bold bg-primary text-primary-foreground rounded-full shadow-subtle">
                        {unreadMessageCount}
                      </span>
                    )}
                  </button>

                  {/* History */}
                  <button
                    type="button"
                    onClick={() => handleNavigate('history')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      currentTab === 'history'
                        ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm translate-x-0.5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <History className="w-4 h-4 flex-shrink-0" />
                      <span>History</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed LMS icons */
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                title="Dashboard"
                className={`relative flex items-center justify-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-primary/10 text-primary shadow-subtle ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('courses')}
                title="Courses"
                className={`relative flex items-center justify-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'courses' || currentTab === 'create-course'
                    ? 'bg-primary/10 text-primary shadow-subtle ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <BookOpen className="h-5 w-5 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('calendar')}
                title="Calendar"
                className={`relative flex items-center justify-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'calendar'
                    ? 'bg-primary/10 text-primary shadow-subtle ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Calendar className="h-5 w-5 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('inbox')}
                title="Inbox"
                className={`relative flex items-center justify-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'inbox'
                    ? 'bg-primary/10 text-primary shadow-subtle ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Inbox className="h-5 w-5 flex-shrink-0" />
                {unreadMessageCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('history')}
                title="History"
                className={`relative flex items-center justify-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'history'
                    ? 'bg-primary/10 text-primary shadow-subtle ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <History className="h-5 w-5 flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Profile / Utilities Area */}
      <div className="p-3 border-t border-border bg-muted/30">
        {!collapsed ? (
          <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-subtle">
            <div
              onClick={() => handleNavigate('profile')}
              className={`flex items-center space-x-2.5 cursor-pointer p-1 rounded-lg transition-all ${
                currentTab === 'profile' ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:opacity-80'
              }`}
              title="View Profile Page"
            >
              <img
                src={activeUser.avatar}
                alt={activeUser.name}
                className="w-8 h-8 rounded-full object-cover shadow-soft border border-border"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-foreground truncate leading-tight">
                  {activeUser.name}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[9px] font-sans font-bold ${
                      roleBadges[activeRole]?.style
                    }`}
                  >
                    {roleBadges[activeRole]?.icon}
                    <span>{roleBadges[activeRole]?.label}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-primary text-primary-foreground border-primary font-bold shadow-subtle'
                    : 'bg-muted/60 hover:bg-muted text-foreground border-border'
                }`}
              >
                <User className="w-3 h-3 mr-1" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  showConfirm("Are you sure you want to sign out of GABAY LMS?", () => {
                    logout();
                  }, "Sign Out");
                }}
                className="flex items-center justify-center p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-colors cursor-pointer"
                title="Sign Out Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <button
              type="button"
              onClick={() => handleNavigate('profile')}
              title={activeUser.name}
              className="p-1 rounded-xl hover:bg-accent cursor-pointer transition-all"
            >
              <img
                src={activeUser.avatar}
                alt={activeUser.name}
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
            </button>
            <button
              type="button"
              onClick={() => {
                showConfirm("Are you sure you want to sign out of GABAY LMS?", () => {
                  logout();
                }, "Sign Out");
              }}
              title="Sign Out"
              className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
