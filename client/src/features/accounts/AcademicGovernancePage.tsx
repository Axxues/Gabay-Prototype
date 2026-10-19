import React from 'react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { AcademicStructureTab } from './components/AcademicStructureTab';

interface AcademicGovernancePageProps {
  onNavigateTab?: (tab: string) => void;
}

export const AcademicGovernancePage: React.FC<AcademicGovernancePageProps> = () => {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <PageHeader
        title="Academic Governance"
        description="Govern collegiate academic structures, academic programs, and institutional leadership."
      />

      {/* Main Governance Content: Academic Structure Tab */}
      <AcademicStructureTab />
    </div>
  );
};
