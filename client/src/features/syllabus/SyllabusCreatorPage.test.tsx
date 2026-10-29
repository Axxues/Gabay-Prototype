import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import { makeSyllabusGroupId } from './hooks/useSyllabusLifecycle';
import * as LMSContext from '../../shared/context/LMSContext';

describe('SyllabusCreatorPage', () => {
  const mockFacultyUser = { id: 'usr-1', name: 'Floribeth Cuison', role: 'faculty' };

  const mockReleasedCourse = {
    id: 'c-101',
    code: 'CSPC 101',
    title: 'Intro to Computing',
    section: 'BSCS 1A',
    instructorId: 'usr-1',
    instructorName: 'Floribeth Cuison',
    term: 'First Semester AY 2026-2027',
    schoolYear: '2026-2027',
    semester: 'First',
    collegeId: 'col-1',
    departmentId: 'dept-1'
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders page header and does NOT contain personal sandbox or standalone new syllabus buttons', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [],
      db: { courses: [] },
      showAlert: vi.fn(),
    } as any);

    render(<SyllabusCreatorPage />);
    expect(screen.getByRole('heading', { name: /Syllabus Development/i })).toBeInTheDocument();
    // Personal sandbox must not exist
    expect(screen.queryByText(/Personal Sandbox/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Syllabus/i })).not.toBeInTheDocument();
    // Informs user that syllabus creation is tied to chair-approved courses
    expect(screen.getByText(/No Assigned Courses Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Syllabus development is strictly tied to assigned courses approved and released/i)).toBeInTheDocument();
  });

  it('shows locked state for assigned course pending chair approval/release', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [mockReleasedCourse],
      db: { courses: [mockReleasedCourse] },
      showAlert: vi.fn(),
    } as any);

    render(<SyllabusCreatorPage />);
    expect(screen.getByText('CSPC 101')).toBeInTheDocument();
    expect(screen.getByText(/Pending Chair Release/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Syllabus Studio/i })).not.toBeInTheDocument();
  });

  it('allows opening Syllabus Studio and editing wizard only when course is released/approved by chair', () => {
    // Seed record as released by chair (in_development)
    const groupId = makeSyllabusGroupId(mockReleasedCourse);
    localStorage.setItem(
      'gabay_syllabus_lifecycle_records',
      JSON.stringify({
        [groupId]: {
          groupId,
          status: 'in_development',
          history: []
        }
      })
    );

    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [mockReleasedCourse],
      db: { courses: [mockReleasedCourse] },
      showAlert: vi.fn(),
    } as any);

    render(<SyllabusCreatorPage />);

    // Studio can now be opened
    const openStudioBtn = screen.getByRole('button', { name: /Open Syllabus Studio/i });
    expect(openStudioBtn).toBeInTheDocument();
    fireEvent.click(openStudioBtn);

    // Inside Studio, wizard steps are rendered
    expect(screen.getAllByText(/Course Info/i).length).toBeGreaterThan(0);
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/Outcomes/i).length).toBeGreaterThan(0);

    // Document preview toggles inside studio
    const previewToggle = screen.getByRole('button', { name: /Document Preview/i });
    fireEvent.click(previewToggle);
    expect(screen.getAllByText(/Don Mariano Marcos Memorial State University/i).length).toBeGreaterThan(0);
  });

  it('redirects or denies student role if accessed (Review Focus 5)', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-2', name: 'Student John', role: 'student' },
      activeRole: 'student',
      courses: [],
      showAlert: vi.fn(),
    } as any);
    render(<SyllabusCreatorPage />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });
});
