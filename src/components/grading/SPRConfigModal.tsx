import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { DialogFrame } from '../common/DialogFrame';
import type { SPRColumn } from '../../types/lms';

interface SPRConfigModalProps {
  courseId: string;
  onClose: () => void;
}

type Term = 'midterm' | 'final';

const linkKey = (col: SPRColumn): string | null =>
  col.linkedSource ? `${col.linkedSource.kind}:${col.linkedSource.sourceId}` : null;

const cloneColumn = (col: SPRColumn): SPRColumn => ({
  ...col,
  linkedSource: col.linkedSource ? { ...col.linkedSource } : undefined,
});

export const SPRConfigModal: React.FC<SPRConfigModalProps> = ({ courseId, onClose }) => {
  const { db, getSPRConfig, saveSPRConfig, bulkImportSPRColumns, showAlert } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const existing = getSPRConfig(courseId);

  const [midtermColumns, setMidtermColumns] = useState<SPRColumn[]>(() =>
    (existing?.midtermColumns ?? []).map(cloneColumn)
  );
  const [finalColumns, setFinalColumns] = useState<SPRColumn[]>(() =>
    (existing?.finalColumns ?? []).map(cloneColumn)
  );
  const [mtExamPerfect, setMtExamPerfect] = useState<number>(() => existing?.mtExamPerfect ?? 60);
  const [ftExamPerfect, setFtExamPerfect] = useState<number>(() => existing?.ftExamPerfect ?? 60);
  const [isSaving, setIsSaving] = useState(false);

  const assignments = db.assignments.filter(a => a.courseId === courseId);
  const activities = (db.activities ?? []).filter(a => a.courseId === courseId);
  const quizzes = db.quizzes.filter(q => q.courseId === courseId);

  const setColumns = (term: Term) => (term === 'midterm' ? setMidtermColumns : setFinalColumns);

  const addColumn = (term: Term) => {
    setColumns(term)(prev => [
      ...prev,
      { id: crypto.randomUUID(), title: '', perfectScore: 100 },
    ]);
  };

  const removeColumn = (term: Term, id: string) => {
    setColumns(term)(prev => prev.filter(c => c.id !== id));
  };

  const updateColumn = (term: Term, id: string, patch: Partial<SPRColumn>) => {
    setColumns(term)(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const onSourceChange = (term: Term, id: string, value: string) => {
    if (value === '') {
      updateColumn(term, id, { linkedSource: undefined });
      return;
    }
    const sep = value.indexOf(':');
    const kind = value.slice(0, sep);
    const sourceId = value.slice(sep + 1);
    if (kind === 'assignment' || kind === 'activity' || kind === 'quiz') {
      updateColumn(term, id, { linkedSource: { kind, sourceId } });
    }
  };

  const onBulkImport = async (term: Term) => {
    await bulkImportSPRColumns(courseId, term);
    const refreshed = getSPRConfig(courseId);
    if (term === 'midterm') {
      setMidtermColumns((refreshed?.midtermColumns ?? []).map(cloneColumn));
    } else {
      setFinalColumns((refreshed?.finalColumns ?? []).map(cloneColumn));
    }
  };

  const validate = (): boolean => {
    const all = [...midtermColumns, ...finalColumns];
    if (all.some(c => c.title.trim() === '')) {
      showAlert({ title: 'Invalid columns', message: 'Every column needs a title.', type: 'warning' });
      return false;
    }
    const badPerfect =
      all.some(c => typeof c.perfectScore !== 'number' || Number.isNaN(c.perfectScore) || c.perfectScore <= 0) ||
      !(mtExamPerfect > 0) ||
      !(ftExamPerfect > 0);
    if (badPerfect) {
      showAlert({ title: 'Invalid columns', message: 'Perfect scores must be greater than 0.', type: 'warning' });
      return false;
    }
    for (const list of [midtermColumns, finalColumns]) {
      const seen = new Set<string>();
      for (const col of list) {
        const key = linkKey(col);
        if (!key) continue;
        if (seen.has(key)) {
          showAlert({
            title: 'Invalid columns',
            message: 'The same activity/quiz is linked twice in one term.',
            type: 'warning',
          });
          return false;
        }
        seen.add(key);
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await saveSPRConfig(courseId, { midtermColumns, finalColumns, mtExamPerfect, ftExamPerfect });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const renderTermSection = (term: Term, columns: SPRColumn[], label: string) => (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-foreground">{label}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void onBulkImport(term);
            }}
            className="px-3 py-1.5 text-[11px] font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all shadow-subtle cursor-pointer"
          >
            Import all Activities/Quizzes
          </button>
          <button
            type="button"
            onClick={() => addColumn(term)}
            className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-subtle cursor-pointer"
          >
            Add column
          </button>
        </div>
      </div>

      {columns.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No columns yet. Add one manually or bulk-import.</p>
      ) : (
        <div className="space-y-2">
          {columns.map(col => (
            <div key={col.id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="text"
                value={col.title}
                onChange={e => updateColumn(term, col.id, { title: e.target.value })}
                placeholder="Column title"
                className="flex-1 min-w-0 px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground shadow-subtle focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(col.perfectScore) ? '' : col.perfectScore}
                onChange={e =>
                  updateColumn(term, col.id, {
                    perfectScore: e.target.value === '' ? Number.NaN : Number(e.target.value),
                  })
                }
                placeholder="Perfect"
                className="w-full sm:w-24 px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground text-center shadow-subtle focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={linkKey(col) ?? ''}
                onChange={e => onSourceChange(term, col.id, e.target.value)}
                className="flex-1 min-w-0 px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground shadow-subtle focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Manual (no link)</option>
                {assignments.map(a => (
                  <option key={`assignment:${a.id}`} value={`assignment:${a.id}`}>
                    Assignment: {a.title} ({a.pointsPossible} pts)
                  </option>
                ))}
                {activities.map(a => (
                  <option key={`activity:${a.id}`} value={`activity:${a.id}`}>
                    Activity: {a.title}
                  </option>
                ))}
                {quizzes.map(q => (
                  <option key={`quiz:${q.id}`} value={`quiz:${q.id}`}>
                    Quiz: {q.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeColumn(term, col.id)}
                title="Remove column"
                className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl border border-border text-muted-foreground hover:text-rose-600 hover:border-rose-500/40 transition-all cursor-pointer shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <DialogFrame
      title="Configure SPR columns"
      subtitle={course ? `${course.code}${course.section ? ` (${course.section})` : ''}` : undefined}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onSave();
            }}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-subtle transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {renderTermSection('midterm', midtermColumns, 'Midterm columns')}
        {renderTermSection('final', finalColumns, 'Final columns')}

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold text-foreground">Exam perfect scores</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground">Midterm exam perfect</span>
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(mtExamPerfect) ? '' : mtExamPerfect}
                onChange={e => setMtExamPerfect(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground text-center shadow-subtle focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground">Final exam perfect</span>
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(ftExamPerfect) ? '' : ftExamPerfect}
                onChange={e => setFtExamPerfect(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground text-center shadow-subtle focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
        </section>
      </div>
    </DialogFrame>
  );
};
