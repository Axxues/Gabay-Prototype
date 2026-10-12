// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const createActivityMock = vi.fn().mockResolvedValue({ id: 'act-new-99' });

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      courses: [{ id: 'c1', code: 'CS101' }],
    },
    createActivity: createActivityMock,
    showAlert: vi.fn(),
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { CreateAssignmentPage } from './CreateAssignmentPage';
import { CreateProjectPage } from './CreateProjectPage';
import { CreatePresentationPage } from './CreatePresentationPage';

describe('CreateAssessmentPages forms', () => {
  test('CreateAssignmentPage renders and submits assignment payload', async () => {
    const onCreated = vi.fn();
    render(<CreateAssignmentPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Assignment')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/e.g. Assignment 1/i);
    fireEvent.change(titleInput, { target: { value: 'Homework 1' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter assignment instructions/i);
    fireEvent.change(instructionsInput, { target: { value: 'Read chapter 1 and answer questions.' } });

    const publishBtn = screen.getByRole('button', { name: /Publish Assignment/i });
    fireEvent.click(publishBtn);

    expect(createActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'c1',
        title: 'Homework 1',
        assessmentType: 'assignment',
        published: true,
      })
    );
  });

  test('CreateProjectPage includes group mode and metadata in payload', async () => {
    createActivityMock.mockClear();
    const onCreated = vi.fn();
    render(<CreateProjectPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Project')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/e.g. Capstone Phase 1/i);
    fireEvent.change(titleInput, { target: { value: 'Web App Project' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter project instructions/i);
    fireEvent.change(instructionsInput, { target: { value: 'Build full stack application' } });

    // Switch to Group mode
    const groupBtn = screen.getByRole('button', { name: /Group Project/i });
    fireEvent.click(groupBtn);

    const publishBtn = screen.getByRole('button', { name: /Publish Project/i });
    fireEvent.click(publishBtn);

    expect(createActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'c1',
        title: 'Web App Project',
        assessmentType: 'project',
        metadata: expect.objectContaining({
          groupMode: 'group',
        }),
      })
    );
  });

  test('CreatePresentationPage includes presentation format and duration in payload', async () => {
    createActivityMock.mockClear();
    const onCreated = vi.fn();
    render(<CreatePresentationPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Presentation')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/e.g. Oral Defense/i);
    fireEvent.change(titleInput, { target: { value: 'Project Defense' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter presentation guidelines/i);
    fireEvent.change(instructionsInput, { target: { value: '15 minute slide deck presentation' } });

    const publishBtn = screen.getByRole('button', { name: /Publish Presentation/i });
    fireEvent.click(publishBtn);

    expect(createActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'c1',
        title: 'Project Defense',
        assessmentType: 'presentation',
        metadata: expect.objectContaining({
          presentationMode: 'in_person',
        }),
      })
    );
  });
});
