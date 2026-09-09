import React, { useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import type { UserRole } from '../../types/lms';
import { ShieldCheck, UserCheck, GraduationCap, Building, X, AlertTriangle } from 'lucide-react';

export const RoleSwitcherModal: React.FC = () => {
  const { isRoleModalOpen, setIsRoleModalOpen, activeRole, switchRole } = useLMS();

  useEffect(() => {
    if (!isRoleModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRoleModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoleModalOpen, setIsRoleModalOpen]);

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
      personName: 'Dean 1',
      icon: <Building className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
      badgeColor: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
      scope: 'College-wide visibility across all course shells, instructors & enrollments.',
      allowed: 'Course auditing, CHED syllabus compliance matrix, Commons template management, read-only gradebook inspect.',
      restrictions: 'Cannot modify grades directly into an instructor\'s active gradebook.'
    },
    {
      role: 'faculty',
      title: '2. Faculty Member (Instructor)',
      personName: 'Faculty 1',
      icon: <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      scope: 'Assigned course sections (CMSC 131, CMSC 150, CMSC 170).',
      allowed: 'Course authoring (Modules, Assignments, Quizzes), SpeedGrader submission review, Gradebook editing, advising scheduler.',
      restrictions: 'Zero visibility into gradebooks or private drafts handled by other instructors.'
    },
    {
      role: 'staff',
      title: '3. Non-Teaching Staff (Registrar)',
      personName: 'Staff 1',
      icon: <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      scope: 'Roster audit against Likha ERP enrollment numbers & compliance.',
      allowed: 'Roster auditing, Likha ERP sync metrics, grade submission timestamp tracker (verifying instructor final submission).',
      restrictions: 'Strictly blocked from viewing student assignment grades, quiz answers, or SpeedGrader evaluations.'
    },
    {
      role: 'student',
      title: '4. Student (Enrolled)',
      personName: 'Student 1',
      studentId: '2021-SLUC-0492',
      icon: <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      scope: 'Enrolled course sections only.',
      allowed: 'Submitting assignments, taking quizzes, personal Gradebook with "What-If" score calculator, booking advising slots.',
      restrictions: 'Blocked from Commons. Strictly prevented from viewing peer grades, instructor gradebooks, or unpublished module drafts (RA 10173 compliance).'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-backdrop animate-fade-in"
      onClick={() => setIsRoleModalOpen(false)}
    >
      <div
        className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-muted text-foreground rounded-md border border-border">
                GABAY RBAC SESSION
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Institutional Role Switcher
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a role to test specific view scopes, permissions, and Canvas LMS features.
            </p>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
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
                  className={`cursor-pointer rounded-xl border p-4 card-hover transition-all duration-200 relative ${
                    isSelected
                      ? 'border-pink-600 bg-pink-500/10 shadow-lifted'
                      : 'border-border bg-card shadow-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-muted rounded-xl border border-border">
                        {r.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          {r.title}
                        </h3>
                        <p className="text-xs font-medium text-foreground/80 mt-0.5">
                          {r.personName} {r.studentId && <span className="font-mono text-xs text-muted-foreground">({r.studentId})</span>}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-pink-700 text-white rounded-md shadow-soft">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs">
                    <div className="flex items-start space-x-1.5 text-muted-foreground">
                      <span className="font-bold text-foreground shrink-0">Scope:</span>
                      <span>{r.scope}</span>
                    </div>
                    <div className="flex items-start space-x-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <span className="font-bold shrink-0">Allowed:</span>
                      <span>{r.allowed}</span>
                    </div>
                    <div className="flex items-start space-x-1.5 text-amber-700 dark:text-amber-400 font-medium">
                      <span className="font-bold shrink-0">Rules:</span>
                      <span>{r.restrictions}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center text-xs text-muted-foreground space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>GABAY System Security Guard: Enforces RA 10173 Data Privacy Act.</span>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="px-4 py-2 text-xs font-bold text-foreground hover:bg-muted rounded-xl transition-colors border border-border"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
