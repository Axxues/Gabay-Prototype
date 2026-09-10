import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  Menu,
  Search,
  Command,
  Sun,
  Moon,
  History,
  HelpCircle,
  ChevronDown,
  User,
  Shield,
  LogOut,
  Users,
  Bell
} from 'lucide-react';

interface TopbarProps {
  currentTab: string;
  onNavigateTab?: (tab: string) => void;
  onOpenSearch: () => void;
  onOpenSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onNavigateTab,
  onOpenSearch,
  onOpenSidebar
}) => {
  const {
    activeUser,
    activeRole,
    theme,
    toggleTheme,
    setIsRoleModalOpen,
    logout,
    showConfirm,
    getUnreadNotificationCount
  } = useLMS();

  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed w-full z-30 top-0 transition-all glass border-b border-border/40 shadow-subtle dark:bg-background/80 dark:border-border/30">
      <div className="px-4 sm:px-6 h-16 flex justify-between items-center max-w-[100vw]">
        {/* Left Section: Mobile Menu + Brand Logo & Badge + Theme Toggle */}
        <div className="flex items-center min-w-0 shrink-0 gap-3">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="lg:hidden p-2 text-muted-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div
            onClick={() => onNavigateTab && onNavigateTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-black text-white text-base tracking-tighter shadow-primary-sm group-hover:scale-105 transition-transform">
              G
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-foreground font-sans">
                GABAY
              </span>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all shadow-subtle cursor-pointer ml-1"
            aria-label="Toggle theme mode"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-amber-500" />
            )}
          </button>
        </div>

        {/* Center Section: Cellwego Universal Search Trigger */}
        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full h-10 flex items-center justify-between px-4 rounded-full border border-border bg-muted/50 hover:bg-muted hover:shadow-inner-soft transition-all text-left cursor-pointer"
          >
            <div className="flex items-center min-w-0">
              <Search className="h-4 w-4 text-muted-foreground mr-3 flex-shrink-0" />
              <span className="text-sm font-semibold text-muted-foreground truncate font-sans">
                Search courses, modules, assignments, calendar...
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-1 text-[10px] font-sans font-bold text-muted-foreground bg-background border border-border rounded-lg px-2 py-0.5 shadow-subtle">
              <Command className="h-3 w-3" /> K
            </div>
          </button>
        </div>

        {/* Right Section: Mobile Search, Course Shell Switcher, History, Help, User Profile, Notification Bell */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onOpenSearch}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* History Page Trigger */}
          <button
            onClick={() => onNavigateTab && onNavigateTab('history')}
            title="Session Trail History"
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${currentTab === 'history'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border bg-background'
              }`}
          >
            <History className="h-4 w-4" />
          </button>

          {/* Help Page Trigger */}
          <button
            onClick={() => onNavigateTab && onNavigateTab('help')}
            title="User Manual & Help"
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${currentTab === 'help'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border bg-background'
              }`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Notification Bell with Unread Count */}
          <button
            onClick={() => onNavigateTab && onNavigateTab('inbox')}
            title="Notifications"
            className={`relative hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${currentTab === 'inbox'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border bg-background'
              }`}
          >
            <Bell className="h-4 w-4 text-primary" />
            <span
              className={`absolute -top-0.5 -right-0.5 rounded-full bg-primary text-xs text-primary-foreground h-4 w-4 flex items-center justify-center ${getUnreadNotificationCount(activeUser.id) > 0 ? '' : 'hidden'}`}
            >
              {getUnreadNotificationCount(activeUser.id)}
            </span>
          </button>

          {/* User Profile Pill & Dropdown (Cellwego Layout) */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center px-2.5 py-1.5 rounded-2xl border transition-all cursor-pointer group ${profileOpen
                  ? 'bg-accent/80 border-primary ring-2 ring-primary/20 shadow-primary-sm'
                  : 'hover:bg-accent/60 border-border/80 shadow-subtle'
                }`}
            >
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-card overflow-hidden ring-2 ring-primary/25 ring-offset-1 ring-offset-background group-hover:scale-105 transition-transform">
                {activeUser.avatar ? (
                  <img
                    src={activeUser.avatar}
                    alt={activeUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{activeUser.name.charAt(0)}</span>
                )}
              </div>

              <span className="text-sm font-bold text-foreground ml-2.5 hidden sm:block truncate max-w-[120px]">
                {activeUser.name.split(' ')[0]}
              </span>

              <ChevronDown className={`h-3.5 w-3.5 ml-2 text-muted-foreground transition-transform duration-200 ease-out ${profileOpen ? 'rotate-180 text-primary' : 'group-hover:text-foreground'}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 dropdown-panel p-2.5 z-50 animate-dropdown">
                <div className="px-3.5 py-3 bg-muted/40 border border-border/60 rounded-xl mb-2">
                  <p className="text-[10px] font-sans font-bold text-muted-foreground uppercase tracking-widest">
                    Signed in as
                  </p>
                  <p className="text-sm font-black text-foreground truncate mt-0.5">
                    {activeUser.name}
                  </p>
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    <span className="px-2 py-0.5 text-[10px] font-sans font-bold rounded-full bg-primary/15 text-primary uppercase tracking-wide border border-primary/25 shadow-xs">
                      {activeRole}
                    </span>
                    <span className="text-[11px] font-sans text-muted-foreground truncate font-medium">
                      {activeUser.email}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      if (onNavigateTab) onNavigateTab('profile');
                    }}
                    className="flex items-center w-full px-3 py-2 text-xs font-bold text-foreground hover:bg-accent/80 hover:translate-x-0.5 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground mr-2.5 transition-colors">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    Account Profile
                  </button>

                  {activeRole === 'admin' && (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        if (onNavigateTab) onNavigateTab('accounts');
                      }}
                      className="flex items-center w-full px-3 py-2 text-xs font-bold text-foreground hover:bg-accent/80 hover:translate-x-0.5 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground mr-2.5 transition-colors">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      Manage College Accounts
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setIsRoleModalOpen(true);
                    }}
                    className="flex items-center w-full px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 hover:translate-x-0.5 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center text-primary mr-2.5 transition-colors">
                      <Shield className="h-3.5 w-3.5" />
                    </div>
                    Switch Role Matrix
                  </button>

                  {/* Dark Mode toggle for mobile */}
                  <div className="md:hidden flex items-center justify-between w-full px-3 py-2 rounded-xl bg-muted/30">
                    <span className="text-xs font-bold text-foreground">Theme Mode</span>
                    <button
                      onClick={toggleTheme}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-accent cursor-pointer"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-amber-500" />}
                    </button>
                  </div>

                  <div className="border-t border-border/60 my-1" />

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      showConfirm("Are you sure you want to sign out of GABAY LMS?", () => {
                        logout();
                      }, "Sign Out");
                    }}
                    className="flex items-center w-full px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 hover:translate-x-0.5 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive mr-2.5 transition-colors">
                      <LogOut className="h-3.5 w-3.5" />
                    </div>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
