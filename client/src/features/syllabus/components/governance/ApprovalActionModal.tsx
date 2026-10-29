import React from 'react';
import { AnimatedModal } from '../../../../shared/components/common/ModalPortal';
import { CheckCircle2, ShieldCheck, FileCheck2, AlertCircle } from 'lucide-react';
import type { SyllabusGroup } from '../../types/lifecycle';

interface ApprovalActionModalProps {
  isOpen: boolean;
  type: 'chair' | 'dean';
  group: SyllabusGroup | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  isOpen,
  type,
  group,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !group) return null;

  const isDean = type === 'dean';

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-5 max-w-md w-full bg-card text-foreground">
        <div className="flex items-center space-x-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
          {isDean ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileCheck2 className="w-4 h-4 text-teal-600" />}
          <span>{isDean ? 'Dean Final Authorization' : 'Chairperson Endorsement'}</span>
        </div>

        <div>
          <h2 className="text-xl font-black text-foreground">
            {isDean ? 'Grant Final Institutional Approval' : 'Endorse Syllabus & Forward to Dean'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {isDean
              ? `You are granting official institutional approval for ${group.courseCode} (${group.courseTitle}). This syllabus will be locked, certified, and propagated to all assigned class sections.`
              : `You are endorsing the evaluated syllabus for ${group.courseCode} (${group.courseTitle}). Upon confirmation, this syllabus will be submitted to the College Dean for final institutional approval.`}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Course Code:</span>
            <span className="font-bold text-foreground">{group.courseCode}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Sections Affected:</span>
            <span className="font-semibold text-foreground">{group.sections.join(', ')}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Evaluators:</span>
            <span className="font-semibold text-foreground">
              {group.evaluators.map(e => e.evaluatorName).join(', ') || 'Collegiate Board'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-1.5 ${
              isDean
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isDean ? 'Confirm Dean Approval' : 'Endorse to Dean'}</span>
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};
