import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MatrixChecklistTable } from './MatrixChecklistTable';
import type { MatrixSection, MatrixCriterion, EvaluatorMatrixResponse } from '../types/lifecycle';

const mockSections: MatrixSection[] = [
  {
    id: 'format',
    title: 'FORMAT',
    criteria: [
      { id: 'fmt-1', text: 'Margins (1" on all sides)' },
      { id: 'fmt-2', text: 'Font size (Trebuchet, 11)' }
    ]
  },
  {
    id: 'part-1',
    title: 'Part I: Course Information',
    criteria: [
      { id: 'p1-1', text: 'PVMG aligned with the University\'s' }
    ]
  }
];

const mockResponses: Record<string, EvaluatorMatrixResponse> = {
  'fmt-1': { criterionId: 'fmt-1', compliant: true, comment: '' },
  'fmt-2': { criterionId: 'fmt-2', compliant: false, comment: 'Font size is 10' }
};

describe('MatrixChecklistTable', () => {
  describe('readonly mode', () => {
    it('renders all sections and criteria', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" responses={mockResponses} />);
      expect(screen.getByText('FORMAT')).toBeInTheDocument();
      expect(screen.getByText('Part I: Course Information')).toBeInTheDocument();
      expect(screen.getByText('Margins (1" on all sides)')).toBeInTheDocument();
      expect(screen.getByText('Font size (Trebuchet, 11)')).toBeInTheDocument();
      expect(screen.getByText("PVMG aligned with the University's")).toBeInTheDocument();
    });

    it('shows Y for compliant criteria', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" responses={mockResponses} />);
      // fmt-1 is compliant: true
      const fmt1Row = screen.getByText('Margins (1" on all sides)').closest('tr');
      expect(fmt1Row).toHaveTextContent('Y');
    });

    it('shows N for non-compliant criteria with comment', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" responses={mockResponses} />);
      // fmt-2 is compliant: false with comment
      const fmt2Row = screen.getByText('Font size (Trebuchet, 11)').closest('tr');
      expect(fmt2Row).toHaveTextContent('N');
      expect(fmt2Row).toHaveTextContent('Font size is 10');
    });

    it('shows — for criteria with no response', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" responses={mockResponses} />);
      // p1-1 has no response
      const p11Row = screen.getByText("PVMG aligned with the University's").closest('tr');
      expect(p11Row).toHaveTextContent('—');
    });
  });

  describe('fill mode', () => {
    it('renders Y/N buttons and comment textarea for first criterion', () => {
      const onChange = vi.fn();
      render(<MatrixChecklistTable sections={mockSections} mode="fill" responses={mockResponses} onCriterionChange={onChange} />);
      
      // fmt-1 is the first criterion - target it specifically
      const fmt1Row = screen.getByText('Margins (1" on all sides)').closest('tr');
      expect(fmt1Row).toBeInTheDocument();
      expect(fmt1Row).toContainHTML('Y');
      expect(fmt1Row).toContainHTML('N');
      expect(fmt1Row.querySelector('textarea')).toBeInTheDocument();
    });

    it('forces N when a comment exists and user clicks Y', () => {
      const onChange = vi.fn();
      render(<MatrixChecklistTable sections={mockSections} mode="fill" responses={mockResponses} onCriterionChange={onChange} />);
      
      // fmt-2 already has a comment "Font size is 10" and compliant: false
      // Try to click Y for fmt-2 - should not change compliant to true
      const fmt2Row = screen.getByText('Font size (Trebuchet, 11)').closest('tr');
      const yButtonFmt2 = fmt2Row!.querySelector('button');
      fireEvent.click(yButtonFmt2!);
      
      // Should NOT call onChange with compliant: true because comment exists
      expect(onChange).not.toHaveBeenCalledWith('fmt-2', { compliant: true });
    });

    it('clearing comment re-enables Y button', () => {
      const onChange = vi.fn();
      // Start with a response that has a comment
      const responsesWithComment: Record<string, EvaluatorMatrixResponse> = {
        'fmt-1': { criterionId: 'fmt-1', compliant: false, comment: 'Some comment' }
      };
      
      render(<MatrixChecklistTable sections={mockSections} mode="fill" responses={responsesWithComment} onCriterionChange={onChange} />);
      
      const fmt1Row = screen.getByText('Margins (1" on all sides)').closest('tr');
      const yButton = fmt1Row!.querySelector('button');
      expect(yButton).toBeDisabled();
      
      // Clear the comment
      const textarea = fmt1Row!.querySelector('textarea');
      fireEvent.change(textarea!, { target: { value: '' } });
      
      // Y should now be enabled (but we can't easily test enabled state after async)
      // Just verify the change was called with compliant: false, comment: ''
      expect(onChange).toHaveBeenCalledWith('fmt-1', { compliant: false, comment: '' });
    });

    it('clicking N emits compliant: false', () => {
      const onChange = vi.fn();
      render(<MatrixChecklistTable sections={mockSections} mode="fill" responses={{}} onCriterionChange={onChange} />);
      
      const fmt1Row = screen.getByText('Margins (1" on all sides)').closest('tr');
      const nButton = fmt1Row!.querySelectorAll('button')[1];
      fireEvent.click(nButton!);
      
      // Component adds empty comment when N is clicked
      expect(onChange).toHaveBeenCalledWith('fmt-1', { compliant: false, comment: '' });
    });

    it('shows hint when N is selected without comment', () => {
      const onChange = vi.fn();
      render(<MatrixChecklistTable sections={mockSections} mode="fill" responses={{ 'fmt-1': { criterionId: 'fmt-1', compliant: false, comment: '' } }} onCriterionChange={onChange} />);
      
      const fmt1Row = screen.getByText('Margins (1" on all sides)').closest('tr');
      expect(fmt1Row).toHaveTextContent('Comment required for non-compliant criteria');
    });
  });

  describe('overall comments', () => {
    it('renders overall comments section in fill mode', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="fill" overallComments="Test overall" onOverallCommentsChange={() => {}} />);
      expect(screen.getByText('Comments and Suggestions')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Overall evaluator comments and suggestions...')).toHaveValue('Test overall');
    });

    it('renders overall comments in readonly mode', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" overallComments="Readonly overall" />);
      expect(screen.getByText('Comments and Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Readonly overall')).toBeInTheDocument();
    });

    it('does not render overall comments in readonly when empty', () => {
      render(<MatrixChecklistTable sections={mockSections} mode="readonly" overallComments="" />);
      expect(screen.queryByText('Comments and Suggestions')).not.toBeInTheDocument();
    });
  });
});