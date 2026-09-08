import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { Quiz } from '../types/lms';
import { HelpCircle, Play } from 'lucide-react';

interface QuizzesViewProps {
  courseId: string;
}

export const QuizzesView: React.FC<QuizzesViewProps> = ({ courseId }) => {
  const { db } = useLMS();

  const courseQuizzes = db.quizzes.filter(q => q.courseId === courseId);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

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

    const calculatedScore = Math.round((earnedPoints / totalPoints) * 100);
    setScore(calculatedScore);
    setQuizSubmitted(true);
  };

  // Quiz runner modal/screen
  if (activeQuiz) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button
          onClick={() => setActiveQuiz(null)}
          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to Quizzes List
        </button>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-6 shadow-2xs">
          <div className="flex justify-between items-start border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800">
                GABAY ONLINE ASSESSMENT RUNNER
              </span>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {activeQuiz.title}
              </h1>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                Time Limit: {activeQuiz.timeLimitMinutes} Minutes • {activeQuiz.questions.length} Questions
              </p>
            </div>

            {quizSubmitted && score !== null && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded text-right">
                <div className="text-[10px] font-mono text-zinc-500">Automated Grade</div>
                <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {score}%
                </div>
              </div>
            )}
          </div>

          {!quizSubmitted ? (
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              {activeQuiz.questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex justify-between items-start font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    <span>Question {idx + 1}: {q.text}</span>
                    <span className="font-mono text-zinc-500 shrink-0 ml-2">{q.points} pts</span>
                  </div>

                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-2">
                      {q.options.map(opt => (
                        <label
                          key={opt}
                          className="flex items-center space-x-3 p-2.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-red-700/50 cursor-pointer text-xs transition-colors"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={userAnswers[q.id] === opt}
                            onChange={() => handleSelectAnswer(q.id, opt)}
                            className="text-red-700 focus:ring-red-600"
                          />
                          <span className="text-zinc-800 dark:text-zinc-200">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'true_false' && q.options && (
                    <div className="flex space-x-4">
                      {q.options.map(opt => (
                        <label
                          key={opt}
                          className="flex items-center space-x-2 p-2.5 px-4 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-red-700/50 cursor-pointer text-xs transition-colors"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={userAnswers[q.id] === opt}
                            onChange={() => handleSelectAnswer(q.id, opt)}
                            className="text-red-700 focus:ring-red-600"
                          />
                          <span className="text-zinc-800 dark:text-zinc-200 font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors shadow-sm"
                >
                  Submit Quiz Answers
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs space-y-1">
                <h3 className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                  Quiz Submitted Successfully
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Your answers have been processed and synced with the GABAY Gradebook.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveQuiz(null)}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-900 text-white rounded"
                >
                  Return to Quizzes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Quizzes & Assessment Diagnostics
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Timed self-check diagnostic tests and outcome-based quizzes
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {courseQuizzes.map(quiz => (
          <div
            key={quiz.id}
            className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-red-700/50 cursor-pointer transition-all flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400 rounded-md shrink-0 mt-0.5">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {quiz.title}
                </h3>
                <div className="flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                  <span>Time Limit: {quiz.timeLimitMinutes} mins</span>
                  <span>•</span>
                  <span>{quiz.questions.length} Questions</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleStartQuiz(quiz)}
              className="px-4 py-2 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Take Quiz</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
