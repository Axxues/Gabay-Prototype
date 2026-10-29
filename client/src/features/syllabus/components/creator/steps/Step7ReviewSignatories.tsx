import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { Printer, Link2, CheckCircle2, UserCheck } from 'lucide-react';
import { CoInstructorSubmissionPanel, type CoInstructorAgreementItem } from '../CoInstructorSubmissionPanel';

interface Step7ReviewSignatoriesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  onPrint: () => void;
  onAttachCourse: () => void;
  coInstructors?: CoInstructorAgreementItem[];
  currentUserId?: string;
  allAgreed?: boolean;
  onAgreeToSubmit?: () => void;
}

export const Step7ReviewSignatories: React.FC<Step7ReviewSignatoriesProps> = ({
  data,
  onChange,
  onPrint,
  onAttachCourse,
  coInstructors,
  currentUserId,
  allAgreed = false,
  onAgreeToSubmit
}) => {
  const { signatories, facultyMembers = [] } = data;
  const faculty = facultyMembers[0];

  const updateSignatory = (role: 'preparedBy' | 'recommendingApproval' | 'approved', field: 'name' | 'title', value: string) => {
    if (role === 'preparedBy') {
      const current = signatories?.preparedBy?.[0] || { name: faculty?.name || '', title: 'Faculty Member' };
      onChange({
        ...data,
        signatories: {
          ...signatories,
          preparedBy: [{ ...current, [field]: value }]
        }
      });
    } else {
      const current = signatories?.[role] || { name: '', title: '' };
      onChange({
        ...data,
        signatories: {
          ...signatories,
          [role]: { ...current, [field]: value }
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <span>Institutional Signatories & Finalization</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Verify academic signatories for review and recommendation, generate official PDF outputs, or attach directly to LMS courses.
        </p>
      </div>

      {/* Multi-Instructor Submission Consensus Panel */}
      {coInstructors && coInstructors.length > 0 && onAgreeToSubmit && (
        <CoInstructorSubmissionPanel
          currentUserId={currentUserId}
          instructors={coInstructors}
          allAgreed={allAgreed}
          onAgreeToSubmit={onAgreeToSubmit}
        />
      )}

      {/* Signatories Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prepared By (Faculty) */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            1. Prepared by (Faculty)
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">Faculty Name</label>
            <input
              type="text"
              value={signatories?.preparedBy?.[0]?.name ?? faculty?.name ?? ''}
              onChange={e => updateSignatory('preparedBy', 'name', e.target.value)}
              placeholder="e.g. DR. JUAN DELA CRUZ"
              className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">Designation</label>
            <input
              type="text"
              value={signatories?.preparedBy?.[0]?.title || 'Faculty Member'}
              onChange={e => updateSignatory('preparedBy', 'title', e.target.value)}
              placeholder="e.g. Assistant Professor II"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        {/* Recommending Approval (Chairperson) */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            2. Recommending Approval (Chair)
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">Program Chairperson</label>
            <input
              type="text"
              value={signatories?.recommendingApproval?.name || ''}
              onChange={e => updateSignatory('recommendingApproval', 'name', e.target.value)}
              placeholder="e.g. DR. MARIA SANTOS"
              className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">Designation</label>
            <input
              type="text"
              value={signatories?.recommendingApproval?.title || 'Department Chairperson'}
              onChange={e => updateSignatory('recommendingApproval', 'title', e.target.value)}
              placeholder="Department Chairperson"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        {/* Approved (Dean) */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            3. Approved (Dean)
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">College Dean</label>
            <input
              type="text"
              value={signatories?.approved?.name || ''}
              onChange={e => updateSignatory('approved', 'name', e.target.value)}
              placeholder="e.g. CHARLIE S. MARZAN"
              className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">Designation</label>
            <input
              type="text"
              value={signatories?.approved?.title || 'Dean / Institute Director'}
              onChange={e => updateSignatory('approved', 'title', e.target.value)}
              placeholder="Dean / Institute Director"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
            />
          </div>
        </div>
      </div>

      {/* Completion Actions Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-4">
        <div className="flex items-center space-x-2 text-primary font-bold text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Syllabus Ready for Production</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
          Your course syllabus meets the institutional standard format (DMMMSU-INS-F003) across all 5 sections. You can export the clean printable copy or push it directly to your assigned LMS course rooms.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-primary" />
            <span>Print / Save as PDF</span>
          </button>

          <button
            type="button"
            onClick={onAttachCourse}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Link2 className="w-4 h-4" />
            <span>Attach to Assigned LMS Course</span>
          </button>
        </div>
      </div>
    </div>
  );
};
