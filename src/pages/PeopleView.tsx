import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Search,
  UserPlus,
  X
} from 'lucide-react';
import { AnimatedModal } from '../components/common/ModalPortal';

interface PeopleViewProps {
  courseId: string;
}

export const PeopleView: React.FC<PeopleViewProps> = ({ courseId }) => {
  const { db, activeRole, enrollPerson } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Enroll modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'faculty'>('student');
  const [newStudentId, setNewStudentId] = useState('');
  const [newDept, setNewDept] = useState('BS Computer Science');

  const students = db.users.filter(u => 
    u.role === 'student' && 
    (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId))
  );
  const instructors = db.users.filter(u => u.role === 'faculty' || u.id === course?.instructorId);

  const allPeople = [...instructors, ...students].filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.studentId && u.studentId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (roleFilter === 'all') return matchesSearch;
    return matchesSearch && u.role === roleFilter;
  });

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    enrollPerson({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      studentId: newStudentId.trim() || (newRole === 'student' ? `2026-SLUC-${Math.floor(1000 + Math.random() * 9000)}` : undefined),
      department: newDept,
      title: newRole === 'student' ? 'Enrolled Student' : 'Instructor',
      enrolledCourseIds: [courseId]
    }, courseId);

    setIsEnrollModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewStudentId('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Course Roster & ERP Enrollment Sync
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Audited against Likha ERP Database • Section {course?.section}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-sans text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5 shadow-soft">
            <ShieldCheck className="w-4 h-4" />
            <span>Likha ERP Sync Active</span>
          </div>

          {(activeRole === 'faculty' || activeRole === 'admin') && (
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Enroll Person</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Role Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-primary text-primary-foreground shadow-subtle'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'All Roles' : `${r}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-sans text-muted-foreground">
                <th className="p-3.5">User Name</th>
                <th className="p-3.5">Student / Staff ID</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role Scope</th>
                <th className="p-3.5">Enrollment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allPeople.map(u => {
                const isInst = u.role === 'faculty' || u.role === 'admin';
                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      isInst ? 'bg-primary/5' : ''
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
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-bold border ${
                          u.role === 'faculty' || u.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>{u.role.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center space-x-1 text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enrolled & Active</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Enroll Person */}
      <AnimatedModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        panelClassName="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {({ startClose }) => (
          <>
            <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Enroll Course Participant</h3>
                  <p className="text-[10px] font-sans text-muted-foreground">SLUC SIS Database Sync</p>
                </div>
              </div>
              <button
                onClick={startClose}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEnroll} className="p-6 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Maria Clara De Los Santos"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="e.g. mdelossantos@dmmmsu.edu.ph"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as any)}
                    className="w-full p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground text-xs font-sans font-medium outline-none shadow-subtle cursor-pointer transition-all"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty Instructor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Student / Employee ID</label>
                  <input
                    type="text"
                    value={newStudentId}
                    onChange={e => setNewStudentId(e.target.value)}
                    placeholder="2026-SLUC-0899"
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Department / Degree</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-subtle cursor-pointer"
                >
                  Enroll in Section
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};
