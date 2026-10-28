import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface Step3CourseOutlineProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step3CourseOutline: React.FC<Step3CourseOutlineProps> = ({ data, onChange }) => {
  const { courseOutline = [] } = data;

  const updateOutlineItem = (index: number, field: 'timeFrame' | 'title', value: string) => {
    const updated = courseOutline.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange({ ...data, courseOutline: updated });
  };

  const updateTopics = (index: number, rawText: string) => {
    const topics = rawText.split('\n').filter(Boolean);
    const updated = courseOutline.map((item, i) => {
      if (i === index) {
        return { ...item, topics };
      }
      return item;
    });
    onChange({ ...data, courseOutline: updated });
  };

  const addOutlineModule = () => {
    const newModule = {
      timeFrame: 'Weeks',
      title: 'New Module Title',
      topics: ['Topic overview', 'Key concepts and discussions']
    };
    onChange({
      ...data,
      courseOutline: [...courseOutline, newModule]
    });
  };

  const removeOutlineItem = (index: number) => {
    const updated = courseOutline.filter((_, i) => i !== index);
    onChange({ ...data, courseOutline: updated });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>Course Outline & Time Frame</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Organize modules, subject matter, and examination milestones across the 18-week semester.
          </p>
        </div>
        <button
          type="button"
          onClick={addOutlineModule}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Module</span>
        </button>
      </div>

      <div className="space-y-4">
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
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Time Frame
                  </label>
                  <input
                    type="text"
                    value={item.timeFrame}
                    onChange={e => updateOutlineItem(idx, 'timeFrame', e.target.value)}
                    placeholder="e.g. Week 1 - 4"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Module / Subject Matter Title
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => updateOutlineItem(idx, 'title', e.target.value)}
                    placeholder="e.g. Module 1: Overview of Knowledge Management"
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                {courseOutline.length > 2 && (
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
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Subtopics (one topic per line)
                  </label>
                  <textarea
                    rows={3}
                    value={(item.topics || []).join('\n')}
                    onChange={e => updateTopics(idx, e.target.value)}
                    placeholder="Introduction to concepts&#10;Key principles and frameworks&#10;Case studies and application"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none leading-relaxed"
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
