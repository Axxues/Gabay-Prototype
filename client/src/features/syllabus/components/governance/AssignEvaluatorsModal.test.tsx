import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignEvaluatorsModal } from './AssignEvaluatorsModal';

describe('AssignEvaluatorsModal', () => {
  const mockGroup = {
    id: 'grp-1',
    courseCode: 'CSPC 103',
    courseTitle: 'Information and Knowledge Management',
    collegeId: 'col-1',
    instructorIds: ['u1'], // Santos is the instructor
    evaluators: []
  };

  const mockUsers = [
    { id: 'u1', name: 'Prof. Santos', role: 'faculty', collegeId: 'col-1' }, // Course instructor (must be excluded)
    { id: 'u2', name: 'Prof. Reyes', role: 'faculty', collegeId: 'col-1' },   // Eligible
    { id: 'u3', name: 'Prof. Garcia', role: 'faculty', collegeId: 'col-1' },  // Eligible
    { id: 'u4', name: 'Prof. Lee', role: 'faculty', collegeId: 'col-2' },     // Different college (must be excluded)
  ];

  it('filters evaluators strictly to same college and excludes course instructors', () => {
    const onConfirm = vi.fn();
    render(
      <AssignEvaluatorsModal
        isOpen={true}
        group={mockGroup as any}
        users={mockUsers as any}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    // Course instructor Santos must not appear
    expect(screen.queryByText('Prof. Santos')).not.toBeInTheDocument();
    // Faculty from another college Lee must not appear
    expect(screen.queryByText('Prof. Lee')).not.toBeInTheDocument();
    // Eligible faculty must appear
    expect(screen.getByText('Prof. Reyes')).toBeInTheDocument();
    expect(screen.getByText('Prof. Garcia')).toBeInTheDocument();

    // Select Reyes and Garcia
    fireEvent.click(screen.getByText('Prof. Reyes'));
    fireEvent.click(screen.getByText('Prof. Garcia'));

    const confirmBtn = screen.getByRole('button', { name: /confirm assignment/i });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('grp-1', [
      { id: 'u2', name: 'Prof. Reyes' },
      { id: 'u3', name: 'Prof. Garcia' }
    ]);
  });
});
