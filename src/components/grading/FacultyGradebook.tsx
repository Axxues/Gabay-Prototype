import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  FileSpreadsheet,
  Download,
  Search,
  Lock,
  Globe,
  Calculator
} from 'lucide-react';

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
  const { db, activeRole, setCourseStudentGrade, showAlert } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const students = db.users.filter(
    u => u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId))
  );

  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGradeChange = (studentId: string, type: 'midterm' | 'final', value: string) => {
    if (activeRole === 'admin') return; // Read-only audit for admin
    if (value === '') {
      setCourseStudentGrade(courseId, studentId, type, null);
      return;
    }
    const num = Number(value);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(100, num));
    setCourseStudentGrade(courseId, studentId, type, clamped);
  };

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

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-4">
        <div>
          <h2 className="heading-3 text-foreground flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <span>Course Gradebook</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course?.code} ({course?.section}) &bull; Official Institutional Grading Matrix
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Formula Badge */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold shadow-xs">
            <Calculator className="w-3.5 h-3.5" />
            <span>Total = 40% Midterm + 60% Final</span>
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
            onClick={handleExportCSV}
            className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 shadow-subtle active:scale-98 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

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

      {/* Spreadsheet Matrix Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="p-3.5 border-r border-border min-w-[220px]">
                  Student Roster Name & ID
                </th>
                <th className="p-3.5 border-r border-border text-center min-w-[150px]">
                  <div className="font-bold text-foreground flex items-center justify-center space-x-1">
                    <span>Midterm Grade</span>
                    <span className="px-1.5 py-0.2 bg-primary/10 text-primary rounded text-[10px] font-extrabold border border-primary/20">
                      40%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    Score (0 - 100)
                  </div>
                </th>
                <th className="p-3.5 border-r border-border text-center min-w-[150px]">
                  <div className="font-bold text-foreground flex items-center justify-center space-x-1">
                    <span>Final Grade</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-extrabold border border-emerald-500/20">
                      60%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    Score (0 - 100)
                  </div>
                </th>
                <th className="p-3.5 border-r border-border text-center min-w-[160px] font-bold text-primary">
                  Calculated Total
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    (40% Midterm + 60% Final)
                  </div>
                </th>
                <th className="p-3.5 text-center min-w-[120px] font-bold text-foreground">
                  Equivalent
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    1.00 - 5.00 Scale
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No student records found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const gradeRecord = db.courseGrades?.find(
                    g => g.courseId === courseId && g.studentId === student.id
                  );
                  const midtermScore = gradeRecord?.midtermGrade;
                  const finalScore = gradeRecord?.finalGrade;

                  const hasMidterm = midtermScore !== undefined && midtermScore !== null;
                  const hasFinal = finalScore !== undefined && finalScore !== null;

                  let totalPercentage: number | null = null;
                  if (hasMidterm && hasFinal) {
                    totalPercentage = Math.round((midtermScore * 0.40) + (finalScore * 0.60));
                  } else if (hasMidterm) {
                    // Partial calculation
                    totalPercentage = null;
                  }

                  const transmuted = getTransmutedGrade(totalPercentage);

                  return (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      {/* Student info */}
                      <td className="p-3.5 border-r border-border font-bold text-foreground">
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

                      {/* Midterm Grade Input (40%) */}
                      <td className="p-3 border-r border-border text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            disabled={activeRole === 'admin'}
                            value={midtermScore ?? ''}
                            onChange={e => handleGradeChange(student.id, 'midterm', e.target.value)}
                            placeholder="—"
                            className={`w-18 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                              activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-primary/30'
                            }`}
                          />
                          <span className="text-[11px] text-muted-foreground">%</span>
                        </div>
                        {hasMidterm && (
                          <div className="text-[10px] text-primary font-semibold mt-1">
                            Contrib: {(midtermScore * 0.40).toFixed(1)}%
                          </div>
                        )}
                      </td>

                      {/* Final Grade Input (60%) */}
                      <td className="p-3 border-r border-border text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            disabled={activeRole === 'admin'}
                            value={finalScore ?? ''}
                            onChange={e => handleGradeChange(student.id, 'final', e.target.value)}
                            placeholder="—"
                            className={`w-18 p-1.5 bg-background border border-border rounded-xl text-center text-xs font-bold text-foreground shadow-subtle ${
                              activeRole === 'admin' ? 'opacity-80 cursor-not-allowed bg-muted/40' : 'focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30'
                            }`}
                          />
                          <span className="text-[11px] text-muted-foreground">%</span>
                        </div>
                        {hasFinal && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                            Contrib: {(finalScore * 0.60).toFixed(1)}%
                          </div>
                        )}
                      </td>

                      {/* Calculated Total Column (40% Midterm + 60% Final) */}
                      <td className="p-3 border-r border-border text-center font-extrabold text-sm">
                        {totalPercentage !== null ? (
                          <div>
                            <span
                              className={
                                totalPercentage >= 75
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {totalPercentage}%
                            </span>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {(midtermScore! * 0.40).toFixed(1)} + {(finalScore! * 0.60).toFixed(1)}
                            </div>
                          </div>
                        ) : hasMidterm ? (
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground font-bold">
                              {(midtermScore * 0.40).toFixed(1)}%
                            </span>
                            <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                              Final Pending (60%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-normal">—</span>
                        )}
                      </td>

                      {/* Equivalent Grade (1.00 - 5.00 Scale) */}
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
    </div>
  );
};
