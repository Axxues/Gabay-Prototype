import React from 'react';
import { useLMS } from '../../context/LMSContext';
import type { UserRole } from '../../types/lms';
import { ShieldCheck, UserCheck, GraduationCap, Building, X, AlertTriangle } from 'lucide-react';

export const RoleSwitcherModal: React.FC = () => {
  const { isRoleModalOpen, setIsRoleModalOpen, activeRole, switchRole } = useLMS();

  if (!isRoleModalOpen) return null;

  const roles: {
    role: UserRole;
    title: string;
    personName: string;
    studentId?: string;
    icon: React.ReactNode;
    badgeColor: string;
    scope: string;
    allowed: string;
    restrictions: string;
  }[] = [
    {
      role: 'admin',
      title: '1. Administrator (Dean / Chair)',
      personName: 'Dr. Charlie S. Marzan',
      icon: <Building className="w-5 h-5 text-red-600 dark:text-red-400" />,
      badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-300 dark:border-red-800',
      scope: 'College-wide visibility across all course shells, instructors & enrollments.',
      allowed: 'Course auditing, CHED syllabus compliance matrix, Commons template management, read-only gradebook inspect.',
      restrictions: 'Cannot modify grades directly into an instructor\'s active gradebook.'
    },
    {
      role: 'faculty',
      title: '2. Faculty Member (Instructor)',
      personName: 'Prof. Arnel V. Zabala',
      icon: <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      scope: 'Assigned course sections (CMSC 131, CMSC 150, CMSC 170).',
      allowed: 'Course authoring (Modules, Assignments, Quizzes), SpeedGrader submission review, Gradebook editing, advising scheduler.',
      restrictions: 'Zero visibility into gradebooks or private drafts handled by other instructors.'
    },
    {
      role: 'staff',
      title: '3. Non-Teaching Staff (Registrar)',
      personName: 'Maria L. Santos',
      icon: <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      scope: 'Roster audit against Likha ERP enrollment numbers & compliance.',
      allowed: 'Roster auditing, Likha ERP sync metrics, grade submission timestamp tracker (verifying instructor final submission).',
      restrictions: 'Strictly blocked from viewing student assignment grades, quiz answers, or SpeedGrader evaluations.'
    },
    {
      role: 'student',
      title: '4. Student (Enrolled)',
      personName: 'Jayvee G. Reyes',
      studentId: '2021-SLUC-0492',
      icon: <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      scope: 'Enrolled course sections only.',
      allowed: 'Submitting assignments, taking quizzes, personal Gradebook with "What-If" score calculator, booking advising slots.',
      restrictions: 'Blocked from Commons. Strictly prevented from viewing peer grades, instructor gradebooks, or unpublished module drafts (RA 10173 compliance).'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded">
                GABAY RBAC SESSION
              </span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Institutional Role Switcher
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Select a role to test specific view scopes, permissions, and Canvas LMS features.
            </p>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(r => {
              const isSelected = activeRole === r.role;
              return (
                <div
                  key={r.role}
                  onClick={() => {
                    switchRole(r.role);
                    setIsRoleModalOpen(false);
                  }}
                  className={`cursor-pointer rounded-lg border p-4 transition-all duration-150 relative ${
                    isSelected
                      ? 'border-red-700 dark:border-red-600 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-600/30'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                        {r.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {r.title}
                        </h3>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">
                          {r.personName} {r.studentId && <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">({r.studentId})</span>}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-700 text-white rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-start space-x-1.5 text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">Scope:</span>
                      <span>{r.scope}</span>
                    </div>
                    <div className="flex items-start space-x-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="font-semibold shrink-0">Allowed:</span>
                      <span>{r.allowed}</span>
                    </div>
                    <div className="flex items-start space-x-1.5 text-amber-700 dark:text-amber-400">
                      <span className="font-semibold shrink-0">Rules:</span>
                      <span>{r.restrictions}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between">
          <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>GABAY System Security Guard: Enforces RA 10173 Data Privacy Act.</span>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
