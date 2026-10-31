import React, { useState } from 'react';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import { OFFICIAL_INSTITUTIONAL_STATEMENTS, normalizeRubricLevels } from '../../../../shared/data/syllabusData';
import { Printer, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const activeData = data || syllabus || ({} as OfficialSyllabusData);

  const {
    institution = {
      university: 'Don Mariano Marcos Memorial State University',
      college: 'College of Computer Science',
      formCode: 'DMMMSU-INS-F003',
      revision: 'REV. 02 (06.23.2025)'
    },
    courseInfo = {
      code: 'CSPC - 112',
      title: 'Software Engineering 2',
      semester: 'First Semester',
      academicYear: '2025-2026',
      type: '',
      credit: '',
      lectureHours: '',
      labHours: '',
      prerequisite: '',
      description: ''
    },
    facultyMembers = [],
    institutionalStatements,
    programOutcomes = [],
    courseOutcomes = [],
    courseRequirements,
    gradingSystem,
    projectRubrics = [],
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
  const activePOs = programOutcomes && programOutcomes.filter(po => (po.description || '').trim()).length > 0
    ? programOutcomes.filter(po => (po.description || '').trim())
    : [];

  const activeCOs = courseOutcomes && courseOutcomes.filter(co => (co.statement || '').trim()).length > 0
    ? courseOutcomes.filter(co => (co.statement || '').trim())
    : [];

  // Fallback graduate attributes & core values
  const gradAttrs = institutionalStatements?.graduateAttributes?.length
    ? institutionalStatements.graduateAttributes
    : OFFICIAL_INSTITUTIONAL_STATEMENTS.graduateAttributes;

  const coreVals = institutionalStatements?.coreValues?.length
    ? institutionalStatements.coreValues
    : OFFICIAL_INSTITUTIONAL_STATEMENTS.coreValues;

  // Flattened all faculty sections for Schedule and Room Assignment
  const allSections = facultyMembers.flatMap(f =>
    (f.sections || []).map(s => ({
      ...s,
      facultyName: f.name
    }))
  );

  // Common Header Box (Left: seal only, Right: Course Syllabus)
  const renderHeaderBox = (includeAccessibleTitles: boolean = false) => (
    <table className="w-full border-collapse border border-black mb-3">
      <tbody>
        <tr className="h-[81pt]">
          <td className="w-[27.05%] border border-black text-center align-middle p-1">
            <img
              src="/dmmmsu-seal.png"
              alt={institution.university || 'Don Mariano Marcos Memorial State University'}
              className="h-[72pt] w-[72pt] object-contain mx-auto block"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {includeAccessibleTitles && (
              <span className="sr-only">
                <span>{institution.university || 'Don Mariano Marcos Memorial State University'}</span>
                <span> - </span>
                <span>{institution.college || 'College of Computer Science'}</span>
              </span>
            )}
          </td>
          <td className="w-[72.95%] border border-black text-center align-middle">
            <h1 className="font-['Trebuchet_MS',Arial,sans-serif] text-[14pt] font-bold text-black tracking-normal">
              Course Syllabus
            </h1>
          </td>
        </tr>
      </tbody>
    </table>
  );

  // Common Running Footer (Left: Form Code & Revision, Right: Page X of Y)
  const renderFooter = (pageNo: number, total: number) => (
    <div className="flex justify-between items-end font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-tight text-black mt-auto pt-2 select-none">
      <div>
        <div>{institution.formCode || 'DMMMSU-INS-F003'}</div>
        <div>{institution.revision || 'REV. 02 (06.23.2025)'}</div>
      </div>
      <div>
        Page {pageNo} of {total}
      </div>
    </div>
  );

  // Determine if this is a full official syllabus (e.g., CSPC112 with rubrics, learning plan, etc.)
  const hasLearningPlan = learningPlan && learningPlan.length > 0;
  const hasRubrics = projectRubrics && projectRubrics.length > 0;
  const hasCourseOutline = courseOutline && courseOutline.length > 0;
  const hasCourseMap = courseMap && courseMap.length > 0 && activePOs.length > 0;
  const hasReferences = references && references.length > 0;
  const hasGrading = gradingSystem && (gradingSystem.termFormula || gradingSystem.finalFormula || (gradingSystem.classStandingComponents && gradingSystem.classStandingComponents.length > 0) || gradingSystem.passingGrade);

  // Build the list of sheets dynamically
  const sheetBuilders: ((pageNo: number, total: number) => React.ReactNode)[] = [];

  // ----------------------------------------------------
  // SHEET 1: Course Info, Borderless Metadata, Part I Start
  // ----------------------------------------------------
  sheetBuilders.push((pageNo, total) => (
    <div
      key={`sheet-${pageNo}`}
      className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
    >
      <div>
        {renderHeaderBox(true)}

        {/* Centered Academic Semester & Year */}
        <div className="text-center font-normal text-[10pt] mt-[13.4pt] mb-[23pt] text-black">
          {courseInfo.semester || 'First Semester'}, Academic Year {courseInfo.academicYear || '2025-2026'}
        </div>

        {/* BORDERLESS Course Identification & Schedule Metadata */}
        <div className="grid grid-cols-12 gap-4 mb-4 text-[10pt] leading-snug">
          {/* Left side: Course No & Descriptive Title + Faculty */}
          <div className="col-span-7 space-y-2">
            <div className="flex items-start">
              <span className="w-[166pt] shrink-0 text-black">Course No. &amp; Descriptive Title:</span>
              <span className="font-bold text-black">
                {courseInfo.code && courseInfo.title
                  ? (courseInfo.code.includes(' - ') || courseInfo.code.endsWith('-')
                      ? `${courseInfo.code} ${courseInfo.title}`
                      : `${courseInfo.code} – ${courseInfo.title}`)
                  : (courseInfo.code || courseInfo.title)}
              </span>
            </div>

            <div className="flex items-start">
              <span className="w-[166pt] shrink-0 text-black">Name of Faculty Member/s:</span>
              <div className="space-y-4">
                {facultyMembers && facultyMembers.length > 0 ? (
                  facultyMembers.map((fac, idx) => (
                    <div key={idx} className="font-bold text-black">
                      {fac.name}
                    </div>
                  ))
                ) : (
                  <div className="font-bold text-black">{primaryFaculty?.name || 'Faculty Member'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Schedule and Room Assignment */}
          <div className="col-span-5">
            <div className="font-bold text-black mb-1">Schedule and Room Assignment</div>
            <div className="space-y-0.5 font-bold text-black text-[9.5pt]">
              {allSections.length > 0 ? (
                allSections.map((sec, idx) => (
                  <div key={idx} className="whitespace-nowrap">
                    <span>{sec.section} </span>
                    <span>{sec.lectureSchedule || ''}</span>
                    {sec.lectureRoom && <span> - {sec.lectureRoom}</span>}
                    {sec.labSchedule && <span>, {sec.labSchedule}</span>}
                    {sec.labRoom && <span> - {sec.labRoom}</span>}
                  </div>
                ))
              ) : (
                <div className="text-neutral-500 font-normal italic">None specified</div>
              )}
            </div>
          </div>
        </div>

        {/* Part I: Title */}
        <div className="font-bold text-[10pt] mb-1 text-black">Part I:</div>

        {/* Part I: Table Start (Philosophy to Graduate Attributes) */}
        <table className="w-full border-collapse border border-black text-[10pt] leading-tight">
          <tbody>
            <tr className="border-b border-black">
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Philosophy</td>
              <td className="p-1.5 align-top">
                {institutionalStatements?.philosophy || 'Total human development with appropriate competencies.'}
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Vision</td>
              <td className="p-1.5 align-top">
                {institutionalStatements?.vision || 'A Premier University of the North by 2030 – excellent across disciplines, globally competitive and futures-ready'}
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Mission</td>
              <td className="p-1.5 align-top">
                {institutionalStatements?.mission || 'Develop human capital for nation building and foster entrepreneurship by providing inclusive and relevant instruction, research, and extension services'}
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Goal</td>
              <td className="p-1.5 align-top">
                {institutionalStatements?.goal || 'To lead in transforming human resources into productive, self-reliant citizens, and responsible leaders.'}
              </td>
            </tr>
            <tr>
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Graduate Attributes</td>
              <td className="p-1.5 align-top">
                <div>
                  DMMMSU aims to produce highly competent, specialized, and globally competitive professionals. This is operationalized into graduate attributes that should be attained by the time students will graduate from the University.
                </div>
                <div className="mt-1 space-y-0.5 text-[9.5pt]">
                  {gradAttrs.map((ga, idx) => (
                    <div key={idx} className="pl-4">
                      <span className="font-bold">{idx + 1}. {ga.title}</span>
                      <div className="pl-4 text-black">{ga.description}</div>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {renderFooter(pageNo, total)}
    </div>
  ));

  // ----------------------------------------------------
  // SHEET 2: Core Values & Program Outcomes
  // ----------------------------------------------------
  sheetBuilders.push((pageNo, total) => (
    <div
      key={`sheet-${pageNo}`}
      className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
    >
      <div>
        {renderHeaderBox()}

        <table className="w-full border-collapse border border-black text-[10pt] leading-tight">
          <tbody>
            <tr className="border-b border-black">
              <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Core Values</td>
              <td className="p-1.5 align-top space-y-0.5">
                {coreVals.map((cv, idx) => (
                  <div key={idx}>
                    <span className="font-bold uppercase">{cv.keyword || cv.acronym}:</span>{' '}
                    <span>{cv.description}</span>
                  </div>
                ))}
              </td>
            </tr>
            {activePOs.length > 0 && (
              <tr>
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Program Outcomes</td>
                <td className="p-1.5 align-top space-y-1">
                  <div>Upon graduation, successful BSCS graduates will attain the following program outcomes:</div>
                  <ol className="space-y-0.5 text-[9.5pt] pl-4">
                    {activePOs.map((po, idx) => (
                      <li key={idx} className="list-decimal pl-1">
                        <span className="font-semibold">PO{po.number}</span>
                        <span>: {po.description}</span>
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            )}
            {!hasLearningPlan && courseInfo.description && (
              <tr>
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Description</td>
                <td className="p-1.5 align-top leading-relaxed text-justify">
                  {courseInfo.description}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renderFooter(pageNo, total)}
    </div>
  ));

  // If this is a full syllabus (like CSPC112), render Sheets 3 through 17
  if (hasLearningPlan || hasRubrics || hasCourseOutline) {
    // ----------------------------------------------------
    // SHEET 3: Course Info, COs, Requirements, Grading System Intro
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[10pt] leading-tight">
            <tbody>
              <tr className="border-b border-black">
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Type</td>
                <td className="p-1.5 align-top">{courseInfo.type || 'Lecture and Laboratory'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Credit</td>
                <td className="p-1.5 align-top">{courseInfo.credit || '3 units'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Description</td>
                <td className="p-1.5 align-top leading-relaxed text-justify">
                  {courseInfo.description}
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Contact Hours/Week</td>
                <td className="p-1.5 align-top">
                  <div>Lecture – {courseInfo.lectureHours || '2 hours/week'}</div>
                  <div>Laboratory – {courseInfo.labHours || '3 hours/week'}</div>
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Prerequisite/s</td>
                <td className="p-1.5 align-top">{courseInfo.prerequisite || 'CSPC 111 - Software Engineering 1'}</td>
              </tr>
              {activeCOs.length > 0 && (
                <tr className="border-b border-black">
                  <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Outcomes</td>
                  <td className="p-1.5 align-top">
                    <div>By the end of the course, students should be able to:</div>
                    <div className="space-y-0.5 mt-0.5 text-[9.5pt]">
                      {activeCOs.map((co, idx) => (
                        <div key={idx} className="pl-4">
                          <span>{idx + 1}) </span>
                          <span>{co.statement}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {courseRequirements?.major && courseRequirements.major.length > 0 && (
                <tr className="border-b border-black">
                  <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Course Requirements</td>
                  <td className="p-1.5 align-top space-y-1">
                    <div className="font-bold">Major Requirements and Assessments</div>
                    <div className="pl-4 space-y-0.5">
                      {courseRequirements.major.map((m, idx) => (
                        <div key={idx}>{m}</div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {hasGrading && (
                <tr>
                  <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Grading System</td>
                  <td className="p-1.5 align-top">
                    Class Standing (Quizzes, assignments, presentations, individual and group activity, project)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 4: Grading Formulas & Rubrics Part 1 (Categories 1-4)
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <div className="border border-black p-2 mb-2 text-[10pt]">
            <div>Midterm Grade/Final Term Grade = 60% Class Standing + 40% ME/FE</div>
            <div>Final Grade = 40% Midterm Grade + 60% Final Term Grade</div>
            <div className="font-bold mt-2">Rubrics for Group Project Presentation and Documentation</div>
          </div>

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th className="w-[24%] p-1 border border-black text-center">Category</th>
                <th className="w-[19%] p-1 border border-black text-center">1</th>
                <th className="w-[19%] p-1 border border-black text-center">2</th>
                <th className="w-[19%] p-1 border border-black text-center">3</th>
                <th className="w-[19%] p-1 border border-black text-center">4</th>
              </tr>
            </thead>
            <tbody>
              {projectRubrics.slice(0, 4).map((r, idx) => {
                const levels = normalizeRubricLevels(r.levels);
                return (
                  <tr key={idx} className="border-b border-black align-top">
                    <td className="p-1.5 border border-black font-normal">{r.category}</td>
                    {levels.slice(0, 4).map((lv, lvIdx) => (
                      <td key={lvIdx} className="p-1.5 border border-black text-[8.5pt]">
                        {lv.description}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 5: Rubrics Part 2 (Categories 5-9)
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              {projectRubrics.slice(4, 9).map((r, idx) => {
                const levels = normalizeRubricLevels(r.levels);
                return (
                  <tr key={idx} className="border-b border-black align-top">
                    <td className="w-[24%] p-1.5 border border-black font-normal">{r.category}</td>
                    {levels.slice(0, 4).map((lv, lvIdx) => (
                      <td key={lvIdx} className="w-[19%] p-1.5 border border-black text-[8.5pt]">
                        {lv.description}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 6: Rubric 10, Policies, Consultation, Part II Start
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          {/* Rubric Category 10 */}
          {projectRubrics[9] && (
            <table className="w-full border-collapse border border-black text-[9pt] leading-tight mb-2">
              <tbody>
                {(() => {
                  const r10 = projectRubrics[9];
                  const levels = normalizeRubricLevels(r10.levels);
                  return (
                    <tr className="border-b border-black align-top">
                      <td className="w-[24%] p-1.5 border border-black font-normal">{r10.category}</td>
                      {levels.slice(0, 4).map((lv, lvIdx) => (
                        <td key={lvIdx} className="w-[19%] p-1.5 border border-black text-[8.5pt]">
                          {lv.description}
                        </td>
                      ))}
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          )}

          {/* Policies & Consultation */}
          <table className="w-full border-collapse border border-black text-[10pt] leading-tight mb-3">
            <tbody>
              {classroomPolicies && classroomPolicies.length > 0 && (
                <tr className="border-b border-black">
                  <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Classroom Policies</td>
                  <td className="p-1.5 align-top space-y-1">
                    {classroomPolicies.map((pol, idx) => (
                      <div key={idx}>{pol}</div>
                    ))}
                    <div className="pt-1">Your workstation must be kept in a clean and orderly manner for the next class.</div>
                  </td>
                </tr>
              )}
              <tr>
                <td className="w-[20.6%] p-1.5 font-bold border-r border-black align-top">Consultation Hours</td>
                <td className="p-1.5 align-top space-y-0.5">
                  <div>E.O.Bacungan - MTWTHF 02:00PM - 03:00PM</div>
                  <div>R.E.Dilan - MWF 1:00-2:00, TTh 9:30-10:30</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Part II: Header & First Row */}
          <div className="font-bold text-[10pt] mb-1 text-black">Part II: Course Outline and Time Frame</div>
          <table className="w-full border-collapse border border-black text-[10pt] leading-tight">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="w-[20.6%] p-1.5 border border-black text-left">Time Frame</th>
                <th className="p-1.5 border border-black text-left">Course Content/Subject Matter</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Week 1-7</td>
                <td className="p-1.5 border border-black space-y-0.5">
                  <div>VGMO presentation and orientation</div>
                  <div>Presentation of the course syllabus</div>
                  <div>Review of Software Engineering 1</div>
                  <div>Software Design and Architectural Patterns</div>
                  <div className="pl-4">● Design patterns</div>
                  <div className="pl-4">● Architectural patterns</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 7: Course Outline Conclusion & Part III Header
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[10pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[10pt] leading-tight mb-4">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[20.6%] p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Software analysis and design tools</td>
              </tr>
              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Week 8</td>
                <td className="p-1.5 border border-black space-y-0.5">
                  <div>Program Coding Practices and Techniques</div>
                  <div className="pl-4">● Coding Practices and techniques</div>
                  <div className="pl-4">● Mechanisms for building quality programs</div>
                  <div className="pl-4">● Defensive and secure coding practices</div>
                  <div className="pl-4">● Exception handling mechanisms</div>
                  <div className="pl-4">● Coding standards</div>
                  <div className="pl-4">● Potential security problems in programs</div>
                </td>
              </tr>
              <tr className="border-b border-black align-top font-bold">
                <td className="p-1.5 border border-black">Week 9</td>
                <td className="p-1.5 border border-black">MIDTERM EXAMINATION</td>
              </tr>
              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Week 10-12</td>
                <td className="p-1.5 border border-black space-y-0.5">
                  <div>Managing Changes in Software Engineering</div>
                  <div className="pl-4">● Configuration management</div>
                  <div className="pl-4">● Version control</div>
                  <div className="pl-4">● Release management</div>
                </td>
              </tr>
              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Week 13-15</td>
                <td className="p-1.5 border border-black space-y-0.5">
                  <div>Software Testing and Maintenance</div>
                  <div className="pl-4">● Software Testing Introduction</div>
                  <div className="pl-4">● Software Validation and Verification</div>
                  <div className="pl-4">● Testing Documentation</div>
                  <div className="pl-4">● Software Maintenance</div>
                </td>
              </tr>
              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Week 16-17</td>
                <td className="p-1.5 border border-black">Group Project Presentation</td>
              </tr>
              <tr className="border-b border-black align-top font-bold">
                <td className="p-1.5 border border-black">Week 18</td>
                <td className="p-1.5 border border-black">FINAL EXAMINATION</td>
              </tr>
            </tbody>
          </table>

          <div className="font-bold text-[10pt] mb-1 text-black">Part III: Learning Plan</div>
          <table className="w-full border-collapse border border-black text-[9pt] leading-tight text-center">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="w-[18%] p-1.5 border border-black">Learning Outcomes</th>
                <th className="w-[18%] p-1.5 border border-black">Topics</th>
                <th className="w-[16%] p-1.5 border border-black">SDG Coherence</th>
                <th className="w-[10%] p-1.5 border border-black">Time Allotment Week (hour)</th>
                <th className="w-[13%] p-1.5 border border-black">Methodology</th>
                <th className="w-[13%] p-1.5 border border-black">Resources</th>
                <th className="w-[12%] p-1.5 border border-black">Assessment</th>
              </tr>
            </thead>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEETS 8 TO 14: Learning Plan Weekly Units
    // ----------------------------------------------------
    // Sheet 8
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black">
                  Understand the VMGO and know the course policies and requirements
                </td>
                <td className="w-[18%] p-1.5 border border-black">
                  VGMO presentation and orientation<br />
                  Presentation of the course syllabus
                </td>
                <td className="w-[16%] p-1.5 border border-black">
                  <div className="font-bold">SDG 4: Quality Education.</div>
                  <div>Aligning academic advancement with institutional principles.</div>
                  <div className="mt-1"><span className="font-bold">(Target 4.4)</span> By 2030, substantially increase the number of youth and adults who have relevant skills, including technical and vocational skills, for employment, decent jobs and entrepreneurship.</div>
                </td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 1-3<br />
                  9 hours (lab)<br />
                  6 hours (lec)
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Discussion<br />
                  ● Video Lecture<br />
                  ● Group Discussion
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom<br />
                  ● Computer laboratory<br />
                  ● Figma
                </td>
                <td className="w-[12%] p-1.5 border border-black">
                  ● Group exercises on creating UML Diagrams and ERD<br />
                  ● Create a Gantt chart of the group project
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">
                  Enhance existing software solutions by applying appropriate design patterns to improve functionality and maintainability.
                </td>
                <td className="p-1.5 border border-black">
                  Review of Software Engineering 1
                </td>
                <td className="p-1.5 border border-black">
                  <div className="font-bold">SDG 4: Quality Education.</div>
                  <div>Reviewing foundational knowledge strengthens learning outcomes and helps students build a solid technical base.</div>
                  <div className="mt-1"><span className="font-bold">(Target 4.4.1)</span> Proportion of youth and adults with information and communications technology (ICT) skills, by type of skill.</div>
                  <div className="font-bold mt-1">SDG 8: Decent Work and Economic Growth.</div>
                  <div>Solid software skills boost employability and economic growth in tech-driven industries.</div>
                </td>
                <td className="p-1.5 border border-black text-center"></td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 9
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[18%] p-1.5 border border-black">Design patterns</td>
                <td className="w-[16%] p-1.5 border border-black">
                  <div><span className="font-bold">(Target 8.2)</span> Achieve higher levels of economic productivity through diversification, technological upgrading and innovation, including through a focus on high value added and labour-intensive sectors.</div>
                  <div className="font-bold mt-1">SDG 9: Industry, Innovation, and Infrastructure.</div>
                  <div>Design patterns promote efficient and scalable software systems, supporting technological innovation and sustainable infrastructure.</div>
                  <div className="mt-1"><span className="font-bold">(Target 9.4)</span> By 2030, upgrade infrastructure and retrofit industries to make them sustainable, with increased resource-use efficiency and greater adoption of clean and environmentally sound technologies and industrial processes, with all countries taking action in accordance with their respective capabilities</div>
                </td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 4<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Project-based Learning<br />
                  ● Discussion<br />
                  ● Brainstorming<br />
                  ● Collaborative Learning<br />
                  ● Case based learning
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom<br />
                  ● Programming language selected based on project requirements
                </td>
                <td className="w-[12%] p-1.5 border border-black">
                  ● Individual activity on design patterns<br />
                  ● Project proposal presentation
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 10
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[18%] p-1.5 border border-black">Architectural patterns</td>
                <td className="w-[16%] p-1.5 border border-black">
                  <div className="font-bold">SDG 9: Industry, Innovation, and Infrastructure.</div>
                  <div>Architectural patterns build resilient, scalable systems, crucial for sustainable industry growth.</div>
                  <div className="mt-1"><span className="font-bold">(Target 9.1)</span> Develop quality, reliable, sustainable and resilient infrastructure, including regional and transborder infrastructure, to support economic development and human well-being, with a focus on affordable and equitable access for all</div>
                </td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 5<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Discussion<br />
                  ● Project-based Learning<br />
                  ● Brainstorming<br />
                  ● Collaborative Learning<br />
                  ● Problem based learning
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom<br />
                  ● Programming language selected based on project requirements
                </td>
                <td className="w-[12%] p-1.5 border border-black">
                  ● Conduct a group game activity focused on architectural patterns<br />
                  ● Present project updates and improvements aligned with the Gantt chart
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Software analysis and design tools</td>
                <td className="p-1.5 border border-black">
                  <div className="font-bold">SDG 4: Quality Education.</div>
                  <div>Introducing students to modern tools equips them with relevant skills, ensuring high-quality education.</div>
                </td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 6-7<br />
                  6 hours (lab)<br />
                  4 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Project-based Learning<br />
                  ● Brainstorming<br />
                  ● Collaborative Learning<br />
                  ● Group discussion
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom<br />
                  ● Programming language selected based on project requirements
                </td>
                <td className="p-1.5 border border-black">
                  ● Create system models<br />
                  ● Present project updates and improvements aligned with the Gantt chart
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 11
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black space-y-2">
                  <div>Implement program designs and specifications by writing efficient and functional source code.</div>
                  <div>Explain and apply coding techniques, idioms, standards, and mechanisms that ensure software reliability, efficiency, and robustness.</div>
                </td>
                <td className="w-[18%] p-1.5 border border-black space-y-1">
                  <div>Coding practices and techniques</div>
                  <div>Mechanisms for building quality programs</div>
                  <div>Defensive and secure coding practices</div>
                  <div>Exception handling mechanisms</div>
                </td>
                <td className="w-[16%] p-1.5 border border-black">
                  <div className="font-bold">SDG 4: Quality Education.</div>
                  <div>Teaching proper coding practices promotes a high standard of software education, equipping students with essential skills for their careers.</div>
                  <div className="mt-1"><span className="font-bold">(Target 4.4.1)</span> Proportion of youth and adults with information and communications technology (ICT) skills, by type of skill.</div>
                  <div className="font-bold mt-1">SDG 9: Industry, Innovation, and Infrastructure.</div>
                  <div>Promotes the development of secure, reliable systems that enhance resilience in industries, supporting sustainable infrastructure and technological innovation.</div>
                  <div className="mt-1"><span className="font-bold">(Target 9.1)</span> Develop quality, reliable, sustainable and resilient infrastructure, including regional and transborder infrastructure, to support economic development and human well-being, with a</div>
                </td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 8<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="w-[13%] p-1.5 border border-black space-y-2">
                  <div>
                    ● Discussion<br />
                    ● Project-based Learning<br />
                    ● Code reading and critique sessions<br />
                    ● Peer review activities
                  </div>
                  <div className="pt-2">
                    ● Discussion<br />
                    ● Project-based Learning<br />
                    ● Code reading and critique sessions<br />
                    ● Peer review activities
                  </div>
                </td>
                <td className="w-[13%] p-1.5 border border-black space-y-2">
                  <div>
                    ● Presentation<br />
                    ● Laptop<br />
                    ● Google Classroom<br />
                    ● Programming language selected based on project requirements
                  </div>
                  <div className="pt-2">
                    ● Presentation<br />
                    ● Laptop<br />
                    ● Google Classroom<br />
                    ● Programming language selected based on project requirements
                  </div>
                </td>
                <td className="w-[12%] p-1.5 border border-black space-y-2">
                  <div>
                    ● Coding exercises<br />
                    ● Present project updates and improvements aligned with the Gantt chart
                  </div>
                  <div className="pt-2">
                    ● Coding exercises<br />
                    ● Present project updates and improvements aligned with the Gantt chart
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 12
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[16%] p-1.5 border border-black">focus on affordable and equitable access for all.</td>
                <td className="w-[10%] p-1.5 border border-black"></td>
                <td className="w-[13%] p-1.5 border border-black"></td>
                <td className="w-[13%] p-1.5 border border-black"></td>
                <td className="w-[12%] p-1.5 border border-black"></td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">Conduct review/midterm examination</td>
                <td className="p-1.5 border border-black">Midterm Examination</td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black text-center font-semibold">Week 9</td>
                <td className="p-1.5 border border-black">Written Examination</td>
                <td className="p-1.5 border border-black">● Test Paper</td>
                <td className="p-1.5 border border-black">● Midterm Examination</td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black space-y-1">
                  <div>Differentiate between centralized and distributed software configuration management systems and their appropriate applications.</div>
                  <div>Demonstrate the use of version control systems in managing software releases and tracking development changes.</div>
                </td>
                <td className="p-1.5 border border-black space-y-1">
                  <div>Managing Changes in Software Engineering</div>
                  <div>Software Configuration Management</div>
                </td>
                <td className="p-1.5 border border-black">
                  <div className="font-bold">SDG 9: Industry, Innovation, and Infrastructure.</div>
                  <div>Efficient change management ensures software adaptability, scalability, and innovation, supporting the development of resilient and sustainable infrastructure.</div>
                  <div className="mt-1"><span className="font-bold">(Target 9.1)</span> Develop quality, reliable, sustainable and resilient infrastructure, including regional and transborder infrastructure, to support economic development and human well-being, with a focus on affordable and equitable access for all.</div>
                </td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 10<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Comparative analysis discussions<br />
                  ● Video Lecture
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Group activity on software configuration.<br />
                  ● Present project updates and improvements aligned with the Gantt chart
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Version Control</td>
                <td className="p-1.5 border border-black">
                  <div className="font-bold">(Target 9.1)</div>
                  <div>Develop quality, reliable, sustainable and resilient infrastructure, including regional and transborder infrastructure, to support economic development and human well-being, with a focus on affordable and equitable access for all.</div>
                </td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 11<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Video Lectures
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Group activity on version control<br />
                  ● Present project updates and improvements aligned with the Gantt chart
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 13
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[18%] p-1.5 border border-black">Release Management</td>
                <td className="w-[16%] p-1.5 border border-black"></td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 12<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Discussion<br />
                  ● Video Lectures
                </td>
                <td className="w-[13%] p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="w-[12%] p-1.5 border border-black">
                  ● Quiz based on the previous topics<br />
                  ● Present the first release of the software project<br />
                  ● Document bugs encountered in the first release
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black space-y-1">
                  <div>Design comprehensive test cases using sound testing practices, execute them on existing programs, and document identified defects effectively.</div>
                  <div>Conduct structured code inspections or peer reviews for small to medium-sized software projects to ensure code quality.</div>
                  <div>Modify and update existing software systems in response to defect reports or revised specifications.</div>
                </td>
                <td className="p-1.5 border border-black">Software Testing Introduction</td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 13<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Group activity<br />
                  ● Inquiry-based Learning<br />
                  ● Peer review activities
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Cross-group project testing<br />
                  ● Document bugs encountered in the test practices.
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Software Validation and Verification</td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 14<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Group activity<br />
                  ● Inquiry-based Learning<br />
                  ● Peer review activities<br />
                  ● QA Engineer simulation
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Present result of the cross-group project testing
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Testing Documentation</td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">● Present the updated system based on the</td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // Sheet 14
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[18%] p-1.5 border border-black"></td>
                <td className="w-[16%] p-1.5 border border-black"></td>
                <td className="w-[10%] p-1.5 border border-black"></td>
                <td className="w-[13%] p-1.5 border border-black"></td>
                <td className="w-[13%] p-1.5 border border-black"></td>
                <td className="w-[12%] p-1.5 border border-black">testing documentation.</td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black">Software Maintenance</td>
                <td className="p-1.5 border border-black"></td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 15<br />
                  3 hours (lab)<br />
                  2 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Discussion<br />
                  ● Inquiry-based Learning<br />
                  ● Peer review activities
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Quiz based on testing and software maintenance<br />
                  ● Release second version of the software, perform beta testing and perform software maintenance.
                </td>
              </tr>

              <tr className="border-b border-black align-top">
                <td className="p-1.5 border border-black">
                  Effectively present and communicate the features, functionality, and development process of a completed software project or study.
                </td>
                <td className="p-1.5 border border-black">Group Project Presentation</td>
                <td className="p-1.5 border border-black">
                  <div className="font-bold">SDG 4: Quality Education.</div>
                  <div>Encourages hands-on learning and teamwork, enhancing students' problem-solving and collaborative skills, which contribute to a high-quality educational experience.</div>
                  <div className="mt-1"><span className="font-bold">(Target 4.4.1)</span> Proportion of youth and adults with information and communications technology (ICT) skills, by type of skill.</div>
                </td>
                <td className="p-1.5 border border-black text-center font-semibold">
                  Week 16-17<br />
                  6 hours (lab)<br />
                  4 hours (lec)
                </td>
                <td className="p-1.5 border border-black">
                  ● Project presentations<br />
                  ● Poster or pitch sessions<br />
                  ● Oral defense and Q&amp;A with peers/instructor
                </td>
                <td className="p-1.5 border border-black">
                  ● Presentation<br />
                  ● Laptop<br />
                  ● Google Classroom
                </td>
                <td className="p-1.5 border border-black">
                  ● Group Project Presentation<br />
                  ● Group Project Documentation
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 15: Week 18 Exam & Part IV Course Map (Rows 1-5)
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9pt] leading-[1.25] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight mb-4">
            <tbody>
              <tr className="border-b border-black align-top">
                <td className="w-[18%] p-1.5 border border-black">Conduct review/final examination</td>
                <td className="w-[18%] p-1.5 border border-black">Final Examination</td>
                <td className="w-[16%] p-1.5 border border-black">
                  Target 17.17 – Encourage and promote effective public, public-private and civil society partnerships, building on the experience and resourcing strategies of partnerships.
                </td>
                <td className="w-[10%] p-1.5 border border-black text-center font-semibold">
                  Week 18<br />
                  5 hours
                </td>
                <td className="w-[13%] p-1.5 border border-black">Written Examination</td>
                <td className="w-[13%] p-1.5 border border-black">● Test Paper</td>
                <td className="w-[12%] p-1.5 border border-black">● Final Examination</td>
              </tr>
            </tbody>
          </table>

          <div className="font-bold text-[10pt] mb-1 text-black">Part IV: Course Map</div>
          <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th rowSpan={2} className="w-[48%] p-1.5 border border-black text-center align-middle">
                  Course Outcomes (CO)
                </th>
                <th colSpan={11} className="p-1 border border-black text-center">
                  Program Outcomes
                </th>
              </tr>
              <tr className="border-b border-black font-bold text-center text-[8pt]">
                {Array.from({ length: 11 }, (_, i) => (
                  <th key={i} className="p-1 border border-black text-center min-w-[28px]">
                    {i === 9 ? 'PO10' : i === 10 ? 'PO11' : `PO\n${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { no: 1, text: 'Enhance existing software solutions by applying appropriate design patterns to improve functionality and maintainability.', po: { 1: 'P', 2: 'P', 3: 'P', 5: 'D' } },
                { no: 2, text: 'Implement program designs and specifications by writing efficient and functional source code.', po: { 1: 'P', 5: 'P', 6: 'D' } },
                { no: 3, text: 'Explain and apply coding techniques, idioms, standards, and mechanisms to ensure reliability, efficiency, and robustness.', po: { 1: 'I', 3: 'P', 4: 'I' } },
                { no: 4, text: 'Differentiate between centralized and distributed software configuration management systems.', po: { 1: 'I', 6: 'P' } },
                { no: 5, text: 'Demonstrate the use of version control systems in managing software releases and tracking development changes.', po: { 2: 'I', 6: 'P' } }
              ].map((row) => (
                <tr key={row.no} className="border-b border-black align-middle">
                  <td className="p-1.5 border border-black text-left">
                    {row.no}. {row.text}
                  </td>
                  {Array.from({ length: 11 }, (_, i) => {
                    const val = (row.po as Record<number, string>)[i + 1] || '';
                    return (
                      <td key={i} className="p-1 border border-black text-center font-bold">
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 16: Course Map (Rows 6-9) & Part V References (Batch 1)
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9.5pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <table className="w-full border-collapse border border-black text-[9pt] leading-tight mb-2">
            <tbody>
              {[
                { no: 6, text: 'Design test case documents, execute them on programs, and report defects using proper testing practices.', po: { 5: 'P', 6: 'D' } },
                { no: 7, text: 'Conduct structured code inspections or peer reviews for small to medium-sized software projects.', po: { 5: 'D', 7: 'P' } },
                { no: 8, text: 'Modify and update software based on defect reports or specification changes.', po: { 2: 'P', 5: 'D', 6: 'D' } },
                { no: 9, text: 'Effectively present and communicate the features and development process of a completed software project.', po: { 8: 'D' } }
              ].map((row) => (
                <tr key={row.no} className="border-b border-black align-middle">
                  <td className="w-[48%] p-1.5 border border-black text-left">
                    {row.no}. {row.text}
                  </td>
                  {Array.from({ length: 11 }, (_, i) => {
                    const val = (row.po as Record<number, string>)[i + 1] || '';
                    return (
                      <td key={i} className="p-1 border border-black text-center font-bold min-w-[28px]">
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="font-bold text-[9pt] mb-3 text-black">
            Legend: I - Introduced, P - Practiced, D – Demonstrate
          </div>

          <div className="font-bold text-[10pt] mb-2 text-black">Part V: References</div>
          <div className="space-y-1.5 text-[9.5pt] pl-8 -indent-8 leading-normal text-justify">
            <div>Dilan, R., Ancheta, J. (2023). Software Engineering 2 Module. DMMMSU, College of Computer Science.</div>
            <div>Diamantopoulos, T. &amp; Symeonidis, A. L. (2020). Mining Software Engineering Data for Software Reuse. Springer.</div>
            <div>Langer, A. M. (2020). Analysis and Design of Next-Generation Software Architectures. doi:10.1007/978-3-030-36899-9</div>
            <div>Laplante, P. (2023). What Every Engineer Should Know About Software Engineering. CRC Press.</div>
            <div>Mason, H. (2022). Fundamentals of Software Engineering. Murphy &amp; Moore Publishing.</div>
            <div>McNeil R. (2023). Modern Software Engineering. Clanrye International.</div>
            <div>Nguyen-Duc, A., Munch, J., Prikladnicki, R., Wang, X., &amp; Abrahamsson, P. (Eds.). (2020). Fundamentals of Software Startups. doi:10.1007/978-3-030-35983-6</div>
            <div>Pressman, R. S., &amp; Maxim, B. R. (2019). Software engineering: A practitioner's approach (9th ed.). McGraw-Hill Education.</div>
          </div>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));

    // ----------------------------------------------------
    // SHEET 17: References (Batch 2) & Borderless Signatories
    // ----------------------------------------------------
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9.5pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <div className="space-y-1.5 text-[9.5pt] pl-8 -indent-8 leading-normal text-justify mb-8">
            <div>Ravichandran, A., Taylor, K., and Waterhouse, P. (2016). DevOps for Digital Leaders Reignite Business with a Modern DevOps-Enabled Software Factory. Apress Open. DOI 10.1007/978-1-4842-1842-6.</div>
            <div>Rosen, C. (2020). Guide to Software Systems Development. Springer. https://doi.org/10.1007/978-3-030-39730-2</div>
            <div>Sadowski, C. and Zimmermann, T. (2019). Rethinking Productivity in Software Engineering. Apress Open. https://doi.org/10.1007/978-1-4842-4221.6.</div>
            <div>Sommervile, I. (2016). Software Engineering, 10 Ed. Pearson.</div>
            <div>Staron, M. (2020). Action Research in Software Engineering. doi:10.1007/978-3-030-32610-4</div>
            <div>Voorhees, D. P. (2020). Guide to Efficient Software Design. Texts in Computer Science. doi:10.1007/978-3-030-28501-2</div>
            <div>Zeng, D., Gu, L., Pan, S., &amp; Guo, S. (2020). Software Defined Systems, Sensing, Communication, and Computation. Springer.</div>
          </div>

          {/* BORDERLESS Signatories Section */}
          <div className="grid grid-cols-3 gap-8 mt-12 text-[10pt] leading-normal">
            <div>
              <div className="font-bold text-black mb-6">Prepared by:</div>
              <div className="space-y-6">
                <div>
                  <div className="font-bold uppercase text-black">
                    {signatories?.preparedBy?.[0]?.name || primaryFaculty?.name || 'Faculty Member'}
                  </div>
                  <div className="text-black">
                    {signatories?.preparedBy?.[0]?.title || 'Faculty Member'}
                  </div>
                  <div className="text-black">Date: _____________</div>
                </div>

                {facultyMembers.length > 1 && (
                  <div>
                    <div className="font-bold uppercase text-black">
                      {signatories?.preparedBy?.[1]?.name || facultyMembers[1]?.name || 'Faculty Member'}
                    </div>
                    <div className="text-black">
                      {signatories?.preparedBy?.[1]?.title || 'Faculty Member'}
                    </div>
                    <div className="text-black">Date: _____________</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-black mb-6">Recommending Approval:</div>
              <div>
                <div className="font-bold uppercase text-black">
                  {signatories?.recommendingApproval?.name || 'Program Chairperson'}
                </div>
                <div className="text-black">
                  {signatories?.recommendingApproval?.title || 'Program Chairperson'}
                </div>
                <div className="text-black">Date: _____________</div>
              </div>
            </div>

            <div>
              <div className="font-bold text-black mb-6">Approved:</div>
              <div>
                <div className="font-bold uppercase text-black">
                  {signatories?.approved?.name || 'Dean / Institute Director'}
                </div>
                <div className="text-black">
                  {signatories?.approved?.title || 'Dean / Institute Director'}
                </div>
                <div className="text-black">Date: _____________</div>
              </div>
            </div>
          </div>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));
  } else {
    // Sparse / baseline syllabus: add a final sheet with signatories so signatories are always present
    sheetBuilders.push((pageNo, total) => (
      <div
        key={`sheet-${pageNo}`}
        className="syllabus-page-sheet bg-white text-black font-['Trebuchet_MS',Arial,sans-serif] text-[9.5pt] leading-[1.3] w-[13in] min-w-[13in] min-h-[8.5in] h-[8.5in] p-[0.5in_0.6in_0.45in_0.6in] shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-between"
      >
        <div>
          {renderHeaderBox()}

          <div className="grid grid-cols-3 gap-8 mt-12 text-[10pt] leading-normal">
            <div>
              <div className="font-bold text-black mb-6">Prepared by:</div>
              <div className="space-y-6">
                <div>
                  <div className="font-bold uppercase text-black">
                    {signatories?.preparedBy?.[0]?.name || primaryFaculty?.name || 'Faculty Member'}
                  </div>
                  <div className="text-black">
                    {signatories?.preparedBy?.[0]?.title || 'Faculty Member'}
                  </div>
                  <div className="text-black">Date: _____________</div>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-black mb-6">Recommending Approval:</div>
              <div>
                <div className="font-bold uppercase text-black">
                  {signatories?.recommendingApproval?.name || 'Program Chairperson'}
                </div>
                <div className="text-black">
                  {signatories?.recommendingApproval?.title || 'Program Chairperson'}
                </div>
                <div className="text-black">Date: _____________</div>
              </div>
            </div>

            <div>
              <div className="font-bold text-black mb-6">Approved:</div>
              <div>
                <div className="font-bold uppercase text-black">
                  {signatories?.approved?.name || 'Dean / Institute Director'}
                </div>
                <div className="text-black">
                  {signatories?.approved?.title || 'Dean / Institute Director'}
                </div>
                <div className="text-black">Date: _____________</div>
              </div>
            </div>
          </div>
        </div>

        {renderFooter(pageNo, total)}
      </div>
    ));
  }

  const computedTotal = sheetBuilders.length;

  return (
    <div className={`relative bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col ${className}`}>
      {/* Top Action Toolbar (print:hidden) */}
      <div className="flex items-center justify-between px-6 py-3 bg-muted/60 border-b border-border print:hidden">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Official Document Preview (DMMMSU Standard)
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {institution.formCode || 'DMMMSU-INS-F003'}
          </span>
          <span className="text-[11px] text-muted-foreground italic hidden sm:inline">
            13" × 8.5" Landscape Folio ({computedTotal} Pages)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-background border border-border rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 10, 50))}
              title="Zoom Out"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold px-1 min-w-[42px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 10, 150))}
              title="Zoom In"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              title="Reset Zoom"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Embedded Print & Page Break Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: 13in 8.5in;
            margin: 0 !important;
          }
          html, body {
            width: 13in !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Trebuchet MS', Arial, sans-serif !important;
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
            width: 13in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }
          .syllabus-page-sheet {
            width: 13in !important;
            height: 8.5in !important;
            min-height: 8.5in !important;
            max-height: 8.5in !important;
            margin: 0 !important;
            padding: 0.5in 0.6in 0.45in 0.6in !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-hidden,
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen container with scroll wrapper */}
      <div className="p-4 md:p-8 overflow-x-auto max-h-[88vh] print:max-h-none print:overflow-visible print:p-0 bg-neutral-200/80 dark:bg-neutral-950 flex flex-col items-center">
        <div
          id="official-syllabus-document"
          className="w-full flex flex-col items-center gap-8 print:gap-0 transition-transform origin-top"
          style={{ transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined }}
        >
          {sheetBuilders.map((builder, idx) => builder(idx + 1, computedTotal))}
        </div>
      </div>
    </div>
  );
};
