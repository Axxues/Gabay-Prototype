// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeRole: 'faculty',
  activeUser: { id: 'u-fac', name: 'Faculty', role: 'faculty' } as any,
  submissions: [] as any[],
  submitActivity: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
  deleteActivity: vi.fn(),
  openSpeedGrader: vi.fn(),
}));

vi.mock('../../shared/utils/fileUploader', async () => {
  const actual = await vi.importActual<any>('../../shared/utils/fileUploader');
  return {
    ...actual,
    uploadFileToPublic: vi.fn(async (file: File) => ({
      name: file.name,
      url: `/uploaded/${file.name}`,
      size: `${file.size} B`,
      fileId: 'mock-file-id',
    })),
  };
});

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      activities: [
        { id: '1', courseId: 'c1', title: 'General Activity', format: 'classic', published: true, assessmentType: 'activity', pointsPossible: 20, term: 'midterm' },
        {
          id: '2',
          courseId: 'c1',
          title: 'Research Assignment',
          format: 'classic',
          published: true,
          assessmentType: 'assignment',
          pointsPossible: 50,
          term: 'midterm',
          rubric: [
            {
              id: 'r-asg-1',
              title: 'Literature Review',
              description: 'Synthesizes academic papers accurately.',
              points: 50,
              ratings: [
                { points: 50, description: 'Exemplary Review' },
                { points: 25, description: 'Basic Summary' },
                { points: 0, description: 'Incomplete' },
              ],
            },
          ],
        },
        {
          id: '3',
          courseId: 'c1',
          title: 'Team Project',
          format: 'classic',
          published: true,
          assessmentType: 'project',
          pointsPossible: 100,
          term: 'finals',
          metadata: { groupMode: 'group', maxGroupSize: 4 },
          rubric: [
            {
              id: 'r-proj-1',
              title: 'Architecture & Scalability',
              description: 'Well-structured multi-tier design.',
              points: 100,
              ratings: [
                { points: 100, description: 'Production Ready' },
                { points: 60, description: 'Minor Technical Debt' },
                { points: 0, description: 'Not Scalable' },
              ],
            },
          ],
        },
        {
          id: '4',
          courseId: 'c1',
          title: 'Final Presentation',
          format: 'classic',
          published: true,
          assessmentType: 'presentation',
          pointsPossible: 30,
          term: 'finals',
          metadata: { presentationMode: 'in_person', durationMinutes: 15 },
          rubric: [
            {
              id: 'r-pres-1',
              title: 'Slide Delivery & Q&A',
              description: 'Professional delivery within the 15-minute window.',
              points: 30,
              ratings: [
                { points: 30, description: 'Fluent Delivery' },
                { points: 15, description: 'Adequate Timing' },
                { points: 0, description: 'Over Time' },
              ],
            },
          ],
        },
      ],
      submissions: mocks.submissions,
      modules: [],
    },
    activeRole: mocks.activeRole,
    activeUser: mocks.activeUser,
    effectiveTermsForCourse: () => ['midterm', 'finals'],
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
    submitActivity: mocks.submitActivity,
    deleteActivity: mocks.deleteActivity,
    openSpeedGrader: mocks.openSpeedGrader,
  }),
}));

import { AssignmentsView } from './AssignmentsView';
import { ProjectsView } from './ProjectsView';
import { PresentationsView } from './PresentationsView';

