import React from 'react';
import { useLMS } from '../context/LMSContext';
import {
  FileText,
  FileCheck2,
  HelpCircle,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Plus
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
  const { activeRole, db, toggleModulePublish, toggleItemCompletion } = useLMS();

  const courseModules = db.modules.filter(m => m.courseId === courseId);
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({
    'mod-131-1': true,
    'mod-131-2': true,
    'mod-150-1': true
  });

  const toggleExpand = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
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
        return <FileText className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Course Modules & Learning Units
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            CHED CMO 25 s. 2015 Outcome-Based Learning Units
          </p>
        </div>

        {/* Faculty Controls */}
        {activeRole === 'faculty' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => alert("Creating new CHED unit module...")}
              className="px-3 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-1"
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
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
            No published modules available for this course section yet.
          </div>
        ) : (
          courseModules.map(mod => {
            const isExpanded = expandedModules[mod.id] ?? true;

            // Hide draft modules from students
            if (!mod.published && activeRole === 'student') return null;

            return (
              <div
                key={mod.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs"
              >
                {/* Module Header Bar */}
                <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleExpand(mod.id)}
                      className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {mod.title}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Faculty Toggle Published */}
                    {activeRole === 'faculty' && (
                      <button
                        onClick={() => toggleModulePublish(mod.id)}
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border transition-colors ${
                          mod.published
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {mod.published ? 'PUBLISHED' : 'DRAFT'}
                      </button>
                    )}

                    <span className="text-[11px] font-mono text-zinc-500">
                      {mod.items.length} Items
                    </span>
                  </div>
                </div>

                {/* Module Items List */}
                {isExpanded && (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {mod.items.map(item => (
                      <div
                        key={item.id}
                        className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-950/60 flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          {/* Completion Checkbox for Student */}
                          {activeRole === 'student' ? (
                            <button
                              onClick={() => toggleItemCompletion(mod.id, item.id)}
                              className="text-zinc-400 hover:text-emerald-600 transition-colors"
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-400" />
                              )}
                            </button>
                          ) : (
                            getItemIcon(item.type)
                          )}

                          <div>
                            <button
                              onClick={() => {
                                if (item.assignmentId) onSelectAssignment(item.assignmentId);
                                else if (item.quizId) onSelectQuiz(item.quizId);
                                else alert(`Viewing module content: ${item.title}`);
                              }}
                              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-red-700 dark:hover:text-red-400 text-left transition-colors"
                            >
                              {item.title}
                            </button>
                            {item.completionCondition && (
                              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                Requirement: Must {item.completionCondition.replace('_', ' ')}
                                {item.minScore ? ` (>= ${item.minScore}%)` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700">
                            {item.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
