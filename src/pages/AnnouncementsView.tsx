import React, { useState, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { ModalPortal } from '../components/common/ModalPortal';
import type { Announcement } from '../types/lms';
import {
  Megaphone,
  Plus,
  Pin,
  Heart,
  MessageSquare,
  Search,
  Paperclip,
  Send,
  Trash2,
  Lock,
  Upload,
  FileText,
  Eye,
  ExternalLink,
  ChevronDown,
  Loader2,
  X
} from 'lucide-react';
import { uploadFileToPublic, isImageFile } from '../utils/fileUploader';

interface AnnouncementsViewProps {
  courseId: string;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ courseId }) => {
  const {
    activeUser,
    activeRole,
    db,
    createAnnouncement,
    deleteAnnouncement,
    togglePinAnnouncement,
    toggleLikeAnnouncement,
    addAnnouncementReply,
    markAnnouncementRead,
    showAlert,
    showConfirm
  } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<{ name: string; size: string; url?: string } | null>(null);

  // Compose Form State
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reply state for currently expanded thread
  const [replyText, setReplyText] = useState('');

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
      console.error('Failed to upload file to public directory:', err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const course = db.courses.find(c => c.id === courseId);
  const announcements = (db.announcements || []).filter(
    a => a.courseId === courseId || a.courseId === 'all'
  );

  // Filtered announcements
  const filteredAnnouncements = announcements
    .filter(a => {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Pinned first, then newest
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleCreateSubmit = (e: React.FormEvent) => {
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
      sectionRestriction: 'All Sections',
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

    // Reset
    setTitle('');
    setContent('');
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsComposeOpen(false);
  };

  const handleSelectAnnouncement = (ann: Announcement) => {
    markAnnouncementRead(ann.id);
    setSelectedAnnouncementId(prev => (prev === ann.id ? null : ann.id));
  };

  const handleSendReply = (announcementId: string) => {
    if (!replyText.trim()) return;
    addAnnouncementReply(announcementId, replyText.trim());
    setReplyText('');
  };

  const canCreate = activeRole === 'faculty';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="heading-2 text-foreground flex items-center space-x-2.5">
              <Megaphone className="w-5 h-5 text-primary" />
              <span>Announcements</span>
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-sans font-bold rounded-md bg-muted text-foreground border border-border">
              {filteredAnnouncements.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Broadcasts, academic directives, and time-sensitive reminders for {course?.code || 'Course'}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsComposeOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search announcements by title or keyword..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-sans outline-none text-foreground shadow-subtle"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compose Announcement Modal */}
      {isComposeOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in select-none">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-elevated overflow-hidden animate-scale-in my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                <div className="flex items-center space-x-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Create Course Announcement</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Topic Title *
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
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Announcement Body *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Draft your announcement message. Markdown, bullet points, and guidelines..."
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                  />
                </div>

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
                      className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${isDragging
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
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="text-xs font-bold text-foreground">
                            Click to upload or drag & drop handout file
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            PDF, DOCX, PPTX, ZIP, or media files (saved permanently to /public/uploads/)
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Options & Permissions Toggles */}
                <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2.5 text-xs">
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
                    <span className="text-foreground font-medium">Allow users to comment</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowLiking}
                      onChange={e => setAllowLiking(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-foreground font-medium">Allow liking</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={e => setPinned(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
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

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer"
                  >
                    Publish Announcement
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Feed List */}
      {filteredAnnouncements.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl shadow-subtle space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Announcements Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'No announcements match your search query.'
              : 'There are no active announcements posted in this course yet.'}
          </p>
          {canCreate && !searchQuery && (
            <button
              type="button"
              onClick={() => setIsComposeOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm mt-2 cursor-pointer"
            >
              + Post First Announcement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map(ann => {
            const isExpanded = selectedAnnouncementId === ann.id;
            const isRead = (ann.readBy || []).includes(activeUser.id);
            const userHasReplied = (ann.replies || []).some(r => r.authorId === activeUser.id);
            const isLiked = (ann.likedBy || []).includes(activeUser.id);
            const mustPostFirst =
              ann.usersMustPostBeforeReplies &&
              !userHasReplied &&
              activeRole === 'student';

            return (
              <div
                key={ann.id}
                className={`bg-card border rounded-2xl transition-all shadow-subtle overflow-hidden ${ann.pinned
                    ? 'border-primary/40 bg-gradient-to-r from-primary/[0.03] to-transparent'
                    : isRead
                      ? 'border-border'
                      : 'border-primary/30 ring-1 ring-primary/20'
                  }`}
              >
                {/* Announcement Summary Header */}
                <div
                  onClick={() => handleSelectAnnouncement(ann)}
                  className="p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start space-x-3.5">
                    <img
                      src={ann.authorAvatar}
                      alt={ann.authorName}
                      className="w-10 h-10 rounded-full object-cover border border-border shadow-soft shrink-0 mt-0.5"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                          {ann.title}
                        </h3>
                        {ann.pinned && (
                          <span className="px-2 py-0.5 text-[10px] font-sans font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center space-x-1">
                            <Pin className="w-3 h-3" />
                            <span>PINNED</span>
                          </span>
                        )}
                        {!isRead && (
                          <span className="px-2 py-0.5 text-[10px] font-sans font-bold rounded bg-primary/10 text-primary border border-primary/20">
                            NEW
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[10px] font-sans rounded bg-muted text-muted-foreground border border-border">
                          {ann.sectionRestriction}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-muted-foreground font-sans">
                        <span className="font-semibold text-foreground">{ann.authorName}</span>
                        <span>•</span>
                        <span>
                          {new Date(ann.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        {ann.delayedUntil && (
                          <span className="text-blue-600 dark:text-blue-400">
                            (Scheduled: {new Date(ann.delayedUntil).toLocaleDateString()})
                          </span>
                        )}
                      </div>

                      {!isExpanded && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pt-1 font-sans">
                          {ann.content}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Stats */}
                  <div
                    className="flex items-center space-x-3 shrink-0 text-xs text-muted-foreground"
                    onClick={e => e.stopPropagation()}
                  >
                    {ann.allowLiking && (
                      <button
                        type="button"
                        onClick={() => toggleLikeAnnouncement(ann.id)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${isLiked
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold'
                            : 'bg-muted/40 border-border hover:text-foreground'
                          }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{ann.likes || 0}</span>
                      </button>
                    )}

                    <div className="flex items-center space-x-1 font-sans text-[11px] bg-muted px-2 py-1 rounded-md border border-border">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span>{ann.replies?.length || 0}</span>
                    </div>

                    {canCreate && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => togglePinAnnouncement(ann.id)}
                          title={ann.pinned ? 'Unpin' : 'Pin to top'}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
                        >
                          <Pin className={`w-3.5 h-3.5 ${ann.pinned ? 'text-amber-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            showConfirm(
                              `Are you sure you want to delete "${ann.title}"?`,
                              () => deleteAnnouncement(ann.id),
                              'Delete Announcement'
                            )
                          }
                          title="Delete Announcement"
                          className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Expand/Collapse Chevron Indicator */}
                    <div className="pl-1">
                      <div className={`p-1.5 rounded-lg text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : 'rotate-0'}`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Thread & Details with Opening and Closing Animations */}
                <div
                  className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="p-5 pt-0 border-t border-border/80 space-y-5 bg-card/60">
                      {/* Full Content */}
                      <div className="pt-4 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {ann.content}
                      </div>

                      {/* Attachments Section */}
                      {ann.attachments && ann.attachments.length > 0 && (() => {
                        const imageAttachments = ann.attachments.filter(f => isImageFileName(f.name, f.url));
                        const fileAttachments = ann.attachments.filter(f => !isImageFileName(f.name, f.url));

                        return (
                          <div className="space-y-4 pt-3 border-t border-border">
                            {/* Image Attachments - Immediately Visible */}
                            {imageAttachments.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span>Attached Image ({imageAttachments.length})</span>
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {imageAttachments.map((imgFile, idx) => (
                                    <div
                                      key={idx}
                                      className="group relative rounded-2xl overflow-hidden border border-border bg-card/80 shadow-subtle hover:border-primary/50 transition-all cursor-pointer"
                                      onClick={() => setPreviewingAttachment(imgFile)}
                                    >
                                      <div className="bg-muted/30 p-2 flex items-center justify-center min-h-[180px] max-h-[360px] overflow-hidden">
                                        <img
                                          src={getImageSrc(imgFile)}
                                          alt={imgFile.name}
                                          className="w-full h-auto max-h-[340px] object-contain rounded-xl group-hover:scale-[1.01] transition-transform duration-200"
                                        />
                                      </div>
                                      <div className="p-3 bg-card border-t border-border flex items-center justify-between">
                                        <div className="flex items-center space-x-2 truncate">
                                          <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                                          <span className="text-xs font-semibold text-foreground truncate">{imgFile.name}</span>
                                          <span className="text-[10px] text-muted-foreground shrink-0">({imgFile.size})</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewingAttachment(imgFile);
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors flex items-center space-x-1 shrink-0 ml-2 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3" />
                                          <span>View</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Document/File Attachments - Clickable without downloading */}
                            {fileAttachments.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                                  <span>Attached Documents & Handouts ({fileAttachments.length})</span>
                                </span>
                                <div className="flex flex-wrap gap-2.5">
                                  {fileAttachments.map((file, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setPreviewingAttachment(file)}
                                      className="px-3.5 py-2.5 bg-card hover:bg-muted/70 border border-border hover:border-primary/50 rounded-xl flex items-center space-x-3 text-xs font-sans text-foreground transition-all cursor-pointer shadow-subtle group text-left max-w-sm"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="overflow-hidden">
                                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate flex items-center space-x-1.5">
                                          <span className="truncate">{file.name}</span>
                                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" />
                                        </div>
                                        <span className="text-muted-foreground text-[10px] block">{file.size} • Click to open & view</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Replies Section */}
                      {ann.allowComments && (
                        <div className="pt-4 border-t border-border space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground font-sans uppercase tracking-wider flex items-center space-x-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-primary" />
                              <span>Discussion & Responses ({ann.replies?.length || 0})</span>
                            </span>
                          </div>

                          {/* If student must post before seeing replies */}
                          {mustPostFirst && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center space-x-3 text-xs text-amber-800 dark:text-amber-300">
                              <Lock className="w-4 h-4 shrink-0" />
                              <span>
                                Peer responses are hidden until you post your initial reply. Submit a reply below to view all comments.
                              </span>
                            </div>
                          )}

                          {/* List of Replies */}
                          {!mustPostFirst && ann.replies && ann.replies.length > 0 && (
                            <div className="space-y-3">
                              {[...ann.replies]
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map(rep => (
                                  <div
                                    key={rep.id}
                                    className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <img
                                          src={rep.authorAvatar}
                                          alt={rep.authorName}
                                          className="w-6 h-6 rounded-full object-cover border border-border"
                                        />
                                        <span className="text-xs font-bold text-foreground">
                                          {rep.authorName}
                                        </span>
                                        <span className="px-1.5 py-0.2 text-[9px] font-sans rounded bg-muted text-muted-foreground border border-border uppercase">
                                          {rep.authorRole}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-sans text-muted-foreground">
                                        {new Date(rep.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-foreground pl-8">{rep.content}</p>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* Reply Composer Box */}
                          <div className="flex items-start space-x-2 pt-2">
                            <img
                              src={activeUser.avatar}
                              alt={activeUser.name}
                              className="w-8 h-8 rounded-full object-cover border border-border shrink-0 mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <textarea
                                rows={2}
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (replyText.trim()) {
                                      handleSendReply(ann.id);
                                    }
                                  }
                                }}
                                placeholder="Type a response or inquiry... (Press Enter to send, Shift+Enter for new line)"
                                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(ann.id)}
                                  disabled={!replyText.trim()}
                                  className="px-3.5 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Reply</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App File / Handout Preview Modal */}
      {previewingAttachment && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in select-none">
            <div className="bg-card border border-border rounded-2xl w-[96vw] max-w-[1550px] h-[92vh] max-h-[95vh] shadow-elevated overflow-hidden animate-scale-in flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {isImageFileName(previewingAttachment.name, previewingAttachment.url) ? (
                      <Eye className="w-4.5 h-4.5" />
                    ) : (
                      <FileText className="w-4.5 h-4.5" />
                    )}
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-bold text-foreground truncate font-sans">
                      {previewingAttachment.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      {previewingAttachment.size} • {isImageFileName(previewingAttachment.name, previewingAttachment.url) ? 'Image Preview (Expanded View)' : 'Document Handout Viewer (Expanded View)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  {previewingAttachment.url && (
                    <button
                      type="button"
                      onClick={() => {
                        const w = window.open();
                        if (w && previewingAttachment.url) {
                          w.location.href = previewingAttachment.url;
                        }
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer font-sans"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open Original</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewingAttachment(null)}
                    className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Viewer */}
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-background/50 flex flex-col items-center justify-center min-h-0">
                {isImageFileName(previewingAttachment.name, previewingAttachment.url) ? (
                  <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 bg-muted/20 rounded-xl border border-border overflow-hidden">
                    <img
                      src={getImageSrc(previewingAttachment)}
                      alt={previewingAttachment.name}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-elevated"
                    />
                  </div>
                ) : previewingAttachment.url && (previewingAttachment.url.startsWith('data:application/pdf') || previewingAttachment.url.includes('.pdf')) ? (
                  <iframe
                    src={previewingAttachment.url}
                    className="w-full h-full rounded-xl border border-border bg-white"
                    title={previewingAttachment.name}
                  />
                ) : (
                  <div className="w-full max-w-3xl bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-subtle my-auto">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                      <FileText className="w-10 h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-lg font-bold text-foreground font-sans">
                        {previewingAttachment.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-sans">
                        Official Document Handout • {previewingAttachment.size}
                      </p>
                    </div>

                    <div className="p-5 bg-muted/40 rounded-2xl border border-border text-left font-mono text-xs text-foreground/80 space-y-2 leading-relaxed">
                      <div className="text-[11px] font-sans font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Document Summary & Handout Preview
                      </div>
                      <p className="text-xs font-sans text-foreground">
                        Official course resource: <strong>{previewingAttachment.name}</strong>.
                      </p>
                      <p className="text-xs font-sans text-muted-foreground">
                        This handout is attached to the course announcement for academic review. Students and faculty can inspect details without needing external downloads.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-3">
                      {previewingAttachment.url && (
                        <button
                          type="button"
                          onClick={() => {
                            const w = window.open();
                            if (w && previewingAttachment.url) {
                              w.location.href = previewingAttachment.url;
                            }
                          }}
                          className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-2 cursor-pointer font-sans"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Document Stream</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewingAttachment(null)}
                        className="px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer font-sans"
                      >
                        Close Viewer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
