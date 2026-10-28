import React, { useState, useRef } from 'react';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112, createDefaultSyllabusForCourse } from '../../../../shared/data/syllabusData';
import { scanSyllabusDocument } from '../../../../shared/utils/syllabusParser';
import type { SyllabusDraftItem } from '../../types/creator';
import { useLMS } from '../../../../shared/context/LMSContext';
import {
  FileText,
  Copy,
  UploadCloud,
  X,
  Sparkles,
  ArrowRight,
  BookOpen,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface SyllabusStarterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlank: () => void;
  onSelectClone: (sourceSyllabus: OfficialSyllabusData, title: string) => void;
  onImportFile: (file: File) => Promise<void>;
  availableDrafts: SyllabusDraftItem[];
}

export const SyllabusStarterModal: React.FC<SyllabusStarterModalProps> = ({
  isOpen,
  onClose,
  onSelectBlank,
  onSelectClone,
  onImportFile,
  availableDrafts
}) => {
  const { courses = [] } = useLMS();
  const [activeTab, setActiveTab] = useState<'blank' | 'clone' | 'import'>('blank');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMsg(null);
    try {
      await onImportFile(file);
      onClose();
    } catch (err: any) {
      console.error('[SyllabusStarterModal] Parse error:', err);
      setErrorMsg(err?.message || 'Failed to parse syllabus document. Please ensure it is a valid .docx or .pdf file.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80 bg-muted/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Create New Course Syllabus</h3>
              <p className="text-[11px] text-muted-foreground">
                Choose how you want to start authoring your official institutional syllabus.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border/70 bg-muted/20 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('blank')}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'blank'
                ? 'border-primary text-primary bg-background shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Standard Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clone')}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'clone'
                ? 'border-primary text-primary bg-background shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Clone Existing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-primary text-primary bg-background shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import DOCX/PDF</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'blank' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="font-semibold text-xs text-primary flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Institutional Baseline Included</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Starts with pre-loaded DMMMSU Philosophy, Vision, Mission, Goal, Core Values (SERVICE), and standard 18-week course outline. You only fill in course-specific outcomes and learning plans.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectBlank();
                  onClose();
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <span>Start with Standard Blank Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'clone' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Select an existing syllabus from your saved drafts or template catalog to duplicate:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Standard Catalog Template */}
                <div
                  onClick={() => {
                    onSelectClone(OFFICIAL_SYLLABUS_CSPC112, 'Software Engineering 2 (Template)');
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-border hover:border-primary bg-card transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      CSPC 112 – Software Engineering 2
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Standard Institutional Sample Template • Full 5-Part Model
                    </div>
                  </div>
                  <span className="text-[11px] text-primary font-semibold">Clone</span>
                </div>

                {/* Saved Drafts */}
                {availableDrafts.map(d => (
                  <div
                    key={d.id}
                    onClick={() => {
                      onSelectClone(d.data, d.title);
                      onClose();
                    }}
                    className="p-3 rounded-xl border border-border hover:border-primary bg-card transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {d.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Last edited: {new Date(d.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[11px] text-primary font-semibold">Clone</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary rounded-2xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                  {isParsing ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    {isParsing ? 'Extracting syllabus content...' : 'Click to upload .docx or .pdf file'}
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    The document scanner extracts course information, outcomes, and modules to automatically populate wizard steps.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
                  {errorMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
