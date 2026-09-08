import React, { useState } from 'react';
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
  Users
} from 'lucide-react';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

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
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)]">
      {/* Inner Left Course Navigation Bar */}
      <nav className="w-full md:w-56 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-4 shrink-0">
        {/* Course Select Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase text-zinc-500">
            Active Subject Shell
          </label>
          <select
            value={activeCourse.id}
            onChange={e => setActiveCourseId(e.target.value)}
            className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-red-600"
          >
            {db.courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Course Info Summary */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded space-y-1 text-xs">
          <div className="font-bold text-red-700 dark:text-red-400 font-mono">
            {activeCourse.code} ({activeCourse.section})
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            {activeCourse.instructorName}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {activeCourse.term}
          </div>
        </div>

        {/* Course Inner Nav Items */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-zinc-500">
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
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content View Area */}
      <main className="flex-1 p-6 overflow-y-auto bg-white dark:bg-zinc-900/50">
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
