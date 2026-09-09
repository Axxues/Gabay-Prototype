import React, { useState, useMemo, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../data/syllabusData';
import { scanSyllabusDocument, formatBytes, type ScanResult } from '../utils/syllabusParser';
import {
  BookOpen,
  ChevronDown,
  Layers,
  Award,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Printer,
  Search,
  Users,
  Compass,
  FileSpreadsheet,
  FileText,
  Clock,
  Shield,
  Maximize2,
  Minimize2,
  UploadCloud,
  Check,
  AlertCircle,
  X,
  RotateCcw,
  Loader2
} from 'lucide-react';

interface SyllabusViewProps {
  courseId: string;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ courseId }) => {
  const { db, activeRole, updateCourseSyllabus, showAlert } = useLMS();
  const currentCourse = db.courses.find(c => c.id === courseId);
  const data = currentCourse?.syllabus || OFFICIAL_SYLLABUS_CSPC112;
  const isCustomSyllabus = Boolean(currentCourse?.syllabus);
  const isFacultyOrAdmin = activeRole === 'faculty' || activeRole === 'admin';

  // Upload & Scanner Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible Accordion State - MINIMIZED BY DEFAULT as requested!
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState<string>('all');

  const processFile = async (file: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setScanError('Please select a valid .pdf or .docx syllabus file.');
      return;
    }

    setScanError(null);
    setIsScanning(true);
    setScanProgress(10);
    setScanLogs([`Selected file: ${file.name} (${formatBytes(file.size)})`]);
    setScanStepText(`Initializing parser for ${file.name}...`);

    try {
      const result = await scanSyllabusDocument(file, (progress, step) => {
        setScanProgress(progress);
        setScanStepText(step);
        setScanLogs(prev => [...prev.slice(-4), step]);
      });
      setScanResult(result);
      setScanLogs(prev => [...prev, 'Scan completed and verified against CHED/DMMMSU standards.']);
    } catch (err: any) {
      setScanError(err?.message || 'Error occurred while scanning document. Please check the file.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApplySyllabus = () => {
    if (!scanResult) return;
    updateCourseSyllabus(courseId, scanResult.syllabus);
    showAlert({
      title: 'Syllabus Updated Successfully',
      message: `Course syllabus has been synchronized with scanned document: "${scanResult.fileName}". All 18 weeks, rubrics, and outcomes are active.`,
      type: 'success'
    });
    setIsUploadModalOpen(false);
    setScanResult(null);
  };

  const handleResetToDefault = () => {
    updateCourseSyllabus(courseId, OFFICIAL_SYLLABUS_CSPC112);
    showAlert({
      title: 'Syllabus Reset',
      message: 'Course syllabus restored to the standard institutional template.',
      type: 'info'
    });
  };


  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {
      facultySchedule: true,
      vgmo: true,
      programOutcomes: true,
      courseOutcomes: true,
      gradingSystem: true,
      projectRubrics: true,
      classroomPolicies: true,
      courseOutline: true,
      learningPlan: true,
      curriculumMap: true,
      referencesSignatures: true
    };
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const expandedCount = useMemo(() => {
    return Object.values(expandedSections).filter(Boolean).length;
  }, [expandedSections]);

  const totalSections = 11;

  // Filtered learning plan based on search query
  const filteredLearningPlan = useMemo(() => {
    if (!searchQuery.trim()) {
      if (activeWeekTab === 'all') return data.learningPlan;
      if (activeWeekTab === 'prelim') return data.learningPlan.slice(0, 5);
      if (activeWeekTab === 'midterm') return data.learningPlan.slice(5, 10);
      if (activeWeekTab === 'finals') return data.learningPlan.slice(10);
      return data.learningPlan;
    }
    const q = searchQuery.toLowerCase();
    return data.learningPlan.filter(
      item =>
        item.week.toLowerCase().includes(q) ||
        item.topics.some(t => t.toLowerCase().includes(q)) ||
        item.learningOutcomes.some(lo => lo.toLowerCase().includes(q)) ||
        item.methodology.some(m => m.toLowerCase().includes(q)) ||
        item.assessment.some(a => a.toLowerCase().includes(q)) ||
        (item.sdgCoherence && item.sdgCoherence.title.toLowerCase().includes(q))
    );
  }, [searchQuery, activeWeekTab, data.learningPlan]);

  const handlePrint = () => {
    expandAll();
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-20 px-1 font-sans">
      {/* =========================================================
          TOP BANNER: Official University & Syllabus Metadata
          ========================================================= */}
      <div className="p-6 sm:p-7 bg-card border border-border rounded-2xl shadow-subtle space-y-5 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-sans font-black uppercase tracking-wider bg-primary/10 text-primary rounded-full border border-primary/20">
                Official College Syllabus
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded-md border border-border">
                {data.institution.formCode} &bull; {data.institution.revision}
              </span>
              {isCustomSyllabus && (
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Scanned & Synced
                </span>
              )}
            </div>

            <div className="pt-1">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {data.institution.university} &bull; {data.institution.college}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-1">
                {data.courseInfo.code}: {data.courseInfo.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-muted-foreground font-medium pt-0.5">
              <span>{currentCourse?.term || data.courseInfo.semester}, AY {data.courseInfo.academicYear}</span>
              <span>&bull;</span>
              <span className="text-foreground font-bold">{data.courseInfo.credit}</span>
              <span>({data.courseInfo.lectureHours}, {data.courseInfo.labHours})</span>
              <span>&bull;</span>
              <span>Prereq: <strong className="text-foreground">{data.courseInfo.prerequisite}</strong></span>
              {currentCourse?.section && (
                <>
                  <span>&bull;</span>
                  <span>Enrolled: <strong className="text-primary font-bold">Section {currentCourse.section}</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-start shrink-0 pt-1">
            {isFacultyOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                  setIsScanning(false);
                  setScanProgress(0);
                  setScanLogs([]);
                  setIsUploadModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 active:scale-98"
                title="Upload docx or pdf syllabus to automatically scan and update"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload & Scan Syllabus</span>
              </button>
            )}

            {isFacultyOrAdmin && isCustomSyllabus && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                title="Reset to official template"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={expandedCount === totalSections ? collapseAll : expandAll}
              className="px-3.5 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
            >
              {expandedCount === totalSections ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-primary" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-primary" />
                  <span>Expand All</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all shadow-xs cursor-pointer"
              title="Print Full Official Syllabus"
            >
              <Printer className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Course Description Card Quote */}
        <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/80 space-y-1">
          <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider">
            Course Rationale & Description:
          </span>
          <p className="text-foreground/90">{data.courseInfo.description}</p>
        </div>

        {/* Section Counter & Global Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>
              <strong>{expandedCount}</strong> of <strong>{totalSections}</strong> sections expanded
            </span>
            {expandedCount === 0 && (
              <span className="text-[11px] text-muted-foreground/80 italic">
                (Click any section below to maximize)
              </span>
            )}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter topics, outcomes, rubrics..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
        </div>
      </div>

      {/* =========================================================
          SECTION 1: Faculty Assignments & Section Schedules
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('facultySchedule')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Faculty & Schedule
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Faculty Members, Section Allocations & Consultation Hours
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.facultySchedule ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.facultySchedule && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-5 animate-dropdown">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {data.facultyMembers.map((fac, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h4 className="font-bold text-xs sm:text-sm text-foreground flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      <span>{fac.name}</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                      Instructor
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-sans">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Assigned Class Sections:
                    </span>
                    <div className="space-y-1">
                      {fac.sections.map((sec, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-xs"
                        >
                          <div className="font-bold text-foreground">Section {sec.section}</div>
                          <div className="text-muted-foreground text-[11px]">{sec.schedule}</div>
                          <div className="text-[10px] font-mono px-2 py-0.5 bg-muted text-foreground rounded font-semibold">
                            {sec.room}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Consultation:</span>
                    </span>
                    <span className="font-bold text-foreground text-[11px]">{fac.consultation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 2: Institutional VGMO, Core Values & Attributes (Part I)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('vgmo')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part I &bull; Mandates
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Philosophy, Vision, Mission, Goal, Core Values & Graduate Attributes
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.vgmo ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.vgmo && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-6 animate-dropdown text-xs">
            {/* VGMO Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Philosophy</span>
                <p className="text-foreground leading-relaxed">{data.institutionalStatements.philosophy}</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Vision</span>
                <p className="text-foreground leading-relaxed">{data.institutionalStatements.vision}</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Mission</span>
                <p className="text-foreground leading-relaxed">{data.institutionalStatements.mission}</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Goal</span>
                <p className="text-foreground leading-relaxed">{data.institutionalStatements.goal}</p>
              </div>
            </div>

            {/* Core Values SERVICE */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 pb-1 border-b border-border/60">
                <Sparkles className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Institutional Core Values (S-E-R-V-I-C-E)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.institutionalStatements.coreValues.map((val, idx) => (
                  <div key={idx} className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                        {val.acronym}
                      </span>
                      <span className="font-bold text-xs text-foreground">{val.keyword}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-8">{val.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Graduate Attributes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 pb-1 border-b border-border/60">
                <Award className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  DMMMSU Graduate Attributes
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.institutionalStatements.graduateAttributes.map(ga => (
                  <div key={ga.number} className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-subtle">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                        {ga.number}
                      </span>
                      <span className="font-bold text-xs text-foreground">{ga.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal pl-7">{ga.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 3: BSCS Program Outcomes (PO1 to PO11)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('programOutcomes')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  BSCS Program Outcomes
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">11 Outcomes</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                BSCS Degree Graduate Competencies (PO 1 to PO 11)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.programOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.programOutcomes && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-3 animate-dropdown text-xs">
            <p className="text-xs text-muted-foreground font-medium pb-1">
              Upon graduation, successful BSCS graduates will attain the following program outcomes:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.programOutcomes.map(po => (
                <div
                  key={po.number}
                  className="p-3 bg-muted/20 border border-border rounded-xl flex items-start space-x-3 hover:border-primary/40 transition-colors"
                >
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    PO {po.number}
                  </span>
                  <p className="text-foreground/90 text-xs leading-relaxed">{po.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 4: Course Outcomes (CO1 to CO9)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('courseOutcomes')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Course Outcomes
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">9 Outcomes</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Specific Learning & Terminal Outcomes (CO 1 to CO 9)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.courseOutcomes && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-4 animate-dropdown text-xs">
            <p className="text-xs text-muted-foreground font-medium">
              By the end of this course, students should be able to:
            </p>
            <div className="space-y-2.5">
              {data.courseOutcomes.map(co => (
                <div
                  key={co.number}
                  className="p-3 rounded-xl bg-muted/20 border border-border flex items-start space-x-3 hover:bg-muted/40 transition-colors"
                >
                  <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-mono font-bold text-[11px] shrink-0 mt-0.5 shadow-xs">
                    CO {co.number}
                  </span>
                  <span className="text-foreground text-xs leading-relaxed font-medium">
                    {co.statement}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 5: Requirements & Official Grading System (60/40)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('gradingSystem')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Evaluation Scheme
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">60% Class Standing / 40% Exam</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Requirements & Official Grading Formula
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.gradingSystem ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.gradingSystem && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-6 animate-dropdown text-xs">
            {/* Requirements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>Major Requirements & Assessments</span>
                </h4>
                <ul className="space-y-1.5 text-muted-foreground pl-2 text-xs">
                  {data.courseRequirements.major.map((req, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-primary font-bold">&bull;</span>
                      <span className="text-foreground/90">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>Other Requirements & Assessments</span>
                </h4>
                <ul className="space-y-1.5 text-muted-foreground pl-2 text-xs">
                  {data.courseRequirements.other.map((req, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-primary font-bold">&bull;</span>
                      <span className="text-foreground/90">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Formulas */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center space-x-2">
                <Sparkles className="w-4 h-4" />
                <span>Official Grading Formula</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-background border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Term Grade (Midterm & Final Term)
                  </span>
                  <div className="font-mono font-bold text-sm text-foreground">
                    60% Class Standing + 40% ME / FE
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Class Standing: Quizzes, assignments, laboratory activities & projects.
                  </span>
                </div>

                <div className="p-3 bg-background border border-border rounded-xl space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Semestral Final Grade
                  </span>
                  <div className="font-mono font-bold text-sm text-foreground">
                    40% Midterm Grade + 60% Final Term Grade
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Minimum passing mark: {data.gradingSystem.passingGrade}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 6: Group Project Presentation & Documentation Rubrics
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('projectRubrics')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Project Rubric
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">10 Assessment Categories</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Rubrics for Group Project Presentation and Documentation
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.projectRubrics ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.projectRubrics && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-4 animate-dropdown text-xs">
            <p className="text-xs text-muted-foreground font-medium">
              Teams are evaluated across 10 core engineering and presentation criteria scored from 1 (Beginning) to 4 (Exemplary):
            </p>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border font-bold">
                    <th className="p-3 min-w-[200px] text-foreground">Evaluation Criteria</th>
                    <th className="p-3 min-w-[160px] text-amber-600 dark:text-amber-400">Level 1 (Beginning)</th>
                    <th className="p-3 min-w-[160px] text-blue-600 dark:text-blue-400">Level 2 (Developing)</th>
                    <th className="p-3 min-w-[180px] text-indigo-600 dark:text-indigo-400">Level 3 (Proficient)</th>
                    <th className="p-3 min-w-[200px] text-emerald-600 dark:text-emerald-400">Level 4 (Exemplary)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.projectRubrics.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-foreground bg-muted/10 align-top">
                        {r.category}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px] leading-relaxed align-top">
                        {r.levels[1]}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px] leading-relaxed align-top">
                        {r.levels[2]}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px] leading-relaxed align-top">
                        {r.levels[3]}
                      </td>
                      <td className="p-3 text-foreground text-[11px] leading-relaxed align-top font-medium">
                        {r.levels[4]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 7: Classroom Policies & Standards of Conduct
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('classroomPolicies')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Policies & Conduct
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Code of Discipline</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Classroom, Laboratory Policies & Student Code of Discipline
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.classroomPolicies ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.classroomPolicies && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-3 animate-dropdown text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.classroomPolicies.map((pol, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-muted/20 border border-border rounded-xl flex items-start space-x-3"
                >
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-foreground/90 leading-relaxed text-xs">{pol}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 8: Course Outline & Timeline (Part II)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('courseOutline')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part II &bull; Outline
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">18 Weeks Roadmap</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Outline and Time Frame
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutline ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.courseOutline && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-3 animate-dropdown text-xs">
            <div className="space-y-3">
              {data.courseOutline.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-muted/20 border border-border rounded-xl space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-bold text-[11px]">
                      {item.timeFrame}
                    </span>
                    <span className="font-bold text-xs text-foreground">{item.title}</span>
                  </div>
                  <ul className="space-y-1 text-muted-foreground pl-2 text-xs">
                    {item.topics.map((top, tIdx) => (
                      <li key={tIdx} className="flex items-start space-x-2">
                        <span className="text-primary font-bold">&bull;</span>
                        <span className="text-foreground/90">{top}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 9: Detailed 18-Week Learning Plan (Part III)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('learningPlan')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part III &bull; Learning Plan
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">SDG Integration & Deliverables</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Detailed 18-Week Learning Plan, Methodology & Assessment
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.learningPlan ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.learningPlan && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-4 animate-dropdown text-xs">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
              <div className="flex items-center space-x-1.5">
                {(['all', 'prelim', 'midterm', 'finals'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveWeekTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer capitalize ${
                      activeWeekTab === tab
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'all' ? 'All Weeks' : tab}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-muted-foreground font-mono">
                Showing {filteredLearningPlan.length} periods
              </span>
            </div>

            {/* Weeks Cards */}
            <div className="space-y-4">
              {filteredLearningPlan.map((plan, pIdx) => (
                <div
                  key={pIdx}
                  className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 space-y-3.5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 pb-2.5 gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-xs shadow-xs">
                        {plan.week}
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {plan.topics[0]}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] font-mono text-muted-foreground">
                      <span>Lec: {plan.hoursLec}h</span>
                      <span>&bull;</span>
                      <span>Lab: {plan.hoursLab}h</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Learning Outcomes
                        </span>
                        <ul className="space-y-1 pt-1 text-foreground/90">
                          {plan.learningOutcomes.map((lo, i) => (
                            <li key={i} className="flex items-start space-x-1.5">
                              <span className="text-primary font-bold">&bull;</span>
                              <span>{lo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {plan.sdgCoherence && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-300 text-[11px] space-y-0.5">
                          <span className="font-bold uppercase tracking-wider block text-[10px]">
                            {plan.sdgCoherence.goal}: {plan.sdgCoherence.title}
                          </span>
                          <p>{plan.sdgCoherence.description}</p>
                          {plan.sdgCoherence.target && (
                            <span className="font-mono text-[10px] block opacity-85">
                              {plan.sdgCoherence.target}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Methodology & Learning Activities
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {plan.methodology.map((m, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] text-foreground font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Assessment & Evaluation Tasks
                        </span>
                        <ul className="space-y-1 pt-1 text-foreground font-medium">
                          {plan.assessment.map((a, i) => (
                            <li key={i} className="flex items-start space-x-1.5 text-xs text-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 10: Curriculum Course Map (Part IV)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('curriculumMap')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part IV &bull; Course Map
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">CO to PO Matrix</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Curriculum Mapping: Course Outcomes (CO) to Program Outcomes (PO)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.curriculumMap ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.curriculumMap && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-4 animate-dropdown text-xs">
            <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border font-medium">
              <span className="font-bold text-foreground">Curriculum Level Legend:</span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-5 h-5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center">
                  I
                </span>
                <span className="text-muted-foreground">= Introduced</span>
              </span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-5 h-5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                  P
                </span>
                <span className="text-muted-foreground">= Practiced</span>
              </span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-5 h-5 rounded bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center">
                  D
                </span>
                <span className="text-muted-foreground">= Demonstrate</span>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border font-bold">
                    <th className="p-3 min-w-[280px] text-foreground">Course Outcomes (CO)</th>
                    {Array.from({ length: 11 }).map((_, i) => (
                      <th key={i} className="p-2.5 text-center min-w-[42px] font-mono text-[11px] text-muted-foreground">
                        PO{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {data.courseMap.map(row => (
                    <tr key={row.coNumber} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-foreground font-medium text-xs leading-relaxed">
                        <span className="font-bold text-primary mr-1">CO {row.coNumber}.</span>
                        {row.coStatement}
                      </td>
                      {Array.from({ length: 11 }).map((_, i) => {
                        const val = row.poAlignments[i + 1];
                        let badgeClass = '';
                        if (val === 'I') badgeClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';
                        if (val === 'P') badgeClass = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
                        if (val === 'D') badgeClass = 'bg-primary/15 text-primary font-black border border-primary/30';

                        return (
                          <td key={i} className="p-2 text-center align-middle">
                            {val ? (
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono text-xs font-bold ${badgeClass}`}>
                                {val}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">&ndash;</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 11: Academic References & Official Signatories (Parts V & VI)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('referencesSignatures')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Parts V & VI &bull; References & Signatories
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">15 Academic Sources</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Official Textbook References & Institutional Approvals
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.referencesSignatures ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {expandedSections.referencesSignatures && (
          <div className="p-5 sm:p-6 border-t border-border bg-card space-y-6 animate-dropdown text-xs">
            {/* References */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Textbooks, Modules & Research References</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {data.references.map((ref, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-muted/20 border border-border text-xs leading-relaxed space-y-1 hover:border-primary/40 transition-colors"
                  >
                    <p className="text-foreground/90">{ref.citation}</p>
                    {ref.doiOrPublisher && (
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        {ref.doiOrPublisher}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Official Signatories */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center space-x-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Institutional Certification & Approvals</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Prepared by */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Prepared by:
                  </span>
                  <div className="space-y-2 pt-1">
                    {data.signatories.preparedBy.map((sig, i) => (
                      <div key={i}>
                        <div className="font-black text-xs text-foreground uppercase">{sig.name}</div>
                        <div className="text-[11px] text-muted-foreground">{sig.title}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommending Approval */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Recommending Approval:
                  </span>
                  <div className="pt-1">
                    <div className="font-black text-xs text-foreground uppercase">
                      {data.signatories.recommendingApproval.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {data.signatories.recommendingApproval.title}
                    </div>
                  </div>
                </div>

                {/* Approved */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Approved:
                  </span>
                  <div className="pt-1">
                    <div className="font-black text-xs text-foreground uppercase">
                      {data.signatories.approved.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {data.signatories.approved.title}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          SYLLABUS SCANNER & UPDATER MODAL (DOCX / PDF)
          ========================================================= */}
      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isScanning) setIsUploadModalOpen(false);
          }}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <UploadCloud className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    Upload & Scan Course Syllabus
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full border border-primary/20">
                    PDF &bull; DOCX
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                  Upload an official college syllabus document. Gabay will automatically parse the curriculum, 18-week learning plan, outcomes, and grading rubrics.
                </p>
              </div>
              <button
                type="button"
                disabled={isScanning}
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Error banner if any */}
              {scanError && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold">Document Scanning Error</p>
                    <p className="text-[11px] opacity-90">{scanError}</p>
                  </div>
                </div>
              )}

              {/* State 1: Ready to Upload / Select File */}
              {!isScanning && !scanResult && (
                <div className="space-y-4">
                  {/* Dropzone Area */}
                  <div
                    onDragOver={e => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-primary bg-primary/10 scale-[1.01]'
                        : 'border-border/80 hover:border-primary/50 hover:bg-muted/30 bg-muted/10'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                    />

                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">
                          Click to browse, or drag & drop syllabus file
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports <strong>.PDF</strong> and <strong>.DOCX</strong> files (up to 50MB)
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-subtle hover:bg-primary/90 transition-all pointer-events-none mt-1"
                      >
                        Select Document File
                      </button>
                    </div>
                  </div>


                </div>
              )}

              {/* State 2: Scanning Progress Animation */}
              {isScanning && (
                <div className="py-10 px-4 flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center animate-pulse">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-xs">
                      {scanProgress}%
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-md w-full">
                    <h4 className="text-sm font-bold text-foreground">
                      Scanning Syllabus Document...
                    </h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      {scanStepText}
                    </p>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full max-w-md bg-muted rounded-full h-2 overflow-hidden border border-border">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-pink-500 transition-all duration-300 rounded-full"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  {/* Terminal-style Scanner Logs */}
                  <div className="w-full max-w-md bg-black/80 dark:bg-black/50 p-3 rounded-xl border border-border text-left font-mono text-[11px] space-y-1 text-emerald-400">
                    {scanLogs.map((log, index) => (
                      <div key={index} className="flex items-center space-x-2 truncate">
                        <span className="text-muted-foreground">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* State 3: Scan Complete - Review & Apply */}
              {!isScanning && scanResult && (
                <div className="space-y-5 animate-fade-in">
                  {/* Success Header Badge */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Syllabus Analysis & Scan Successful
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Document meets institutional guidelines and is ready to apply to {data.courseInfo.code}.
                      </div>
                    </div>
                  </div>

                  {/* Scanned File & Metadata Card */}
                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span>{scanResult.fileName}</span>
                          <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold bg-primary/10 text-primary rounded">
                            {scanResult.fileType}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          File Size: {scanResult.fileSize}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-card rounded border border-border">
                        {scanResult.detectedFormCode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                        <div className="text-base font-black text-primary">
                          {scanResult.stats.learningWeeksCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Weeks Extracted
                        </div>
                      </div>
                      <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                        <div className="text-base font-black text-primary">
                          {scanResult.stats.outcomesCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Course Outcomes
                        </div>
                      </div>
                      <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                        <div className="text-base font-black text-primary">
                          {scanResult.stats.rubricsCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Rubric Dimensions
                        </div>
                      </div>
                      <div className="p-2.5 bg-card border border-border rounded-lg text-center">
                        <div className="text-base font-black text-primary">
                          {scanResult.stats.referencesCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">
                          References
                        </div>
                      </div>
                    </div>

                    {/* Detected Faculty & Formulas */}
                    <div className="text-xs space-y-1.5 pt-1">
                      <div className="text-[11px] text-muted-foreground">
                        <strong className="text-foreground">Course Detected:</strong>{' '}
                        {scanResult.detectedCourseCode} &bull; {scanResult.detectedCourseTitle}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <strong className="text-foreground">Faculty Prepared:</strong>{' '}
                        {scanResult.syllabus.signatories.preparedBy.map(f => f.name).join(', ')}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <strong className="text-foreground">Grading Formula:</strong>{' '}
                        {scanResult.syllabus.gradingSystem.termFormula}
                      </div>
                    </div>
                  </div>

                  {/* Document Raw Snippet Preview */}
                  <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Extracted Text Stream Preview:
                    </div>
                    <pre className="text-[11px] font-mono text-muted-foreground bg-card p-2.5 rounded-lg border border-border whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                      {scanResult.rawTextPreview}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              {scanResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult(null);
                      setScanError(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                  >
                    Scan Another File
                  </button>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySyllabus}
                      className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-subtle cursor-pointer flex items-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply & Update Syllabus</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground italic">
                    All 11 sections will remain minimized by default upon update.
                  </span>
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
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
