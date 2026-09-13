import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { QuizQuestion, QuizItemType } from '../types/lms';
import {
  ArrowLeft,
  ListChecks,
  Trash2,
  Check,
  AlignJustify,
  PenTool,
  ToggleLeft,
  Copy,
  GripVertical,
  X,
  PlusCircle,
  CheckCircle2,
  Calendar,
  CircleDot,
  Type,
  ChevronDown
} from 'lucide-react';

interface CreateActivityPageProps {
  courseId: string;
  onBack: () => void;
  onActivityCreated: (id: string) => void;
}

interface QuestionDraft {
  id: string;
  text: string;
  type: QuizItemType;
  options: string[];
  correctAnswer: string;
  points: number;
}

interface QuestionTypeOption {
  value: QuizItemType;
  label: string;
  icon: React.ElementType;
}

const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    icon: CircleDot,
  },
  {
    value: 'identification',
    label: 'Short Answer / Identification',
    icon: Type,
  },
  {
    value: 'true_false',
    label: 'True / False',
    icon: ToggleLeft,
  },
  {
    value: 'essay',
    label: 'Paragraph / Essay',
    icon: AlignJustify,
  },
];

const GRADABLE: QuizItemType[] = ['multiple_choice', 'identification', 'true_false', 'essay'];

