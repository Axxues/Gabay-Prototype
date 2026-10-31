import React, { useRef, useState } from 'react';
import { AnimatedModal } from '../../../../shared/components/common/ModalPortal';
import { CheckCircle2, AlertTriangle, ShieldCheck, MessageSquare } from 'lucide-react';
import { MatrixChecklistTable } from '../matrix/MatrixChecklistTable';
import type { EvaluationMatrix, EvaluatorMatrixResponse } from '../../types/lifecycle';

interface EvaluatorReviewModalProps {
  isOpen: boolean;
  groupId: string;
  courseCode: string;
  snapshot: EvaluationMatrix | null;
  onClose: () => void;
  onReview: (
    groupId: string,
    status: 'approved' | 'revisions_requested',
    remarks: string | undefined,
    matrix: { matrixResponses: EvaluatorMatrixResponse[]; overallComments?: string; matrixVersion?: number }
  ) => void;
}

export const EvaluatorReviewModal: React.FC<EvaluatorReviewModalProps> = ({
  isOpen,
  groupId,
  courseCode,
  snapshot,
  onClose,
  onReview
}) => {
  const [remarks, setRemarks] = useState('');
  const [overallComments, setOverallComments] = useState('');
  const [responses, setResponses] = useState<Record<string, EvaluatorMatrixResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  if (!isOpen) return null;

  const criteria = snapshot?.sections.flatMap(s => s.criteria) ?? [];
  const getResponse = (id: string): EvaluatorMatrixResponse =>
    responses[id] ?? { criterionId: id, compliant: false, comment: '' };
  const hasComment = (r: EvaluatorMatrixResponse) => Boolean(r.comment?.trim());

  const allCompliant = criteria.every(c => {
    const r = getResponse(c.id);
    return r.compliant && !hasComment(r);
  });
  const hasUncommentedNo = criteria.some(c => {
    const r = getResponse(c.id);
    return !r.compliant && !hasComment(r);
  });

  const buildMatrix = () => ({
    matrixResponses: criteria.map(c => {
      const r = getResponse(c.id);
      return {
        criterionId: c.id,
        compliant: r.compliant && !hasComment(r),
        comment: r.comment?.trim() || undefined
      };
    }),
    overallComments: overallComments.trim() || undefined,
    matrixVersion: snapshot?.version
  });

  const submit = (status: 'approved' | 'revisions_requested', finalRemarks?: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    onReview(groupId, status, finalRemarks, snapshot ? buildMatrix() : { matrixResponses: [] });
    onClose();
  };

  const handleApprove = () => {
    if (snapshot && !allCompliant) return;
    submit('approved');
  };

  const handleRequestRevisions = () => {
    if (!remarks.trim()) {
      setError('Please enter revision remarks explaining the required changes.');
      return;
    }
    if (snapshot && hasUncommentedNo) {
      setError('Please add a comment to every non-compliant criterion before submitting.');
      return;
    }
    submit('revisions_requested', remarks.trim());
  };

  const handleCriterionChange = (id: string, patch: { compliant?: boolean; comment?: string }) => {
    setResponses(prev => ({ ...prev, [id]: { ...getResponse(id), ...patch, criterionId: id } }));
    if (error) setError(null);
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div
        className={`p-6 space-y-5 w-full bg-card text-foreground ${
          snapshot ? 'max-w-4xl max-h-[85vh] overflow-y-auto' : 'max-w-lg'
        }`}
      >
        {/* Header */}
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Academic Syllabus Evaluation</span>
          </div>
          <h2 className="text-xl font-black text-foreground">
            Evaluate Syllabus: {courseCode}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit your evaluation findings. You may endorse this syllabus for Chairperson review or request mandatory revisions from the assigned instructors.
          </p>
        </div>

        {snapshot && (
          <MatrixChecklistTable
            sections={snapshot.sections}
            mode="fill"
            responses={responses}
            onCriterionChange={handleCriterionChange}
            overallComments={overallComments}
            onOverallCommentsChange={setOverallComments}
          />
        )}

        {/* Remarks Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Revision Feedback / Evaluator Notes</span>
          </label>
          <textarea
            value={remarks}
            onChange={e => {
              setRemarks(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Specify required revisions, learning outcome alignment adjustments, or quality suggestions..."
            rows={4}
            className="w-full p-3 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
          {error && (
            <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestRevisions}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Request Revisions</span>
            </button>

            <button
              onClick={handleApprove}
              disabled={Boolean(snapshot) && !allCompliant}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve Syllabus</span>
            </button>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
};
