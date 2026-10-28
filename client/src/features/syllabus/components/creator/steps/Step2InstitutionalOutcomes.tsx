import React, { useState } from 'react';
import type { OfficialSyllabusData, CourseOutcome, ProgramOutcome } from '../../../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';
import { Landmark, Award, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

interface Step2InstitutionalOutcomesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step2InstitutionalOutcomes: React.FC<Step2InstitutionalOutcomesProps> = ({ data, onChange }) => {
  const [showInstitutional, setShowInstitutional] = useState(false);
  const { institutionalStatements, programOutcomes = [], courseOutcomes = [] } = data;

  const restoreBaseline = () => {
    onChange({
      ...data,
      institutionalStatements: {
        ...OFFICIAL_SYLLABUS_CSPC112.institutionalStatements
      },
      programOutcomes: [
        ...OFFICIAL_SYLLABUS_CSPC112.programOutcomes
      ]
    });
  };

  const addCourseOutcome = () => {
    const nextNumber = courseOutcomes.length > 0 ? Math.max(...courseOutcomes.map(c => c.number)) + 1 : 1;
    const newOutcome: CourseOutcome = {
      number: nextNumber,
      statement: 'New course outcome statement describing measurable competency.'
    };
    onChange({
      ...data,
      courseOutcomes: [...courseOutcomes, newOutcome],
      // Ensure course map also gets the new row
      courseMap: [
        ...(data.courseMap || []),
        {
          coNumber: nextNumber,
          coStatement: newOutcome.statement,
          poAlignments: {}
        }
      ]
    });
  };

  const updateCourseOutcome = (number: number, statement: string) => {
    const updated = courseOutcomes.map(co => co.number === number ? { ...co, statement } : co);
    const updatedMap = (data.courseMap || []).map(cm => cm.coNumber === number ? { ...cm, coStatement: statement } : cm);
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  const removeCourseOutcome = (number: number) => {
    const updated = courseOutcomes.filter(co => co.number !== number);
    const updatedMap = (data.courseMap || []).filter(cm => cm.coNumber !== number);
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Institutional Statements & Course Outcomes</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Review university institutional PVMGO and articulate your course outcomes (COs) aligned to program outcomes (POs).
          </p>
        </div>
      </div>

      {/* Collapsible University PVMGO Section */}
      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInstitutional(!showInstitutional)}
          className="w-full flex items-center justify-between p-4 text-left font-semibold text-xs text-foreground hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Landmark className="w-4 h-4 text-primary" />
            <span>Institutional Framework (Philosophy, Vision, Mission, Goal, Core Values)</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <span className="text-[11px] font-normal">Pre-filled with DMMMSU Baseline</span>
            {showInstitutional ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {showInstitutional && (
          <div className="p-4 pt-0 border-t border-border/50 space-y-3 text-xs">
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={restoreBaseline}
                className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore University Baseline</span>
              </button>
            </div>
            <div>
              <span className="font-bold text-foreground">Philosophy: </span>
              <span className="text-muted-foreground">{institutionalStatements?.philosophy}</span>
            </div>
            <div>
              <span className="font-bold text-foreground">Vision: </span>
              <span className="text-muted-foreground">{institutionalStatements?.vision}</span>
            </div>
            <div>
              <span className="font-bold text-foreground">Mission: </span>
              <span className="text-muted-foreground">{institutionalStatements?.mission}</span>
            </div>
            <div>
              <span className="font-bold text-foreground">Goal: </span>
              <span className="text-muted-foreground">{institutionalStatements?.goal}</span>
            </div>
          </div>
        )}
      </div>

      {/* Course Outcomes (CO) Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Course Outcomes (CO)</h3>
            <p className="text-xs text-muted-foreground">
              Measurable statements of what students should be able to do by the end of the course.
            </p>
          </div>
          <button
            type="button"
            onClick={addCourseOutcome}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course Outcome</span>
          </button>
        </div>

        <div className="space-y-3">
          {courseOutcomes.map(co => (
            <div
              key={co.number}
              className="flex items-start space-x-3 p-3.5 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex-shrink-0 mt-0.5">
                CO{co.number}
              </span>
              <div className="flex-1">
                <textarea
                  rows={2}
                  value={co.statement}
                  onChange={e => updateCourseOutcome(co.number, e.target.value)}
                  placeholder={`Describe Course Outcome ${co.number}...`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
                />
              </div>
              {courseOutcomes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCourseOutcome(co.number)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  title="Remove Course Outcome"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Program Outcomes (PO) Overview */}
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-bold text-foreground">Program Outcomes (PO1 – PO11)</h3>
        <p className="text-xs text-muted-foreground">
          Institutional program outcomes for Bachelor of Science in Computer Science (BSCS). These will be mapped against your Course Outcomes in Step 5.
        </p>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-3 space-y-2 bg-muted/20 text-xs text-muted-foreground">
          {programOutcomes.map(po => (
            <div key={po.number} className="flex space-x-2">
              <span className="font-bold text-foreground flex-shrink-0">PO{po.number}:</span>
              <span>{po.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
