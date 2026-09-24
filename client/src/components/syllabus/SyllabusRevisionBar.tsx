import React from 'react';
import type { SyllabusRevisionHeader } from '../../types/syllabusApi';

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
      <div data-testid="syllabus-revision-bar" className="p-3 bg-card border border-border rounded-xl text-xs text-muted-foreground">
        No syllabus revision
      </div>
    );
  }
  const isPublished = revision.status === 'published';
  const isDraft = revision.status === 'draft';
  return (
    <div data-testid="syllabus-revision-bar" className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-xl">
      <span
        data-testid="revision-status"
        className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
          isDraft ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        {statusLabel(revision.status)}
      </span>
      <span data-testid="revision-number" className="text-xs font-semibold text-foreground">
        Revision {revision.revisionNo}
      </span>
      {isDirty && (
        <span data-testid="revision-dirty" className="text-[11px] font-semibold text-muted-foreground">
          Unsaved changes
        </span>
      )}
      {isPublished && (
        <span data-testid="revision-readonly" className="text-[11px] text-muted-foreground">
          Read-only — create a draft to edit
        </span>
      )}
      {canEdit && isPublished && (
        <button
          type="button"
          data-testid="revision-create-draft"
          onClick={onCreateDraft}
          className="px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Create draft
        </button>
      )}
      {canEdit && isDraft && (
        <button
          type="button"
          data-testid="revision-publish"
          onClick={onPublish}
          className="px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Publish
        </button>
      )}
    </div>
  );
};
