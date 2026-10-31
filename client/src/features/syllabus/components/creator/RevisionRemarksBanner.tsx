import React, { useState } from 'react';
import { AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import type { EvaluationMatrix, EvaluatorReview } from '../../types/lifecycle';
import { ConsolidatedMatrixModal } from '../matrix/ConsolidatedMatrixModal';

interface RevisionRemarksBannerProps {
  evaluators: EvaluatorReview[];
  matrixSnapshot?: EvaluationMatrix;
  courseCode?: string;
  instructorNames?: string[];
}

export const RevisionRemarksBanner: React.FC<RevisionRemarksBannerProps> = ({
  evaluators,
  matrixSnapshot,
  courseCode = '',
  instructorNames = []
}) => {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const rejectedReviews = evaluators.filter(
    e => e.status === 'revisions_requested' && Boolean(e.remarks)
  );

  if (rejectedReviews.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2.5 animate-fade-in">
      <div className="flex items-center gap-2 text-destructive font-bold text-xs">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>Mandatory Revisions Requested by Evaluation Committee</span>
      </div>

      <div className="space-y-2">
        {rejectedReviews.map((rev, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-card border border-destructive/20 text-xs space-y-1"
          >
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-destructive" />
                <span>{rev.evaluatorName}</span>
              </span>
              {rev.reviewedAt && (
                <span className="flex items-center gap-1 text-[10px]">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(rev.reviewedAt).toLocaleDateString()}</span>
                </span>
              )}
            </div>
            <p className="text-foreground text-xs leading-relaxed pl-4 border-l-2 border-destructive/40">
              {rev.remarks}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Please address all comments across the wizard steps. Once updated, all co-instructors must re-confirm agreement to resubmit for evaluation.
      </p>

      {matrixSnapshot && (
        <>
          <button
            type="button"
            onClick={() => setMatrixOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground cursor-pointer"
          >
            View Evaluation Matrix
          </button>
          <ConsolidatedMatrixModal
            isOpen={matrixOpen}
            courseCode={courseCode}
            instructorNames={instructorNames}
            snapshot={matrixSnapshot}
            evaluators={evaluators}
            onClose={() => setMatrixOpen(false)}
          />
        </>
      )}
    </div>
  );
};
