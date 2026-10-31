import React from 'react';
import { Users, CheckCircle2, Clock, Check, Undo2 } from 'lucide-react';

export interface CoInstructorAgreementItem {
  id: string;
  name: string;
  hasAgreed: boolean;
}

interface CoInstructorSubmissionPanelProps {
  currentUserId?: string;
  instructors: CoInstructorAgreementItem[];
  allAgreed: boolean;
  onAgreeToSubmit: () => void;
  onRetractAgreement?: () => void;
  isEvaluationStarted?: boolean;
}

export const CoInstructorSubmissionPanel: React.FC<CoInstructorSubmissionPanelProps> = ({
  currentUserId,
  instructors,
  allAgreed,
  onAgreeToSubmit,
  onRetractAgreement,
  isEvaluationStarted = false
}) => {
  const currentUserAgreed = instructors.find(i => i.id === currentUserId)?.hasAgreed;
  const isSolo = instructors.length === 1;

  const handleAction = () => {
    if (currentUserAgreed) {
      onRetractAgreement?.();
    } else {
      onAgreeToSubmit();
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {isSolo ? 'Instructor Submission Confirmation' : 'Co-Instructor Submission Consensus'}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {isSolo
                ? 'Review and confirm that this syllabus is complete and ready for departmental evaluation.'
                : 'Multiple instructors share this syllabus. All assigned instructors must confirm agreement before this syllabus enters Evaluation.'}
            </p>
          </div>
        </div>

        {allAgreed ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isSolo ? 'Submission Confirmed' : 'Unanimous Instructor Consensus Achieved'}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span>{isSolo ? 'Awaiting Submission Confirmation' : 'Awaiting Co-Instructor Consensus'}</span>
          </span>
        )}
      </div>

      {/* Roster of Co-Instructors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {instructors.map(inst => (
          <div
            key={inst.id}
            className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
              inst.hasAgreed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-card border-border text-foreground'
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{inst.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {inst.id === currentUserId ? '(You)' : 'Co-Instructor'}
              </p>
            </div>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                inst.hasAgreed
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {inst.hasAgreed ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Ready</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Pending</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Toggle Agreement Action (available until evaluation starts) */}
      {!isEvaluationStarted && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleAction}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95 ${
              currentUserAgreed
                ? 'bg-background border border-border text-foreground hover:bg-muted'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {currentUserAgreed ? (
              <>
                <Undo2 className="w-3.5 h-3.5" />
                <span>Edit Syllabus</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSolo ? 'Confirm & Submit Syllabus' : 'Agree to Submit Syllabus'}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
