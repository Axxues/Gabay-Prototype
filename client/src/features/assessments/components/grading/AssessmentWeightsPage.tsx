import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLMS } from '../../../../shared/context/LMSContext';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  ChevronRight,
  Calculator,
  Layers,
  BookOpen,
  HelpCircle,
  FileText,
  Briefcase,
  MonitorPlay
} from 'lucide-react';
import {
  DEFAULT_ASSESSMENT_CATEGORIES,
  DEFAULT_CATEGORY_WEIGHTS,
  getStoredCategoryWeights,
  saveStoredCategoryWeights,
  resolveAssessmentCategory,
} from '../../../../shared/utils/spr';

interface CategoryVisualConfig {
  icon: React.ReactNode;
  color: string;
  bgLight: string;
  borderLight: string;
  description: string;
}

const CATEGORY_CONFIG: Record<string, CategoryVisualConfig> = {
  Activities: {
    icon: <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    color: '#2563eb',
    bgLight: 'bg-blue-500/10',
    borderLight: 'border-blue-500/20',
    description: 'In-class exercises, laboratory experiments, and interactive problem sets.',
  },
  Quizzes: {
    icon: <HelpCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
    color: '#7c3aed',
    bgLight: 'bg-violet-500/10',
    borderLight: 'border-violet-500/20',
    description: 'Knowledge checks, periodic modular quizzes, and timed question sets.',
  },
  Assignments: {
    icon: <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    color: '#d97706',
    bgLight: 'bg-amber-500/10',
    borderLight: 'border-amber-500/20',
    description: 'Homework, analytical problem sets, essays, and take-home case studies.',
  },
  Projects: {
    icon: <Briefcase className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
    color: '#e11d48',
    bgLight: 'bg-rose-500/10',
    borderLight: 'border-rose-500/20',
    description: 'Comprehensive term projects, software repositories, and capstone deliverables.',
  },
  Presentations: {
    icon: <MonitorPlay className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: '#059669',
    bgLight: 'bg-emerald-500/10',
    borderLight: 'border-emerald-500/20',
    description: 'Oral defenses, seminar talks, laboratory demonstrations, and project pitches.',
  },
};

