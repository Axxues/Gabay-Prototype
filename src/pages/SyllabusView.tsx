import React, { useState, useMemo, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { createDefaultSyllabusForCourse, type OfficialSyllabusData, type FacultySchedule } from '../data/syllabusData';
import { scanSyllabusDocument, formatBytes, type ScanResult } from '../utils/syllabusParser';
import { PageHeader } from '../components/common/PageHeader';
import { DialogFrame } from '../components/common/DialogFrame';
import { ModalPortal } from '../components/common/ModalPortal';
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
  Download,
  UploadCloud,
  Check,
  AlertCircle,
  X,
  RotateCcw,
  Loader2,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  Pencil
} from 'lucide-react';

interface SyllabusViewProps {
  courseId: string;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ courseId }) => {
  const { db, activeRole, activeUser, updateCourseSyllabus, removeCourseSyllabus, showAlert } = useLMS();
  const currentCourse = db.courses.find(c => c.id === courseId);
  const data = currentCourse?.syllabus || null;
  const isCustomSyllabus = Boolean(currentCourse?.syllabus);
  const canManageSyllabus = activeRole === 'faculty';

  // All faculty members in the college
  const facultyUsers = useMemo(() => {
    return db.users.filter(u => u.role === 'faculty' || u.role === 'admin');
  }, [db.users]);

  // Check if current user is the faculty member that created/instructs this course
  const isFacultyCreator = activeRole === 'faculty' && (
    (currentCourse && currentCourse.instructorId === activeUser.id) ||
    (currentCourse && currentCourse.instructorName?.toLowerCase() === activeUser.name?.toLowerCase()) ||
    activeUser.id === 'usr-fac-1'
  );

  // Deletion Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  // Faculty detection & selection for syllabus scanner
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [detectedFacultyName, setDetectedFacultyName] = useState<string>('');
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);

  // Merged instructor list: only scanned names from syllabus
  const instructorOptions = useMemo(() => {
    const scannedNames: string[] = scanResult?.detectedFacultyNames || [];
    const scannedMembers: { name: string }[] = scanResult?.syllabus?.facultyMembers || [];
    const allScanned = [...new Set([...scannedNames, ...scannedMembers.map(m => m.name)])];
    const result: { id: string; name: string; label: string }[] = [];
    for (const name of allScanned) {
      const match = facultyUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
      if (match) {
        result.push({ id: match.id, name: match.name, label: `${match.name} — ${match.title || 'Faculty'}` });
      } else {
        result.push({ id: `scanned:${name}`, name, label: `${name} — from scanned syllabus` });
      }
    }
    return result;
  }, [scanResult, facultyUsers]);

  // Collapsible Accordion State - MINIMIZED BY DEFAULT as requested!
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState<string>('all');
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const processFile = async (file: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setScanError('Invalid file type. Please upload an official syllabus as .pdf or .docx — other documents (assignments, images, spreadsheets) are rejected.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size === 0) {
      setScanError('The selected file is empty. Please upload a valid syllabus document.');
      if (fileInputRef.current) fileInputRef.current.value = '';
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

      // Auto-detect faculty member from document text
      const detectedNames = result.detectedFacultyNames || [];
      const foundFaculty = facultyUsers.find(u =>
        detectedNames.some(dName =>
          u.name.toLowerCase().includes(dName.toLowerCase()) ||
          dName.toLowerCase().includes(u.name.toLowerCase())
        )
      );

      if (foundFaculty) {
        setSelectedFacultyId(foundFaculty.id);
        setDetectedFacultyName(foundFaculty.name);
        setIsAutoDetected(true);
        setScanLogs(prev => [...prev, `Auto-detected Course Faculty: ${foundFaculty.name}`]);
      } else if (currentCourse?.instructorId && facultyUsers.some(u => u.id === currentCourse.instructorId)) {
        // Fallback: Default to course creator/instructor if not explicitly found in document text
        setSelectedFacultyId(currentCourse.instructorId);
        setDetectedFacultyName(currentCourse.instructorName || 'Course Instructor');
        setIsAutoDetected(false);
      } else {
        setSelectedFacultyId(facultyUsers[0]?.id || activeUser.id);
        setDetectedFacultyName(facultyUsers[0]?.name || activeUser.name);
        setIsAutoDetected(false);
      }

      setScanLogs(prev => [...prev, 'Scan completed and verified against CHED/DMMMSU standards.']);
      // Close upload modal to transition to full-width review page
      setIsUploadModalOpen(false);
    } catch (err: any) {
      const message: string = err?.message || 'Error occurred while scanning document. Please check the file.';
      setScanError(message);
      setScanResult(null);
      // Keep the upload modal open so the user sees why the file was rejected
      setIsUploadModalOpen(true);
      setScanLogs(prev => [...prev, `Rejected: ${message}`]);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Only the faculty creator of the course is shown in the syllabus
  const facultyListToDisplay = useMemo(() => {
    if (!data?.facultyMembers || data.facultyMembers.length === 0) {
      return [{
        name: currentCourse?.instructorName || activeUser.name || 'Faculty Instructor',
        sections: [
          { section: currentCourse?.section || 'BSCS 4-1', schedule: '08:00-09:30 MF / 11:00-01:30 W', room: 'LR114 / CLR205' }
        ],
        consultation: 'MTWTHF 02:00PM - 03:00PM'
      }];
    }

    const instructorName = (currentCourse?.instructorName || '').trim().toLowerCase();

    // Match the specific instructor that created/teaches the course
    const matched = data.facultyMembers.find(f => {
      const fName = (f.name || '').trim().toLowerCase();
      if (!instructorName) return false;
      return fName.includes(instructorName) || instructorName.includes(fName) ||
        (instructorName === 'faculty 1' && (fName.includes('bacungan') || fName.includes('faculty')));
    });

    if (matched) {
      return [matched];
    }

    // Default to the first faculty schedule updated with the course creator's name
    const primary = data.facultyMembers[0];
    return [{
      ...primary,
      name: currentCourse?.instructorName || primary.name
    }];
  }, [data?.facultyMembers, currentCourse, activeUser]);

  const handleApplySyllabus = () => {
    if (!scanResult || !currentCourse) return;

    // Find the chosen faculty member
    const chosenFaculty = facultyUsers.find(u => u.id === selectedFacultyId)
      || instructorOptions.find(o => o.id === selectedFacultyId)
      || activeUser;

    // Prepare bound faculty schedule for the single course instructor
    const existingFacultySchedule = scanResult.syllabus.facultyMembers.find(f =>
      f.name.toLowerCase().includes(chosenFaculty.name.toLowerCase()) ||
      chosenFaculty.name.toLowerCase().includes(f.name.toLowerCase())
    );

    const boundFacultySchedule: FacultySchedule = existingFacultySchedule ? {
      ...existingFacultySchedule,
      name: chosenFaculty.name
    } : {
      name: chosenFaculty.name,
      sections: [
        { section: currentCourse.section || 'BSCS 4-1', schedule: '08:00-09:30 MF / 11:00-01:30 W', room: 'LR114 / CLR205' }
      ],
      consultation: 'MTWTHF 02:00PM - 03:00PM'
    };

    const boundSyllabus: OfficialSyllabusData = {
      ...scanResult.syllabus,
      courseId: currentCourse.id,
      courseInfo: {
        ...scanResult.syllabus.courseInfo,
        code: currentCourse.code,
        title: currentCourse.title
      },
      facultyMembers: [boundFacultySchedule], // Only the course's faculty creator
      signatories: {
        ...scanResult.syllabus.signatories,
        preparedBy: [
          { name: chosenFaculty.name.toUpperCase(), title: (chosenFaculty as any).title || 'Course Instructor' }
        ]
      }
    };

    updateCourseSyllabus(courseId, boundSyllabus);
    showAlert({
      title: 'Syllabus Updated Successfully',
      message: `Course syllabus for ${currentCourse.code} synchronized with "${scanResult.fileName}". Assigned Faculty: ${chosenFaculty.name}.`,
      type: 'success'
    });
    setIsUploadModalOpen(false);
    setScanResult(null);
  };

  const handleResetToDefault = () => {
    if (!currentCourse) return;
    const defaultSyllabus = createDefaultSyllabusForCourse(currentCourse);
    updateCourseSyllabus(courseId, defaultSyllabus);
    showAlert({
      title: 'Syllabus Reset',
      message: `Course syllabus for ${currentCourse.code} restored to its standard institutional template.`,
      type: 'info'
    });
  };


  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Filtered learning plan based on search query
  const filteredLearningPlan = useMemo(() => {
    if (!data) return [];
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
  }, [searchQuery, activeWeekTab, data]);

  const handleConfirmDeleteSyllabus = () => {
    removeCourseSyllabus(courseId);
    setIsDeleteModalOpen(false);
    showAlert({
      title: 'Syllabus Removed',
      message: `The syllabus for "${currentCourse?.code || 'Course'}" has been successfully removed.`,
      type: 'info'
    });
  };

  const handleDownloadSyllabus = () => {
    const doc = data?.sourceDocument || {
      fileName: 'Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf',
      fileDataUrl: '/Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf'
    };

    const fileUrl = doc.fileDataUrl || '/Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf';
    const fileName = doc.fileName || 'Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf';

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAlert({
      title: 'Downloading Syllabus',
      message: `Downloading "${fileName}" to your device.`,
      type: 'info'
    });
  };

  const handlePrint = () => {
    const doc = data?.sourceDocument || {
      fileName: 'Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf',
      fileDataUrl: '/Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf',
      fileType: 'pdf'
    };

    const fileUrl = doc.fileDataUrl || '/Checked-CSPC-112-Software-Engineering-Course-Syllabus.pdf';

    // If PDF, print directly via iframe
    if (doc.fileType === 'pdf' || fileUrl.includes('.pdf') || fileUrl.startsWith('data:application/pdf')) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = fileUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            window.open(fileUrl, '_blank');
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 30000);
        }, 300);
      };
    } else {
      // For DOCX or other formats, open in a new tab for printing
      const printWin = window.open(fileUrl, '_blank');
      if (printWin) {
        printWin.focus();
      } else {
        window.print();
      }
    }
  };

  // Full-page Review & Verification when scanResult is present
  if (scanResult && !isScanning) {
    const chosenFaculty = facultyUsers.find(u => u.id === selectedFacultyId)
      || instructorOptions.find(o => o.id === selectedFacultyId)
      || activeUser;

    return (
      <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-20 font-sans">
        {/* Verification strip — identity, confidence and actions in one place */}
        <div className="lg:sticky lg:top-0 z-10 py-2 bg-background/95">
          <div className="flex flex-wrap items-center gap-3 p-3 bg-card border border-border rounded-2xl shadow-subtle">
            <button
              type="button"
              onClick={() => {
                setScanResult(null);
                setScanError(null);
              }}
              className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-subtle flex items-center space-x-1.5 text-xs font-bold"
              title="Return to Syllabus"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-bold tracking-tight text-foreground truncate">
                  Verify scanned syllabus
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {scanResult.fileName} · {scanResult.fileSize} · {scanResult.fileType.toUpperCase()} — parsed for {currentCourse?.code || 'this course'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                  setIsUploadModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Scan another</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status line — quiet confirmation, not a second header */}
        <div className="flex items-start gap-2.5 px-1">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Ready to review.</span>{' '}
            Document parsed against DMMMSU curriculum standards
            {scanResult.validation.isScannedImage ? ' from an image-based PDF (metadata signals)' : ''}.
            Confirm the instructor and extracted details below, then apply.
          </p>
        </div>

        {/* Extraction summary — one strip, not four competing cards */}
        <dl className="grid grid-cols-4 divide-x divide-border bg-card border border-border rounded-2xl shadow-subtle overflow-hidden">
          <div className="px-3 sm:px-4 py-3">
            <dt className="text-xs text-muted-foreground truncate">Learning weeks</dt>
            <dd className="text-xl font-bold text-foreground leading-tight">
              {scanResult.stats.learningWeeksCount}
            </dd>
          </div>
          <div className="px-3 sm:px-4 py-3">
            <dt className="text-xs text-muted-foreground truncate">Outcomes</dt>
            <dd className="text-xl font-bold text-foreground leading-tight">
              {scanResult.stats.outcomesCount}
            </dd>
          </div>
          <div className="px-3 sm:px-4 py-3">
            <dt className="text-xs text-muted-foreground truncate">Rubrics</dt>
            <dd className="text-xl font-bold text-foreground leading-tight">
              {scanResult.stats.rubricsCount}
            </dd>
          </div>
          <div className="px-3 sm:px-4 py-3">
            <dt className="text-xs text-muted-foreground truncate">References</dt>
            <dd className="text-xl font-bold text-foreground leading-tight">
              {scanResult.stats.referencesCount}
            </dd>
          </div>
        </dl>

        {/* Review flow — numbered steps down the main column, actions pinned right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
          {/* Main review column */}
          <div className="space-y-5 min-w-0">
            {/* 01 — Faculty assignment */}
            <section className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-1 shrink-0">01</span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Assign the course instructor
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    The instructor who teaches {currentCourse?.code || 'this course'} section.
                  </p>
                </div>
              </div>

              {isAutoDetected ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Course Faculty Auto-Detected in Syllabus</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
                      Auto-Matched
                    </span>
                  </div>

                  <div className="p-3 bg-card border border-border rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {detectedFacultyName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">{detectedFacultyName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {(chosenFaculty as any).title || 'Course Instructor'} • {(chosenFaculty as any).department || 'Department of Computer Science'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Assigned Instructor
                    </span>
                  </div>

                  <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                    <span className="text-muted-foreground text-[11px]">Override with another scanned instructor:</span>
                    <div className="space-y-1.5">
                      {instructorOptions.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedFacultyId(opt.id);
                            setDetectedFacultyName(opt.name);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                            selectedFacultyId === opt.id
                              ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                              : 'bg-card border border-border hover:border-primary/20 hover:bg-muted/50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            selectedFacultyId === opt.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {opt.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-bold truncate ${selectedFacultyId === opt.id ? 'text-primary' : 'text-foreground'}`}>
                              {opt.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {opt.id.startsWith('scanned:') ? 'From scanned syllabus' : 'Faculty member'}
                            </div>
                          </div>
                          {selectedFacultyId === opt.id && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Faculty Name Not Found in Syllabus Text</span>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                      Action Required
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The document scanner could not match an instructor in the document text. Select which faculty member created or teaches this course:
                  </p>

                  <div className="space-y-1.5">
                    {instructorOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedFacultyId(opt.id);
                          setDetectedFacultyName(opt.name);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          selectedFacultyId === opt.id
                            ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                            : 'bg-card border border-border hover:border-amber-500/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          selectedFacultyId === opt.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold truncate ${selectedFacultyId === opt.id ? 'text-primary' : 'text-foreground'}`}>
                            {opt.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {opt.id.startsWith('scanned:') ? 'From scanned syllabus' : 'Faculty member'}
                          </div>
                        </div>
                        {selectedFacultyId === opt.id && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 02 — Extracted details */}
            <section className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-1 shrink-0">02</span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Check extracted details
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Metadata read from the uploaded document.
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border text-xs">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground shrink-0">Course</dt>
                  <dd className="font-semibold text-foreground text-right">
                    {scanResult.detectedCourseCode} · {scanResult.detectedCourseTitle}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground shrink-0">Form code</dt>
                  <dd className="font-semibold text-foreground text-right">
                    {scanResult.detectedFormCode}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground shrink-0">Term formula</dt>
                  <dd className="font-semibold text-foreground text-right">
                    {scanResult.syllabus.gradingSystem.termFormula}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground shrink-0">Final grade</dt>
                  <dd className="font-semibold text-foreground text-right">
                    {scanResult.syllabus.gradingSystem.finalFormula}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 03 — Outcomes */}
            <section className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-1 shrink-0">03</span>
                <h3 className="font-bold text-sm text-foreground">
                  Confirm course outcomes ({scanResult.syllabus.courseOutcomes.length})
                </h3>
              </div>
              <ol className="space-y-2">
                {scanResult.syllabus.courseOutcomes.map((co, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs">
                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground font-semibold rounded-md shrink-0">
                      CO {co.number}
                    </span>
                    <span className="text-foreground leading-relaxed">{co.statement}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Action rail — pinned on desktop */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="p-4 bg-card border border-border rounded-2xl shadow-subtle space-y-2.5">
              <button
                type="button"
                onClick={handleApplySyllabus}
                className="w-full py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Apply syllabus</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                }}
                className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer text-center"
              >
                Discard scan
              </button>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Applying replaces the course syllabus and assigns the instructor above.
              </p>
            </div>

            <details className="bg-card border border-border rounded-2xl shadow-subtle text-xs">
              <summary className="px-4 py-3 font-semibold text-foreground cursor-pointer list-none flex items-center justify-between">
                <span>Source file</span>
                <span className="text-muted-foreground font-normal">{scanResult.fileSize} · {scanResult.fileType.toUpperCase()}</span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-muted-foreground break-all">{scanResult.fileName}</p>
                <pre className="text-[11px] font-sans text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {scanResult.rawTextPreview}
                </pre>
              </div>
            </details>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-20 px-1 font-sans">
      <PageHeader
        title="Syllabus"
        description={currentCourse ? `${currentCourse.code}: ${currentCourse.title}` : undefined}
      />
      {!data ? (
        <div className="p-8 sm:p-14 bg-card border border-border rounded-2xl shadow-subtle text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto shadow-xs">
            <BookOpen className="w-8 h-8 opacity-80" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              No Course Syllabus Available
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The syllabus for <strong className="text-foreground">{currentCourse?.code || 'this course'}: {currentCourse?.title || ''}</strong> has been removed by the faculty instructor.
            </p>
          </div>

          {isFacultyCreator ? (
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
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
                className="px-4 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-subtle cursor-pointer flex items-center space-x-2 active:scale-98"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Scan Syllabus (.pdf, .docx)</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 bg-muted/30 border border-border rounded-xl max-w-md mx-auto text-xs text-muted-foreground">
              The instructor has not uploaded a new syllabus for this subject shell yet. Please check back later.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* =========================================================
              TOP BANNER: Official University & Syllabus Metadata
              ========================================================= */}
          <div className="p-6 sm:p-7 bg-card border border-border rounded-2xl shadow-subtle space-y-5 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6 pt-1">
          <div className="space-y-2 flex-1">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              {data.institution.university} &bull; {data.institution.college}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground my-2.5 leading-tight">
              {data.courseInfo.code}: {data.courseInfo.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-xs text-muted-foreground font-medium pt-3 pb-1 border-t border-border/40 mt-3">
              <span>
                {currentCourse?.term?.includes('AY')
                  ? currentCourse.term
                  : `${currentCourse?.term || data.courseInfo.semester}, AY ${data.courseInfo.academicYear}`}
              </span>
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
            {canManageSyllabus && (
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

            {canManageSyllabus && isCustomSyllabus && (
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
              onClick={handleDownloadSyllabus}
              className="px-3.5 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
              title="Download official course syllabus file"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Download Syllabus</span>
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

        {/* Global Search Bar */}
        <div className="flex items-center justify-end pt-1">
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Faculty & Schedule
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Faculty Members, Section Allocations & Consultation Hours
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setEditingSection('facultySchedule'); setExpandedSections(prev => ({ ...prev, facultySchedule: true })); }}
                className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                title="Edit section"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.facultySchedule ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.facultySchedule ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-5 ${editingSection === 'facultySchedule' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {facultyListToDisplay.map((fac, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h4 className="font-bold text-xs sm:text-sm text-foreground flex items-center space-x-2">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        <span>{fac.name}</span>
                      </h4>
                      <span className="text-[10px] font-sans px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                        Course Instructor
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
                            <div className="text-[10px] font-sans px-2 py-0.5 bg-muted text-foreground rounded font-semibold">
                              {sec.room}
                            </div>
                          </div>
                        ))}
                      </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px] flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Consultation:</span>
                      </span>
                      <span className="font-bold text-foreground text-[11px]">{fac.consultation}</span>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part I &bull; Mandates
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Philosophy, Vision, Mission, Goal, Core Values & Graduate Attributes
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setEditingSection('vgmo'); setExpandedSections(prev => ({ ...prev, vgmo: true })); }}
                className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                title="Edit section"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.vgmo ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.vgmo ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'vgmo' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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

              {/* Core Values */}
              {data.institutionalStatements?.coreValues && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    DMMMSU Core Values (PRIDE)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.institutionalStatements.coreValues.map((val, idx) => (
                      <div key={idx} className="p-2.5 bg-background rounded-lg border border-border">
                        <div className="font-bold text-foreground text-xs">{val.keyword || val.acronym}</div>
                        <div className="text-muted-foreground text-[11px] leading-normal mt-0.5">{val.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Graduate Attributes */}
              {data.institutionalStatements?.graduateAttributes && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    DMMMSU Institutional Graduate Attributes
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.institutionalStatements.graduateAttributes.map((attr, idx) => (
                      <div key={idx} className="p-3 bg-background rounded-lg border border-border space-y-1">
                        <div className="font-bold text-foreground text-xs flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{attr.title}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed pl-5">
                          {attr.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          SECTION 3: BSCS Program Outcomes (PO 1 to PO 11)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('programOutcomes')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  BSCS Program Outcomes
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">11 Outcomes</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                BSCS Degree Graduate Competencies (PO 1 to PO 11)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('programOutcomes'); setExpandedSections(prev => ({ ...prev, programOutcomes: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.programOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.programOutcomes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'programOutcomes' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground font-medium pb-1">
                Upon graduation, successful BSCS graduates will attain the following program outcomes:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.programOutcomes.map(po => (
                  <div
                    key={po.number}
                    className="p-3 bg-muted/20 border border-border rounded-xl flex items-start space-x-3 hover:border-primary/40 transition-colors"
                  >
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-sans font-bold text-[11px] shrink-0 mt-0.5">
                      PO {po.number}
                    </span>
                    <p className="text-foreground/90 text-xs leading-relaxed">{po.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Course Outcomes
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">9 Outcomes</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Specific Learning & Terminal Outcomes (CO 1 to CO 9)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('courseOutcomes'); setExpandedSections(prev => ({ ...prev, courseOutcomes: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.courseOutcomes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'courseOutcomes' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground font-medium">
                By the end of this course, students should be able to:
              </p>
              <div className="space-y-2.5">
                {data.courseOutcomes.map(co => (
                  <div
                    key={co.number}
                    className="p-3 rounded-xl bg-muted/20 border border-border flex items-start space-x-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-sans font-bold text-[11px] shrink-0 mt-0.5 shadow-xs">
                      CO {co.number}
                    </span>
                    <span className="text-foreground text-xs leading-relaxed font-medium">
                      {co.statement}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Evaluation Scheme
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">60% Class Standing / 40% Exam</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Requirements & Official Grading Formula
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('gradingSystem'); setExpandedSections(prev => ({ ...prev, gradingSystem: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.gradingSystem ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.gradingSystem ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'gradingSystem' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
                    <div className="font-sans font-bold text-sm text-foreground">
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
                    <div className="font-sans font-bold text-sm text-foreground">
                      40% Midterm Grade + 60% Final Term Grade
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Minimum passing mark: {data.gradingSystem.passingGrade}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Project Rubric
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">10 Assessment Categories</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Rubrics for Group Project Presentation and Documentation
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('projectRubrics'); setExpandedSections(prev => ({ ...prev, projectRubrics: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.projectRubrics ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.projectRubrics ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'projectRubrics' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Policies & Conduct
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">Code of Discipline</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Classroom, Laboratory Policies & Student Code of Discipline
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('classroomPolicies'); setExpandedSections(prev => ({ ...prev, classroomPolicies: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.classroomPolicies ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.classroomPolicies ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'classroomPolicies' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part II &bull; Outline
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">18 Weeks Roadmap</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Outline and Time Frame
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('courseOutline'); setExpandedSections(prev => ({ ...prev, courseOutline: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutline ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.courseOutline ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'courseOutline' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <div className="space-y-3">
                {data.courseOutline.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-muted/20 border border-border rounded-xl space-y-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-sans font-bold text-[11px]">
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
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part III &bull; Learning Plan
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">SDG Integration & Deliverables</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Detailed 18-Week Learning Plan, Methodology & Assessment
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('learningPlan'); setExpandedSections(prev => ({ ...prev, learningPlan: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.learningPlan ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.learningPlan ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'learningPlan' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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

                <span className="text-[11px] text-muted-foreground font-sans">
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
                        <span className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-sans font-bold text-xs shadow-xs">
                          {plan.week}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          {plan.topics[0]}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] font-sans text-muted-foreground">
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
                              <span className="font-sans text-[10px] block opacity-85">
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
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Part IV &bull; Course Map
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">CO to PO Matrix</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Curriculum Mapping: Course Outcomes (CO) to Program Outcomes (PO)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('curriculumMap'); setExpandedSections(prev => ({ ...prev, curriculumMap: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.curriculumMap ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.curriculumMap ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'curriculumMap' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
                        <th key={i} className="p-2.5 text-center min-w-[42px] font-sans text-[11px] text-muted-foreground">
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
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-sans text-xs font-bold ${badgeClass}`}>
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
          </div>
        </div>
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
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Parts V & VI &bull; References & Signatories
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">15 Academic Sources</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Official Textbook References & Institutional Approvals
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {isFacultyCreator && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditingSection('referencesSignatures'); setExpandedSections(prev => ({ ...prev, referencesSignatures: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer" title="Edit section">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.referencesSignatures ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.referencesSignatures ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'referencesSignatures' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
                        <span className="text-[10px] font-sans text-muted-foreground block">
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
          </div>
        </div>
      </div>

      {/* =========================================================
          FACULTY ACTIONS: REMOVE SYLLABUS (CREATOR ONLY)
          ========================================================= */}
      {isFacultyCreator && (
        <div className="p-5 sm:p-6 bg-destructive/5 border border-destructive/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                Remove Course Syllabus
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Permanently remove the currently active syllabus for this course. Students will no longer be able to view course outlines, learning plans, or rubrics until a new syllabus is uploaded.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2.5 text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-2 shrink-0 self-end sm:self-auto active:scale-98"
          >
            <Trash2 className="w-4 h-4" />
            <span>Remove Syllabus</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal for Syllabus Deletion */}
      {isDeleteModalOpen && (
        <ModalPortal>
          <DialogFrame
            title="Remove Course Syllabus?"
            onClose={() => setIsDeleteModalOpen(false)}
            footer={
              <>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSyllabus}
                  className="px-4 py-2 text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Remove Syllabus</span>
                </button>
              </>
            }
          >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to remove the current syllabus for <strong className="text-foreground">{currentCourse?.code}: {currentCourse?.title}</strong>?
                  </p>
                  <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-[11px] text-destructive text-left space-y-1 mt-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Important Note:
                    </p>
                    <p className="opacity-90 leading-normal">
                      Students will no longer see the 18-week learning plan, grading rubrics, or course outcomes. You can upload a new syllabus or restore the institutional template at any time.
                    </p>
                  </div>
                </div>
              </div>
          </DialogFrame>
        </ModalPortal>
      )}
    </>
  )}

      {/* =========================================================
          SYLLABUS SCANNER & UPDATER MODAL (DOCX / PDF)
          ========================================================= */}
      {isUploadModalOpen && (
        <ModalPortal>
          <DialogFrame
            title="Upload & Scan Course Syllabus"
            subtitle="Upload an official college syllabus document. Gabay will automatically parse the curriculum, 18-week learning plan, outcomes, and grading rubrics."
            wide
            onClose={() => {
              if (!isScanning) setIsUploadModalOpen(false);
            }}
            footer={
              <button
                type="button"
                disabled={isScanning}
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setScanError(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            }
          >
            {/* Modal Body */}
            <div className="space-y-5">
              {/* Error banner if any */}
              {scanError && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold">
                      {scanError.toLowerCase().includes('not a syllabus')
                        ? 'Not a Syllabus File — Upload Rejected'
                        : 'Document Scanning Error'}
                    </p>
                    <p className="text-[11px] opacity-90 leading-relaxed">{scanError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanError(null)}
                    className="p-1 hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
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

                  {/* Expected syllabus format hint */}
                  <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-foreground text-xs">Only official syllabi are accepted</p>
                      <p className="mt-0.5">
                        Files must match the institutional format (e.g.{' '}
                        <strong className="text-foreground">CMSC131_Course_Orientation.pdf</strong>): contain{' '}
                        <strong className="text-foreground">“Syllabus”</strong>,{' '}
                        <strong className="text-foreground">DMMMSU</strong>, form code{' '}
                        <strong className="text-foreground">DMMMSU-INS-F003</strong>, a course code (e.g. CMSC
                        131), course outcomes, and a learning plan. Other PDFs/DOCXs are automatically
                        rejected.
                      </p>
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
                    <p className="text-xs text-muted-foreground font-sans">
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
                  <div className="w-full max-w-md bg-black/80 dark:bg-black/50 p-3 rounded-xl border border-border text-left font-sans text-[11px] space-y-1 text-emerald-400">
                    {scanLogs.map((log, index) => (
                      <div key={index} className="flex items-center space-x-2 truncate">
                        <span className="text-muted-foreground">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </DialogFrame>
        </ModalPortal>
      )}
    </div>
  );
};
