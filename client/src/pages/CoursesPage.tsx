import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { ModulesView } from './ModulesView';
import { SyllabusView } from './SyllabusView';
import { ActivitiesView } from './ActivitiesView';
import { QuizzesView } from './QuizzesView';
import { ExamsView } from './ExamsView';
import { PeopleView } from './PeopleView';
import { AnnouncementsView } from './AnnouncementsView';
import { FilesView } from './FilesView';
import { FacultyGradebook } from '../components/grading/FacultyGradebook';
import { StudentGradebook } from '../components/grading/StudentGradebook';
import { SectionSelectionPage } from './SectionSelectionPage';
import { PendingRequestsPage } from './PendingRequestsPage';

import { JoinCourseModal } from '../components/common/JoinCourseModal';
import { COURSE_CHILDREN, isVisible } from '../config/navigation';
import {
  countNewFiles,
  countNewGrades,
  countPendingPeople,
  countStudentAssessmentBadge,
  countFacultyGradingBadge,
  countUpcomingCalendar,
  countUnreadAnnouncements,
  countUnreadMessages,
} from '../utils/notifiers';

interface CoursesPageProps {
  initialSubTab?: string;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ initialSubTab = 'modules' }) => {
  const { activeCourseId, setActiveCourseId, db, activeRole, activeUser, getUnreadNotificationCount, markTabVisited } = useLMS();

  const [subTab, setSubTab] = useState(initialSubTab);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const availableCourses = activeRole === 'student'
    ? db.courses.filter(c => (activeUser.enrolledCourseIds || []).includes(c.id))
    : db.courses;

  const activeCourse = availableCourses.find(c => c.id === activeCourseId) || availableCourses[0] || db.courses[0];

  useEffect(() => {
    setSubTab(initialSubTab);
    if (activeCourse) markTabVisited(initialSubTab, activeCourse.id);
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

    const visits = activeUser.lastVisitedAt || {};
    const cid = activeCourse.id;
    if (tab.id === 'inbox') {
      badgeCount = countUnreadMessages(db.messages, activeUser.id)
        + getUnreadNotificationCount(activeUser.id, 'module_comment_reply')
        + getUnreadNotificationCount(activeUser.id, 'announcement_reply');
    } else if (tab.id === 'modules') {
      badgeCount = getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
    } else if (tab.id === 'announcements') {
      badgeCount = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId: activeUser.courseSections?.[cid] ?? null }, cid);
    } else if (tab.id === 'activities') {
      // Classic rows live in db.activities now (format === 'classic');
      // question sets link submissions via the synthetic asg-activity-<id>
      // key (values preserved).
      const courseActivities = (db.activities || []).filter(a => a.courseId === cid);
      const publishedActivities = courseActivities.filter(a => a.published);
      const publishedIds = [
        ...publishedActivities.filter(a => a.format === 'classic').map(a => a.id),
        ...publishedActivities.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
      ];
      const allIds = [
        ...courseActivities.filter(a => a.format === 'classic').map(a => a.id),
        ...courseActivities.filter(a => a.format !== 'classic').map(a => `asg-activity-${a.id}`),
      ];
      const courseSubs = db.submissions.filter(s => s.courseId === cid);
      badgeCount = activeRole === 'faculty'
        ? countFacultyGradingBadge(courseSubs, allIds)
        : countStudentAssessmentBadge(publishedIds, courseSubs.filter(s => s.studentId === activeUser.id).map(s => s.activityKey ?? ''));
    } else if (tab.id === 'quizzes') {
      badgeCount = activeRole === 'faculty'
        ? countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), (db.quizzes || []).filter(q => q.courseId === cid).map(q => `asg-quiz-${q.id}`))
        : (db.quizzes || []).filter(q => q.courseId === cid && q.published && !db.submissions.some(s => s.activityKey === `asg-quiz-${q.id}` && s.studentId === activeUser.id)).length;
    } else if (tab.id === 'files') {
      badgeCount = countNewFiles(db.courseFiles || [], cid, visits);
    } else if (tab.id === 'grades') {
      badgeCount = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
    } else if (tab.id === 'people' || tab.id === 'pending-requests') {
      badgeCount = (activeRole === 'faculty' || activeRole === 'admin') ? countPendingPeople(db.enrollmentRequests || [], cid) : 0;
    } else if (tab.id === 'calendar') {
      badgeCount = countUpcomingCalendar(db.calendarEvents || [], cid, visits);
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
        onClick={() => { setSubTab(tab.id); setReturnToTab(null); markTabVisited(tab.id, activeCourse.id); }}
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
            onSelectActivity={actId => {
              setSelectedActivityId(actId);
              setReturnToTab('modules');
              setSubTab('activities');
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

        {subTab === 'activities' && (
          <ActivitiesView
            courseId={activeCourse.id}
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivityId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedActivityId(null);
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

        {subTab === 'exams' && (
          <ExamsView
            courseId={activeCourse.id}
            selectedExamId={selectedExamId}
            onSelectExam={setSelectedExamId}
            onBackToModules={
              returnToTab === 'modules'
                ? () => {
                    setSelectedExamId(null);
                    setReturnToTab(null);
                    setSubTab('modules');
                  }
                : undefined
            }
          />
        )}

        {subTab === 'files' && <FilesView courseId={activeCourse.id} />}

        {subTab === 'grades' && !activeCourse.syllabus && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle" data-testid="grades-syllabus-gate">
            <h3 className="text-sm font-bold text-foreground">Syllabus required for grades</h3>
            <p className="text-xs text-muted-foreground mt-1">The grading formula lives in the syllabus under Course Requirements &amp; Official Grading Formula. {activeRole === 'faculty' ? 'Upload a syllabus to enable the gradebook.' : 'Waiting for your instructor to upload the syllabus.'}</p>
            {activeRole === 'faculty' && (
              <button type="button" onClick={() => setSubTab('syllabus')} className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl cursor-pointer">Go to Syllabus</button>
            )}
          </div>
        )}
        {subTab === 'grades' && activeCourse.syllabus && (
          activeRole === 'student' ? (
            <StudentGradebook courseId={activeCourse.id} />
          ) : (
            <FacultyGradebook courseId={activeCourse.id} onGoToSyllabus={() => setSubTab('syllabus')} />
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
