import { useState, useCallback, useMemo } from 'react';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../shared/data/syllabusData';
import type { SyllabusDraftItem } from '../types/creator';

export const STORAGE_KEY = 'gabay_syllabus_creator_drafts';

export function createBaselineSyllabus(overrides?: Partial<OfficialSyllabusData>): OfficialSyllabusData {
  return {
    institution: {
      university: 'Don Mariano Marcos Memorial State University',
      college: 'College of Computer Science',
      formCode: 'DMMMSU-INS-F003',
      revision: 'REV. 02 (06.23.2025)'
    },
    courseInfo: {
      code: 'CS 101',
      title: 'Introduction to Computing',
      semester: 'First Semester',
      academicYear: '2026-2027',
      type: 'Lecture and Laboratory',
      credit: '3 units',
      lectureHours: '2 hours/week',
      labHours: '3 hours/week',
      prerequisite: 'None',
      description: 'An introductory course covering computing concepts, computational thinking, and software applications.'
    },
    facultyMembers: [
      {
        name: 'Faculty Member',
        sections: [
          {
            section: 'BSCS 1A',
            schedule: 'MWF 08:00 AM - 09:00 AM',
            room: 'LR 101'
          }
        ],
        consultation: 'MWF 01:00 PM - 03:00 PM'
      }
    ],
    institutionalStatements: {
      ...OFFICIAL_SYLLABUS_CSPC112.institutionalStatements
    },
    programOutcomes: [
      ...OFFICIAL_SYLLABUS_CSPC112.programOutcomes
    ],
    courseOutcomes: [
      { number: 1, statement: 'Understand the fundamental principles and concepts of computing and problem solving.' },
      { number: 2, statement: 'Apply basic algorithms and software tools to resolve structured computational problems.' },
      { number: 3, statement: 'Demonstrate professional and ethical responsibility in utilizing computing technologies.' }
    ],
    courseRequirements: {
      major: [
        'Major Course Outputs',
        'Class Standing (Quizzes, Seatwork, Assignments, Recitation/Reporting, Project)',
        'Major Examinations (Midterm and Final Examination)'
      ],
      other: [
        'Active classroom and lab participation'
      ]
    },
    gradingSystem: {
      termFormula: 'Midterm Grade/Final Term Grade = 60% Class Standing + 40% ME/FE',
      finalFormula: 'Final Grade = 40% Midterm Grade + 60% Final Term Grade',
      classStandingComponents: [
        'Quizzes: 30%',
        'Seatwork & Assignments: 20%',
        'Laboratory Activities & Projects: 30%',
        'Recitation & Class Participation: 20%'
      ],
      passingGrade: '75% (3.00)'
    },
    projectRubrics: [
      ...OFFICIAL_SYLLABUS_CSPC112.projectRubrics
    ],
    classroomPolicies: [
      'Class attendance and punctuality must be observed in accordance with the Student Code of Discipline.',
      'Academic integrity is strictly enforced; plagiarism or unauthorized collaboration will result in a zero mark.',
      'Laboratory exercises and assignments submitted after the deadline will incur late penalties unless officially excused.'
    ],
    courseOutline: [
      {
        timeFrame: 'Week 1 - 4',
        title: 'Module 1: Orientation & Foundations of Computing',
        topics: [
          'Class Orientation, PVMGO, and University Quality Policy',
          'Course Overview, Grading System, and Classroom Policies',
          'History and Evolution of Computing Machinery',
          'Data Representation, Number Systems, and Logic'
        ]
      },
      {
        timeFrame: 'Week 5 - 8',
        title: 'Module 2: Computer Hardware, Software & Algorithms',
        topics: [
          'Computer Architecture and Peripheral Systems',
          'Operating Systems and Systems Software',
          'Algorithm Design and Flowcharting',
          'Introduction to Programming Concepts'
        ]
      },
      {
        timeFrame: 'Week 9',
        title: 'MIDTERM EXAMINATION',
        topics: ['Comprehensive Assessment covering Modules 1 and 2']
      },
      {
        timeFrame: 'Week 10 - 13',
        title: 'Module 3: Networks, Internet & Databases',
        topics: [
          'Data Communications and Computer Networks',
          'The Internet, Web Technologies, and Cloud Computing',
          'Database Fundamentals and Information Systems'
        ]
      },
      {
        timeFrame: 'Week 14 - 17',
        title: 'Module 4: Security, Ethics & Emerging Technologies',
        topics: [
          'Information Security, Privacy, and Cyber Hygiene',
          'Artificial Intelligence, Automation, and Future Trends',
          'Social, Legal, and Ethical Implications in Computing'
        ]
      },
      {
        timeFrame: 'Week 18',
        title: 'FINAL EXAMINATION',
        topics: ['Comprehensive Assessment covering Modules 3 and 4']
      }
    ],
    learningPlan: [
      {
        week: 'Week 1 - 4',
        hoursLab: 12,
        hoursLec: 8,
        learningOutcomes: [
          'Explain the university PVMGO and course learning expectations.',
          'Identify the fundamental components of computing systems and data representations.'
        ],
        topics: [
          'University Orientation, PVMGO and VMGO Alignment',
          'Foundations of Computing and Number Systems'
        ],
        sdgCoherence: {
          goal: 'SDG 4',
          title: 'Quality Education',
          description: 'Ensuring inclusive and equitable quality computing education for all learners.'
        },
        methodology: ['Lecture-Discussion', 'Demonstration Method', 'Interactive Problem Solving'],
        resources: ['PowerPoint Presentation', 'Course LMS', 'Reference Books', 'Smart TV / Projector'],
        assessment: ['Orientation Quiz', 'Class Recitation', 'Number System Problem Set']
      },
      {
        week: 'Week 5 - 8',
        hoursLab: 12,
        hoursLec: 8,
        learningOutcomes: [
          'Demonstrate algorithm design using pseudo-code and flowcharts.',
          'Differentiate hardware and software components.'
        ],
        topics: [
          'Hardware Architecture & Operating Systems',
          'Algorithm Design and Structured Logic'
        ],
        sdgCoherence: {
          goal: 'SDG 9',
          title: 'Industry, Innovation and Infrastructure',
          description: 'Fostering innovation and computational problem-solving capacity.'
        },
        methodology: ['Demonstration Method', 'Collaborative Learning', 'Hands-on Lab Exercise'],
        resources: ['Flowcharting Software', 'IDE', 'Digital eBooks'],
        assessment: ['Laboratory Exercises', 'Module 2 Quiz', 'Preliminary Algorithm Project']
      },
      {
        week: 'Week 10 - 13',
        hoursLab: 12,
        hoursLec: 8,
        learningOutcomes: [
          'Illustrate network topologies and basic database operations.',
          'Explain internet communications and cloud services.'
        ],
        topics: [
          'Computer Networks and Web Technologies',
          'Database Management Systems'
        ],
        sdgCoherence: {
          goal: 'SDG 4',
          title: 'Quality Education',
          description: 'Enhancing digital literacy and information communication skills.'
        },
        methodology: ['Technology-Based Learning', 'Lecture-Discussion', 'Practical Demonstration'],
        resources: ['Web Browser', 'Database Tools', 'Network Simulation Utility'],
        assessment: ['Hands-on Lab Exam', 'Research Assignment', 'Midterm Project Presentation']
      },
      {
        week: 'Week 14 - 17',
        hoursLab: 12,
        hoursLec: 8,
        learningOutcomes: [
          'Evaluate emerging trends including artificial intelligence and cloud computing.',
          'Adhere to cyber ethics, copyright laws, and computing safety standards.'
        ],
        topics: [
          'Information Security and Ethics',
          'Emerging Technologies and Future of Computing'
        ],
        sdgCoherence: {
          goal: 'SDG 8',
          title: 'Decent Work and Economic Growth',
          description: 'Equipping students with modern skills for productive computing careers.'
        },
        methodology: ['Brainstorming', 'Collaborative Learning', 'Seminar Discussion'],
        resources: ['Case Studies', 'Online Tech Journals', 'Multimedia Presentations'],
        assessment: ['Final Course Project', 'Case Study Report', 'Final Examination']
      }
    ],
    courseMap: [
      {
        coNumber: 1,
        coStatement: 'Understand the fundamental principles and concepts of computing and problem solving.',
        poAlignments: { 1: 'I', 2: 'I', 3: '', 4: '', 5: '', 6: 'I', 7: '', 8: '', 9: '', 10: '', 11: '' }
      },
      {
        coNumber: 2,
        coStatement: 'Apply basic algorithms and software tools to resolve structured computational problems.',
        poAlignments: { 1: 'I', 2: 'P', 3: 'P', 4: '', 5: 'I', 6: 'P', 7: '', 8: '', 9: '', 10: '', 11: '' }
      },
      {
        coNumber: 3,
        coStatement: 'Demonstrate professional and ethical responsibility in utilizing computing technologies.',
        poAlignments: { 1: '', 2: '', 3: '', 4: 'I', 5: '', 6: '', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' }
      }
    ],
    references: [
      {
        citation: 'Brookshear, G., & Brylow, D. Computer Science: An Overview (13th Edition). Pearson.',
        year: '2020',
        doiOrPublisher: 'Pearson Higher Education'
      },
      {
        citation: 'Dale, N., & Lewis, J. Computer Science Illuminated (7th Edition). Jones & Bartlett Learning.',
        year: '2019',
        doiOrPublisher: 'Jones & Bartlett Learning'
      }
    ],
    signatories: {
      preparedBy: [{ name: 'Faculty Member', title: 'Faculty Member' }],
      recommendingApproval: { name: 'Program Chairperson', title: 'Program Chairperson' },
      approved: { name: 'Dean / Institute Director', title: 'Dean / Institute Director' }
    },
    ...overrides
  };
}

function loadStoredDrafts(): SyllabusDraftItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function useSyllabusDraftsStorage() {
  const [drafts, setDrafts] = useState<SyllabusDraftItem[]>(() => {
    const stored = loadStoredDrafts();
    if (stored.length > 0) return stored;
    const initialDraft: SyllabusDraftItem = {
      id: 'draft-default',
      title: 'CS 101 - Introduction to Computing',
      courseCode: 'CS 101',
      updatedAt: new Date().toISOString(),
      data: createBaselineSyllabus()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([initialDraft]));
    } catch {
      // quota or private mode fallback
    }
    return [initialDraft];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    return drafts[0]?.id || 'draft-default';
  });

  const persistDrafts = useCallback((nextDrafts: SyllabusDraftItem[]) => {
    setDrafts(nextDrafts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts));
    } catch (e) {
      console.warn('[useSyllabusDraftsStorage] Failed to persist to localStorage:', e);
    }
  }, []);

  const activeDraft = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || drafts[0] || null;
  }, [drafts, activeDraftId]);

  const selectDraft = useCallback((id: string) => {
    setActiveDraftId(id);
  }, []);

  const createDraft = useCallback((initialData?: Partial<OfficialSyllabusData>, title?: string): SyllabusDraftItem => {
    const data = createBaselineSyllabus(initialData);
    const resolvedTitle = title || `${data.courseInfo.code || 'New Course'} Syllabus`;
    const newDraft: SyllabusDraftItem = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: resolvedTitle,
      courseCode: data.courseInfo.code || 'NEW',
      updatedAt: new Date().toISOString(),
      data
    };
    persistDrafts([newDraft, ...drafts]);
    setActiveDraftId(newDraft.id);
    return newDraft;
  }, [drafts, persistDrafts]);

  const updateActiveDraft = useCallback((nextData: OfficialSyllabusData) => {
    if (!activeDraft) return;
    const updatedDrafts = drafts.map(d => {
      if (d.id === activeDraft.id) {
        return {
          ...d,
          title: `${nextData.courseInfo.code || 'Course'} - ${nextData.courseInfo.title || 'Untitled'}`,
          courseCode: nextData.courseInfo.code || d.courseCode,
          updatedAt: new Date().toISOString(),
          data: nextData
        };
      }
      return d;
    });
    persistDrafts(updatedDrafts);
  }, [activeDraft, drafts, persistDrafts]);

  const cloneDraft = useCallback((sourceId: string): SyllabusDraftItem => {
    const source = drafts.find(d => d.id === sourceId) || activeDraft;
    const clonedData = source ? JSON.parse(JSON.stringify(source.data)) : createBaselineSyllabus();
    const newDraft: SyllabusDraftItem = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `Copy of ${source ? source.title : 'Syllabus'}`,
      courseCode: clonedData.courseInfo.code || 'COPY',
      updatedAt: new Date().toISOString(),
      data: clonedData
    };
    persistDrafts([newDraft, ...drafts]);
    setActiveDraftId(newDraft.id);
    return newDraft;
  }, [drafts, activeDraft, persistDrafts]);

  const deleteDraft = useCallback((targetId: string) => {
    const remaining = drafts.filter(d => d.id !== targetId);
    if (remaining.length === 0) {
      const freshDraft: SyllabusDraftItem = {
        id: `draft-${Date.now()}`,
        title: 'New Syllabus Draft',
        courseCode: 'CS 101',
        updatedAt: new Date().toISOString(),
        data: createBaselineSyllabus()
      };
      persistDrafts([freshDraft]);
      setActiveDraftId(freshDraft.id);
      return;
    }
    persistDrafts(remaining);
    if (activeDraftId === targetId) {
      setActiveDraftId(remaining[0].id);
    }
  }, [drafts, activeDraftId, persistDrafts]);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    selectDraft,
    createDraft,
    updateActiveDraft,
    cloneDraft,
    deleteDraft
  };
}
