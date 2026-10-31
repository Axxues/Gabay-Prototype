import React from 'react';
import type { MatrixSection, MatrixCriterion, EvaluatorMatrixResponse } from '../../types/lifecycle';

interface MatrixChecklistTableProps {
  sections: MatrixSection[];
  mode: 'fill' | 'readonly';
  responses?: Record<string, EvaluatorMatrixResponse>;
  onCriterionChange?: (criterionId: string, patch: { compliant?: boolean; comment?: string }) => void;
  overallComments?: string;
  onOverallCommentsChange?: (comments: string) => void;
}

function CriterionRow({
  criterion,
  mode,
  response,
  onChange
}: {
  criterion: MatrixCriterion;
  mode: 'fill' | 'readonly';
  response?: EvaluatorMatrixResponse;
  onChange?: (patch: { compliant?: boolean; comment?: string }) => void;
}) {
  const compliant = response?.compliant ?? false;
  const comment = response?.comment ?? '';

  if (mode === 'readonly') {
    const displayCompliant = response === undefined ? '—' : (response.compliant ? 'Y' : 'N');
    return (
      <tr className="border-b border-border/50 hover:bg-muted/30">
        <td className="p-3 text-xs text-foreground">{criterion.text}</td>
        <td className="p-3 text-center text-xs font-medium">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
            response === undefined ? 'bg-muted text-muted-foreground' :
            response.compliant ? 'bg-emerald-100 text-emerald-700' : 'bg-destructive/10 text-destructive'
          }`}>
            {displayCompliant}
          </span>
        </td>
        <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
          {comment || '—'}
        </td>
      </tr>
    );
  }

  // Fill mode
  const handleCompliantChange = (newCompliant: boolean) => {
    if (!onChange) return;
    // If user tries to set Y but there's a comment, force N
    if (newCompliant && comment.trim()) {
      onChange({ compliant: false, comment });
      return;
    }
    onChange({ compliant: newCompliant, comment });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newComment = e.target.value;
    if (!onChange) return;
    // Comment forces N
    onChange({ compliant: false, comment: newComment });
  };

  const hasComment = comment.trim().length > 0;
  const isCompliantDisabled = hasComment; // Y disabled when comment exists
  const showCommentRequiredHint = !compliant && !hasComment;

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30">
      <td className="p-3 text-xs text-foreground">{criterion.text}</td>
      <td className="p-3 text-center space-x-2">
        <button
          type="button"
          onClick={() => handleCompliantChange(true)}
          disabled={isCompliantDisabled || (onChange && hasComment)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            compliant && !hasComment
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              : 'bg-muted text-muted-foreground border border-border hover:bg-muted/50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Y
        </button>
        <button
          type="button"
          onClick={() => handleCompliantChange(false)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            !compliant || hasComment
              ? 'bg-destructive/10 text-destructive border border-destructive/30'
              : 'bg-muted text-muted-foreground border border-border hover:bg-muted/50'
          }`}
        >
          N
        </button>
      </td>
      <td className="p-3">
        <textarea
          value={comment}
          onChange={handleCommentChange}
          placeholder={hasComment ? '' : 'Required for N...'}
          rows={2}
          className="w-full p-2 text-[11px] bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          style={{ minHeight: '44px' }}
        />
        {showCommentRequiredHint && (
          <p className="mt-1 text-[10px] text-destructive/80">Comment required for non-compliant criteria</p>
        )}
      </td>
    </tr>
  );
}

function SectionBlock({
  section,
  mode,
  responses,
  onCriterionChange
}: {
  section: MatrixSection;
  mode: 'fill' | 'readonly';
  responses?: Record<string, EvaluatorMatrixResponse>;
  onCriterionChange?: (criterionId: string, patch: { compliant?: boolean; comment?: string }) => void;
}) {
  return (
    <tbody>
      <tr className="bg-muted/50">
        <th colSpan={3} className="p-3 text-left text-xs font-bold text-primary uppercase tracking-wider border-b border-border">
          {section.title}
        </th>
      </tr>
      {section.criteria.map((criterion: MatrixCriterion) => (
        <CriterionRow
          key={criterion.id}
          criterion={criterion}
          mode={mode}
          response={responses?.[criterion.id]}
          onChange={onCriterionChange ? (patch) => onCriterionChange(criterion.id, patch) : undefined}
        />
      ))}
    </tbody>
  );
}

export function MatrixChecklistTable({
  sections,
  mode,
  responses = {},
  onCriterionChange,
  overallComments = '',
  onOverallCommentsChange
}: MatrixChecklistTableProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-xl overflow-hidden bg-card">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <th className="p-3 w-3/5">CRITERIA</th>
              <th className="p-3 w-1/5 text-center">Compliant</th>
              <th className="p-3 w-1/5">COMMENTS</th>
            </tr>
          </thead>
          {sections.map(section => (
            <SectionBlock
              key={section.id}
              section={section}
              mode={mode}
              responses={responses}
              onCriterionChange={onCriterionChange}
            />
          ))}
        </table>
      </div>

      {mode === 'fill' && (
        <div className="space-y-2 p-4 bg-muted/30 border border-border rounded-xl">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <span>Comments and Suggestions</span>
          </label>
          <textarea
            value={overallComments}
            onChange={(e) => onOverallCommentsChange?.(e.target.value)}
            placeholder="Overall evaluator comments and suggestions..."
            rows={3}
            className="w-full p-3 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      )}

      {mode === 'readonly' && overallComments && (
        <div className="space-y-2 p-4 bg-muted/30 border border-border rounded-xl">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <span>Comments and Suggestions</span>
          </label>
          <div className="p-3 text-xs text-foreground whitespace-pre-wrap bg-card border border-border rounded-lg">
            {overallComments}
          </div>
        </div>
      )}
    </div>
  );
}