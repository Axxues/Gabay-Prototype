import React, { useEffect, useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { ActivityScore } from '../utils/activities';
import { scoreActivityQuestions } from '../utils/activities';
import type { QuizQuestion, Submission } from '../types/lms';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Plus,
  Send,
  Trash2,
  Users
} from 'lucide-react';
import { CreateActivityPage } from './CreateActivityPage';
import { EmptyState } from '../components/common/EmptyState';

interface ActivitiesViewProps {
  courseId: string;
  activityId: string | null;
  onSelectActivity: (id: string | null) => void;
  onBackToModules?: () => void;
}

const mockAssignmentId = (activityId: string) => `asg-activity-${activityId}`;

/** Task 4 does not validate blank prompt text — never crash on empty strings. */
function questionLabel(q: QuizQuestion, index: number): string {
  const text = (q.text || '').trim();
  return text ? q.text : `Question ${index + 1}`;
}

function typeLabel(type: QuizQuestion['type']): string {
  if (type === 'multiple_choice') return 'Multiple Choice';
  if (type === 'identification') return 'Identification';
  if (type === 'true_false') return 'True or False';
  return 'Essay Response';
}

/** Auto-item correctness only; essays are never auto-scored. */
function isAutoCorrect(q: QuizQuestion, answer: string): boolean {
  const userAns = (answer || '').trim();
  if (!userAns) return false;
  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    return userAns === (q.correctAnswer || '').trim();
  }
  if (q.type === 'identification') {
    return userAns.toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
  }
  return false;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  courseId,
  activityId,
  onSelectActivity
}) => {
  const {
    activeRole,
    activeUser,
    db,
    recordActivitySubmission,
    deleteActivity,
    openSpeedGrader,
    showAlert,
    showConfirm
  } = useLMS();

  const [isCreating, setIsCreating] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Submission | null>(null);
  // Instant-feedback score from the client scorer — the server row stays
  // 'submitted' until faculty grades in SpeedGrader.
  const [clientScore, setClientScore] = useState<ActivityScore | null>(null);

  useEffect(() => {
    setAnswers({});
    setResult(null);
    setClientScore(null);
  }, [activityId]);

  const courseActivities = (db.activities || []).filter(a => a.courseId === courseId);
  const activity = (db.activities || []).find(a => a.id === activityId);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Are you sure you want to delete this question set and all associated student submissions?',
      () => {
        deleteActivity(id)
          .then(() => onSelectActivity(null))
          .catch(() => {});
      },
      'Delete Question Set'
    );
  };

  // Full-page authoring (same pattern as AssignmentsView.isCreatingAssignment)
  if (isCreating) {
    return (
      <CreateActivityPage
        courseId={courseId}
        onBack={() => setIsCreating(false)}
        onActivityCreated={id => {
          setIsCreating(false);
          onSelectActivity(id);
        }}
      />
    );
  }

  // ---------- List mode: Question Sets section inside the Activities tab ----------
  if (!activityId) {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground flex items-center space-x-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <span>Question Sets</span>
            <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-muted-foreground border border-border">
              {courseActivities.length}
            </span>
          </h3>
          {activeRole === 'faculty' && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Question Set</span>
            </button>
          )}
        </div>

        {courseActivities.length === 0 ? (
          <EmptyState title="No question sets published for this course yet." />
        ) : (
          courseActivities.map(act => {
            const studentSub =
              activeRole === 'student'
                ? db.submissions.find(
                    s => s.assignmentId === mockAssignmentId(act.id) && s.studentId === activeUser.id
                  )
                : undefined;
            const hasEssay = act.questions.some(q => q.type === 'essay');

            return (
              <div
                key={act.id}
                onClick={() => onSelectActivity(act.id)}
                className="group p-4 bg-card border border-border rounded-xl hover:border-primary/40 cursor-pointer card-hover shadow-soft transition-all flex items-center justify-between"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 bg-muted rounded-xl text-primary shrink-0 mt-0.5 border border-border">
                    <ListChecks className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {(act.title || '').trim() || 'Untitled Question Set'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1 font-sans">
                      <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-foreground">
                        Question Set
                      </span>
                      <span>•</span>
                      <span>{act.questions.length} Questions</span>
                      <span>•</span>
                      <span className="font-bold text-foreground">{act.pointsPossible} pts</span>
                      {act.dueDate && (
                        <>
                          <span>•</span>
                          <span>
                            Due:{' '}
                            {new Date(act.dueDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {studentSub ? (
                    studentSub.status === 'graded' ? (
                      <span className="px-2.5 py-1 text-xs font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>SCORED {studentSub.grade}%</span>
                      </span>
                    ) : hasEssay ? (
                      <span className="px-2.5 py-1 text-xs font-sans font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>PENDING REVIEW</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-sans font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-500/20 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>SUBMITTED</span>
                      </span>
                    )
                  ) : (
                    activeRole === 'student' && (
                      <span className="px-2.5 py-1 text-xs font-sans font-bold bg-muted text-muted-foreground rounded-lg border border-border">
                        Not Submitted
                      </span>
                    )
                  )}
                  {activeRole === 'faculty' && (
                    <button
                      type="button"
                      title="Delete Question Set"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(act.id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-xl border border-red-500/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ---------- Runner mode ----------
  if (!activity) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          type="button"
          onClick={() => onSelectActivity(null)}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Activities List</span>
        </button>
        <EmptyState title="This question set no longer exists." />
      </div>
    );
  }

  const activitySubmissions = db.submissions.filter(
    s => s.assignmentId === mockAssignmentId(activity.id)
  );
  const studentSubmission =
    activeRole === 'student'
      ? activitySubmissions.find(s => s.studentId === activeUser.id)
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serverSub = await recordActivitySubmission(activity.id, activeUser.id, answers);
      // Instant feedback keeps using the client scorer; the cached server
      // row records the submission for SpeedGrader/gradebook.
      setClientScore(scoreActivityQuestions(activity.questions, answers));
      setResult(serverSub);
    } catch {
      // recordActivitySubmission already surfaced the alert.
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSelectActivity(null)}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Activities List</span>
        </button>

        {activeRole === 'faculty' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const sub = activitySubmissions[0];
                if (sub) openSpeedGrader(sub.id);
                else showAlert('No student submissions yet for this activity.');
              }}
              className="px-3 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-colors cursor-pointer"
            >
              Inspect in SpeedGrader
            </button>
            <button
              onClick={() => handleDelete(activity.id)}
              className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-xl border border-red-500/20 transition-colors cursor-pointer"
              title="Delete Question Set"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Activity header card */}
      <div className="bg-card border-t-8 border-t-primary border-x border-b border-border/80 rounded-2xl p-6 space-y-4 shadow-subtle">
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 text-[10px] font-sans font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/20">
            GABAY Question Set Runner
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-2">
            {(activity.title || '').trim() || 'Untitled Question Set'}
          </h1>
          <p className="text-xs text-muted-foreground font-sans mt-1 leading-relaxed">
            {activity.instructions}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-sans border-t border-border pt-3">
          <span className="font-bold text-foreground">{activity.questions.length} Questions</span>
          <span>•</span>
          <span className="text-primary font-bold">{activity.pointsPossible} Total Points</span>
          {activity.dueDate && (
            <>
              <span>•</span>
              <span>Due: {new Date(activity.dueDate).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* ---------- Faculty detail: per-student submissions ---------- */}
      {activeRole === 'faculty' && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Student Submissions</span>
            <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-muted-foreground border border-border">
              {activitySubmissions.length}
            </span>
          </h3>
          {activitySubmissions.length === 0 ? (
            <EmptyState title="No student submissions yet for this question set." />
          ) : (
            <div className="space-y-2">
              {activitySubmissions.map(sub => (
                <div
                  key={sub.id}
                  className="p-3.5 bg-muted/40 rounded-xl border border-border flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-foreground">{sub.studentName}</div>
                    <div className="text-muted-foreground font-sans">
                      {sub.status === 'graded' ? `Graded: ${sub.grade}%` : 'Pending faculty review'} •{' '}
                      {new Date(sub.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => openSpeedGrader(sub.id)}
                    className="px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all cursor-pointer"
                  >
                    Open in SpeedGrader
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-[11px] text-foreground">
              Question Key Preview
            </h4>
            {activity.questions.map((q, idx) => (
              <div key={q.id} className="p-3 bg-muted/40 rounded-xl border border-border text-xs">
                <span className="font-bold text-foreground">
                  Q{idx + 1} • {typeLabel(q.type)} • {q.points} pts
                </span>
                <p className="text-muted-foreground mt-0.5">{questionLabel(q, idx)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Student runner ---------- */}
      {activeRole === 'student' && !result && (
        <>
          {studentSubmission && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-700 dark:text-blue-300 flex items-center space-x-3">
              <FileText className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold">
                  {studentSubmission.status === 'graded'
                    ? `Previously scored: ${studentSubmission.grade}%`
                    : 'Previously submitted — pending faculty review.'}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Answering again replaces your previous submission.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {activity.questions.map((q, idx) => (
              <div key={q.id} className="p-5 bg-card rounded-2xl border border-border space-y-4 shadow-subtle">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Question {idx + 1} • {typeLabel(q.type)}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground leading-relaxed">
                      {questionLabel(q, idx)}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold font-sans rounded-lg bg-muted text-foreground border border-border shrink-0">
                    {q.points} pts
                  </span>
                </div>

                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isSelected = answers[q.id] === opt;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/20'
                              : 'border-border bg-background hover:bg-muted text-foreground'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`activity_q_${q.id}`}
                            value={opt}
                            required={optIdx === 0}
                            checked={isSelected}
                            onChange={() => setAnswer(q.id, opt)}
                            className="text-primary focus:ring-primary accent-primary"
                          />
                          <span className="w-5 h-5 rounded-md bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                            {letter}
                          </span>
                          <span className="leading-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3 pt-1 max-w-md">
                    {['True', 'False'].map(val => {
                      const isSelected = answers[q.id] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnswer(q.id, val)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                              : 'bg-background border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`tf_run_${q.id}`}
                            checked={isSelected}
                            onChange={() => setAnswer(q.id, val)}
                            className="w-4 h-4 accent-emerald-600"
                          />
                          <span>{val}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === 'identification' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      required
                      value={answers[q.id] || ''}
                      onChange={e => setAnswer(q.id, e.target.value)}
                      placeholder="Type your exact answer here..."
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-inner"
                    />
                  </div>
                )}

                {q.type === 'essay' && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={4}
                      required
                      value={answers[q.id] || ''}
                      onChange={e => setAnswer(q.id, e.target.value)}
                      placeholder="Type your essay response in detail..."
                      className="w-full p-3.5 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-inner resize-y leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <span>Open-ended answer evaluation</span>
                      <span>{(answers[q.id] || '').split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-end pt-4 border-t border-border">
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-2 cursor-pointer active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Submit Activity Answers</span>
              </button>
            </div>
          </form>
        </>
      )}

      {/* ---------- Student result panel ---------- */}
      {activeRole === 'student' && result && (
        <div className="space-y-5">
          {(clientScore?.needsReview ?? result.status === 'submitted') ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-300 flex items-center space-x-3">
              <Clock className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold">Essay pending faculty review in SpeedGrader</span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Your auto-scored answers are recorded below. Essay items award no automatic
                  points until your instructor grades them.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <div>
                <span className="font-bold">Activity Completed &amp; Auto-Scored ({clientScore?.percent ?? result.grade}%)</span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Your responses have been recorded and evaluated against the answer key.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {activity.questions.map((q, idx) => {
              const userAns = (answers[q.id] || '').trim();
              if (q.type === 'essay') {
                return (
                  <div key={q.id} className="p-5 rounded-2xl border border-border bg-card space-y-2 text-xs shadow-subtle">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      Question {idx + 1} • Essay Response
                    </span>
                    <h4 className="font-bold text-foreground">{questionLabel(q, idx)}</h4>
                    <p className="text-muted-foreground italic">
                      Your answer ({userAns.split(/\s+/).filter(Boolean).length} words) is pending
                      faculty review — no automatic points.
                    </p>
                  </div>
                );
              }
              const correct = isAutoCorrect(q, answers[q.id] || '');
              return (
                <div key={q.id} className="p-5 rounded-2xl border border-border bg-card space-y-2 text-xs shadow-subtle">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Question {idx + 1} • {typeLabel(q.type)}
                  </span>
                  <h4 className="font-bold text-foreground">{questionLabel(q, idx)}</h4>
                  <div className="flex items-center space-x-2">
                    {correct ? (
                      <span className="px-2.5 py-1 font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct • {q.points} pts</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 font-sans font-bold bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg border border-red-500/20">
                        Incorrect • 0/{q.points} pts
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground font-sans">
                    Your answer: {userAns || <em className="not-italic">(blank)</em>}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border transition-all cursor-pointer"
            >
              Answer Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
