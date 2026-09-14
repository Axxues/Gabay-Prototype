import React, { useMemo, useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { PageHeader } from '../common/PageHeader';
import {
  Download,
  Search,
  Lock,
  Globe,
  Calculator
} from 'lucide-react';
import {
  autoScoreFraction,
  buildAutoColumns,
  classStandingPercent,
  finalPercent,
  resolveExamScore,
  resolveSPRWeights,
  round2,
  termGrade,
} from '../../utils/spr';
import type { SPRColumn } from '../../types/lms';
import { exportSPRToExcel } from '../../utils/sprExport';

interface FacultyGradebookProps {
  courseId: string;
  onGoToSyllabus?: () => void;
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

export const FacultyGradebook: React.FC<FacultyGradebookProps> = ({ courseId, onGoToSyllabus }) => {
  const { db, showAlert } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const approvedIds = new Set(
    (db.enrollmentRequests || [])
      .filter(r => r.courseId === courseId && r.status === 'approved')
      .map(r => r.studentId)
  );
  const students = db.users.filter(
    u => u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId) || approvedIds.has(u.id))
  );

  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const weights = useMemo(
    () => resolveSPRWeights(course?.syllabus?.gradingSystem ?? null),
    [course]
  );
  const hasParseError = weights.parseError === true;

  const autoCols = useMemo(
    () => buildAutoColumns(courseId, { activities: db.activities, quizzes: db.quizzes }),
    [courseId, db.activities, db.quizzes]
  );
  const examPerfect = useMemo(() => {
    const findPerfect = (term: 'midterm' | 'final'): number => {
      const e = (db.exams ?? []).find(x => x.courseId === courseId && x.published && x.term === term);
      const pts = (e?.questions ?? []).reduce((s, q) => s + (q.points ?? 0), 0);
      return Math.max(1, pts);
    };
    return { mt: findPerfect('midterm'), ft: findPerfect('final') };
  }, [courseId, db.exams]);

  const getSourceTitle = (column: SPRColumn): string | null => {
    const link = column.linkedSource;
    if (!link) return null;
    if (link.kind === 'assignment') {
      return db.assignments.find(a => a.id === link.sourceId)?.title ?? null;
    }
    if (link.kind === 'activity') {
      return (db.activities ?? []).find(a => a.id === link.sourceId)?.title ?? null;
    }
    return db.quizzes.find(q => q.id === link.sourceId)?.title ?? null;
  };

  interface SPRRowCell {
    score: number | null;
    isManual: boolean;
    sourceTitle: string | null;
  }

  interface SPRRow {
    studentId: string;
    mtCells: SPRRowCell[];
    mtExam: number | null;
    mtGrade: number | null;
    ftCells: SPRRowCell[];
    ftExam: number | null;
    ftGrade: number | null;
    final: number | null;
  }

  const sprRows: SPRRow[] = useMemo(() => {
    return filteredStudents.map(student => {
      const mtCells: SPRRowCell[] = autoCols.map(col => {
        const fraction = autoScoreFraction({ column: col, studentId: student.id, submissions: db.submissions, assignments: db.assignments, activities: db.activities ?? [], quizzes: db.quizzes });
        const sourceTitle = getSourceTitle(col);
        if (fraction === null) return { score: null, isManual: false, sourceTitle };
        return { score: fraction * col.perfectScore, isManual: false, sourceTitle };
      });
      const mtScores = mtCells.map(c => c.score);
      const mtPerfects = autoCols.map(c => c.perfectScore);
      const mtExam = resolveExamScore(courseId, 'midterm', student.id, { exams: db.exams, submissions: db.submissions }).score;
      const mtCS = classStandingPercent(mtScores, mtPerfects);
      const mtGrade = termGrade(mtCS, mtExam, examPerfect.mt, weights);
      const ftCells: SPRRowCell[] = autoCols.map(col => {
        const fraction = autoScoreFraction({ column: col, studentId: student.id, submissions: db.submissions, assignments: db.assignments, activities: db.activities ?? [], quizzes: db.quizzes });
        const sourceTitle = getSourceTitle(col);
        if (fraction === null) return { score: null, isManual: false, sourceTitle };
        return { score: fraction * col.perfectScore, isManual: false, sourceTitle };
      });
      const ftScores = ftCells.map(c => c.score);
      const ftPerfects = autoCols.map(c => c.perfectScore);
      const ftExam = resolveExamScore(courseId, 'final', student.id, { exams: db.exams, submissions: db.submissions }).score;
      const ftCS = classStandingPercent(ftScores, ftPerfects);
      const ftGrade = termGrade(ftCS, ftExam, examPerfect.ft, weights);
      const final = finalPercent(mtGrade, ftGrade, weights);
      return { studentId: student.id, mtCells, mtExam, mtGrade, ftCells, ftExam, ftGrade, final };
    });
  }, [filteredStudents, autoCols, db.exams, db.submissions, db.assignments, db.activities, db.quizzes, weights, courseId, examPerfect]);

  const sprRowById = useMemo(() => {
    const map = new Map<string, SPRRow>();
    for (const r of sprRows) map.set(r.studentId, r);
    return map;
  }, [sprRows]);

  const handleExportExcel = () => {
    if (!course || hasParseError) return;
    const autoConfig = { courseId, midtermColumns: autoCols, finalColumns: autoCols, mtExamPerfect: examPerfect.mt, ftExamPerfect: examPerfect.ft };
    exportSPRToExcel({
      course,
      roster: students,
      config: autoConfig,
      resolveStudent: (studentId: string) => {
        const row = sprRowById.get(studentId);
        const finalValue = row?.final ?? null;
        return {
          mtCells: row?.mtCells.map(c => c.score) ?? autoCols.map(() => null),
          mtExam: row?.mtExam ?? null,
          ftCells: row?.ftCells.map(c => c.score) ?? autoCols.map(() => null),
          ftExam: row?.ftExam ?? null,
          mtGrade: row?.mtGrade ?? null,
          ftGrade: row?.ftGrade ?? null,
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

  const totalColumns = 1 + autoCols.length + 1 + 1 + autoCols.length + 1 + 1 + 1 + 1;

  const exportTitle = students.length === 0
    ? 'No students enrolled to export.'
    : hasParseError
      ? 'Fix the syllabus grading formula before exporting.'
      : autoCols.length === 0
        ? 'No published activities or quizzes to export.'
        : 'Export SPR as Excel (.xlsx)';

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header Controls */}
      <PageHeader
        title="Course Gradebook"
        description={`${course?.code} (${course?.section}) • Official Institutional Grading Matrix`}
        actions={
          <>
            {/* Formula Badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold shadow-xs">
              <Calculator className="w-3.5 h-3.5" />
              <span>{weights.formulaLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setPostingPolicy(prev => (prev === 'manual' ? 'automatic' : 'manual'))}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-bold flex items-center space-x-2 transition-all bg-card text-foreground hover:bg-muted shadow-subtle active:scale-98 cursor-pointer"
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
              data-testid="spr-export-excel"
              onClick={handleExportExcel}
              disabled={students.length === 0 || autoCols.length === 0 || !course || hasParseError}
              title={exportTitle}
              className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 shadow-subtle active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </>
        }
      />

      {/* Search Input & Legend Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student by name or student ID (e.g. 2021-SLUC)..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shadow-subtle"
          />
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-muted-foreground">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Midterm: <strong className="text-foreground">{weights.mtWeight}%</strong></span>
          </span>
          <span>&bull;</span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Final: <strong className="text-foreground">{weights.ftWeight}%</strong></span>
          </span>
          <span>&bull;</span>
          <span>Passing: <strong className="text-emerald-600 dark:text-emerald-400">75% (3.00)</strong></span>
        </div>
      </div>

      {hasParseError ? (
        <div data-testid="grades-formula-error" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center shadow-subtle">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-sm font-bold text-foreground">Grading formula needs attention</h3>
            <p className="text-xs text-muted-foreground">
              Grading formula needs attention — the syllabus section &apos;Course Requirements &amp; Official Grading Formula&apos; could not be parsed. Fix it in the Syllabus tab to enable grades.
            </p>
            {onGoToSyllabus ? (
              <button
                type="button"
                onClick={() => onGoToSyllabus()}
                className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-subtle active:scale-98 cursor-pointer"
              >
                Go to Syllabus
              </button>
            ) : null}
          </div>
        </div>
      ) : autoCols.length === 0 ? (
        <div data-testid="spr-empty-state" className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-sm font-bold text-foreground">No grade columns yet</h3>
            <p className="text-xs text-muted-foreground">
              No grade columns yet — publish an Activity or Quiz and scores will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                  <th className="p-3.5 border-r border-border min-w-[220px] sticky left-0 bg-muted/40 z-10">
                    Student Roster Name & ID
                  </th>
                  {autoCols.map(col => (
                    <th key={col.id} className="p-3 border-r border-border text-center min-w-[110px]">
                      <div className="font-bold text-foreground truncate max-w-[140px] mx-auto" title={col.title}>
                        {col.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                        / {col.perfectScore}
                      </div>
                    </th>
                  ))}
                  <th className="p-3 border-r border-border text-center min-w-[110px]">
                    <div className="font-bold text-foreground">MT Exam</div>
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                      / {examPerfect.mt}
                    </div>
                  </th>
                  <th className="p-3 border-r border-border text-center min-w-[100px] font-bold text-primary">
                    MT Grade
                  </th>
                  {autoCols.map(col => (
                    <th key={col.id} className="p-3 border-r border-border text-center min-w-[110px]">
                      <div className="font-bold text-foreground truncate max-w-[140px] mx-auto" title={col.title}>
                        {col.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                        / {col.perfectScore}
                      </div>
                    </th>
                  ))}
                  <th className="p-3 border-r border-border text-center min-w-[110px]">
                    <div className="font-bold text-foreground">FT Exam</div>
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                      / {examPerfect.ft}
                    </div>
                  </th>
                  <th className="p-3 border-r border-border text-center min-w-[100px] font-bold text-emerald-700 dark:text-emerald-400">
                    FT Grade
                  </th>
                  <th className="p-3 border-r border-border text-center min-w-[100px] font-bold text-primary">
                    Final %
                  </th>
                  <th className="p-3 text-center min-w-[110px] font-bold text-foreground">
                    Numerical
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                      1.00 - 5.00 Scale
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumns} className="p-8 text-center text-muted-foreground">
                      No student records found matching &quot;{searchQuery}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const row = sprRowById.get(student.id);
                    const transmuted = getTransmutedGrade(row?.final ?? null);
                    return (
                      <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 border-r border-border font-bold text-foreground sticky left-0 bg-card z-10">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={student.avatar}
                              alt={student.name}
                              className="w-7 h-7 rounded-full object-cover border border-border shadow-soft shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="truncate">{student.name}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">
                                {student.studentId || '2021-SLUC-0492'} &bull; {student.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {autoCols.map((col, idx) => {
                          const cell = row?.mtCells[idx];
                          const score = cell?.score ?? null;
                          const autoTitle = cell?.sourceTitle ?? null;
                          return (
                            <td key={col.id} className="p-2 border-r border-border text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <span className="inline-block min-w-20 px-2 py-1 text-center text-xs font-bold text-foreground" title={cell?.sourceTitle ?? undefined}>{score === null ? '—' : round2(score)}</span>
                                {!autoTitle ? null : (
                                  <span data-testid="spr-auto-dot" title={`Auto from ${autoTitle}`} className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-border text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <span className="inline-block min-w-20 px-2 py-1 text-center text-xs font-bold text-foreground">{row?.mtExam === null || row?.mtExam === undefined ? '—' : round2(row.mtExam)}</span>
                          </div>
                        </td>

                        <td className="p-3 border-r border-border text-center">
                          {row?.mtGrade !== null && row?.mtGrade !== undefined ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border text-primary bg-primary/10 border-primary/20">
                              {row.mtGrade}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </td>

                        {autoCols.map((col, idx) => {
                          const cell = row?.ftCells[idx];
                          const score = cell?.score ?? null;
                          const autoTitle = cell?.sourceTitle ?? null;
                          return (
                            <td key={col.id} className="p-2 border-r border-border text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <span className="inline-block min-w-20 px-2 py-1 text-center text-xs font-bold text-foreground" title={cell?.sourceTitle ?? undefined}>{score === null ? '—' : round2(score)}</span>
                                {!autoTitle ? null : (
                                  <span data-testid="spr-auto-dot" title={`Auto from ${autoTitle}`} className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-border text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <span className="inline-block min-w-20 px-2 py-1 text-center text-xs font-bold text-foreground">{row?.ftExam === null || row?.ftExam === undefined ? '—' : round2(row.ftExam)}</span>
                          </div>
                        </td>

                        <td className="p-3 border-r border-border text-center">
                          {row?.ftGrade !== null && row?.ftGrade !== undefined ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                              {row.ftGrade}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </td>

                        <td className="p-3 border-r border-border text-center font-extrabold text-sm">
                          {row?.final !== null && row?.final !== undefined ? (
                            <span
                              className={
                                row.final >= 75
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {row.final}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border ${transmuted.color}`}
                          >
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
    </div>
  );
};
