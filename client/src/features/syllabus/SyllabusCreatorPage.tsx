import React, { useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { useSyllabusDraftsStorage, createBaselineSyllabus } from './hooks/useSyllabusDraftsStorage';
import { SyllabusWizard } from './components/creator/SyllabusWizard';
import { SyllabusStarterModal } from './components/creator/SyllabusStarterModal';
import { AttachToCourseModal } from './components/creator/AttachToCourseModal';
import { scanSyllabusDocument } from '../../shared/utils/syllabusParser';
import type { OfficialSyllabusData } from '../../shared/data/syllabusData';
import {
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface SyllabusCreatorPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const SyllabusCreatorPage: React.FC<SyllabusCreatorPageProps> = ({ onNavigateTab: _onNavigateTab }) => {
  const { activeRole } = useLMS();
  const {
    drafts,
    activeDraft,
    activeDraftId,
    selectDraft,
    createDraft,
    updateActiveDraft,
    cloneDraft,
    deleteDraft
  } = useSyllabusDraftsStorage();

  const [isStarterOpen, setIsStarterOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);

  // RBAC Access Gate (Review Focus 5)
  if (!['superadmin', 'admin', 'faculty'].includes(activeRole as any)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md w-full p-8 text-center bg-card border border-border rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Syllabus Creator is an academic authoring tool restricted to faculty and academic leadership. If you need access, please consult your department chairperson.
          </p>
        </div>
      </div>
    );
  }

  const handleSelectBlank = () => {
    createDraft(undefined, 'New Standard Syllabus');
  };

  const handleSelectClone = (sourceSyllabus: OfficialSyllabusData, title: string) => {
    createDraft(sourceSyllabus, `Copy of ${title}`);
  };

  const handleImportFile = async (file: File) => {
    const scanResult = await scanSyllabusDocument(file);
    const baseline = createBaselineSyllabus();

    const detectedInstructor = scanResult.detectedFacultyNames?.[0];

    const mergedData: OfficialSyllabusData = {
      ...baseline,
      courseInfo: {
        ...baseline.courseInfo,
        code: scanResult.detectedCourseCode || baseline.courseInfo.code,
        title: scanResult.detectedCourseTitle || baseline.courseInfo.title
      },
      facultyMembers: detectedInstructor
        ? [
            {
              name: detectedInstructor,
              sections: baseline.facultyMembers[0]?.sections || [],
              consultation: baseline.facultyMembers[0]?.consultation || ''
            }
          ]
        : baseline.facultyMembers
    };

    createDraft(mergedData, `${scanResult.detectedCourseCode || 'Imported'} Syllabus`);
  };

  return (
    <div className="flex-1 min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Header & Draft Management Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Academic Authoring Studio</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Syllabus Creator
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Design, standardize, and export official university course syllabi matching the DMMMSU-INS-F003 institutional standard.
          </p>
        </div>

        {/* Draft Selection & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Draft Picker */}
          <div className="relative">
            <select
              value={activeDraftId}
              onChange={e => selectDraft(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs focus:ring-1 focus:ring-primary outline-none max-w-[200px] truncate"
              title="Select Active Draft"
            >
              {drafts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>

          {/* Clone Draft */}
          {activeDraft && (
            <button
              type="button"
              onClick={() => cloneDraft(activeDraft.id)}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Clone active draft"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Delete Draft */}
          {drafts.length > 1 && activeDraft && (
            <button
              type="button"
              onClick={() => deleteDraft(activeDraft.id)}
              className="p-2 rounded-xl border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              title="Delete active draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* New Syllabus Button */}
          <button
            type="button"
            onClick={() => setIsStarterOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Syllabus</span>
          </button>
        </div>
      </div>

      {/* Auto-saved Notice Banner */}
      {activeDraft && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-muted/30 border border-border/70 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Editing draft: <strong className="text-foreground">{activeDraft.title}</strong></span>
          </div>
          <span className="text-[11px]">
            Autosaved {new Date(activeDraft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Wizard Orchestrator */}
      {activeDraft && (
        <SyllabusWizard
          syllabusData={activeDraft.data}
          onChange={updateActiveDraft}
          onAttachCourse={() => setIsAttachOpen(true)}
        />
      )}

      {/* Modals */}
      <SyllabusStarterModal
        isOpen={isStarterOpen}
        onClose={() => setIsStarterOpen(false)}
        onSelectBlank={handleSelectBlank}
        onSelectClone={handleSelectClone}
        onImportFile={handleImportFile}
        availableDrafts={drafts}
      />

      {activeDraft && (
        <AttachToCourseModal
          isOpen={isAttachOpen}
          onClose={() => setIsAttachOpen(false)}
          syllabusData={activeDraft.data}
        />
      )}
    </div>
  );
};
