import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  Upload,
  Award,
  Send,
  ChevronRight
} from 'lucide-react';

interface AssignmentsViewProps {
  courseId: string;
  selectedAssignmentId: string | null;
  onSelectAssignment: (asgId: string | null) => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  courseId,
  selectedAssignmentId,
  onSelectAssignment
}) => {
  const { activeRole, activeUser, db, submitAssignment, openSpeedGrader } = useLMS();

  const courseAssignments = db.assignments.filter(a => a.courseId === courseId);
  const selectedAssignment = db.assignments.find(a => a.id === selectedAssignmentId);

  // Student submission form state
  const [submissionType, setSubmissionType] = useState<'file' | 'online_text'>('online_text');
  const [textContent, setTextContent] = useState('');
  const [simulatedFileName, setSimulatedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSubmission = selectedAssignment
    ? db.submissions.find(s => s.assignmentId === selectedAssignment.id && s.studentId === activeUser.id)
    : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (submissionType === 'online_text' && !textContent.trim()) {
      alert("Please enter submission text content.");
      return;
    }
    if (submissionType === 'file' && !simulatedFileName) {
      alert("Please choose a file or use the simulated file dropzone.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      submitAssignment(
        selectedAssignment.id,
        submissionType,
        textContent,
        simulatedFileName || 'CMSC131_Lab_Submission.pdf'
      );
      setIsSubmitting(false);
      alert("Assignment submitted successfully to GABAY LMS!");
    }, 600);
  };

  // If no assignment selected, render assignment list
  if (!selectedAssignment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Course Assignments & Milestones
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Laboratory exercises, problem sets, and practical examinations
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {courseAssignments.map(asg => {
            const studentSub = db.submissions.find(
              s => s.assignmentId === asg.id && s.studentId === activeUser.id
            );

            return (
              <div
                key={asg.id}
                onClick={() => onSelectAssignment(asg.id)}
                className="group p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-red-700/60 dark:hover:border-red-600/60 cursor-pointer transition-all shadow-2xs flex items-center justify-between"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-red-700 dark:text-red-400 shrink-0 mt-0.5">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                      {asg.title}
                    </h3>
                    <div className="flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                      <span>Category: {asg.category} ({asg.weight}%)</span>
                      <span>•</span>
                      <span>Due: {new Date(asg.dueDate).toLocaleString()}</span>
                      <span>•</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{asg.pointsPossible} pts</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {studentSub ? (
                    studentSub.status === 'graded' ? (
                      <span className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Graded: {studentSub.grade}/{asg.pointsPossible}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded border border-blue-300 dark:border-blue-800 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Submitted</span>
                      </span>
                    )
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-700">
                      Not Submitted
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Detailed Assignment & Submission Workspace
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back Button */}
      <button
        onClick={() => onSelectAssignment(null)}
        className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
      >
        <span>← Back to All Assignments</span>
      </button>

      {/* Assignment Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 gap-4">
          <div>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-700">
              {selectedAssignment.category} • {selectedAssignment.pointsPossible} Points
            </span>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
              {selectedAssignment.title}
            </h1>
            <p className="text-xs font-mono text-zinc-500 mt-1">
              Due Date: {new Date(selectedAssignment.dueDate).toLocaleString()}
            </p>
          </div>

          {/* SpeedGrader Button for Faculty */}
          {(activeRole === 'faculty' || activeRole === 'admin') && (
            <div className="shrink-0">
              {db.submissions.filter(s => s.assignmentId === selectedAssignment.id).length > 0 ? (
                <button
                  onClick={() => {
                    const firstSub = db.submissions.find(s => s.assignmentId === selectedAssignment.id);
                    if (firstSub) openSpeedGrader(firstSub.id);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-2 shadow-sm"
                >
                  <Award className="w-4 h-4" />
                  <span>Launch SpeedGrader Workspace</span>
                </button>
              ) : (
                <span className="text-xs text-zinc-500 font-mono">No submissions to grade yet</span>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
            Instructions & Requirements:
          </h3>
          <p className="leading-relaxed whitespace-pre-line bg-zinc-50 dark:bg-zinc-950 p-4 rounded border border-zinc-200 dark:border-zinc-800">
            {selectedAssignment.instructions}
          </p>
        </div>

        {/* Rubric Matrix Preview */}
        {selectedAssignment.rubric.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              CHED SpeedGrader Rubric Criteria:
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-zinc-500">
                    <th className="p-2.5">Criterion</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Max Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {selectedAssignment.rubric.map(r => (
                    <tr key={r.id}>
                      <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-100">{r.title}</td>
                      <td className="p-2.5 text-zinc-600 dark:text-zinc-400">{r.description}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-red-700 dark:text-red-400">{r.points} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* STUDENT SUBMISSION WORKSPACE */}
      {activeRole === 'student' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-red-700 dark:text-red-400" />
              <span>Student Submission Terminal</span>
            </h3>
            {currentSubmission && (
              <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded ${
                currentSubmission.status === 'graded'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
              }`}>
                {currentSubmission.status === 'graded' ? `GRADED (${currentSubmission.grade}/${selectedAssignment.pointsPossible})` : 'SUBMITTED'}
              </span>
            )}
          </div>

          {/* Existing Grade & Comment Breakdown */}
          {currentSubmission && currentSubmission.status === 'graded' && (
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                  Evaluated Score: {currentSubmission.grade} / {selectedAssignment.pointsPossible}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {currentSubmission.gradedBy} on {new Date(currentSubmission.gradedAt || '').toLocaleString()}
                </span>
              </div>
              {currentSubmission.comments.map(c => (
                <div key={c.id} className="p-2.5 bg-white dark:bg-zinc-900 rounded border border-emerald-200 dark:border-emerald-900/40">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{c.authorName} ({c.authorRole}):</div>
                  <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 italic">"{c.text}"</p>
                </div>
              ))}
            </div>
          )}

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Type selector tabs */}
            <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setSubmissionType('online_text')}
                className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                  submissionType === 'online_text'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Text Entry Simulator
              </button>
              <button
                type="button"
                onClick={() => setSubmissionType('file')}
                className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                  submissionType === 'file'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                File Upload Dropzone
              </button>
            </div>

            {submissionType === 'online_text' ? (
              <div className="space-y-2">
                <label className="block font-semibold text-zinc-900 dark:text-zinc-100">
                  Online Text Submission:
                </label>
                <textarea
                  rows={5}
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Paste your source code, laboratory answers, or repository URLs here..."
                  className="w-full p-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block font-semibold text-zinc-900 dark:text-zinc-100">
                  File Attachment Dropzone:
                </label>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center space-y-2 bg-zinc-50 dark:bg-zinc-950">
                  <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium">
                    Drag and drop your PDF / ZIP document here or click to select
                  </p>
                  <input
                    type="text"
                    value={simulatedFileName}
                    onChange={e => setSimulatedFileName(e.target.value)}
                    placeholder="e.g. CMSC131_Lab1_JayveeReyes_2021-SLUC-0492.pdf"
                    className="max-w-md mx-auto p-2 border border-zinc-300 dark:border-zinc-700 rounded font-mono text-center w-full bg-white dark:bg-zinc-900"
                  />
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Supported extensions: .pdf, .docx, .zip, .tar.gz (Max 25MB)
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-2 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{currentSubmission ? 'Resubmit Assignment' : 'Submit Assignment to GABAY'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
