import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import type { Quiz, QuizQuestion } from '../types/lms';
import {
  HelpCircle,
  Play,
  CheckCircle2,
  Clock,
  Plus,
  X,
  ArrowLeft
} from 'lucide-react';
import { AnimatedModal } from '../components/common/ModalPortal';

interface QuizzesViewProps {
  courseId: string;
  selectedQuizId?: string | null;
  onSelectQuiz?: (quizId: string | null) => void;
  onBackToModules?: () => void;
}

export const QuizzesView: React.FC<QuizzesViewProps> = ({
  courseId,
  selectedQuizId,
  onSelectQuiz,
  onBackToModules
}) => {
  const {
    activeRole,
    activeUser,
    db,
    createQuiz,
    recordQuizSubmission,
    showAlert
  } = useLMS();

  const courseQuizzes = db.quizzes.filter(q => q.courseId === courseId);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Sync activeQuiz when selectedQuizId changes (e.g. from Modules navigation)
  useEffect(() => {
    if (selectedQuizId) {
      const q = courseQuizzes.find(item => item.id === selectedQuizId);
      if (q) {
        setActiveQuiz(q);
        setUserAnswers({});
        setQuizSubmitted(false);
        setScore(null);
      }
    }
  }, [selectedQuizId, courseId]);

  // Create Quiz Modal State
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizInstructions, setQuizInstructions] = useState('');
  const [quizTimeLimit, setQuizTimeLimit] = useState(30);
  const [quizPoints, setQuizPoints] = useState(25);
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState('A');

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setUserAnswers({});
    setQuizSubmitted(false);
    setScore(null);
  };

  const handleSelectAnswer = (qId: string, ans: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: ans }));
  };

  const handleSubmitQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuiz) return;

    let totalPoints = 0;
    let earnedPoints = 0;

    activeQuiz.questions.forEach(q => {
      totalPoints += q.points;
      if (userAnswers[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });

    const calculatedScore = Math.round((earnedPoints / (totalPoints || 1)) * 100);
    setScore(calculatedScore);
    setQuizSubmitted(true);

    // Save submission to database
    recordQuizSubmission(activeQuiz.id, activeUser.id, calculatedScore, userAnswers);
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim() || !qText.trim() || !qOptA.trim() || !qOptB.trim()) {
      showAlert("Please enter quiz title and question details.");
      return;
    }

    const correctMap: Record<string, string> = {
      A: qOptA.trim(),
      B: qOptB.trim(),
      C: qOptC.trim() || qOptA.trim(),
      D: qOptD.trim() || qOptB.trim()
    };

    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}-1`,
      text: qText.trim(),
      type: 'multiple_choice',
      options: [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()].filter(Boolean),
      correctAnswer: correctMap[qCorrect] || qOptA.trim(),
      points: Number(quizPoints) || 25
    };

    createQuiz({
      courseId,
      title: quizTitle.trim(),
      instructions: quizInstructions.trim() || 'Answer the questions within the allotted time limit.',
      timeLimitMinutes: Number(quizTimeLimit) || 30,
      published: true,
      questions: [newQuestion]
    });

    setIsCreateQuizOpen(false);
    setQuizTitle('');
    setQuizInstructions('');
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
  };

  // Quiz runner modal/screen
  if (activeQuiz) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
        <button
          type="button"
          onClick={() => {
            setActiveQuiz(null);
            if (onBackToModules) {
              onBackToModules();
            } else if (onSelectQuiz) {
              onSelectQuiz(null);
            }
          }}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{onBackToModules ? 'Back to Modules' : 'Back to Quizzes List'}</span>
        </button>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-subtle">
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-sans font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/20">
                GABAY ONLINE ASSESSMENT RUNNER
              </span>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground mt-2">
                {activeQuiz.title}
              </h1>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Time Limit: {activeQuiz.timeLimitMinutes} Minutes • {activeQuiz.questions.length} Questions
              </p>
            </div>

            {quizSubmitted && score !== null && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-right">
                <div className="text-[10px] font-sans text-muted-foreground">Automated Evaluation</div>
                <div className="text-2xl font-extrabold font-sans text-emerald-700 dark:text-emerald-400">
                  {score}%
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-sans mt-0.5">
                  Saved to Gradebook
                </div>
              </div>
            )}
          </div>

          {!quizSubmitted ? (
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              {activeQuiz.questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-start font-bold text-xs text-foreground">
                    <span>Question {idx + 1}: {q.text}</span>
                    <span className="font-sans text-muted-foreground shrink-0 ml-2">{q.points} pts</span>
                  </div>

                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-2">
                      {q.options.map(opt => (
                        <label
                          key={opt}
                          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer text-xs transition-colors ${
                            userAnswers[q.id] === opt
                              ? 'border-primary bg-primary/10 text-foreground font-semibold'
                              : 'border-border bg-card hover:bg-muted text-foreground'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`quiz_q_${q.id}`}
                            value={opt}
                            checked={userAnswers[q.id] === opt}
                            onChange={() => handleSelectAnswer(q.id, opt)}
                            className="text-primary focus:ring-primary accent-primary"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer"
                >
                  Submit Assessment Answers
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                <div className="font-bold mb-1 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assessment Completed & Verified</span>
                </div>
                Your responses have been evaluated and synced with the GABAY Course Gradebook matrix.
              </div>

              <div className="space-y-3">
                {activeQuiz.questions.map((q, idx) => {
                  const isCorrect = userAnswers[q.id] === q.correctAnswer;
                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>Q{idx + 1}: {q.text}</span>
                        <span className={isCorrect ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                          {isCorrect ? `+${q.points} pts` : '0 pts'}
                        </span>
                      </div>
                      <div className="font-sans text-[11px] text-muted-foreground">
                        Your answer: <span className="font-bold text-foreground">{userAnswers[q.id] || 'None'}</span>
                      </div>
                      <div className="font-sans text-[11px] text-emerald-600 dark:text-emerald-400">
                        Correct answer: <span className="font-bold">{q.correctAnswer}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveQuiz(null);
                  if (onBackToModules) {
                    onBackToModules();
                  } else if (onSelectQuiz) {
                    onSelectQuiz(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{onBackToModules ? 'Done / Return to Modules' : 'Done / Return to Quizzes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quizzes List View
  return (
    <div className="space-y-6 animate-fade-in">
      {onBackToModules && (
        <button
          type="button"
          onClick={onBackToModules}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer -mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Modules</span>
        </button>
      )}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Quizzes
          </h2>
          <p className="text-xs text-muted-foreground">
            Course quizzes and knowledge tests.
          </p>
        </div>

        {(activeRole === 'faculty' || activeRole === 'admin') && (
          <button
            onClick={() => setIsCreateQuizOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Quiz</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {courseQuizzes.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-2xl border border-border text-xs text-muted-foreground">
            No quizzes published for this course yet.
          </div>
        ) : (
          courseQuizzes.map(quiz => {
            const existingSub = db.submissions.find(
              s => s.assignmentId === `asg-quiz-${quiz.id}` && s.studentId === activeUser.id
            );

            return (
              <div
                key={quiz.id}
                className="p-5 bg-card border border-border rounded-xl hover:border-primary/40 shadow-soft card-hover transition-all flex items-center justify-between"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quiz.instructions}
                    </p>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground font-sans mt-1.5">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{quiz.timeLimitMinutes} Mins</span>
                      </span>
                      <span>•</span>
                      <span>{quiz.questions.length} Question(s)</span>
                      <span>•</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {quiz.questions.reduce((sum, q) => sum + q.points, 0)} Total Points
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {existingSub && existingSub.grade !== undefined && (
                    <span className="px-3 py-1 text-xs font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
                      Score: {existingSub.grade}%
                    </span>
                  )}

                  <button
                    onClick={() => handleStartQuiz(quiz)}
                    className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{existingSub ? 'Retake Quiz' : 'Take Quiz'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Quiz */}
      <AnimatedModal
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        panelClassName="w-full max-w-lg bg-card border border-border rounded-2xl shadow-elevated overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {({ startClose }) => (
          <>
            <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Create Assessment Quiz</h3>
                  <p className="text-[10px] font-sans text-muted-foreground">Automated grading examination</p>
                </div>
              </div>
              <button
                onClick={startClose}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Quiz Title *</label>
                <input
                  type="text"
                  required
                  value={quizTitle}
                  onChange={e => setQuizTitle(e.target.value)}
                  placeholder="e.g. Quiz 2: React Hooks & State Management"
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans focus:ring-2 focus:ring-primary/40 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={quizTimeLimit}
                    onChange={e => setQuizTimeLimit(Number(e.target.value))}
                    className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-sans"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Total Points Target</label>
                  <input
                    type="number"
                    value={quizPoints}
                    onChange={e => setQuizPoints(Number(e.target.value))}
                    className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  value={quizInstructions}
                  onChange={e => setQuizInstructions(e.target.value)}
                  placeholder="Review lecture notes and documentation before proceeding..."
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans outline-none"
                />
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-3">
                <div className="font-bold text-foreground text-xs flex items-center justify-between">
                  <span>Question 1 (Auto-Evaluated)</span>
                  <span className="font-sans text-[10px] text-muted-foreground">{quizPoints} Points</span>
                </div>

                <input
                  type="text"
                  required
                  value={qText}
                  onChange={e => setQText(e.target.value)}
                  placeholder="Enter multiple-choice question prompt..."
                  className="w-full p-2 bg-background border border-border rounded-lg text-foreground text-xs outline-none"
                />

                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-foreground">Designate Correct Answer</label>
                  <select
                    value={qCorrect}
                    onChange={e => setQCorrect(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground text-xs font-sans font-semibold shadow-subtle cursor-pointer"
                  >
                    <option value="A">Choice A</option>
                    <option value="B">Choice B</option>
                    <option value="C">Choice C</option>
                    <option value="D">Choice D</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-emerald-700 dark:text-emerald-400 font-bold mb-0.5">Choice A</label>
                    <input
                      type="text"
                      required
                      value={qOptA}
                      onChange={e => setQOptA(e.target.value)}
                      placeholder="useState"
                      className="w-full p-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-0.5">Choice B</label>
                    <input
                      type="text"
                      value={qOptB}
                      onChange={e => setQOptB(e.target.value)}
                      placeholder="useEffect"
                      className="w-full p-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-0.5">Choice C</label>
                    <input
                      type="text"
                      value={qOptC}
                      onChange={e => setQOptC(e.target.value)}
                      placeholder="useRef"
                      className="w-full p-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-0.5">Choice D</label>
                    <input
                      type="text"
                      value={qOptD}
                      onChange={e => setQOptD(e.target.value)}
                      placeholder="useContext"
                      className="w-full p-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-subtle cursor-pointer"
                >
                  Publish Quiz
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};
