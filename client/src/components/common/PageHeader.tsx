import React from 'react';
export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h1>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