describe('Dedicated Assessment Views', () => {
  test('AssignmentsView only displays assignments', () => {
    render(<AssignmentsView courseId="c1" selectedAssignmentId={null} onSelectAssignment={() => {}} />);
    expect(screen.getByText('Research Assignment')).toBeDefined();
    expect(screen.queryByText('General Activity')).toBeNull();
    expect(screen.queryByText('Team Project')).toBeNull();
    expect(screen.queryByText('Final Presentation')).toBeNull();
  });

  test('ProjectsView only displays projects and renders group badge', () => {
    render(<ProjectsView courseId="c1" selectedProjectId={null} onSelectProject={() => {}} />);
    expect(screen.getByText('Team Project')).toBeDefined();
    expect(screen.getByText('Group Project')).toBeDefined();
    expect(screen.queryByText('Research Assignment')).toBeNull();
  });

  test('PresentationsView only displays presentations and renders format badge', () => {
    render(<PresentationsView courseId="c1" selectedPresentationId={null} onSelectPresentation={() => {}} />);
    expect(screen.getByText('Final Presentation')).toBeDefined();
    expect(screen.getByText('In-Person')).toBeDefined();
    expect(screen.queryByText('Research Assignment')).toBeNull();
  });

  test('PresentationsView renders complete criteria and rating levels when a presentation is selected', () => {
    render(<PresentationsView courseId="c1" selectedPresentationId="4" onSelectPresentation={() => {}} />);
    // Presentation title
    expect(screen.getByText('Final Presentation')).toBeDefined();
    // Rubric title & summary
    expect(screen.getByText('Presentation Rubrics')).toBeDefined();
    expect(screen.getByText(/1 criterion · 30 total pts/i)).toBeDefined();
    // Criterion title, description, and points
    expect(screen.getByText('Slide Delivery & Q&A')).toBeDefined();
    expect(screen.getByText('Professional delivery within the 15-minute window.')).toBeDefined();
    // Rating scale with all levels
    expect(screen.getByText('Fluent Delivery')).toBeDefined();
    expect(screen.getByText('Adequate Timing')).toBeDefined();
    expect(screen.getByText('Over Time')).toBeDefined();
  });

  test('AssignmentsView renders complete criteria and rating levels when an assignment is selected', () => {
    render(<AssignmentsView courseId="c1" selectedAssignmentId="2" onSelectAssignment={() => {}} />);
    expect(screen.getByText('Research Assignment')).toBeDefined();
    expect(screen.getByText('Assignment Rubrics')).toBeDefined();
    expect(screen.getByText('Literature Review')).toBeDefined();
    expect(screen.getByText('Synthesizes academic papers accurately.')).toBeDefined();
    expect(screen.getByText('Exemplary Review')).toBeDefined();
    expect(screen.getByText('Incomplete')).toBeDefined();
  });

  test('ProjectsView renders complete criteria and rating levels when a project is selected', () => {
    render(<ProjectsView courseId="c1" selectedProjectId="3" onSelectProject={() => {}} />);
    expect(screen.getByText('Team Project')).toBeDefined();
    expect(screen.getByText('Project Rubrics')).toBeDefined();
    expect(screen.getByText('Architecture & Scalability')).toBeDefined();
    expect(screen.getByText('Well-structured multi-tier design.')).toBeDefined();
    expect(screen.getByText('Production Ready')).toBeDefined();
    expect(screen.getByText('Not Scalable')).toBeDefined();
  });

  describe('Student multi-file attachment in PresentationsView', () => {
    beforeEach(() => {
      mocks.activeRole = 'student';
      mocks.activeUser = { id: 'u-stud-1', name: 'Student One', role: 'student' };
      mocks.submissions = [];
      mocks.submitActivity.mockReset();
      mocks.showAlert.mockReset();
    });

    test('student sees multi-file upload dropzone and can attach multiple files', async () => {
      const { container } = render(
        <PresentationsView courseId="c1" selectedPresentationId="4" onSelectPresentation={() => {}} />
      );

      expect(screen.getByRole('heading', { name: /Submit Presentation Materials/i })).toBeDefined();
      expect(screen.getByText('Attach slide deck or handout files')).toBeDefined();
      expect(screen.queryByPlaceholderText('Attach file (e.g. defense-slides.pdf)')).toBeNull();

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      expect(fileInput.multiple).toBe(true);

      const file1 = new File(['slides content'], 'defense-deck.pptx', { type: 'application/vnd.ms-powerpoint' });
      const file2 = new File(['handout content'], 'handout.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [file1, file2] } });

      expect(screen.getByText('defense-deck.pptx')).toBeDefined();
      expect(screen.getByText('handout.pdf')).toBeDefined();
      expect(screen.getByText('+ Add more files')).toBeDefined();

      const submitBtn = screen.getByRole('button', { name: /Submit Presentation Materials/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mocks.submitActivity).toHaveBeenCalledTimes(1);
      });

      const [actId, subType, content, primaryName, _ans, _url, _id, _sz, attachments] = mocks.submitActivity.mock.calls[0];
      expect(actId).toBe('4');
      expect(subType).toBe('file');
      expect(primaryName).toBe('defense-deck.pptx');
      expect(attachments).toHaveLength(2);
      expect(attachments[0].name).toBe('defense-deck.pptx');
      expect(attachments[1].name).toBe('handout.pdf');
    });

    test('renders all attached files with preview and download when viewing existing submission', () => {
      mocks.submissions = [
        {
          id: 'sub-pres-1',
          activityId: '4',
          studentId: 'u-stud-1',
          submittedAt: new Date().toISOString(),
          status: 'submitted',
          submissionType: 'file',
          attachments: [
            { name: 'Deck_Final.pdf', url: '/uploads/Deck_Final.pdf', size: '2 MB' },
            { name: 'Appendix.pdf', url: '/uploads/Appendix.pdf', size: '500 KB' },
          ],
        },
      ];

      render(<PresentationsView courseId="c1" selectedPresentationId="4" onSelectPresentation={() => {}} />);

      expect(screen.getByText('Your Presentation Materials')).toBeDefined();
      expect(screen.getByText('Attached Slide & Handout Files (2)')).toBeDefined();
      expect(screen.getByText('Deck_Final.pdf')).toBeDefined();
      expect(screen.getByText('Appendix.pdf')).toBeDefined();

      const downloadLinks = screen.getAllByRole('link', { name: /Download/i });
      expect(downloadLinks).toHaveLength(2);
    });
  });
});
