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
  extractTermWeights,
  finalPercentTerms,
  bucketColumnsByTerm,
  round2,
} from '../../utils/spr';
import type { TermId } from '../../utils/gradingTerms';
import { TERM_LABELS } from '../common/TermSelect';

interface StudentGradebookProps {
  courseId: string;
}

// Per-term breakdown descriptions (classic Midterm/Final wording preserved).
const TERM_DESC: Record<TermId, string> = {
  prelim: 'Prelim quizzes and activities class standing (no exam)',
  midterm: 'Quizzes, activities, laboratory activities and midterm exam',
  finals: 'Quizzes, projects, final practical outputs and final examination',
};

export const StudentGradebook: React.FC<StudentGradebookProps> = ({ courseId }) => {
  const { db, activeUser, markTabVisited, effectiveTermsForCourse } = useLMS();

  React.useEffect(() => {
    markTabVisited('grades', courseId);
  }, [courseId]);

  const course = db.courses.find(c => c.id === courseId);

  // Auto grade computation for the viewing student (same calc as faculty rows),
  // one block per effective term (Task 7). Guarded like Task 6 consumers so
  // mocked contexts without the provider fn still render the classic pair.
  const terms = useMemo((): TermId[] => (
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['midterm', 'finals']
  ), [courseId, course, effectiveTermsForCourse]);
  const weights = useMemo(() => resolveSPRWeights(course?.syllabus?.gradingSystem ?? null), [course]);
  const termWeightsResult = useMemo(
    () => extractTermWeights(course?.syllabus?.gradingSystem ?? null, terms),
    [course, terms]
  );
  const termWeights = termWeightsResult.weights;
  const weightsDefaulted = termWeightsResult.defaulted;
  const autoCols = useMemo(
    () => buildAutoColumns(courseId, { activities: db.activities, quizzes: db.quizzes }),
    [courseId, db.activities, db.quizzes]
  );
  const { columnsByTerm, legacyUnmappedCount } = useMemo(
    () => bucketColumnsByTerm(autoCols, { activities: db.activities, quizzes: db.quizzes }, terms),
    [autoCols, db.activities, db.quizzes, terms]
  );
  const termOfficial = useMemo(() => {
    const out = {} as Record<TermId, number | null>;
    for (const term of terms) {
      const cols = columnsByTerm[term] ?? [];
      const scores = cols.map(col => {
        const f = autoScoreFraction({ column: col, studentId: activeUser.id, submissions: db.submissions, activities: db.activities ?? [], quizzes: db.quizzes });
        return f === null ? null : f * col.perfectScore;
      });
      const cs = classStandingPercent(scores, cols.map(c => c.perfectScore));
      if (term === 'prelim') {
        // Prelim is class-standing-only: no exam component.
        out[term] = cols.length === 0 ? null : round2(cs);
      } else {
        const exam = resolveExamScore(courseId, term, activeUser.id, { exams: db.exams, submissions: db.submissions });
        out[term] = termGrade(cs, exam.score, exam.perfect, weights);
      }
    }
    return out;
  }, [terms, columnsByTerm, courseId, activeUser.id, db.submissions, db.activities, db.quizzes, db.exams, weights]);

  const hasParseError = weights.parseError === true;

  // Parse failure → official "—", never silent fallback
  const officialFor = (term: TermId): number | null =>
    hasParseError ? null : (termOfficial[term] ?? null);

  // What-If Simulation State (defaults track official values until touched)
  const [simulated, setSimulated] = useState<Partial<Record<TermId, number>>>({});
  const [isWhatIfActive, setIsWhatIfActive] = useState(false);

  const simOf = (term: TermId): number => simulated[term] ?? termOfficial[term] ?? 85;

  const handleSimChange = (term: TermId, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setSimulated(prev => ({ ...prev, [term]: clamped }));
    setIsWhatIfActive(true);
  };

  const handleResetWhatIf = () => {
    setSimulated({});
    setIsWhatIfActive(false);
  };

  // Official calculations (2-term path equals the pre-change finalPercent of
  // the same term grades with { midterm: 40, finals: 60 }, round2).
  const officialTotalPercentage: number | null = useMemo(() => {
    if (hasParseError) return null;
    const full = { prelim: null, midterm: null, finals: null } as Record<TermId, number | null>;
    for (const t of terms) full[t] = termOfficial[t] ?? null;
    return finalPercentTerms(full, termWeights);
  }, [hasParseError, terms, termOfficial, termWeights]);
  const officialTransmuted = getTransmutedGrade(officialTotalPercentage);

  const termWeightOf = (term: TermId): number => (termWeights[term] ?? 0) / 100;

  // Simulated calculations (Formula: parsed weights from syllabus)
  const simulatedTotalPercentage = Math.round(terms.reduce((s, t) => s + simOf(t) * termWeightOf(t), 0));
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
          description={`${course?.code}: ${course?.title} • Grading Policy: ${terms.map(t => `${termWeights[t] ?? 0}% ${TERM_LABELS[t]}`).join(' + ')}`}
          actions={
            <>
              {terms.map(t => (
                <span key={t} className={`px-3 py-1 rounded-xl border font-bold ${t === 'prelim' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20' : t === 'midterm' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'}`}>
                  {TERM_LABELS[t]} ({termWeights[t] ?? 0}%)
                </span>
              ))}
            </>
          }
        />

      {weightsDefaulted || legacyUnmappedCount > 0 ? (
        <div className="flex flex-col gap-1 text-[12px]">
          {weightsDefaulted ? (
            <div data-testid="grades-weights-defaulted" className="text-muted-foreground">
              Weights defaulted — equal split (the syllabus formula did not parse into term weights).
            </div>
          ) : null}
          {legacyUnmappedCount > 0 ? (
            <div data-testid="grades-legacy-flag" className="text-muted-foreground">
              {legacyUnmappedCount} item{legacyUnmappedCount === 1 ? '' : 's'} without a term counted under Midterm.
            </div>
          ) : null}
        </div>
      ) : null}

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
        <div className="p-5 bg-card border border-border rounded-2xl space-y-2">
          <div className="text-[11.5px] font-semibold text-muted-foreground">
            Official course grade
          </div>
          <div className="flex items-baseline space-x-2">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
              {officialTotalPercentage !== null ? `${officialTotalPercentage}%` : '—'}
            </div>
            {officialTotalPercentage !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${officialTransmuted.color}`}>
                {officialTransmuted.grade} ({officialTransmuted.remark})
              </span>
            )}
          </div>
          <div className="text-[12px] text-muted-foreground pt-1 border-t border-border/60">
            {(() => {
              const posted = terms
                .map(t => ({ t, g: officialFor(t) }))
                .filter((x): x is { t: TermId; g: number } => x.g !== null);
              if (posted.length === terms.length && terms.length > 0) {
                return (
                  <span>
                    {posted.map((p, i) => (
                      <React.Fragment key={p.t}>
                        {i > 0 ? ' · ' : null}
                        {TERM_LABELS[p.t]}: <strong className="text-foreground">{p.g}%</strong> ({(p.g * termWeightOf(p.t)).toFixed(1)}%)
                      </React.Fragment>
                    ))}
                  </span>
                );
              }
              if (posted.length === 1) {
                const missing = terms.filter(t => officialFor(t) === null);
                return (
                  <span>{TERM_LABELS[posted[0].t]} posted ({posted[0].g}%). {missing.map(t => TERM_LABELS[t]).join(' · ')} evaluation in progress.</span>
                );
              }
              if (posted.length > 1) {
                const missing = terms.filter(t => officialFor(t) === null);
                return (
                  <span>{posted.map(p => `${TERM_LABELS[p.t]} (${p.g}%)`).join(' · ')} posted. {missing.map(t => TERM_LABELS[t]).join(' · ')} evaluation in progress.</span>
                );
              }
              return <span>Scores are pending instructor grading submission.</span>;
            })()}
          </div>
        </div>

        {/* What-If Simulated Grade Card */}
        <div
          className={`p-5 rounded-2xl border transition-all space-y-2 ${
            isWhatIfActive
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-card border-border'
          }`}
        >
          <div className="flex justify-between items-center text-[11.5px] text-muted-foreground">
            <span className="font-semibold flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>What-if simulated grade</span>
            </span>
            {isWhatIfActive && (
              <span className="text-[11px] px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full font-medium border border-amber-500/20">
                Active
              </span>
            )}
          </div>

          <div className="flex items-baseline space-x-2">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
              {simulatedTotalPercentage}%
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${simulatedTransmuted.color}`}>
              {simulatedTransmuted.grade} ({simulatedTransmuted.remark})
            </span>
          </div>

          <div className="text-[12px] text-muted-foreground pt-1 border-t border-border/60">
            Formula: ({terms.map(t => `${simOf(t)} × ${termWeights[t] ?? 0}%`).join(') + (')}) = <strong className="text-foreground">{simulatedTotalPercentage}%</strong>
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
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex justify-between items-center">
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            Period assessment breakdown and simulator
          </span>
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {course?.code} gradebook
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11.5px] font-semibold text-muted-foreground font-sans">
                <th className="px-4 py-3">Grading period</th>
                <th className="px-4 py-3 text-center">Weight</th>
                <th className="px-4 py-3 text-center">Official score</th>
                <th className="px-4 py-3 text-center min-w-[240px]">What-if score simulator</th>
                <th className="px-4 py-3 text-center">Simulated contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {terms.map(term => {
                const w = termWeights[term] ?? 0;
                const official = officialFor(term);
                const sim = simOf(term);
                return (
                  <tr key={term} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[14px] tracking-tight text-foreground">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${term === 'prelim' ? 'bg-sky-500' : term === 'midterm' ? 'bg-primary' : 'bg-emerald-500'}`} />
                        <span>{TERM_LABELS[term]} Period Grade</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        {TERM_DESC[term]}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-semibold tabular-nums">
                        {w}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-sm">
                      {official !== null ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {official}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={sim}
                          onChange={e => handleSimChange(term, Number(e.target.value))}
                          className="w-32 accent-primary cursor-pointer"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={sim}
                          onChange={e => handleSimChange(term, Number(e.target.value))}
                          className="w-14 p-1.5 bg-background border border-border rounded-lg text-center text-xs font-semibold tabular-nums text-foreground"
                        />
                        <span className="text-muted-foreground text-[11px]">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-muted-foreground text-[12px] tabular-nums">
                      {(sim * (w / 100)).toFixed(1)}% / {w}%
                    </td>
                  </tr>
                );
              })}

              {/* Summary Row */}
              <tr className="bg-muted/40 font-semibold text-foreground">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[14px] tracking-tight">Calculated final course rating</div>
                  <div className="text-[11px] text-muted-foreground font-normal">
                    Formula: ({terms.map(t => `${TERM_LABELS[t]} × ${termWeights[t] ?? 0}%`).join(') + (')})
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-semibold tabular-nums">
                  100%
                </td>
                <td className="px-4 py-3 text-center font-semibold text-sm">
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
