import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DepartmentSyllabusTable } from './DepartmentSyllabusTable';
import type { SyllabusGroup } from '../../types/lifecycle';

describe('DepartmentSyllabusTable', () => {
  const mockGroups: SyllabusGroup[] = [
    {
      id: 'grp-1',
      courseCode: 'CSPC 103',
      courseTitle: 'Information and Knowledge Management',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1',
      courseIds: ['c1', 'c2'],
      instructorIds: ['u1', 'u2'],
      instructorNames: ['Dr. Santos', 'Prof. Reyes'],
      sections: ['BSCS 3A', 'BSCS 3B'],
      status: 'locked',
      submissionAgreements: { u1: false, u2: false },
      evaluators: [],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'grp-2',
      courseCode: 'CSPC 104',
      courseTitle: 'Data Structures and Algorithms',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1',
      courseIds: ['c3'],
      instructorIds: ['u1'],
      instructorNames: ['Dr. Santos'],
      sections: ['BSCS 2A'],
      status: 'ready_for_evaluation',
      submissionAgreements: { u1: true },
      evaluators: [],
      updatedAt: new Date().toISOString()
    }
  ];

  it('renders department courses, handles bulk selection, and triggers release action', () => {
    const onRelease = vi.fn();
    render(
      <DepartmentSyllabusTable
        groups={mockGroups}
        userRole="chairperson"
        onReleaseCourses={onRelease}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    expect(screen.getByText('CSPC 103')).toBeInTheDocument();
    expect(screen.getByText(/Information and Knowledge Management/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Locked$/i).length).toBeGreaterThanOrEqual(1);

    // Check row checkbox for CSPC 103
    const checkbox = screen.getByRole('checkbox', { name: /select cspc 103/i });
    fireEvent.click(checkbox);

    // Floating bulk action bar should show
    const releaseBtn = screen.getByRole('button', { name: /release selected for development/i });
    fireEvent.click(releaseBtn);
    expect(onRelease).toHaveBeenCalledWith(['grp-1']);
  });

  it('renders assign evaluators action for courses ready for evaluation', () => {
    const onAssign = vi.fn();
    render(
      <DepartmentSyllabusTable
        groups={mockGroups}
        userRole="chairperson"
        onReleaseCourses={vi.fn()}
        onAssignEvaluators={onAssign}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    const assignBtn = screen.getByRole('button', { name: /assign evaluators for cspc 104/i });
    fireEvent.click(assignBtn);
    expect(onAssign).toHaveBeenCalledWith(mockGroups[1]);
  });

  it('restricts release authority strictly to chairperson: dean cannot release locked courses or see bulk release', () => {
    const onRelease = vi.fn();
    render(
      <DepartmentSyllabusTable
        groups={mockGroups}
        userRole="dean"
        isChair={false}
        canRelease={false}
        onReleaseCourses={onRelease}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    // Row-level release button should NOT be rendered for locked courses
    expect(screen.queryByRole('button', { name: /^Release$/i })).not.toBeInTheDocument();

    // Selecting course row should NOT show "Release Selected for Development"
    const checkbox = screen.getByRole('checkbox', { name: /select cspc 103/i });
    fireEvent.click(checkbox);
    expect(screen.queryByRole('button', { name: /release selected for development/i })).not.toBeInTheDocument();
  });

  it('restricts release authority strictly to chairperson: admin cannot release locked courses', () => {
    const onRelease = vi.fn();
    render(
      <DepartmentSyllabusTable
        groups={mockGroups}
        userRole="admin"
        isChair={false}
        canRelease={false}
        onReleaseCourses={onRelease}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /^Release$/i })).not.toBeInTheDocument();
  });

  it('renders lock action for courses in development and triggers onLockCourses', () => {
    const onLock = vi.fn();
    const groupsWithInDev: SyllabusGroup[] = [
      ...mockGroups,
      {
        id: 'grp-3',
        courseCode: 'CCSC 303',
        courseTitle: 'Computer Programming 1',
        schoolYear: '2026-2027',
        semester: 'First',
        collegeId: 'col-1',
        departmentId: 'dept-1',
        courseIds: ['c4'],
        instructorIds: ['u2'],
        instructorNames: ['Prof. Reyes'],
        sections: ['BSCS 1A'],
        status: 'in_development',
        submissionAgreements: { u2: false },
        evaluators: [],
        updatedAt: new Date().toISOString()
      }
    ];

    render(
      <DepartmentSyllabusTable
        groups={groupsWithInDev}
        userRole="chairperson"
        isChair={true}
        onReleaseCourses={vi.fn()}
        onLockCourses={onLock}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    // Row-level lock button for CCSC 303
    const lockBtn = screen.getByRole('button', { name: /lock syllabus development for ccsc 303/i });
    expect(lockBtn).toBeInTheDocument();
    fireEvent.click(lockBtn);
    expect(onLock).toHaveBeenCalledWith(['grp-3']);

    // Checkbox bulk lock
    const checkbox = screen.getByRole('checkbox', { name: /select ccsc 303/i });
    fireEvent.click(checkbox);
    const bulkLockBtn = screen.getByRole('button', { name: /lock selected development/i });
    expect(bulkLockBtn).toBeInTheDocument();
    fireEvent.click(bulkLockBtn);
    expect(onLock).toHaveBeenCalledWith(['grp-3']);
  });

  it('restricts lock action: dean cannot lock courses in development', () => {
    const onLock = vi.fn();
    const groupsWithInDev: SyllabusGroup[] = [
      {
        id: 'grp-3',
        courseCode: 'CCSC 303',
        courseTitle: 'Computer Programming 1',
        schoolYear: '2026-2027',
        semester: 'First',
        collegeId: 'col-1',
        departmentId: 'dept-1',
        courseIds: ['c4'],
        instructorIds: ['u2'],
        instructorNames: ['Prof. Reyes'],
        sections: ['BSCS 1A'],
        status: 'in_development',
        submissionAgreements: { u2: false },
        evaluators: [],
        updatedAt: new Date().toISOString()
      }
    ];

    render(
      <DepartmentSyllabusTable
        groups={groupsWithInDev}
        userRole="dean"
        isChair={false}
        onReleaseCourses={vi.fn()}
        onLockCourses={onLock}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /lock syllabus development/i })).not.toBeInTheDocument();
  });

  describe('Matrix action', () => {
    const groupWithEvaluators: SyllabusGroup = {
      ...mockGroups[1],
      evaluators: [
        { evaluatorId: 'e1', evaluatorName: 'Dr. Cruz', status: 'pending' } as SyllabusGroup['evaluators'][number]
      ]
    };

    const renderTable = (groups: SyllabusGroup[], onOpenMatrix?: (g: SyllabusGroup) => void) =>
      render(
        <DepartmentSyllabusTable
          groups={groups}
          userRole="chairperson"
          onReleaseCourses={vi.fn()}
          onAssignEvaluators={vi.fn()}
          onChairApprove={vi.fn()}
          onDeanApprove={vi.fn()}
          onOpenPreview={vi.fn()}
          onOpenMatrix={onOpenMatrix}
        />
      );

    it('shows Matrix for a group with evaluators and calls onOpenMatrix(group)', () => {
      const onOpenMatrix = vi.fn();
      renderTable([groupWithEvaluators], onOpenMatrix);
      fireEvent.click(screen.getByRole('button', { name: /^Matrix$/i }));
      expect(onOpenMatrix).toHaveBeenCalledWith(groupWithEvaluators);
    });

    it('hides Matrix when the group has no evaluators', () => {
      renderTable([mockGroups[1]], vi.fn());
      expect(screen.queryByRole('button', { name: /^Matrix$/i })).not.toBeInTheDocument();
    });

    it('hides Matrix when onOpenMatrix is not provided', () => {
      renderTable([groupWithEvaluators]);
      expect(screen.queryByRole('button', { name: /^Matrix$/i })).not.toBeInTheDocument();
    });
  });
});
