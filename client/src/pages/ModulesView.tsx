import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { Module, ModuleItem } from '../types/lms';
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
import { ModalPortal } from '../components/common/ModalPortal';
import { groupRepliesByRoot } from '../utils/threadReplies';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
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
    updateModule,
    deleteModule,
    deleteModuleItem,
    showAlert,
    showConfirm,
    addModuleComment,
    editModuleComment,
    deleteModuleComment,
    toggleLikeModuleComment,
    markModuleCommentsRead
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

  // Second-layer reply composer state per module (reply target id + draft text)
  const [replyToIds, setReplyToIds] = useState<Record<string, string | null>>({});
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // Module Comment Editing State (Author only)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  // Modal states
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  // Editing Module state
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');

  // Page Navigation State for Adding / Editing Module Item
  const [addingItemModuleId, setAddingItemModuleId] = useState<string | null>(null);
  const [editingItemState, setEditingItemState] = useState<{ item: ModuleItem; moduleId: string } | null>(null);

  // Document Preview Modal State
  const [previewItem, setPreviewItem] = useState<ModuleItem | null>(null);

  // Permission helpers (Only faculty can author and edit course modules)
  const canEditModule = (mod: Module) => {
    if (activeRole === 'faculty') {
      return !mod.authorId || mod.authorId === activeUser.id || activeUser.role === 'faculty';
    }
    return false;
  };

  const canEditItem = (mod: Module, item: ModuleItem) => {
    if (activeRole === 'faculty') {
      return !item.authorId || item.authorId === activeUser.id || !mod.authorId || mod.authorId === activeUser.id || activeUser.role === 'faculty';
    }
    return false;
  };

  const toggleExpand = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const toggleCommentsExpand = (modId: string) => {
    setExpandedComments(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;

    try {
      await createModule(courseId, newModuleTitle.trim());
      setNewModuleTitle('');
      setIsAddModuleOpen(false);
    } catch {
      // Context already surfaced the failure alert.
    }
  };

  const handleStartEditModule = (mod: Module, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingModule(mod);
    setEditModuleTitle(mod.title);
  };

  const handleSaveEditModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule || !editModuleTitle.trim()) return;
    try {
      await updateModule(editingModule.id, { title: editModuleTitle.trim() });
      showAlert({
        title: 'Module Updated',
        message: `Module title updated to "${editModuleTitle.trim()}".`,
        type: 'success'
      });
      setEditingModule(null);
    } catch {
      // Context already surfaced the failure alert.
    }
  };

  const handleDeleteModule = (mod: Module, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      `Are you sure you want to delete module "${mod.title}" and all its learning resources?`,
      () => {
        const deletedTitle = mod.title;
        const deletedId = mod.id;
        deleteModule(mod.id)
          .then(() => {
            if (editingModule?.id === deletedId) {
              setEditingModule(null);
            }
            showAlert({
              title: 'Module Deleted',
              message: `Module "${deletedTitle}" has been deleted.`,
              type: 'success'
            });
          })
          .catch(() => {});
      },
      'Delete Module'
    );
  };

  const handleDeleteItem = (mod: Module, item: ModuleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      `Are you sure you want to remove "${item.title}" from ${mod.title}?`,
      () => {
        const removedTitle = item.title;
        const removedId = item.id;
        deleteModuleItem(mod.id, item.id)
          .then(() => {
            if (previewItem?.id === removedId) {
              setPreviewItem(null);
            }
            showAlert({
              title: 'Item Removed',
              message: `"${removedTitle}" has been removed from the module.`,
              type: 'success'
            });
          })
          .catch(() => {});
      },
      'Remove Item'
    );
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

  // If user clicked "Edit Item", render the dedicated full page in edit mode!
  if (editingItemState) {
    return (
      <AddModuleItemPage
        courseId={courseId}
        moduleId={editingItemState.moduleId}
        editingItem={editingItemState.item}
        onBack={() => setEditingItemState(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header Toolbar */}
      <PageHeader
        title="Modules"
        description="Course learning units, syllabus readings, and downloadable laboratory materials."
        actions={
          activeRole === 'faculty' && (
            <button
              type="button"
              onClick={() => {
                setIsAddModuleOpen(prev => !prev);
                if (isAddModuleOpen) {
                  setNewModuleTitle('');
                }
              }}
              className="px-3.5 py-2 text-xs font-bold font-sans bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Module</span>
            </button>
          )
        }
      />

      {/* Inline Add Module Input Form at the Top Part */}
      {isAddModuleOpen && activeRole === 'faculty' && (
        <form
          onSubmit={handleCreateModule}
          className="p-4 bg-card border border-primary/40 rounded-2xl shadow-subtle animate-fade-in space-y-3"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold font-sans text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Module Title</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsAddModuleOpen(false);
                setNewModuleTitle('');
              }}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              autoFocus
              required
              value={newModuleTitle}
              onChange={e => setNewModuleTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsAddModuleOpen(false);
                  setNewModuleTitle('');
                }
              }}
              placeholder="e.g. Unit 3: Advanced Frontend Engineering"
              className="flex-1 px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground font-sans placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <div className="flex items-center space-x-2 shrink-0 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAddModuleOpen(false);
                  setNewModuleTitle('');
                }}
                className="px-3.5 py-2 text-xs font-bold font-sans text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newModuleTitle.trim()}
                className="px-4 py-2 text-xs font-bold font-sans bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-primary-foreground rounded-xl transition-all shadow-subtle cursor-pointer flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Module</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Modules List */}
      <div className="space-y-4">
        {sortedModules.length === 0 ? (
          <EmptyState
            title="No modules available for this course section yet."
          />
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
                    onClick={() => {
                      if (editingModule?.id !== mod.id) {
                        toggleExpand(mod.id);
                        void markModuleCommentsRead(mod.id).catch(() => {});
                      }
                    }}
                  className={`px-5 py-3.5 bg-muted/40 hover:bg-muted/60 border-b border-border flex items-center justify-between transition-colors select-none group ${editingModule?.id === mod.id ? 'cursor-default' : 'cursor-pointer'
                    }`}
                >
                  {editingModule?.id === mod.id ? (
                    <form
                      onSubmit={handleSaveEditModule}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mr-2 animate-fade-in"
                    >
                      <input
                        type="text"
                        autoFocus
                        required
                        value={editModuleTitle}
                        onChange={e => setEditModuleTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') {
                            setEditingModule(null);
                          }
                        }}
                        placeholder="Module title..."
                        className="flex-1 px-3 py-1.5 bg-background border border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/30 rounded-xl text-xs font-sans text-foreground outline-none transition-all"
                      />
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="submit"
                          disabled={!editModuleTitle.trim()}
                          title="Save Title"
                          className="px-2.5 py-1.5 text-xs font-bold font-sans bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingModule(null)}
                          title="Cancel"
                          className="px-2.5 py-1.5 text-xs font-bold font-sans text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModule(mod)}
                          title="Delete Module"
                          className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center space-x-3">
                        <div className="p-1 text-muted-foreground group-hover:text-foreground rounded-md transition-colors">
                          <ChevronRight
                            className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-90' : 'rotate-0'
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
                        className="flex items-center space-x-1.5 sm:space-x-2"
                        onClick={e => e.stopPropagation()}
                      >
                        {canEditModule(mod) && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleStartEditModule(mod, e)}
                              title="Edit Module Title"
                              className="px-2.5 py-1.5 text-xs font-bold font-sans bg-muted hover:bg-accent text-foreground border border-border rounded-xl transition-all shadow-subtle flex items-center space-x-1 cursor-pointer active:scale-[0.98]"
                            >
                              <Pencil className="w-3.5 h-3.5 text-primary" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

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
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Collapsible Module Content - Animates BOTH Open and Close */}
                <div
                  className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
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
                            className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors text-xs gap-3 group/item"
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

                            {/* Item Actions */}
                            <div
                              className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center"
                              onClick={e => e.stopPropagation()}
                            >
                              {item.fileName && (
                                <>
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
                                </>
                              )}

                              {canEditItem(mod, item) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingItemState({ item, moduleId: mod.id })}
                                    title="Edit Item"
                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => handleDeleteItem(mod, item, e)}
                                    title="Delete Item"
                                    className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
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
                              className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${isCommentsExpanded ? 'rotate-90' : 'rotate-0'
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
                        className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isCommentsExpanded ? 'grid-rows-[1fr] opacity-100 pt-1' : 'grid-rows-[0fr] opacity-0'
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
                              {[...(mod.comments || []).filter(cc => !cc.parentId)]
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
                                  const childThreads = groupRepliesByRoot((mod.comments || []).filter(cc => cc.parentId)).get(c.id) || [];
                                  const moduleReplyToId = replyToIds[mod.id] ?? null;
                                  const moduleReplyText = replyTexts[mod.id] ?? '';
                                  const replyTarget = moduleReplyToId
                                    ? (mod.comments || []).find(p => p.id === moduleReplyToId)
                                    : undefined;
                                  const showComposerHere = Boolean(moduleReplyToId) && (moduleReplyToId === c.id || childThreads.some(ch => ch.id === moduleReplyToId));

                                  return (
                                    <div
                                      key={c.id}
                                      className={`p-3 bg-card border rounded-xl space-y-1.5 shadow-subtle transition-colors ${isDeleted
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
                                            className={`px-1.5 py-0.5 text-[9px] font-sans font-bold rounded uppercase tracking-wider ${c.authorRole === 'faculty'
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
                                                   message: 'Are you sure you want to delete this comment? It will be permanently deleted.',
                                                  type: 'confirm',
                                                  confirmText: 'Delete',
                                                  cancelText: 'Cancel',
                                                  onConfirm: () => {
                                                    void deleteModuleComment(mod.id, c.id).catch(() => {});
                                                  }
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
                                                  void editModuleComment(mod.id, c.id, editingContent)
                                                    .then(() => setEditingCommentId(null))
                                                    .catch(() => {});
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

                                      {/* Like + Reply buttons only for active, non-deleted comments */}
                                      {!isDeleted && !isEditing && (
                                        <div className="flex items-center space-x-3 pl-8 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void toggleLikeModuleComment(mod.id, c.id).catch(() => {});
                                            }}
                                            className={`flex items-center space-x-1 text-[11px] font-bold font-sans transition-colors cursor-pointer ${isLiked
                                              ? 'text-rose-600 dark:text-rose-400'
                                              : 'text-muted-foreground hover:text-foreground'
                                              }`}
                                          >
                                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                            <span>{(c.likes || 0) > 0 ? c.likes : 'Like'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReplyToIds(prev => ({ ...prev, [mod.id]: c.id }));
                                              setReplyTexts(prev => ({ ...prev, [mod.id]: '' }));
                                            }}
                                            className="text-[11px] font-bold font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                          >
                                            Reply
                                          </button>
                                        </div>
                                      )}

                                      {/* Second-layer thread: flattened children indented under the root */}
                                      {childThreads.map(child => {
                                        const directParent = (mod.comments || []).find(p => p.id === child.parentId);
                                        const showMention = directParent && directParent.id !== c.id;
                                        const childIsAuthor = child.authorId === activeUser.id;
                                        const childIsDeleted = Boolean(child.isDeleted);
                                        const childIsEdited = Boolean(child.isEdited);
                                        const childIsLiked = (child.likedBy || []).includes(activeUser.id);
                                        const childIsEditing = editingCommentId === child.id;
                                        return (
                                          <div key={child.id} className="ml-8 border-l border-border pl-3 space-y-1">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                {child.authorAvatar ? (
                                                  <img
                                                    src={child.authorAvatar}
                                                    alt={child.authorName}
                                                    className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
                                                  />
                                                ) : (
                                                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 font-sans">
                                                    {child.authorName.charAt(0)}
                                                  </div>
                                                )}
                                                <span className="text-xs font-bold text-foreground font-sans">
                                                  {child.authorName}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground font-sans">
                                                  · {child.createdAt.includes('T') ? new Date(child.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : child.createdAt}
                                                </span>
                                                {childIsEdited && !childIsDeleted && (
                                                  <span
                                                    className="px-2 py-0.5 text-[11px] font-sans font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-full"
                                                    title={child.editedAt ? `Edited on ${child.editedAt}` : 'Edited'}
                                                  >
                                                    Edited
                                                  </span>
                                                )}
                                                {childIsDeleted && (
                                                  <span
                                                    className="px-2 py-0.5 text-[11px] font-sans font-semibold bg-muted text-muted-foreground border border-border rounded-full"
                                                    title={child.deletedAt ? `Deleted on ${child.deletedAt}` : 'Deleted'}
                                                  >
                                                    Deleted
                                                  </span>
                                                )}
                                              </div>
                                              {childIsAuthor && !childIsDeleted && !childIsEditing && (
                                                <div className="flex items-center space-x-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingCommentId(child.id);
                                                      setEditingContent(child.content);
                                                    }}
                                                    className="text-muted-foreground hover:text-primary p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                                    title="Edit your reply"
                                                  >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      showAlert({
                                                        title: 'Delete Reply',
                                                        message: 'Are you sure you want to delete this reply? It will be permanently deleted.',
                                                        type: 'confirm',
                                                        confirmText: 'Delete',
                                                        cancelText: 'Cancel',
                                                        onConfirm: () => {
                                                          void deleteModuleComment(mod.id, child.id).catch(() => {});
                                                        }
                                                      });
                                                    }}
                                                    className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                                    title="Delete your reply"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            {childIsDeleted ? (
                                              <p className="text-xs text-muted-foreground font-sans italic leading-relaxed">
                                                [This reply was deleted by the author]
                                              </p>
                                            ) : childIsEditing ? (
                                              <div className="pt-1 pb-1.5 pr-1 space-y-2">
                                                <textarea
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
                                                        void editModuleComment(mod.id, child.id, editingContent)
                                                          .then(() => setEditingCommentId(null))
                                                          .catch(() => {});
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
                                              <p className="text-xs text-foreground font-sans leading-relaxed">
                                                {showMention && <span className="font-bold text-primary">@{directParent.authorName} </span>}
                                                {child.content}
                                              </p>
                                            )}
                                            {!childIsDeleted && !childIsEditing && (
                                              <div className="flex items-center space-x-3 pt-0.5">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    void toggleLikeModuleComment(mod.id, child.id).catch(() => {});
                                                  }}
                                                  className={`flex items-center space-x-1 text-[11px] font-bold font-sans transition-colors cursor-pointer ${childIsLiked
                                                    ? 'text-rose-600 dark:text-rose-400'
                                                    : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                  <Heart className={`w-3.5 h-3.5 ${childIsLiked ? 'fill-current' : ''}`} />
                                                  <span>{(child.likes || 0) > 0 ? child.likes : 'Like'}</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setReplyToIds(prev => ({ ...prev, [mod.id]: child.id }));
                                                    setReplyTexts(prev => ({ ...prev, [mod.id]: '' }));
                                                  }}
                                                  className="text-[11px] font-bold font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                >
                                                  Reply
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}

                                      {/* Inline second-layer composer for this thread */}
                                      {showComposerHere && moduleReplyToId && (
                                        <form
                                          onSubmit={e => {
                                            e.preventDefault();
                                            const text = moduleReplyText.trim();
                                            if (!text || !moduleReplyToId) return;
                                            void addModuleComment(mod.id, text, moduleReplyToId)
                                              .then(() => {
                                                setReplyToIds(prev => ({ ...prev, [mod.id]: null }));
                                                setReplyTexts(prev => ({ ...prev, [mod.id]: '' }));
                                              })
                                              .catch(() => {});
                                          }}
                                          className="ml-8 border-l border-border pl-3 pt-1 space-y-2"
                                        >
                                          <p className="text-[11px] font-sans text-muted-foreground">
                                            Reply to <span className="font-bold text-primary">@{replyTarget?.authorName ?? 'comment'}</span>
                                          </p>
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="text"
                                              value={moduleReplyText}
                                              onChange={e =>
                                                setReplyTexts(prev => ({ ...prev, [mod.id]: e.target.value }))
                                              }
                                              placeholder="Write a reply..."
                                              className="flex-1 px-3 py-2 text-xs bg-background border border-border hover:border-primary/40 focus:border-primary rounded-xl text-foreground placeholder:text-muted-foreground font-sans focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-subtle"
                                            />
                                            <button
                                              type="submit"
                                              disabled={!moduleReplyText.trim()}
                                              className="px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-xs font-bold font-sans rounded-xl transition-all shadow-subtle cursor-pointer disabled:cursor-not-allowed shrink-0"
                                            >
                                              Reply
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyToIds(prev => ({ ...prev, [mod.id]: null }));
                                                setReplyTexts(prev => ({ ...prev, [mod.id]: '' }));
                                              }}
                                              className="px-3 py-2 text-muted-foreground hover:bg-muted text-xs font-bold font-sans rounded-xl transition-colors cursor-pointer shrink-0"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </form>
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
                              // Server creates the reply notification inline.
                              void addModuleComment(mod.id, text)
                                .then(() => setCommentInputs(prev => ({ ...prev, [mod.id]: '' })))
                                .catch(() => {});
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

      {/* Modal: In-Browser Document & Resource Previewer (Wide Screen) */}
      {previewItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in select-none">
            <div className="bg-card border border-border rounded-2xl w-[96vw] max-w-[1550px] h-[92vh] max-h-[95vh] shadow-elevated overflow-hidden animate-scale-in flex flex-col">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2.5 rounded-xl bg-card border border-border text-primary shadow-subtle shrink-0">
                    {getItemIcon(previewItem.type)}
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-bold text-foreground font-sans truncate">{previewItem.title}</h3>
                    <div className="flex items-center space-x-2 text-[10px] font-sans font-medium text-muted-foreground truncate">
                      {previewItem.fileName && <span>{previewItem.fileName}</span>}
                      {previewItem.fileSize && <span>• {previewItem.fileSize}</span>}
                      <span>• Full Screen Preview</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  {previewItem.fileName && (
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewItem)}
                      className="px-3.5 py-1.5 text-xs font-bold font-sans bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewItem(null)}
                    className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-background/50 flex flex-col space-y-4 min-h-0">
                {/* Image Preview */}
                {previewItem.fileName &&
                  /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(previewItem.fileName) &&
                  previewItem.fileUrl && (
                    <div className="w-full flex-1 min-h-[300px] rounded-xl overflow-hidden border border-border flex items-center justify-center bg-black/20 p-2 sm:p-4">
                      <img
                        src={previewItem.fileUrl}
                        alt={previewItem.fileName}
                        className="max-w-full max-h-full object-contain rounded-xl shadow-elevated"
                      />
                    </div>
                  )}

                {/* PDF Preview */}
                {previewItem.fileUrl &&
                  (previewItem.fileUrl.startsWith('data:application/pdf') || previewItem.fileUrl.includes('.pdf') || (previewItem.fileName && /\.pdf$/i.test(previewItem.fileName))) && (
                    <iframe
                      src={previewItem.fileUrl}
                      className="w-full flex-1 min-h-[500px] rounded-xl border border-border bg-white"
                      title={previewItem.title}
                    />
                  )}

                {/* Text / Instructions Content */}
                {previewItem.content && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-sans text-muted-foreground uppercase tracking-wider">
                      Instructions & Reading Guidelines
                    </h4>
                    <div className="p-5 bg-card/80 rounded-2xl border border-border text-xs text-foreground leading-relaxed whitespace-pre-line font-sans shadow-subtle">
                      {previewItem.content}
                    </div>
                  </div>
                )}

                {/* Attached file summary banner if not an image and not a pdf */}
                {previewItem.fileName &&
                  !/\.(jpg|jpeg|png|gif|svg|webp|pdf)$/i.test(previewItem.fileName) && (
                    <div className="p-6 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between shadow-subtle gap-4 my-auto max-w-2xl mx-auto w-full">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                          {getAttachmentIcon(previewItem.fileName)}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-foreground block font-sans">
                            {previewItem.fileName}
                          </span>
                          <span className="text-xs font-sans text-muted-foreground">
                            {previewItem.fileSize || 'Document file'} • Attached to module
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(previewItem)}
                        className="px-4 py-2 text-xs font-bold font-sans bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Attached File</span>
                      </button>
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
