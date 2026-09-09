import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Sliders, RefreshCw } from 'lucide-react';

interface StudentGradebookProps {
  courseId: string;
}

export const StudentGradebook: React.FC<StudentGradebookProps> = ({ courseId }) => {
  const { db, activeUser } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const courseAssignments = db.assignments.filter(a => a.courseId === courseId);

  const [whatIfScores, setWhatIfScores] = useState<Record<string, number>>({});
  const [isWhatIfActive, setIsWhatIfActive] = useState(false);

  const handleWhatIfChange = (asgId: string, val: number) => {
    setWhatIfScores(prev => ({ ...prev, [asgId]: val }));
    setIsWhatIfActive(true);
  };

  const handleResetWhatIf = () => {
    setWhatIfScores({});
    setIsWhatIfActive(false);
  };

  let actualEarnedPoints = 0;
  let actualPossiblePoints = 0;

  let whatIfEarnedPoints = 0;
  let whatIfPossiblePoints = 0;

  courseAssignments.forEach(asg => {
    const sub = db.submissions.find(
      s => s.assignmentId === asg.id && s.studentId === activeUser.id
    );

    const actualGrade = sub?.grade;
    const simulatedGrade = whatIfScores[asg.id] !== undefined ? whatIfScores[asg.id] : actualGrade;

    if (actualGrade !== undefined) {
      actualEarnedPoints += (actualGrade / asg.pointsPossible) * asg.weight;
      actualPossiblePoints += asg.weight;
    }

    if (simulatedGrade !== undefined) {
      whatIfEarnedPoints += (simulatedGrade / asg.pointsPossible) * asg.weight;
      whatIfPossiblePoints += asg.weight;
    }
  });

  const actualPercentage = actualPossiblePoints > 0 ? Math.round((actualEarnedPoints / actualPossiblePoints) * 100) : 0;
  const whatIfPercentage = whatIfPossiblePoints > 0 ? Math.round((whatIfEarnedPoints / whatIfPossiblePoints) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Grade Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Official Grade Card */}
        <div className="p-5 bg-card border border-border rounded-xl shadow-subtle space-y-1.5">
          <div className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider">
            Official Course Grade
          </div>
          <div className="text-3xl font-extrabold font-sans text-emerald-600 dark:text-emerald-400">
            {actualPercentage}%
          </div>
          <div className="text-[11px] text-muted-foreground">
            Based on {actualPossiblePoints}% completed weight
          </div>
        </div>

        {/* What-If Simulated Grade Card */}
        <div className={`p-5 rounded-xl border transition-all space-y-1.5 ${
          isWhatIfActive
            ? 'bg-amber-500/10 border-amber-500/30 shadow-lifted'
            : 'bg-card border-border shadow-subtle'
        }`}>
          <div className="flex justify-between items-center text-xs font-sans uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <span className="font-bold">"What-If" Simulated Grade</span>
            {isWhatIfActive && (
              <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-md font-bold border border-amber-500/30">
                SIMULATED
              </span>
            )}
          </div>
          <div className="text-3xl font-extrabold font-sans text-amber-600 dark:text-amber-400">
            {whatIfPercentage}%
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isWhatIfActive ? "Adjust sliders below to test target scores" : "Click sliders below to test target scores"}
          </div>
        </div>

        {/* Reset Control Card */}
        <div className="p-5 bg-muted/40 border border-border rounded-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
            <Sliders className="w-4 h-4 text-primary" />
            <span>What-If Score Calculator</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Simulate future assignment grades to test required scores for honors or passing.
          </p>
          <button
            onClick={handleResetWhatIf}
            disabled={!isWhatIfActive}
            className="w-full py-2 text-xs font-bold bg-card border border-border hover:bg-muted text-foreground disabled:opacity-40 rounded-lg transition-all flex items-center justify-center space-x-1.5 shadow-soft active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset What-If Calculations</span>
          </button>
        </div>
      </div>

      {/* Assignment Scores Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-subtle">
        <div className="p-4 bg-muted/40 border-b border-border flex justify-between items-center text-xs">
          <span className="font-bold text-foreground uppercase tracking-wider">
            Assignment Grade Breakdown & Calculator
          </span>
          <span className="font-sans text-muted-foreground font-semibold">
            {course?.code} Gradebook
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 font-sans text-muted-foreground">
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5 text-center">Actual Score</th>
                <th className="p-3.5 text-center min-w-[220px]">What-If Score Simulator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courseAssignments.map(asg => {
                const sub = db.submissions.find(
                  s => s.assignmentId === asg.id && s.studentId === activeUser.id
                );
                const actualGrade = sub?.grade;
                const simulatedGrade = whatIfScores[asg.id] ?? actualGrade ?? 0;

                return (
                  <tr key={asg.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-bold text-foreground">
                      {asg.title}
                    </td>
                    <td className="p-3.5 font-sans text-muted-foreground">
                      {asg.category} ({asg.weight}%)
                    </td>
                    <td className="p-3.5 font-sans text-muted-foreground">
                      {new Date(asg.dueDate).toLocaleDateString()}
                    </td>

                    <td className="p-3.5 text-center font-sans font-extrabold">
                      {actualGrade !== undefined ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {actualGrade} / {asg.pointsPossible}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Unsubmitted</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <input
                          type="range"
                          min={0}
                          max={asg.pointsPossible}
                          value={simulatedGrade}
                          onChange={e => handleWhatIfChange(asg.id, Number(e.target.value))}
                          className="w-28 accent-primary cursor-pointer"
                        />
                        <input
                          type="number"
                          min={0}
                          max={asg.pointsPossible}
                          value={simulatedGrade}
                          onChange={e => handleWhatIfChange(asg.id, Number(e.target.value))}
                          className="w-14 p-1.5 bg-background border border-border rounded-lg text-center font-sans text-xs font-extrabold text-amber-600 dark:text-amber-400 shadow-soft"
                        />
                        <span className="font-sans text-muted-foreground text-[10px]">/ {asg.pointsPossible}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
