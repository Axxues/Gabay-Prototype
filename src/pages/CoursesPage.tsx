import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { ModulesView } from './ModulesView';
import { SyllabusView } from './SyllabusView';
import { AssignmentsView } from './AssignmentsView';
import { QuizzesView } from './QuizzesView';
import { PeopleView } from './PeopleView';
import { AnnouncementsView } from './AnnouncementsView';
import { FilesView } from './FilesView';
import { FacultyGradebook } from '../components/grading/FacultyGradebook';
import { StudentGradebook } from '../components/grading/StudentGradebook';

import {
  Layers,
  FileText,
  FileCheck2,
  HelpCircle,
  Award,
  Users,
  Megaphone,
  Folder,
  ChevronDown,
  Check
} from 'lucide-react';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCourse = db.courses.find(c => c.id === activeCourseId) || db.courses[0];

  const courseTabs = [
    { id: 'modules', label: 'Modules', icon: <Layers className="w-4 h-4" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <FileText className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'assignments', label: 'Assignments', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'files', label: 'Files', icon: <Folder className="w-4 h-4" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="w-4 h-4" /> },
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> }
  ];

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Inner Left Course Navigation Bar - Cellwego Glass/Card styling */}
      <nav className="w-full md:w-60 h-full bg-card/80 backdrop-blur-md border-r border-border p-4 space-y-4 shrink-0 shadow-soft overflow-y-auto custom-scrollbar">
        {/* Course Select Dropdown */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <label className="text-[10px] font-sans font-bold uppercase text-muted-foreground tracking-wider">
            Active Subject Shell
          </label>
          <button
            type="button"
            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
            className={`w-full p-2.5 bg-card/90 hover:bg-card border rounded-xl text-xs font-bold text-foreground flex items-center justify-between shadow-subtle transition-all cursor-pointer group ${
              isCourseDropdownOpen
                ? 'border-primary ring-2 ring-primary/20 shadow-primary-sm'
                : 'border-border/80 hover:border-primary/40'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-background"
                style={{ backgroundColor: activeCourse.color || '#64748b' }}
              />
              <div className="truncate text-left">
                <span className="font-sans font-bold text-foreground block truncate">{activeCourse.code}</span>
                <span className="text-[10px] text-muted-foreground block truncate font-medium">{activeCourse.title}</span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ml-1 ${
              isCourseDropdownOpen ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'
            }`}>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                  isCourseDropdownOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </div>
          </button>

          {isCourseDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 dropdown-panel p-2 z-50 animate-dropdown">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/60 mb-1.5">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                  Switch Subject
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {db.courses.length} shells
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                {db.courses.map(c => {
                  const isSelected = c.id === activeCourse.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCourseId(c.id);
                        setIsCourseDropdownOpen(false);
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
                          style={{ backgroundColor: c.color || '#64748b' }}
                        />
                        <div className="truncate">
                          <span className="font-sans font-bold block truncate">{c.code}</span>
                          <span className="text-[10px] text-muted-foreground block truncate font-normal">{c.title}</span>
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

        {/* Course Summary Card */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1.5 text-xs shadow-subtle overflow-hidden">
          {activeCourse.image ? (
            <div
              className="h-16 -mx-3.5 -mt-3.5 mb-2.5 relative overflow-hidden flex items-end p-2.5"
              style={{ backgroundColor: activeCourse.color || undefined }}
            >
              <img
                src={activeCourse.image}
                alt={activeCourse.title}
                className={`absolute inset-0 w-full h-full object-cover ${
                  activeCourse.color ? 'opacity-50 mix-blend-overlay' : 'opacity-85'
                }`}
              />
              {!activeCourse.color && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20 pointer-events-none" />
              )}
              <span className="relative z-10 px-2 py-0.5 text-[9px] font-sans font-bold bg-black/40 text-white rounded backdrop-blur-sm border border-white/10">
                {activeCourse.code}
              </span>
            </div>
          ) : (
            !activeCourse.color && (
              <div className="h-12 -mx-3.5 -mt-3.5 mb-2.5 relative overflow-hidden flex items-end p-2.5 bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-950">
                <span className="relative z-10 px-2 py-0.5 text-[9px] font-sans font-bold bg-black/40 text-white rounded backdrop-blur-sm border border-white/10">
                  {activeCourse.code}
                </span>
              </div>
            )
          )}
          <div className="font-extrabold text-primary font-sans">
            {activeCourse.code} ({activeCourse.section})
          </div>
          <div className="text-[10px] font-sans text-muted-foreground">
            {activeCourse.term}
          </div>
        </div>

        {/* Course Navigation Items */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
            Course Navigation
          </div>
          {courseTabs.map(tab => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSubTab(tab.id);
                  setReturnToTab(null);
                  if (tab.id !== 'assignments') setSelectedAssignmentId(null);
                  if (tab.id !== 'quizzes') setSelectedQuizId(null);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-primary-sm translate-x-0.5'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full p-6 overflow-y-auto bg-background custom-scrollbar">
        {subTab === 'modules' && (
          <ModulesView
            courseId={activeCourse.id}
            onSelectAssignment={asgId => {
              setSelectedAssignmentId(asgId);
              setReturnToTab('modules');
              setSubTab('assignments');
            }}
            onSelectQuiz={quizId => {
              setSelectedQuizId(quizId);
              setReturnToTab('modules');
              setSubTab('quizzes');
            }}
          />
        )}

        {subTab === 'syllabus' && <SyllabusView courseId={activeCourse.id} />}

        {subTab === 'announcements' && <AnnouncementsView courseId={activeCourse.id} />}

        {subTab === 'assignments' && (
          <AssignmentsView
            courseId={activeCourse.id}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedAssignmentId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'quizzes' && (
          <QuizzesView
            courseId={activeCourse.id}
            selectedQuizId={selectedQuizId}
            onSelectQuiz={setSelectedQuizId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedQuizId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'files' && <FilesView courseId={activeCourse.id} />}

        {subTab === 'grades' && (
          activeRole === 'student' ? (
            <StudentGradebook courseId={activeCourse.id} />
          ) : (
            <FacultyGradebook courseId={activeCourse.id} />
          )
        )}

        {subTab === 'people' && <PeopleView courseId={activeCourse.id} />}
      </main>
    </div>
  );
};
