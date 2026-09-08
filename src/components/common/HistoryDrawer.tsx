import React from 'react';
import { useLMS } from '../../context/LMSContext';
import { History, X, Clock, ExternalLink } from 'lucide-react';

export const HistoryDrawer: React.FC = () => {
  const { isHistoryDrawerOpen, setIsHistoryDrawerOpen, db, setActiveCourseId } = useLMS();

  if (!isHistoryDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-red-700 dark:text-red-400" />
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100">
                Session Navigation Trail
              </h2>
            </div>
            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Recently visited GABAY LMS views in your current browser session:
            </p>

            {db.historyLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                No recent navigation logs recorded.
              </div>
            ) : (
              db.historyLogs.map(log => (
                <div
                  key={log.id}
                  onClick={() => {
                    if (log.path.includes('/courses/')) {
                      const match = log.path.match(/crs-[a-z0-9]+/);
                      if (match) setActiveCourseId(match[0]);
                    }
                    setIsHistoryDrawerOpen(false);
                  }}
                  className="group p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-red-700/50 dark:hover:border-red-600/50 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                        {log.title}
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {log.path}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center space-x-1 text-[10px] text-zinc-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 text-center">
            Canvas LMS Audit Trail Engine • GABAY System
          </div>
        </div>
      </div>
    </div>
  );
};
