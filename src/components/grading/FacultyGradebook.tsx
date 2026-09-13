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
  classStandingPercent,
  finalPercent,
  resolveSPRWeights,
  termGrade,
} from '../../utils/spr';
import type { SPRColumn } from '../../types/lms';
import { SPRConfigModal } from './SPRConfigModal';

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

export const FacultyGradebook: React.FC<FacultyGradebookProps> = ({ courseId }) => {
  const { db, activeRole, showAlert, getSPRConfig, setSPRCell, resetSPRCell } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const students = db.users.filter(
    u => u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId))
  );

  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const filteredStudents = students.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Email', 'Midterm Grade (40%)', 'Final Grade (60%)', 'Calculated Total (%)', 'Equivalent Grade', 'Remarks'];
    const rows = filteredStudents.map(student => {
      const gradeRecord = db.courseGrades?.find(
        g => g.courseId === courseId && g.studentId === student.id
      );
      const m = gradeRecord?.midtermGrade;
      const f = gradeRecord?.finalGrade;

      let totalStr = 'N/A';
      let eqGrade = '—';
      let remark = 'Pending';

      if (m !== undefined && m !== null && f !== undefined && f !== null) {
        const total = Math.round((m * 0.40) + (f * 0.60));
        totalStr = `${total}%`;
        const trans = getTransmutedGrade(total);
        eqGrade = trans.grade;
        remark = trans.remark;
      } else if (m !== undefined && m !== null) {
        totalStr = `${Math.round(m * 0.40)}% (Midterm only)`;
      }

      return [
        `"${student.studentId || ''}"`,
        `"${student.name}"`,
        `"${student.email}"`,
        m !== undefined && m !== null ? m : '',
        f !== undefined && f !== null ? f : '',
        `"${totalStr}"`,
        `"${eqGrade}"`,
        `"${remark}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${course?.code || 'COURSE'}_Midterm_Final_Gradebook.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAlert({
      title: 'Export Gradebook',
      message: `Gradebook CSV exported successfully for ${course?.code || 'course'}.`,
      type: 'success'
    });
  };

  const sprConfig = getSPRConfig(courseId);

  const weights = useMemo(
    () => resolveSPRWeights(course?.syllabus?.gradingSystem ?? null),
    [course]
  );

  const mtColumns: SPRColumn[] = sprConfig?.midtermColumns ?? [];
  const ftColumns: SPRColumn[] = sprConfig?.finalColumns ?? [];
  const mtExamPerfect = sprConfig?.mtExamPerfect ?? 100;
  const ftExamPerfect = sprConfig?.ftExamPerfect ?? 100;
  const isEmptySPR = !sprConfig || (mtColumns.length === 0 && ftColumns.length === 0);

  const onConfigure = () => {
    setIsConfigOpen(true);
  };

  const onCellChange = async (studentId: string, term: 'midterm' | 'final', key: string, raw: string, perfect: number) => {
    if (raw === '') {
      await setSPRCell(courseId, studentId, term, key, null);
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    if (num < 0 || num > perfect) {
      showAlert({ title: 'Score out of range', message: `Enter 0–${perfect}.`, type: 'warning' });
      return;
    }
    await setSPRCell(courseId, studentId, term, key, num);
  };

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
    if (!sprConfig) return [];
    return filteredStudents.map(student => {
      const cells = db.sprScores?.[courseId]?.[student.id];
      const manualMid = cells?.midterm ?? {};
      const manualFinal = cells?.final ?? {};
      const mtExam = cells?.mtExam ?? null;
      const ftExam = cells?.ftExam ?? null;

      const mtScores: Array<number | null> = [];
      const mtPerfects: number[] = [];
      const mtCells: SPRRowCell[] = mtColumns.map(col => {
        const manualValue = manualMid[col.id];
        if (typeof manualValue === 'number') {
          mtScores.push(manualValue);
          mtPerfects.push(col.perfectScore);
          return { score: manualValue, isManual: true, sourceTitle: null };
        }
        const fraction = autoScoreFraction({
          column: col,
          studentId: student.id,
          submissions: db.submissions,
          assignments: db.assignments,
          activities: db.activities ?? [],
          quizzes: db.quizzes,
        });
        const sourceTitle = getSourceTitle(col);
        if (fraction === null) {
          mtScores.push(null);
          mtPerfects.push(col.perfectScore);
          return { score: null, isManual: false, sourceTitle };
        }
        const score = fraction * col.perfectScore;
        mtScores.push(score);
        mtPerfects.push(col.perfectScore);
        return { score, isManual: false, sourceTitle };
      });

      const ftScores: Array<number | null> = [];
      const ftPerfects: number[] = [];
      const ftCells: SPRRowCell[] = ftColumns.map(col => {
        const manualValue = manualFinal[col.id];
        if (typeof manualValue === 'number') {
          ftScores.push(manualValue);
          ftPerfects.push(col.perfectScore);
          return { score: manualValue, isManual: true, sourceTitle: null };
        }
        const fraction = autoScoreFraction({
          column: col,
          studentId: student.id,
          submissions: db.submissions,
          assignments: db.assignments,
          activities: db.activities ?? [],
          quizzes: db.quizzes,
        });
        const sourceTitle = getSourceTitle(col);
        if (fraction === null) {
          ftScores.push(null);
          ftPerfects.push(col.perfectScore);
          return { score: null, isManual: false, sourceTitle };
        }
        const score = fraction * col.perfectScore;
        ftScores.push(score);
        ftPerfects.push(col.perfectScore);
        return { score, isManual: false, sourceTitle };
      });

      const mtCS = classStandingPercent(mtScores, mtPerfects);
      const ftCS = classStandingPercent(ftScores, ftPerfects);
      const mtGrade = termGrade(mtCS, mtExam, mtExamPerfect, weights);
      const ftGrade = termGrade(ftCS, ftExam, ftExamPerfect, weights);
      const final = finalPercent(mtGrade, ftGrade, weights);

      return {
        studentId: student.id,
        mtCells,
        mtExam,
        mtGrade,
        ftCells,
        ftExam,
        ftGrade,
        final,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStudents, sprConfig, db.sprScores, db.submissions, db.assignments, db.activities, db.quizzes, weights, courseId, mtColumns, ftColumns, mtExamPerfect, ftExamPerfect]);

  const sprRowById = useMemo(() => {
    const map = new Map<string, SPRRow>();
    for (const r of sprRows) map.set(r.studentId, r);
    return map;
  }, [sprRows]);

  const totalColumns = 1 + mtColumns.length + 1 + 1 + ftColumns.length + 1 + 1 + 1 + 1;

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
              data-testid="spr-configure"
              onClick={onConfigure}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-bold flex items-center space-x-2 transition-all bg-card text-foreground hover:bg-muted shadow-subtle active:scale-98 cursor-pointer"
            >
              <span>Configure</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 shadow-subtle active:scale-98 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
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
            <span>Midterm: <strong className="text-foreground">40%</strong></span>
          </span>
          <span>&bull;</span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Final: <strong className="text-foreground">60%</strong></span>
          </span>
          <span>&bull;</span>
          <span>Passing: <strong className="text-emerald-600 dark:text-emerald-400">75% (3.00)</strong></span>
        </div>
      </div>

      {isEmptySPR ? (
        <div data-testid="spr-empty-state" className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-sm font-bold text-foreground">Student Performance Record not set up yet</h3>
            <p className="text-xs text-muted-foreground">
              Define midterm and final columns to auto-fill scores from activities, quizzes, and assignments.
              Blank cells count as 0 in computation. Term grades use 60% class standing + 40% exam, and the
              final grade uses 40% midterm + 60% final term.
            </p>
            <button
              type="button"
              onClick={onConfigure}
              className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-subtle active:scale-98 cursor-pointer"
            >
              Configure SPR
            </button>
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
                  {mtColumns.map(col => (
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
                      / {mtExamPerfect}
                    </div>
                  </th>
                  <th className="p-3 border-r border-border text-center min-w-[100px] font-bold text-primary">
                    MT Grade
                  </th>
                  {ftColumns.map(col => (
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
                      / {ftExamPerfect}
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

                        {mtColumns.map((col, idx) => {
                          const cell = row?.mtCells[idx];
                          const score = cell?.score ?? null;
                          const isManual = cell?.isManual ?? false;
                          const isBlank = score === null;
                          const autoTitle = cell?.sourceTitle ?? null;
                          return (
                            <td key={col.id} className="p-2 border-r border-border text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={col.perfectScore}
                                  step={0.25}
                                  disabled={activeRole === 'admin'}
                                  value={score ?? ''}
                                  onChange={e => onCellChange(student.id, 'midterm', col.id, e.target.value, col.perfectScore)}
                                  title={!isManual && autoTitle ? `Auto from ${autoTitle}` : undefined}
                                  placeholder="—"
                                  className={`w-20 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                                    activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-primary/30'
                                  } ${isBlank ? 'ring-1 ring-amber-500/60 placeholder:text-amber-600' : ''}`}
                                />
                                {!isManual && autoTitle && !isBlank ? (
                                  <span data-testid="spr-auto-dot" title={`Auto from ${autoTitle}`} className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                ) : null}
                                {isManual ? (
                                  <button
                                    type="button"
                                    data-testid="spr-reset-cell"
                                    title="Reset to auto"
                                    disabled={activeRole === 'admin'}
                                    onClick={() => {
                                      void resetSPRCell(courseId, student.id, 'midterm', col.id);
                                    }}
                                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    ↺
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-border text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <input
                              type="number"
                              min={0}
                              max={mtExamPerfect}
                              step={0.25}
                              disabled={activeRole === 'admin'}
                              value={row?.mtExam ?? ''}
                              onChange={e => onCellChange(student.id, 'midterm', '__mtExam', e.target.value, mtExamPerfect)}
                              placeholder="—"
                              className={`w-20 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                                activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-primary/30'
                              } ${(row?.mtExam ?? null) === null ? 'ring-1 ring-amber-500/60 placeholder:text-amber-600' : ''}`}
                            />
                            {(row?.mtExam ?? null) !== null ? (
                              <button
                                type="button"
                                data-testid="spr-reset-cell"
                                title="Reset to auto"
                                disabled={activeRole === 'admin'}
                                onClick={() => {
                                  void resetSPRCell(courseId, student.id, 'midterm', '__mtExam');
                                }}
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ↺
                              </button>
                            ) : null}
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

                        {ftColumns.map((col, idx) => {
                          const cell = row?.ftCells[idx];
                          const score = cell?.score ?? null;
                          const isManual = cell?.isManual ?? false;
                          const isBlank = score === null;
                          const autoTitle = cell?.sourceTitle ?? null;
                          return (
                            <td key={col.id} className="p-2 border-r border-border text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={col.perfectScore}
                                  step={0.25}
                                  disabled={activeRole === 'admin'}
                                  value={score ?? ''}
                                  onChange={e => onCellChange(student.id, 'final', col.id, e.target.value, col.perfectScore)}
                                  title={!isManual && autoTitle ? `Auto from ${autoTitle}` : undefined}
                                  placeholder="—"
                                  className={`w-20 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                                    activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30'
                                  } ${isBlank ? 'ring-1 ring-amber-500/60 placeholder:text-amber-600' : ''}`}
                                />
                                {!isManual && autoTitle && !isBlank ? (
                                  <span data-testid="spr-auto-dot" title={`Auto from ${autoTitle}`} className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                ) : null}
                                {isManual ? (
                                  <button
                                    type="button"
                                    data-testid="spr-reset-cell"
                                    title="Reset to auto"
                                    disabled={activeRole === 'admin'}
                                    onClick={() => {
                                      void resetSPRCell(courseId, student.id, 'final', col.id);
                                    }}
                                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    ↺
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-border text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <input
                              type="number"
                              min={0}
                              max={ftExamPerfect}
                              step={0.25}
                              disabled={activeRole === 'admin'}
                              value={row?.ftExam ?? ''}
                              onChange={e => onCellChange(student.id, 'final', '__ftExam', e.target.value, ftExamPerfect)}
                              placeholder="—"
                              className={`w-20 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                                activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30'
                              } ${(row?.ftExam ?? null) === null ? 'ring-1 ring-amber-500/60 placeholder:text-amber-600' : ''}`}
                            />
                            {(row?.ftExam ?? null) !== null ? (
                              <button
                                type="button"
                                data-testid="spr-reset-cell"
                                title="Reset to auto"
                                disabled={activeRole === 'admin'}
                                onClick={() => {
                                  void resetSPRCell(courseId, student.id, 'final', '__ftExam');
                                }}
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ↺
                              </button>
                            ) : null}
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
      {isConfigOpen ? <SPRConfigModal courseId={courseId} onClose={() => setIsConfigOpen(false)} /> : null}
    </div>
  );
};
