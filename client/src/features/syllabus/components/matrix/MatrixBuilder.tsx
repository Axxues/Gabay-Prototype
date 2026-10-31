import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { EvaluationMatrix, MatrixSection } from '../../types/lifecycle';

export interface MatrixBuilderProps {
  template: EvaluationMatrix;
  saving: boolean;
  onSave: (sections: MatrixSection[]) => void;
  onReset: () => void;
}

const cloneSections = (sections: MatrixSection[]): MatrixSection[] =>
  sections.map((s) => ({ ...s, criteria: s.criteria.map((c) => ({ ...c })) }));

const move = <T,>(items: T[], index: number, delta: number): T[] => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const iconBtn =
  'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';
const inputCls =
  'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

export const MatrixBuilder: React.FC<MatrixBuilderProps> = ({ template, saving, onSave, onReset }) => {
  const [sections, setSections] = useState<MatrixSection[]>(() => cloneSections(template.sections));
  const [confirmingReset, setConfirmingReset] = useState(false);
  const idCounter = useRef(0);

  useEffect(() => {
    setSections(cloneSections(template.sections));
    setConfirmingReset(false);
  }, [template]);

  const uniqueId = (prefix: string) => {
    const used = new Set(sections.flatMap((s) => [s.id, ...s.criteria.map((c) => c.id)]));
    let id: string;
    do {
      idCounter.current += 1;
      id = `${prefix}-${Date.now().toString(36)}-${idCounter.current}`;
    } while (used.has(id));
    return id;
  };

  const updateSection = (si: number, patch: (s: MatrixSection) => MatrixSection) =>
    setSections((prev) => prev.map((s, i) => (i === si ? patch(s) : s)));

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={section.id} className="p-4 bg-card border border-border rounded-2xl space-y-3">
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Section title"
              value={section.title}
              onChange={(e) => updateSection(si, (s) => ({ ...s, title: e.target.value }))}
              className={`${inputCls} font-bold`}
            />
            <button
              type="button"
              aria-label="Move section up"
              disabled={si === 0}
              onClick={() => setSections((prev) => move(prev, si, -1))}
              className={iconBtn}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Move section down"
              disabled={si === sections.length - 1}
              onClick={() => setSections((prev) => move(prev, si, 1))}
              className={iconBtn}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Remove section"
              onClick={() => setSections((prev) => prev.filter((_, i) => i !== si))}
              className={`${iconBtn} hover:text-red-600`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 pl-3">
            {section.criteria.map((criterion, ci) => (
              <div key={criterion.id} className="flex items-center gap-1.5">
                <input
                  aria-label="Criterion text"
                  value={criterion.text}
                  onChange={(e) =>
                    updateSection(si, (s) => ({
                      ...s,
                      criteria: s.criteria.map((c, i) => (i === ci ? { ...c, text: e.target.value } : c))
                    }))
                  }
                  className={inputCls}
                />
                <button
                  type="button"
                  aria-label="Move criterion up"
                  disabled={ci === 0}
                  onClick={() => updateSection(si, (s) => ({ ...s, criteria: move(s.criteria, ci, -1) }))}
                  className={iconBtn}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move criterion down"
                  disabled={ci === section.criteria.length - 1}
                  onClick={() => updateSection(si, (s) => ({ ...s, criteria: move(s.criteria, ci, 1) }))}
                  className={iconBtn}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove criterion"
                  onClick={() => updateSection(si, (s) => ({ ...s, criteria: s.criteria.filter((_, i) => i !== ci) }))}
                  className={`${iconBtn} hover:text-red-600`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              aria-label="Add criterion"
              onClick={() =>
                updateSection(si, (s) => ({ ...s, criteria: [...s.criteria, { id: uniqueId('crit'), text: '' }] }))
              }
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add criterion
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, { id: uniqueId('sec'), title: '', criteria: [] }])}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add section
        </button>

        <div className="flex items-center gap-2">
          {confirmingReset ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setConfirmingReset(false);
                  onReset();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmingReset(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground disabled:opacity-50 cursor-pointer"
            >
              Reset to Default
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(cloneSections(sections))}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
};
