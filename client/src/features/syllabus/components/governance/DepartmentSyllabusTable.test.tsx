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
});
