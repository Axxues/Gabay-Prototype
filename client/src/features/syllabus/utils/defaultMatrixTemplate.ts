import type { EvaluationMatrix } from '../types/lifecycle';

export const DEFAULT_EVALUATION_MATRIX: EvaluationMatrix = {
  version: 1,
  updatedAt: '2026-10-31T00:00:00.000Z',
  sections: [
    {
      id: 'format',
      title: 'FORMAT',
      criteria: [
        { id: 'fmt-1', text: 'Margins (1" on all sides)' },
        { id: 'fmt-2', text: 'Font size (Trebuchet, 11)' },
        { id: 'fmt-3', text: 'Term Format: (e.g. First Semester, Academic Year 2025-2026)' },
        { id: 'fmt-4', text: 'Correct spelling' },
        { id: 'fmt-5', text: 'Course No. & Descriptive Title: (e.g. CSCC 101 - Computing Fundamentals)' },
        { id: 'fmt-6', text: 'Name of Faculty Member/s: (e.g. Juan D. Cruz)' },
        {
          id: 'fmt-7',
          text: 'Schedule & Room Assignment: (align with the name of the faculty member and consistent with faculty workload; include Section, Schedule, Room) (e.g. 1A 08:00-09:00 MWF Room 101)'
        }
      ]
    },
    {
      id: 'part-1',
      title: 'Part I: Course Information',
      criteria: [
        { id: 'p1-1', text: "PVMG aligned with the University's" },
        { id: 'p1-2', text: "Graduate Attributes aligned with University's (6 attributes)" },
        { id: 'p1-3', text: "Core Values aligned with University's (SPECIAL)" },
        { id: 'p1-4', text: "Program Outcomes aligned with the program's curriculum and CHED Memo (11 outcomes)" },
        { id: 'p1-5', text: 'Course Type (Lecture/Laboratory)' },
        { id: 'p1-6', text: 'Course Credit: n units' },
        { id: 'p1-7', text: 'Course Description: align with CMO 25, s. 2015' },
        {
          id: 'p1-8',
          text: 'Contact hours ([with lab component: Lecture 2 hours/week, Laboratory 3 hours/week], [w/o lab component: 3 hours/week])'
        },
        {
          id: 'p1-9',
          text: 'Course Prerequisites: specified and aligned with the curriculum (e.g. CSCC 101 - Computing Fundamentals)'
        },
        { id: 'p1-10', text: 'Course Outcomes' },
        { id: 'p1-11', text: 'Course requirements: (major examinations; composition of the class standing)' },
        {
          id: 'p1-12',
          text: 'Grading System includes the ff.: (a. MG/TFG: 60% CS and 40% Major Exam; b. FG = 40% MG + 60% TFG; c. Composition and percentage of the class standing; d. Formula of the transmutation)'
        },
        { id: 'p1-13', text: 'Classroom Policies' },
        {
          id: 'p1-14',
          text: 'Consultation Hours (Align with the names of the faculty members; if possible 1 sched for TTh and 1 sched for MWF)'
        }
      ]
    },
    {
      id: 'part-2',
      title: 'Part II: Course Outline and Time Frame',
      criteria: [
        { id: 'p2-1', text: 'CMO 25, s. 2015 compliant' },
        { id: 'p2-2', text: 'Aligned with the SDG (specify target number and desc)' },
        { id: 'p2-3', text: 'Laboratory Activities (aligned with each topic)' },
        { id: 'p2-4', text: 'Inclusion of Midterm and Final examination in week 9 and 18' },
        { id: 'p2-5', text: 'Consistent with the content in the Learning Plan' },
        { id: 'p2-6', text: 'Consistent with the schedule in the Learning Plan' }
      ]
    },
    {
      id: 'part-3',
      title: 'Part III: Learning Plan',
      criteria: [
        { id: 'p3-1', text: 'Learning Outcomes: more specific than the course outcomes' },
        { id: 'p3-2', text: 'Consistent with the content in the Course Outline' },
        { id: 'p3-3', text: 'Consistent with the time allotment in the Course Outline' },
        {
          id: 'p3-4',
          text: 'SDG Coherence: specify the SDG number and title; specify which target # and description that the course topic/s contribute to'
        },
        { id: 'p3-5', text: 'Methodology: Aligned with the assessment' },
        { id: 'p3-6', text: 'Resources: specify chapter/unit number from the given reference(s)' },
        { id: 'p3-7', text: 'Assessment: Aligned with the methodology, Aligned with learning outcomes' }
      ]
    },
    {
      id: 'part-4',
      title: 'Part IV: Course Map',
      criteria: [{ id: 'p4-1', text: 'Alignment of Course Outcomes to the Program Outcomes' }]
    },
    {
      id: 'part-5',
      title: 'Part V: References',
      criteria: [
        { id: 'p5-1', text: 'Style: APA 7th Ed.' },
        { id: 'p5-2', text: '20% of the titles are published within the last 5 years' },
        { id: 'p5-3', text: 'At least 5 titles' },
        { id: 'p5-4', text: 'Ebooks must appear on the CCS Learning Resources Website' },
        { id: 'p5-5', text: 'Consistent with the content of the ILR' },
        { id: 'p5-6', text: 'Use: Chairperson, Program Dean, CCS' }
      ]
    }
  ]
};
