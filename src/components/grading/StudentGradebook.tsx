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

  // What-If score simulation state: map of assignmentId -> simulatedScore
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

  // Calculate actual vs what-if course percentage
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
    <div className="space-y-6 max-w-5xl">
      {/* Grade Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Actual Total */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-1">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
            Official Course Grade
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {actualPercentage}%
          </div>
          <div className="text-[11px] text-zinc-400">
            Based on {actualPossiblePoints}% completed weight
          </div>
        </div>

        {/* What-If Simulated Total */}
        <div className={`p-5 rounded-lg border transition-all space-y-1 ${
          isWhatIfActive
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 shadow-sm'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <span className="font-bold">"What-If" Simulated Grade</span>
            {isWhatIfActive && <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 dark:bg-amber-900 rounded font-bold">SIMULATED</span>}
          </div>
          <div className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-400">
            {whatIfPercentage}%
          </div>
          <div className="text-[11px] text-zinc-500">
            {isWhatIfActive ? "Adjust sliders below to test target scores" : "Click assignment score to test What-If score"}
          </div>
        </div>

        {/* Reset Button Widget */}
        <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
            <Sliders className="w-4 h-4 text-red-700 dark:text-red-400" />
            <span>What-If Score Calculator</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Simulate future assignment grades to test required scores for honors or passing.
          </p>
          <button
            onClick={handleResetWhatIf}
            disabled={!isWhatIfActive}
            className="w-full py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-900 text-white disabled:opacity-40 rounded transition-colors flex items-center justify-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset What-If Calculations</span>
          </button>
        </div>
      </div>

      {/* Assignment Scores Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs">
          <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Assignment Grade Breakdown & Calculator
          </span>
          <span className="font-mono text-zinc-500">
            {course?.code} Gradebook
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 font-mono text-zinc-500">
                <th className="p-3">Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Due Date</th>
                <th className="p-3 text-center">Actual Score</th>
                <th className="p-3 text-center min-w-[200px]">What-If Score Simulator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {courseAssignments.map(asg => {
                const sub = db.submissions.find(
                  s => s.assignmentId === asg.id && s.studentId === activeUser.id
                );
                const actualGrade = sub?.grade;
                const simulatedGrade = whatIfScores[asg.id] ?? actualGrade ?? 0;

                return (
                  <tr key={asg.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                    <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {asg.title}
                    </td>
                    <td className="p-3 font-mono text-zinc-500">
                      {asg.category} ({asg.weight}%)
                    </td>
                    <td className="p-3 font-mono text-zinc-500">
                      {new Date(asg.dueDate).toLocaleDateString()}
                    </td>

                    {/* Actual Grade */}
                    <td className="p-3 text-center font-mono font-bold">
                      {actualGrade !== undefined ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {actualGrade} / {asg.pointsPossible}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">Unsubmitted</span>
                      )}
                    </td>

                    {/* What-If Slider & Input */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <input
                          type="range"
                          min={0}
                          max={asg.pointsPossible}
                          value={simulatedGrade}
                          onChange={e => handleWhatIfChange(asg.id, Number(e.target.value))}
                          className="w-28 accent-red-700"
                        />
                        <input
                          type="number"
                          min={0}
                          max={asg.pointsPossible}
                          value={simulatedGrade}
                          onChange={e => handleWhatIfChange(asg.id, Number(e.target.value))}
                          className="w-14 p-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-center font-mono text-xs font-bold text-amber-700 dark:text-amber-400"
                        />
                        <span className="font-mono text-zinc-400 text-[10px]">/ {asg.pointsPossible}</span>
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
