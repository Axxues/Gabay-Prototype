import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleCardProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Optional subtitle rendered under the title inside the header. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Right-aligned slot inside the header; clicks here never toggle the card. */
  headerRight?: React.ReactNode;
  /** Spacing/padding applied to the content region; pass "" when children bring their own. */
  contentClassName?: string;
  defaultOpen?: boolean;
}

/** Fold animation duration in CollapsibleCard's wrapper (duration-300 + buffer). */
const UNMOUNT_DELAY_MS = 350;

/**
 * Major card used across the Syllabus Studio steps. The header row is the
 * toggle. Collapsed content unmounts once the fold animation ends so giant
 * hidden subtrees (Grading System, Rubrics, ...) stop costing reconciliation
 * and layout on every keystroke; all form state lives above this component,
 * so remounting on expand is lossless.
 */
export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  icon,
  title,
  description,
  children,
  headerRight,
  contentClassName = 'px-4 pb-4 space-y-4',
  defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  // Keep children mounted while the fold animation plays, then drop them.
  const [renderContent, setRenderContent] = useState(defaultOpen);

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setRenderContent(false), UNMOUNT_DELAY_MS);
    return () => clearTimeout(t);
  }, [open]);

  const toggle = () => {
    if (!open) setRenderContent(true); // mount in the same commit as the 0fr -> 1fr change
    setOpen(o => !o);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div
        onClick={toggle}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer select-none hover:bg-muted/40 transition-colors"
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={typeof title === 'string' ? title : undefined}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          className="flex-1 min-w-0"
        >
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
              {icon}
              <span>{title}</span>
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {headerRight}
          <div
            onClick={toggle}
            className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out overflow-hidden ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className={`px-4 pb-4 ${contentClassName}`}>{renderContent ? children : null}</div>
        </div>
      </div>
    </div>
  );
};
