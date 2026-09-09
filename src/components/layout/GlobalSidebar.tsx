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
  Sun,
  Moon,
  Building,
  BarChart3,
  FileCheck2,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  Layers,
  FileText,
  Award,
  Users,
  LogOut
} from 'lucide-react';

interface GlobalSidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  courseSubTab?: string;
  setCourseSubTab?: (tab: string) => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  currentTab,
  setCurrentTab,
  onNavigateCourse,
  courseSubTab = 'modules',
  setCourseSubTab
}) => {
  const {
    theme,
    toggleTheme,
    activeUser,
    activeRole,
    activeCourseId,
    setActiveCourseId,
    logout,
    db
  } = useLMS();

  const [isLmsExpanded, setIsLmsExpanded] = useState(true);
  const [isCoursesDropdownOpen, setIsCoursesDropdownOpen] = useState(true);

  const unreadMessageCount = db.messages.filter(
    m => m.recipientId === activeUser.id && !m.read
  ).length;

  const roleBadges: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
    admin: {
      label: 'DEAN / ADMIN',
      style: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
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

  const userCourses = db.courses.filter(c => {
    if (activeRole === 'faculty') return c.instructorId === activeUser.id;
    return true;
  });

  const courseSubTabs = [
    { id: 'modules', label: 'Modules', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'assignments', label: 'Assignments', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <HelpCircle className="w-3.5 h-3.5" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'people', label: 'People', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  const handleSelectCourse = (courseId: string, subTab: string = 'modules') => {
    setActiveCourseId(courseId);
    if (onNavigateCourse) {
      onNavigateCourse(courseId, subTab);
    } else {
      setCurrentTab('courses');
    }
  };

  const handleSelectCourseSubTab = (subTab: string) => {
    if (setCourseSubTab) {
      setCourseSubTab(subTab);
    }
    if (currentTab !== 'courses') {
      setCurrentTab('courses');
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen shrink-0 select-none shadow-subtle">
      {/* Header Branding - Cellwego Style */}
      <div className="p-4 border-b border-border flex items-center space-x-3 bg-muted/40 backdrop-blur-md">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-600 to-rose-900 flex items-center justify-center font-black text-white text-lg tracking-tighter shadow-md">
          G
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5">
            <h1 className="font-bold text-sm text-foreground tracking-tight leading-none">
              GABAY LMS
            </h1>
            <span className="live-dot" title="Likha ERP Live Sync" />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-wider truncate">
            DMMMSU-SLUC CCS
          </p>
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 text-xs">
        {/* Parent GABAY Modules Accordion */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Institutional Modules
          </div>

          {/* Locked Parent Modules */}
          <div
            onClick={() => alert("Page 2 module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer transition-all duration-150"
          >
            <div className="flex items-center space-x-2.5">
              <Building className="w-4 h-4 text-muted-foreground/70" />
              <span className="font-medium">Page 1</span>
            </div>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground border border-border">
              ERP
            </span>
          </div>

          <div
            onClick={() => alert("Page 2 module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer transition-all duration-150"
          >
            <div className="flex items-center space-x-2.5">
              <BarChart3 className="w-4 h-4 text-muted-foreground/70" />
              <span className="font-medium">Page 2</span>
            </div>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground border border-border">
              BI
            </span>
          </div>

          <div
            onClick={() => alert("Page 3 module is locked in LMS prototype mode.")}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer transition-all duration-150"
          >
            <div className="flex items-center space-x-2.5">
              <FileCheck2 className="w-4 h-4 text-muted-foreground/70" />
              <span className="font-medium">Page 3</span>
            </div>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground border border-border">
              OBE
            </span>
          </div>

          {/* Module 4: LMS (Active Accordion with Interactive Navigation) */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 font-bold border border-pink-500/20 shadow-soft">
              <button
                onClick={() => {
                  setCurrentTab('dashboard');
                  setIsLmsExpanded(true);
                }}
                className="flex items-center space-x-2.5 text-left flex-1 hover:underline"
              >
                <GraduationCap className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                <span>Learning Management (LMS)</span>
              </button>
              <button
                onClick={() => setIsLmsExpanded(!isLmsExpanded)}
                className="p-1 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 rounded transition-colors ml-1 shrink-0 cursor-pointer"
                title={isLmsExpanded ? "Collapse LMS menu" : "Expand LMS menu"}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${isLmsExpanded ? 'rotate-0' : '-rotate-90'}`} />
              </button>
            </div>

            {/* Canvas Sub-navigation */}
            {isLmsExpanded && (
              <div className="mt-1.5 ml-3 pl-3 border-l-2 border-border space-y-1 animate-accordion">
                {/* 1. Dashboard */}
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${currentTab === 'dashboard'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </div>
                </button>

                {/* 2. Courses (with Nested Interactive Dropdown) */}
                <div className="space-y-1">
                  <div
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${currentTab === 'courses'
                      ? 'bg-pink-700 text-white shadow-card'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                      }`}
                  >
                    <button
                      onClick={() => {
                        setCurrentTab('courses');
                        setIsCoursesDropdownOpen(true);
                      }}
                      className="flex items-center space-x-2.5 flex-1 text-left"
                    >
                      <BookOpen className="w-4 h-4 shrink-0" />
                      <span>Courses</span>
                    </button>
                    <button
                      onClick={() => setIsCoursesDropdownOpen(!isCoursesDropdownOpen)}
                      className={`p-1 rounded transition-colors cursor-pointer ${currentTab === 'courses'
                        ? 'hover:bg-pink-800/60 text-white'
                        : 'hover:bg-muted text-muted-foreground'
                        }`}
                      title={isCoursesDropdownOpen ? "Collapse courses" : "Expand courses"}
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${isCoursesDropdownOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  </div>

                  {/* Dropdown: List of Courses */}
                  {isCoursesDropdownOpen && (
                    <div className="mt-1 ml-3 pl-2.5 border-l border-border/80 space-y-1 animate-accordion">
                      {userCourses.map(course => {
                        const isSelectedCourse = currentTab === 'courses' && activeCourseId === course.id;

                        return (
                          <div key={course.id} className="space-y-1">
                            {/* Course Item Button */}
                            <button
                              onClick={() => handleSelectCourse(course.id, 'modules')}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${isSelectedCourse
                                ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold border border-pink-500/30'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: course.color }}
                                />
                                <span className="font-mono font-bold">{course.code}</span>
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground/70 truncate ml-1">
                                {course.section}
                              </span>
                            </button>

                            {/* If this course is active, show its inner navigation sub-tabs dropdown */}
                            {isSelectedCourse && (
                              <div className="ml-3 pl-2 border-l border-pink-500/30 space-y-0.5 pt-0.5 animate-accordion">
                                {courseSubTabs.map(st => {
                                  const isSubActive = courseSubTab === st.id;
                                  return (
                                    <button
                                      key={st.id}
                                      onClick={() => handleSelectCourseSubTab(st.id)}
                                      className={`w-full flex items-center space-x-2 px-2 py-1 rounded text-[10px] transition-colors ${isSubActive
                                        ? 'bg-pink-700 text-white font-bold shadow-soft'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                        }`}
                                    >
                                      {st.icon}
                                      <span>{st.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Calendar */}
                <button
                  onClick={() => setCurrentTab('calendar')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${currentTab === 'calendar'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Calendar className="w-4 h-4" />
                    <span>Calendar</span>
                  </div>
                </button>

                {/* 4. Inbox */}
                <button
                  onClick={() => setCurrentTab('inbox')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${currentTab === 'inbox'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Inbox className="w-4 h-4" />
                    <span>Inbox</span>
                  </div>
                  {unreadMessageCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-pink-600 text-white rounded-full shadow-subtle">
                      {unreadMessageCount}
                    </span>
                  )}
                </button>

                {/* 5. History */}
                <button
                  onClick={() => setCurrentTab('history')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${currentTab === 'history'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <History className="w-4 h-4" />
                    <span>History</span>
                  </div>
                </button>

                {/* 6. Commons */}
                <button
                  onClick={() => setCurrentTab('commons')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${currentTab === 'commons'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Grid className="w-4 h-4" />
                    <span>Commons</span>
                  </div>
                  {activeRole === 'student' && (
                    <span className="text-[9px] px-1.5 py-0.3 font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20">
                      Restricted
                    </span>
                  )}
                </button>

                {/* 7. Help */}
                <button
                  onClick={() => setCurrentTab('help')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${currentTab === 'help'
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <HelpCircle className="w-4 h-4" />
                    <span>Help</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Utilities - Cellwego Card Styling */}
      <div className="p-3 border-t border-border bg-muted/30 space-y-2">
        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-all duration-150 shadow-soft"
        >
          <div className="flex items-center space-x-2">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="capitalize">{theme} Mode</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            Toggle
          </span>
        </button>

        {/* User Account Card */}
        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-subtle">
          <div
            onClick={() => setCurrentTab('profile')}
            className={`flex items-center space-x-2.5 cursor-pointer p-1 rounded-lg transition-all ${currentTab === 'profile' ? 'bg-pink-500/15 ring-1 ring-pink-500/30' : 'hover:opacity-80'
              }`}
            title="View Institutional Profile Page"
          >
            <img
              src={activeUser.avatar}
              alt={activeUser.name}
              className={`w-8 h-8 rounded-full object-cover shadow-soft ${currentTab === 'profile' ? 'ring-2 ring-pink-600 border-transparent' : 'border border-border'
                }`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs text-foreground truncate leading-tight">
                {activeUser.name}
              </p>
              <div className="flex items-center space-x-1 mt-1">
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold ${roleBadges[activeRole]?.style
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
              onClick={() => setCurrentTab('profile')}
              className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${currentTab === 'profile'
                ? 'bg-pink-700 text-white border-pink-700 font-bold shadow-soft'
                : 'bg-muted/60 hover:bg-muted text-foreground border-border'
                }`}
            >
              <span>Profile</span>
            </button>
            <button
              onClick={() => {
                if (confirm("Sign out of GABAY LMS?")) {
                  logout();
                }
              }}
              className="flex items-center justify-center p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 dark:text-pink-400 border border-pink-500/20 transition-colors cursor-pointer"
              title="Sign Out Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
