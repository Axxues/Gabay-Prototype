import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { ModuleItem } from '../types/lms';
import {
  FileText,
  FileCheck2,
  HelpCircle,
  ChevronRight,
  Plus,
  X,
  Paperclip,
  Download,
  Eye,
  File,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Heart,
  Trash2,
  Pencil,
  Check
} from 'lucide-react';
import { AnimatedModal } from '../components/common/ModalPortal';
import { AddModuleItemPage } from './AddModuleItemPage';

interface ModulesViewProps {
  courseId: string;
  onSelectAssignment: (assignmentId: string) => void;
  onSelectQuiz: (quizId: string) => void;
}

export const ModulesView: React.FC<ModulesViewProps> = ({
  courseId,
  onSelectAssignment,
  onSelectQuiz
}) => {
  const {
    activeRole,
    activeUser,
    db,
    createModule,
    showAlert,
    addModuleComment,
    editModuleComment,
    deleteModuleComment,
    toggleLikeModuleComment
  } = useLMS();

  const courseModules = db.modules.filter(m => m.courseId === courseId);
  // Modules sorted with latest at the top
  const sortedModules = [...courseModules].sort((a, b) => {
    if (b.order !== a.order) return b.order - a.order;
    return b.id.localeCompare(a.id);
  });
  // Modules collapsed/hidden by default
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Class comments/questions collapsed/hidden by default per module
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // Module Comments Input State per module
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Module Comment Editing State (Author only)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  // Modal states
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  // Page Navigation State for Adding Module Item (Separate Page)
  const [addingItemModuleId, setAddingItemModuleId] = useState<string | null>(null);

  // Document Preview Modal State
  const [previewItem, setPreviewItem] = useState<ModuleItem | null>(null);

  const toggleExpand = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const toggleCommentsExpand = (modId: string) => {
    setExpandedComments(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;

    createModule(courseId, newModuleTitle.trim());
    setNewModuleTitle('');
    setIsAddModuleOpen(false);
  };

  const handleDownloadFile = (item: ModuleItem) => {
    if (item.fileUrl) {
      const link = document.createElement('a');
      link.href = item.fileUrl;
      link.download = item.fileName || `${item.title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      showAlert({
        title: 'Downloading Resource',
        message: `Simulating download of "${item.fileName || item.title}" for offline study.`,
        type: 'info'
      });
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'page':
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'file':
        return <File className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'assignment':
        return <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAttachmentIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|svg|webp)$/.test(lower)) {
      return <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (lower.endsWith('.pdf')) {
      return <FileText className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (/\.(py|js|ts|jsx|tsx|html|css|json|java|c|cpp)$/.test(lower)) {
      return <FileCode className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) {
      return <FileArchive className="w-3.5 h-3.5 text-purple-500" />;
    }
    return <Paperclip className="w-3.5 h-3.5 text-primary" />;
  };

  // If user clicked "Add Item", render the dedicated full page!
  if (addingItemModuleId) {
    return (
      <AddModuleItemPage
        courseId={courseId}
        moduleId={addingItemModuleId}
        onBack={() => setAddingItemModuleId(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Modules
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Course learning units, syllabus readings, and downloadable laboratory materials.
          </p>
        </div>

        {(activeRole === 'faculty' || activeRole === 'admin') && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsAddModuleOpen(true)}
              className="px-3.5 py-2 text-xs font-bold font-sans bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Module</span>
            </button>
          </div>
        )}
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {sortedModules.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-2xl border border-border text-xs font-sans text-muted-foreground">
            No modules available for this course section yet.
          </div>
        ) : (
          sortedModules.map(mod => {
            const isExpanded = expandedModules[mod.id] ?? false;
            const isCommentsExpanded = expandedComments[mod.id] ?? false;

            return (
              <div
                key={mod.id}
                className="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden shadow-subtle transition-all"
              >
                {/* Header Bar - Full Panel Clickable */}
                <div
                  onClick={() => toggleExpand(mod.id)}
                  className="px-5 py-3.5 bg-muted/40 hover:bg-muted/60 border-b border-border flex items-center justify-between cursor-pointer transition-colors select-none group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1 text-muted-foreground group-hover:text-foreground rounded-md transition-colors">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors font-sans">
                        {mod.title}
                      </h3>
                      <span className="text-[11px] font-sans font-medium text-muted-foreground">
                        {mod.items.length} learning resources attached
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center space-x-2.5"
                    onClick={e => e.stopPropagation()}
                  >
                    {(activeRole === 'faculty' || activeRole === 'admin') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingItemModuleId(mod.id);
                        }}
                        className="px-3 py-1.5 text-xs font-bold font-sans bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Module Content - Animates BOTH Open and Close */}
                <div
                  className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden min-h-0">
                    {/* Items List - Latest at the top */}
                    <div className="divide-y divide-border">
                    {mod.items.length === 0 ? (
                      <div className="p-5 text-center text-xs text-muted-foreground italic">
                        No learning items in this unit yet.
                      </div>
                    ) : (
                      [...mod.items].slice().reverse().map(item => (
                        <div
                          key={item.id}
                          className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors text-xs gap-3"
                        >
                          <div
                            className="flex items-start space-x-3.5 cursor-pointer flex-1"
                            onClick={() => {
                              if (item.type === 'assignment' && item.assignmentId) {
                                onSelectAssignment(item.assignmentId);
                              } else if (item.type === 'quiz' && item.quizId) {
                                onSelectQuiz(item.quizId);
                              } else if (item.fileName || item.fileUrl) {
                                setPreviewItem(item);
                              } else {
                                showAlert({
                                  title: item.title,
                                  message: item.content || 'No text content available for this unit item.',
                                  type: 'info',
                                  confirmText: 'Close'
                                });
                              }
                            }}
                          >
                            <div className="p-2 rounded-xl bg-muted border border-border shrink-0 mt-0.5">
                              {getItemIcon(item.type)}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="font-bold text-foreground hover:text-primary transition-colors font-sans">
                                  {item.title}
                                </span>
                                {item.required && (
                                  <span className="px-2 py-0.5 text-[9px] font-sans font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                                    REQUIRED
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] font-sans text-muted-foreground capitalize">
                                Type: {item.type} {item.completionCondition && `• Must ${item.completionCondition}`}
                              </div>

                              {/* Attached File Chip */}
                              {item.fileName && (
                                <div className="pt-0.5 flex items-center space-x-2">
                                  <span
                                    onClick={e => {
                                      e.stopPropagation();
                                      setPreviewItem(item);
                                    }}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-sans text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-subtle"
                                  >
                                    {getAttachmentIcon(item.fileName)}
                                    <span className="truncate max-w-[240px]">{item.fileName}</span>
                                    {item.fileSize && (
                                      <span className="text-muted-foreground font-normal">
                                        ({item.fileSize})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* File Actions */}
                          {item.fileName && (
                            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                title="Preview File"
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(item)}
                                title="Download File"
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Module Class Questions & Comments Section */}
                  <div className="border-t border-border bg-muted/20 px-6 py-4 space-y-3.5">
                    {/* Collapsible Header with counter */}
                    <div
                      onClick={() => toggleCommentsExpand(mod.id)}
                      className="flex items-center justify-between cursor-pointer select-none group py-0.5"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="p-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${
                              isCommentsExpanded ? 'rotate-90' : 'rotate-0'
                            }`}
                          />
                        </div>
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors font-sans">
                          Class Questions & Comments
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-sans font-bold bg-primary/10 text-primary rounded-full">
                          {(mod.comments || []).length}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground font-sans transition-colors">
                        {isCommentsExpanded ? 'Hide' : 'Show questions'}
                      </span>
                    </div>

                    {/* Collapsible Questions / Comments Body (Animates BOTH Open and Close) */}
                    <div
                      className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                        isCommentsExpanded ? 'grid-rows-[1fr] opacity-100 pt-1' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden min-h-0 space-y-3.5 pb-1.5">
                        {/* Comments List - Latest at the top */}
                        {(!mod.comments || mod.comments.length === 0) ? (
                          <div className="p-4 text-center rounded-xl bg-card border border-border/70 text-muted-foreground text-xs font-sans">
                            No comments on this module yet. Post a question or note for your class!
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {[...mod.comments]
                              .sort((a, b) => {
                                const timeA = new Date(a.createdAt).getTime() || 0;
                                const timeB = new Date(b.createdAt).getTime() || 0;
                                if (timeB !== timeA) return timeB - timeA;
                                return b.id.localeCompare(a.id);
                              })
                              .map(c => {
                              const isAuthor = c.authorId === activeUser.id;
                              const isDeleted = Boolean(c.isDeleted);
                              const isEdited = Boolean(c.isEdited);
                              const isLiked = (c.likedBy || []).includes(activeUser.id);
                              const isEditing = editingCommentId === c.id;

                              return (
                                <div
                                  key={c.id}
                                  className={`p-3 bg-card border rounded-xl space-y-1.5 shadow-subtle transition-colors ${
                                    isDeleted
                                      ? 'border-border/40 opacity-75 bg-muted/20'
                                      : 'border-border/70 hover:border-border'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                      {c.authorAvatar ? (
                                        <img
                                          src={c.authorAvatar}
                                          alt={c.authorName}
                                          className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 font-sans">
                                          {c.authorName.charAt(0)}
                                        </div>
                                      )}
                                      <span className="text-xs font-bold text-foreground font-sans">
                                        {c.authorName}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 text-[9px] font-sans font-bold rounded uppercase tracking-wider ${
                                          c.authorRole === 'faculty'
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                            : c.authorRole === 'admin'
                                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                                            : 'bg-muted text-muted-foreground border border-border'
                                        }`}
                                      >
                                        {c.authorRole}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-sans">
                                        • {c.createdAt.includes('T') ? new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : c.createdAt}
                                      </span>

                                      {/* Edited Mark */}
                                      {isEdited && !isDeleted && (
                                        <span
                                          className="px-1.5 py-0.5 text-[9px] font-sans font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded"
                                          title={c.editedAt ? `Edited on ${c.editedAt}` : 'Edited'}
                                        >
                                          (edited)
                                        </span>
                                      )}

                                      {/* Deleted Mark */}
                                      {isDeleted && (
                                        <span
                                          className="px-1.5 py-0.5 text-[9px] font-sans font-bold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/25 rounded"
                                          title={c.deletedAt ? `Deleted on ${c.deletedAt}` : 'Deleted'}
                                        >
                                          Deleted
                                        </span>
                                      )}
                                    </div>

                                    {/* Author-only actions: only the submitter has authority to edit or delete */}
                                    {isAuthor && !isDeleted && !isEditing && (
                                      <div className="flex items-center space-x-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCommentId(c.id);
                                            setEditingContent(c.content);
                                          }}
                                          className="text-muted-foreground hover:text-primary p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                          title="Edit your comment"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            showAlert({
                                              title: 'Delete Comment',
                                              message: 'Are you sure you want to delete this comment? It will be marked as deleted.',
                                              type: 'confirm',
                                              confirmText: 'Delete',
                                              cancelText: 'Cancel',
                                              onConfirm: () => deleteModuleComment(mod.id, c.id)
                                            });
                                          }}
                                          className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                          title="Delete your comment"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Comment Content / Edit Mode / Deleted Placeholder */}
                                  {isDeleted ? (
                                    <p className="text-xs text-muted-foreground font-sans italic leading-relaxed pl-8">
                                      [This comment was deleted by the author]
                                    </p>
                                  ) : isEditing ? (
                                    <div className="pl-8 pt-1 pb-1.5 pr-1 space-y-2">
                                      <textarea
                                        ref={el => {
                                          if (el) {
                                            el.focus();
                                            const len = el.value.length;
                                            el.setSelectionRange(len, len);
                                          }
                                        }}
                                        onFocus={e => {
                                          const len = e.currentTarget.value.length;
                                          e.currentTarget.setSelectionRange(len, len);
                                        }}
                                        value={editingContent}
                                        onChange={e => setEditingContent(e.target.value)}
                                        className="w-full p-2.5 bg-background border border-primary/40 rounded-xl text-xs text-foreground font-sans focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none shadow-inner-soft"
                                        rows={2}
                                      />
                                      <div className="flex items-center space-x-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editingContent.trim()) {
                                              editModuleComment(mod.id, c.id, editingContent);
                                              setEditingCommentId(null);
                                            }
                                          }}
                                          disabled={!editingContent.trim()}
                                          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold font-sans rounded-lg transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Save</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingCommentId(null)}
                                          className="px-3 py-1 text-muted-foreground hover:bg-muted text-xs font-bold font-sans rounded-lg transition-colors cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-foreground font-sans leading-relaxed pl-8">
                                      {c.content}
                                    </p>
                                  )}

                                  {/* Like button only for active, non-deleted comments */}
                                  {!isDeleted && !isEditing && (
                                    <div className="flex items-center space-x-3 pl-8 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => toggleLikeModuleComment(mod.id, c.id)}
                                        className={`flex items-center space-x-1 text-[11px] font-bold font-sans transition-colors cursor-pointer ${
                                          isLiked
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                        <span>{(c.likes || 0) > 0 ? c.likes : 'Like'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Comment composer form */}
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            const text = (commentInputs[mod.id] || '').trim();
                            if (!text) return;
                            addModuleComment(mod.id, text);
                            setCommentInputs(prev => ({ ...prev, [mod.id]: '' }));
                          }}
                          className="flex items-center space-x-2.5 p-1.5 pb-2"
                        >
                          <input
                            type="text"
                            value={commentInputs[mod.id] || ''}
                            onChange={e =>
                              setCommentInputs(prev => ({ ...prev, [mod.id]: e.target.value }))
                            }
                            placeholder={`Post a comment on ${mod.title}...`}
                            className="flex-1 px-3.5 py-2.5 text-xs bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground placeholder:text-muted-foreground font-sans focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-subtle"
                          />
                          <button
                            type="submit"
                            disabled={!(commentInputs[mod.id] || '').trim()}
                            className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-xs font-bold font-sans rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0 active:scale-[0.98]"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Post</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* Modal: Add Learning Unit Module */}
      <AnimatedModal
        isOpen={isAddModuleOpen}
        onClose={() => setIsAddModuleOpen(false)}
        panelClassName="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10"
      >
        {({ startClose }) => (
          <>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground font-sans">Add New Learning Unit Module</h3>
              <button
                type="button"
                onClick={startClose}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1 font-sans">Module Title *</label>
                <input
                  type="text"
                  required
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  placeholder="e.g. Unit 3: Advanced Frontend Engineering"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 font-bold font-sans text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold font-sans bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-subtle cursor-pointer"
                >
                  Add Unit Module
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>

      {/* Modal: In-Browser Document Previewer */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-elevated overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-card border border-border text-primary shadow-subtle">
                  {getItemIcon(previewItem.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-sans">{previewItem.title}</h3>
                  <div className="flex items-center space-x-2 text-[10px] font-sans font-medium text-muted-foreground">
                    {previewItem.fileName && <span>{previewItem.fileName}</span>}
                    {previewItem.fileSize && <span>• {previewItem.fileSize}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewItem)}
                  className="px-3 py-1.5 text-xs font-bold font-sans bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {/* Image Preview */}
              {previewItem.fileName &&
                /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(previewItem.fileName) &&
                previewItem.fileUrl && (
                  <div className="rounded-xl overflow-hidden border border-border max-h-[400px] flex items-center justify-center bg-black/20">
                    <img
                      src={previewItem.fileUrl}
                      alt={previewItem.fileName}
                      className="max-h-[380px] w-auto object-contain rounded-lg"
                    />
                  </div>
                )}

              {/* Text / Instructions Content */}
              {previewItem.content && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-sans text-muted-foreground uppercase tracking-wider">
                    Instructions & Reading Guidelines
                  </h4>
                  <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs text-foreground leading-relaxed whitespace-pre-line font-sans">
                    {previewItem.content}
                  </div>
                </div>
              )}

              {/* Attached file summary banner if not an image */}
              {previewItem.fileName &&
                !/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(previewItem.fileName) && (
                  <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center">
                        {getAttachmentIcon(previewItem.fileName)}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-foreground block font-sans">
                          {previewItem.fileName}
                        </span>
                        <span className="text-[10px] font-sans text-muted-foreground">
                          {previewItem.fileSize || 'Document file'} • Attached to module
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewItem)}
                      className="text-xs font-bold font-sans text-primary hover:underline cursor-pointer"
                    >
                      Download File
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
