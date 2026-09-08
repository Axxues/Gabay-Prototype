import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, ChevronLeft, ChevronRight, Award, MessageSquare, FileText, CheckCircle2 } from 'lucide-react';

export const SpeedGraderModal: React.FC = () => {
  const {
    activeSpeedGraderSubmissionId,
    closeSpeedGrader,
    db,
    gradeSubmission
  } = useLMS();

  if (!activeSpeedGraderSubmissionId) return null;

  const currentSubmission = db.submissions.find(s => s.id === activeSpeedGraderSubmissionId);
  if (!currentSubmission) return null;

  const assignment = db.assignments.find(a => a.id === currentSubmission.assignmentId);
  const course = db.courses.find(c => c.id === currentSubmission.courseId);

  // List of all submissions for this assignment to allow switching between students
  const assignmentSubmissions = db.submissions.filter(s => s.assignmentId === currentSubmission.assignmentId);
  const currentIndex = assignmentSubmissions.findIndex(s => s.id === currentSubmission.id);

  // State for grading form
  const [gradeInput, setGradeInput] = useState<number>(currentSubmission.grade ?? 0);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>(currentSubmission.rubricScores || {});
  const [newComment, setNewComment] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setGradeInput(currentSubmission.grade ?? 0);
    setRubricScores(currentSubmission.rubricScores || {});
    setIsSaved(false);
  }, [currentSubmission.id]);

  const handleRubricScoreChange = (rubricId: string, score: number) => {
    const updated = { ...rubricScores, [rubricId]: score };
    setRubricScores(updated);

    // Auto calculate total sum from rubric
    const total = Object.values(updated).reduce((acc, curr) => acc + curr, 0);
    setGradeInput(total);
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    gradeSubmission(
      currentSubmission.id,
      Number(gradeInput),
      rubricScores,
      newComment.trim() ? newComment : undefined
    );
    setNewComment('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-xs flex flex-col animate-in fade-in duration-150">
      {/* SpeedGrader Top Bar */}
      <header className="h-14 bg-zinc-950 border-b border-zinc-800 px-6 flex items-center justify-between text-zinc-100 shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="px-2 py-0.5 text-xs font-mono font-bold bg-red-900 text-red-200 rounded border border-red-700">
            SpeedGrader™ Workspace
          </div>
          <span className="text-zinc-400">|</span>
          <span className="font-bold text-sm">{assignment?.title}</span>
          <span className="text-xs font-mono text-zinc-400">({course?.code})</span>
        </div>

        {/* Student Selector */}
        <div className="flex items-center space-x-3">
          <button
            disabled={currentIndex <= 0}
            onClick={() => {
              if (currentIndex > 0) {
                const prevSub = assignmentSubmissions[currentIndex - 1];
                useLMS().openSpeedGrader(prevSub.id);
              }
            }}
            className="p-1 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-30 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center font-mono text-xs">
            <span className="font-bold text-zinc-100">{currentSubmission.studentName}</span>
            <span className="text-zinc-500 ml-2">({currentIndex + 1} of {assignmentSubmissions.length})</span>
          </div>

          <button
            disabled={currentIndex >= assignmentSubmissions.length - 1}
            onClick={() => {
              if (currentIndex < assignmentSubmissions.length - 1) {
                const nextSub = assignmentSubmissions[currentIndex + 1];
                useLMS().openSpeedGrader(nextSub.id);
              }
            }}
            className="p-1 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-30 hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={closeSpeedGrader}
            className="p-1.5 text-zinc-400 hover:text-white rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 ml-4 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Student Document Submission Preview */}
        <div className="flex-1 bg-zinc-900 p-6 overflow-y-auto flex flex-col space-y-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-red-500" />
              <div>
                <div className="font-bold text-zinc-100">{currentSubmission.fileName || 'Submission Document'}</div>
                <div className="font-mono text-[11px] text-zinc-500">
                  Submitted: {new Date(currentSubmission.submittedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <a
              href={currentSubmission.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-semibold font-mono"
            >
              Download PDF Preview
            </a>
          </div>

          {/* Render Document Box */}
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-6 font-mono text-xs text-zinc-300 leading-relaxed overflow-y-auto whitespace-pre-line shadow-inner">
            <div className="text-zinc-500 pb-2 mb-4 border-b border-zinc-800 flex justify-between items-center text-[10px]">
              <span>GABAY DOCVIEWER ENGINE v2.4 • STUDENT PAYLOAD RENDERER</span>
              <span>{currentSubmission.studentName} ({currentSubmission.studentId || '2021-SLUC-0492'})</span>
            </div>
            {currentSubmission.content || (
              <div className="text-center py-12 text-zinc-600">
                [PDF Simulated Canvas DocViewer Markup Rendering]
                <br />
                File attached: {currentSubmission.fileName}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Pane: Rubric & Score Input */}
        <div className="w-96 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto space-y-6 text-xs text-zinc-300 shrink-0">
          <form onSubmit={handleSaveGrade} className="space-y-6">
            {/* Numerical Score Entry */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-100 uppercase tracking-wider text-[11px]">
                  Assessment Score:
                </span>
                <span className="font-mono text-zinc-500">
                  out of {assignment?.pointsPossible || 100} pts
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={0}
                  max={assignment?.pointsPossible || 100}
                  value={gradeInput}
                  onChange={e => setGradeInput(Number(e.target.value))}
                  className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded font-mono text-lg font-bold text-red-400 focus:outline-hidden focus:ring-1 focus:ring-red-600 text-center"
                />
              </div>
            </div>

            {/* Rubric Breakdown */}
            {assignment?.rubric && assignment.rubric.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-1.5 font-bold text-zinc-100 uppercase tracking-wider text-[11px]">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>CHED SpeedGrader Rubric</span>
                </div>

                <div className="space-y-3">
                  {assignment.rubric.map(r => (
                    <div key={r.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-2">
                      <div className="flex justify-between font-semibold text-zinc-200">
                        <span>{r.title}</span>
                        <span className="font-mono text-emerald-400">
                          {rubricScores[r.id] ?? 0} / {r.points} pts
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">{r.description}</p>

                      {/* Criterion Rating Selector */}
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {r.ratings.map(rating => (
                          <button
                            key={rating.points}
                            type="button"
                            onClick={() => handleRubricScoreChange(r.id, rating.points)}
                            className={`p-2 rounded text-left border text-[11px] transition-colors ${
                              rubricScores[r.id] === rating.points
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex justify-between font-mono">
                              <span>{rating.description}</span>
                              <span className="ml-1">{rating.points} pts</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Instructor Comments */}
            <div className="space-y-3">
              <div className="flex items-center space-x-1.5 font-bold text-zinc-100 uppercase tracking-wider text-[11px]">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Assignment Feedback Comments</span>
              </div>

              {currentSubmission.comments.map(c => (
                <div key={c.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span className="font-bold text-zinc-200">{c.authorName}</span>
                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-zinc-300 leading-normal italic">{c.text}</p>
                </div>
              ))}

              <textarea
                rows={3}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add private evaluation comment for student..."
                className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded font-sans text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-red-600"
              />
            </div>

            {/* Save Grade Button */}
            <div className="space-y-2">
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors shadow-sm flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Final Grade & Feedback</span>
              </button>
              {isSaved && (
                <div className="text-center font-mono text-[11px] text-emerald-400 animate-pulse">
                  Grade and rubric updated in GABAY database!
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
