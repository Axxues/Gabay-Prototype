# Task 5 brief — Shared primitives + dialog frame

Single source of requirements. Implement exactly this. Four new files, no modifications.

**Files:**
- Create: `src/components/common/PageHeader.tsx`, `src/components/common/EmptyState.tsx`, `src/components/common/ListRow.tsx`, `src/components/common/DialogFrame.tsx`
- Test: `npm run typecheck` PASS (+ `npm run build` PASS for evidence)

**Interfaces (exact):**
- `PageHeader({title: string; description?: string; actions?: React.ReactNode})`
- `EmptyState({icon?: React.ReactNode; title: string; body: string; actionLabel?: string; onAction?: () => void})`
- `ListRow({left: React.ReactNode; meta?: string; right?: React.ReactNode; onClick?: () => void})`
- `DialogFrame({title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode})`

Exact code (verbatim per file):

```tsx
// PageHeader.tsx
import React from 'react';
export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h1>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
```

```tsx
// EmptyState.tsx
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
```

```tsx
// ListRow.tsx
import React from 'react';
export const ListRow: React.FC<{ left: React.ReactNode; meta?: string; right?: React.ReactNode; onClick?: () => void }> = ({ left, meta, right, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-soft hover:border-primary/40 cursor-pointer">
    <div className="min-w-0"><div className="truncate text-xs font-bold text-foreground">{left}</div>{meta && <div className="truncate text-[11px] text-muted-foreground">{meta}</div>}</div>
    {right && <div className="shrink-0">{right}</div>}
  </button>
);
```

```tsx
// DialogFrame.tsx
import React from 'react';
import { X } from 'lucide-react';
export const DialogFrame: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }> = ({ title, subtitle, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elevated" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-border p-5"><div><h2 className="text-sm font-extrabold text-foreground">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}</div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-5 custom-scrollbar">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
    </div>
  </div>
);
```

Steps:
- [ ] Step 1: confirm all four files absent.
- [ ] Step 2: baseline typecheck.
- [ ] Step 3: create all four verbatim. No other files.
- [ ] Step 4: typecheck PASS + build PASS.
- [ ] Step 5: `git add src/components/common/PageHeader.tsx src/components/common/EmptyState.tsx src/components/common/ListRow.tsx src/components/common/DialogFrame.tsx` + `git commit -m "feat: add shared page and dialog primitives"`.
