import React from 'react';
import type { TermId } from '../../utils/gradingTerms';

export const TERM_LABELS: Record<TermId, string> = { prelim: 'Prelim', midterm: 'Midterm', finals: 'Finals' };

export const TermSelect: React.FC<{ terms: TermId[]; value: TermId; onChange: (t: TermId) => void; id?: string }> = ({ terms, value, onChange, id = 'term-select' }) => (
  <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
    <label htmlFor={id} className="text-[12px] font-semibold text-muted-foreground select-none">Term:</label>
    <select id={id} value={value} onChange={e => { const t = e.target.value as TermId; if (terms.includes(t)) onChange(t); }}
      className="px-2 py-1 bg-background border border-border rounded-xl text-[12.5px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer">
      {terms.map(t => <option key={t} value={t}>{TERM_LABELS[t]}</option>)}
    </select>
  </div>
);
