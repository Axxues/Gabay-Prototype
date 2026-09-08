import React from 'react';
import { useLMS } from '../context/LMSContext';
import {
  BookOpen,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Award,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateCourse: (courseId: string, subTab?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateCourse }) => {
  const { activeRole, activeUser, db, openSpeedGrader } = useLMS();

  // Filter courses based on user role
  const userCourses = db.courses.filter(c => {
    if (activeRole === 'student') return true; // enrolled in courses
    if (activeRole === 'faculty') return c.instructorId === activeUser.id;
    return true; // admin/staff see all
  });

  // Needs Grading queue for Faculty
  const unsubmittedList = db.submissions.filter(s => s.status === 'submitted');

  // To-do list for Student
  const studentAssignments = db.assignments.filter(a => a.published);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-lg bg-zinc-900 text-white border border-zinc-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-red-900 text-red-200 rounded border border-red-700">
              DMMMSU-SLUC CCS LMS
            </span>
            <span className="text-xs text-zinc-400 font-mono">1st Sem AY 2026-2027</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, {activeUser.name}
          </h1>
          <p className="text-xs text-zinc-400 max-w-2xl">
            {activeRole === 'student' && "Track your enrolled subjects, pending laboratory submissions, and SpeedGrader evaluation feedback."}
            {activeRole === 'faculty' && "Manage your course modules, grade student submissions via SpeedGrader, and configure advising office hours."}
            {activeRole === 'admin' && "Audit CHED CMO 25 s. 2015 outcome compliance, college-wide gradebook readiness, and department metrics."}
            {activeRole === 'staff' && "Verify Likha ERP student enrollment numbers and track instructor grade submission timestamps."}
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-zinc-300 uppercase font-mono">Role Scope</div>
            <div className="text-sm font-bold text-red-400 capitalize">{activeRole} Level</div>
          </div>
        </div>
      </div>

      {/* ROLE 1 & 2: STUDENT & FACULTY COURSE CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Pane: Course Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-red-700 dark:text-red-500" />
              <span>Enrolled Subject Shells</span>
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              Showing {userCourses.length} Courses
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userCourses.map(course => (
              <div
                key={course.id}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-150 shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Card Banner Header */}
                  <div
                    className="h-24 p-4 flex flex-col justify-between relative overflow-hidden"
                    style={{ backgroundColor: course.color }}
                  >
                    <div className="flex items-center justify-between text-white relative z-10">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-black/40 backdrop-blur-xs rounded">
                        {course.code} • {course.section}
                      </span>
                      {course.published ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 rounded border border-emerald-700/50">
                          PUBLISHED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-zinc-950/80 text-zinc-400 rounded border border-zinc-700">
                          DRAFT
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-base leading-tight drop-shadow-xs truncate relative z-10">
                      {course.title}
                    </h3>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>Instructor:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">{course.instructorName}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        <span>Enrollment:</span>
                        <span>{course.enrolledCount} Students</span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        <span>Compliance:</span>
                        <span className="text-red-700 dark:text-red-400 truncate max-w-[180px]">{course.chedComplianceCode}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Buttons Footer */}
                <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onNavigateCourse(course.id, 'modules')}
                    className="font-semibold text-zinc-700 dark:text-zinc-300 hover:text-red-700 dark:hover:text-red-400 transition-colors flex items-center space-x-1"
                  >
                    <span>View Modules</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigateCourse(course.id, 'grades')}
                    className="font-mono text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Gradebook →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar Widget Pane */}
        <div className="space-y-6">
          {/* STUDENT DASHBOARD SPECIFIC WIDGETS */}
          {activeRole === 'student' && (
            <>
              {/* To-Do List */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>To-Do Submission Queue</span>
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">{studentAssignments.length} Pending</span>
                </div>

                <div className="space-y-2.5">
                  {studentAssignments.map(asg => {
                    const sub = db.submissions.find(s => s.assignmentId === asg.id && s.studentId === activeUser.id);
                    return (
                      <div
                        key={asg.id}
                        onClick={() => onNavigateCourse(asg.courseId, 'assignments')}
                        className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 hover:border-red-700/50 cursor-pointer transition-all space-y-1"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                            {asg.title}
                          </h4>
                          {sub ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                              SUBMITTED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                              DUE SOON
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                          <span>{asg.category} • {asg.pointsPossible} pts</span>
                          <span>Due {new Date(asg.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent SpeedGrader Feedback */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Recent Feedback Alerts</span>
                  </h3>
                </div>

                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">Lab 1: Full-Stack SPA</span>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 text-sm">96/100</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                    "Excellent compliance with CHED CMO 25 UI standards! High density data table is well designed."
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500">
                    Graded by Prof. Arnel V. Zabala
                  </div>
                </div>
              </div>
            </>
          )}

          {/* FACULTY DASHBOARD SPECIFIC WIDGETS */}
          {activeRole === 'faculty' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>Needs Grading Queue</span>
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 rounded">
                  {unsubmittedList.length} Items
                </span>
              </div>

              <div className="space-y-2.5">
                {unsubmittedList.map(sub => {
                  const asg = db.assignments.find(a => a.id === sub.assignmentId);
                  return (
                    <div
                      key={sub.id}
                      className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {sub.studentName}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {asg?.title}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        onClick={() => openSpeedGrader(sub.id)}
                        className="w-full py-1.5 px-3 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center justify-center space-x-1.5"
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

          {/* ADMIN / STAFF DASHBOARD SPECIFIC WIDGETS */}
          {(activeRole === 'admin' || activeRole === 'staff') && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>College Compliance & Audit</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-zinc-600 dark:text-zinc-400">CHED CMO 25 Syllabus Rate:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">100% Compliant</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-full"></div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-zinc-600 dark:text-zinc-400">Likha ERP Roster Sync:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">Synced Today 06:00 AM</span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-zinc-600 dark:text-zinc-400">Gradebook Finalized Count:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">3 / 4 Courses Finalized</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
