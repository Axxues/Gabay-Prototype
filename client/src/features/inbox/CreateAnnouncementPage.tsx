import React, { useState, useRef, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { uploadFileToPublic, isImageFile, formatFileSize, extractDirectusFileId } from '../../shared/utils/fileUploader';
import { findMatchingSiblingCourses } from '../../shared/utils/crossSectionSync';
import { CrossSectionPromptModal } from '../../shared/components/common/CrossSectionPromptModal';
import {
  ArrowLeft,
  Megaphone,
  Upload,
  FileText,
  Trash2,
  Pin,
  MessageSquare,
  Heart,
  Calendar,
  FolderOpen,
  Loader2
} from 'lucide-react';
import { FilePickerModal } from '../../shared/components/common/FilePickerModal';
import { UploadProgress } from '../../shared/components/common/UploadProgress';
import { useSimulatedUpload } from '../../shared/hooks/useSimulatedUpload';
import type { AggregatedCourseFile } from '../../shared/hooks/useCourseFiles';

interface AttachedFileItem {
  name: string;
  size: string;
  url?: string;
  rawFile?: File;
  previewUrl?: string;
}

interface CreateAnnouncementPageProps {
  courseId: string;
  onBack: () => void;
  onAnnouncementCreated: () => void;
}

export const CreateAnnouncementPage: React.FC<CreateAnnouncementPageProps> = ({
  courseId,
  onBack,
  onAnnouncementCreated
}) => {
  const { db, createAnnouncement, showAlert, activeUser, uploadCourseFile } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [delayPosting, setDelayPosting] = useState(false);
  const [delayedDate, setDelayedDate] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowLiking, setAllowLiking] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const upload = useSimulatedUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCrossSectionModalOpen, setIsCrossSectionModalOpen] = useState(false);

  const siblingCourses = useMemo(() => {
    return course ? findMatchingSiblingCourses(course, db.courses, activeUser?.id) : [];
  }, [course, db.courses, activeUser?.id]);

  const isImageFileName = (name: string, url?: string, rawFile?: File): boolean => {
    return isImageFile(name, rawFile?.type, url);
  };

  const getImageSrc = (file: AttachedFileItem) => {
    if (file.url) return file.url;
    if (file.previewUrl) return file.previewUrl;
    if (file.rawFile && isImageFile(file.name, file.rawFile.type)) {
      return URL.createObjectURL(file.rawFile);
    }
    const encodedName = encodeURIComponent(file.name);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340" fill="none"><rect width="600" height="340" rx="16" fill="%231e293b"/><circle cx="300" cy="130" r="44" fill="%23ec4899" fill-opacity="0.15"/><path d="M280 142l14-14 26 26 12-12 18 18H270l10-18z" fill="%23ec4899"/><circle cx="286" cy="120" r="6" fill="%23f472b6"/><text x="300" y="220" fill="%23f8fafc" font-size="15" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">${encodedName}</text><text x="300" y="245" fill="%2394a3b8" font-size="12" font-family="system-ui, sans-serif" text-anchor="middle">Image Attachment</text></svg>`;
  };

  const processFiles = (files: FileList | File[]) => {
    if (upload.isUploading || isSubmitting) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const newItems: AttachedFileItem[] = fileList.map(file => {
      const formatted = formatFileSize(file.size);
      const isImg = isImageFile(file.name, file.type);
      return {
        name: file.name,
        size: formatted !== '0 B' ? formatted : `${(file.size / 1024).toFixed(1)} KB`,
        rawFile: file,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined
      };
    });

    setAttachedFiles(prev => [...prev, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (upload.isUploading || isSubmitting) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFiles(files);
  };

  const handleSelectExistingFile = (file: AggregatedCourseFile) => {
    const displaySize = (file.formattedSize && file.formattedSize !== '0 B')
      ? file.formattedSize
      : (file.size && file.size > 0 ? formatFileSize(file.size) : file.formattedSize || '');
    setAttachedFiles(prev => [
      ...prev,
      {
        name: file.name,
        size: displaySize,
        url: file.url || file.fileUrl || `/public/uploads/${file.name}`
      }
    ]);
    setIsFilePickerOpen(false);
    showAlert({
      title: 'File Attached',
      message: `"${file.name}" has been attached from your uploaded course files.`,
      type: 'success'
    });
  };

  const executePublish = async (targetCourseIds: string[]) => {
    setIsSubmitting(true);
    try {
      const primaryAnnouncementId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (`ann-${Date.now()}`);
      const attachments: { name: string; size: string; url?: string; directus_files_id?: string; fileId?: string }[] = [];

      for (const file of attachedFiles) {
        if (!file.rawFile) {
          const directusId = (file as any).directus_files_id || (file as any).fileId || extractDirectusFileId(file.url);
          attachments.push({
            name: file.name,
            size: file.size,
            url: file.url,
            ...(directusId ? { directus_files_id: directusId, fileId: directusId } : {})
          });
          continue;
        }

        // Newly staged file: only upload and save to Likha ERP now that the post is saved
        upload.start(file.name);
        let url = '';
        let size = file.size;
        let fileId = '';

        try {
          if (uploadCourseFile) {
            const saved = await uploadCourseFile({
              courseId,
              name: file.name,
              rawFile: file.rawFile,
              size: file.rawFile.size,
              formattedSize: file.size,
              area: 'announcements',
              moduleId: primaryAnnouncementId,
              visibility: 'published',
              silent: true
            });
            url = saved.fileUrl || saved.url || '';
            fileId = (saved as any)?.fileId || (saved as any)?.file || extractDirectusFileId(url) || '';
            if (saved.formattedSize && saved.formattedSize !== '0 B') {
              size = saved.formattedSize;
            }

            // Link to sibling sections if replicating
            if (targetCourseIds.length > 1) {
              const otherCourseIds = targetCourseIds.filter(id => id !== courseId);
              for (const otherId of otherCourseIds) {
                try {
                  await uploadCourseFile({
                    courseId: otherId,
                    name: file.name,
                    fileUrl: url,
                    url: url,
                    size: file.rawFile.size,
                    formattedSize: size,
                    area: 'announcements',
                    visibility: 'published',
                    silent: true
                  });
                } catch {
                  // Non-blocking for sibling section file linking
                }
              }
            }
          }
        } catch {
          url = '';
        }

        if (!url) {
          const result = await uploadFileToPublic(file.rawFile);
          url = result.url;
          fileId = (result as any).id || (result as any).fileId || extractDirectusFileId(url) || '';
          if (result.size && result.size !== '0 B') size = result.size;
        }

        if (!fileId && url) {
          fileId = extractDirectusFileId(url) || '';
        }

        attachments.push({
          name: file.name,
          size,
          url,
          ...(fileId ? { directus_files_id: fileId, fileId } : {})
        });
        upload.complete();
      }

      for (const targetId of targetCourseIds) {
        const idForTarget = targetId === courseId
          ? primaryAnnouncementId
          : ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ann-${Date.now()}-${targetId}`);
        await createAnnouncement({
          id: idForTarget,
          courseId: targetId,
          title: title.trim(),
          content: content.trim(),
          sectionId: 'all',
          sectionRestriction: 'All Sections',
          delayedUntil: delayPosting && delayedDate ? delayedDate : undefined,
          allowComments,
          usersMustPostBeforeReplies: false,
          allowLiking,
          pinned,
          attachments
        });
      }

      const count = targetCourseIds.length;
      showAlert({
        title: 'Announcement Published',
        message: count > 1
          ? `Announcement "${title.trim()}" published across ${count} sections successfully.`
          : `Announcement "${title.trim()}" has been posted successfully.`,
        type: 'success'
      });

      onAnnouncementCreated();
    } catch {
      upload.fail();
      showAlert({
        title: 'Publish Failed',
        message: 'Failed to publish announcement. Please try again.',
        type: 'warning'
      });
      return;
    } finally {
      setIsSubmitting(false);
      setIsCrossSectionModalOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (upload.isUploading || isSubmitting) return;
    if (!title.trim() || !content.trim()) {
      showAlert({
        title: 'Missing Required Fields',
        message: 'Please provide both a topic title and announcement content.',
        type: 'warning'
      });
      return;
    }

    if (siblingCourses.length > 0) {
      setIsCrossSectionModalOpen(true);
      return;
    }

    await executePublish([courseId]);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pt-4 sm:pt-6 pb-20 px-1 font-sans">
      <div className="pb-6 border-b border-border/70">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Announcements</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {course?.code || 'Course'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border text-[11px]">
              New announcement
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <span>Create announcement</span>
              </h1>
              <p className="text-[13px] text-muted-foreground pl-0.5">
                Broadcast an academic directive or reminder to students in {course?.code || 'this course'}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Topic title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Schedule for Midterm Examination & Lab Exercises"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Announcement body <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Draft your announcement message. Markdown, bullet points, and guidelines..."
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y"
            />
          </div>

          <div className="pt-2 border-t border-border/70 space-y-2">
            <label className="block text-[12px] font-semibold text-muted-foreground">
              Attach file / handout {attachedFiles.length > 0 && `(${attachedFiles.length})`}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      {isImageFileName(file.name, file.url, file.rawFile) ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0 bg-black/10 flex items-center justify-center">
                          <img
                            src={getImageSrc(file)}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="truncate">
                        <p className="text-xs font-bold text-foreground truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFiles(prev => {
                            const target = prev[idx];
                            if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
                              URL.revokeObjectURL(target.previewUrl);
                            }
                            return prev.filter((_, i) => i !== idx);
                          });
                        }}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              onClick={() => { if (!upload.isUploading) fileInputRef.current?.click(); }}
              onDragOver={e => {
                e.preventDefault();
                if (!upload.isUploading) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              aria-disabled={upload.isUploading}
              className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10'
                  }${upload.isUploading ? ' opacity-60 cursor-wait pointer-events-none' : ''}`}
            >
              <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-foreground">
                Click to upload or drag & drop handout files
              </div>
              <p className="text-[11px] text-muted-foreground">
                PDF, DOCX, PPTX, ZIP, or media files (multiple allowed)
              </p>
            </div>
            {upload.isUploading && upload.fileName && (
              <UploadProgress fileName={upload.fileName} progress={upload.progress} hint="Uploading file..." />
            )}

            {/* Browse uploaded files */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setIsFilePickerOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 border border-primary/30 bg-primary/5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse Uploaded Files</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-card rounded-2xl border border-border space-y-3 text-xs">
            <span className="font-semibold text-muted-foreground block text-[12px]">
              Options & permissions
            </span>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={e => setAllowComments(e.target.checked)}
                className="w-4 h-4 shrink-0 cursor-pointer rounded border-border bg-background accent-primary dark:bg-white/10 dark:[color-scheme:dark]"
              />
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Allow users to comment</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLiking}
                onChange={e => setAllowLiking(e.target.checked)}
                className="w-4 h-4 shrink-0 cursor-pointer rounded border-border bg-background accent-primary dark:bg-white/10 dark:[color-scheme:dark]"
              />
              <Heart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Allow liking</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={e => setPinned(e.target.checked)}
                className="w-4 h-4 shrink-0 cursor-pointer rounded border-border bg-background accent-primary dark:bg-white/10 dark:[color-scheme:dark]"
              />
              <Pin className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Pin announcement to top</span>
            </label>

            <div className="pt-2 border-t border-border/70">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={delayPosting}
                  onChange={e => setDelayPosting(e.target.checked)}
                  className="w-4 h-4 shrink-0 cursor-pointer rounded border-border bg-background accent-primary dark:bg-white/10 dark:[color-scheme:dark]"
                />
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground font-medium">Delay posting (Schedule release)</span>
              </label>
              {delayPosting && (
                <div className="mt-2 pl-6">
                  <input
                    type="datetime-local"
                    value={delayedDate}
                    onChange={e => setDelayedDate(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border rounded-xl text-[12.5px] tabular-nums text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border/70">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || upload.isUploading}
            className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-2"
          >
            {isSubmitting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Megaphone className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? 'Publishing…' : 'Publish announcement'}</span>
          </button>
        </div>
      </form>

      {isFilePickerOpen && (
        <FilePickerModal
          courseId={courseId}
          onClose={() => setIsFilePickerOpen(false)}
          onSelect={handleSelectExistingFile}
        />
      )}

      <CrossSectionPromptModal
        isOpen={isCrossSectionModalOpen}
        onClose={() => setIsCrossSectionModalOpen(false)}
        itemType="announcement"
        itemTitle={title.trim()}
        siblingCourses={siblingCourses}
        onConfirm={async (selectedIds) => {
          await executePublish([courseId, ...selectedIds]);
        }}
        onSkipToCurrentOnly={async () => {
          await executePublish([courseId]);
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
