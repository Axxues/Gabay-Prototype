import React, { useEffect, useRef } from 'react';
import { useLMS } from '../../context/LMSContext';
import { History, X, Clock, ExternalLink } from 'lucide-react';

export const HistoryDrawer: React.FC = () => {
  const { isHistoryDrawerOpen, setIsHistoryDrawerOpen, db, setActiveCourseId } = useLMS();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHistoryDrawerOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsHistoryDrawerOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHistoryDrawerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHistoryDrawerOpen, setIsHistoryDrawerOpen]);

  if (!isHistoryDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 1. Backdrop Overlay: Click anywhere outside closes the drawer */}
      <div
        className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
        onClick={() => setIsHistoryDrawerOpen(false)}
        aria-label="Close history drawer"
      />

      {/* 2. Slide-over Panel Container */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
        <div
          ref={drawerRef}
          className="w-screen max-w-md bg-card border-l border-border shadow-elevated flex flex-col h-full animate-slide-in-right pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 backdrop-blur-md">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 border border-pink-500/20">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground">
                  Session Navigation Trail
                </h2>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Audit logs for current session
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <p className="text-xs text-muted-foreground mb-4 font-medium">
              Recently visited GABAY LMS views in your current browser session:
            </p>

            {db.historyLogs.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
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
                  className="group p-3.5 bg-card border border-border rounded-xl hover:border-pink-500/40 cursor-pointer card-hover shadow-soft transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-pink-700 dark:group-hover:text-pink-400 transition-colors">
                        {log.title}
                      </h4>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {log.path}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-pink-700 dark:group-hover:text-pink-400 transition-colors shrink-0 ml-2" />
                  </div>
                  <div className="mt-2.5 flex items-center space-x-1 text-[10px] text-muted-foreground font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-border bg-muted/40 text-[11px] font-mono text-muted-foreground text-center">
            Canvas LMS Audit Trail Engine • GABAY System
          </div>
        </div>
      </div>
    </div>
  );
};
