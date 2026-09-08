import React from 'react';
import { useLMS } from '../../context/LMSContext';
import type { UserRole } from '../../types/lms';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallbackMessage?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallbackMessage = "Access Restricted: This feature or tool is reserved for authorized faculty and academic administrators under DMMMSU institutional policy."
}) => {
  const { activeRole, setIsRoleModalOpen } = useLMS();

  if (!allowedRoles.includes(activeRole)) {
    return (
      <div className="p-8 max-w-3xl mx-auto my-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 rounded-lg shrink-0">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-3">
            <div>
              <span className="px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                HTTP 403 / RBAC RESTRICTION
              </span>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                Access Restricted
              </h2>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {fallbackMessage}
            </p>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-500 dark:text-zinc-400 space-y-1">
              <div>Current Role: <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase">{activeRole}</span></div>
              <div>Required Roles: <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase">{allowedRoles.join(', ')}</span></div>
              <div>Compliance Guard: <span className="text-zinc-700 dark:text-zinc-300">RA 10173 Philippine Data Privacy Act & CHED CMO 25 s. 2015</span></div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                onClick={() => setIsRoleModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors shadow-sm"
              >
                Switch Role to Test
              </button>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return Back</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
