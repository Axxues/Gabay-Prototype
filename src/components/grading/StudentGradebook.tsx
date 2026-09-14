import React, { useMemo, useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Sliders, RefreshCw } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { getTransmutedGrade } from './FacultyGradebook';
import {
  buildAutoColumns,
  resolveSPRWeights,
  resolveExamScore,
  autoScoreFraction,
  classStandingPercent,
  termGrade,
  finalPercent,
} from '../../utils/spr';

interface StudentGradebookProps {
  courseId: string;
}

export const StudentGradebook: React.FC<StudentGradebookProps> = ({ courseId }) => {
  const { db, activeUser, markTabVisited } = useLMS();

  React.useEffect(() => {
    markTabVisited('grades', courseId);
  }, [courseId]);

  const course = db.courses.find(c => c.id === courseId);

  // Auto grade computation for the viewing student (same calc as faculty Task 4 row)
  const weights = useMemo(() => resolveSPRWeights(course?.syllabus?.gradingSystem ?? null), [course]);
  const autoCols = useMemo(
    () => buildAutoColumns(courseId, { activities: db.activities, quizzes: db.quizzes }),
    [courseId, db.activities, db.quizzes]
  );
  const auto = useMemo(() => {
    const scores = autoCols.map(col => {
      const f = autoScoreFraction({ column: col, studentId: activeUser.id, submissions: db.submissions, assignments: db.assignments, activities: db.activities ?? [], quizzes: db.quizzes });
      return f === null ? null : f * col.perfectScore;
    });
    const perfects = autoCols.map(c => c.perfectScore);
    const cs = classStandingPercent(scores, perfects);
    const mtExam = resolveExamScore(courseId, 'midterm', activeUser.id, { exams: db.exams, submissions: db.submissions });
    const ftExam = resolveExamScore(courseId, 'final', activeUser.id, { exams: db.exams, submissions: db.submissions });
    const mt = termGrade(cs, mtExam.score, mtExam.perfect, weights);
    const ft = termGrade(cs, ftExam.score, ftExam.perfect, weights);
    return { mt, ft, final: finalPercent(mt, ft, weights) };
  }, [autoCols, weights, courseId, activeUser.id, db.submissions, db.assignments, db.activities, db.quizzes, db.exams]);

  const hasParseError = weights.parseError === true;

  // Parse failure → official "—", never silent fallback
  const officialMidterm = hasParseError ? null : auto.mt;
  const officialFinal = hasParseError ? null : auto.ft;

  // What-If Simulation State (defaults from auto values)
  const [simulatedMidterm, setSimulatedMidterm] = useState<number>(() => auto.mt ?? 85);
  const [simulatedFinal, setSimulatedFinal] = useState<number>(() => auto.ft ?? 85);
  const [isWhatIfActive, setIsWhatIfActive] = useState(false);

  const handleMidtermWhatIfChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setSimulatedMidterm(clamped);
    setIsWhatIfActive(true);
  };

  const handleFinalWhatIfChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setSimulatedFinal(clamped);
    setIsWhatIfActive(true);
  };

  const handleResetWhatIf = () => {
    setSimulatedMidterm(auto.mt ?? 85);
    setSimulatedFinal(auto.ft ?? 85);
    setIsWhatIfActive(false);
  };

  // Official calculations
  const hasOfficialMidterm = officialMidterm !== null && officialMidterm !== undefined;
  const hasOfficialFinal = officialFinal !== null && officialFinal !== undefined;

  let officialTotalPercentage: number | null = null;
  if (hasParseError) {
    officialTotalPercentage = null;
  } else {
    officialTotalPercentage = auto.final;
  }
  const officialTransmuted = getTransmutedGrade(officialTotalPercentage);

  const mtW = weights.mtWeight / 100;
  const ftW = weights.ftWeight / 100;

  // Simulated calculations (Formula: parsed weights from syllabus)
  const simulatedTotalPercentage = Math.round((simulatedMidterm * mtW) + (simulatedFinal * ftW));
  const simulatedTransmuted = getTransmutedGrade(simulatedTotalPercentage);

  // No syllabus → gated empty state (same student copy as CoursesPage gate)
  if (!course?.syllabus) {
    return (
      <div className="space-y-6 max-w-5xl animate-fade-in font-sans">
        <PageHeader
          title="Academic Performance & Grade Calculator"
          description={`${course?.code}: ${course?.title} • Grading Policy: ${weights.mtWeight}% Midterm + ${weights.ftWeight}% Final`}
          actions={
            <>
              <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold">
                Midterm ({weights.mtWeight}%)
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                Final ({weights.ftWeight}%)
              </span>
            </>
          }
        />
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-subtle" data-testid="grades-syllabus-gate">
          <h3 className="text-sm font-bold text-foreground">Syllabus required for grades</h3>
          <p className="text-xs text-muted-foreground mt-1">The grading formula lives in the syllabus under Course Requirements &amp; Official Grading Formula. Waiting for your instructor to upload the syllabus.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in font-sans">
      {/* Header Banner */}
      <PageHeader
        title="Academic Performance & Grade Calculator"
        description={`${course?.code}: ${course?.title} • Grading Policy: ${weights.mtWeight}% Midterm + ${weights.ftWeight}% Final`}
        actions={
          <>
            <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold">
              Midterm ({weights.mtWeight}%)
            </span>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
              Final ({weights.ftWeight}%)
            </span>
          </>
        }
      />

      {hasParseError ? (
        <div data-testid="grades-formula-error" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center shadow-subtle">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-sm font-bold text-foreground">Grading formula needs attention</h3>
            <p className="text-xs text-muted-foreground">
              The grading formula could not be parsed. Ask your instructor to fix the Course Requirements &amp; Official Grading Formula section in Syllabus.
            </p>
          </div>
        </div>
      ) : null}

      {/* Grade Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Official Grade Card */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Official Course Grade
          </div>
          <div className="flex items-baseline space-x-2">
            <div className="text-3xl font-black text-foreground">
              {officialTotalPercentage !== null ? `${officialTotalPercentage}%` : '—'}
            </div>
            {officialTotalPercentage !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${officialTransmuted.color}`}>
                {officialTransmuted.grade} ({officialTransmuted.remark})
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            {hasOfficialMidterm && hasOfficialFinal ? (
              <span>
                Midterm: <strong className="text-foreground">{officialMidterm}%</strong> ({(officialMidterm * mtW).toFixed(1)}%) &bull; Final: <strong className="text-foreground">{officialFinal}%</strong> ({(officialFinal * ftW).toFixed(1)}%)
              </span>
            ) : hasOfficialMidterm ? (
              <span>Midterm posted ({officialMidterm}%). Final evaluation in progress.</span>
            ) : (
              <span>Scores are pending instructor grading submission.</span>
            )}
          </div>
        </div>

        {/* What-If Simulated Grade Card */}
        <div
          className={`p-5 rounded-2xl border transition-all space-y-2 ${
            isWhatIfActive
              ? 'bg-amber-500/10 border-amber-500/30 shadow-lifted ring-1 ring-amber-500/20'
              : 'bg-card border-border shadow-subtle'
          }`}
        >
          <div className="flex justify-between items-center text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <span className="font-bold flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>"What-If" Simulated Grade</span>
            </span>
            {isWhatIfActive && (
              <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-md font-bold border border-amber-500/30">
                ACTIVE
              </span>
            )}
          </div>

          <div className="flex items-baseline space-x-2">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {simulatedTotalPercentage}%
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${simulatedTransmuted.color}`}>
              {simulatedTransmuted.grade} ({simulatedTransmuted.remark})
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            Formula: ({simulatedMidterm} &times; {weights.mtWeight}%) + ({simulatedFinal} &times; {weights.ftWeight}%) = <strong className="text-foreground">{simulatedTotalPercentage}%</strong>
          </div>
        </div>

        {/* Reset / Simulator Control Card */}
        <div className="p-5 bg-muted/40 border border-border rounded-2xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Target Score Simulator</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              Test target scores to determine the final exam score required for honors or passing (75%).
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetWhatIf}
            disabled={!isWhatIfActive}
            className="w-full py-2 text-xs font-bold bg-card border border-border hover:bg-muted text-foreground disabled:opacity-40 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-subtle active:scale-98 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset What-If Calculations</span>
          </button>
        </div>
      </div>

      {/* Midterm & Final Breakdown & Simulator Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-subtle">
        <div className="p-4 bg-muted/40 border-b border-border flex justify-between items-center text-xs">
          <span className="font-bold text-foreground uppercase tracking-wider">
            Period Assessment Breakdown & Simulator
          </span>
          <span className="text-muted-foreground font-semibold">
            {course?.code} Gradebook
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-sans">
                <th className="p-3.5">Grading Period</th>
                <th className="p-3.5 text-center">Weight</th>
                <th className="p-3.5 text-center">Official Score</th>
                <th className="p-3.5 text-center min-w-[240px]">"What-If" Score Simulator</th>
                <th className="p-3.5 text-center">Simulated Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Row 1: Midterm Period */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-3.5 font-bold text-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span>Midterm Period Grade</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal ml-4.5">
                    Quizzes, assignments, laboratory activities & midterm exam
                  </div>
                </td>
                <td className="p-3.5 text-center">
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold">
                    {weights.mtWeight}%
                  </span>
                </td>
                <td className="p-3.5 text-center font-extrabold text-sm">
                  {officialMidterm !== null ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {officialMidterm}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">Pending</span>
                  )}
                </td>
                <td className="p-3.5 text-center">
                  <div className="flex items-center justify-center space-x-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simulatedMidterm}
                      onChange={e => handleMidtermWhatIfChange(Number(e.target.value))}
                      className="w-32 accent-primary cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={simulatedMidterm}
                      onChange={e => handleMidtermWhatIfChange(Number(e.target.value))}
                      className="w-14 p-1.5 bg-background border border-border rounded-lg text-center text-xs font-bold text-amber-600 dark:text-amber-400 shadow-soft"
                    />
                    <span className="text-muted-foreground text-[10px]">%</span>
                  </div>
                </td>
                <td className="p-3.5 text-center font-bold text-primary text-xs">
                  {(simulatedMidterm * mtW).toFixed(1)}% / {weights.mtWeight}%
                </td>
              </tr>

              {/* Row 2: Final Period */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-3.5 font-bold text-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Final Period Grade</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal ml-4.5">
                    Quizzes, projects, final practical outputs & final examination
                  </div>
                </td>
                <td className="p-3.5 text-center">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    {weights.ftWeight}%
                  </span>
                </td>
                <td className="p-3.5 text-center font-extrabold text-sm">
                  {officialFinal !== null ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {officialFinal}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">Pending</span>
                  )}
                </td>
                <td className="p-3.5 text-center">
                  <div className="flex items-center justify-center space-x-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simulatedFinal}
                      onChange={e => handleFinalWhatIfChange(Number(e.target.value))}
                      className="w-32 accent-emerald-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={simulatedFinal}
                      onChange={e => handleFinalWhatIfChange(Number(e.target.value))}
                      className="w-14 p-1.5 bg-background border border-border rounded-lg text-center text-xs font-bold text-amber-600 dark:text-amber-400 shadow-soft"
                    />
                    <span className="text-muted-foreground text-[10px]">%</span>
                  </div>
                </td>
                <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {(simulatedFinal * ftW).toFixed(1)}% / {weights.ftWeight}%
                </td>
              </tr>

              {/* Summary Row */}
              <tr className="bg-muted/40 font-bold text-foreground">
                <td className="p-3.5">
                  <div className="font-extrabold text-sm">Calculated Final Course Rating</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Formula: (Midterm &times; {weights.mtWeight}%) + (Final &times; {weights.ftWeight}%)
                  </div>
                </td>
                <td className="p-3.5 text-center font-black">
                  100%
                </td>
                <td className="p-3.5 text-center font-black text-sm">
                  {officialTotalPercentage !== null ? (
                    <span className={officialTotalPercentage >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {officialTotalPercentage}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">—</span>
                  )}
                </td>
                <td className="p-3.5 text-center">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    What-If Simulated Total: {simulatedTotalPercentage}%
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border ${simulatedTransmuted.color}`}>
                    {simulatedTransmuted.grade} &bull; {simulatedTransmuted.remark}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
