import React from 'react';
import { useLMS } from '../context/LMSContext';
import { ShieldCheck, BookOpen } from 'lucide-react';

interface SyllabusViewProps {
  courseId: string;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ courseId }) => {
  const { db } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
              OFFICIAL SYLLABUS DOCUMENT
            </span>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
              {course?.code}: {course?.title}
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              {course?.term} • {course?.section} • Instructor: {course?.instructorName}
            </p>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-right font-mono text-xs">
            <div className="text-zinc-500">CHED Standard</div>
            <div className="font-bold text-emerald-700 dark:text-emerald-400">{course?.chedComplianceCode}</div>
          </div>
        </div>

        <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-2">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Course Description & Rationale:</p>
          <p>
            This course introduces foundational principles in single-page application development, reactive client-side architecture, state persistence layers, and accessibility standards for institutional academic management systems.
          </p>
        </div>
      </div>

      {/* CHED CMO 25 Course Learning Outcomes (CLOs) Matrix */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>CHED CMO 25 s. 2015 Course Learning Outcomes (CLOs)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-zinc-500">
                <th className="p-3">CLO Code</th>
                <th className="p-3">Learning Outcome Description</th>
                <th className="p-3">Program Outcome Alignment</th>
                <th className="p-3">Assessment Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr>
                <td className="p-3 font-mono font-bold text-red-700 dark:text-red-400">CLO 1</td>
                <td className="p-3 text-zinc-800 dark:text-zinc-200">Design and implement single-page applications with reactive local storage synchronization.</td>
                <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">BSCS PO-03 (Software Dev)</td>
                <td className="p-3 text-zinc-700 dark:text-zinc-300">Lab Milestone 1 & SpeedGrader Rubric</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-red-700 dark:text-red-400">CLO 2</td>
                <td className="p-3 text-zinc-800 dark:text-zinc-200">Enforce Role-Based Access Controls (RBAC) adhering to RA 10173 Philippine Data Privacy Act.</td>
                <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">BSCS PO-07 (Security & Ethics)</td>
                <td className="p-3 text-zinc-700 dark:text-zinc-300">Role Guard Audit & Quiz 1</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-red-700 dark:text-red-400">CLO 3</td>
                <td className="p-3 text-zinc-800 dark:text-zinc-200">Develop split-screen evaluation workspaces (SpeedGrader) and weighted grade engines.</td>
                <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">BSCS PO-04 (Algorithms)</td>
                <td className="p-3 text-zinc-700 dark:text-zinc-300">Lab Milestone 2 & Gradebook What-If</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Grading Weight Breakdown Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-red-700 dark:text-red-400" />
          <span>Course Evaluation Weight System</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-center space-y-1">
            <div className="text-zinc-500">Laboratory Milestones</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">50%</div>
            <div className="text-[10px] text-zinc-400">Practical SPA Projects</div>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-center space-y-1">
            <div className="text-zinc-500">Quizzes & Self-Checks</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">20%</div>
            <div className="text-[10px] text-zinc-400">Theoretical Assessments</div>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-center space-y-1">
            <div className="text-zinc-500">Midterm / Final Examination</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">30%</div>
            <div className="text-[10px] text-zinc-400">Comprehensive Exam</div>
          </div>
        </div>
      </div>
    </div>
  );
};
