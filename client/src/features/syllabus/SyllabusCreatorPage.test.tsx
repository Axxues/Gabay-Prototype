import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import { makeSyllabusGroupId } from './hooks/useSyllabusLifecycle';
import * as LMSContext from '../../shared/context/LMSContext';
import * as collabApi from './api/syllabusCollaborationApi';

vi.mock('./api/syllabusCollaborationApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./api/syllabusCollaborationApi')>();
  return {
    ...actual,
    fetchRemoteDraft: vi.fn().mockResolvedValue(null),
    saveRemoteDraft: vi.fn(),
    sendRemotePresence: vi.fn().mockResolvedValue(undefined),
    removeRemotePresence: vi.fn().mockResolvedValue(undefined)
  };
});

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

  const renderWithRouter = (initialEntries = ['/syllabus-development']) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/syllabus-development" element={<SyllabusCreatorPage />} />
          <Route path="/syllabus-development/studio/:groupId" element={<SyllabusCreatorPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders page header and does NOT contain personal sandbox or standalone new syllabus buttons', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [],
      db: { courses: [] },
      showAlert: vi.fn(),
    } as any);

    renderWithRouter();
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

    renderWithRouter();
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

    renderWithRouter();

    // In-development cards read "Draft" on the hub.
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.queryByText(/IN DEVELOPMENT/i)).not.toBeInTheDocument();

    // Studio can now be opened
    const openStudioBtn = screen.getByRole('button', { name: /Open Syllabus Studio/i });
    expect(openStudioBtn).toBeInTheDocument();
    fireEvent.click(openStudioBtn);

    // Inside Studio, wizard steps are rendered
    expect(screen.getAllByText(/Course Info/i).length).toBeGreaterThan(0);
    const nextBtn = screen.getByRole('button', { name: /Next Section/i });
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
    renderWithRouter();
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });

  it('re-pushes a local draft that is newer than the server copy', async () => {
    const groupId = makeSyllabusGroupId(mockReleasedCourse);
    const localSyllabus: any = {
      courseInfo: { code: 'CSPC 101', title: 'Intro to Computing (local edit)' }
    };
    localStorage.setItem(
      'gabay_syllabus_lifecycle_records',
      JSON.stringify({
        [groupId]: {
          id: groupId,
          status: 'in_development',
          syllabusData: localSyllabus,
          updatedAt: new Date().toISOString(),
          history: []
        }
      })
    );

    // Server still holds a much older copy (the earlier save never landed).
    vi.mocked(collabApi.fetchRemoteDraft).mockResolvedValue({
      id: 'syl-draft-c-101',
      payload: {
        syllabusData: { courseInfo: { code: 'CSPC 101', title: 'stale' } },
        updatedAt: 1
      }
    });
    vi.mocked(collabApi.saveRemoteDraft).mockResolvedValue('syl-draft-c-101');

    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [mockReleasedCourse],
      db: { courses: [mockReleasedCourse] },
      showAlert: vi.fn()
    } as any);

    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Open Syllabus Studio/i }));

    await vi.waitFor(() => expect(collabApi.saveRemoteDraft).toHaveBeenCalledTimes(1));
    expect(collabApi.saveRemoteDraft).toHaveBeenCalledWith(
      'c-101',
      localSyllabus,
      'usr-1',
      undefined,
      expect.anything(),
      'in_development',
      undefined
    );
    // The stale server copy must not be pulled over the local edit.
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument();
  });

  it('adopts a server copy that is newer than anything local', async () => {
    const groupId = makeSyllabusGroupId(mockReleasedCourse);
    localStorage.setItem(
      'gabay_syllabus_lifecycle_records',
      JSON.stringify({
        [groupId]: {
          id: groupId,
          status: 'in_development',
          syllabusData: { courseInfo: { code: 'CSPC 101', title: 'old local' } },
          updatedAt: new Date(0).toISOString(),
          history: []
        }
      })
    );

    vi.mocked(collabApi.fetchRemoteDraft).mockResolvedValue({
      id: 'syl-draft-c-101',
      payload: {
        syllabusData: { courseInfo: { code: 'CSPC 101', title: 'newer remote' } },
        updatedAt: Date.now() + 60000
      }
    });

    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [mockReleasedCourse],
      db: { courses: [mockReleasedCourse] },
      showAlert: vi.fn()
    } as any);

    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Open Syllabus Studio/i }));

    await act(async () => {
      await vi.waitFor(() => expect(collabApi.fetchRemoteDraft).toHaveBeenCalled());
    });
    expect(collabApi.saveRemoteDraft).not.toHaveBeenCalled();
  });

  it('shows the Evaluation Matrix tab to chairs only', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-9', name: 'Chair Person', role: 'faculty', title: 'Department Chairperson', collegeId: 'col-1' },
      activeRole: 'faculty',
      courses: [],
      db: { courses: [] },
      showAlert: vi.fn()
    } as any);
    const { unmount } = renderWithRouter();
    const tab = screen.getByRole('button', { name: /Evaluation Matrix/i });
    fireEvent.click(tab);
    expect(screen.getByRole('button', { name: /Save Template/i })).toBeInTheDocument();
    unmount();

    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [],
      db: { courses: [] },
      showAlert: vi.fn()
    } as any);
    renderWithRouter();
    expect(screen.queryByRole('button', { name: /Evaluation Matrix/i })).not.toBeInTheDocument();
  });

  it('blocks opening studio and editing when syllabus development is locked', () => {
    const showAlert = vi.fn();
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: mockFacultyUser,
      activeRole: 'faculty',
      courses: [{ ...mockReleasedCourse, syllabusStatus: 'locked' }],
      db: { courses: [{ ...mockReleasedCourse, syllabusStatus: 'locked' }] },
      showAlert,
    } as any);

    renderWithRouter();
    expect(screen.getByText(/Pending Chair Release/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Syllabus Studio/i })).not.toBeInTheDocument();
  });
});
