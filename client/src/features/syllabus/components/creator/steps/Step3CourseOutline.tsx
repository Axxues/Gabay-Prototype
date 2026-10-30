import React, { useEffect, useRef } from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { Plus, Trash2 } from 'lucide-react';
import { RequiredMark } from '../RequiredMark';
import { RichTextEditor } from '../../../../../shared/components/common';

interface Step3CourseOutlineProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

type OutlineEntry = { timeFrame: string; title: string; topics: string[] };

// Older builds seeded new rows with this template copy instead of leaving them
// blank, which left syllabi holding two "default" rows for one empty entry.
const TEMPLATE_TIME_FRAME = 'Weeks';
const TEMPLATE_TITLE = 'New Module Title';

const isLegacyTemplate = (row: Partial<OutlineEntry>): boolean =>
  row.timeFrame === TEMPLATE_TIME_FRAME && row.title === TEMPLATE_TITLE;

const isBlank = (row: Partial<OutlineEntry>): boolean => {
  if (isLegacyTemplate(row)) return true;
  const timeFrame = (row.timeFrame || '').trim();
  const title = (row.title || '').trim();
  const topics = (row.topics || []).filter(t => {
    if (!t) return false;
    const textOnly = t.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0;
  });
  return !timeFrame && !title && topics.length === 0;
};

/**
 * Keeps real entries, drops every empty/legacy-template row but one, and always
 * leaves at least one entry to fill in.
 */
export function normalizeOutline(rows: Array<Partial<OutlineEntry>> = []): OutlineEntry[] {
  const kept = rows
    .filter(row => !isBlank(row))
    .map(row => ({
      timeFrame: (row.timeFrame || '').trim(),
      title: (row.title || '').trim(),
      topics: (row.topics || []).filter(t => {
        if (!t) return false;
        const textOnly = t.replace(/<[^>]*>/g, '').trim();
        return textOnly.length > 0;
      })
    }));

  const hadBlankRow = rows.some(row => isBlank(row));
  if (hadBlankRow || kept.length === 0) {
    kept.push({ timeFrame: '', title: '', topics: [] });
  }
  return kept;
}

export const Step3CourseOutline: React.FC<Step3CourseOutlineProps> = ({ data, onChange }) => {
  const { courseOutline = [] } = data;
  const didNormalize = useRef(false);

  // One default entry, never two: applies on mount so a draft that still carries
  // the old seeded rows collapses to a single blank entry.
  useEffect(() => {
    if (didNormalize.current) return;
    didNormalize.current = true;

    const normalized = normalizeOutline(courseOutline);
    if (JSON.stringify(normalized) !== JSON.stringify(courseOutline)) {
      onChange({ ...data, courseOutline: normalized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateOutlineItem = (index: number, field: 'timeFrame' | 'title', value: string) => {
    const updated = courseOutline.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange({ ...data, courseOutline: updated });
  };

  const updateTopics = (index: number, htmlContent: string) => {
    const updated = courseOutline.map((item, i) => {
      if (i === index) {
        return { ...item, topics: [htmlContent] };
      }
      return item;
    });
    onChange({ ...data, courseOutline: updated });
  };

  const addOutlineEntry = () => {
    const newEntry = {
      timeFrame: '',
      title: '',
      topics: []
    };
    onChange({
      ...data,
      courseOutline: [...courseOutline, newEntry]
    });
  };

  const removeOutlineItem = (index: number) => {
    const updated = courseOutline.filter((_, i) => i !== index);
    onChange({ ...data, courseOutline: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addOutlineEntry}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Entry</span>
        </button>
      </div>

      <div className="space-y-3">
        {courseOutline.map((item, idx) => {
          const isExam = item.title.toUpperCase().includes('EXAMINATION') || item.timeFrame.toLowerCase().includes('exam');

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                isExam
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-1/4 min-w-[120px] space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                    <span>Time Frame</span>
                    <RequiredMark />
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                      Week:
                    </span>
                    <input
                      type="text"
                      value={item.timeFrame ?? ''}
                      onChange={e => {
                        const input = e.target.value;

                        // Only allow numbers, spaces, and hyphens
                        const validChars = /^[0-9\s-]*$/;
                        if (!validChars.test(input)) return;

                        // Split by hyphen to get individual numbers
                        const parts = input.split('-').map(p => p.trim());
                        const isValid = parts.every(part => {
                          if (part === '') return true; // Allow empty during typing
                          const num = parseInt(part, 10);
                          return !isNaN(num) && num >= 1 && num <= 99;
                        });

                        if (isValid) {
                          updateOutlineItem(idx, 'timeFrame', input);
                        }
                      }}
                      onKeyDown={e => {
                        // Allow navigation and deletion keys
                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                        if (allowedKeys.includes(e.key)) return;

                        // Only allow numbers, space, and hyphen
                        if (!/^[0-9-]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="1 or 1 - 4"
                      className="w-full pl-14 pr-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                    <span>Entry / Subject Matter Title</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={item.title ?? ''}
                    onChange={e => updateOutlineItem(idx, 'title', e.target.value)}
                    placeholder="e.g. Entry 1: Overview of Knowledge Management"
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                {courseOutline.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOutlineItem(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer mt-5"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isExam && (
                <div className="mt-3 space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                    <span>Subtopics</span>
                    <RequiredMark />
                  </label>
                  <RichTextEditor
                    content={(item.topics || [])[0] || ''}
                    onChange={(html: string) => updateTopics(idx, html)}
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
