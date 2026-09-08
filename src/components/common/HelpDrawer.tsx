import React from 'react';
import { useLMS } from '../../context/LMSContext';
import { HelpCircle, X, BookOpen, Mail, Shield, RefreshCw, FileText } from 'lucide-react';

export const HelpDrawer: React.FC = () => {
  const { isHelpDrawerOpen, setIsHelpDrawerOpen, resetData } = useLMS();

  if (!isHelpDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-red-700 dark:text-red-400" />
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100">
                Institutional Help & Resource Guide
              </h2>
            </div>
            <button
              onClick={() => setIsHelpDrawerOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-zinc-600 dark:text-zinc-400">
            {/* Quick Links */}
            <div className="space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                DMMMSU-SLUC Technical Support
              </h3>
              <div className="space-y-2">
                <a
                  href="#manual"
                  onClick={(e) => { e.preventDefault(); alert("Opening GABAY User Manual PDF..."); }}
                  className="flex items-center space-x-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-900 dark:text-zinc-100 font-semibold"
                >
                  <BookOpen className="w-4 h-4 text-red-700 dark:text-red-400" />
                  <span>GABAY LMS Faculty & Student User Manual</span>
                </a>
                <a
                  href="#support"
                  onClick={(e) => { e.preventDefault(); alert("Contacting DMMMSU ICT Helpdesk: it.support@dmmmsu.edu.ph"); }}
                  className="flex items-center space-x-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-900 dark:text-zinc-100 font-semibold"
                >
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>DMMMSU ICT Services Ticketing Desk</span>
                </a>
              </div>
            </div>

            {/* CHED Standards */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-zinc-900 dark:text-zinc-100">
                <FileText className="w-4 h-4 text-red-700 dark:text-red-400" />
                <span>CHED CMO 25 s. 2015 Compliance</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This LMS module strictly enforces outcome-based education (OBE) curriculum mapping for BS Computer Science programs.
              </p>
            </div>

            {/* Security */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-zinc-900 dark:text-zinc-100">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Data Privacy Act (RA 10173) Guard</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Student gradebooks, quiz responses, and private feedback are encrypted and restricted per role permissions.
              </p>
            </div>

            {/* Prototype Reset */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
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
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Mock Seed Database</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 text-center">
            DMMMSU-SLUC College of Computer Science
          </div>
        </div>
      </div>
    </div>
  );
};
