import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { ShieldCheck, Plus, Trash2, BookOpen } from 'lucide-react';

interface Step6GradingPoliciesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step6GradingPolicies: React.FC<Step6GradingPoliciesProps> = ({ data, onChange }) => {
  const { gradingSystem, classroomPolicies = [], references = [] } = data;

  const updateGrading = (field: keyof typeof gradingSystem, value: any) => {
    onChange({
      ...data,
      gradingSystem: {
        ...gradingSystem,
        [field]: value
      }
    });
  };

  const updateComponents = (text: string) => {
    const list = text.split('\n').filter(Boolean);
    updateGrading('classStandingComponents', list);
  };

  const updatePolicies = (text: string) => {
    const list = text.split('\n').filter(Boolean);
    onChange({
      ...data,
      classroomPolicies: list
    });
  };

  const addReference = () => {
    const newRef = {
      citation: 'Author, A. A. Title of Work. Publisher.',
      year: new Date().getFullYear().toString(),
      doiOrPublisher: 'Academic Press'
    };
    onChange({
      ...data,
      references: [...references, newRef]
    });
  };

  const updateReference = (index: number, field: 'citation' | 'year' | 'doiOrPublisher', value: string) => {
    const updated = references.map((r, i) => i === index ? { ...r, [field]: value } : r);
    onChange({
      ...data,
      references: updated
    });
  };

  const removeReference = (index: number) => {
    const updated = references.filter((_, i) => i !== index);
    onChange({
      ...data,
      references: updated
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span>Grading System, Classroom Policies & References</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Specify evaluation grading formulas, class standing weight components, student discipline policies, and Part V academic references.
        </p>
      </div>

      {/* Grading System Formulas */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">Institutional Grading Formula</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="term-formula" className="text-xs font-semibold text-foreground">
              Term Formula (Midterm & Final Term)
            </label>
            <input
              id="term-formula"
              type="text"
              value={gradingSystem?.termFormula || ''}
              onChange={e => updateGrading('termFormula', e.target.value)}
              placeholder="e.g. Midterm Grade/Final Term Grade = 60% Class Standing + 40% ME/FE"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="final-formula" className="text-xs font-semibold text-foreground">
              Final Grade Formula
            </label>
            <input
              id="final-formula"
              type="text"
              value={gradingSystem?.finalFormula || ''}
              onChange={e => updateGrading('finalFormula', e.target.value)}
              placeholder="e.g. Final Grade = 40% Midterm Grade + 60% Final Term Grade"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passing-grade" className="text-xs font-semibold text-foreground">
              Passing Grade
            </label>
            <input
              id="passing-grade"
              type="text"
              value={gradingSystem?.passingGrade || ''}
              onChange={e => updateGrading('passingGrade', e.target.value)}
              placeholder="e.g. 75% (3.00)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Class Standing Breakdown (one item per line)
            </label>
            <textarea
              rows={3}
              value={(gradingSystem?.classStandingComponents || []).join('\n')}
              onChange={e => updateComponents(e.target.value)}
              placeholder="Quizzes: 30%&#10;Seatwork & Assignments: 20%&#10;Projects: 30%&#10;Recitation: 20%"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Classroom Policies */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">Classroom Code & Policies</h3>
        <p className="text-xs text-muted-foreground">
          Enter attendance requirements, academic integrity guidelines, and submission policies (one per line).
        </p>
        <textarea
          rows={4}
          value={classroomPolicies.join('\n')}
          onChange={e => updatePolicies(e.target.value)}
          placeholder="Class attendance and punctuality must be observed...&#10;Academic integrity is strictly enforced...&#10;Late assignments will incur standard penalties..."
          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none leading-relaxed"
        />
      </div>

      {/* Part V References */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Part V: References (APA Format)</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Textbooks, journals, and official academic reference materials.
            </p>
          </div>
          <button
            type="button"
            onClick={addReference}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Reference</span>
          </button>
        </div>

        <div className="space-y-3">
          {references.map((ref, idx) => (
            <div key={idx} className="flex items-start space-x-3 p-3 rounded-xl border border-border bg-muted/20">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={ref.citation}
                  onChange={e => updateReference(idx, 'citation', e.target.value)}
                  placeholder="Author, Title of Book or Article..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={ref.year}
                    onChange={e => updateReference(idx, 'year', e.target.value)}
                    placeholder="Year (e.g. 2024)"
                    className="w-28 px-2.5 py-1 text-xs rounded-lg border border-border bg-background"
                  />
                  <input
                    type="text"
                    value={ref.doiOrPublisher || ''}
                    onChange={e => updateReference(idx, 'doiOrPublisher', e.target.value)}
                    placeholder="Publisher or DOI..."
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              </div>
              {references.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeReference(idx)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer mt-1"
                  title="Remove reference"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
