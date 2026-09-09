import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  FileText,
  FileCheck2,
  HelpCircle,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Plus,
  X
} from 'lucide-react';

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
    db,
    toggleModulePublish,
    toggleItemCompletion,
    createModule,
    addModuleItem
  } = useLMS();

  const courseModules = db.modules.filter(m => m.courseId === courseId);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'mod-131-1': true,
    'mod-131-2': true,
    'mod-150-1': true
  });

  // Modal states
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const [activeAddItemId, setActiveAddItemId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<'page' | 'assignment' | 'quiz' | 'external_url'>('page');
  const [newItemContent, setNewItemContent] = useState('');

  const toggleExpand = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;

    createModule(courseId, newModuleTitle.trim());
    setNewModuleTitle('');
    setIsAddModuleOpen(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAddItemId || !newItemTitle.trim()) return;

    addModuleItem(activeAddItemId, {
      title: newItemTitle.trim(),
      type: newItemType,
      content: newItemContent.trim() || 'Unit content aligned with CHED CMO 25 s. 2015 curriculum guidelines.',
      published: true,
      required: false
    });

    setActiveAddItemId(null);
    setNewItemTitle('');
    setNewItemContent('');
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'page':
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'assignment':
        return <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Course Modules & Learning Units
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            CHED CMO 25 s. 2015 Outcome-Based Learning Units
          </p>
        </div>

        {(activeRole === 'faculty' || activeRole === 'admin') && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAddModuleOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Unit Module</span>
            </button>
          </div>
        )}
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {courseModules.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-2xl border border-border text-xs text-muted-foreground">
            No published modules available for this course section yet.
          </div>
        ) : (
          courseModules.map(mod => {
            const isExpanded = expandedModules[mod.id] ?? true;

            if (!mod.published && activeRole === 'student') return null;

            return (
              <div
                key={mod.id}
                className="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden shadow-subtle transition-all"
              >
                {/* Header Bar */}
                <div className="px-5 py-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleExpand(mod.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {mod.title}
                      </h3>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {mod.items.length} learning resources attached
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    {(activeRole === 'faculty' || activeRole === 'admin') && (
                      <>
                        <button
                          onClick={() => setActiveAddItemId(mod.id)}
                          className="px-2.5 py-1 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Item</span>
                        </button>

                        <button
                          onClick={() => toggleModulePublish(mod.id)}
                          className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-colors cursor-pointer ${
                            mod.published
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          {mod.published ? 'Published' : 'Draft'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Items List */}
                {isExpanded && (
                  <div className="divide-y divide-border">
                    {mod.items.length === 0 ? (
                      <div className="p-5 text-center text-xs text-muted-foreground italic">
                        No learning items in this unit yet.
                      </div>
                    ) : (
                      mod.items.map(item => (
                        <div
                          key={item.id}
                          className="px-6 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                        >
                          <div
                            className="flex items-center space-x-3.5 cursor-pointer flex-1"
                            onClick={() => {
                              if (item.type === 'assignment' && item.assignmentId) {
                                onSelectAssignment(item.assignmentId);
                              } else if (item.type === 'quiz' && item.quizId) {
                                onSelectQuiz(item.quizId);
                              } else {
                                alert(`Opening "${item.title}":\n\n${item.content || 'No text content.'}`);
                              }
                            }}
                          >
                            <div className="p-2 rounded-xl bg-muted border border-border shrink-0">
                              {getItemIcon(item.type)}
                            </div>
                            <div>
                              <span className="font-bold text-foreground hover:text-pink-700 dark:hover:text-pink-400 transition-colors">
                                {item.title}
                              </span>
                              <div className="text-[10px] font-mono text-muted-foreground capitalize mt-0.5">
                                Type: {item.type} {item.required && '• Required Milestone'}
                              </div>
                            </div>
                          </div>

                          {/* Completion Badge or Checkbox */}
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleItemCompletion(mod.id, item.id)}
                              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              title={item.completed ? 'Mark uncompleted' : 'Mark completed'}
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Unit Module */}
      {isAddModuleOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
            onClick={() => setIsAddModuleOpen(false)}
          />

          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Add New Learning Unit Module</h3>
              <button
                onClick={() => setIsAddModuleOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Module Title *</label>
                <input
                  type="text"
                  required
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  placeholder="e.g. Unit 3: Advanced Frontend Engineering"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModuleOpen(false)}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer"
                >
                  Add Unit Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Module Item */}
      {activeAddItemId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
            onClick={() => setActiveAddItemId(null)}
          />

          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Add Resource to Module</h3>
              <button
                onClick={() => setActiveAddItemId(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Resource Type</label>
                <select
                  value={newItemType}
                  onChange={e => setNewItemType(e.target.value as any)}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground"
                >
                  <option value="page">Lecture Note / Reading Page</option>
                  <option value="assignment">Assignment Milestone</option>
                  <option value="quiz">Assessment Quiz</option>
                  <option value="external_url">External Reference Link</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Resource Title *</label>
                <input
                  type="text"
                  required
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  placeholder="e.g. Lab Guide: Component Lifecycle & Hooks"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Content / URL Notes</label>
                <textarea
                  rows={3}
                  value={newItemContent}
                  onChange={e => setNewItemContent(e.target.value)}
                  placeholder="Lecture notes, references, or instructions..."
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveAddItemId(null)}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
