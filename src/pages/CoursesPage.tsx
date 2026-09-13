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
import { SectionSelectionPage } from './SectionSelectionPage';
import { PendingRequestsPage } from './PendingRequestsPage';

import { JoinCourseModal } from '../components/common/JoinCourseModal';
import { COURSE_CHILDREN, isVisible } from '../config/navigation';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole, activeUser, getUnreadNotificationCount } = useLMS();

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
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (activeRole === 'student' && subTab === 'people') {
      setSubTab('modules');
    }
    if (activeRole === 'student' && subTab === 'pending-requests') {
      setSubTab('modules');
    }
  }, [activeRole, subTab]);

  useEffect(() => {
    if (activeRole !== 'student') return;
    if (!activeCourse) return;
    if (subTab === 'section-selection') return;
    const sections = (db.courseSections || []).filter(s => s.courseId === activeCourse.id);
    if (sections.length === 0) return;
    const hasApproval = (db.enrollmentRequests || []).some(
      r => r.studentId === activeUser.id && r.courseId === activeCourse.id && r.status === 'approved'
    );
    if (!hasApproval) return;
    if (activeUser.courseSections?.[activeCourse.id]) return;
    setSubTab('section-selection');
  }, [activeRole, subTab, activeCourse, db.courseSections, db.enrollmentRequests, activeUser]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 h-full p-6 overflow-y-auto bg-background custom-scrollbar">
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(tab => {
    let badge = null;
    let badgeCount = 0;

    if (tab.id === 'inbox') {
      const unreadMessages = db.messages.filter(m => m.recipientId === activeUser.id && !m.read).length;
      badgeCount = unreadMessages + getUnreadNotificationCount(activeUser.id, 'module_comment_reply') + getUnreadNotificationCount(activeUser.id, 'announcement_reply');
    } else if (tab.id === 'modules') {
      badgeCount = getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
    } else if (tab.id === 'announcements') {
      badgeCount = getUnreadNotificationCount(activeUser.id, 'announcement_reply');
    } else if (tab.id === 'quizzes') {
      badgeCount = getUnreadNotificationCount(activeUser.id); // general quiz notifications
    }

    if (badgeCount > 0) {
      badge = (
        <span
          key={tab.id + '-badge'}
          className="absolute right-0 top-0 h-4 w-4 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center -translate-half"
        >
          {badgeCount}
        </span>
      );
    }

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => { setSubTab(tab.id); setReturnToTab(null); }}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer relative ${subTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'}`}
      >
        {tab.label}
        {badge}
      </button>
    );
  })}
        </div>
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

        {subTab === 'section-selection' && activeRole === 'student' && (
          <SectionSelectionPage
            courseId={activeCourse.id}
            onSectionSelected={() => setSubTab('modules')}
          />
        )}

        {subTab === 'pending-requests' && activeRole === 'faculty' && (
          <PendingRequestsPage courseId={activeCourse.id} />
        )}
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
