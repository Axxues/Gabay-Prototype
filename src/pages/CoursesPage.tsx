import React, { useState, useEffect } from 'react';
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

import { JoinCourseModal } from '../components/common/JoinCourseModal';
import { PageHeader } from '../components/common/PageHeader';
import { COURSE_CHILDREN, isVisible } from '../config/navigation';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole, activeUser } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const availableCourses = activeRole === 'student'
    ? db.courses.filter(c => (activeUser.enrolledCourseIds || []).includes(c.id))
    : db.courses;

  const activeCourse = availableCourses.find(c => c.id === activeCourseId) || availableCourses[0] || db.courses[0];

  useEffect(() => {
    if (activeRole === 'student' && subTab === 'people') {
      setSubTab('modules');
    }
  }, [activeRole, subTab]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 h-full p-6 overflow-y-auto bg-background custom-scrollbar">
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(tab => (
            <button key={tab.id} type="button" onClick={() => { setSubTab(tab.id); setReturnToTab(null); }} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer ${subTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'}`}>{tab.label}</button>
          ))}
        </div>
        <PageHeader title={`${activeCourse?.code ?? 'Course'} — ${subTab}`} description={activeCourse?.title} />
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

      <JoinCourseModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onNavigateCourse={(id) => {
          setActiveCourseId(id);
          setSubTab('modules');
        }}
      />
    </div>
  );
};