export const CreateActivityPage: React.FC<CreateActivityPageProps> = ({
  courseId,
  onBack,
  onActivityCreated
}) => {
  const { db, createActivity, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    d.setHours(23, 59, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [openTypeDropdownIndex, setOpenTypeDropdownIndex] = useState<number | null>(null);

  const [items, setItems] = useState<QuestionDraft[]>([
    {
      id: `item-${Date.now()}-1`,
      text: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      points: 5
    }
  ]);

  const handleAddItem = (type: QuizItemType, insertAfterIndex?: number) => {
    const newId = `item-${Date.now()}-${items.length + 1}`;
    let newItem: QuestionDraft;

    if (type === 'true_false') {
      newItem = { id: newId, text: '', type, options: ['True', 'False'], correctAnswer: 'True', points: 5 };
    } else if (type === 'identification') {
      newItem = { id: newId, text: '', type, options: [], correctAnswer: '', points: 5 };
    } else if (type === 'essay') {
      newItem = { id: newId, text: '', type, options: [], correctAnswer: '', points: 10 };
    } else {
      newItem = { id: newId, text: '', type: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 'A', points: 5 };
    }

    const targetIndex = insertAfterIndex !== undefined ? insertAfterIndex + 1 : items.length;
    setItems(prev => {
      const next = [...prev];
      next.splice(targetIndex, 0, newItem);
      return next;
    });
    setActiveCardIndex(targetIndex);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showAlert({
        title: 'At Least One Item Required',
        message: 'An activity must contain at least one question.',
        type: 'warning'
      });
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
    setActiveCardIndex(prev => Math.max(0, prev - 1));
  };

  const handleDuplicateItem = (index: number) => {
    const itemToDup = items[index];
    const duplicated: QuestionDraft = {
      ...itemToDup,
      id: `item-${Date.now()}-${items.length + 1}`,
      options: [...itemToDup.options]
    };
    setItems(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
    setActiveCardIndex(index + 1);
  };

  const handleUpdateItem = (index: number, updates: Partial<QuestionDraft>) => {
    setItems(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const handleChangeItemType = (index: number, newType: QuizItemType) => {
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        let points = item.points;
        if (points === 0) {
          points = newType === 'essay' ? 10 : 5;
        }

        let options = item.options;
        if (newType === 'multiple_choice' && options.length === 0) {
          options = ['', '', '', ''];
        } else if (newType === 'true_false') {
          options = ['True', 'False'];
        } else if (newType === 'identification' || newType === 'essay') {
          options = [];
        }

        let correctAnswer = item.correctAnswer;
        if (newType === 'true_false') {
          correctAnswer = 'True';
        } else if (newType === 'multiple_choice' && !correctAnswer) {
          correctAnswer = 'A';
        } else if (newType === 'identification' || newType === 'essay') {
          correctAnswer = newType === 'identification' ? correctAnswer : '';
        }

        return {
          ...item,
          type: newType,
          points,
          options,
          correctAnswer
        };
      })
    );
  };

  const handleUpdateOption = (itemIndex: number, optIndex: number, val: string) => {
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        const newOpts = [...item.options];
        newOpts[optIndex] = val;
        return { ...item, options: newOpts };
      })
    );
  };

  const handleAddOption = (itemIndex: number) => {
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return { ...item, options: [...item.options, ''] };
      })
    );
  };

  const handleRemoveOption = (itemIndex: number, optIndex: number) => {
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        if (item.options.length <= 2) {
          showAlert({
            title: 'Minimum 2 Options',
            message: 'Multiple choice questions must have at least 2 choices.',
            type: 'warning'
          });
          return item;
        }
        const newOpts = item.options.filter((_, oIdx) => oIdx !== optIndex);
        return { ...item, options: newOpts };
      })
    );
  };

  const totalPoints = items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const gradableCount = items.filter(i => GRADABLE.includes(i.type)).length;

  const handleSave = () => {
    if (!title.trim()) {
      showAlert({
        title: 'Title required',
        message: 'Give this activity a title.',
        type: 'warning'
      });
      return;
    }

    if (items.length === 0) {
      showAlert({
        title: 'Questions Required',
        message: 'An activity must contain at least one question.',
        type: 'warning'
      });
      return;
    }

    if (gradableCount === 0) {
      showAlert({
        title: 'Questions Required',
        message: 'Please add at least one gradable question (Multiple Choice, Identification, True/False, or Essay).',
        type: 'warning'
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'multiple_choice') {
        const nonBlank = item.options.map(o => o.trim()).filter(Boolean);
        if (nonBlank.length < 2) {
          showAlert({
            title: `Question ${i + 1} Options Required`,
            message: `Question ${i + 1} requires at least 2 choices.`,
            type: 'warning'
          });
          return;
        }
      }

      if (
        (item.type === 'multiple_choice' ||
          item.type === 'true_false' ||
          item.type === 'identification') &&
        !item.correctAnswer.trim()
      ) {
        showAlert({
          title: `Question ${i + 1} Answer Key Missing`,
          message: `Question ${i + 1} needs an answer key.`,
          type: 'warning'
        });
        return;
      }
    }

    const timestamp = Date.now();
    const compiledQuestions: QuizQuestion[] = items.map((item, idx) => {
      if (item.type === 'true_false') {
        return {
          id: `q-${timestamp}-${idx + 1}`,
          text: item.text.trim(),
          type: 'true_false',
          options: ['True', 'False'],
          correctAnswer: item.correctAnswer === 'False' ? 'False' : 'True',
          points: Number(item.points) || 5
        };
      }

      if (item.type === 'identification') {
        return {
          id: `q-${timestamp}-${idx + 1}`,
          text: item.text.trim(),
          type: 'identification',
          correctAnswer: item.correctAnswer.trim(),
          points: Number(item.points) || 5
        };
      }

      if (item.type === 'essay') {
        return {
          id: `q-${timestamp}-${idx + 1}`,
          text: item.text.trim(),
          type: 'essay',
          points: Number(item.points) || 10
        };
      }

      // multiple_choice
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
      const selectedIndex = letterMap[item.correctAnswer] ?? 0;
      const validOptions = item.options.map(opt => opt.trim()).filter(Boolean);
      const correctAns = validOptions[selectedIndex] || validOptions[0] || 'Choice A';

      return {
        id: `q-${timestamp}-${idx + 1}`,
        text: item.text.trim(),
        type: 'multiple_choice',
        options: validOptions,
        correctAnswer: correctAns,
        points: Number(item.points) || 5
      };
    });

    const created = createActivity({
      courseId,
      title: title.trim(),
      instructions: instructions.trim() || 'Answer all questions carefully.',
      questions: compiledQuestions,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      published: true
    });

    showAlert({
      title: 'Activity Published',
      message: `"${title.trim()}" created with ${gradableCount} question(s), totaling ${totalPoints} pts.`,
      type: 'success'
    });

    onActivityCreated(created.id);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pt-4 sm:pt-6 pb-28 px-2 sm:px-4 font-sans select-none">
      {/* Top Header & Breadcrumb */}
      <div className="pb-4 border-b border-border/80">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Activities</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {course?.code || 'Course'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
              New Question Set
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs border border-emerald-500/20">
                  <ListChecks className="w-5 h-5" />
                </div>
                <span>Create Question-Set Activity</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium pl-0.5">
                Author Multiple Choice, Identification, True/False, and Essay items. Auto-scored on submit; essays go to SpeedGrader.
              </p>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-xs font-bold text-foreground bg-card hover:bg-muted/60 border border-border rounded-xl transition-all shadow-subtle cursor-pointer active:scale-98"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Publish Activity</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout Container (Cards Column + Floating Side Actions) */}
      <div className="relative flex flex-col md:flex-row gap-6 items-start">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
          className="w-full flex-1 space-y-4 text-xs"
        >
          {/* Header Card */}
          <div
            onClick={() => setActiveCardIndex(-1)}
            className={`bg-card rounded-2xl p-6 shadow-subtle space-y-4 transition-all border ${
              activeCardIndex === -1
                ? 'border-l-4 border-l-primary border-t-8 border-t-primary border-r border-b border-border shadow-elevated'
                : 'border-t-8 border-t-primary border-x border-b border-border hover:border-primary/40'
            }`}
          >
            <div>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Untitled Activity"
                className="w-full text-2xl font-black text-foreground bg-transparent border-b border-transparent hover:border-border/60 focus:border-primary outline-none pb-1.5 transition-all placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <textarea
                rows={2}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Activity instructions..."
                className="w-full text-xs text-foreground bg-transparent border-b border-transparent hover:border-border/60 focus:border-border outline-none pb-1 resize-y transition-all placeholder:text-muted-foreground leading-relaxed font-sans"
              />
            </div>

            <div className="pt-3 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-bold text-foreground">Due:</span>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="px-2 py-1 bg-background border border-border rounded-lg text-foreground text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-sans">
                <span className="px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border font-bold">
                  {gradableCount} Qs
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold">
                  {totalPoints} Total Pts
                </span>
              </div>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-4">
            {items.map((item, itemIdx) => {
              const isActive = activeCardIndex === itemIdx;

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveCardIndex(itemIdx)}
                  className={`bg-card rounded-2xl border transition-all p-5 sm:p-6 shadow-subtle space-y-4 cursor-pointer ${
                    isActive
                      ? 'border-l-4 border-l-primary border-y border-r border-border shadow-elevated ring-1 ring-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  {/* Top Row: Question Prompt & Question Type Dropdown */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="hidden sm:flex items-center text-muted-foreground/40 cursor-grab -ml-2">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        value={item.text}
                        onChange={e => handleUpdateItem(itemIdx, { text: e.target.value })}
                        placeholder={`Question ${itemIdx + 1}`}
                        className="w-full px-3 py-2 bg-muted/30 hover:bg-muted/50 focus:bg-background border-b-2 border-transparent focus:border-primary rounded-t-lg text-xs sm:text-sm font-bold text-foreground outline-none transition-all placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="shrink-0 relative">
                      {openTypeDropdownIndex === itemIdx && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={e => {
                            e.stopPropagation();
                            setOpenTypeDropdownIndex(null);
                          }}
                        />
                      )}

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenTypeDropdownIndex(openTypeDropdownIndex === itemIdx ? null : itemIdx);
                        }}
                        className={`w-full sm:w-60 px-3 py-2 bg-card hover:bg-muted/50 border rounded-xl text-xs font-bold text-foreground flex items-center justify-between gap-2 shadow-subtle transition-all cursor-pointer ${
                          openTypeDropdownIndex === itemIdx
                            ? 'border-primary ring-2 ring-primary/20 bg-muted/30'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {(() => {
                            const currentOpt =
                              QUESTION_TYPE_OPTIONS.find(o => o.value === item.type) ||
                              QUESTION_TYPE_OPTIONS[0];
                            const IconComp = currentOpt.icon;
                            return (
                              <>
                                <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
                                  <IconComp className="w-3.5 h-3.5" />
                                </div>
                                <span className="truncate text-xs font-semibold">{currentOpt.label}</span>
                              </>
                            );
                          })()}
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                            openTypeDropdownIndex === itemIdx ? 'rotate-180 text-primary' : ''
                          }`}
                        />
                      </button>

                      {openTypeDropdownIndex === itemIdx && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans">
                            Question Formats
                          </div>
                          <div className="space-y-0.5">
                            {QUESTION_TYPE_OPTIONS.map(opt => {
                              const isSelected = item.type === opt.value;
                              const IconComp = opt.icon;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    handleChangeItemType(itemIdx, opt.value);
                                    setOpenTypeDropdownIndex(null);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                                    isSelected
                                      ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                                      : 'hover:bg-muted/60 text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    <div
                                      className={`p-1.5 rounded-lg shrink-0 ${
                                        isSelected
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      <IconComp className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-semibold truncate">{opt.label}</span>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 1. Multiple Choice Options */}
                  {item.type === 'multiple_choice' && (
                    <div className="space-y-2.5 pt-2 pl-1 sm:pl-4">
                      {item.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = item.correctAnswer === letter;

                        return (
                          <div
                            key={optIdx}
                            className="flex items-center space-x-3 group/opt py-0.5"
                          >
                            <label
                              title="Click to set as correct answer"
                              className="flex items-center space-x-1.5 cursor-pointer shrink-0"
                            >
                              <input
                                type="radio"
                                name={`correct_${item.id}`}
                                checked={isCorrect}
                                onChange={() => handleUpdateItem(itemIdx, { correctAnswer: letter })}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                              />
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isCorrect
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {letter}
                              </span>
                            </label>

                            <div className="flex-1">
                              <input
                                type="text"
                                value={opt}
                                onChange={e => handleUpdateOption(itemIdx, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                                className={`w-full py-1.5 px-2 bg-transparent text-xs text-foreground outline-none border-b transition-colors placeholder:text-muted-foreground ${
                                  isCorrect
                                    ? 'border-emerald-500/50 font-semibold'
                                    : 'border-transparent hover:border-border/80 focus:border-primary'
                                }`}
                              />
                            </div>

                            {item.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(itemIdx, optIdx)}
                                className="p-1 text-muted-foreground/60 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                title="Remove Option"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex items-center space-x-3 pt-1.5">
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 shrink-0 ml-0.5" />
                        <button
                          type="button"
                          onClick={() => handleAddOption(itemIdx)}
                          className="text-xs text-muted-foreground hover:text-primary font-medium hover:underline flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <span>Add option</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Identification (Short Answer) */}
                  {item.type === 'identification' && (
                    <div className="space-y-3 pt-2 pl-1 sm:pl-4">
                      <div className="py-2.5 px-3 bg-muted/20 border-b-2 border-dashed border-border rounded-t-lg max-w-md">
                        <span className="text-xs text-muted-foreground font-sans">
                          Short answer text (Student response placeholder)
                        </span>
                      </div>

                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 max-w-lg">
                        <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Correct Answer Key:</span>
                        </div>
                        <input
                          type="text"
                          required
                          value={item.correctAnswer}
                          onChange={e => handleUpdateItem(itemIdx, { correctAnswer: e.target.value })}
                          placeholder="e.g. Manila"
                          className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Evaluated automatically on student submission (case-insensitive).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 3. True / False */}
                  {item.type === 'true_false' && (
                    <div className="space-y-2.5 pt-2 pl-1 sm:pl-4">
                      {['True', 'False'].map(val => {
                        const isCorrect = item.correctAnswer === val;
                        return (
                          <div
                            key={val}
                            onClick={() => handleUpdateItem(itemIdx, { correctAnswer: val })}
                            className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all cursor-pointer max-w-md ${
                              isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                                : 'bg-background border-border hover:bg-muted text-foreground'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`tf_correct_${item.id}`}
                              checked={isCorrect}
                              onChange={() => handleUpdateItem(itemIdx, { correctAnswer: val })}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            />
                            <span className="font-bold text-xs">{val}</span>
                            {isCorrect && (
                              <span className="ml-auto text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 4. Essay (Paragraph) */}
                  {item.type === 'essay' && (
                    <div className="space-y-3 pt-2 pl-1 sm:pl-4">
                      <div className="py-4 px-3 bg-muted/20 border-b-2 border-dashed border-border rounded-t-lg max-w-lg">
                        <span className="text-xs text-muted-foreground font-sans">
                          Long answer text (Paragraph response area)
                        </span>
                      </div>

                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl max-w-lg">
                        <p className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold">
                          No answer key — essays are graded manually by faculty in SpeedGrader.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-border/70 flex items-center justify-end space-x-3 text-xs">
                    <div className="flex items-center space-x-1.5 bg-muted/40 px-2.5 py-1 rounded-xl border border-border mr-auto">
                      <label className="text-[11px] font-bold text-muted-foreground">Points:</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={item.points}
                        onChange={e =>
                          handleUpdateItem(itemIdx, { points: Math.max(1, Number(e.target.value)) })
                        }
                        className="w-12 px-1 py-0.5 bg-background border border-border rounded-md text-foreground text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(itemIdx)}
                      title="Duplicate Question"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemIdx)}
                        title="Delete Question"
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Form Actions Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer w-full sm:w-auto"
            >
              Discard & Return to Activities
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Publish Activity</span>
              </button>
            </div>
          </div>
        </form>

        {/* Floating Action Sidebar */}
        <div className="sticky top-6 z-10 w-full md:w-14 bg-card border border-border rounded-2xl p-1.5 shadow-elevated flex flex-row md:flex-col items-center justify-around md:justify-start gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleAddItem('multiple_choice', activeCardIndex >= 0 ? activeCardIndex : undefined)}
            className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all cursor-pointer shadow-subtle active:scale-95 group relative"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="pointer-events-none hidden md:group-hover:flex items-center absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-[11px] font-bold rounded-lg whitespace-nowrap shadow-elevated z-50 animate-scale-in">
              Add question
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAddItem('identification', activeCardIndex >= 0 ? activeCardIndex : undefined)}
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-amber-600 transition-all cursor-pointer active:scale-95 group relative"
          >
            <PenTool className="w-5 h-5" />
            <span className="pointer-events-none hidden md:group-hover:flex items-center absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-[11px] font-bold rounded-lg whitespace-nowrap shadow-elevated z-50 animate-scale-in">
              Add identification
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAddItem('true_false', activeCardIndex >= 0 ? activeCardIndex : undefined)}
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-all cursor-pointer active:scale-95 group relative"
          >
            <ToggleLeft className="w-5 h-5" />
            <span className="pointer-events-none hidden md:group-hover:flex items-center absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-[11px] font-bold rounded-lg whitespace-nowrap shadow-elevated z-50 animate-scale-in">
              Add True / False
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAddItem('essay', activeCardIndex >= 0 ? activeCardIndex : undefined)}
            className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-purple-600 transition-all cursor-pointer active:scale-95 group relative"
          >
            <AlignJustify className="w-5 h-5" />
            <span className="pointer-events-none hidden md:group-hover:flex items-center absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-[11px] font-bold rounded-lg whitespace-nowrap shadow-elevated z-50 animate-scale-in">
              Add Essay
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
