import React, { useMemo, useState } from 'react';
import { AnimatedModal } from '../../../../shared/components/common/ModalPortal';
import { MatrixChecklistTable } from './MatrixChecklistTable';
import { summarizeMatrix } from '../../utils/matrixSummary';
import type { ConsolidatedComment } from '../../utils/matrixSummary';
import type { EvaluationMatrix, EvaluatorMatrixResponse, EvaluatorReview } from '../../types/lifecycle';

export interface ConsolidatedMatrixModalProps {
  isOpen: boolean;
  courseCode: string;
  instructorNames: string[];
  snapshot: EvaluationMatrix;
  evaluators: EvaluatorReview[];
  onClose: () => void;
}

const CONSOLIDATED = 'consolidated';

const formatComments = (comments: ConsolidatedComment[]) =>
  comments.map((c) => `${c.evaluatorName}: ${c.comment}`).join('\n');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const ConsolidatedMatrixModal: React.FC<ConsolidatedMatrixModalProps> = ({
  isOpen,
  courseCode,
  instructorNames,
  snapshot,
  evaluators,
  onClose
}) => {
  const [view, setView] = useState<string>(CONSOLIDATED);

  const summary = useMemo(() => summarizeMatrix(snapshot, evaluators), [snapshot, evaluators]);
  const submitted = useMemo(
    () => evaluators.filter((e) => e.status !== 'pending' && (e.matrixResponses?.length ?? 0) > 0),
    [evaluators]
  );

  if (!isOpen) return null;

  const selected = submitted.find((e) => e.evaluatorId === view);

  const responses: Record<string, EvaluatorMatrixResponse> = {};
  let overallComments = '';
  if (selected) {
    (selected.matrixResponses ?? []).forEach((r) => {
      responses[r.criterionId] = r;
    });
    overallComments = selected.overallComments ?? '';
  } else {
    summary.sections.forEach((section) =>
      section.rows.forEach((row) => {
        if (row.compliant === null) return;
        responses[row.criterionId] = {
          criterionId: row.criterionId,
          compliant: row.compliant,
          comment: formatComments(row.comments)
        };
      })
    );
    overallComments = formatComments(summary.overallComments);
  }

  const latestReviewedAt = submitted
    .map((e) => e.reviewedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/50'
    }`;

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-card text-foreground">
        <div>
          <h2 className="text-xl font-black text-foreground">Evaluation Matrix: {courseCode}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instructors: {instructorNames.join(', ') || '—'}
            {latestReviewedAt && <> · Last reviewed {formatDate(latestReviewedAt)}</>}
            {' · '}
            {summary.submittedCount}/{summary.totalCount} evaluators submitted
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setView(CONSOLIDATED)} className={tabClass(!selected)}>
            Consolidated
          </button>
          {submitted.map((e) => (
            <button
              key={e.evaluatorId}
              type="button"
              onClick={() => setView(e.evaluatorId)}
              className={tabClass(selected?.evaluatorId === e.evaluatorId)}
            >
              {e.evaluatorName}
            </button>
          ))}
        </div>

        <MatrixChecklistTable
          sections={snapshot.sections}
          mode="readonly"
          responses={responses}
          overallComments={overallComments}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-muted text-foreground border border-border hover:bg-muted/50"
          >
            Close
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};
