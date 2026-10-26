import React, { useState } from 'react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { AcademicStructureTab } from './components/AcademicStructureTab';
import { LeadershipTimelineTab } from './components/LeadershipTimelineTab';
import { Building2, History } from 'lucide-react';

interface AcademicGovernancePageProps {
  onNavigateTab?: (tab: string) => void;
}

export const AcademicGovernancePage: React.FC<AcademicGovernancePageProps> = () => {
  const [activeTab, setActiveTab] = useState<'structure' | 'timeline'>('structure');

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <PageHeader
        title="Academic Governance"
        description="Govern collegiate academic structures, academic programs, and institutional leadership."
      />

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-border pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('structure')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer ${
            activeTab === 'structure'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Academic Structure</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer ${
            activeTab === 'timeline'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Leadership & Governance Timeline</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'structure' ? <AcademicStructureTab /> : <LeadershipTimelineTab />}
    </div>
  );
};
