import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MatrixBuilder } from './MatrixBuilder';
import type { EvaluationMatrix } from '../../types/lifecycle';

const template: EvaluationMatrix = {
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  sections: [
    {
      id: 'format',
      title: 'FORMAT',
      criteria: [
        { id: 'fmt-1', text: 'Margins' },
        { id: 'fmt-2', text: 'Font size' }
      ]
    },
    {
      id: 'part-1',
      title: 'Part I',
      criteria: [{ id: 'p1-1', text: 'PVMG aligned' }]
    }
  ]
};

const setup = (props: Partial<React.ComponentProps<typeof MatrixBuilder>> = {}) => {
  const onSave = vi.fn();
  const onReset = vi.fn();
  render(<MatrixBuilder template={template} saving={false} onSave={onSave} onReset={onReset} {...props} />);
  return { onSave, onReset };
};

const savedSections = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0][0];

describe('MatrixBuilder', () => {
  it('renders existing sections and criteria as editable inputs', () => {
    setup();
    expect(screen.getByDisplayValue('FORMAT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Part I')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Margins')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Font size')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PVMG aligned')).toBeInTheDocument();
  });

  it('emits edited criterion text on Save', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByDisplayValue('Margins'), { target: { value: 'Margins (1 inch)' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(savedSections(onSave)[0].criteria[0]).toEqual({ id: 'fmt-1', text: 'Margins (1 inch)' });
  });

  it('adds a criterion with a unique id', () => {
    const { onSave } = setup();
    const addButtons = screen.getAllByRole('button', { name: /Add criterion/i });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    const criteria = savedSections(onSave)[0].criteria;
    expect(criteria).toHaveLength(4);
    const ids = savedSections(onSave).flatMap((s: any) => s.criteria.map((c: any) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('removes a criterion', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /Remove criterion/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    expect(savedSections(onSave)[0].criteria.map((c: any) => c.id)).toEqual(['fmt-2']);
  });

  it('removes a section together with its criteria', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /Remove section/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    const sections = savedSections(onSave);
    expect(sections.map((s: any) => s.id)).toEqual(['part-1']);
    expect(screen.queryByDisplayValue('Margins')).not.toBeInTheDocument();
  });

  it('reorders criteria with up/down buttons', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /Move criterion down/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    expect(savedSections(onSave)[0].criteria.map((c: any) => c.id)).toEqual(['fmt-2', 'fmt-1']);
  });

  it('reorders sections with up/down buttons', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /Move section up/i })[1]);
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));
    expect(savedSections(onSave).map((s: any) => s.id)).toEqual(['part-1', 'format']);
  });

  it('requires a second click on Confirm Reset before onReset fires', () => {
    const { onReset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Reset to Default/i }));
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('disables Save while saving to guard double save', () => {
    const { onSave } = setup({ saving: true });
    const save = screen.getByRole('button', { name: /Saving/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });
});
