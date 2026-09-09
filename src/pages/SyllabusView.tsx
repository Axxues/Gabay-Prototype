import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  ShieldCheck,
  BookOpen,
  Edit,
  Printer,
  X
} from 'lucide-react';

interface SyllabusViewProps {
  courseId: string;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ courseId }) => {
  const { db, activeRole, updateSyllabus } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [desc, setDesc] = useState('This course introduces foundational principles in single-page application development, reactive client-side architecture, state persistence layers, and accessibility standards for institutional academic management systems.');
  const [chedCode, setChedCode] = useState(course?.chedComplianceCode || 'CMO-25-2015');
  const [labWeight, setLabWeight] = useState(50);
  const [quizWeight, setQuizWeight] = useState(20);
  const [examWeight, setExamWeight] = useState(30);

  const handleSaveSyllabus = (e: React.FormEvent) => {
    e.preventDefault();
    updateSyllabus(courseId, {
      chedComplianceCode: chedCode
    });
    setIsEditOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-4 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold uppercase bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded-md border border-pink-500/20">
                OFFICIAL SYLLABUS DOCUMENT
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">OBE Framework</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-2">
              {course?.code}: {course?.title}
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {course?.term} • {course?.section} • Instructor: {course?.instructorName}
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
              title="Print Syllabus"
            >
              <Printer className="w-4 h-4" />
            </button>

            {(activeRole === 'faculty' || activeRole === 'admin') && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="px-3.5 py-2 text-xs font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Syllabus</span>
              </button>
            )}

            <div className="p-3 bg-muted/40 border border-border rounded-xl text-right font-mono text-xs">
              <div className="text-muted-foreground text-[10px]">CHED Standard</div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400">{course?.chedComplianceCode}</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-foreground/90 leading-relaxed space-y-2">
          <p className="font-bold text-foreground">Course Description & Rationale:</p>
          <p>{desc}</p>
        </div>
      </div>

      {/* CHED CMO 25 Course Learning Outcomes (CLOs) Matrix */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-subtle">
        <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>CHED CMO 25 s. 2015 Course Learning Outcomes (CLOs)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-mono text-muted-foreground">
                <th className="p-3">CLO Code</th>
                <th className="p-3">Learning Outcome Description</th>
                <th className="p-3">Program Outcome Alignment</th>
                <th className="p-3">Assessment Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-3 font-mono font-bold text-pink-700 dark:text-pink-400">CLO 1</td>
                <td className="p-3 text-foreground">Design and implement single-page applications with reactive local storage synchronization.</td>
                <td className="p-3 font-mono text-muted-foreground">BSCS PO-03 (Software Dev)</td>
                <td className="p-3 text-foreground font-medium">Lab Milestones & SpeedGrader Rubric</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-pink-700 dark:text-pink-400">CLO 2</td>
                <td className="p-3 text-foreground">Enforce Role-Based Access Controls (RBAC) adhering to RA 10173 Philippine Data Privacy Act.</td>
                <td className="p-3 font-mono text-muted-foreground">BSCS PO-07 (Security & Ethics)</td>
                <td className="p-3 text-foreground font-medium">Role Guard Audit & Quiz 1</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-pink-700 dark:text-pink-400">CLO 3</td>
                <td className="p-3 text-foreground">Develop split-screen evaluation workspaces (SpeedGrader) and weighted grade engines.</td>
                <td className="p-3 font-mono text-muted-foreground">BSCS PO-04 (Algorithms)</td>
                <td className="p-3 text-foreground font-medium">Lab Milestones & Gradebook What-If</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Grading Weight Breakdown Table */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-subtle">
        <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-pink-700 dark:text-pink-400" />
          <span>Course Evaluation Weight System</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 bg-muted/40 border border-border rounded-xl text-center space-y-1">
            <div className="text-muted-foreground">Laboratory Milestones</div>
            <div className="text-2xl font-bold text-foreground">{labWeight}%</div>
            <div className="text-[10px] text-muted-foreground">Practical SPA Projects</div>
          </div>
          <div className="p-4 bg-muted/40 border border-border rounded-xl text-center space-y-1">
            <div className="text-muted-foreground">Quizzes & Self-Checks</div>
            <div className="text-2xl font-bold text-foreground">{quizWeight}%</div>
            <div className="text-[10px] text-muted-foreground">Assessment Quizzes</div>
          </div>
          <div className="p-4 bg-muted/40 border border-border rounded-xl text-center space-y-1">
            <div className="text-muted-foreground">Major Examinations</div>
            <div className="text-2xl font-bold text-foreground">{examWeight}%</div>
            <div className="text-[10px] text-muted-foreground">Midterm & Final Defense</div>
          </div>
        </div>
      </div>

      {/* Modal: Edit Syllabus */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
            onClick={() => setIsEditOpen(false)}
          />

          <div
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Edit Course Syllabus Specifications</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSyllabus} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">CHED Compliance Code</label>
                <input
                  type="text"
                  value={chedCode}
                  onChange={e => setChedCode(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Course Description & Rationale</label>
                <textarea
                  rows={4}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-foreground mb-1">Lab (%)</label>
                  <input
                    type="number"
                    value={labWeight}
                    onChange={e => setLabWeight(Number(e.target.value))}
                    className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Quiz (%)</label>
                  <input
                    type="number"
                    value={quizWeight}
                    onChange={e => setQuizWeight(Number(e.target.value))}
                    className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Exam (%)</label>
                  <input
                    type="number"
                    value={examWeight}
                    onChange={e => setExamWeight(Number(e.target.value))}
                    className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer"
                >
                  Save Syllabus Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