export const AssessmentWeightsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { db, showAlert, updateCourse } = useLMS();

  const course = useMemo(
    () => (courseId ? db.courses.find(c => c.id === courseId) : undefined),
    [db.courses, courseId]
  );

  // Count published assessments per category in this course for pedagogical context
  const publishedCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Activities: 0,
      Quizzes: 0,
      Assignments: 0,
      Projects: 0,
      Presentations: 0,
    };
    if (!courseId) return counts;

    (db.quizzes || [])
      .filter(q => q.courseId === courseId && q.published)
      .forEach(() => {
        counts.Quizzes += 1;
      });

    (db.activities || [])
      .filter(a => a.courseId === courseId && a.published)
      .forEach(a => {
        const cat = resolveAssessmentCategory({
          assessmentType: a.assessmentType,
          category: a.category,
        });
        counts[cat] = (counts[cat] || 0) + 1;
      });

    return counts;
  }, [courseId, db.activities, db.quizzes]);

  // State for category weights as string drafts
  const [categoryWeights, setCategoryWeights] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with stored weights or default weights (20% each)
  useEffect(() => {
    if (courseId && course) {
      const storedWeights = (course.assessmentCategoryWeights || getStoredCategoryWeights(courseId)) as Record<string, number> | undefined;

      const initialWeights: Record<string, string> = {};
      DEFAULT_ASSESSMENT_CATEGORIES.forEach(cat => {
        const storedWeight = storedWeights?.[cat];
        initialWeights[cat] = storedWeight !== undefined ? String(storedWeight) : String(DEFAULT_CATEGORY_WEIGHTS[cat] ?? 20);
      });

      setCategoryWeights(initialWeights);
    }
  }, [courseId, course]);

  // Numeric weights map
  const numericWeights = useMemo(() => {
    const map: Record<string, number> = {};
    DEFAULT_ASSESSMENT_CATEGORIES.forEach(cat => {
      map[cat] = parseFloat(categoryWeights[cat] || '0') || 0;
    });
    return map;
  }, [categoryWeights]);

  // Calculate total percentage
  const total = useMemo(() => {
    return DEFAULT_ASSESSMENT_CATEGORIES.reduce((sum, cat) => sum + (numericWeights[cat] || 0), 0);
  }, [numericWeights]);

  // Check if total is exactly 100%
  const isValid = Math.abs(total - 100) < 0.001;

  // Handle weight change
  const handleWeightChange = (category: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;

    setCategoryWeights(prev => ({
      ...prev,
      [category]: finalValue,
    }));
    setError(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid) {
      setError(`Total weight must equal exactly 100% (currently ${total.toFixed(1)}%).`);
      return;
    }

    if (!course) {
      showAlert({ title: 'Error', message: 'Course not found.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const weightsToSave: Record<string, number> = {};
      DEFAULT_ASSESSMENT_CATEGORIES.forEach(cat => {
        weightsToSave[cat] = numericWeights[cat] || 0;
      });

      saveStoredCategoryWeights(course.id, weightsToSave);

      if (updateCourse) {
        await updateCourse(course.id, {
          assessmentCategoryWeights: weightsToSave,
        });
      }

      showAlert({
        title: 'Weights Configured',
        message: 'Assessment category weights saved successfully. The gradebook will now calculate class standing using these weights.',
        type: 'success',
      });

      navigate(`/courses/${courseId}/gradebook`);
    } catch {
      showAlert({
        title: 'Error',
        message: 'Failed to save assessment weights.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/courses/${courseId}/gradebook`);
  };

  if (!course) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-base font-semibold text-foreground mb-1">Course Not Found</h2>
        <p className="text-xs text-muted-foreground mb-4">The course you are attempting to configure does not exist.</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Return to Courses
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-background p-4 sm:p-6 lg:p-8 animate-fade-in" data-testid="assessment-weights-page">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb Navigation & Page Header */}
        <div className="space-y-3 pb-5 border-b border-border">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="hover:text-foreground transition-colors"
            >
              Courses
            </button>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/modules`)}
              className="hover:text-foreground transition-colors font-medium"
            >
              {course.code}
            </button>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
            <button
              type="button"
              onClick={handleCancel}
              className="hover:text-foreground transition-colors"
            >
              Gradebook
            </button>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">Assessment Weights</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                data-testid="weights-back-btn"
                className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs"
                title="Return to Gradebook"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Assessment Weights
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {course.code} &bull; {course.title} ({course.section})
                </p>
              </div>
            </div>

            {/* Live Status Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tabular-nums shadow-2xs ${
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-destructive/10 text-destructive border-destructive/30'
                }`}
              >
                {isValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Balanced (100.0%)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>
                      {total > 100
                        ? `Over by ${(total - 100).toFixed(1)}%`
                        : `Remaining: ${(100 - total).toFixed(1)}%`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Allocation Strip & Legend */}
        <section className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Class Standing Weight Distribution</h2>
              <p className="text-muted-foreground mt-0.5">
                Real-time visual proportion across categories within the 40% Class Standing component.
              </p>
            </div>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-xs text-muted-foreground font-medium">Total:</span>
              <span
                data-testid="weights-total-value"
                className={`text-lg font-bold tabular-nums ${
                  isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                }`}
              >
                {total.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="relative w-full h-3.5 bg-muted rounded-full overflow-hidden flex shadow-inner">
            {DEFAULT_ASSESSMENT_CATEGORIES.map(category => {
              const weight = numericWeights[category] || 0;
              if (weight <= 0) return null;
              // Cap visual percentage proportionally if total > 100 so it doesn't break layout
              const visualWidth = total > 0 ? (weight / Math.max(100, total)) * 100 : 0;
              const config = CATEGORY_CONFIG[category];

              return (
                <div
                  key={category}
                  style={{
                    width: `${visualWidth}%`,
                    backgroundColor: config.color,
                  }}
                  className="h-full transition-all duration-300 relative group"
                  title={`${category}: ${weight.toFixed(1)}%`}
                />
              );
            })}
          </div>

          {/* Bar Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
            {DEFAULT_ASSESSMENT_CATEGORIES.map(category => {
              const config = CATEGORY_CONFIG[category];
              const weight = numericWeights[category] || 0;
              return (
                <div key={category} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="font-medium text-foreground">{category}</span>
                  <span className="tabular-nums text-muted-foreground">({weight.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Validation Alert Banner (if invalid) */}
        {error && (
          <div
            className="flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium"
            data-testid="weights-error-banner"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Category Configuration Form (8 Columns) */}
          <div className="lg:col-span-8 bg-card rounded-xl border border-border shadow-2xs divide-y divide-border">
            {DEFAULT_ASSESSMENT_CATEGORIES.map(category => {
              const currentVal = categoryWeights[category] || '';
              const numVal = numericWeights[category] || 0;
              const config = CATEGORY_CONFIG[category];
              const count = publishedCounts[category] || 0;
              const isCategoryValid = !isNaN(numVal) && numVal >= 0 && numVal <= 100;

              return (
                <div
                  key={category}
                  className="p-4 sm:p-5 hover:bg-muted/30 transition-colors space-y-3"
                  data-testid={`category-row-${category.toLowerCase()}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bgLight} shrink-0 mt-0.5`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{category}</span>
                          <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                            {count === 1 ? '1 published item' : `${count} published items`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-md leading-relaxed">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    {/* Numeric Input */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currentVal}
                          onChange={(e) => handleWeightChange(category, e.target.value)}
                          placeholder="20"
                          data-testid={`category-input-${category.toLowerCase()}`}
                          className={`w-24 px-3 py-2 pr-7 text-sm font-bold text-center rounded-lg border ${
                            isCategoryValid
                              ? 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'
                              : 'border-destructive focus:ring-2 focus:ring-destructive/20 focus:border-destructive'
                          } bg-background text-foreground outline-none transition-all shadow-2xs`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Control: Synchronized Slider */}
                  <div className="pt-1 flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={numVal}
                      onChange={(e) => handleWeightChange(category, e.target.value)}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-[11px] tabular-nums font-semibold text-muted-foreground w-10 text-right">
                      {numVal}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Academic Grading Context Sidebar (4 Columns) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Calculator className="w-4 h-4 text-primary" />
                <span>Grading Framework</span>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Class Standing constitutes <strong>40%</strong> of the student&apos;s term grade, while the Major Exam contributes <strong>60%</strong>.
                </p>

                <div className="p-3 rounded-lg bg-muted/50 border border-border/60 space-y-2">
                  <div className="font-semibold text-foreground text-xs">Term Grade Formula</div>
                  <div className="font-mono text-[11px] text-foreground bg-background p-2 rounded border border-border/80">
                    40% (Class Standing) + 60% (Exam)
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-foreground text-xs block">Proportional Scaling</span>
                  <p className="text-[11px]">
                    If a category has no published assessments yet, active categories scale proportionally to 100% so students are never penalized for unassigned categories.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span>Validation Rule</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CHED OBE grading rules require category distributions to sum to exactly <strong>100%</strong>. The configuration can only be saved when the sum is completely balanced.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            {isValid
              ? 'Weights are fully balanced and ready to commit.'
              : `Adjust category percentages so the total equals 100.0% (currently ${total.toFixed(1)}%).`}
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCancel}
              data-testid="weights-cancel-btn"
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-all cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isValid}
              data-testid="weights-save-btn"
              title={!isValid ? 'Sum must equal exactly 100% before saving' : 'Save assessment category weights'}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
