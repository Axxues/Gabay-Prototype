import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, ChevronLeft, ChevronRight, Award, MessageSquare, FileText, CheckCircle2 } from 'lucide-react';
import { ModalPortal, useModalAnimate } from '../common/ModalPortal';

export const SpeedGraderModal: React.FC = () => {
  const {
    activeSpeedGraderSubmissionId,
    closeSpeedGrader,
    db,
    gradeSubmission,
    activeRole
  } = useLMS();

  const isAdmin = activeRole === 'admin';

  const { isClosing, startClose } = useModalAnimate(closeSpeedGrader, 200);

  useEffect(() => {
    if (!activeSpeedGraderSubmissionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpeedGraderSubmissionId, startClose]);

  if (!activeSpeedGraderSubmissionId) return null;

  const currentSubmission = db.submissions.find(s => s.id === activeSpeedGraderSubmissionId);
  if (!currentSubmission) return null;

  const assignment = db.assignments.find(a => a.id === currentSubmission.assignmentId);
  const course = db.courses.find(c => c.id === currentSubmission.courseId);

  const assignmentSubmissions = db.submissions.filter(s => s.assignmentId === currentSubmission.assignmentId);
  const currentIndex = assignmentSubmissions.findIndex(s => s.id === currentSubmission.id);

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
    if (isAdmin) return;
    const updated = { ...rubricScores, [rubricId]: score };
    setRubricScores(updated);

    const total = Object.values(updated).reduce((acc, curr) => acc + curr, 0);
    setGradeInput(total);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin) return;
    try {
      await gradeSubmission(
        currentSubmission.id,
        Number(gradeInput),
        rubricScores,
        newComment.trim() ? newComment : undefined
      );
      setNewComment('');
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // gradeSubmission already surfaced the alert.
    }
  };

  return (
    <ModalPortal>
      <div className={`fixed inset-0 z-[100] overflow-hidden overlay-backdrop flex flex-col ${
        isClosing ? 'animate-fade-out' : 'animate-fade-in'
      }`}>
      {/* SpeedGrader Top Header - Cellwego Glass style */}
      <header className="h-14 bg-card/90 backdrop-blur-xl border-b border-border px-6 flex items-center justify-between text-foreground shrink-0 select-none shadow-subtle">
        <div className="flex items-center space-x-3">
          <div className="px-2.5 py-1 text-xs font-sans font-bold bg-primary/10 text-primary rounded-lg border border-primary/20">
            SpeedGrader™ Workspace
          </div>
          {isAdmin && (
            <span className="px-2.5 py-0.5 text-[11px] font-sans font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20">
              Read-Only Audit Mode
            </span>
          )}
          <span className="text-muted-foreground/60">|</span>
          <span className="font-bold text-sm text-foreground">{assignment?.title}</span>
          <span className="text-xs font-sans text-muted-foreground">({course?.code})</span>
        </div>

        {/* Student Navigator */}
        <div className="flex items-center space-x-3">
          <button
            disabled={currentIndex <= 0}
            onClick={() => {
              if (currentIndex > 0) {
                const prevSub = assignmentSubmissions[currentIndex - 1];
                useLMS().openSpeedGrader(prevSub.id);
              }
            }}
            className="p-1.5 rounded-lg bg-card border border-border disabled:opacity-30 hover:bg-muted transition-colors shadow-soft"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center font-sans text-xs">
            <span className="font-bold text-foreground">{currentSubmission.studentName}</span>
            <span className="text-muted-foreground ml-2">({currentIndex + 1} of {assignmentSubmissions.length})</span>
          </div>

          <button
            disabled={currentIndex >= assignmentSubmissions.length - 1}
            onClick={() => {
              if (currentIndex < assignmentSubmissions.length - 1) {
                const nextSub = assignmentSubmissions[currentIndex + 1];
                useLMS().openSpeedGrader(nextSub.id);
              }
            }}
            className="p-1.5 rounded-lg bg-card border border-border disabled:opacity-30 hover:bg-muted transition-colors shadow-soft"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => startClose()}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-card hover:bg-muted border border-border ml-4 transition-colors shadow-soft cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Student Document Preview */}
        <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-4">
          <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between text-xs text-foreground shadow-subtle">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <div className="font-bold text-foreground">{currentSubmission.fileName || 'Submission Document'}</div>
                <div className="font-sans text-[11px] text-muted-foreground">
                  Submitted: {new Date(currentSubmission.submittedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <a
              href={currentSubmission.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-bold font-sans border border-border transition-colors"
            >
              Download PDF Preview
            </a>
          </div>

          {/* Render Document Box */}
          <div className="flex-1 bg-card border border-border rounded-xl p-6 font-sans text-xs text-foreground leading-relaxed overflow-y-auto whitespace-pre-line shadow-inner">
            <div className="text-muted-foreground pb-2 mb-4 border-b border-border flex justify-between items-center text-[10px]">
              <span>GABAY DOCVIEWER ENGINE v2.4 • STUDENT PAYLOAD RENDERER</span>
              <span>{currentSubmission.studentName} ({currentSubmission.studentId || '2021-SLUC-0492'})</span>
            </div>
            {currentSubmission.content || (
              <div className="text-center py-12 text-muted-foreground">
                [PDF Simulated Canvas DocViewer Markup Rendering]
                <br />
                File attached: {currentSubmission.fileName}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Pane: Rubric & Score Input */}
        <div className="w-96 bg-card border-l border-border p-6 overflow-y-auto space-y-6 text-xs text-foreground shrink-0 shadow-lifted animate-slide-in-right">
          <form onSubmit={handleSaveGrade} className="space-y-6">
            {/* Numerical Score Entry */}
            <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                  Assessment Score:
                </span>
                <span className="font-sans text-muted-foreground">
                  out of {assignment?.pointsPossible || 100} pts
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={assignment?.pointsPossible || 100}
                value={gradeInput}
                disabled={isAdmin}
                onChange={e => setGradeInput(Number(e.target.value))}
                className="w-full p-2.5 bg-card border border-border rounded-xl font-sans text-xl font-extrabold text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/30 text-center shadow-subtle disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>

            {/* Rubric Criteria */}
            {assignment?.rubric && assignment.rubric.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span>CHED SpeedGrader Rubric</span>
                </div>

                <div className="space-y-3">
                  {assignment.rubric.map(r => (
                    <div key={r.id} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>{r.title}</span>
                        <span className="font-sans text-emerald-600 dark:text-emerald-400">
                          {rubricScores[r.id] ?? 0} / {r.points} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{r.description}</p>

                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {r.ratings.map(rating => (
                          <button
                            key={rating.points}
                            type="button"
                            disabled={isAdmin}
                            onClick={() => handleRubricScoreChange(r.id, rating.points)}
                            className={`p-2.5 rounded-lg text-left border text-[11px] transition-all ${
                              rubricScores[r.id] === rating.points
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold shadow-soft'
                                : 'bg-card text-muted-foreground border-border hover:border-border/80'
                            } ${isAdmin ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                          >
                            <div className="flex justify-between font-sans">
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

            {/* Feedback Comments */}
            <div className="space-y-3">
              <div className="flex items-center space-x-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>Assignment Feedback Comments</span>
              </div>

              {[...currentSubmission.comments]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(c => (
                <div key={c.id} className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <div className="flex justify-between text-[10px] font-sans text-muted-foreground">
                    <span className="font-bold text-foreground">{c.authorName}</span>
                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-foreground leading-normal italic">{c.text}</p>
                </div>
              ))}

              {!isAdmin && (
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add private evaluation comment for student..."
                  className="w-full p-3 bg-card border border-border rounded-xl font-sans text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shadow-subtle"
                />
              )}
            </div>

            {/* Save Grade Button */}
            {!isAdmin ? (
              <div className="space-y-2">
                <button
                  type="submit"
                  className="w-full py-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center justify-center space-x-2 active:scale-[0.98] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Final Grade & Feedback</span>
                </button>
                {isSaved && (
                  <div className="text-center font-sans text-[11px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                    Grade and rubric updated in GABAY database!
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-muted/40 border border-border rounded-xl text-center font-sans text-xs text-muted-foreground">
                🔒 SpeedGrader is in read-only audit mode for administrators.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
