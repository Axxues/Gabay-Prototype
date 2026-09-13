import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { JoinCourseModal } from '../components/common/JoinCourseModal';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import {
  BookOpen,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Award,
  ArrowRight,
  Plus,
  Megaphone,
  Folder,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Users
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateCourse: (courseId: string, subTab?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateCourse,
  onNavigateTab
}) => {
  const { activeRole, activeUser, db, openSpeedGrader, getPendingRequestsForStudent, studentApproveInvitation, studentDeclineInvitation } = useLMS();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCodeCourseId, setCopiedCodeCourseId] = useState<string | null>(null);
  const pendingInvitations = getPendingRequestsForStudent();
  const facultyInvites = pendingInvitations.filter(req => req.type === 'faculty_enroll');
  const selfJoinRequests = pendingInvitations.filter(req => req.type === 'self_join');
  const switchRequests = pendingInvitations.filter(req => req.type === 'section_switch');

  // Filter courses based on user role
  const userCourses = db.courses.filter(c => {
    if (activeRole === 'student') {
      return (activeUser.enrolledCourseIds || []).includes(c.id);
    }
    if (activeRole === 'faculty') return c.instructorId === activeUser.id;
    return true;
  });

  const unsubmittedList = db.submissions.filter(s => s.status === 'submitted');
  const studentAssignments = db.assignments.filter(a => a.published);
  const studentActivities = (db.activities || []).filter(a => a.published);
  const todoItems = [
    ...studentAssignments.map(asg => ({
      id: asg.id,
      courseId: asg.courseId,
      title: asg.title,
      category: asg.category,
      pointsLabel: `${asg.pointsPossible} pts`,
      dueDate: asg.dueDate,
      submitted: db.submissions.some(s => s.assignmentId === asg.id && s.studentId === activeUser.id)
    })),
    ...studentActivities.map(a => ({
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      category: 'Question Set',
      pointsLabel: `${a.pointsPossible} pts`,
      dueDate: a.dueDate,
      submitted: db.submissions.some(s => s.assignmentId === `asg-activity-${a.id}` && s.studentId === activeUser.id)
    }))
  ];
  const hasRightSidebar = activeRole === 'student' || activeRole === 'faculty' || activeRole === 'admin';

  // Dynamic Instructor Name Resolution
  const getCourseInstructorName = (course: (typeof db.courses)[0]) => {
    if (activeRole === 'faculty' && (course.instructorId === activeUser.id || !course.instructorId)) {
      return activeUser.name;
    }
    const instructor = db.users.find(u => u.id === course.instructorId);
    if (instructor) return instructor.name;
    return course.instructorName || activeUser.name;
  };

  // Dynamic Enrolled Students Count Resolution
  const getCourseStudentCount = (course: (typeof db.courses)[0]) => {
    const matchingStudents = db.users.filter(u =>
      u.role === 'student' &&
      (!u.enrolledCourseIds || u.enrolledCourseIds.includes(course.id))
    );
    return Math.max(matchingStudents.length, course.enrolledCount || 0);
  };

  return (
    <div className="space-y-8">
      {/* Main Grid Section */}
      <div className={hasRightSidebar ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-6"}>
        {/* Left Pane: Enrolled Course Cards */}
        <div className={hasRightSidebar ? "lg:col-span-2 space-y-4" : "space-y-4"}>
          <PageHeader
            title="My Courses"
            description="Your enrolled course shells"
            actions={
              <>
                {activeRole === 'student' && (
                  <button
                    type="button"
                    onClick={() => setIsJoinModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Join Course</span>
                  </button>
                )}
                {activeRole === 'faculty' && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('create-course')}
                    className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Course</span>
                  </button>
                )}
                <span className="text-xs font-sans text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                  {userCourses.length} Courses
                </span>
              </>
            }
          />

          {/* Empty State or Course Cards Grid */}
          {userCourses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="No Enrolled Courses"
              body={activeRole === 'student'
                ? 'You are not enrolled in any courses yet. Ask your faculty instructor for the course join code and click below to enter your code.'
                : 'No course shells assigned to your account.'}
              actionLabel={activeRole === 'student' ? 'Enter Course Join Code' : undefined}
              onAction={activeRole === 'student' ? () => setIsJoinModalOpen(true) : undefined}
            />
          ) : (
            <div className={`grid gap-5 ${hasRightSidebar ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {userCourses.map(course => (
              <div
                key={course.id}
                onClick={() => onNavigateCourse(course.id, 'modules')}
                className="group bg-card text-card-foreground border border-border rounded-xl overflow-hidden card-hover shadow-subtle flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Card Color Header */}
                  <div
                    className="h-20 p-4 flex flex-col justify-between relative overflow-hidden"
                    style={{ backgroundColor: course.color || undefined }}
                  >
                    {course.image ? (
                      <>
                        <img
                          src={course.image}
                          alt={course.title}
                          className={`absolute inset-0 w-full h-full object-cover ${
                            course.color ? 'opacity-50 mix-blend-overlay' : 'opacity-85'
                          } group-hover:scale-105 transition-transform duration-500 pointer-events-none`}
                        />
                        {!course.color && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20 pointer-events-none" />
                        )}
                      </>
                    ) : (
                      !course.color && (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-950 pointer-events-none" />
                      )
                    )}

                    <div className="flex items-center justify-between text-white relative z-10">
                      <span className="px-2.5 py-0.5 text-[10px] font-sans font-bold bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                        {course.code} • {course.section}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base leading-tight truncate relative z-10">
                      {course.title}
                    </h3>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Instructor:</span>
                        <span className="font-bold text-foreground">{getCourseInstructorName(course)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground font-sans text-[11px]">
                        <span>Enrollment:</span>
                        <span className="text-foreground font-semibold">
                          {getCourseStudentCount(course)} {getCourseStudentCount(course) === 1 ? 'Student' : 'Students'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground font-sans text-[11px] pt-1.5 border-t border-border/50">
                        <span className="flex items-center space-x-1">
                          <KeyRound className="w-3 h-3 text-primary" />
                          <span>Join Code:</span>
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border text-[10px]">
                            {course.joinCode || 'N/A'}
                          </span>
                          {course.joinCode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(course.joinCode || '');
                                setCopiedCodeCourseId(course.id);
                                setTimeout(() => setCopiedCodeCourseId(null), 2000);
                              }}
                              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Copy Join Code"
                            >
                              {copiedCodeCourseId === course.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs group-hover:bg-muted/60 transition-colors">
                  <span className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center space-x-1.5">
                    <span>View Modules</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </span>

                  {/* Quick Action Icons */}
                  <div
                    className="flex items-center space-x-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Announcements"
                      onClick={() => onNavigateCourse(course.id, 'announcements')}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-card rounded-lg transition-colors cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Course Files"
                      onClick={() => onNavigateCourse(course.id, 'files')}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-card rounded-lg transition-colors cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Right Sidebar Widgets */}
        {hasRightSidebar && (
          <div className="space-y-6">
            {/* STUDENT WIDGETS */}
          {activeRole === 'student' && (
            <>
              {/* Pending Invitations Card */}
              {activeRole === 'student' && pendingInvitations.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-subtle p-5 space-y-3">
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" /> {facultyInvites.length > 0 ? 'Pending Invitations' : 'Pending Requests'}
                  </h3>
                  {facultyInvites.map(req => {
                    const course = db.courses.find(c => c.id === req.courseId);
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{course?.code} — {course?.title}</div>
                          <div className="text-[11px] text-muted-foreground">Invited by {course?.instructorName}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              studentApproveInvitation(req.id);
                              onNavigateCourse(req.courseId, 'section-selection');
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => { studentDeclineInvitation(req.id); }}
                            className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {selfJoinRequests.map(req => {
                    const course = db.courses.find(c => c.id === req.courseId);
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{course?.code} — {course?.title}</div>
                          <div className="text-[11px] text-muted-foreground">Request sent — waiting for instructor approval</div>
                        </div>
                        <button
                          onClick={() => { studentDeclineInvitation(req.id); }}
                          className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer"
                        >
                          Withdraw request
                        </button>
                      </div>
                    );
                  })}
                  {switchRequests.map(req => {
                    const course = db.courses.find(c => c.id === req.courseId);
                    const targetName = (db.courseSections || []).find(s => s.id === req.targetSectionId)?.name;
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div>
                          <div className="text-xs font-bold">{course?.code} — {course?.title}</div>
                          <div className="text-[11px] text-muted-foreground">Switch pending{targetName ? ` → ${targetName}` : ''}</div>
                        </div>
                        <button
                          onClick={() => { studentDeclineInvitation(req.id); }}
                          className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer"
                        >
                          Withdraw
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* To-Do List Card */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>To-Do List</span>
                  </h3>
                  <span className="text-[11px] font-sans font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {todoItems.length} Pending
                  </span>
                </div>

                <div className="space-y-2.5">
                  {todoItems.map(item => {
                    return (
                      <div
                        key={item.id}
                        onClick={() => onNavigateCourse(item.courseId, 'assignments')}
                        className="p-3.5 bg-muted/50 rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all space-y-1.5 shadow-soft"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-bold text-foreground leading-tight">
                            {item.title}
                          </h4>
                          {item.submitted ? (
                            <span className="px-2 py-0.5 text-[9px] font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                              SUBMITTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-sans font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/20">
                              DUE SOON
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-sans text-muted-foreground">
                          <span>{item.category} • {item.pointsLabel}</span>
                          <span>Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Alerts Card */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <Award className="w-4 h-4 text-emerald-500" />
                    <span>Recent Feedback</span>
                  </h3>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Lab 1: Full-Stack SPA</span>
                    <span className="font-sans font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">96/100</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "Great work on the lab assignment! Code is clean and well structured."
                  </p>
                  <div className="text-[10px] font-sans text-muted-foreground pt-1 border-t border-emerald-500/20">
                    Graded by {db.users.find(u => u.role === 'faculty')?.name || activeUser.name}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* FACULTY WIDGETS */}
          {activeRole === 'faculty' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <span>To Grade</span>
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-sans font-bold bg-primary/10 text-primary rounded-md border border-primary/20">
                  {unsubmittedList.length} Items
                </span>
              </div>

              <div className="space-y-3">
                {unsubmittedList.map(sub => {
                  const asg = db.assignments.find(a => a.id === sub.assignmentId);
                  return (
                    <div
                      key={sub.id}
                      className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2.5 shadow-soft"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">
                            {sub.studentName}
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {asg?.title}
                          </p>
                        </div>
                        <span className="text-[10px] font-sans text-muted-foreground">
                          {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openSpeedGrader(sub.id)}
                        className="w-full py-2 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-subtle flex items-center justify-center space-x-1.5 active:scale-[0.98] cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Launch SpeedGrader</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN WIDGETS */}
          {activeRole === 'admin' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>College System Overview</span>
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-sans font-bold bg-primary/10 text-primary rounded-md border border-primary/20">
                  Read-Only Audit
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-sans text-muted-foreground font-bold tracking-wider">Total Courses</span>
                  <div className="text-xl font-bold font-sans text-foreground">{db.courses.length}</div>
                </div>
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-sans text-muted-foreground font-bold tracking-wider">Total Faculty</span>
                  <div className="text-xl font-bold font-sans text-foreground">
                    {db.users.filter(u => u.role === 'faculty').length}
                  </div>
                </div>
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-sans text-muted-foreground font-bold tracking-wider">Enrolled Students</span>
                  <div className="text-xl font-bold font-sans text-foreground">
                    {db.users.filter(u => u.role === 'student').length}
                  </div>
                </div>
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-sans text-muted-foreground font-bold tracking-wider">Staff Accounts</span>
                  <div className="text-xl font-bold font-sans text-foreground">
                    {db.users.filter(u => u.role === 'staff').length}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="w-full py-2.5 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center justify-center space-x-2 active:scale-[0.98] cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Manage College Accounts</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    <JoinCourseModal
      isOpen={isJoinModalOpen}
      onClose={() => setIsJoinModalOpen(false)}
      onNavigateCourse={onNavigateCourse}
    />
  </div>
  );
};
