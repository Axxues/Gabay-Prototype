import React, { useState, useRef } from 'react';
import { useLMS } from '../../context/LMSContext';
import { uploadFileToPublic } from '../../utils/fileUploader';
import {
  Calendar,
  Upload,
  FileText,
  Clock,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { FilePickerModal } from '../common/FilePickerModal';
import { UploadProgress } from '../common/UploadProgress';
import { useSimulatedUpload } from '../../hooks/useSimulatedUpload';
import type { AggregatedCourseFile } from '../../hooks/useCourseFiles';
import type { Activity } from '../../types/lms';

export interface ActivityAttachment {
  name: string;
  size: string;
  url: string;
}

export interface ActivityFormValue {
  title: string;
  instructions: string;
  pointsPossible: number;
  dueDate: string;
  availableFrom: string;
  availableUntil: string;
  allowFileUpload: boolean;
  allowOnlineText: boolean;
  attachedFile: ActivityAttachment | null;
}

export function emptyActivityFormValue(): ActivityFormValue {
  const due = new Date(Date.now() + 7 * 86400000);
  due.setHours(23, 59, 0, 0);
  return {
    title: '',
    instructions: '',
    pointsPossible: 100,
    dueDate: due.toISOString().slice(0, 16),
    availableFrom: new Date().toISOString().slice(0, 16),
    availableUntil: '',
    allowFileUpload: true,
    allowOnlineText: true,
    attachedFile: null
  };
}

export function validateActivityForm(v: ActivityFormValue): { title: string; message: string } | null {
  if (!v.title.trim()) {
    return { title: 'Missing Title', message: 'Please provide an activity title before saving.' };
  }
  if (!v.allowFileUpload && !v.allowOnlineText) {
    return { title: 'Submission Type Required', message: 'Please select at least one submission type (File Upload or Online Text Entry).' };
  }
  return null;
}

export function buildActivityPayload(courseId: string, v: ActivityFormValue, publish: boolean): Partial<Activity> {
  const submissionTypes: ('file' | 'online_text')[] = [];
  if (v.allowFileUpload) submissionTypes.push('file');
  if (v.allowOnlineText) submissionTypes.push('online_text');

  return {
    courseId,
    format: 'classic',
    title: v.title.trim(),
    instructions: v.instructions.trim() || 'Complete the activity guidelines aligned with course syllabus objectives.',
    category: 'Activities',
    pointsPossible: Number(v.pointsPossible) || 100,
    weight: 30,
    dueDate: v.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    availableFrom: v.availableFrom || undefined,
    availableUntil: v.availableUntil || undefined,
    submissionTypes,
    published: publish,
    sectionRestriction: 'All Sections',
    fileName: v.attachedFile?.name,
    fileUrl: v.attachedFile?.url,
    fileSize: v.attachedFile?.size
  };
}

export const ActivityFormFields: React.FC<{
  courseId: string;
  value: ActivityFormValue;
  onChange: (v: ActivityFormValue) => void;
}> = ({ courseId, value, onChange }) => {
  const { showAlert } = useLMS();
  const [isDragging, setIsDragging] = useState(false);
  const upload = useSimulatedUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        message: 'Please attach a document or archive smaller than 50MB.',
        type: 'warning'
      });
      return;
    }

    if (upload.isUploading) return;
    upload.start(file.name);
    try {
      const result = await uploadFileToPublic(file);
      onChange({
        ...value,
        attachedFile: {
          name: result.name,
          size: result.size,
          url: result.url
        }
      });
      upload.complete();
      showAlert({
        title: 'File Attached',
        message: `"${file.name}" has been attached and saved to /public/uploads/.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to attach assignment file:', err);
      upload.fail();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (upload.isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSelectExistingFile = (file: AggregatedCourseFile) => {
    onChange({
      ...value,
      attachedFile: {
        name: file.name,
        size: file.formattedSize || '',
        url: file.url || file.fileUrl || `/public/uploads/${file.name}`
      }
    });
    setIsFilePickerOpen(false);
    showAlert({
      title: 'File Attached',
      message: `"${file.name}" has been attached from your uploaded course files.`,
      type: 'success'
    });
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Section 1: Activity Information (Combined General Info + Instructions & Handouts) */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            1
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Activity information</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Title, guidelines, and starter files</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Activity title
            </label>
            <input
              type="text"
              required
              value={value.title}
              onChange={e => onChange({ ...value, title: e.target.value })}
              placeholder="e.g. Activity 4: SpeedGrader Split-Screen UI Integration"
              className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Instructions & deliverables
            </label>
            <textarea
              rows={6}
              value={value.instructions}
              onChange={e => onChange({ ...value, instructions: e.target.value })}
              placeholder="Detail the step-by-step requirements, input/output test specifications, coding conventions, and rubric criteria for students..."
              className="w-full p-3.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] leading-relaxed outline-none resize-y transition-all"
            />
          </div>

          {/* Handout Attachment Upload */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Starter code / handout file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {value.attachedFile ? (
              <div className="p-3.5 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-[12.5px] text-foreground truncate">{value.attachedFile.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {value.attachedFile.size} • Saved to uploads
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    Change file
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilePickerOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    Browse uploaded
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...value, attachedFile: null });
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div
                onClick={() => { if (!upload.isUploading) fileInputRef.current?.click(); }}
                onDragOver={e => {
                  e.preventDefault();
                  if (!upload.isUploading) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                aria-disabled={upload.isUploading}
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? 'border-primary/40 bg-primary/[0.04]'
                    : 'border-border/70 hover:border-primary/40 hover:bg-muted/30 bg-muted/10'
                }${upload.isUploading ? ' opacity-60 cursor-wait pointer-events-none' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[12.5px] font-semibold text-foreground block">
                    Click to browse or drop reference file here
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    PDF instructions, starter ZIP repositories, or sample datasets (up to 50MB)
                  </span>
                </div>
              </div>
              {upload.isUploading && upload.fileName && (
                <UploadProgress fileName={upload.fileName} progress={upload.progress} hint="Saving file to /public/uploads/..." />
              )}
              </>
            )}

            <div className="flex justify-center pt-1.5">
              <button
                type="button"
                onClick={() => setIsFilePickerOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 border border-border/70"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse uploaded files</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Scoring and Deadlines (Combined Grading & Scoring Matrix + Submission Types & Deadlines) */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            2
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Scoring and deadlines</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Points, submission methods, and availability</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Points Possible */}
          <div className="max-w-[240px]">
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Total points
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={1000}
                value={value.pointsPossible}
                onChange={e => onChange({ ...value, pointsPossible: Math.max(1, Number(e.target.value)) })}
                className="w-full pl-3.5 pr-11 py-2 bg-background border border-border rounded-xl text-foreground text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground font-medium">
                pts
              </span>
            </div>
          </div>

          {/* Submission Methods */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-2">
              Submission methods
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className={`px-3.5 py-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                value.allowFileUpload
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-border/70 hover:border-muted-foreground/30 hover:bg-muted/20'
              }`}>
                <input
                  type="checkbox"
                  checked={value.allowFileUpload}
                  onChange={e => onChange({ ...value, allowFileUpload: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-[12.5px] text-foreground block">File upload</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground block mt-0.5">PDFs, archives, and source code</span>
                </div>
              </label>

              <label className={`px-3.5 py-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                value.allowOnlineText
                  ? 'border-primary/30 bg-primary/[0.04]'
                  : 'border-border/70 hover:border-muted-foreground/30 hover:bg-muted/20'
              }`}>
                <input
                  type="checkbox"
                  checked={value.allowOnlineText}
                  onChange={e => onChange({ ...value, allowOnlineText: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-[12.5px] text-foreground block">Text entry</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground block mt-0.5">In-browser markdown or code</span>
                </div>
              </label>
            </div>
          </div>

          {/* Schedule Deadlines */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Due date</span>
              </label>
              <input
                type="datetime-local"
                required
                value={value.dueDate}
                onChange={e => onChange({ ...value, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Available from</span>
              </label>
              <input
                type="datetime-local"
                value={value.availableFrom}
                onChange={e => onChange({ ...value, availableFrom: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Until</span>
              </label>
              <input
                type="datetime-local"
                value={value.availableUntil}
                onChange={e => onChange({ ...value, availableUntil: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {isFilePickerOpen && (
        <FilePickerModal
          courseId={courseId}
          onClose={() => setIsFilePickerOpen(false)}
          onSelect={handleSelectExistingFile}
        />
      )}
    </div>
  );
};
