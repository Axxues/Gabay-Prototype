import React, { useEffect, useRef } from 'react';
import { useLMS } from '../../context/LMSContext';
import { HelpCircle, X, BookOpen, Mail, Shield, RefreshCw, FileText } from 'lucide-react';

export const HelpDrawer: React.FC = () => {
  const { isHelpDrawerOpen, setIsHelpDrawerOpen, resetData } = useLMS();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHelpDrawerOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsHelpDrawerOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHelpDrawerOpen(false);
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
  }, [isHelpDrawerOpen, setIsHelpDrawerOpen]);

  if (!isHelpDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 1. Backdrop Overlay: Click anywhere outside closes the drawer */}
      <div
        className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
        onClick={() => setIsHelpDrawerOpen(false)}
        aria-label="Close help drawer"
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
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground">
                  Institutional Help Guide
                </h2>
                <p className="text-[10px] font-mono text-muted-foreground">
                  DMMMSU-SLUC Academic Resources
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsHelpDrawerOpen(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-muted-foreground">
            {/* Quick Links */}
            <div className="space-y-2">
              <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                DMMMSU-SLUC Technical Support
              </h3>
              <div className="space-y-2">
                <a
                  href="#manual"
                  onClick={(e) => { e.preventDefault(); alert("Opening GABAY User Manual PDF..."); }}
                  className="flex items-center space-x-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-all text-foreground font-bold shadow-soft card-hover"
                >
                  <BookOpen className="w-4 h-4 text-pink-700 dark:text-pink-400 shrink-0" />
                  <span>GABAY LMS Faculty & Student User Manual</span>
                </a>
                <a
                  href="#support"
                  onClick={(e) => { e.preventDefault(); alert("Contacting DMMMSU ICT Helpdesk: it.support@dmmmsu.edu.ph"); }}
                  className="flex items-center space-x-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-all text-foreground font-bold shadow-soft card-hover"
                >
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>DMMMSU ICT Services Ticketing Desk</span>
                </a>
              </div>
            </div>

            {/* CHED Standards */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-foreground">
                <FileText className="w-4 h-4 text-pink-700 dark:text-pink-400" />
                <span>CHED CMO 25 s. 2015 Compliance</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This LMS module strictly enforces outcome-based education (OBE) curriculum mapping for BS Computer Science programs.
              </p>
            </div>

            {/* Security */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-foreground">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Data Privacy Act (RA 10173) Guard</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Student gradebooks, quiz responses, and private feedback are encrypted and restricted per role permissions.
              </p>
            </div>

            {/* Prototype Reset */}
            <div className="pt-4 border-t border-border space-y-2.5">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Prototype Utilities
              </h4>
              <p className="text-[11px]">
                Reset mock database to initial seed state (clears custom LocalStorage entries).
              </p>
              <button
                onClick={() => {
                  if (confirm("Reset prototype data back to initial seed state?")) {
                    resetData();
                    setIsHelpDrawerOpen(false);
                    alert("Database reset successfully!");
                  }
                }}
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-bold bg-pink-700 hover:bg-pink-800 text-white rounded-xl transition-all shadow-subtle active:scale-[0.98]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Mock Seed Database</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-border bg-muted/40 text-[11px] font-mono text-muted-foreground text-center">
            DMMMSU-SLUC College of Computer Science
          </div>
        </div>
      </div>
    </div>
  );
};
