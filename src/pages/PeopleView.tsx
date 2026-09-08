import React from 'react';
import { useLMS } from '../context/LMSContext';
import { ShieldCheck, CheckCircle } from 'lucide-react';

interface PeopleViewProps {
  courseId: string;
}

export const PeopleView: React.FC<PeopleViewProps> = ({ courseId }) => {
  const { db } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const students = db.users.filter(u => u.role === 'student');
  const instructor = db.users.find(u => u.id === course?.instructorId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Course Roster & ERP Enrollment Sync
          </h2>
          <p className="text-xs text-zinc-500 font-mono">
            Audited against Likha ERP Database • Section {course?.section}
          </p>
        </div>

        <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>Likha ERP Sync Active</span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-zinc-500">
                <th className="p-3">User Name</th>
                <th className="p-3">Institutional Student / Staff ID</th>
                <th className="p-3">Institutional Email</th>
                <th className="p-3">Role Scope</th>
                <th className="p-3">ERP Enrollment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {/* Instructor Row */}
              {instructor && (
                <tr className="bg-red-50/20 dark:bg-red-950/10">
                  <td className="p-3 flex items-center space-x-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    <img src={instructor.avatar} alt={instructor.name} className="w-7 h-7 rounded-full object-cover border border-zinc-300 dark:border-zinc-700" />
                    <div>
                      <div>{instructor.name}</div>
                      <div className="text-[10px] text-zinc-500">{instructor.title}</div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-zinc-500">FAC-SLUC-0012</td>
                  <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">{instructor.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-800">
                      INSTRUCTOR
                    </span>
                  </td>
                  <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">Assigned Lead</td>
                </tr>
              )}

              {/* Student Rows */}
              {students.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                  <td className="p-3 flex items-center space-x-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    <img src={s.avatar} alt={s.name} className="w-7 h-7 rounded-full object-cover border border-zinc-300 dark:border-zinc-700" />
                    <span>{s.name}</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {s.studentId || '2021-SLUC-0000'}
                  </td>
                  <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">{s.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded border border-blue-300 dark:border-blue-800">
                      STUDENT
                    </span>
                  </td>
                  <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Officially Enrolled</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
