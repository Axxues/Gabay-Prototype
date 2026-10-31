import React from 'react';
import { Award } from 'lucide-react';
import type { RubricCriterion, RubricRating } from '../../../shared/types/lms';

export interface RubricViewerProps {
  rubric?: RubricCriterion[] | null;
  title?: string;
  className?: string;
}

export const RubricViewer: React.FC<RubricViewerProps> = ({
  rubric,
  title = 'Rubric Criteria',
  className = '',
}) => {
  if (!Array.isArray(rubric) || rubric.length === 0) {
    return null;
  }

  const totalPoints = rubric.reduce((sum, c) => sum + (Number(c.points) || 0), 0);

  return (
    <div className={`pt-4 border-t border-border space-y-3 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Award className="w-4 h-4 text-primary" />
          <span>{title}</span>
        </h3>
        <span className="text-[12px] font-semibold text-muted-foreground">
          {rubric.length} {rubric.length === 1 ? 'criterion' : 'criteria'} · {totalPoints} total pts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rubric.map((criterion, idx) => {
          const effectiveRatings: RubricRating[] =
            Array.isArray(criterion.ratings) && criterion.ratings.length > 0
              ? criterion.ratings
              : [
                  { points: Number(criterion.points) || 10, description: 'Exemplary Mastery' },
                  { points: 0, description: 'Needs Revision' },
                ];

          return (
            <div
              key={criterion.id || `crit-${idx}`}
              className="p-4 bg-muted/20 rounded-xl border border-border/70 space-y-3 transition-colors hover:border-border"
            >
              <div className="flex justify-between items-baseline gap-3 flex-wrap">
                <span className="font-bold text-[13px] tracking-tight text-foreground">
                  {criterion.title || `Criterion ${idx + 1}`}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-primary shrink-0">
                  {criterion.points} pts
                </span>
              </div>

              {criterion.description && (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {criterion.description}
                </p>
              )}

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Rating Scale ({effectiveRatings.length} levels)
                </div>
                <div
                  className={`grid gap-2 ${
                    effectiveRatings.length <= 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : effectiveRatings.length === 3
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  }`}
                >
                  {effectiveRatings.map((r, rIdx) => (
                    <div
                      key={rIdx}
                      className="p-3 bg-card border border-border/60 rounded-xl flex flex-col justify-between space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Level {rIdx + 1}
                        </span>
                        <span className="text-[12px] font-black tabular-nums text-foreground bg-accent/40 px-2 py-0.5 rounded-md">
                          {r.points} pts
                        </span>
                      </div>
                      <div className="text-[12px] leading-snug text-foreground/90 font-medium">
                        {r.description || 'No description provided'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
