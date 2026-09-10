import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Shield,
  Search,
  UserPlus,
  X,
  KeyRound,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { AnimatedModal } from '../components/common/ModalPortal';
import { PageHeader } from '../components/common/PageHeader';

interface PeopleViewProps {
  courseId: string;
}

export const PeopleView: React.FC<PeopleViewProps> = ({ courseId }) => {
  const { db, activeRole, activeUser, enrollStudentsInCourse, regenerateCourseJoinCode, getPendingRequestsForCourse, getCourseSections, approveEnrollmentRequests, rejectEnrollmentRequests, showAlert, showConfirm } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'pending'>('roster');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');

  const courseSections = getCourseSections(courseId);
  const pendingRequests = getPendingRequestsForCourse(courseId);
  const pendingCount = pendingRequests.length;

  // Enroll modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const students = db.users.filter(u => {
    if (u.role !== 'student') return false;
    if (!u.enrolledCourseIds || !u.enrolledCourseIds.includes(courseId)) return false;
    if (selectedSectionFilter !== 'all') {
      const studentSection = u.courseSections?.[courseId];
      if (studentSection !== selectedSectionFilter) return false;
    }
    return true;
  });
  const instructors = db.users.filter(u => u.role === 'faculty' || u.id === course?.instructorId);

  const allPeople = [...instructors, ...students].filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.studentId && u.studentId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (roleFilter === 'all') return matchesSearch;
    return matchesSearch && u.role === roleFilter;
  });

  // All student accounts in the system
  const allStudentAccounts = db.users.filter(u => u.role === 'student');

  const selectedStudents = allStudentAccounts.filter(u => selectedStudentIds.includes(u.id));

  const filteredModalStudents = allStudentAccounts.filter(u => {
    const query = modalSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.studentId && u.studentId.toLowerCase().includes(query))
    );
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleEnrollSelectedStudents = () => {
    if (selectedStudentIds.length === 0) return;

    enrollStudentsInCourse(selectedStudentIds, courseId);

    showAlert({
      title: 'Enrolled in Course',
      message: `Successfully enrolled ${selectedStudentIds.length} student${selectedStudentIds.length > 1 ? 's' : ''} into ${course?.code || 'the course'}.`,
      type: 'success'
    });

    setIsEnrollModalOpen(false);
    setSelectedStudentIds([]);
    setModalSearchQuery('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="People Management"
        description={`Section ${course?.section}`}
        actions={
          activeRole === 'faculty' && (
            <button
              onClick={() => {
                setSelectedStudentIds([]);
                setModalSearchQuery('');
                setIsEnrollModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Enroll Person</span>
            </button>
          )
        }
      />

      {/* Course Join Code Banner */}
      {course?.joinCode && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-foreground">Course Join Code:</span>
                <span className="font-mono font-black text-sm text-primary tracking-wider bg-card px-2.5 py-0.5 rounded-lg border border-border shadow-xs">
                  {course.joinCode}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                Share this unique code with students to allow them to self-enroll into this course shell.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(course.joinCode || '');
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="px-3.5 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-xs font-bold rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
            {activeRole === 'faculty' && (
              <button
                type="button"
                onClick={() => {
                  regenerateCourseJoinCode(course.id);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                title="Regenerate Join Code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Role Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tab Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer ${
              activeTab === 'roster' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Roster
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer relative ${
              activeTab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            Pending Requests
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, student ID, or email..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs w-full sm:w-auto">
          {['all', 'faculty', 'student'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-colors cursor-pointer ${roleFilter === r
                ? 'bg-primary text-primary-foreground shadow-subtle'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              {r === 'all' ? 'All Roles' : `${r}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Tab */}
      {activeTab === 'roster' && (
        <>
          {/* Section Filter */}
          {courseSections.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedSectionFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
                  selectedSectionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                All Sections
              </button>
              {courseSections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSectionFilter(s.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
                    selectedSectionFilter === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.name} ({s.enrolledCount}/{s.capacity})
                </button>
              ))}
            </div>
          )}

          {/* Roster Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-sans text-muted-foreground">
                    <th className="p-3.5">User Name</th>
                    <th className="p-3.5">Student / Staff ID</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Section</th>
                    <th className="p-3.5">Role Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allPeople.map(u => {
                    const isInst = u.role === 'faculty' || u.role === 'admin';
                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-muted/30 transition-colors ${isInst ? 'bg-primary/5' : ''
                          }`}
                      >
                        <td className="p-3.5 flex items-center space-x-3 font-semibold text-foreground">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-border shadow-soft shrink-0"
                          />
                          <div>
                            <div className="font-bold">{u.name}</div>
                            <div className="text-[10px] text-muted-foreground font-sans">{u.department}</div>
                          </div>
                        </td>
                        <td className="p-3.5 font-sans text-muted-foreground">
                          {u.studentId || '2026-FAC-0012'}
                        </td>
                        <td className="p-3.5 font-sans text-foreground">{u.email}</td>
                        <td className="p-3.5">
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {db.courseSections.find(s => s.id === u.courseSections?.[courseId])?.name || 'No Section'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-bold border ${u.role === 'faculty' || u.role === 'admin'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                              }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{u.role.toUpperCase()}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-sans">
              <p className="font-semibold text-foreground mb-1">No Pending Requests</p>
              <p className="text-xs">All enrollment requests have been processed.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingRequests.map(req => {
                const student = db.users.find(u => u.id === req.studentId);
                return (
                  <div key={req.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      <img
                        src={student?.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'}
                        alt={student?.name || 'Student'}
                        className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-foreground">{student?.name || 'Unknown Student'}</div>
                        <div className="text-[10px] text-muted-foreground font-sans">{student?.email} • Requested {new Date(req.requestedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          showConfirm(
                            `Approve enrollment for ${student?.name || 'this student'}?`,
                            () => {
                              approveEnrollmentRequests([req.id]);
                              showAlert({ title: 'Request Approved', message: `${student?.name || 'Student'} has been enrolled.`, type: 'success' });
                            },
                            'Approve Enrollment'
                          );
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            `Reject enrollment for ${student?.name || 'this student'}?`,
                            () => {
                              rejectEnrollmentRequests([req.id]);
                              showAlert({ title: 'Request Rejected', message: `Enrollment request from ${student?.name || 'student'} has been rejected.`, type: 'warning' });
                            },
                            'Reject Enrollment'
                          );
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Enroll Person */}
      <AnimatedModal
        isOpen={isEnrollModalOpen}
        onClose={() => {
          setIsEnrollModalOpen(false);
          setSelectedStudentIds([]);
          setModalSearchQuery('');
        }}
        panelClassName="w-full max-w-lg bg-card border border-border rounded-3xl shadow-elevated p-6 space-y-4 z-10 flex flex-col max-h-[88vh]"
      >
        {({ startClose }) => (
          <>
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-border/80">
              <div>
                <h3 className="text-base font-bold text-foreground font-sans flex items-center space-x-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span>Enroll Students in Course</span>
                </h3>
                <p className="text-[11px] font-sans text-muted-foreground mt-0.5">
                  Select student accounts to add to {course?.code || 'this course'}
                </p>
              </div>
              <button
                type="button"
                onClick={startClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={modalSearchQuery}
                onChange={e => setModalSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border/80 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-2xl text-xs font-sans text-foreground placeholder:text-muted-foreground outline-none transition-all"
              />
              {modalSearchQuery && (
                <button
                  type="button"
                  onClick={() => setModalSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selected Student Avatar Bubbles Row */}
            {selectedStudents.length > 0 && (
              <div className="flex items-center space-x-4 overflow-x-auto pb-2 pt-1 scrollbar-none animate-fade-in">
                {selectedStudents.map(student => (
                  <div key={student.id} className="flex flex-col items-center space-y-1.5 shrink-0 group">
                    <div className="relative">
                      <img
                        src={student.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'}
                        alt={student.name}
                        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-border shadow-subtle group-hover:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleStudent(student.id)}
                        title="Remove"
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground/80 hover:bg-foreground text-background flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-90"
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                    <span className="text-[11px] font-sans font-medium text-foreground max-w-[64px] truncate text-center">
                      {student.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested / Students List Section */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 min-h-[220px] max-h-[360px] pr-1">
              <div className="text-xs font-semibold text-muted-foreground font-sans px-2 pb-1.5">
                Suggested
              </div>

              {filteredModalStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground font-sans space-y-1">
                  <p>No matching student accounts found.</p>
                  {modalSearchQuery && (
                    <p className="text-[11px]">Try adjusting your search keywords.</p>
                  )}
                </div>
              ) : (
                filteredModalStudents.map(student => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const isAlreadyEnrolled = Boolean(student.enrolledCourseIds?.includes(courseId));

                  return (
                    <div
                      key={student.id}
                      onClick={() => {
                        if (!isAlreadyEnrolled) {
                          handleToggleStudent(student.id);
                        }
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between transition-all select-none ${
                        isAlreadyEnrolled
                          ? 'opacity-60 cursor-not-allowed bg-muted/20'
                          : 'hover:bg-muted/40 cursor-pointer active:scale-[0.99]'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5 truncate flex-1 min-w-0">
                        <img
                          src={student.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover border border-border shrink-0 shadow-xs"
                        />
                        <div className="truncate">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs sm:text-sm font-bold text-foreground font-sans truncate">
                              {student.name}
                            </span>
                            {isAlreadyEnrolled && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-muted text-muted-foreground border border-border">
                                Already Enrolled
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-sans text-muted-foreground truncate">
                            {student.studentId ? `${student.studentId} • ` : ''}{student.email}
                          </p>
                        </div>
                      </div>

                      {/* Circular selection indicator on the right */}
                      <div className="shrink-0 ml-3">
                        {isAlreadyEnrolled ? (
                          <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                            <Check className="w-3 h-3 stroke-[2]" />
                          </div>
                        ) : isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-primary-sm transition-transform active:scale-95">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/40 hover:border-foreground/60 transition-colors" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-3">
              <span className="text-xs font-sans text-muted-foreground font-medium">
                {selectedStudentIds.length} {selectedStudentIds.length === 1 ? 'student' : 'students'} selected
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 text-xs font-bold font-sans text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedStudentIds.length === 0}
                  onClick={handleEnrollSelectedStudents}
                  className="px-5 py-2.5 text-xs font-bold font-sans bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-[0.98] flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Enroll in Course</span>
                </button>
              </div>
            </div>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};
