import React from 'react';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import { Printer } from 'lucide-react';

interface SyllabusDocumentPreviewProps {
  syllabus: OfficialSyllabusData;
  onPrint?: () => void;
  className?: string;
}

export const SyllabusDocumentPreview: React.FC<SyllabusDocumentPreviewProps> = ({
  syllabus,
  onPrint,
  className = ''
}) => {
  const {
    institution,
    courseInfo,
    facultyMembers = [],
    institutionalStatements,
    programOutcomes = [],
    courseOutcomes = [],
    courseRequirements,
    gradingSystem,
    classroomPolicies = [],
    courseOutline = [],
    learningPlan = [],
    courseMap = [],
    references = [],
    signatories
  } = syllabus;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const primaryFaculty = facultyMembers[0];
  const primarySection = primaryFaculty?.sections?.[0];

  return (
    <div className={`relative bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col ${className}`}>
      {/* Document Action Toolbar (hidden during print) */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-muted/60 border-b border-border/80 print:hidden">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Official Document Preview
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {institution.formCode || 'DMMMSU-INS-F003'}
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Official Syllabus Paper Container */}
      <div className="p-6 md:p-10 overflow-y-auto max-h-[85vh] print:max-h-none print:overflow-visible print:p-0 bg-white text-slate-900 font-serif leading-relaxed text-[12px] print:text-[11px]">
        {/* Institutional Header */}
        <div className="text-center pb-4 mb-4 border-b-2 border-slate-900">
          <div className="flex items-center justify-between text-[10px] text-slate-600 font-sans mb-1">
            <span>{institution.formCode || 'DMMMSU-INS-F003'}</span>
            <span>{institution.revision || 'REV. 02 (06.23.2025)'}</span>
          </div>
          <h1 className="text-base font-bold uppercase tracking-wide text-slate-900">
            {institution.university || 'Don Mariano Marcos Memorial State University'}
          </h1>
          <h2 className="text-sm font-semibold text-slate-800">
            {institution.college || 'College of Computer Science'}
          </h2>
          <div className="mt-2 text-xs font-bold tracking-wider uppercase text-slate-900">
            Course Syllabus
          </div>
          <div className="text-[11px] text-slate-700 italic">
            {courseInfo.semester || 'First Semester'}, Academic Year {courseInfo.academicYear || '2026-2027'}
          </div>
        </div>

        {/* Basic Course Identification Table */}
        <table className="w-full border-collapse border border-slate-900 mb-6 text-left">
          <tbody>
            <tr className="border-b border-slate-900">
              <td className="w-1/4 p-2 font-bold bg-slate-100 border-r border-slate-900">
                Course No. & Descriptive Title:
              </td>
              <td className="p-2 font-bold border-r border-slate-900">
                {courseInfo.code} – {courseInfo.title}
              </td>
              <td className="w-1/5 p-2 font-bold bg-slate-100 border-r border-slate-900">
                Schedule & Room Assignment:
              </td>
              <td className="p-2">
                {primarySection
                  ? `${primarySection.section ? `${primarySection.section} | ` : ''}${primarySection.schedule || 'TBA'} (${primarySection.room || 'TBA'})`
                  : 'TBA'}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-bold bg-slate-100 border-r border-slate-900">
                Name of Faculty Member/s:
              </td>
              <td colSpan={3} className="p-2">
                {facultyMembers.length > 0
                  ? facultyMembers.map(f => f.name).filter(Boolean).join(', ')
                  : 'Faculty Member'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Part I: Institutional Statements, Outcomes, and Policies */}
        <div className="mb-6">
          <h3 className="font-bold text-xs uppercase mb-2 bg-slate-200 p-1.5 border border-slate-900">
            Part I: Institutional Statements & Course Information
          </h3>
          <table className="w-full border-collapse border border-slate-900 text-left">
            <tbody>
              <tr className="border-b border-slate-900">
                <td className="w-1/4 p-2 font-bold bg-slate-50 border-r border-slate-900">Philosophy</td>
                <td className="p-2">{institutionalStatements?.philosophy || 'Total human development'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Vision</td>
                <td className="p-2">{institutionalStatements?.vision || 'A Premier University of the North by 2030'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Mission</td>
                <td className="p-2">{institutionalStatements?.mission || 'Develop human capital for nation building'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Goal</td>
                <td className="p-2">{institutionalStatements?.goal || 'To lead in transforming human resources into productive citizens.'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Graduate Attributes</td>
                <td className="p-2 space-y-1">
                  {(institutionalStatements?.graduateAttributes || []).map((ga, idx) => (
                    <div key={idx}>
                      <span className="font-bold">{ga.title}:</span> {ga.description}
                    </div>
                  ))}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Core Values</td>
                <td className="p-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {(institutionalStatements?.coreValues || []).map((cv, idx) => (
                      <div key={idx}>
                        <span className="font-bold">{cv.keyword || cv.acronym}:</span> {cv.description}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Program Outcomes</td>
                <td className="p-2">
                  <ol className="list-decimal list-inside space-y-1">
                    {(programOutcomes || []).map((po, idx) => (
                      <li key={idx} className="pl-1">
                        <span className="font-semibold">PO{po.number}:</span> {po.description}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Type</td>
                <td className="p-2">{courseInfo.type || 'Lecture and Laboratory'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Credit</td>
                <td className="p-2">{courseInfo.credit || '3 units'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Description</td>
                <td className="p-2 leading-relaxed">{courseInfo.description}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Contact Hours/Week</td>
                <td className="p-2">
                  {[
                    courseInfo.lectureHours && `Lecture – ${courseInfo.lectureHours}`,
                    courseInfo.labHours && `Laboratory – ${courseInfo.labHours}`
                  ].filter(Boolean).join(' | ') || '3 hours/week'}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Prerequisite/s</td>
                <td className="p-2">{courseInfo.prerequisite || 'None'}</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Outcomes (CO)</td>
                <td className="p-2">
                  <div className="font-semibold mb-1">By the end of the course, students should be able to:</div>
                  <ol className="list-decimal list-inside space-y-1">
                    {(courseOutcomes || []).map((co, idx) => (
                      <li key={idx}>
                        <span className="font-bold">CO{co.number}:</span> {co.statement}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Course Requirements</td>
                <td className="p-2">
                  <ul className="list-disc list-inside space-y-0.5">
                    {(courseRequirements?.major || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                    {(courseRequirements?.other || []).map((item, idx) => (
                      <li key={`oth-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Grading System</td>
                <td className="p-2 space-y-1">
                  <div><span className="font-bold">Term Grade Formula:</span> {gradingSystem?.termFormula}</div>
                  <div><span className="font-bold">Final Grade Formula:</span> {gradingSystem?.finalFormula}</div>
                  <div><span className="font-bold">Passing Grade:</span> {gradingSystem?.passingGrade || '75% (3.00)'}</div>
                  {gradingSystem?.classStandingComponents && gradingSystem.classStandingComponents.length > 0 && (
                    <div className="mt-1">
                      <span className="font-bold">Class Standing Breakdown:</span>
                      <ul className="list-disc list-inside ml-2">
                        {gradingSystem.classStandingComponents.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Classroom Policies</td>
                <td className="p-2">
                  <ul className="list-disc list-inside space-y-1">
                    {(classroomPolicies || []).map((policy, idx) => (
                      <li key={idx}>{policy}</li>
                    ))}
                  </ul>
                </td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-900">Consultation Hours</td>
                <td className="p-2">{primaryFaculty?.consultation || 'MWF 01:00 PM - 03:00 PM'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Part II: Course Outline and Time Frame */}
        <div className="mb-6">
          <h3 className="font-bold text-xs uppercase mb-2 bg-slate-200 p-1.5 border border-slate-900">
            Part II: Course Outline and Time Frame
          </h3>
          <table className="w-full border-collapse border border-slate-900 text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900">
                <th className="w-1/4 p-2 font-bold border-r border-slate-900">Time Frame</th>
                <th className="p-2 font-bold">Course Content / Subject Matter</th>
              </tr>
            </thead>
            <tbody>
              {(courseOutline || []).map((row, idx) => (
                <tr key={idx} className="border-b border-slate-900">
                  <td className="p-2 font-bold align-top border-r border-slate-900">{row.timeFrame}</td>
                  <td className="p-2">
                    <div className="font-bold mb-1">{row.title}</div>
                    {row.topics && row.topics.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-800">
                        {row.topics.map((t, tIdx) => (
                          <li key={tIdx}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Part III: Learning Plan */}
        <div className="mb-6">
          <h3 className="font-bold text-xs uppercase mb-2 bg-slate-200 p-1.5 border border-slate-900">
            Part III: Learning Plan
          </h3>
          <table className="w-full border-collapse border border-slate-900 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 text-center font-bold">
                <th className="p-1.5 border-r border-slate-900 w-[18%]">Learning Outcomes</th>
                <th className="p-1.5 border-r border-slate-900 w-[18%]">Topics</th>
                <th className="p-1.5 border-r border-slate-900 w-[16%]">SDG Coherence</th>
                <th className="p-1.5 border-r border-slate-900 w-[10%]">Time Allotment</th>
                <th className="p-1.5 border-r border-slate-900 w-[14%]">Methodology</th>
                <th className="p-1.5 border-r border-slate-900 w-[12%]">Resources</th>
                <th className="p-1.5 w-[12%]">Assessment Tasks</th>
              </tr>
            </thead>
            <tbody>
              {(learningPlan || []).map((plan, idx) => (
                <tr key={idx} className="border-b border-slate-900 align-top">
                  <td className="p-1.5 border-r border-slate-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {(plan.learningOutcomes || []).map((lo, lIdx) => (
                        <li key={lIdx}>{lo}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5 border-r border-slate-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {(plan.topics || []).map((tp, tIdx) => (
                        <li key={tIdx}>{tp}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5 border-r border-slate-900">
                    {plan.sdgCoherence ? (
                      <div>
                        <div className="font-bold text-slate-900">{plan.sdgCoherence.goal}: {plan.sdgCoherence.title}</div>
                        <div className="text-[10px] text-slate-700 mt-0.5">{plan.sdgCoherence.description}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None specified</span>
                    )}
                  </td>
                  <td className="p-1.5 border-r border-slate-900 text-center">
                    <div className="font-bold">{plan.week}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {[plan.hoursLec ? `${plan.hoursLec}h Lec` : '', plan.hoursLab ? `${plan.hoursLab}h Lab` : ''].filter(Boolean).join(' / ') || '3h'}
                    </div>
                  </td>
                  <td className="p-1.5 border-r border-slate-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {(plan.methodology || []).map((m, mIdx) => (
                        <li key={mIdx}>{m}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5 border-r border-slate-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {(plan.resources || []).map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5">
                    <ul className="list-disc list-inside space-y-0.5">
                      {(plan.assessment || []).map((a, aIdx) => (
                        <li key={aIdx}>{a}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Part IV: Course Map */}
        <div className="mb-6">
          <h3 className="font-bold text-xs uppercase mb-2 bg-slate-200 p-1.5 border border-slate-900">
            Part IV: Course Map
          </h3>
          <div className="text-[11px] mb-1 italic text-slate-700">
            Legend: <span className="font-bold">I</span> – Introduced, <span className="font-bold">P</span> – Practiced, <span className="font-bold">D</span> – Demonstrated
          </div>
          <table className="w-full border-collapse border border-slate-900 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900">
                <th className="p-2 border-r border-slate-900 w-1/3">Course Outcomes (CO)</th>
                {(programOutcomes && programOutcomes.length > 0 ? programOutcomes : Array.from({ length: 11 }, (_, i) => ({ number: i + 1 }))).map(po => (
                  <th key={po.number} className="p-1.5 text-center border-r border-slate-900 font-bold w-12">
                    PO{po.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(courseMap || []).map((row, idx) => (
                <tr key={idx} className="border-b border-slate-900">
                  <td className="p-2 border-r border-slate-900">
                    <span className="font-bold">CO{row.coNumber}:</span> {row.coStatement}
                  </td>
                  {(programOutcomes && programOutcomes.length > 0 ? programOutcomes : Array.from({ length: 11 }, (_, i) => ({ number: i + 1 }))).map(po => {
                    const alignment = row.poAlignments?.[po.number] || '';
                    return (
                      <td key={po.number} className="p-1.5 text-center font-bold border-r border-slate-900">
                        {alignment || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Part V: References */}
        <div className="mb-6">
          <h3 className="font-bold text-xs uppercase mb-2 bg-slate-200 p-1.5 border border-slate-900">
            Part V: References
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-800">
            {(references || []).map((ref, idx) => (
              <li key={idx} className="pl-1">
                {ref.citation} {ref.year ? `(${ref.year}).` : ''} {ref.doiOrPublisher}
              </li>
            ))}
          </ol>
        </div>

        {/* Signatories Block */}
        <div className="mt-8 pt-4 border-t-2 border-slate-900">
          <table className="w-full border-collapse border border-slate-900 text-center">
            <tbody>
              <tr>
                <td className="w-1/3 p-4 border-r border-slate-900 align-top">
                  <div className="text-[10px] uppercase font-bold text-slate-600 mb-6">Prepared by:</div>
                  <div className="font-bold uppercase tracking-wide">
                    {signatories?.preparedBy?.[0]?.name || primaryFaculty?.name || 'Faculty Member'}
                  </div>
                  <div className="text-[10px] text-slate-700">
                    {signatories?.preparedBy?.[0]?.title || 'Faculty Member'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">Date: _______________</div>
                </td>
                <td className="w-1/3 p-4 border-r border-slate-900 align-top">
                  <div className="text-[10px] uppercase font-bold text-slate-600 mb-6">Recommending Approval:</div>
                  <div className="font-bold uppercase tracking-wide">
                    {signatories?.recommendingApproval?.name || 'Program Chairperson'}
                  </div>
                  <div className="text-[10px] text-slate-700">
                    {signatories?.recommendingApproval?.title || 'Program Chairperson'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">Date: _______________</div>
                </td>
                <td className="w-1/3 p-4 align-top">
                  <div className="text-[10px] uppercase font-bold text-slate-600 mb-6">Approved:</div>
                  <div className="font-bold uppercase tracking-wide">
                    {signatories?.approved?.name || 'Dean / Institute Director'}
                  </div>
                  <div className="text-[10px] text-slate-700">
                    {signatories?.approved?.title || 'Dean / Institute Director'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">Date: _______________</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
