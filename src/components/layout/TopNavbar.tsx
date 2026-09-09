import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  Menu,
  X,
  ShieldCheck,
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
  Layers,
  FileText,
  FileCheck2,
  HelpCircle as QuizIcon,
  Award,
  Users,
  Megaphone,
  Folder,
  Check
} from 'lucide-react';

interface TopNavbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  currentTab: string;
  courseTab?: string;
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onSelectCourseTab?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenSearch: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  currentTab,
  courseTab,
  onNavigateCourse,
  onSelectCourseTab,
  onNavigateTab,
  onOpenSearch
}) => {
  const {
    activeUser,
    activeRole,
    db,
    activeCourseId,
    setActiveCourseId,
    theme,
    toggleTheme,
    setIsRoleModalOpen,
    logout,
    showConfirm
  } = useLMS();

  const [profileOpen, setProfileOpen] = useState(false);
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [courseTabDropdownOpen, setCourseTabDropdownOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const courseTabDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(target)) {
        setCourseDropdownOpen(false);
      }
      if (courseTabDropdownRef.current && !courseTabDropdownRef.current.contains(target)) {
        setCourseTabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCourse = db.courses.find(c => c.id === activeCourseId);

  const courseTabs = [
    { id: 'modules', label: 'Modules', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-3.5 h-3.5" /> },
    { id: 'assignments', label: 'Assignments', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <QuizIcon className="w-3.5 h-3.5" /> },
    { id: 'files', label: 'Files', icon: <Folder className="w-3.5 h-3.5" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'people', label: 'People', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <nav className="fixed w-full z-30 top-0 transition-all glass border-b border-border/40 shadow-subtle dark:bg-background/80 dark:border-border/30">
      <div className="px-4 sm:px-6 h-16 flex justify-between items-center max-w-[100vw]">
        {/* Left Section: Mobile Menu + Brand Logo & Badge + Theme Toggle */}
        <div className="flex items-center min-w-0 shrink-0 gap-3">
          <button
            onClick={() => setSidebarOpen((prev: boolean) => !prev)}
            className="lg:hidden p-2 text-muted-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div
            onClick={() => onNavigateTab && onNavigateTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-black text-white text-base tracking-tighter shadow-primary-sm group-hover:scale-105 transition-transform">
              G
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-foreground font-sans">
                GABAY LMS
              </span>
              <span className="live-dot" title="Live System Active" />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-success/10 rounded-full border border-success/20 ml-1">
            <ShieldCheck className="h-3 w-3 text-success" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-success font-sans">
              SECURE RBAC
            </span>
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

        {/* Right Section: Mobile Search, Course Shell Switcher, History, Help, User Profile */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onOpenSearch}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Active Course & Tab Dropdowns if on Course page */}
          {currentTab === 'courses' && activeCourse && (
            <div className="hidden xl:flex items-center space-x-1.5 pr-2 border-r border-border">
              {/* Course Shell Dropdown */}
              <div className="relative" ref={courseDropdownRef}>
                <button
                  onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
                  className={`flex items-center space-x-2 font-bold font-sans text-xs px-3 py-1.5 rounded-xl border transition-all shadow-subtle cursor-pointer active:scale-[0.98] ${
                    courseDropdownOpen
                      ? 'text-primary bg-primary/20 border-primary ring-2 ring-primary/20 shadow-primary-sm'
                      : 'text-primary bg-primary/10 hover:bg-primary/15 border-primary/30'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-xs ring-1 ring-background"
                    style={{ backgroundColor: activeCourse.color || '#64748b' }}
                  />
                  <span>{activeCourse.code}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${courseDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {courseDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 dropdown-panel p-2 z-50 animate-dropdown">
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/60 mb-1.5">
                      <span className="text-[10px] font-sans font-bold uppercase text-muted-foreground tracking-wider">
                        Switch Course Shell
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        {db.courses.length} courses
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                      {db.courses.map(course => {
                        const isSelected = course.id === activeCourse.id;
                        return (
                          <button
                            key={course.id}
                            onClick={() => {
                              setActiveCourseId(course.id);
                              if (onNavigateCourse) onNavigateCourse(course.id, courseTab || 'modules');
                              setCourseDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                              isSelected
                                ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-xs'
                                : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate min-w-0">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform ${isSelected ? 'ring-2 ring-primary/40 scale-110' : 'group-hover:scale-125'}`}
                                style={{ backgroundColor: course.color || '#64748b' }}
                              />
                              <div className="text-left truncate">
                                <div className="font-sans font-bold block truncate">{course.code}</div>
                                <div className="text-[10px] text-muted-foreground truncate font-normal">{course.title}</div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ml-1.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-tab Dropdown */}
              {courseTab && (
                <div className="relative" ref={courseTabDropdownRef}>
                  <button
                    onClick={() => setCourseTabDropdownOpen(!courseTabDropdownOpen)}
                    className={`flex items-center space-x-2 text-xs font-semibold capitalize px-3 py-1.5 rounded-xl border transition-all shadow-subtle cursor-pointer active:scale-[0.98] ${
                      courseTabDropdownOpen
                        ? 'bg-muted border-primary text-primary ring-2 ring-primary/20 shadow-primary-sm'
                        : 'bg-card/90 hover:bg-muted/80 border-border/80 text-foreground'
                    }`}
                  >
                    <span>{courseTab}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${courseTabDropdownOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
                  </button>

                  {courseTabDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 dropdown-panel p-1.5 space-y-1 z-50 animate-dropdown">
                      <div className="px-2.5 py-1.5 text-[10px] font-sans font-bold uppercase text-muted-foreground tracking-wider border-b border-border/60 mb-1">
                        Course Section
                      </div>
                      <div className="space-y-0.5">
                        {courseTabs.map(tab => {
                          const isSelected = courseTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => {
                                if (onSelectCourseTab) onSelectCourseTab(tab.id);
                                setCourseTabDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground font-bold shadow-primary-sm'
                                  : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                {tab.icon}
                                <span>{tab.label}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* History Page Trigger */}
          <button
            onClick={() => onNavigateTab && onNavigateTab('history')}
            title="Session Trail History"
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${
              currentTab === 'history'
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
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${
              currentTab === 'help'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border bg-background'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* User Profile Pill & Dropdown (Cellwego Layout) */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center px-2.5 py-1.5 rounded-2xl border transition-all cursor-pointer group ${
                profileOpen
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
