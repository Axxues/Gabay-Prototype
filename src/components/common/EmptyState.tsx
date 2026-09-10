import React from 'react';
import { Inbox } from 'lucide-react';
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; body: string; actionLabel?: string; onAction?: () => void }> = ({ icon, title, body, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-subtle">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon ?? <Inbox className="h-6 w-6" />}</div>
    <h4 className="text-sm font-bold text-foreground">{title}</h4>
    <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
    {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-primary-sm hover:bg-primary/90 cursor-pointer">{actionLabel}</button>}
  </div>
);
