import React, { useState, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import type { CourseSection } from '../types/lms';
import { uploadFileToPublic, isImageFile } from '../utils/fileUploader';
import {
  ArrowLeft,
  Megaphone,
  Upload,
  FileText,
  Loader2,
  Trash2,
  Pin,
  MessageSquare,
  Heart,
  Calendar
} from 'lucide-react';

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
  const { db, createAnnouncement, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [delayPosting, setDelayPosting] = useState(false);
  const [delayedDate, setDelayedDate] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowLiking, setAllowLiking] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; url?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [sectionRestriction, setSectionRestriction] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courseSections: CourseSection[] = (db.courseSections || []).filter((s: CourseSection) => s.courseId === courseId);

  const isImageFileName = (name: string, url?: string): boolean => {
    return isImageFile(name, undefined, url);
  };

  const getImageSrc = (file: { name: string; size?: string; url?: string }) => {
    if (file.url) return file.url;
    const encodedName = encodeURIComponent(file.name);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340" fill="none"><rect width="600" height="340" rx="16" fill="%231e293b"/><circle cx="300" cy="130" r="44" fill="%23ec4899" fill-opacity="0.15"/><path d="M280 142l14-14 26 26 12-12 18 18H270l10-18z" fill="%23ec4899"/><circle cx="286" cy="120" r="6" fill="%23f472b6"/><text x="300" y="220" fill="%23f8fafc" font-size="15" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">${encodedName}</text><text x="300" y="245" fill="%2394a3b8" font-size="12" font-family="system-ui, sans-serif" text-anchor="middle">Image Attachment</text></svg>`;
  };

  const processFile = async (file: File) => {
    setIsUploadingFile(true);
    try {
      const result = await uploadFileToPublic(file);
      setAttachedFile({
        name: result.name,
        size: result.size,
        url: result.url
      });
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showAlert({
        title: 'Missing Required Fields',
        message: 'Please provide both a topic title and announcement content.',
        type: 'warning'
      });
      return;
    }

    const attachments = attachedFile
      ? [{ name: attachedFile.name, size: attachedFile.size, url: attachedFile.url }]
      : [];

    createAnnouncement({
      courseId,
      title: title.trim(),
      content: content.trim(),
      sectionRestriction: sectionRestriction === 'all' ? 'All Sections' : sectionRestriction,
      delayedUntil: delayPosting && delayedDate ? delayedDate : undefined,
      allowComments,
      usersMustPostBeforeReplies: false,
      allowLiking,
      pinned,
      attachments
    });

    showAlert({
      title: 'Announcement Published',
      message: `Announcement "${title.trim()}" has been posted successfully.`,
      type: 'success'
    });

    onAnnouncementCreated();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pt-4 sm:pt-6 pb-20 px-1 font-sans">
      <div className="pb-6 border-b border-border/80">
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
            <span className="text-primary font-bold px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px]">
              New Announcement
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <span>Create Announcement</span>
              </h1>
              <p className="text-xs text-muted-foreground font-sans pl-[52px]">
                Broadcast an academic directive or reminder to students in {course?.code || 'this course'}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Topic Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Schedule for Midterm Examination & Lab Exercises"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Announcement Body
            </label>
            <textarea
              required
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Draft your announcement message. Markdown, bullet points, and guidelines..."
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/20 resize-y"
            />
          </div>

          {courseSections.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Post to Section</label>
              <select
                value={sectionRestriction}
                onChange={e => setSectionRestriction(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Sections</option>
                {courseSections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <label className="block text-xs font-bold text-foreground">
              Attach File / Handout
            </label>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            {attachedFile ? (
              <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {isImageFileName(attachedFile.name, attachedFile.url) ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0 bg-black/10 flex items-center justify-center">
                      <img
                        src={getImageSrc(attachedFile)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground truncate">{attachedFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{attachedFile.size}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Change
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
                    <Trash2 className="w-3.5 h-3.5" />
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
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10'
                  }`}
              >
                {isUploadingFile ? (
                  <>
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-xs font-bold text-foreground">Saving file to /public/uploads/...</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      Click to upload or drag & drop handout file
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      PDF, DOCX, PPTX, ZIP, or media files
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3 text-xs">
            <span className="font-bold text-foreground block font-sans text-[11px] uppercase tracking-wider">
              Options & Permissions
            </span>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={e => setAllowComments(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Allow users to comment</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLiking}
                onChange={e => setAllowLiking(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              <Heart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Allow liking</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={e => setPinned(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              <Pin className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">Pin announcement to top</span>
            </label>

            <div className="pt-2 border-t border-border">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={delayPosting}
                  onChange={e => setDelayPosting(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
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
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-sans text-foreground"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center space-x-2"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Publish Announcement</span>
          </button>
        </div>
      </form>
    </div>
  );
};
