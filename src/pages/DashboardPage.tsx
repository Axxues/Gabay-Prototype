import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  BookOpen,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Award,
  ArrowRight,
  ShieldCheck,
  Plus,
  X
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateCourse: (courseId: string, subTab?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateCourse }) => {
  const { activeRole, activeUser, db, openSpeedGrader, createCourse } = useLMS();

  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSection, setCourseSection] = useState('BSCS 4-1');
  const [courseCredits, setCourseCredits] = useState(3);
  const [courseColor, setCourseColor] = useState('#be185d');
  const [instructorId, setInstructorId] = useState('usr-fac-1');

  // Filter courses based on user role
  const userCourses = db.courses.filter(c => {
    if (activeRole === 'student') return true;
    if (activeRole === 'faculty') return c.instructorId === activeUser.id;
    return true;
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) return;

    const inst = db.users.find(u => u.id === instructorId);
    const newCourse = createCourse({
      code: courseCode.trim().toUpperCase(),
      title: courseTitle.trim(),
      section: courseSection.trim(),
      credits: Number(courseCredits) || 3,
      color: courseColor,
      instructorId: inst?.id || activeUser.id,
      instructorName: inst?.name || activeUser.name,
      term: '1st Sem AY 2026-2027',
      published: true
    });

    setIsCreateCourseOpen(false);
    setCourseCode('');
    setCourseTitle('');
    onNavigateCourse(newCourse.id, 'modules');
  };

  const unsubmittedList = db.submissions.filter(s => s.status === 'submitted');
  const studentAssignments = db.assignments.filter(a => a.published);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Cellwego Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-pink-950 via-zinc-900 to-zinc-950 text-white border border-pink-900/30 shadow-elevated relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 rounded-md border border-pink-500/30">
              DMMMSU-SLUC CCS LMS
            </span>
            <span className="text-xs text-zinc-400 font-mono">1st Sem AY 2026-2027</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            Welcome back, {activeUser.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            {activeRole === 'student' && "Track your enrolled subjects, pending laboratory submissions, and SpeedGrader evaluation feedback."}
            {activeRole === 'faculty' && "Manage your course modules, grade student submissions via SpeedGrader, and configure advising office hours."}
            {activeRole === 'admin' && "Audit CHED CMO 25 s. 2015 outcome compliance, college-wide gradebook readiness, and department metrics."}
            {activeRole === 'staff' && "Verify Likha ERP student enrollment numbers and track instructor grade submission timestamps."}
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <div className="p-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-right">
            <div className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider">Active Role</div>
            <div className="text-sm font-extrabold text-pink-400 capitalize font-mono">{activeRole} Scope</div>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Pane: Enrolled Course Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-3 text-foreground flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-pink-700 dark:text-pink-400" />
              <span>Enrolled Subject Shells</span>
            </h2>
            <div className="flex items-center space-x-2">
              {(activeRole === 'admin' || activeRole === 'faculty') && (
                <button
                  onClick={() => setIsCreateCourseOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create Course Shell</span>
                </button>
              )}
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                {userCourses.length} Enrolled Courses
              </span>
            </div>
          </div>

          {/* Course Cards Grid - Cellwego InteractiveCard styling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {userCourses.map(course => (
              <div
                key={course.id}
                className="group bg-card text-card-foreground border border-border rounded-xl overflow-hidden card-hover shadow-subtle flex flex-col justify-between"
              >
                <div>
                  {/* Card Color Header */}
                  <div
                    className="h-24 p-4 flex flex-col justify-between relative overflow-hidden"
                    style={{ backgroundColor: course.color }}
                  >
                    <div className="flex items-center justify-between text-white relative z-10">
                      <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-black/50 backdrop-blur-md rounded-md">
                        {course.code} • {course.section}
                      </span>
                      {course.published ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 rounded-md border border-emerald-700/50">
                          PUBLISHED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-zinc-950/80 text-zinc-400 rounded-md border border-zinc-700">
                          DRAFT
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-base leading-tight drop-shadow-sm truncate relative z-10">
                      {course.title}
                    </h3>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Instructor:</span>
                        <span className="font-bold text-foreground">{course.instructorName}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground font-mono text-[11px]">
                        <span>Enrollment:</span>
                        <span className="text-foreground">{course.enrolledCount} Students</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground font-mono text-[11px]">
                        <span>Compliance:</span>
                        <span className="text-pink-700 dark:text-pink-400 truncate max-w-[180px] font-semibold">{course.chedComplianceCode}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs">
                  <button
                    onClick={() => onNavigateCourse(course.id, 'modules')}
                    className="font-bold text-foreground hover:text-pink-700 dark:hover:text-pink-400 transition-colors flex items-center space-x-1.5"
                  >
                    <span>View Modules</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigateCourse(course.id, 'grades')}
                    className="font-mono text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Gradebook →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-6">
          {/* STUDENT WIDGETS */}
          {activeRole === 'student' && (
            <>
              {/* To-Do List Card */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>To-Do Submission Queue</span>
                  </h3>
                  <span className="text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {studentAssignments.length} Pending
                  </span>
                </div>

                <div className="space-y-2.5">
                  {studentAssignments.map(asg => {
                    const sub = db.submissions.find(s => s.assignmentId === asg.id && s.studentId === activeUser.id);
                    return (
                      <div
                        key={asg.id}
                        onClick={() => onNavigateCourse(asg.courseId, 'assignments')}
                        className="p-3.5 bg-muted/50 rounded-xl border border-border hover:border-pink-500/40 cursor-pointer transition-all space-y-1.5 shadow-soft"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-bold text-foreground leading-tight">
                            {asg.title}
                          </h4>
                          {sub ? (
                            <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/20">
                              SUBMITTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/20">
                              DUE SOON
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                          <span>{asg.category} • {asg.pointsPossible} pts</span>
                          <span>Due {new Date(asg.dueDate).toLocaleDateString()}</span>
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
                    <span>SpeedGrader Feedback Alerts</span>
                  </h3>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Lab 1: Full-Stack SPA</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">96/100</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "Excellent compliance with CHED CMO 25 UI standards! High density data table is well designed."
                  </p>
                  <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-emerald-500/20">
                    Graded by Faculty 1
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
                  <AlertCircle className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  <span>Needs Grading Queue</span>
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded-md border border-pink-500/20">
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
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        onClick={() => openSpeedGrader(sub.id)}
                        className="w-full py-2 px-3 text-xs font-bold bg-pink-700 hover:bg-pink-800 text-white rounded-lg transition-all shadow-subtle flex items-center justify-center space-x-1.5 active:scale-[0.98]"
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

          {/* ADMIN / STAFF WIDGETS */}
          {(activeRole === 'admin' || activeRole === 'staff') && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-subtle">
              <div className="border-b border-border pb-3">
                <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>College Compliance & Audit</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">CHED CMO 25 Syllabus:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">100% Compliant</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-full"></div>
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">Likha ERP Roster Sync:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">Synced Today 06:00 AM</span>
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">Gradebook Finalized Count:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">3 / 4 Courses Finalized</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Course Shell */}
      {isCreateCourseOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
            onClick={() => setIsCreateCourseOpen(false)}
          />

          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Create Course Shell</h3>
              </div>
              <button
                onClick={() => setIsCreateCourseOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block font-bold text-foreground mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={courseCode}
                    onChange={e => setCourseCode(e.target.value)}
                    placeholder="CMSC 180"
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-mono font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-foreground mb-1">Section *</label>
                  <input
                    type="text"
                    required
                    value={courseSection}
                    onChange={e => setCourseSection(e.target.value)}
                    placeholder="BSCS 4-1"
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Expert Systems"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-foreground mb-1">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={courseCredits}
                    onChange={e => setCourseCredits(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Card Color</label>
                  <input
                    type="color"
                    value={courseColor}
                    onChange={e => setCourseColor(e.target.value)}
                    className="w-full h-10 p-1 bg-background border border-border rounded-xl cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Instructor</label>
                  <select
                    value={instructorId}
                    onChange={e => setInstructorId(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground text-xs"
                  >
                    {db.users.filter(u => u.role === 'faculty' || u.role === 'admin').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseOpen(false)}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer"
                >
                  Create Shell
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
