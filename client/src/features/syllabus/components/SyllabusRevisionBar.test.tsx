// @vitest-environment jsdom
// Task 6 (TDD RED): SyllabusRevisionBar renders revision state and actions.
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { SyllabusRevisionBar } from './SyllabusRevisionBar';
import type { SyllabusRevisionHeader } from '../../../shared/types/syllabusApi';

const draftRev = (over: Partial<SyllabusRevisionHeader> = {}): SyllabusRevisionHeader => ({
  id: 'rev-draft-1',
  courseId: 'c1',
  revisionNo: 3,
  status: 'draft',
  schemaVersion: '1',
  rowVersion: 4,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  publishedAt: null,
  ...over,
});

const pubRev = (over: Partial<SyllabusRevisionHeader> = {}): SyllabusRevisionHeader =>
  draftRev({ id: 'rev-pub-1', revisionNo: 2, status: 'published', publishedAt: '2026-09-24T01:00:00.000Z', ...over });

const baseProps = {
  canEdit: true,
  isDirty: false,
  onCreateDraft: () => {},
  onPublish: () => {},
};

describe('SyllabusRevisionBar', () => {
  test('shows draft badge with revision number and publish action', () => {
    const onPublish = vi.fn();
    render(<SyllabusRevisionBar {...baseProps} revision={draftRev()} onPublish={onPublish} />);
    expect(screen.getByTestId('syllabus-revision-bar')).toBeInTheDocument();
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/draft/i);
    expect(screen.getByTestId('revision-number')).toHaveTextContent(/revision 3/i);
    fireEvent.click(screen.getByTestId('revision-publish'));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  test('published revisions render read-only without edit affordances', () => {
    const onCreateDraft = vi.fn();
    const onPublish = vi.fn();
    render(
      <SyllabusRevisionBar
        {...baseProps}
        revision={pubRev()}
        onCreateDraft={onCreateDraft}
        onPublish={onPublish}
      />,
    );
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/published/i);
    expect(screen.getByTestId('revision-readonly')).toHaveTextContent(/read-only/i);
    expect(screen.queryByTestId('revision-publish')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('revision-create-draft'));
    expect(onCreateDraft).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  test('surfaces unsaved changes while a section draft is open', () => {
    render(<SyllabusRevisionBar {...baseProps} revision={draftRev()} isDirty />);
    expect(screen.getByTestId('revision-dirty')).toHaveTextContent(/unsaved changes/i);
  });

  test('scopes to the current revision without history selection', () => {
    render(<SyllabusRevisionBar {...baseProps} revision={pubRev()} />);
    expect(screen.getByTestId('revision-number')).toHaveTextContent(/revision 2/i);
    expect(screen.queryByTestId('revision-select')).not.toBeInTheDocument();
  });

  test('viewers without edit rights see no mutation actions', () => {
    render(<SyllabusRevisionBar {...baseProps} revision={draftRev()} canEdit={false} />);
    expect(screen.queryByTestId('revision-publish')).not.toBeInTheDocument();
    expect(screen.queryByTestId('revision-create-draft')).not.toBeInTheDocument();
  });
});
