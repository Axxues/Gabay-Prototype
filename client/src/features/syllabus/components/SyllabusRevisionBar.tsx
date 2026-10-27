import React from 'react';
import { FileEdit, Globe, AlertCircle } from 'lucide-react';
import type { SyllabusRevisionHeader } from '../../../shared/types/syllabusApi';

export interface SyllabusRevisionBarProps {
  revision: SyllabusRevisionHeader | null;
  canEdit: boolean;
  isDirty: boolean;
  onCreateDraft: () => void;
  onPublish: () => void;
}

const statusLabel = (status: SyllabusRevisionHeader['status']): string => {
  if (status === 'draft') return 'Draft';
  if (status === 'published') return 'Published';
  return 'Archived';
};

export const SyllabusRevisionBar: React.FC<SyllabusRevisionBarProps> = ({
  revision,
  canEdit,
  isDirty,
  onCreateDraft,
  onPublish,
}) => {
  if (!revision) {
    return (
      <div
        data-testid="syllabus-revision-bar"
        className="p-3.5 bg-card border border-border rounded-2xl text-xs text-muted-foreground flex items-center gap-2"
      >
        <AlertCircle className="w-4 h-4 text-muted-foreground/70" />
        <span>No syllabus revision recorded</span>
      </div>
    );
  }

  const isPublished = revision.status === 'published';
  const isDraft = revision.status === 'draft';

  return (
    <div
      data-testid="syllabus-revision-bar"
      className={`relative overflow-hidden rounded-2xl border transition-all ${
        isDraft
          ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border-amber-500/25 shadow-subtle'
          : 'bg-card border-border/80 shadow-subtle'
      } p-4 sm:px-5 sm:py-3.5`}
    >
      {/* Accent strip on the left edge */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isDraft ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        aria-hidden="true"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pl-1">
        {/* Left: Metadata & Status Details */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="revision-status"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                isDraft
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDraft ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              {statusLabel(revision.status)}
            </span>

            <span
              data-testid="revision-number"
              className="text-xs font-bold text-foreground tracking-tight"
            >
              Revision {revision.revisionNo}
            </span>

            {isDirty && (
              <span
                data-testid="revision-dirty"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
              >
                <AlertCircle className="w-3 h-3" />
                <span>Unsaved changes</span>
              </span>
            )}

            {isPublished && (
              <span
                data-testid="revision-readonly"
                className="text-[11px] font-medium text-muted-foreground"
              >
                • Read-only
              </span>
            )}
          </div>

          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {isDraft
              ? 'Working draft — modifications are private to instructors until published.'
              : isPublished
              ? 'Official syllabus is active and visible to enrolled students.'
              : 'Archived syllabus revision.'}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          {canEdit && isDraft && (
            <button
              type="button"
              data-testid="revision-publish"
              onClick={onPublish}
              className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>
          )}

          {canEdit && isPublished && (
            <button
              type="button"
              data-testid="revision-create-draft"
              onClick={onCreateDraft}
              className="px-3.5 py-2 text-xs font-bold bg-card hover:bg-muted border border-border text-foreground rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <FileEdit className="w-3.5 h-3.5 text-primary" />
              <span>Create draft</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
