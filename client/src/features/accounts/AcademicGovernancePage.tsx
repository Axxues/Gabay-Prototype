import React, { useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { LeadershipTransferModal } from './components/LeadershipTransferModal';
import { AcademicStructureTab } from './components/AcademicStructureTab';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';

interface AcademicGovernancePageProps {
  onNavigateTab?: (tab: string) => void;
}

export const AcademicGovernancePage: React.FC<AcademicGovernancePageProps> = () => {
  const {
    activeUser,
    activeRole,
    setIsRoleModalOpen,
  } = useLMS();

  // Leadership Transfer Modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const canTransfer =
    activeRole === 'superadmin' ||
    (activeRole === 'admin' &&
      (activeUser?.adminSubrole === 'dean' ||
        activeUser?.adminSubrole === 'chairperson' ||
        !activeUser?.adminSubrole));

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16">
      {/* Role Notice if viewing as non-admin */}
      {activeRole !== 'admin' && activeRole !== 'superadmin' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Administrative console preview:</span> You are currently browsing as <strong>{activeRole}</strong>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-500 text-white dark:text-amber-950 font-bold text-xs rounded-xl shadow-xs hover:bg-amber-600 transition-colors shrink-0 cursor-pointer"
          >
            Switch to Admin
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <PageHeader
        title="Academic Governance"
        description="Govern collegiate academic structures, departments, and institutional leadership appointments."
        actions={
          canTransfer ? (
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2.5 bg-card hover:bg-muted active:scale-[0.98] border border-border text-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0"
            >
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              <span>Transfer Leadership</span>
            </button>
          ) : undefined
        }
      />

      {/* Main Governance Content: Academic Structure Tab */}
      <AcademicStructureTab />

      {/* LEADERSHIP TRANSFER MODAL */}
      {isTransferModalOpen && (
        <LeadershipTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
        />
      )}
    </div>
  );
};
