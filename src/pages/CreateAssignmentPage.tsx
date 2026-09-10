import React, { useState, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { uploadFileToPublic } from '../utils/fileUploader';
import {
  ArrowLeft,
  FileCheck2,
  Calendar,
  Upload,
  Check,
  FileText,
  Clock,
  Loader2,
  Trash2
} from 'lucide-react';

interface CreateAssignmentPageProps {
  courseId: string;
  onBack: () => void;
  onAssignmentCreated: (newAssignmentId: string) => void;
}

export const CreateAssignmentPage: React.FC<CreateAssignmentPageProps> = ({
  courseId,
  onBack,
  onAssignmentCreated
}) => {
  const { db, createAssignment, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  // Form states
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pointsPossible, setPointsPossible] = useState(100);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    d.setHours(23, 59, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [availableFrom, setAvailableFrom] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [availableUntil, setAvailableUntil] = useState('');
  const [allowFileUpload, setAllowFileUpload] = useState(true);
  const [allowOnlineText, setAllowOnlineText] = useState(true);

  // Attached Reference/Handout File state
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: string;
    url: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        message: 'Please attach a document or archive smaller than 50MB.',
        type: 'warning'
      });
      return;
    }

    setIsUploadingFile(true);
    try {
      const result = await uploadFileToPublic(file);
      setAttachedFile({
        name: result.name,
        size: result.size,
        url: result.url
      });
      showAlert({
        title: 'File Attached',
        message: `"${file.name}" has been attached and saved to /public/uploads/.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to attach assignment file:', err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSave = (publish: boolean) => {
    if (!title.trim()) {
      showAlert({
        title: 'Missing Title',
        message: 'Please provide an activity title before saving.',
        type: 'warning'
      });
      return;
    }

    const submissionTypes: ('file' | 'online_text')[] = [];
    if (allowFileUpload) submissionTypes.push('file');
    if (allowOnlineText) submissionTypes.push('online_text');

    if (submissionTypes.length === 0) {
      showAlert({
        title: 'Submission Type Required',
        message: 'Please select at least one submission type (File Upload or Online Text Entry).',
        type: 'warning'
      });
      return;
    }

    const created = createAssignment({
      courseId,
      title: title.trim(),
      instructions: instructions.trim() || 'Complete the activity guidelines aligned with course syllabus objectives.',
      category: 'Activities',
      pointsPossible: Number(pointsPossible) || 100,
      weight: 30,
      dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      availableFrom: availableFrom || undefined,
      availableUntil: availableUntil || undefined,
      submissionTypes,
      published: publish,
      sectionRestriction: 'All Sections',
      fileName: attachedFile?.name,
      fileUrl: attachedFile?.url,
      fileSize: attachedFile?.size
    });

    showAlert({
      title: publish ? 'Activity Published' : 'Activity Draft Saved',
      message: `"${title.trim()}" has been created successfully for ${course?.code || 'this course'}.`,
      type: 'success'
    });

    onAssignmentCreated(created.id);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pt-4 sm:pt-6 pb-20 px-1 font-sans">
      {/* Top Breadcrumb & Navigation */}
      <div className="pb-6 border-b border-border/80">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Activities</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {course?.code || 'Course'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-primary font-bold px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px]">
              New Activity
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <span>Create New Activity</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium pl-0.5">
                Design assessment milestones, configure grading criteria, and attach course handouts.
              </p>
            </div>

            {/* Quick action buttons on top */}
            <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-4 py-2 text-xs font-bold text-foreground bg-card hover:bg-muted/60 border border-border rounded-xl transition-all shadow-subtle cursor-pointer active:scale-98"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Publish Activity</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSave(true);
        }}
        className="space-y-6 text-xs"
      >
        {/* Section 1: Activity Information (Combined General Info + Instructions & Handouts) */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-border/60">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Activity Information</h2>
              <p className="text-[11px] text-muted-foreground">Title, deliverable guidelines, rubrics overview, and downloadable starter kit</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block font-bold text-foreground text-xs mb-1.5">
                Activity Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Activity 4: SpeedGrader Split-Screen UI Integration"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary text-xs outline-none shadow-inner font-sans font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-foreground text-xs mb-1.5">
                Activity Instructions & Deliverable Specifications
              </label>
              <textarea
                rows={6}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Detail the step-by-step requirements, input/output test specifications, coding conventions, and rubric criteria for students..."
                className="w-full p-4 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary text-xs leading-relaxed outline-none shadow-inner resize-y font-sans"
              />
            </div>

            {/* Handout Attachment Upload */}
            <div>
              <label className="block font-bold text-foreground text-xs mb-1.5">
                Attach Starter Code / Handout File (Saved to <span className="font-mono text-primary">/public/uploads/</span>)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {attachedFile ? (
                <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-center justify-between shadow-subtle">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-xs text-foreground truncate">{attachedFile.name}</p>
                      <p className="text-[11px] text-muted-foreground font-sans">
                        {attachedFile.size} • Handout stored in /public/uploads/
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                    >
                      Change File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFile(null);
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10'
                  }`}
                >
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-xs font-bold text-foreground">Writing file to /public/uploads/...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          Click to browse or drop reference file here
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          PDF instructions, starter ZIP repositories, or sample datasets (up to 50MB)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Scoring and Deadlines (Combined Grading & Scoring Matrix + Submission Types & Deadlines) */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-border/60">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Scoring and Deadlines</h2>
              <p className="text-[11px] text-muted-foreground">Total points possible, submission payloads, and schedule availability</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Points Possible */}
            <div className="max-w-xs">
              <label className="block font-bold text-foreground text-xs mb-1.5">
                Total Points Possible
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={pointsPossible}
                  onChange={e => setPointsPossible(Math.max(1, Number(e.target.value)))}
                  className="w-full pl-4 pr-12 py-2.5 bg-background border border-border rounded-xl text-foreground text-xs font-bold outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">
                  pts
                </span>
              </div>
            </div>

            {/* Submission Methods */}
            <div>
              <label className="block font-bold text-foreground text-xs mb-2">
                Permitted Submission Methods
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-4 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all ${
                  allowFileUpload
                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                    : 'bg-muted/20 border-border hover:bg-muted/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={allowFileUpload}
                    onChange={e => setAllowFileUpload(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/30 accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-xs text-foreground block">File Upload</span>
                    <span className="text-[11px] text-muted-foreground">PDFs, archives (ZIP/TAR), and source code</span>
                  </div>
                </label>

                <label className={`p-4 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all ${
                  allowOnlineText
                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                    : 'bg-muted/20 border-border hover:bg-muted/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={allowOnlineText}
                    onChange={e => setAllowOnlineText(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/30 accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-xs text-foreground block">Online Text Entry</span>
                    <span className="text-[11px] text-muted-foreground">Direct in-browser markdown or code snippet</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Schedule Deadlines */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block font-bold text-foreground text-xs mb-1.5 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Due Date & Time</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground text-xs mb-1.5 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Available From</span>
                </label>
                <input
                  type="datetime-local"
                  value={availableFrom}
                  onChange={e => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground text-xs mb-1.5 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" />
                  <span>Until (Hard Lock)</span>
                </label>
                <input
                  type="datetime-local"
                  value={availableUntil}
                  onChange={e => setAvailableUntil(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-sans outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Submission Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/80">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer w-full sm:w-auto"
          >
            Discard & Return to Activities
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-foreground bg-card hover:bg-muted/60 border border-border rounded-xl transition-all shadow-subtle cursor-pointer active:scale-98"
            >
              Save as Unpublished Draft
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Create & Publish Activity</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
