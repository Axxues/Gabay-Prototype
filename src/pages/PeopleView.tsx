import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  ShieldCheck,
  CheckCircle,
  Search,
  UserPlus,
  X
} from 'lucide-react';

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

  const students = db.users.filter(u => u.role === 'student');
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
      title: newRole === 'student' ? 'Enrolled Student' : 'Instructor'
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
          <p className="text-xs text-muted-foreground font-mono">
            Audited against Likha ERP Database • Section {course?.section}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5 shadow-soft">
            <ShieldCheck className="w-4 h-4" />
            <span>Likha ERP Sync Active</span>
          </div>

          {(activeRole === 'faculty' || activeRole === 'admin') && (
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
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
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs w-full sm:w-auto">
          {['all', 'faculty', 'student'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-pink-700 text-white shadow-soft'
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
              <tr className="border-b border-border bg-muted/40 font-mono text-muted-foreground">
                <th className="p-3.5">User Name</th>
                <th className="p-3.5">Institutional Student / Staff ID</th>
                <th className="p-3.5">Institutional Email</th>
                <th className="p-3.5">Role Scope</th>
                <th className="p-3.5">ERP Enrollment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allPeople.map(u => {
                const isInst = u.role === 'faculty' || u.role === 'admin';
                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      isInst ? 'bg-pink-500/5 dark:bg-pink-950/10' : ''
                    }`}
                  >
                    <td className="p-3.5 flex items-center space-x-3 font-semibold text-foreground">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover border border-border shadow-soft shrink-0"
                      />
                      <div>
                        <div>{u.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{u.title}</div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-foreground font-medium">
                      {u.studentId || (isInst ? 'FAC-SLUC-0012' : '2021-SLUC-0000')}
                    </td>
                    <td className="p-3.5 font-mono text-muted-foreground">{u.email}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          isInst
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Enrolled / Verified</span>
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
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
            onClick={() => setIsEnrollModalOpen(false)}
          />

          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Enroll Person to Course Section</h3>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEnroll} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Maria Clara De Los Santos"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="e.g. mdelossantos@dmmmsu.edu.ph"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as any)}
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground"
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
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Department / Degree</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer"
                >
                  Enroll in Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
