import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLMS } from '../../../../shared/context/LMSContext';
import {
  ChevronDown,
  Download,
  Search,
  Lock,
  Globe,
  Calculator,
  SlidersHorizontal,
} from 'lucide-react';
import {
  autoScoreFraction,
  bucketColumnsByTerm,
  buildAutoColumns,
  finalPercentTerms,
  resolveExamScore,
  round2,
  termGradeStatic,
  resolveAssessmentCategory,
  categoryWeightedClassStanding,
  DEFAULT_CATEGORY_WEIGHTS,
  getStoredCategoryWeights,
} from '../../../../shared/utils/spr';
import type { TermWeightsResult } from '../../../../shared/utils/spr';
import type { SPRColumn, SPRWeights } from '../../../../shared/types/lms';
import type { TermId } from '../../../../shared/utils/gradingTerms';
import { normalizeTermId } from '../../../../shared/utils/gradingTerms';
import { TERM_LABELS } from '../../../../shared/components/common/TermSelect';
import { exportSPRToExcel } from '../../../../shared/utils/sprExport';

interface FacultyGradebookProps {
  courseId: string;
}

// Institutional CHED / University Transmutation Table (1.00 - 5.00)
export const getTransmutedGrade = (
  percentage: number | null | undefined
): { grade: string; remark: 'Passed' | 'Failed' | 'Pending'; color: string } => {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return { grade: '—', remark: 'Pending', color: 'text-muted-foreground bg-muted border-border' };
  }
  if (percentage >= 98) return { grade: '1.00', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 95) return { grade: '1.25', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 92) return { grade: '1.50', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 89) return { grade: '1.75', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 86) return { grade: '2.00', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 83) return { grade: '2.25', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 80) return { grade: '2.50', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 77) return { grade: '2.75', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (percentage >= 75) return { grade: '3.00', remark: 'Passed', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  return { grade: '5.00', remark: 'Failed', color: 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' };
};

// Short period labels for the dense grade-table headers (classic Midterm/Final
// blocks keep their pre-change "MT"/"FT" wording).
const TERM_SHORT: Record<TermId, string> = { prelim: 'Prelim', midterm: 'MT', finals: 'FT' };

export const FacultyGradebook: React.FC<FacultyGradebookProps> = ({ courseId }) => {
  const navigate = useNavigate();
  const { db, showAlert, effectiveTermsForCourse, isLoading = false, isSyncing = false, setGradesReleased, upsertManualExamGrade, getSPRConfig } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const releaseMap = course?.gradesReleased || {};
  const approvedIds = new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.courseId === courseId && r.status === 'approved')
      .map(r => r.studentId)
  );
  const students = db.users.filter(
    u => u.role === 'student' && ((u.enrolledCourseIds || []).includes(courseId) || approvedIds.has(u.id))
  );

  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');


  // Syllabus-driven grading terms (Task 7): one period block per effective term.
  // Guarded like Task 6 consumers so mocked contexts without the provider fn
  // still render the classic pair. Defined before the collapse state so a
  // first-time visit (no stored preference) can default to all-collapsed.
  const terms = useMemo((): TermId[] => (
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['midterm', 'finals']
  ), [courseId, course, effectiveTermsForCourse]);

  // Collapsible term groups: a collapsed term renders only its grade column
  // (1 col instead of N items + exam + grade), persisted per course so faculty
  // keep their preferred density across reloads. First visit defaults to all
  // collapsed for maximum scannability; expanding is one click per term.
  const collapseKey = `gabay-gradebook-collapsed-${courseId}`;
  const [collapsedTerms, setCollapsedTerms] = useState<Set<TermId>>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(collapseKey) : null;
      if (raw === null) return new Set(terms);
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((t): t is TermId => t === 'prelim' || t === 'midterm' || t === 'finals') : []);
    } catch {
      return new Set();
    }
  });
  const isCollapsed = (term: TermId): boolean => collapsedTerms.has(term);
  const toggleTerm = (term: TermId) => {
    setCollapsedTerms(prev => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(collapseKey, JSON.stringify([...next]));
      } catch { /* storage unavailable — collapse still works for the session */ }
      return next;
    });
  };

  const filteredStudents = students.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Static gradebook weights for UI display
  const gradebookWeights: SPRWeights = {
    csWeight: 40,
    examWeight: 60,
    mtWeight: 40,
    ftWeight: 60,
    formulaLabel: 'Term 40% Assessments + 60% Exam • Final 40% MT + 60% FT'
  };

  // Static weights: term formula is always 40% CS + 60% Exam, final formula is always 40% MT + 60% FT
  // Prelim (if present) is class-standing-only at 100%, Midterm at 40%, Finals at 60%
  const termWeightsResult = useMemo((): TermWeightsResult => {
    const weights: Record<TermId, number> = {} as Record<TermId, number>;
    for (const term of terms) {
      if (term === 'prelim') {
        weights[term] = 100; // Prelim is class-standing-only
      } else if (term === 'midterm') {
        weights[term] = 40; // Final formula: 40% MT
      } else if (term === 'finals') {
        weights[term] = 60; // Final formula: 60% FT
      }
    }
    return { weights, defaulted: false };
  }, [terms]);

  const autoCols = useMemo(
    () => buildAutoColumns(courseId, { activities: db.activities, quizzes: db.quizzes }),
    [courseId, db.activities, db.quizzes]
  );
  // Bucket auto columns by source-item term: each activity/quiz
  // renders only in its own term block. Legacy items without a term count
  // toward midterm (flagged once in the UI below).
  const { columnsByTerm, legacyUnmappedCount } = useMemo(
    () => bucketColumnsByTerm(autoCols, { activities: db.activities, quizzes: db.quizzes }, terms),
    [autoCols, db.activities, db.quizzes, terms]
  );
  const examPerfectByTerm = useMemo((): Record<TermId, number | null> => {
    const findPerfect = (term: TermId): number | null => {
      const want = normalizeTermId(term);
      const list = (db.exams ?? []).filter(x => x.courseId === courseId && normalizeTermId(x.term) === want);
      if (list.length === 0) return 100;
      const e = list.find(x => x.published) ?? list[0];
      const pts = (e?.questions ?? []).reduce((s, q) => s + (q.points ?? 0), 0);
      return pts && pts > 0 ? pts : 100;
    };
    return { prelim: null, midterm: findPerfect('midterm'), finals: findPerfect('finals') };
  }, [courseId, db.exams]);



  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState<Record<string, boolean>>({});

  const handleSaveManualExam = async (term: TermId, studentId: string) => {
    if (!upsertManualExamGrade) return;
    const key = `${term}:${studentId}`;
    const raw = (manualDrafts[key] ?? '').trim();
    if (raw === '') return;
    const grade = Number(raw);
    const perfect = examPerfectByTerm[term] ?? 100;
    if (!Number.isFinite(grade) || grade < 0 || grade > perfect) {
      showAlert({
        title: 'Invalid exam score',
        message: `Enter a number from 0 to ${perfect}.`,
        type: 'warning',
      });
      return;
    }
    setSavingManual(prev => ({ ...prev, [key]: true }));
    try {
      await upsertManualExamGrade(courseId, term, studentId, grade);
      setManualDrafts(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch { /* context already surfaced alert */ }
    finally {
      setSavingManual(prev => ({ ...prev, [key]: false }));
    }
  };

  const getSourceTitle = (column: SPRColumn): string | null => {
    const link = column.linkedSource;
    if (!link) return null;
    if (link.kind === 'activity') {
      return (db.activities ?? []).find(a => a.id === link.sourceId)?.title ?? null;
    }
    return db.quizzes.find(q => q.id === link.sourceId)?.title ?? null;
  };


  // Helper to check if activity/quiz is included in grades
  const isIncludedInGrades = (column: SPRColumn): boolean => {
    const link = column.linkedSource;
    if (!link) return true; // Include by default if no link
    if (link.kind === 'activity') {
      return (db.activities ?? []).find(a => a.id === link.sourceId)?.includeInGrades !== false;
    }
    return db.quizzes.find(q => q.id === link.sourceId)?.includeInGrades !== false;
  };

  interface SPRRowCell {
    score: number | null;
    isManual: boolean;
    sourceTitle: string | null;
  }

  interface SPRTermResult {
    cells: SPRRowCell[];
    exam: number | null;
    grade: number | null;
  }

  interface SPRRow {
    studentId: string;
    terms: Record<TermId, SPRTermResult>;
    final: number | null;
  }

  // Helper to get category from an SPRColumn
  const getCategory = (col: SPRColumn): string => {
    const link = col.linkedSource;
    if (!link) return 'Activities';
    if (link.kind === 'quiz') return 'Quizzes';
    
    const activity = (db.activities || []).find(a => a.id === link.sourceId);
    return resolveAssessmentCategory({
      kind: link.kind,
      category: activity?.category,
      assessmentType: activity?.assessmentType,
    });
  };

  const sprRows: SPRRow[] = useMemo(() => {
    return filteredStudents.map(student => {
      const perTerm = {} as Record<TermId, SPRTermResult>;
      for (const term of terms) {
        const cols = columnsByTerm[term] ?? [];
        const cells: SPRRowCell[] = cols.map(col => {
          const fraction = autoScoreFraction({ column: col, studentId: student.id, submissions: db.submissions, activities: db.activities ?? [], quizzes: db.quizzes });
          const sourceTitle = getSourceTitle(col);
          if (fraction === null) return { score: null, isManual: false, sourceTitle };
          return { score: fraction * col.perfectScore, isManual: false, sourceTitle };
        });
        // Calculate weighted class standing percentage using category weights
        const activeCategoryWeights = course?.assessmentCategoryWeights || getStoredCategoryWeights(courseId) || DEFAULT_CATEGORY_WEIGHTS;
        const scoreItems = cells.map((cell, idx) => ({
          score: cell.score,
          perfectScore: cols[idx].perfectScore,
          category: getCategory(cols[idx]),
          includedInGrades: isIncludedInGrades(cols[idx]),
        }));
        const weightedCs = categoryWeightedClassStanding(scoreItems, activeCategoryWeights);
        
        if (term === 'prelim') {
          // Prelim is class-standing-only: no exam component.
          perTerm[term] = { cells, exam: null, grade: weightedCs === 0 ? null : round2(weightedCs) };
        } else {
          const exam = resolveExamScore(courseId, term, student.id, { exams: db.exams, submissions: db.submissions });
          const hasCSData = cells.some(c => c.score !== null && isIncludedInGrades(cols[cells.indexOf(c)]));
          perTerm[term] = { 
            cells, 
            exam: exam.score, 
            grade: termGradeStatic(weightedCs, exam.score, exam.perfect, hasCSData || exam.score !== null) 
          };
      }
      }
      const termGrades = {} as Record<TermId, number | null>;
      for (const term of terms) termGrades[term] = perTerm[term].grade;
      // Use static weights for final calculation: 40% midterm + 60% finals
      const final = finalPercentTerms(termGrades, termWeightsResult.weights);
      return { studentId: student.id, terms: perTerm, final };
    });
  }, [filteredStudents, columnsByTerm, db.exams, db.submissions, db.activities, db.quizzes, courseId, terms]);

  const sprRowById = useMemo(() => {
    const map = new Map<string, SPRRow>();
    for (const r of sprRows) map.set(r.studentId, r);
    return map;
  }, [sprRows]);

  const handleExportExcel = () => {
    if (!course) return;
    const autoConfig = { courseId, prelimColumns: columnsByTerm.prelim, midtermColumns: columnsByTerm.midterm, finalColumns: columnsByTerm.finals, mtExamPerfect: examPerfectByTerm.midterm ?? 100, ftExamPerfect: examPerfectByTerm.finals ?? 100 };
    exportSPRToExcel({
      course,
      roster: students,
      config: autoConfig,
      resolveStudent: (studentId: string) => {
        const row = sprRowById.get(studentId);
        const finalValue = row?.final ?? null;
        const prelim = row?.terms.prelim;
        const mt = row?.terms.midterm;
        const ft = row?.terms.finals;
        return {
          prelimCells: prelim?.cells.map(c => c.score) ?? columnsByTerm.prelim.map(() => null),
          prelimGrade: prelim?.grade ?? null,
          mtCells: mt?.cells.map(c => c.score) ?? columnsByTerm.midterm.map(() => null),
          mtExam: mt?.exam ?? null,
          ftCells: ft?.cells.map(c => c.score) ?? columnsByTerm.finals.map(() => null),
          ftExam: ft?.exam ?? null,
          mtGrade: mt?.grade ?? null,
          ftGrade: ft?.grade ?? null,
          finalPercent: finalValue,
          numerical: finalValue === null ? '' : getTransmutedGrade(finalValue).grade,
        };
      },
    });

    showAlert({
      title: 'Export SPR',
      message: `SPR Excel exported successfully for ${course.code}.`,
      type: 'success'
    });
  };

  // One (columns + exam + grade) group per term, plus roster + final + numerical.
  // Prelim blocks carry no exam column (class-standing-only term).
  // Collapsed terms contribute only their grade column.
  const groupWidth = (t: TermId): number =>
    isCollapsed(t) ? 1 : (columnsByTerm[t]?.length ?? 0) + (t === 'prelim' ? 1 : 2);
  const totalColumns = 1 + terms.reduce((n, t) => n + groupWidth(t), 0) + 2;
  const collapsedCount = terms.filter(t => isCollapsed(t)).length;
  const expandAll = () => {
    setCollapsedTerms(new Set());
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(collapseKey, JSON.stringify([]));
    } catch { /* ignore */ }
  };
  const collapseAll = () => {
    setCollapsedTerms(new Set(terms));
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(collapseKey, JSON.stringify(terms));
    } catch { /* ignore */ }
  };

  const exportTitle = students.length === 0
    ? 'No students enrolled to export.'
    : autoCols.length === 0
      ? 'No published activities or quizzes to export.'
      : 'Export SPR as Excel (.xlsx)';
  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* =============================================================== */}
      {/* REVISED HEADER SECTION */}
      {/* =============================================================== */}
      <div className="gradebook-page-header border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: Title and Course Info */}
          <div className="min-w-0 max-w-3xl">
            <h1 className="gradebook-title text-foreground">Course Gradebook</h1>
            <p className="gradebook-subtitle">
              {course?.code} ({course?.section}) • <span className="text-muted-foreground">Official Institutional Grading Matrix</span>
            </p>
            <div className="gradebook-formula flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Formula: {gradebookWeights.formulaLabel}</span>
            </div>
          </div>
          
          {/* Right: Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Formula Badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold shadow-xs">
              <Calculator className="w-3.5 h-3.5" />
              <span>{gradebookWeights.formulaLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setPostingPolicy(prev => (prev === 'manual' ? 'automatic' : 'manual'))}
              className="gradebook-action-btn"
            >
              {postingPolicy === 'manual' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Policy: Manual Posting</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Policy: Automatic Posting</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="gradebook-configure-assessments"
              onClick={() => navigate(`/courses/${courseId}/assessment-weights`)}
              title="Configure assessment weights"
              className="gradebook-action-btn"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Configure Assessments</span>
            </button>

            <button
              type="button"
              data-testid="spr-export-excel"
              onClick={handleExportExcel}
              disabled={students.length === 0 || autoCols.length === 0 || !course}
              title={exportTitle}
              className="gradebook-action-btn gradebook-action-btn-primary"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* =============================================================== */}
      {/* REVISED CONTROLS BAR */}
      {/* =============================================================== */}
      <div className="gradebook-controls">
        {/* Search Input */}
        <div className="gradebook-search relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student by name or student ID (e.g. 2021-SLUC)..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shadow-subtle"
          />
        </div>

        {/* Legend and Status */}
        <div className="gradebook-legend">
          {/* Term Weights */}
          {terms.map(t => (
            <span key={`legend-${t}`} className={`gradebook-term-badge gradebook-term-${t}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t === 'prelim' ? '#0ea5e9' : t === 'midterm' ? '#3b82f6' : '#10b981' }} />
              <span>{TERM_LABELS[t]}</span>
              <span className="font-normal">:{t === 'prelim' ? 100 : t === 'midterm' ? gradebookWeights.mtWeight : gradebookWeights.ftWeight}%</span>
            </span>
          ))}

          {/* Passing Grade */}
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            Passing: 75% (3.00)
          </span>

          {/* Release Status */}
          {terms.map(t => {
            const released = releaseMap[t] === true;
            return (
              <span key={`release-${t}`} className="flex items-center space-x-1">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${released ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                  {released ? 'Released' : 'Not released'}
                </span>
                <button
                  type="button"
                  data-testid={`grades-release-${t}`}
                  onClick={() => { if (!course) return; void Promise.resolve(setGradesReleased(courseId, t, !released)).catch(() => {}); }}
                  className="px-2 py-0.5 text-[11px] font-bold rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all cursor-pointer"
                >
                  {released ? 'Un-release' : 'Release'}
                </button>
              </span>
            );
          })}

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={expandAll}
              disabled={collapsedCount === 0}
              className="px-3 py-1 text-[11px] font-semibold rounded-lg border border-border text-primary hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-default"
            >
              Expand all
            </button>
            <span className="text-muted-foreground">/</span>
            <button
              type="button"
              onClick={collapseAll}
              disabled={collapsedCount === terms.length}
              className="px-3 py-1 text-[11px] font-semibold rounded-lg border border-border text-primary hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-default"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {legacyUnmappedCount > 0 ? (
        <div className="flex flex-col gap-1 text-[12px]">
          <div data-testid="grades-legacy-flag" className="text-muted-foreground">
            {legacyUnmappedCount} item{legacyUnmappedCount === 1 ? '' : 's'} without a term counted under Midterm.
          </div>
        </div>
      ) : null}

      {(isLoading || isSyncing) && autoCols.length === 0 ? (
        // Loading skeleton with new styling
        <div data-testid="spr-loading" className="gradebook-table-container" aria-hidden="true">
          <div className="overflow-x-auto">
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th className="min-w-[232px]">
                    <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                  </th>
                  {terms.map(term => (
                    <th key={`skeleton-group-${term}`} className="text-center">
                      <div className="h-4 w-24 rounded bg-muted animate-pulse mx-auto" />
                    </th>
                  ))}
                  <th className="text-center">
                    <div className="h-4 w-20 rounded bg-muted animate-pulse mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`spr-skeleton-${i}`}>
                    <td className="gradebook-student-cell">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
                          <div className="h-2.5 w-1/2 rounded bg-muted/70 animate-pulse" />
                        </div>
                      </div>
                    </td>
                    {terms.map(term => (
                      <td key={`spr-skeleton-${i}-${term}`} className="text-center">
                        <div className="h-5 w-14 rounded-full bg-muted animate-pulse mx-auto" />
                      </td>
                    ))}
                    <td className="text-center">
                      <div className="h-5 w-14 rounded-lg bg-muted animate-pulse mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : autoCols.length === 0 ? (
        // Empty state with new styling
        <div data-testid="spr-empty-state" className="gradebook-table-container p-8 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-sm font-bold text-foreground">No grade columns yet</h3>
            <p className="text-xs text-muted-foreground">
              No grade columns yet — publish an Activity or Quiz and scores will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        // Main table with revised styling
        <div className="gradebook-table-container">
          <div className="overflow-x-auto">
            <table className="gradebook-table">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[11.5px] font-semibold text-muted-foreground">
                  <th
                    rowSpan={2}
                    className="px-5 py-3 min-w-[232px] sticky left-0 bg-muted/60 z-10 text-[12.5px] text-foreground align-bottom"
                  >
                    Student roster name and ID
                  </th>
                  {terms.map(term => {
                    const termColor = term === 'prelim' ? '#0ea5e9' : term === 'midterm' ? '#3b82f6' : '#10b981';
                    const collapsed = isCollapsed(term);
                    const itemCount = columnsByTerm[term]?.length ?? 0;
                    const hiddenCount = itemCount + (term === 'prelim' ? 0 : 1);
                    const groupCount = groupWidth(term);
                    return (
                      <th
                        key={`group-${term}`}
                        colSpan={groupCount}
                        className="px-2 py-1.5 text-center border-l border-border"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTerm(term)}
                          aria-expanded={!collapsed}
                          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${TERM_LABELS[term]} columns`}
                          title={`${collapsed ? 'Expand' : 'Collapse'} ${TERM_LABELS[term]} (${hiddenCount} column${hiddenCount === 1 ? '' : 's'} hidden)`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary cursor-pointer transition-colors"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                            aria-hidden="true"
                          />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: termColor }} />
                          <span className="text-foreground font-semibold">{TERM_LABELS[term]}</span>
                          <span className="font-normal tabular-nums text-muted-foreground">({term === 'prelim' ? 100 : term === 'midterm' ? gradebookWeights.mtWeight : gradebookWeights.ftWeight}%)</span>
                          {collapsed ? (
                            <span className="font-normal text-[11px] tabular-nums text-muted-foreground">· {hiddenCount} hidden</span>
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                  <th colSpan={2} className="px-4 py-2 text-center border-l border-border">
                    <span className="text-foreground">Final result</span>
                  </th>
                </tr>
                <tr className="border-b border-border bg-muted/40 text-[11.5px] font-semibold text-muted-foreground">
                  {terms.map(term => {
                    if (isCollapsed(term)) {
                      return (
                        <th key={`${term}-collapsed-grade`} className="px-2 py-2 text-center min-w-[80px] border-l border-border">
                          <span className="text-foreground">{TERM_SHORT[term]} grade</span>
                        </th>
                      );
                    }
                    return (
                      <React.Fragment key={term}>
                        {(columnsByTerm[term] ?? []).map((col, colIdx) => (
                          <th
                            key={`${term}-${col.id}`}
                            className={`px-2 py-2 text-center min-w-[76px] animate-gradebook-cell-in ${colIdx === 0 ? 'border-l border-border' : ''}`}
                          >
                            <div className="font-semibold text-foreground truncate max-w-[96px] mx-auto" title={col.title}>
                              {col.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-normal mt-0.5 tabular-nums">
                              / {col.perfectScore}
                            </div>
                          </th>
                        ))}
                        {term === 'prelim' ? null : (
                          <th
                            className={`px-2 py-2 text-center min-w-[72px] animate-gradebook-cell-in ${(columnsByTerm[term]?.length ?? 0) === 0 ? 'border-l border-border' : ''}`}
                          >
                            <div className="font-semibold text-foreground">{TERM_SHORT[term]} exam</div>
                            <div className="text-[11px] text-muted-foreground font-normal mt-0.5 tabular-nums">
                              / {examPerfectByTerm[term] ?? 100}
                            </div>
                          </th>
                        )}
                        <th className="px-2 py-2 text-center min-w-[80px]">
                          <span className="text-foreground">{TERM_SHORT[term]} grade</span>
                        </th>
                      </React.Fragment>
                    );
                  })}
                  <th className="px-3 py-2.5 text-center min-w-[84px] border-l border-border text-foreground">
                    Final %
                  </th>
                  <th className="px-3 py-2.5 text-center min-w-[100px] text-foreground">
                    Numerical
                    <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                      1.00 - 5.00 scale
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumns} className="p-8 text-center text-muted-foreground">
                      {searchQuery ? (
                        <>No student records found matching &quot;{searchQuery}&quot;.</>
                      ) : (
                        <span className="inline-flex flex-col gap-1">
                          <span className="font-semibold text-foreground">No currently enrolled students.</span>
                          <span className="text-xs">Students will appear here once they are enrolled in this course.</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const row = sprRowById.get(student.id);
                    const transmuted = getTransmutedGrade(row?.final ?? null);
                    const finalStatus = row?.final !== null && row?.final !== undefined ? 
                      (row.final >= 75 ? 'pass' : row.final >= 60 ? 'borderline' : 'fail') : 'empty';
                    
                    return (
                      <tr key={student.id} className="hover:bg-muted/40 transition-colors">
                        {/* Student Cell */}
                        <td className="gradebook-student-cell">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={student.avatar}
                              alt={student.name}
                              className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="gradebook-student-name">{student.name}</div>
                              <div className="gradebook-student-meta">
                                {student.studentId || '2021-SLUC-0492'} · {student.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {terms.map(term => {
                          const termResult = row?.terms[term];
                          const termCols = columnsByTerm[term] ?? [];
                          const examValue = termResult?.exam;
                          const gradeValue = termResult?.grade;
                          const termColor = term === 'prelim' ? '#0ea5e9' : term === 'midterm' ? '#3b82f6' : '#10b981';
                          
                          if (isCollapsed(term)) {
                            return (
                              <td key={term} className="px-4 py-3 text-center border-l border-border">
                                {gradeValue !== null && gradeValue !== undefined ? (
                                  <span 
                                    className={`gradebook-grade-pill`}
                                    style={{
                                      color: termColor,
                                      backgroundColor: term === 'prelim' ? 'rgba(14, 165, 233, 0.12)' : term === 'midterm' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                      borderColor: term === 'prelim' ? 'rgba(14, 165, 233, 0.3)' : term === 'midterm' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                                    }}
                                  >
                                    {gradeValue}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground font-normal">—</span>
                                )}
                              </td>
                            );
                          }
                          return (
                            <React.Fragment key={term}>
                              {/* Individual activity/quiz scores */}
                              {termCols.map((col, idx) => {
                                const cell = termResult?.cells[idx];
                                const score = cell?.score ?? null;
                                const autoTitle = cell?.sourceTitle ?? null;
                                return (
                                  <td key={`${term}-${col.id}`} className={`px-3 py-3 text-center animate-gradebook-cell-in ${idx === 0 ? 'border-l border-border' : ''}`}>
                                    <div className="flex items-center justify-center space-x-1.5">
                                      <span 
                                        className={`inline-block px-2 py-1 text-center text-[13px] font-semibold tabular-nums ${
                                          score !== null ? 'text-foreground' : 'text-muted-foreground/40 font-normal'
                                        }`}
                                        title={cell?.sourceTitle ?? undefined}
                                      >
                                        {score === null ? '—' : round2(score)}
                                      </span>
                                      {autoTitle && (
                                        <span data-testid="spr-auto-dot" title={`Auto from ${autoTitle}`} className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Exam score (for non-prelim terms) */}
                              {term !== 'prelim' && (
                                <td className={`px-3 py-3 text-center animate-gradebook-cell-in ${termCols.length === 0 ? 'border-l border-border' : ''}`}>
                                  {termResult ? (
                                    <div className="flex items-center justify-center space-x-1">
                                      {upsertManualExamGrade ? (
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={manualDrafts[`${term}:${student.id}`] ?? (examValue === null || examValue === undefined ? '' : String(round2(examValue)))}
                                          placeholder="—"
                                          disabled={savingManual[`${term}:${student.id}`]}
                                          onChange={e => {
                                            let val = e.target.value.replace(/[^0-9.]/g, '');
                                            const parts = val.split('.');
                                            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                            setManualDrafts(prev => ({ ...prev, [`${term}:${student.id}`]: val }));
                                          }}
                                          onBlur={() => {
                                            const draft = manualDrafts[`${term}:${student.id}`];
                                            if (draft !== undefined && draft.trim() !== '') {
                                              void handleSaveManualExam(term, student.id);
                                            }
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              void handleSaveManualExam(term, student.id);
                                            }
                                          }}
                                          title={`Manual ${TERM_SHORT[term]} exam score (Enter to save)`}
                                          className="w-16 px-1.5 py-1 text-center text-[13px] font-semibold tabular-nums text-foreground bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                        />
                                      ) : (
                                        <span className="inline-block px-2 py-1 text-center text-[13px] font-semibold tabular-nums text-foreground">
                                          {examValue === null || examValue === undefined ? '—' : round2(examValue)}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                              )}

                              {/* Term grade */}
                              <td className={`px-3 py-3 text-center ${term === 'prelim' && termCols.length === 0 ? 'border-l border-border' : ''}`}>
                                {gradeValue !== null && gradeValue !== undefined ? (
                                  <span 
                                    className={`gradebook-grade-pill`}
                                    style={{
                                      color: termColor,
                                      backgroundColor: term === 'prelim' ? 'rgba(14, 165, 233, 0.12)' : term === 'midterm' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                      borderColor: term === 'prelim' ? 'rgba(14, 165, 233, 0.3)' : term === 'midterm' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                                    }}
                                  >
                                    {gradeValue}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground font-normal">—</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* Final Percentage */}
                        <td className="px-4 py-3 text-center border-l border-border gradebook-final-column">
                          {row?.final !== null && row?.final !== undefined ? (
                            <span 
                              className={`font-bold text-sm tabular-nums ${
                                finalStatus === 'pass' ? 'text-emerald-600 dark:text-emerald-400' :
                                finalStatus === 'fail' ? 'text-rose-600 dark:text-rose-400' :
                                'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {row.final}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 font-normal">—</span>
                          )}
                        </td>

                        {/* Numerical Grade */}
                        <td className="px-4 py-3 text-center gradebook-final-column">
                          <span className={`gradebook-numerical-badge ${
                            transmuted.remark === 'Passed' ? 'gradebook-numerical-pass' : 'gradebook-numerical-fail'
                          }`}>
                            {transmuted.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Assessment Weight Configuration Modal */}
    </div>
  );
};
