import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { ModulesView } from './ModulesView';
import { SyllabusView } from './SyllabusView';
import { AssignmentsView } from './AssignmentsView';
import { QuizzesView } from './QuizzesView';
import { PeopleView } from './PeopleView';
import { FacultyGradebook } from '../components/grading/FacultyGradebook';
import { StudentGradebook } from '../components/grading/StudentGradebook';

import {
  Layers,
  FileText,
  FileCheck2,
  HelpCircle,
  Award,
  Users,
  ChevronDown,
  Check
} from 'lucide-react';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
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
    { id: 'assignments', label: 'Assignments', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="w-4 h-4" /> },
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> }
  ];

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Inner Left Course Navigation Bar - Cellwego Glass/Card styling */}
      <nav className="w-full md:w-60 h-full bg-card/60 backdrop-blur-md border-r border-border p-4 space-y-4 shrink-0 shadow-soft overflow-y-auto">
        {/* Course Select Dropdown */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-wider">
            Active Subject Shell
          </label>
          <button
            type="button"
            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
            className="w-full p-2.5 bg-card border border-border hover:border-pink-500/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-between shadow-subtle transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeCourse.color }}
              />
              <span className="truncate">{activeCourse.code}: {activeCourse.title}</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ease-out ${
                isCourseDropdownOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          {isCourseDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-elevated p-1.5 space-y-1 z-50 animate-dropdown">
              <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase text-muted-foreground border-b border-border/80">
                Switch Subject
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold border border-pink-500/30'
                          : 'text-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <div className="truncate">
                          <span className="font-mono font-bold">{c.code}</span>
                          <span className="text-[10px] text-muted-foreground block truncate">{c.title}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Course Summary Card */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1.5 text-xs shadow-subtle">
          <div className="font-extrabold text-pink-700 dark:text-pink-400 font-mono">
            {activeCourse.code} ({activeCourse.section})
          </div>
          <div className="text-[11px] font-medium text-foreground truncate">
            {activeCourse.instructorName}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {activeCourse.term}
          </div>
        </div>

        {/* Course Navigation Items */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-muted-foreground">
            Course Navigation
          </div>
          {courseTabs.map(tab => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSubTab(tab.id);
                  if (tab.id !== 'assignments') setSelectedAssignmentId(null);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                  isActive
                    ? 'bg-pink-700 text-white shadow-card'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
      <main className="flex-1 h-full p-6 overflow-y-auto bg-background">
        {subTab === 'modules' && (
          <ModulesView
            courseId={activeCourse.id}
            onSelectAssignment={asgId => {
              setSelectedAssignmentId(asgId);
              setSubTab('assignments');
            }}
            onSelectQuiz={() => setSubTab('quizzes')}
          />
        )}

        {subTab === 'syllabus' && <SyllabusView courseId={activeCourse.id} />}

        {subTab === 'assignments' && (
          <AssignmentsView
            courseId={activeCourse.id}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
          />
        )}

        {subTab === 'quizzes' && <QuizzesView courseId={activeCourse.id} />}

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
