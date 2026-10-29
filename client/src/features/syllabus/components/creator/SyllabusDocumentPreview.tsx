import React from 'react';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import { Printer } from 'lucide-react';

interface SyllabusDocumentPreviewProps {
  syllabus?: OfficialSyllabusData;
  data?: OfficialSyllabusData;
  onPrint?: () => void;
  onBack?: () => void;
  className?: string;
}

export const SyllabusDocumentPreview: React.FC<SyllabusDocumentPreviewProps> = ({
  syllabus,
  data,
  onPrint,
  onBack: _onBack,
  className = ''
}) => {
  const activeData = data || syllabus || ({} as OfficialSyllabusData);
  const {
    institution = {
      university: 'Don Mariano Marcos Memorial State University',
      college: 'College of Computer Science',
      formCode: 'DMMMSU-INS-F003',
      revision: 'REV. 02 (06.23.2025)'
    },
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
  } = activeData;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const primaryFaculty = facultyMembers[0];
  const primarySection = primaryFaculty?.sections?.[0];

  const activePOs = programOutcomes && programOutcomes.length > 0
    ? programOutcomes
    : [];

  return (
    <div className={`relative bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col ${className}`}>
      {/* Top action toolbar (strictly hidden during print) */}
      <div className="flex items-center justify-between px-6 py-3 bg-muted/60 border-b border-border print:hidden">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Official Document Preview (DMMMSU Standard)
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {institution.formCode || 'DMMMSU-INS-F003'}
          </span>
          <span className="text-[11px] text-muted-foreground italic">
            Landscape Folio (13" × 8.5")
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Embedded Print Stylesheet for Exact 1-to-1 PDF/Print Fidelity */}
      <style>{`
        @media print {
          @page {
            size: 13in 8.5in;
            margin: 0.5in 0.6in 0.5in 0.6in;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Trebuchet MS', Arial, sans-serif !important;
            font-size: 10pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > * {
            visibility: hidden !important;
          }
          #official-syllabus-document,
          #official-syllabus-document * {
            visibility: visible !important;
          }
          #official-syllabus-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-hidden,
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {/* Screen container with scroll wrapper */}
      <div className="p-4 md:p-6 overflow-x-auto max-h-[85vh] print:max-h-none print:overflow-visible print:p-0 bg-neutral-100 dark:bg-neutral-900">
        {/* Exact 1-to-1 Authentic Syllabus Document Container */}
        <div
          id="official-syllabus-document"
          className="bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.35] w-full max-w-[13in] min-w-[760px] mx-auto p-8 print:p-0 shadow-lg print:shadow-none print:w-full"
          style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
        >
          {/* Header Box (1 row, 2 cols, 1px solid black border) */}
          <table className="w-full border-collapse border border-black mb-1">
            <tbody>
              <tr>
                <td className="w-[28%] p-2.5 border border-black text-center align-middle">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <img
                      src="/dmmmsu-seal.png"
                      alt="DMMMSU University Seal"
                      className="w-16 h-16 object-contain mx-auto"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="text-[9pt] font-bold text-center leading-tight uppercase">
                      {institution.university || 'Don Mariano Marcos Memorial State University'}
                    </div>
                    <div className="text-[8pt] text-center leading-tight text-neutral-800">
                      {institution.college || 'College of Computer Science'}
                    </div>
                  </div>
                </td>
                <td className="w-[72%] p-2.5 border border-black text-center align-middle">
                  <h1 className="text-[16pt] font-bold uppercase tracking-wider text-black">
                    Course Syllabus
                  </h1>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Centered Academic Semester & Year */}
          <div className="text-center font-bold text-[10pt] py-1 mb-2 text-black">
            {courseInfo.semester || '1st Semester'}, Academic Year {courseInfo.academicYear || '2026-2027'}
          </div>

          {/* Table 0: Basic Course Identification Table */}
          <table className="w-full border-collapse border border-black mb-3 text-[10pt]">
            <tbody>
              <tr>
                <td className="p-1.5 font-bold border border-black w-[22%] align-top">
                  Course No. &amp; Descriptive Title:
                </td>
                <td className="p-1.5 font-bold border border-black w-[38%] align-top">
                  {courseInfo.code} – {courseInfo.title}
                </td>
                <td className="p-1.5 font-bold border border-black w-[20%] align-top">
                  Schedule &amp; Room Assignment:
                </td>
                <td className="p-1.5 border border-black w-[20%] align-top">
                  {primarySection && (primarySection.schedule || primarySection.room)
                    ? `${primarySection.section ? `${primarySection.section} ` : ''}${primarySection.schedule || ''} ${primarySection.room ? `(${primarySection.room})` : ''}`.trim()
                    : ''}
                </td>
              </tr>
              <tr>
                <td className="p-1.5 font-bold border border-black align-top">
                  Name of Faculty Member/s:
                </td>
                <td colSpan={3} className="p-1.5 border border-black align-top">
                  {facultyMembers.length > 0
                    ? facultyMembers.map(f => f.name).filter(Boolean).join(', ')
                    : primaryFaculty?.name || 'Faculty Member'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Part I: Institutional Statements & Course Information */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part I:</div>
          <table className="w-full border-collapse border border-black mb-3 text-[10pt]">
            <tbody>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Philosophy</td>
                <td className="p-1.5 border border-black align-top">{institutionalStatements?.philosophy || 'Total human development'}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Vision</td>
                <td className="p-1.5 border border-black align-top">{institutionalStatements?.vision || 'A Premier University of the North by 2030 – excellent across disciplines, globally competitive and futures-ready'}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Mission</td>
                <td className="p-1.5 border border-black align-top">{institutionalStatements?.mission || 'Develop human capital for nation building and foster entrepreneurship by providing inclusive and relevant instruction, research, and extension services'}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Goal</td>
                <td className="p-1.5 border border-black align-top">{institutionalStatements?.goal || 'To lead in transforming human resources into productive, self-reliant citizens, and responsible leaders.'}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Graduate Attributes</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  <div>
                    DMMMSU aims to produce highly competent, specialized, and globally competitive professionals. This is operationalized into graduate attributes that should be attained by the time students will graduate from the University.
                  </div>
                  <div className="space-y-1 mt-1">
                    {(institutionalStatements?.graduateAttributes || []).map((ga, idx) => (
                      <div key={idx} className="pl-4">
                        <span className="font-bold">{ga.title}</span> – {ga.description}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Core Values</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {(institutionalStatements?.coreValues || []).map((cv, idx) => (
                    <div key={idx}>
                      <span className="font-bold uppercase tracking-wider">{cv.keyword || cv.acronym}:</span> {cv.description}
                    </div>
                  ))}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Program Outcomes</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {programOutcomes && programOutcomes.length > 0 ? (
                    <>
                      <div>Upon graduation, successful graduates will attain the following program outcomes:</div>
                      <ol className="list-decimal list-inside space-y-1 mt-1">
                        {programOutcomes.map((po, idx) => (
                          <li key={idx} className="pl-1">
                            <span className="font-semibold">PO{po.number}:</span> {po.description}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Type</td>
                <td className="p-1.5 border border-black align-top">{courseInfo.type || ''}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Credit</td>
                <td className="p-1.5 border border-black align-top">{courseInfo.credit || ''}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Description</td>
                <td className="p-1.5 border border-black align-top leading-relaxed text-justify">{courseInfo.description || ''}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Contact Hours/Week</td>
                <td className="p-1.5 border border-black align-top">
                  {[
                    courseInfo.lectureHours && `Lecture – ${courseInfo.lectureHours}`,
                    courseInfo.labHours && `Laboratory – ${courseInfo.labHours}`
                  ].filter(Boolean).join(' | ')}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Prerequisite/s</td>
                <td className="p-1.5 border border-black align-top">{courseInfo.prerequisite || ''}</td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Outcomes</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {courseOutcomes && courseOutcomes.length > 0 ? (
                    <>
                      <div>By the end of the course, students should be able to:</div>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {courseOutcomes.map((co, idx) => (
                          <li key={idx} className="pl-1">
                            <span className="font-semibold">CO{co.number}:</span> {co.statement}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Course Requirements</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {courseRequirements?.major && courseRequirements.major.length > 0 ? (
                    courseRequirements.major.map((cr, idx) => (
                      <div key={idx}>{cr}</div>
                    ))
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Grading System</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {gradingSystem && (gradingSystem.termFormula || gradingSystem.finalFormula || (gradingSystem.classStandingComponents && gradingSystem.classStandingComponents.length > 0) || gradingSystem.passingGrade) ? (
                    <>
                      {gradingSystem.classStandingComponents && gradingSystem.classStandingComponents.length > 0 && (
                        <div className="space-y-0.5">
                          {gradingSystem.classStandingComponents.map((c, idx) => (
                            <div key={idx}>{c}</div>
                          ))}
                        </div>
                      )}
                      {gradingSystem.termFormula && (
                        <div className="font-semibold mt-1">
                          {gradingSystem.termFormula}
                        </div>
                      )}
                      {gradingSystem.finalFormula && (
                        <div className="font-semibold">
                          {gradingSystem.finalFormula}
                        </div>
                      )}
                      {gradingSystem.passingGrade && (
                        <div>Passing Grade: {gradingSystem.passingGrade}</div>
                      )}
                    </>
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Classroom Policies</td>
                <td className="p-1.5 border border-black align-top space-y-1">
                  {classroomPolicies && classroomPolicies.length > 0 ? (
                    classroomPolicies.map((pol, idx) => (
                      <div key={idx} className="leading-normal">{pol}</div>
                    ))
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="w-[20%] p-1.5 font-bold border border-black align-top">Consultation Hours</td>
                <td className="p-1.5 border border-black align-top">
                  {primaryFaculty?.consultation || ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Part II: Course Outline and Time Frame */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part II: Course Outline and Time Frame</div>
          <table className="w-full border-collapse border border-black mb-3 text-[10pt]">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="p-1.5 border border-black w-[20%] text-center">Time Frame</th>
                <th className="p-1.5 border border-black w-[80%] text-left">Course Content/Subject Matter</th>
              </tr>
            </thead>
            <tbody>
              {courseOutline && courseOutline.length > 0 ? (
                courseOutline.map((item, idx) => {
                  const isExam = item.title.toUpperCase().includes('EXAMINATION') || item.timeFrame.toLowerCase().includes('exam');
                  return (
                    <tr key={idx} className="border-b border-black">
                      <td className={`p-1.5 border border-black text-center align-top ${isExam ? 'font-bold' : ''}`}>
                        {item.timeFrame}
                      </td>
                      <td className={`p-1.5 border border-black align-top ${isExam ? 'font-bold text-center' : ''}`}>
                        {isExam ? (
                          item.title.toUpperCase()
                        ) : (
                          <>
                            <div className="font-bold">{item.title}</div>
                            {item.topics && item.topics.length > 0 && (
                              <div className="pl-4 mt-0.5 space-y-0.5">
                                {item.topics.map((t, tIdx) => (
                                  <div key={tIdx}>{t}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-b border-black h-8">
                  <td className="p-1.5 border border-black text-center align-top">&nbsp;</td>
                  <td className="p-1.5 border border-black align-top">&nbsp;</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Part III: Learning Plan */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part III: Learning Plan</div>
          <table className="w-full border-collapse border border-black mb-3 text-[9pt] leading-tight">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th className="p-1.5 border border-black w-[18%]">Learning Outcomes</th>
                <th className="p-1.5 border border-black w-[18%]">Topics</th>
                <th className="p-1.5 border border-black w-[16%]">SDG Coherence</th>
                <th className="p-1.5 border border-black w-[10%]">Time Allotment Week (hour)</th>
                <th className="p-1.5 border border-black w-[13%]">Methodology</th>
                <th className="p-1.5 border border-black w-[13%]">Resources</th>
                <th className="p-1.5 border border-black w-[12%]">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {learningPlan && learningPlan.length > 0 ? (
                learningPlan.map((plan, idx) => {
                  const isExam = plan.topics?.some(t => t.toUpperCase().includes('EXAM')) || plan.week.toUpperCase().includes('EXAM');
                  if (isExam) {
                    return (
                      <tr key={idx} className="border-b border-black font-bold text-center">
                        <td colSpan={7} className="p-2 border border-black">
                          {plan.week} {plan.hoursLec ? `(${plan.hoursLec + plan.hoursLab} hours)` : ''}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} className="border-b border-black align-top">
                      <td className="p-1.5 border border-black">
                        <div className="space-y-1">
                          {(plan.learningOutcomes || []).map((lo, lIdx) => (
                            <div key={lIdx}>{lo}</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-1.5 border border-black">
                        <div className="space-y-1">
                          {(plan.topics || []).map((tp, tIdx) => (
                            <div key={tIdx} className={tIdx === 0 ? 'font-bold' : 'pl-2'}>{tp}</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-1.5 border border-black">
                        {plan.sdgCoherence ? (
                          <div>
                            <div className="font-bold">{plan.sdgCoherence.goal}: {plan.sdgCoherence.title}</div>
                            <div className="text-[8pt] text-neutral-800 mt-0.5">{plan.sdgCoherence.description}</div>
                          </div>
                        ) : (
                          <span className="italic text-neutral-500">None specified</span>
                        )}
                      </td>
                      <td className="p-1.5 border border-black text-center font-semibold">
                        <div>{plan.week}</div>
                        <div className="text-[8pt] font-normal mt-0.5">
                          {[plan.hoursLec ? `${plan.hoursLec} hrs lec` : '', plan.hoursLab ? `${plan.hoursLab} hrs lab` : ''].filter(Boolean).join(' / ') || `${(plan.hoursLec || 0) + (plan.hoursLab || 0)} hours`}
                        </div>
                      </td>
                      <td className="p-1.5 border border-black">
                        <div className="space-y-0.5">
                          {(plan.methodology || []).map((m, mIdx) => (
                            <div key={mIdx}>{m}</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-1.5 border border-black">
                        <div className="space-y-0.5">
                          {(plan.resources || []).map((r, rIdx) => (
                            <div key={rIdx}>{r}</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-1.5 border border-black">
                        <div className="space-y-0.5">
                          {(plan.assessment || []).map((a, aIdx) => (
                            <div key={aIdx}>{a}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-b border-black h-12">
                  <td colSpan={7} className="p-1.5 border border-black text-center">&nbsp;</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Part IV: Course Map */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part IV: Course Map</div>
          <table className="w-full border-collapse border border-black mb-1 text-[9pt]">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th rowSpan={2} className="p-1.5 border border-black w-[35%] align-middle text-left">
                  Course Outcomes (CO)
                </th>
                <th colSpan={Math.max(activePOs.length, 1)} className="p-1 border border-black">
                  Program Outcomes
                </th>
              </tr>
              <tr className="border-b border-black font-bold text-center">
                {activePOs.length > 0 ? (
                  activePOs.map(po => (
                    <th key={po.number} className="p-1 border border-black min-w-[28px]">
                      PO{po.number}
                    </th>
                  ))
                ) : (
                  <th className="p-1 border border-black min-w-[28px]">&nbsp;</th>
                )}
              </tr>
            </thead>
            <tbody>
              {courseMap && courseMap.length > 0 && activePOs.length > 0 ? (
                courseMap.map((row, idx) => (
                  <tr key={idx} className="border-b border-black align-middle">
                    <td className="p-1.5 border border-black text-left">
                      <span className="font-bold">CO{row.coNumber}: </span>
                      <span>{row.coStatement}</span>
                    </td>
                    {activePOs.map(po => {
                      const alignment = row.poAlignments?.[po.number] || '';
                      return (
                        <td key={po.number} className="p-1 border border-black text-center font-bold">
                          {alignment || ''}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr className="border-b border-black h-8">
                  <td className="p-1.5 border border-black">&nbsp;</td>
                  <td className="p-1.5 border border-black">&nbsp;</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="font-bold text-[9pt] mb-3 mt-1 text-black">
            Legend: I - Introduced, P - Practiced, D – Demonstrate
          </div>

          {/* Part V: References */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part V: References</div>
          <div className="space-y-1 mb-4 text-[9.5pt]">
            {references && references.length > 0 ? (
              references.map((ref, idx) => (
                <div key={idx} className="pl-8 -indent-8 text-justify leading-relaxed">
                  {ref.citation} {ref.year ? `(${ref.year}).` : ''} {ref.doiOrPublisher}
                </div>
              ))
            ) : (
              <div className="h-6"></div>
            )}
          </div>

          {/* Signatories Table (Table 5) */}
          <table className="w-full border-collapse border border-black mb-4 text-[9.5pt]">
            <tbody>
              <tr>
                <td className="w-1/3 p-3 border border-black align-top">
                  <div className="font-normal mb-1">Prepared by:</div>
                  <div className="h-10"></div>
                  <div className="font-bold uppercase tracking-wider">
                    {signatories?.preparedBy?.[0]?.name || primaryFaculty?.name || 'Faculty Member'}
                  </div>
                  <div className="text-[9pt]">
                    {signatories?.preparedBy?.[0]?.title || 'Faculty Member'}
                  </div>
                  <div className="text-[9pt] mt-1">Date: _____________</div>
                </td>
                <td className="w-1/3 p-3 border border-black align-top">
                  <div className="font-normal mb-1">Recommending Approval:</div>
                  <div className="h-10"></div>
                  <div className="font-bold uppercase tracking-wider">
                    {signatories?.recommendingApproval?.name || 'Program Chairperson'}
                  </div>
                  <div className="text-[9pt]">
                    {signatories?.recommendingApproval?.title || 'Program Chairperson'}
                  </div>
                  <div className="text-[9pt] mt-1">Date: _____________</div>
                </td>
                <td className="w-1/3 p-3 border border-black align-top">
                  <div className="font-normal mb-1">Approved:</div>
                  <div className="h-10"></div>
                  <div className="font-bold uppercase tracking-wider">
                    {signatories?.approved?.name || 'Dean / Institute Director'}
                  </div>
                  <div className="text-[9pt]">
                    {signatories?.approved?.title || 'Dean/Institute Director'}
                  </div>
                  <div className="text-[9pt] mt-1">Date: _____________</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Document Running Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-black text-[8.5pt] font-semibold text-black">
            <div>
              <div>{institution.formCode || 'DMMMSU-INS-F003'}</div>
              <div>{institution.revision || 'REV. 02 (06.23.2025)'}</div>
            </div>
            <div>
              Page 1 of 2
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
