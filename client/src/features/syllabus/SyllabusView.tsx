import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { createDefaultSyllabusForCourse, type OfficialSyllabusData, type FacultySchedule, normalizeRubricLevels, createEmptyRubricRow, type RubricLevel } from '../../shared/data/syllabusData';
import { scanSyllabusDocument, type ScanResult } from '../../shared/utils/syllabusParser';
import { parseFormattedSize, formatFileSize } from '../../shared/utils/fileUploader';
import { resolveSPRWeights } from '../../shared/utils/spr';
import { effectiveTerms, resolveCourseTerms } from '../../shared/utils/gradingTerms';
import type { TermId } from '../../shared/types/lms';
import { isFacultyRole, canManageCourseContent } from '../../shared/utils/roles';
import { findMatchingSiblingCourses } from '../../shared/utils/crossSectionSync';
import { CrossSectionPromptModal } from '../../shared/components/common/CrossSectionPromptModal';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { DialogFrame } from '../../shared/components/common/DialogFrame';
import { ModalPortal } from '../../shared/components/common/ModalPortal';
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
  Pencil,
  FolderOpen,
  Lock
} from 'lucide-react';
import { FilePickerModal } from '../../shared/components/common/FilePickerModal';
import { UploadProgress } from '../../shared/components/common/UploadProgress';
import { CustomDropdown, type DropdownOption } from '../../shared/components/common/CustomDropdown';
import { TimeRangePicker, RichTextEditor } from '../../shared/components/common';
import { SyllabusRevisionBar } from './components/SyllabusRevisionBar';
import type { SyllabusSectionKey } from '../../shared/types/syllabusApi';
import { useSimulatedUpload } from '../../shared/hooks/useSimulatedUpload';
import type { AggregatedCourseFile } from '../../shared/hooks/useCourseFiles';
import { resolveLikhaAssetUrl } from '../../shared/api/likhaLmsApi';

const PO_ALIGNMENT_OPTIONS: DropdownOption[] = [
  { value: '', label: '–' },
  { value: 'I', label: 'I' },
  { value: 'P', label: 'P' },
  { value: 'D', label: 'D' },
];

interface SyllabusViewProps {
  courseId: string;
}

export interface SyllabusSourceScanSummary {
  fileName: string;
  fileSize: string;
  fileType: 'pdf' | 'docx';
  fileDataUrl?: string;
}

export interface InstructorOption {
  id: string;
  name: string;
  label: string;
}

const NON_FACULTY_POSITION_PATTERN = /\b(director|institute|dean|chair(?:person)?|chancellor|president|coordinator|head|officer|signatory)\b/i;

