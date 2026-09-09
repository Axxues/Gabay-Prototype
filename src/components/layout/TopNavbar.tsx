import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  ChevronRight,
  ChevronDown,
  History,
  HelpCircle,
  Building2,
  ShieldCheck,
  Check,
  Layers,
  FileText,
  FileCheck2,
  HelpCircle as QuizIcon,
  Award,
  Users
} from 'lucide-react';

interface TopNavbarProps {
  currentTab: string;
  courseTab?: string;
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onSelectCourseTab?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentTab,
  courseTab,
  onNavigateCourse,
  onSelectCourseTab,
  onNavigateTab
}) => {
  const {
    activeRole,
    activeUser,
    db,
    activeCourseId,
    setActiveCourseId
  } = useLMS();

  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);

  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const tabDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCourse = db.courses.find(c => c.id === activeCourseId);

  const formatTabName = (tab: string) => {
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  const courseTabs = [
    { id: 'modules', label: 'Modules', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'assignments', label: 'Assignments', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <QuizIcon className="w-3.5 h-3.5" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'people', label: 'People', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-14 bg-card/80 backdrop-blur-xl border-b border-border px-6 flex items-center justify-between shrink-0 select-none shadow-soft z-30">
      {/* Breadcrumb Navigation with Interactive Dropdowns */}
      <div className="flex items-center space-x-2 text-xs text-muted-foreground font-medium">
        <div
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="flex items-center space-x-1 text-foreground font-bold hover:text-pink-700 dark:hover:text-pink-400 cursor-pointer transition-colors"
        >
          <Building2 className="w-4 h-4 text-pink-700 dark:text-pink-400" />
          <span>GABAY</span>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />

        <button
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="text-foreground/80 font-medium hover:text-foreground hover:underline transition-colors"
        >
          LMS Module
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />

        {currentTab === 'courses' && activeCourse ? (
          <>
            {/* Course Selector Dropdown in Breadcrumb */}
            <div className="relative" ref={courseDropdownRef}>
              <button
                onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                className="flex items-center space-x-1.5 font-bold font-mono text-pink-700 dark:text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 px-2.5 py-1 rounded-lg border border-pink-500/20 transition-all shadow-soft"
              >
                <span>{activeCourse.code}</span>
                <ChevronDown className={`w-3 h-3 text-pink-700 dark:text-pink-400 transition-transform duration-200 ease-out ${isCourseDropdownOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>

              {isCourseDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-card border border-border rounded-xl shadow-elevated p-1.5 space-y-1 z-50 animate-dropdown">
                  <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-wider border-b border-border/80">
                    Switch Subject Shell
                  </div>
                  {db.courses.map(course => {
                    const isSelected = course.id === activeCourse.id;
                    return (
                      <button
                        key={course.id}
                        onClick={() => {
                          setActiveCourseId(course.id);
                          if (onNavigateCourse) onNavigateCourse(course.id, courseTab || 'modules');
                          setIsCourseDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold border border-pink-500/30'
                            : 'text-foreground hover:bg-muted font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: course.color }}
                          />
                          <div className="text-left truncate">
                            <div className="font-mono font-bold">{course.code}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{course.title}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Course Sub-Tab Selector Dropdown in Breadcrumb */}
            {courseTab && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                <div className="relative" ref={tabDropdownRef}>
                  <button
                    onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                    className="flex items-center space-x-1.5 text-foreground font-bold capitalize bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-all shadow-soft"
                  >
                    <span>{courseTab}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out ${isTabDropdownOpen ? 'rotate-180' : 'rotate-0'}`} />
                  </button>

                  {isTabDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-elevated p-1.5 space-y-0.5 z-50 animate-dropdown">
                      <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-wider border-b border-border/80">
                        Course Section
                      </div>
                      {courseTabs.map(tab => {
                        const isSelected = courseTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              if (onSelectCourseTab) onSelectCourseTab(tab.id);
                              setIsTabDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isSelected
                                ? 'bg-pink-700 text-white font-bold'
                                : 'text-foreground hover:bg-muted font-medium'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {tab.icon}
                              <span>{tab.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <span className="text-foreground font-bold bg-muted px-2 py-0.5 rounded-md border border-border">
            {formatTabName(currentTab)}
          </span>
        )}
      </div>

      {/* Right Controls - Cellwego Soft Badges & Glass Buttons */}
      <div className="flex items-center space-x-3">
        {/* Compliance Soft Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 shadow-soft">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>CHED CMO 25 s. 2015</span>
        </div>

        {/* Active Role / User Profile Pill */}
        <button
          onClick={() => onNavigateTab && onNavigateTab('profile')}
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg border transition-all duration-150 text-xs font-bold shadow-soft active:scale-[0.98] cursor-pointer ${
            currentTab === 'profile'
              ? 'bg-pink-700 text-white border-pink-700'
              : 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-700 dark:text-pink-400'
          }`}
        >
          <span className="capitalize">{activeRole}</span>
          <span className={`text-[10px] font-mono ${currentTab === 'profile' ? 'text-pink-100' : 'text-muted-foreground'}`}>• Profile</span>
        </button>

        {/* History Page Trigger */}
        <button
          onClick={() => onNavigateTab && onNavigateTab('history')}
          title="Session Trail History"
          className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
            currentTab === 'history'
              ? 'bg-pink-700 text-white border-pink-700 shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent hover:border-border'
          }`}
        >
          <History className="w-4 h-4" />
        </button>

        {/* Help Page Trigger */}
        <button
          onClick={() => onNavigateTab && onNavigateTab('help')}
          title="Institutional User Manual & Help"
          className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
            currentTab === 'help'
              ? 'bg-pink-700 text-white border-pink-700 shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent hover:border-border'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User Avatar Clickable to open Profile */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('profile')}
          className={`flex items-center space-x-2.5 pl-3 border-l border-border cursor-pointer transition-all ${
            currentTab === 'profile' ? 'opacity-100' : 'hover:opacity-80'
          }`}
          title="Open User Profile Page"
        >
          <img
            src={activeUser.avatar}
            alt={activeUser.name}
            className={`w-7 h-7 rounded-full object-cover border shadow-soft ${
              currentTab === 'profile' ? 'ring-2 ring-pink-600 border-transparent' : 'border-border'
            }`}
          />
          <span className="hidden sm:inline text-xs font-bold text-foreground">
            {activeUser.name.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  );
};
