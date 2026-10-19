import React, { useState, useEffect } from 'react';
import type { Course } from '../../types/lms';
import { DialogFrame } from './DialogFrame';
import {
  Megaphone,
  Layers,
  CheckSquare,
  Award,
  BookOpen,
  FileText,
  Copy,
  Users,
  Check,
  Loader2
} from 'lucide-react';

export type CrossSectionItemType = 'syllabus' | 'module' | 'module_item' | 'announcement' | 'assessment' | 'file';

export interface CrossSectionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: CrossSectionItemType;
  itemTitle: string;
  siblingCourses: Course[];
  onConfirm: (selectedCourseIds: string[]) => Promise<void>;
  onSkipToCurrentOnly: () => Promise<void>;
  isSubmitting?: boolean;
}

const ITEM_TYPE_META: Record<CrossSectionItemType, { label: string; icon: React.FC<{ className?: string }> }> = {
  announcement: { label: 'Announcement', icon: Megaphone },
  module: { label: 'Learning Module', icon: Layers },
  module_item: { label: 'Module Item', icon: CheckSquare },
  assessment: { label: 'Assessment', icon: Award },
  syllabus: { label: 'Official Syllabus', icon: BookOpen },
  file: { label: 'Course File', icon: FileText }
};

export const CrossSectionPromptModal: React.FC<CrossSectionPromptModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemTitle,
  siblingCourses,
  onConfirm,
  onSkipToCurrentOnly,
  isSubmitting = false
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  // Initialize all sibling courses as selected when modal opens
  useEffect(() => {
    if (isOpen && siblingCourses.length > 0) {
      setSelectedIds(siblingCourses.map(c => c.id));
    }
  }, [isOpen, siblingCourses]);

  if (!isOpen || siblingCourses.length === 0) return null;

  const meta = ITEM_TYPE_META[itemType] || { label: 'Content Item', icon: Copy };
  const IconComponent = meta.icon;
  const busy = isSubmitting || localSubmitting;

  const handleToggle = (courseId: string) => {
    setSelectedIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === siblingCourses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(siblingCourses.map(c => c.id));
    }
  };

  const handleConfirm = async () => {
    if (busy) return;
    setLocalSubmitting(true);
    try {
      await onConfirm(selectedIds);
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (busy) return;
    setLocalSubmitting(true);
    try {
      await onSkipToCurrentOnly();
    } finally {
      setLocalSubmitting(false);
    }
  };

  const sampleCourse = siblingCourses[0];
  const courseCode = sampleCourse?.code || 'Course';
  const schoolYear = sampleCourse?.schoolYear || '';
  const semester = sampleCourse?.semester || sampleCourse?.term || '';

  return (
    <DialogFrame
      title={`Replicate ${meta.label} Across Sections?`}
      subtitle={`You teach other sections of ${courseCode}${semester ? ` (${semester})` : ''}${schoolYear ? ` — AY ${schoolYear}` : ''}.`}
      onClose={busy ? () => {} : onClose}
      wide
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              Publish to Current Section Only
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || selectedIds.length === 0}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Publish to Selected Sections ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Item preview badge */}
        <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {meta.label} to Replicate
            </div>
            <div className="text-xs font-bold text-foreground truncate mt-0.5">
              {itemTitle || 'Untitled Item'}
            </div>
          </div>
        </div>

        {/* Section selection header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-foreground">
            Select Target Sibling Sections:
          </span>
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={busy}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
          >
            {selectedIds.length === siblingCourses.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* List of sibling courses */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          {siblingCourses.map(c => {
            const isChecked = selectedIds.includes(c.id);
            return (
              <label
                key={c.id}
                htmlFor={`sibling-section-${c.id}`}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'border-primary/50 bg-primary/5 shadow-xs'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    id={`sibling-section-${c.id}`}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(c.id)}
                    disabled={busy}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>{c.section || 'Unspecified Section'}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        ({c.code})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {c.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                  <Users className="w-3 h-3" />
                  <span>{c.enrolledCount ?? 0} students</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </DialogFrame>
  );
};