export function normalizeCourseCode(code: string): string {
  return (code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isCourseNumberMismatch(courseCode?: string, detectedCode?: string): boolean {
  if (!courseCode || !detectedCode) return false;
  const a = normalizeCourseCode(courseCode);
  const b = normalizeCourseCode(detectedCode);
  return Boolean(a && b && a !== b);
}

export function normalizeCourseTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\b(ii|2)\b/g, '2')
    .replace(/\b(i|1)\b/g, '1')
    .replace(/\b(iii|3)\b/g, '3')
    .replace(/\b(iv|4)\b/g, '4')
    .replace(/\b(v|5)\b/g, '5')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCourseTitleMismatch(courseTitle?: string, detectedTitle?: string): boolean {
  if (!courseTitle || !detectedTitle) return false;
  const normA = normalizeCourseTitle(courseTitle);
  const normB = normalizeCourseTitle(detectedTitle);
  if (!normA || !normB) return false;
  return normA !== normB && !normA.includes(normB) && !normB.includes(normA);
}

export function cleanPersonTokens(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .replace(/\b(dr|prof|engr|atty|ms|mr|mrs|ph\.?d|ms\.?c|m\.?a|m\.?s|mit|bs|cpa)\b\.?/gi, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);
}

export function matchesPersonName(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;
  const lowerA = nameA.trim().toLowerCase();
  const lowerB = nameB.trim().toLowerCase();
  if (lowerA === lowerB) return true;
  if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) return true;

  const tokensA = cleanPersonTokens(nameA);
  const tokensB = cleanPersonTokens(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const common = tokensA.filter(t => tokensB.includes(t));
  return common.length >= Math.min(2, Math.min(tokensA.length, tokensB.length));
}

export function buildInstructorOptions(
  scanResult: ScanResult | null,
  facultyUsers: Array<{ id: string; name: string; title?: string }>,
  currentCourse?: { instructorId?: string; instructorName?: string } | null,
): InstructorOption[] {
  const scannedNames: string[] = (scanResult?.detectedFacultyNames || []).filter(
    name => !NON_FACULTY_POSITION_PATTERN.test(name)
  );
  const result: InstructorOption[] = [];
  for (const name of [...new Set(scannedNames)]) {
    // If the scanned name matches the assigned instructor of the course, prioritize that designation
    if (currentCourse?.instructorName && matchesPersonName(currentCourse.instructorName, name)) {
      const match = facultyUsers.find(u => matchesPersonName(u.name, name));
      result.push({
        id: match?.id || currentCourse.instructorId || `scanned:${name}`,
        name: match?.name || currentCourse.instructorName,
        label: `${match?.name || currentCourse.instructorName} — Assigned Course Instructor`,
      });
      continue;
    }

    const match = facultyUsers.find(u => matchesPersonName(u.name, name));
    if (match) {
      result.push({ id: match.id, name: match.name, label: `${match.name} — ${match.title || 'Faculty'}` });
    } else {
      result.push({ id: `scanned:${name}`, name, label: `${name} — from scanned syllabus` });
    }
  }

  // Fallback ONLY when no faculty names were detected in the document text at all:
  // Show registered faculty members so an instructor can be manually selected
  if (result.length === 0 && facultyUsers.length > 0) {
    return facultyUsers.map(u => ({
      id: u.id,
      name: u.name,
      label: `${u.name} — ${u.title || 'Faculty'}`,
    }));
  }

  return result;
}

export const buildSourceDocumentValue = (
  scan: SyllabusSourceScanSummary,
  uploaded: { id: string; fileDataUrl?: string },
): Record<string, unknown> => ({
  fileName: scan.fileName,
  fileSize: scan.fileSize,
  fileType: scan.fileType,
  ...(scan.fileDataUrl ? { fileDataUrl: scan.fileDataUrl } : {}),
  ...(uploaded.fileDataUrl ? { fileDataUrl: uploaded.fileDataUrl } : {}),
  uploadedAt: new Date().toISOString(),
  courseFileId: uploaded.id,
});

const syllabusEditorSectionPayloads = (
  sectionId: string,
  syllabus: OfficialSyllabusData,
): Array<[SyllabusSectionKey, unknown]> => {
  switch (sectionId) {
    case 'facultySchedule':
      return [['faculty', syllabus.facultyMembers]];
    case 'vgmo':
      return [['institutionalStatements', syllabus.institutionalStatements]];
    case 'programOutcomes':
      return [['programOutcomes', syllabus.programOutcomes]];
    case 'courseOutcomes':
      return [['courseOutcomes', syllabus.courseOutcomes]];
    case 'gradingSystem':
      return [['gradingSystem', syllabus.gradingSystem]];
    case 'projectRubrics':
      return [['rubrics', syllabus.projectRubrics]];
    case 'classroomPolicies':
      return [['policies', syllabus.classroomPolicies]];
    case 'courseOutline':
      return [['outline', syllabus.courseOutline]];
    case 'learningPlan':
      return [['learningPlan', syllabus.learningPlan]];
    case 'curriculumMap':
      return [['courseMap', syllabus.courseMap]];
    case 'referencesSignatures':
      return [
        ['references', syllabus.references],
        ['signatories', syllabus.signatories],
      ];
    default:
      return [];
  }
};

export const SyllabusView: React.FC<SyllabusViewProps> = ({ courseId }) => {
  const { db, activeUser, updateCourseSyllabus, removeCourseSyllabus, showAlert, showConfirm, uploadCourseFile, updateCourseGradingTerms, syllabusRevisions, updateSyllabusSection, publishSyllabusDraft, refreshCourseSyllabus } = useLMS();
  const currentCourse = db.courses.find(c => String(c.id).trim() === String(courseId).trim());
  const rawData = currentCourse?.syllabus || null;

  const [isFetchingSyllabus, setIsFetchingSyllabus] = useState(false);
  const attemptedCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rawData && courseId && attemptedCourseIdRef.current !== courseId && typeof refreshCourseSyllabus === 'function') {
      attemptedCourseIdRef.current = courseId;
      setIsFetchingSyllabus(true);
      void refreshCourseSyllabus(courseId).finally(() => {
        setIsFetchingSyllabus(false);
      });
    }
  }, [courseId, rawData, refreshCourseSyllabus]);
  const data = useMemo<OfficialSyllabusData | null>(() => {
    if (!rawData) return null;
    const base = currentCourse ? createDefaultSyllabusForCourse(currentCourse) : null;
    return {
      ...(base || {}),
      ...rawData,
      institution: {
        ...(base?.institution || {
          university: 'Don Mariano Marcos Memorial State University',
          college: 'College of Information Technology',
          formCode: 'DMMMSU-INS-F003',
          revision: 'REV. 02'
        }),
        ...(rawData.institution || {}),
      },
      courseInfo: {
        ...(base?.courseInfo || {}),
        ...(rawData.courseInfo || {}),
        code: rawData.courseInfo?.code || currentCourse?.code || base?.courseInfo?.code || '',
        title: rawData.courseInfo?.title || currentCourse?.title || base?.courseInfo?.title || '',
      },
      institutionalStatements: {
        ...(base?.institutionalStatements || {}),
        ...(rawData.institutionalStatements || {}),
      },
      gradingSystem: {
        ...(base?.gradingSystem || {}),
        ...(rawData.gradingSystem || {}),
      },
      signatories: {
        preparedBy: Array.isArray(rawData.signatories?.preparedBy)
          ? rawData.signatories.preparedBy
          : (Array.isArray(rawData.signatories) && rawData.signatories.length > 0
              ? rawData.signatories.map((s: any) => ({ name: s.name || '', title: s.title || s.role || 'Course Instructor' }))
              : (base?.signatories?.preparedBy || [{ name: (currentCourse?.instructorName || 'Faculty Instructor').toUpperCase(), title: 'Course Lead' }])),
        recommendingApproval: (!Array.isArray(rawData.signatories) && rawData.signatories?.recommendingApproval)
          ? { ...(base?.signatories?.recommendingApproval || {}), ...rawData.signatories.recommendingApproval }
          : (base?.signatories?.recommendingApproval || { name: 'DR. MARLON R. PERALTA', title: 'Program Chairperson' }),
        approved: (!Array.isArray(rawData.signatories) && rawData.signatories?.approved)
          ? { ...(base?.signatories?.approved || {}), ...rawData.signatories.approved }
          : (base?.signatories?.approved || { name: 'DR. MARIA TERESA M. ALHAMBRA', title: 'Dean, College of Computer Science' }),
      },
      classroomPolicies: Array.isArray(rawData.classroomPolicies) && rawData.classroomPolicies.length > 0
        ? rawData.classroomPolicies
        : (Array.isArray((rawData as any).policies) && (rawData as any).policies.length > 0
            ? (rawData as any).policies.map((p: any) => typeof p === 'string' ? p : `${p.title ? p.title + ': ' : ''}${p.content || p.description || ''}`)
            : (base?.classroomPolicies || [])),
      projectRubrics: Array.isArray(rawData.projectRubrics) && rawData.projectRubrics.length > 0
        ? rawData.projectRubrics
        : (base?.projectRubrics || []),
      courseMap: Array.isArray(rawData.courseMap) && rawData.courseMap.length > 0
        ? rawData.courseMap
        : (base?.courseMap || []),
      courseOutline: Array.isArray(rawData.courseOutline) && rawData.courseOutline.length > 0
        ? rawData.courseOutline
        : (base?.courseOutline || []),
      references: Array.isArray(rawData.references) && rawData.references.length > 0
        ? rawData.references.map((r: any) => ({
            citation: r.citation || r.title || 'Course Handout',
            year: String(r.year || new Date().getFullYear()),
            doiOrPublisher: r.doiOrPublisher || r.author || undefined,
          }))
        : (base?.references || []),
      learningPlan: (
        Array.isArray(rawData.learningPlan) && rawData.learningPlan.length > 0
          ? rawData.learningPlan
          : (Array.isArray((rawData as any).learningPlans) && (rawData as any).learningPlans.length > 0
              ? (rawData as any).learningPlans
              : (base?.learningPlan || []))
      ).map((lp: any) => {
        const topics = Array.isArray(lp.topics)
          ? lp.topics.filter(Boolean)
          : (lp.topic ? [String(lp.topic)] : (lp.topic_content ? String(lp.topic_content).split('; ') : []));
        const learningOutcomes = Array.isArray(lp.learningOutcomes)
          ? lp.learningOutcomes.filter(Boolean)
          : (lp.outcomes ? [String(lp.outcomes)] : (lp.intended_learning_outcome ? String(lp.intended_learning_outcome).split('; ') : []));
        const methodology = Array.isArray(lp.methodology)
          ? lp.methodology.filter(Boolean)
          : (lp.activities ? [String(lp.activities)] : (lp.teachingActivities ? [String(lp.teachingActivities)] : (lp.teaching_activities ? String(lp.teaching_activities).split('; ') : [])));
        const assessment = Array.isArray(lp.assessment)
          ? lp.assessment.filter(Boolean)
          : (lp.assessments ? [String(lp.assessments)] : (lp.assessment_tasks ? String(lp.assessment_tasks).split('; ') : []));
        return {
          ...lp,
          week: lp.week || lp.weeks || lp.time_allotment_weeks || `Week ${lp.unitNo || 1}`,
          topics: topics.length > 0 ? topics : ['Course Topic'],
          learningOutcomes,
          methodology,
          assessment,
          hoursLec: lp.hoursLec ?? 2,
          hoursLab: lp.hoursLab ?? 3,
        };
      }),
    } as OfficialSyllabusData;
  }, [rawData, currentCourse]);
  const revision = syllabusRevisions[courseId] ?? null;
  const isPublishedRevision = revision?.status === 'published';
  const isCustomSyllabus = Boolean(currentCourse?.syllabus);
  const canManageSyllabus = canManageCourseContent(currentCourse, activeUser);

  // All eligible faculty members
  const facultyUsers = useMemo(() => {
    return db.users.filter(u => isFacultyRole(u, u.role));
  }, [db.users]);

  const gradingWeights = useMemo(() => resolveSPRWeights(data?.gradingSystem ?? null), [data]);

  // Syllabus-driven grading terms: auto-detected from the course outline
  // unless a per-course override was saved (Task 6 editor below).
  const TERM_ORDER: TermId[] = ['prelim', 'midterm', 'finals'];
  const TERM_LABELS_SYLLABUS: Record<TermId, string> = { prelim: 'Prelim', midterm: 'Midterm', finals: 'Finals' };
  const detectedTerms = useMemo(() => resolveCourseTerms(data), [data]);
  const activeTerms = useMemo(() => effectiveTerms(currentCourse ?? null, data), [currentCourse, data]);
  const isTermsOverridden = Boolean(currentCourse?.gradingTerms && currentCourse.gradingTerms.length > 0);

  // Check if current user is the assigned instructor for this course
  const isFacultyCreator = canManageCourseContent(currentCourse, activeUser);

  const isSyllabusLocked = useMemo(() => {
    if (currentCourse?.syllabusStatus === 'locked') return true;
    try {
      const raw = localStorage.getItem('gabay_syllabus_lifecycle_records');
      if (raw && currentCourse) {
        const records = JSON.parse(raw);
        const normCode = (currentCourse.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const rec of Object.values(records) as any[]) {
          const recCode = (rec.courseCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isCourseMatch =
            (rec.courseIds && rec.courseIds.includes(currentCourse.id)) ||
            (recCode && normCode && recCode === normCode);
          if (isCourseMatch && rec.status === 'locked') {
            return true;
          }
        }
      }
    } catch {}
    return false;
  }, [currentCourse]);

  const canEditSyllabus = isFacultyCreator && !isSyllabusLocked;

  const siblingCourses = useMemo(() => {
    return currentCourse ? findMatchingSiblingCourses(currentCourse, db.courses || [], activeUser?.id) : [];
  }, [currentCourse, db.courses, activeUser?.id]);

  const [isCrossSectionModalOpen, setIsCrossSectionModalOpen] = useState(false);

  // Deletion Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Upload & Scanner Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // Raw scanned file retained so syllabus apply can send the bytes to the
  // files endpoint (area: syllabus) — the server owns filing.
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);

  // Faculty detection & selection for syllabus scanner
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [detectedFacultyName, setDetectedFacultyName] = useState<string>('');
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);

  // Merged instructor list: only names actually detected in the scanned
  // document text. The scanned syllabus object still carries the template's
  // facultyMembers array (the scanner never rewrites it), so those entries
  // must not be presented as "from scanned syllabus".
  const instructorOptions = useMemo(
    () => buildInstructorOptions(scanResult, facultyUsers, currentCourse),
    [scanResult, facultyUsers, currentCourse],
  );

  // Collapsible Accordion State - MINIMIZED BY DEFAULT as requested!
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState<string>('all');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfficialSyllabusData | null>(null);
  // Per-course grading-terms override draft (null = auto-detect from the
  // syllabus outline). Edited only inside the gradingSystem section.
  const [gradingTermsOverride, setGradingTermsOverride] = useState<TermId[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const upload = useSimulatedUpload();

  const cloneSyllabus = (s: OfficialSyllabusData): OfficialSyllabusData =>
    JSON.parse(JSON.stringify(s)) as OfficialSyllabusData;

  const startEditing = (sectionId: string) => {
    if (!data) return;
    if (isSyllabusLocked) {
      showAlert(
        'This course syllabus development has been locked by the Department Chairperson. Editing is disabled.',
        'Syllabus Locked'
      );
      return;
    }
    if (isPublishedRevision) {
      showAlert(
        'This revision is published and read-only. Create a draft to make changes.',
        'Read-only Revision'
      );
      return;
    }
    setDraft(cloneSyllabus(data));
    if (sectionId === 'gradingSystem') {
      setGradingTermsOverride(currentCourse?.gradingTerms ? [...currentCourse.gradingTerms] : null);
    }
    setEditingSection(sectionId);
    setExpandedSections(prev => ({ ...prev, [sectionId]: true }));
  };

  const cancelEditing = () => {
    setDraft(null);
    setGradingTermsOverride(null);
    setEditingSection(null);
  };

  const saveDraft = async () => {
    if (!draft || !editingSection) return;
    if (isSyllabusLocked) {
      showAlert('This course syllabus development has been locked by the Department Chairperson.', 'Syllabus Locked');
      return;
    }
    // Grading-terms override: at least one term must stay checked.
    if (editingSection === 'gradingSystem' && gradingTermsOverride !== null && gradingTermsOverride.length === 0) {
      showAlert({
        title: 'Grading Terms Required',
        message: 'Select at least one grading term, or reset to auto-detect.',
        type: 'warning'
      });
      return;
    }
    setIsSaving(true);
    try {
      const payloads = syllabusEditorSectionPayloads(editingSection, draft);
      if (payloads.length === 0) {
        await updateCourseSyllabus(courseId, draft);
      } else {
        for (const [section, value] of payloads) {
          await updateSyllabusSection(courseId, section, value);
        }
      }
      if (editingSection === 'gradingSystem') {
        const current = currentCourse?.gradingTerms ?? null;
        const same =
          JSON.stringify([...(current ?? [])].sort()) ===
          JSON.stringify([...(gradingTermsOverride ?? [])].sort());
        if (!same) {
          await updateCourseGradingTerms(courseId, gradingTermsOverride);
        }
      }
      showAlert({
        title: 'Syllabus Updated',
        message: 'Section changes have been saved.',
        type: 'success'
      });
      setDraft(null);
      setGradingTermsOverride(null);
      setEditingSection(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save this section.';
      showAlert(message, 'Save Section Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!data || isCreatingDraft) return;
    setIsCreatingDraft(true);
    setIsSaving(true);
    try {
      await updateCourseSyllabus(courseId, data);
      showAlert({
        title: 'Draft Created',
        message: 'A new draft revision was created from the published syllabus.',
        type: 'success'
      });
    } catch {
    } finally {
      setIsCreatingDraft(false);
      setIsSaving(false);
    }
  };

  const handlePublishDraft = () => {
    if (!revision || revision.status !== 'draft' || isPublishing) return;
    showConfirm(
      `Publish revision ${revision.revisionNo} of this syllabus? Students will see the published version.`,
      () => {
        void (async () => {
          setIsPublishing(true);
          try {
            await publishSyllabusDraft(courseId);
            showAlert({
              title: 'Syllabus Published',
              message: `Revision ${revision.revisionNo} is now published.`,
              type: 'success'
            });
          } catch {
          } finally {
            setIsPublishing(false);
          }
        })();
      },
      'Publish Syllabus'
    );
  };

  const editBar = (sectionId: string) =>
    editingSection === sectionId && draft ? (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
        <span className="text-[11px] font-bold text-primary">Editing — changes are not saved yet</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="px-3 py-1.5 text-[11px] font-bold bg-card border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveDraft}
            disabled={isSaving}
            className="px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </div>
    ) : null;

  const inputCls =
    'w-full p-2 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1';

  const processFile = async (file: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setScanError('Invalid file type. Please upload an official syllabus as .pdf or .docx — other documents (activities, images, spreadsheets) are rejected.');
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
    setScanStepText(`Initializing parser for ${file.name}...`);

    try {
      const result = await scanSyllabusDocument(file, (progress, step) => {
        setScanProgress(progress);
        setScanStepText(step);
      });
      setScanResult(result);
      setScannedFile(file);

      // Auto-detect faculty member from document text: ONLY names actually scanned from the file
      const scannedNames = (result.detectedFacultyNames || [])
        .filter(name => Boolean(name) && !NON_FACULTY_POSITION_PATTERN.test(name));

      // Prioritize the Assigned Instructor of the course: ONLY if they match a faculty in the syllabus,
      // automatically set them as the auto-matched instructor.
      const assignedInstructorName = (currentCourse?.instructorName || '').trim();
      const assignedInstructorUser = (db.users || []).find(
        u => (currentCourse?.instructorId && u.id === currentCourse.instructorId) ||
             (assignedInstructorName && matchesPersonName(u.name, assignedInstructorName))
      );
      const effectiveAssignedName = assignedInstructorUser?.name || assignedInstructorName;

      const matchedAssignedSyllabusName = effectiveAssignedName
        ? scannedNames.find(sName => matchesPersonName(sName, effectiveAssignedName))
        : undefined;

      if (matchedAssignedSyllabusName) {
        const assignedId = assignedInstructorUser?.id || currentCourse?.instructorId || `scanned:${matchedAssignedSyllabusName}`;
        const assignedDisplayName = assignedInstructorUser?.name || currentCourse?.instructorName || matchedAssignedSyllabusName;
        setSelectedFacultyId(assignedId);
        setDetectedFacultyName(assignedDisplayName);
        setIsAutoDetected(true);
      } else {
        const otherFoundFaculty = facultyUsers.find(u =>
          scannedNames.some(sName => matchesPersonName(u.name, sName))
        );

        if (otherFoundFaculty) {
          setSelectedFacultyId(otherFoundFaculty.id);
          setDetectedFacultyName(otherFoundFaculty.name);
          setIsAutoDetected(true);
        } else if (scannedNames.length > 0) {
          // If the syllabus has faculty members, select the first scanned faculty member from the syllabus
          setSelectedFacultyId(`scanned:${scannedNames[0]}`);
          setDetectedFacultyName(scannedNames[0]);
          setIsAutoDetected(true);
        } else if (currentCourse?.instructorId && facultyUsers.some(u => u.id === currentCourse.instructorId)) {
          // Fallback only when NO faculty was detected in the document text at all
          setSelectedFacultyId(currentCourse.instructorId);
          setDetectedFacultyName(currentCourse.instructorName || 'Course Instructor');
          setIsAutoDetected(false);
        } else {
          setSelectedFacultyId(facultyUsers[0]?.id || activeUser.id);
          setDetectedFacultyName(facultyUsers[0]?.name || activeUser.name);
          setIsAutoDetected(false);
        }
      }

      // Close upload modal to transition to full-width review page
      setIsUploadModalOpen(false);
    } catch (err: any) {
      const message: string = err?.message || 'Error occurred while scanning document. Please check the file.';
      setScanError(message);
      setScanResult(null);
      setScannedFile(null);
      // Keep the upload modal open so the user sees why the file was rejected
      setIsUploadModalOpen(true);
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

  const handleSelectExistingFile = async (file: AggregatedCourseFile) => {
    const url = file.url || file.fileUrl;
    if (!url) {
      setScanError('This uploaded file cannot be scanned because it has no stored content.');
      return;
    }

    try {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
        setScanError('Invalid file type. Please select an uploaded syllabus as .pdf or .docx.');
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        setScanError('Could not read the selected uploaded file. It may not be available on disk.');
        return;
      }
      const blob = await response.blob();
      const reconstructed = new File([blob], file.name, {
        type: file.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      setIsFilePickerOpen(false);
      await processFile(reconstructed);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to read the selected uploaded file.');
    }
  };

  // Only the faculty creator of the course is shown in the syllabus
  const facultyListToDisplay = useMemo((): FacultySchedule[] => {
    if (!data?.facultyMembers || data.facultyMembers.length === 0) {
      return [{
        name: currentCourse?.instructorName || activeUser.name || 'Faculty Instructor',
        sections: [
          { section: currentCourse?.section || '', lectureSchedule: currentCourse?.schedule || 'TBA', lectureRoom: currentCourse?.room || 'TBA', labSchedule: '', labRoom: '' }
        ],
        consultation: 'TBA',
        consultationSlots: []
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

  const handleApplySyllabus = async (targetCourseIdsOverride?: string[]) => {
    if (!scanResult || !currentCourse || upload.isUploading || isApplying) return;

    // Find the chosen faculty member
    const chosenFaculty = facultyUsers.find(u => u.id === selectedFacultyId)
      || instructorOptions.find(o => o.id === selectedFacultyId)
      || activeUser;

    // Prepare bound faculty schedule for the single course instructor
    const existingFacultySchedule = scanResult.syllabus.facultyMembers.find(f =>
      f.name.toLowerCase().includes(chosenFaculty.name.toLowerCase()) ||
      chosenFaculty.name.toLowerCase().includes(f.name.toLowerCase())
    );

    const fallbackSched = scanResult.syllabus.facultyMembers?.[0];
    const boundFacultySchedule: FacultySchedule = existingFacultySchedule ? {
      ...existingFacultySchedule,
      name: chosenFaculty.name
    } : {
      name: chosenFaculty.name,
      sections: [
        {
          section: currentCourse.section || fallbackSched?.sections?.[0]?.section || '',
          lectureSchedule: currentCourse.schedule || fallbackSched?.sections?.[0]?.lectureSchedule || 'TBA',
          lectureRoom: currentCourse.room || fallbackSched?.sections?.[0]?.lectureRoom || 'TBA',
          labSchedule: '',
          labRoom: ''
        }
      ],
      consultationSlots: fallbackSched?.consultationSlots || [{ days: [], time: 'TBA' }]
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

    const executeApplySyllabus = async (targetCourseIds: string[]) => {
      setIsApplying(true);
      try {
        for (const targetId of targetCourseIds) {
          const targetCourse = db.courses.find(c => c.id === targetId);
          const targetBoundSyllabus: OfficialSyllabusData = {
            ...boundSyllabus,
            courseId: targetId,
            courseInfo: {
              ...boundSyllabus.courseInfo,
              code: targetCourse?.code || boundSyllabus.courseInfo.code,
              title: targetCourse?.title || boundSyllabus.courseInfo.title,
            },
            facultyMembers: [
              {
                ...boundFacultySchedule,
                sections: [
                  { section: targetCourse?.section || boundFacultySchedule.sections?.[0]?.section || '', lectureSchedule: boundFacultySchedule.sections?.[0]?.lectureSchedule || '', lectureRoom: boundFacultySchedule.sections?.[0]?.lectureRoom || '', labSchedule: '', labRoom: '' }
                ]
              }
            ]
          };

          try {
            await updateCourseSyllabus(targetId, targetBoundSyllabus);
          } catch {
            // Context already surfaced the alert; do not file the document for this target
            continue;
          }

          if (targetId === courseId) {
            upload.start(scannedFile?.name ?? scanResult.fileName);
          }
          try {
            const resolvedBytes = scannedFile?.size
              || parseFormattedSize(scanResult.fileSize)
              || 1024 * 1024;
            const resolvedFormatted = (scanResult.fileSize && scanResult.fileSize !== '0 B')
              ? scanResult.fileSize
              : formatFileSize(resolvedBytes);

            const uploaded = await uploadCourseFile({
              courseId: targetId,
              area: 'syllabus',
              name: scanResult.fileName,
              rawFile: scannedFile ?? undefined,
              size: resolvedBytes,
              formattedSize: resolvedFormatted,
              type: scanResult.fileType === 'pdf' ? 'pdf' : 'document',
              visibility: 'published',
            });
            if (targetId === courseId) {
              upload.complete();
            }
            if (uploaded && typeof uploaded.id === 'string') {
              try {
                await updateSyllabusSection(
                  targetId,
                  'sourceDocument',
                  buildSourceDocumentValue(
                    {
                      fileName: scanResult.fileName,
                      fileSize: scanResult.fileSize,
                      fileType: scanResult.fileType === 'docx' ? 'docx' : 'pdf',
                    },
                    { id: uploaded.id }
                  )
                );
              } catch {
              }
            }
          } catch {
            if (targetId === courseId) {
              upload.fail();
            }
          }
        }

        showAlert({
          title: 'Syllabus Updated Successfully',
          message: `Course syllabus for ${currentCourse.code} synchronized with "${scanResult.fileName}".` +
            (targetCourseIds.length > 1 ? ` (Replicated across ${targetCourseIds.length} sections)` : ''),
          type: 'success'
        });
        setIsUploadModalOpen(false);
        setScanResult(null);
        setScannedFile(null);
      } finally {
        setIsApplying(false);
      }
    };

    if (targetCourseIdsOverride) {
      await executeApplySyllabus(targetCourseIdsOverride);
      return;
    }

    if (siblingCourses.length > 0) {
      setIsCrossSectionModalOpen(true);
      return;
    }

    await executeApplySyllabus([courseId]);
  };

  const handleResetToDefault = async () => {
    if (!currentCourse) return;
    const defaultSyllabus = createDefaultSyllabusForCourse(currentCourse);
    try {
      await updateCourseSyllabus(courseId, defaultSyllabus);
    } catch {
      // Context already surfaced the alert.
      return;
    }
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
    if (!data || !Array.isArray(data.learningPlan)) return [];
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
        (item.week || '').toLowerCase().includes(q) ||
        (item.topics || []).some(t => (t || '').toLowerCase().includes(q)) ||
        (item.learningOutcomes || []).some(lo => (lo || '').toLowerCase().includes(q)) ||
        (item.methodology || []).some(m => (m || '').toLowerCase().includes(q)) ||
        (item.assessment || []).some(a => (a || '').toLowerCase().includes(q)) ||
        (item.sdgCoherence || []).some(s => (s.title || '').toLowerCase().includes(q))
    );
  }, [searchQuery, activeWeekTab, data]);

  const handleConfirmDeleteSyllabus = () => {
    void (async () => {
      try {
        await removeCourseSyllabus(courseId);
      } catch {
        // Context already surfaced the alert.
        return;
      }
      setIsDeleteModalOpen(false);
      showAlert({
        title: 'Syllabus Removed',
        message: `The syllabus for "${currentCourse?.code || 'Course'}" has been successfully removed.`,
        type: 'info'
      });
    })();
  };

  const handleDownloadSyllabus = () => {
    const doc = data?.sourceDocument;
    if (doc?.fileDataUrl) {
      const fileName = doc.fileName || `${currentCourse?.code || 'Course'}_Syllabus.${doc.fileType || 'pdf'}`;
      const link = document.createElement('a');
      link.href = doc.fileDataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert({
        title: 'Downloading Syllabus',
        message: `Downloading "${fileName}" to your device.`,
        type: 'info'
      });
      return;
    }

    showAlert({
      title: 'No Source File Available',
      message: 'No uploaded syllabus document file is currently available for download.',
      type: 'warning'
    });
  };

  const handlePrint = () => {
    const doc = data?.sourceDocument;
    const fileUrl = doc?.fileDataUrl ? resolveLikhaAssetUrl(doc.fileDataUrl) : undefined;

    // If PDF source file exists, print directly via iframe
    if (fileUrl && (doc?.fileType === 'pdf' || fileUrl.includes('.pdf') || fileUrl.startsWith('data:application/pdf'))) {
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
      // Print the rendered HTML syllabus view using the browser's print dialog
      window.print();
    }
  };

  // Full-page Review & Verification when scanResult is present
  if (scanResult && !isScanning) {
    const chosenFaculty = (db.users || []).find(u => u.id === selectedFacultyId)
      || facultyUsers.find(u => u.id === selectedFacultyId)
      || instructorOptions.find(o => o.id === selectedFacultyId)
      || (detectedFacultyName ? { id: selectedFacultyId, name: detectedFacultyName } : activeUser);

    const detectedCode = scanResult.detectedCourseCode || scanResult.syllabus?.courseInfo?.code || '';
    const detectedTitle = scanResult.detectedCourseTitle || scanResult.syllabus?.courseInfo?.title || '';
    const isNumberMismatch = isCourseNumberMismatch(currentCourse?.code, detectedCode);
    const isTitleMismatch = isCourseTitleMismatch(currentCourse?.title, detectedTitle);
    const isCourseMismatch = isNumberMismatch || isTitleMismatch;

    return (
      <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-20 font-sans">
        {/* Verification strip — identity and actions in one place */}
        <div className="lg:sticky lg:top-0 z-10 py-2 bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setScanResult(null);
                setScanError(null);
                setScannedFile(null);
              }}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold"
              title="Return to syllabus"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[15px] font-extrabold tracking-tight text-foreground truncate">
                  Verify scanned syllabus
                </h2>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                {scanResult.fileName} · {scanResult.fileSize} · {scanResult.fileType.toUpperCase()} — parsed for {currentCourse?.code || 'this course'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                  setScannedFile(null);
                  setIsUploadModalOpen(true);
                }}
                className="px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Scan another</span>
              </button>
            </div>
          </div>
        </div>

        {/* Course Code & Descriptive Title Mismatch Warning Tab */}
        {isCourseMismatch && (
          <div
            data-testid="syllabus-course-mismatch-warning"
            role="alert"
            className="p-4 sm:p-5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl shadow-subtle space-y-3 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {isNumberMismatch && isTitleMismatch
                    ? 'Course Number & Descriptive Title Mismatch'
                    : isNumberMismatch
                    ? 'Course Number Mismatch'
                    : 'Descriptive Title Mismatch'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-full border border-amber-500/30">
                Warning
              </span>
            </div>

            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              The uploaded syllabus document does not match the currently open course shell (<strong className="font-semibold text-foreground">{currentCourse?.code || 'Course'} — {currentCourse?.title || ''}</strong>). Please verify that you selected the intended syllabus file before applying.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-3 bg-card/90 border border-border rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  Current Course Shell
                </span>
                <div className="font-bold text-foreground">
                  {currentCourse?.code || '—'}
                </div>
                <div className="text-muted-foreground text-[11px] truncate">
                  {currentCourse?.title || '—'}
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 dark:text-amber-400 block">
                  Detected in Uploaded Syllabus
                </span>
                <div className="font-bold text-amber-950 dark:text-amber-200">
                  {detectedCode || '—'}
                </div>
                <div className="text-amber-900/80 dark:text-amber-300/80 text-[11px] truncate">
                  {detectedTitle || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status line — quiet confirmation, not a second header */}
        <div className="flex items-start gap-2.5 px-1">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Ready to review.</span>{' '}
            Document parsed against DMMMSU curriculum standards
            {scanResult.validation.isScannedImage ? ' from an image-based PDF (metadata signals)' : ''}.
            Confirm the instructor and extracted details below, then apply.
          </p>
        </div>

        {/* Extraction summary — one quiet strip */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/70 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3">
            <dt className="text-[11.5px] font-medium text-muted-foreground truncate">Learning weeks</dt>
            <dd className="text-[22px] font-extrabold tabular-nums tracking-tight text-foreground leading-tight">
              {scanResult.stats.learningWeeksCount}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-[11.5px] font-medium text-muted-foreground truncate">Outcomes</dt>
            <dd className="text-[22px] font-extrabold tabular-nums tracking-tight text-foreground leading-tight">
              {scanResult.stats.outcomesCount}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-[11.5px] font-medium text-muted-foreground truncate">Rubrics</dt>
            <dd className="text-[22px] font-extrabold tabular-nums tracking-tight text-foreground leading-tight">
              {scanResult.stats.rubricsCount}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-[11.5px] font-medium text-muted-foreground truncate">References</dt>
            <dd className="text-[22px] font-extrabold tabular-nums tracking-tight text-foreground leading-tight">
              {scanResult.stats.referencesCount}
            </dd>
          </div>
        </dl>

        {/* Review flow — numbered steps down the main column, actions pinned right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
          {/* Main review column */}
          <div className="space-y-5 min-w-0">
            {/* 01 — Instructor selection */}
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
                          {(chosenFaculty as any).title || 'Course Instructor'} • {(chosenFaculty as any).program || (chosenFaculty as any).department || 'Computer Science'}
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
                  <dd className="font-semibold text-foreground text-right flex items-center justify-end gap-1.5 flex-wrap">
                    <span>{scanResult.detectedCourseCode} · {scanResult.detectedCourseTitle}</span>
                    {isCourseMismatch && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        Differs from course shell
                      </span>
                    )}
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
                    {typeof scanResult.syllabus.gradingSystem.termFormula === 'object'
                      ? `Class Standing ${scanResult.syllabus.gradingSystem.termFormula.classStandingPercent}% + Exam ${scanResult.syllabus.gradingSystem.termFormula.examPercent}%`
                      : scanResult.syllabus.gradingSystem.termFormula}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground shrink-0">Final grade</dt>
                  <dd className="font-semibold text-foreground text-right">
                    {typeof scanResult.syllabus.gradingSystem.finalFormula === 'object'
                      ? `Midterm ${scanResult.syllabus.gradingSystem.finalFormula.midtermPercent}% + Final ${scanResult.syllabus.gradingSystem.finalFormula.finalPercent}%`
                      : scanResult.syllabus.gradingSystem.finalFormula}
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
              {upload.isUploading && upload.fileName && (
                <UploadProgress fileName={upload.fileName} progress={upload.progress} />
              )}
              <button
                type="button"
                onClick={() => handleApplySyllabus()}
                disabled={upload.isUploading || isApplying}
                className="w-full py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait"
              >
                {(isApplying || upload.isUploading)
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Check className="w-4 h-4" />}
                <span>{(isApplying || upload.isUploading) ? 'Applying...' : 'Apply syllabus'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                  setScannedFile(null);
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

        {/* Cross-section prompt modal when sibling sections exist */}
        <CrossSectionPromptModal
          isOpen={isCrossSectionModalOpen}
          onClose={() => setIsCrossSectionModalOpen(false)}
          itemType="syllabus"
          itemTitle={scanResult?.fileName || 'Official Syllabus'}
          siblingCourses={siblingCourses}
          onConfirm={async (selectedIds) => {
            setIsCrossSectionModalOpen(false);
            await handleApplySyllabus([courseId, ...selectedIds]);
          }}
          onSkipToCurrentOnly={async () => {
            setIsCrossSectionModalOpen(false);
            await handleApplySyllabus([courseId]);
          }}
          isSubmitting={isApplying || upload.isUploading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-20 px-1 font-sans">
      <PageHeader
        title="Syllabus"
        eyebrow={currentCourse?.code}
        description={currentCourse?.title}
      />
      {!data ? (
        isFetchingSyllabus ? (
          <div className="p-12 sm:p-20 bg-card border border-border rounded-2xl shadow-subtle text-center space-y-4 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-80" />
            <p className="text-sm font-medium text-muted-foreground">Loading course syllabus...</p>
          </div>
        ) : (
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
                  setScannedFile(null);
                  setIsScanning(false);
                  setScanProgress(0);
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
        )
      ) : (
        <>
          {isSyllabusLocked && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 shrink-0" />
              <span>This course syllabus development has been locked by the Department Chairperson. Editing, scanning, and revisions are disabled until released.</span>
            </div>
          )}
          <SyllabusRevisionBar
            revision={revision}
            canEdit={canEditSyllabus}
            isDirty={editingSection !== null && draft !== null}
            isPublishing={isPublishing}
            isCreatingDraft={isCreatingDraft}
            onCreateDraft={() => {
              void handleCreateDraft();
            }}
            onPublish={handlePublishDraft}
          />
          {/* =========================================================
              TOP BANNER: Official University & Syllabus Metadata
              ========================================================= */}
          <div className="p-6 sm:p-7 bg-card border border-border rounded-2xl space-y-5 relative overflow-hidden">

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6 pt-1">
          <div className="space-y-2 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1">
              {data.institution?.university || 'Don Mariano Marcos Memorial State University'} · {data.institution?.college || 'College of Information Technology'}
            </div>

            <h1 className="text-[22px] sm:text-[28px] font-extrabold tracking-tight text-foreground my-2.5 leading-tight">
              {data.courseInfo?.code || currentCourse?.code || 'CS'}: {data.courseInfo?.title || currentCourse?.title || 'Course'}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-[12px] text-muted-foreground font-medium pt-3 pb-1 border-t border-border/40 mt-3">
              <span>
                {currentCourse?.term?.includes('AY')
                  ? currentCourse.term
                  : `${currentCourse?.term || data.courseInfo?.semester || '1st Semester'}, AY ${data.courseInfo?.academicYear || '2025-2026'}`}
              </span>
              <span>·</span>
              <span className="text-foreground font-semibold">{data.courseInfo?.credit || (currentCourse as any)?.units || '3 units'}</span>
              <span>({data.courseInfo?.lectureHours || '2 hrs lec'}, {data.courseInfo?.labHours || '3 hrs lab'})</span>
              <span>·</span>
              <span>Prereq: <strong className="text-foreground">{data.courseInfo?.prerequisite || 'None'}</strong></span>
              {currentCourse?.section && (
                <>
                  <span>·</span>
                  <span>Enrolled: <strong className="text-foreground font-semibold">Section {currentCourse.section}</strong></span>
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
                  setScannedFile(null);
                  setIsScanning(false);
                  setScanProgress(0);
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
        <div className="text-[12px] text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/80 space-y-1">
          <span className="font-semibold text-foreground block text-[12px]">
            Course rationale and description
          </span>
          <p className="text-foreground/90">{data.courseInfo?.description || (currentCourse as any)?.description || 'No description provided.'}</p>
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
          SECTION 1: Faculty & Section Schedules
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('facultySchedule')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Faculty & Schedule
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Faculty Members, Section Allocations & Consultation Hours
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); startEditing('facultySchedule'); setExpandedSections(prev => ({ ...prev, facultySchedule: true })); }}
                className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Edit section" disabled={isPublishedRevision}
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
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.facultySchedule ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.facultySchedule || editingSection === 'facultySchedule') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-5 ${editingSection === 'facultySchedule' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'facultySchedule' && draft ? (
                <div className="space-y-4">
                  {editBar('facultySchedule')}
                  {(draft.facultyMembers.length ? draft.facultyMembers : facultyListToDisplay).map((fac, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div>
                        <label className={labelCls}>Instructor name</label>
                        <input
                          type="text"
                          value={fac.name}
                          onChange={e => {
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              if (!next.facultyMembers[idx]) return prev;
                              next.facultyMembers[idx].name = e.target.value;
                              return next;
                            });
                          }}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Assigned class sections
                        </span>
                        {fac.sections.map((sec, sIdx) => (
                          <div key={sIdx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                            <div>
                              <label className={labelCls}>Section</label>
                              <input type="text" value={sec.section} onChange={e => {
                                setDraft(prev => {
                                  if (!prev) return prev;
                                  const next = cloneSyllabus(prev);
                                  next.facultyMembers[idx].sections[sIdx].section = e.target.value;
                                  return next;
                                });
                              }} className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>Schedule</label>
                              <TimeRangePicker
                                value={sec.lectureSchedule}
                                onChange={val => {
                                  setDraft(prev => {
                                    if (!prev) return prev;
                                    const next = cloneSyllabus(prev);
                                    next.facultyMembers[idx].sections[sIdx].lectureSchedule = val;
                                    return next;
                                  });
                                }}
                                includeDays={true}
                                placeholder="Click to select schedule"
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Room</label>
                              <input type="text" value={sec.lectureRoom} onChange={e => {
                                setDraft(prev => {
                                  if (!prev) return prev;
                                  const next = cloneSyllabus(prev);
                                  next.facultyMembers[idx].sections[sIdx].lectureRoom = e.target.value;
                                  return next;
                                });
                              }} className={inputCls} />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft(prev => {
                                  if (!prev) return prev;
                                  const next = cloneSyllabus(prev);
                                  next.facultyMembers[idx].sections = next.facultyMembers[idx].sections.filter((_, i) => i !== sIdx);
                                  return next;
                                });
                              }}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Remove section row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              if (!next.facultyMembers[idx]) return prev;
                              next.facultyMembers[idx].sections.push({ section: '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' });
                              return next;
                            });
                          }}
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          + Add section row
                        </button>
                      </div>
                      <div>
                        <label className={labelCls}>Consultation hours</label>
                        <input
                          type="text"
                          value={(fac.consultationSlots || []).map(s => [s.days.join(','), s.time].filter(Boolean).join(' ')).filter(Boolean).join('; ') || ''}
                          readOnly
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
                      <span className="font-bold text-foreground text-[11px]">{(fac.consultationSlots || []).map(s => [s.days.join(','), s.time].filter(Boolean).join(' ')).filter(Boolean).join('; ') || 'Not set'}</span>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 2: Institutional VGMO, Core Values & Attributes (Part I)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('vgmo')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Part I · Mandates
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Philosophy, Vision, Mission, Goal, Core Values & Graduate Attributes
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); startEditing('vgmo'); setExpandedSections(prev => ({ ...prev, vgmo: true })); }}
                className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Edit section" disabled={isPublishedRevision}
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
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.vgmo ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.vgmo || editingSection === 'vgmo') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'vgmo' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'vgmo' && draft ? (
                <div className="space-y-4">
                  {editBar('vgmo')}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(['philosophy', 'vision', 'mission', 'goal'] as const).map(field => (
                      <div key={field} className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                        <label className={labelCls}>{field}</label>
                        <textarea
                          rows={3}
                          value={draft.institutionalStatements[field]}
                          onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.institutionalStatements[field] = v;
                              return next;
                            });
                          }}
                          className={`${inputCls} min-h-[72px] resize-y`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                      DMMMSU Core Values (PRIDE)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {draft.institutionalStatements.coreValues.map((val, idx) => (
                        <div key={idx} className="p-2.5 bg-background rounded-lg border border-border space-y-1.5">
                          <input
                            type="text"
                            value={val.keyword}
                            onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.coreValues[idx].keyword = v;
                                return next;
                              });
                            }}
                            className={inputCls}
                            placeholder="Keyword (e.g. SERVICE)"
                          />
                          <textarea
                            rows={2}
                            value={val.description}
                            onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.coreValues[idx].description = v;
                                return next;
                              });
                            }}
                            className={`${inputCls} min-h-[52px] resize-y`}
                            placeholder="Description"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.coreValues = next.institutionalStatements.coreValues.filter((_, i) => i !== idx);
                                return next;
                              });
                            }}
                            className="text-[11px] font-bold text-destructive hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.institutionalStatements.coreValues.push({ acronym: '', keyword: '', description: '' });
                          return next;
                        });
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      + Add core value
                    </button>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                      DMMMSU Institutional Graduate Attributes
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {draft.institutionalStatements.graduateAttributes.map((attr, idx) => (
                        <div key={idx} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                          <input
                            type="text"
                            value={attr.title}
                            onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.graduateAttributes[idx].title = v;
                                return next;
                              });
                            }}
                            className={inputCls}
                            placeholder="Attribute title"
                          />
                          <textarea
                            rows={2}
                            value={attr.description}
                            onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.graduateAttributes[idx].description = v;
                                return next;
                              });
                            }}
                            className={`${inputCls} min-h-[52px] resize-y`}
                            placeholder="Description"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.institutionalStatements.graduateAttributes = next.institutionalStatements.graduateAttributes.filter((_, i) => i !== idx);
                                return next;
                              });
                            }}
                            className="text-[11px] font-bold text-destructive hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          const maxNo = next.institutionalStatements.graduateAttributes.reduce((m, a) => Math.max(m, a.number), 0);
                          next.institutionalStatements.graduateAttributes.push({ number: maxNo + 1, title: '', description: '' });
                          return next;
                        });
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      + Add attribute
                    </button>
                  </div>
                </div>
              ) : (
              <>
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 3: BSCS Program Outcomes (PO 1 to PO 11)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('programOutcomes')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
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
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('programOutcomes'); setExpandedSections(prev => ({ ...prev, programOutcomes: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.programOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.programOutcomes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.programOutcomes || editingSection === 'programOutcomes') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'programOutcomes' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'programOutcomes' && draft ? (
                <div className="space-y-3">
                  {editBar('programOutcomes')}
                  {draft.programOutcomes.map((po, idx) => (
                    <div key={`po-edit-${po.number}-${idx}`} className="flex items-start gap-2">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary font-bold text-[11px] shrink-0 mt-1">PO {po.number}</span>
                      <textarea
                        rows={2}
                        value={po.description}
                        onChange={e => {
                          const v = e.target.value;
                          setDraft(prev => {
                            if (!prev) return prev;
                            const next = cloneSyllabus(prev);
                            next.programOutcomes[idx].description = v;
                            return next;
                          });
                        }}
                        className={`${inputCls} flex-1 min-h-[56px] resize-y`}
                      />
                      <button type="button" onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.programOutcomes = next.programOutcomes.filter((_, i) => i !== idx).map((po, i) => ({ ...po, number: i + 1 }));
                          return next;
                        });
                      }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    setDraft(prev => {
                      if (!prev) return prev;
                      const next = cloneSyllabus(prev);
                      const maxNo = next.programOutcomes.reduce((m, p) => Math.max(m, p.number), 0);
                      next.programOutcomes.push({ number: maxNo + 1, description: '' });
                      return next;
                    });
                  }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add outcome</button>
                </div>
              ) : (
              <>
              <p className="text-xs text-muted-foreground font-medium pb-1">
                Upon graduation, successful BSCS graduates will attain the following program outcomes:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.programOutcomes.map((po, idx) => (
                  <div
                    key={`po-${po.number}-${idx}`}
                    className="p-3 bg-muted/20 border border-border rounded-xl flex items-start space-x-3 hover:border-primary/40 transition-colors"
                  >
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-sans font-bold text-[11px] shrink-0 mt-0.5">
                      PO {po.number}
                    </span>
                    <p className="text-foreground/90 text-xs leading-relaxed">{po.description}</p>
                  </div>
                ))}
              </div>
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 4: Course Outcomes (CO1 to CO9)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('courseOutcomes')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
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
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('courseOutcomes'); setExpandedSections(prev => ({ ...prev, courseOutcomes: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutcomes ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.courseOutcomes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.courseOutcomes || editingSection === 'courseOutcomes') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'courseOutcomes' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'courseOutcomes' && draft ? (
                <div className="space-y-3">
                  {editBar('courseOutcomes')}
                  {draft.courseOutcomes.map((co, idx) => (
                    <div key={`co-edit-${co.number}-${idx}`} className="flex items-start gap-2">
                      <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-bold text-[11px] shrink-0 mt-1">CO {co.number}</span>
                      <textarea rows={2} value={co.statement} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.courseOutcomes[idx].statement = v;
                          return next;
                        });
                      }} className={`${inputCls} flex-1 min-h-[56px] resize-y`} />
                      <button type="button" onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.courseOutcomes = next.courseOutcomes.filter((_, i) => i !== idx).map((co, i) => ({ ...co, number: i + 1 }));
                          return next;
                        });
                      }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    setDraft(prev => {
                      if (!prev) return prev;
                      const next = cloneSyllabus(prev);
                      const maxNo = next.courseOutcomes.reduce((m, c) => Math.max(m, c.number), 0);
                      next.courseOutcomes.push({ number: maxNo + 1, statement: '' });
                      return next;
                    });
                  }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add outcome</button>
                </div>
              ) : (
              <>
              <p className="text-xs text-muted-foreground font-medium">
                By the end of this course, students should be able to:
              </p>
              <div className="space-y-2.5">
                {data.courseOutcomes.map((co, idx) => (
                  <div
                    key={`co-${co.number}-${idx}`}
                    className="p-3 rounded-xl bg-muted/20 border border-border flex items-start space-x-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground border border-border font-sans font-semibold text-[11px] shrink-0 mt-0.5">
                      CO {co.number}
                    </span>
                    <span className="text-foreground text-xs leading-relaxed font-medium">
                      {co.statement}
                    </span>
                  </div>
                ))}
              </div>
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 5: Requirements & Official Grading System (60/40)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('gradingSystem')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Evaluation Scheme
                </span>
                <span className={gradingWeights.parseError ? "text-[10px] font-sans bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md" : "text-[10px] text-muted-foreground font-sans"}>{gradingWeights.parseError ? 'Grading formula needs attention' : gradingWeights.formulaLabel}</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Requirements & Official Grading Formula
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('gradingSystem'); setExpandedSections(prev => ({ ...prev, gradingSystem: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.gradingSystem ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.gradingSystem ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.gradingSystem || editingSection === 'gradingSystem') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'gradingSystem' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'gradingSystem' && draft ? (
                <div className="space-y-4">
                  {editBar('gradingSystem')}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Term formula (Class Standing %)</label>
                      <input type="text" value={typeof draft.gradingSystem.termFormula === 'object' ? draft.gradingSystem.termFormula.classStandingPercent : ''} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          const current = typeof next.gradingSystem.termFormula === 'object' ? next.gradingSystem.termFormula : { classStandingPercent: '', examPercent: '' };
                          next.gradingSystem.termFormula = { ...current, classStandingPercent: v };
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Term formula (Exam %)</label>
                      <input type="text" value={typeof draft.gradingSystem.termFormula === 'object' ? draft.gradingSystem.termFormula.examPercent : ''} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          const current = typeof next.gradingSystem.termFormula === 'object' ? next.gradingSystem.termFormula : { classStandingPercent: '', examPercent: '' };
                          next.gradingSystem.termFormula = { ...current, examPercent: v };
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Final formula (Midterm %)</label>
                      <input type="text" value={typeof draft.gradingSystem.finalFormula === 'object' ? draft.gradingSystem.finalFormula.midtermPercent : ''} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          const current = typeof next.gradingSystem.finalFormula === 'object' ? next.gradingSystem.finalFormula : { midtermPercent: '', finalPercent: '' };
                          next.gradingSystem.finalFormula = { ...current, midtermPercent: v };
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Final formula (Final %)</label>
                      <input type="text" value={typeof draft.gradingSystem.finalFormula === 'object' ? draft.gradingSystem.finalFormula.finalPercent : ''} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          const current = typeof next.gradingSystem.finalFormula === 'object' ? next.gradingSystem.finalFormula : { midtermPercent: '', finalPercent: '' };
                          next.gradingSystem.finalFormula = { ...current, finalPercent: v };
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Class standing components (comma-separated titles)</label>
                      <input type="text" value={Array.isArray(draft.gradingSystem.classStandingComponents) 
                        ? draft.gradingSystem.classStandingComponents.map(c => typeof c === 'string' ? c : c.title).join(', ')
                        : ''} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.gradingSystem.classStandingComponents = v.split(',').map(s => ({ title: s.trim(), percentage: '' })).filter(c => c.title);
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Passing grade</label>
                      <input type="text" value={draft.gradingSystem.passingGrade} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.gradingSystem.passingGrade = v;
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={labelCls}>Grading terms</span>
                      {gradingTermsOverride !== null ? (
                        <button
                          type="button"
                          onClick={() => setGradingTermsOverride(null)}
                          className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                        >
                          Reset to auto-detect
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Auto-detected: {detectedTerms.map(t => TERM_LABELS_SYLLABUS[t]).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TERM_ORDER.map(t => {
                        const base = gradingTermsOverride ?? detectedTerms;
                        const checked = base.includes(t);
                        const isLastChecked = checked && base.length === 1;
                        return (
                          <label
                            key={t}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors ${
                              checked
                                ? 'bg-primary/10 border-primary/30 text-foreground'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...new Set([...base, t])]
                                  : base.filter(x => x !== t);
                                if (next.length === 0) {
                                  showAlert({
                                    title: 'Grading Terms Required',
                                    message: 'At least one grading term must stay selected.',
                                    type: 'warning'
                                  });
                                  return;
                                }
                                setGradingTermsOverride(
                                  [...next].sort((a, b) => TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b))
                                );
                              }}
                              disabled={isLastChecked}
                              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <span>{TERM_LABELS_SYLLABUS[t]}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {gradingTermsOverride !== null
                        ? `Custom override — assessment term pickers offer: ${gradingTermsOverride.map(t => TERM_LABELS_SYLLABUS[t]).join(', ')}.`
                        : 'Assessment term pickers follow the auto-detected terms. Check a box to pin a custom set.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Major requirements (one per line)</label>
                      <textarea rows={5} value={draft.courseRequirements.major.join('\n')} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.courseRequirements.major = v.split('\n').map(s => s.trim()).filter(Boolean);
                          return next;
                        });
                      }} className={`${inputCls} min-h-[110px] resize-y`} />
                    </div>
                    <div>
                      <label className={labelCls}>Other requirements (one per line)</label>
                      <textarea rows={5} value={draft.courseRequirements.other.join('\n')} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.courseRequirements.other = v.split('\n').map(s => s.trim()).filter(Boolean);
                          return next;
                        });
                      }} className={`${inputCls} min-h-[110px] resize-y`} />
                    </div>
                  </div>
                </div>
              ) : (
              <>
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
                      {typeof data.gradingSystem.termFormula === 'object'
                        ? `Class Standing ${data.gradingSystem.termFormula.classStandingPercent}% + Exam ${data.gradingSystem.termFormula.examPercent}%`
                        : data.gradingSystem.termFormula}
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Class Standing: {Array.isArray(data.gradingSystem.classStandingComponents)
                        ? data.gradingSystem.classStandingComponents.map(c => typeof c === 'string' ? c : c.title).join(', ')
                        : String(data.gradingSystem.classStandingComponents)}
                    </span>
                  </div>

                  <div className="p-3 bg-background border border-border rounded-xl space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Semestral Final Grade
                    </span>
                    <div className="font-sans font-bold text-sm text-foreground">
                      {typeof data.gradingSystem.finalFormula === 'object'
                        ? `Midterm ${data.gradingSystem.finalFormula.midtermPercent}% + Final ${data.gradingSystem.finalFormula.finalPercent}%`
                        : data.gradingSystem.finalFormula}
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Minimum passing mark: {data.gradingSystem.passingGrade}
                    </span>
                  </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Grading terms:</span>
                    <span className="font-semibold text-foreground">
                      {activeTerms.map(t => TERM_LABELS_SYLLABUS[t]).join(', ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border font-medium ${
                      isTermsOverridden
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {isTermsOverridden ? 'Custom override' : 'Auto-detected'}
                    </span>
                  </div>
                </div>
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 6: Group Project Presentation & Documentation Rubrics
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('projectRubrics')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
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
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('projectRubrics'); setExpandedSections(prev => ({ ...prev, projectRubrics: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.projectRubrics ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.projectRubrics ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.projectRubrics || editingSection === 'projectRubrics') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'projectRubrics' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'projectRubrics' && draft ? (
                <div className="space-y-4">
                  {editBar('projectRubrics')}
                  {draft.projectRubrics.map((r, i) => {
                    const levels = normalizeRubricLevels(r.levels);
                    return (
                      <div key={i} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={r.category} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.projectRubrics[i].category = v;
                              return next;
                            });
                          }} className={inputCls} placeholder="Category" />
                          <button type="button" onClick={() => {
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.projectRubrics = next.projectRubrics.filter((_, x) => x !== i);
                              return next;
                            });
                          }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove row">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Performance Levels ({levels.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {levels.map((lv: RubricLevel, lvIdx) => (
                              <div key={lvIdx} className="space-y-1.5 p-2 rounded-lg border border-border bg-background">
                                <input type="text" value={lv.title} onChange={e => {
                                  const v = e.target.value;
                                  setDraft(prev => {
                                    if (!prev) return prev;
                                    const next = cloneSyllabus(prev);
                                    const arr = Array.isArray(next.projectRubrics[i].levels) ? next.projectRubrics[i].levels as any : [];
                                    arr[lvIdx] = { ...arr[lvIdx], title: v };
                                    next.projectRubrics[i].levels = arr;
                                    return next;
                                  });
                                }} className="px-2 py-1 text-[11px] font-bold rounded border border-border bg-muted/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Level title" />
                                <textarea rows={2} value={lv.description} onChange={e => {
                                  const v = e.target.value;
                                  setDraft(prev => {
                                    if (!prev) return prev;
                                    const next = cloneSyllabus(prev);
                                    const arr = Array.isArray(next.projectRubrics[i].levels) ? next.projectRubrics[i].levels as any : [];
                                    arr[lvIdx] = { ...arr[lvIdx], description: v };
                                    next.projectRubrics[i].levels = arr;
                                    return next;
                                  });
                                }} className={`${inputCls} min-h-[52px] resize-y`} placeholder="Describe performance..." />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => {
                    setDraft(prev => {
                      if (!prev) return prev;
                      const next = cloneSyllabus(prev);
                      next.projectRubrics.push(createEmptyRubricRow(4));
                      return next;
                    });
                  }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add rubric row</button>
                </div>
              ) : (
              <>
              <p className="text-xs text-muted-foreground font-medium">
                Teams are evaluated across core engineering and presentation criteria scored on performance levels:
              </p>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 min-w-[200px] text-[11.5px] font-semibold text-muted-foreground text-left">Evaluation criteria</th>
                      {data.projectRubrics[0]?.levels
                        ? normalizeRubricLevels(data.projectRubrics[0].levels).map((lv, idx) => (
                            <th key={idx} className="px-4 py-3 min-w-[160px] text-[11.5px] font-semibold text-muted-foreground text-left">{lv.title || `Level ${idx + 1}`}</th>
                          ))
                        : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.projectRubrics.map((r, i) => {
                      const levels = normalizeRubricLevels(r.levels);
                      return (
                        <tr key={i} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground align-top">
                            {r.category}
                          </td>
                          {levels.map((lv, idx) => (
                            <td key={idx} className="px-4 py-3 text-muted-foreground text-[11px] leading-relaxed align-top">
                              {lv.description}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 7: Classroom Policies & Standards of Conduct
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('classroomPolicies')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
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
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('classroomPolicies'); setExpandedSections(prev => ({ ...prev, classroomPolicies: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.classroomPolicies ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.classroomPolicies ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.classroomPolicies || editingSection === 'classroomPolicies') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'classroomPolicies' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'classroomPolicies' && draft ? (
                <div className="space-y-3">
                  {editBar('classroomPolicies')}
                  {draft.classroomPolicies.map((pol, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-2">{idx + 1}</span>
                      <textarea rows={2} value={pol} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.classroomPolicies[idx] = v;
                          return next;
                        });
                      }} className={`${inputCls} flex-1 min-h-[52px] resize-y`} />
                      <button type="button" onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.classroomPolicies = next.classroomPolicies.filter((_, i) => i !== idx);
                          return next;
                        });
                      }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    setDraft(prev => {
                      if (!prev) return prev;
                      const next = cloneSyllabus(prev);
                      next.classroomPolicies.push('');
                      return next;
                    });
                  }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add policy</button>
                </div>
              ) : (
              <>
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 8: Course Outline & Timeline (Part II)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('courseOutline')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Part II · Outline
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">18 Weeks Roadmap</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Course Outline and Time Frame
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('courseOutline'); setExpandedSections(prev => ({ ...prev, courseOutline: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.courseOutline ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.courseOutline ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.courseOutline || editingSection === 'courseOutline') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-3 text-xs ${editingSection === 'courseOutline' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'courseOutline' && draft ? (
                <div className="space-y-3">
                  {editBar('courseOutline')}
                  {draft.courseOutline.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Time frame</label>
                          <input type="text" value={item.timeFrame} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.courseOutline[idx].timeFrame = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Title</label>
                          <input type="text" value={item.title} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.courseOutline[idx].title = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Topics</label>
                        <RichTextEditor
                          content={(item.topics || [])[0] || ''}
                          onChange={(html: string) => {
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.courseOutline[idx].topics = [html];
                              return next;
                            });
                          }}
                          className="min-h-[100px]"
                        />
                      </div>
                      <button type="button" onClick={() => {
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.courseOutline = next.courseOutline.filter((_, i) => i !== idx);
                          return next;
                        });
                      }} className="text-[11px] font-bold text-destructive hover:underline cursor-pointer">Remove block</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    setDraft(prev => {
                      if (!prev) return prev;
                      const next = cloneSyllabus(prev);
                      next.courseOutline.push({ timeFrame: '', title: '', topics: [] });
                      return next;
                    });
                  }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add block</button>
                </div>
              ) : (
              <>
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 9: Detailed 18-Week Learning Plan (Part III)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('learningPlan')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Part III · Learning plan
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">SDG Integration & Deliverables</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Detailed 18-Week Learning Plan, Methodology & Assessment
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('learningPlan'); setExpandedSections(prev => ({ ...prev, learningPlan: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.learningPlan ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.learningPlan ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.learningPlan || editingSection === 'learningPlan') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'learningPlan' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'learningPlan' && draft ? (
                <div className="space-y-4">
                  {editBar('learningPlan')}
                  {draft.learningPlan.map((plan, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px] gap-2">
                        <div>
                          <label className={labelCls}>Week</label>
                          <input type="text" value={plan.week} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.learningPlan[idx].week = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Lec hrs</label>
                          <input type="text" inputMode="decimal" value={plan.hoursLec === 0 ? '' : plan.hoursLec} placeholder="0" onChange={e => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            const v = raw === '' ? 0 : Number(raw);
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.learningPlan[idx].hoursLec = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Lab hrs</label>
                          <input type="text" inputMode="decimal" value={plan.hoursLab === 0 ? '' : plan.hoursLab} placeholder="0" onChange={e => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            const v = raw === '' ? 0 : Number(raw);
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.learningPlan[idx].hoursLab = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Topics</label>
                          <RichTextEditor
                            content={(plan.topics || [])[0] || ''}
                            onChange={html => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.learningPlan[idx].topics = [html];
                                return next;
                              });
                            }}
                            className="min-h-[100px]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Learning Outcomes</label>
                          <RichTextEditor
                            content={(plan.learningOutcomes || [])[0] || ''}
                            onChange={html => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.learningPlan[idx].learningOutcomes = [html];
                                return next;
                              });
                            }}
                            className="min-h-[100px]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Methodology</label>
                          <RichTextEditor
                            content={(plan.methodology || [])[0] || ''}
                            onChange={html => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.learningPlan[idx].methodology = [html];
                                return next;
                              });
                            }}
                            className="min-h-[80px]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Assessment</label>
                          <RichTextEditor
                            content={(plan.assessment || [])[0] || ''}
                            onChange={html => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.learningPlan[idx].assessment = [html];
                                return next;
                              });
                            }}
                            className="min-h-[80px]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Resources</label>
                          <RichTextEditor
                            content={(plan.resources || [])[0] || ''}
                            onChange={html => {
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.learningPlan[idx].resources = [html];
                                return next;
                              });
                            }}
                            className="min-h-[80px]"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>SDG Coherence</label>
                          <div className="text-xs text-muted-foreground mb-2">Updated in Syllabus Studio with multiple SDG selection and explanations</div>
                          {(plan.sdgCoherence || []).length > 0 ? (
                            <div className="space-y-1">
                              {plan.sdgCoherence.map((sdg, sdgIdx) => (
                                <div key={sdgIdx} className="p-1.5 rounded-sm bg-muted/20 border border-border/60">
                                  <div className="font-bold text-xs">{sdg.goal}: {sdg.title}</div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">{sdg.description}</div>
                                  {sdg.explanation && (
                                    <div className="text-[11px] italic mt-0.5 text-foreground/70">→ {sdg.explanation}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">No SDGs assigned</div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>SDG title</label>
                          <input type="text" value={plan.sdgCoherence?.[0]?.title || ''} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              const cur = next.learningPlan[idx].sdgCoherence?.[0];
                              if (cur) {
                                next.learningPlan[idx].sdgCoherence = [{
                                  ...cur,
                                  title: v
                                }];
                              }
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>SDG description</label>
                          <textarea rows={2} value={plan.sdgCoherence?.[0]?.description || ''} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              const cur = next.learningPlan[idx].sdgCoherence?.[0];
                              if (cur) {
                                next.learningPlan[idx].sdgCoherence = [{
                                  ...cur,
                                  description: v
                                }];
                              }
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <>
              {/* Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
                <div className="flex items-center space-x-1.5">
                  {(['all', 'prelim', 'midterm', 'finals'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveWeekTab(tab)}
                      className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                        activeWeekTab === tab
                          ? 'bg-foreground text-background'
                          : 'bg-card text-muted-foreground border border-border hover:text-foreground'
                      }`}
                    >
                      {tab === 'all' ? 'All weeks' : tab}
                    </button>
                  ))}
                </div>

                <span className="text-[12px] text-muted-foreground tabular-nums">
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
                        <span className="px-3 py-1 rounded-full bg-muted text-foreground border border-border font-sans font-semibold text-xs">
                          {plan.week}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          {(plan.topics || [])[0] || 'Course Topic'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[12px] font-sans text-muted-foreground">
                        <span>Lec {plan.hoursLec}h</span>
                        <span>·</span>
                        <span>Lab {plan.hoursLab}h</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Learning Outcomes
                          </span>
                          <ul className="space-y-1 pt-1 text-foreground/90">
                            {(plan.learningOutcomes || []).map((lo, i) => (
                              <li key={i} className="flex items-start space-x-1.5">
                                <span className="text-primary font-bold">&bull;</span>
                                <span>{lo}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {(plan.sdgCoherence || []).length > 0 && (
                          <div className="space-y-1.5">
                            {plan.sdgCoherence.map((sdg, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-300 text-[11px] space-y-0.5">
                                <span className="font-bold uppercase tracking-wider block text-[10px]">
                                  {sdg.goal}: {sdg.title}
                                </span>
                                <p>{sdg.description}</p>
                                {sdg.explanation && (
                                  <span className="font-sans text-[10px] block opacity-85 italic">
                                    → {sdg.explanation}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Methodology & Learning Activities
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(plan.methodology || []).map((m, i) => (
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
                            {(plan.assessment || []).map((a, i) => (
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 10: Curriculum Course Map (Part IV)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('curriculumMap')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Part IV · Course map
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">CO to PO Matrix</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Curriculum Mapping: Course Outcomes (CO) to Program Outcomes (PO)
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('curriculumMap'); setExpandedSections(prev => ({ ...prev, curriculumMap: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.curriculumMap ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.curriculumMap ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.curriculumMap || editingSection === 'curriculumMap') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-4 text-xs ${editingSection === 'curriculumMap' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'curriculumMap' && draft ? (
                <div className="space-y-4">
                  {editBar('curriculumMap')}
                  {draft.courseMap.map((row, rIdx) => (
                    <div key={`cmap-edit-${row.coNumber}-${rIdx}`} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div>
                        <label className={labelCls}>CO {row.coNumber} statement</label>
                        <textarea rows={2} value={row.coStatement} onChange={e => {
                          const v = e.target.value;
                          setDraft(prev => {
                            if (!prev) return prev;
                            const next = cloneSyllabus(prev);
                            next.courseMap[rIdx].coStatement = v;
                            return next;
                          });
                        }} className={`${inputCls} min-h-[52px] resize-y`} />
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                        {Array.from({ length: 11 }).map((_, i) => {
                          const po = i + 1;
                          return (
                            <div key={po}>
                              <label className={labelCls}>PO{po}</label>
                              <CustomDropdown
                                variant="compact"
                                className="min-w-0"
                                value={row.poAlignments[po] || ''}
                                placeholder="–"
                                options={PO_ALIGNMENT_OPTIONS}
                                onChange={v => {
                                  const val = v as '' | 'I' | 'P' | 'D';
                                  setDraft(prev => {
                                    if (!prev) return prev;
                                    const next = cloneSyllabus(prev);
                                    next.courseMap[rIdx].poAlignments[po] = val;
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <>
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
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 min-w-[280px] text-[11.5px] font-semibold text-muted-foreground text-left">Course outcomes (CO)</th>
                      {Array.from({ length: 11 }).map((_, i) => (
                        <th key={i} className="px-2 py-3 text-center min-w-[42px] font-sans text-[11.5px] font-semibold text-muted-foreground">
                          PO{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-sans">
                    {data.courseMap.map((row, rIdx) => (
                      <tr key={`cmap-${row.coNumber}-${rIdx}`} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium text-xs leading-relaxed">
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          SECTION 11: Academic References & Official Signatories (Parts V & VI)
          ========================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          onClick={() => toggleSection('referencesSignatures')}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center space-x-3.5 truncate min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 transition-transform">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-sans font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                  Parts V and VI · References and signatories
                </span>
                <span className="text-[10px] text-muted-foreground font-sans">15 Academic Sources</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                Official Textbook References & Institutional Approvals
              </h3>
            </div>
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-1.5">
            {canEditSyllabus && (
              <button type="button" onClick={e => { e.stopPropagation(); startEditing('referencesSignatures'); setExpandedSections(prev => ({ ...prev, referencesSignatures: true })); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Edit section" disabled={isPublishedRevision}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className={`w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-200 ${
              expandedSections.referencesSignatures ? 'rotate-180 text-primary bg-primary/10' : ''
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
            expandedSections.referencesSignatures ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          {(expandedSections.referencesSignatures || editingSection === 'referencesSignatures') && (
          <div className="overflow-hidden min-h-0">
            <div className={`p-5 sm:p-6 border-t bg-card space-y-6 text-xs ${editingSection === 'referencesSignatures' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {editingSection === 'referencesSignatures' && draft ? (
                <div className="space-y-4">
                  {editBar('referencesSignatures')}
                  <div className="space-y-2">
                    <label className={labelCls}>References (citation + year + publisher)</label>
                    {draft.references.map((ref, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                        <div className="flex items-start gap-2">
                          <textarea rows={2} value={ref.citation} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.references[idx].citation = v;
                              return next;
                            });
                          }} className={`${inputCls} flex-1 min-h-[52px] resize-y`} placeholder="Citation" />
                          <button type="button" onClick={() => {
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.references = next.references.filter((_, i) => i !== idx);
                              return next;
                            });
                          }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-2">
                          <div>
                            <label className={labelCls}>Year</label>
                            <input type="text" value={ref.year} onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.references[idx].year = v;
                                return next;
                              });
                            }} className={inputCls} placeholder="2025" />
                          </div>
                          <div>
                            <label className={labelCls}>DOI / Publisher</label>
                            <input type="text" value={ref.doiOrPublisher || ''} onChange={e => {
                              const v = e.target.value;
                              setDraft(prev => {
                                if (!prev) return prev;
                                const next = cloneSyllabus(prev);
                                next.references[idx].doiOrPublisher = v;
                                return next;
                              });
                            }} className={inputCls} placeholder="Publisher or DOI" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      setDraft(prev => {
                        if (!prev) return prev;
                        const next = cloneSyllabus(prev);
                        next.references.push({ citation: '', year: String(new Date().getFullYear()) });
                        return next;
                      });
                    }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add reference</button>
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Prepared by (name + title)</label>
                    {draft.signatories.preparedBy.map((sig, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div>
                          <label className={labelCls}>Name</label>
                          <input type="text" value={sig.name} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.signatories.preparedBy[i].name = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Title</label>
                          <input type="text" value={sig.title} onChange={e => {
                            const v = e.target.value;
                            setDraft(prev => {
                              if (!prev) return prev;
                              const next = cloneSyllabus(prev);
                              next.signatories.preparedBy[i].title = v;
                              return next;
                            });
                          }} className={inputCls} />
                        </div>
                        <button type="button" onClick={() => {
                          setDraft(prev => {
                            if (!prev) return prev;
                            const next = cloneSyllabus(prev);
                            next.signatories.preparedBy = next.signatories.preparedBy.filter((_, x) => x !== i);
                            return next;
                          });
                        }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      setDraft(prev => {
                        if (!prev) return prev;
                        const next = cloneSyllabus(prev);
                        next.signatories.preparedBy.push({ name: '', title: '' });
                        return next;
                      });
                    }} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">+ Add signatory</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Recommending approval — name</label>
                      <input type="text" value={draft.signatories.recommendingApproval.name} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.signatories.recommendingApproval.name = v;
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Recommending approval — title</label>
                      <input type="text" value={draft.signatories.recommendingApproval.title} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.signatories.recommendingApproval.title = v;
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Approved — name</label>
                      <input type="text" value={draft.signatories.approved.name} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.signatories.approved.name = v;
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Approved — title</label>
                      <input type="text" value={draft.signatories.approved.title} onChange={e => {
                        const v = e.target.value;
                        setDraft(prev => {
                          if (!prev) return prev;
                          const next = cloneSyllabus(prev);
                          next.signatories.approved.title = v;
                          return next;
                        });
                      }} className={inputCls} />
                    </div>
                  </div>
                </div>
              ) : (
              <>
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
              </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* =========================================================
          FACULTY ACTIONS: REMOVE SYLLABUS (CREATOR ONLY)
          ========================================================= */}
      {canEditSyllabus && (
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

                  {/* Browse uploaded files */}
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsFilePickerOpen(true)}
                      className="px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 border border-primary/30 bg-primary/5"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Browse Uploaded Files</span>
                    </button>
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
                </div>
              )}

            </div>
          </DialogFrame>
        </ModalPortal>
      )}

      {isFilePickerOpen && (
        <FilePickerModal
          courseId={courseId}
          onClose={() => setIsFilePickerOpen(false)}
          onSelect={handleSelectExistingFile}
        />
      )}

      <CrossSectionPromptModal
        isOpen={isCrossSectionModalOpen}
        onClose={() => setIsCrossSectionModalOpen(false)}
        itemType="syllabus"
        itemTitle={scanResult?.fileName || 'Official Syllabus'}
        siblingCourses={siblingCourses}
        onConfirm={async (selectedIds) => {
          setIsCrossSectionModalOpen(false);
          await handleApplySyllabus([courseId, ...selectedIds]);
        }}
        onSkipToCurrentOnly={async () => {
          setIsCrossSectionModalOpen(false);
          await handleApplySyllabus([courseId]);
        }}
        isSubmitting={isApplying}
      />
    </div>
  );
};
