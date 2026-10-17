// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const createCourseMock = vi.fn().mockImplementation(async (data: any) => ({
  id: 'crs-math101',
  code: data.code,
  section: data.section,
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'u1', name: 'Eleanor', email: 'eleanor@example.com', department: 'Computer Science' },
    db: { courses: [] },
    createCourse: createCourseMock,
    showAlert: vi.fn(),
  }),
  generateCourseJoinCode: (_courses: any[], prefix?: string) => `${prefix || 'GBY'}-TEST`,
}));

import { CreateCoursePage } from './CreateCoursePage';

describe('CreateCoursePage', () => {
  test('renders with empty input fields instead of preplaced mock data', () => {
    render(
      <CreateCoursePage
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // Course code input should be empty
    const codeInput = screen.getByPlaceholderText(/CMSC 180/i) as HTMLInputElement;
    expect(codeInput.value).toBe('');

    // Section input should be empty
    const sectionInput = screen.getByPlaceholderText(/4-E/i) as HTMLInputElement;
    expect(sectionInput.value).toBe('');

    // Course title input should be empty
    const titleInput = screen.getByPlaceholderText(/Artificial Intelligence/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');

    // Description textarea should be empty
    const descTextarea = screen.getByPlaceholderText(/Provide an overview of the course syllabus/i) as HTMLTextAreaElement;
    expect(descTextarea.value).toBe('');

    // Join code input should be empty (auto-generated on submission) and readOnly
    const joinCodeInput = screen.getByPlaceholderText(/Auto-generated/i) as HTMLInputElement;
    expect(joinCodeInput.value).toBe('');
    expect(joinCodeInput.readOnly).toBe(true);

    // Accent color text input should be empty
    const colorInput = screen.getByPlaceholderText(/No color selected/i) as HTMLInputElement;
    expect(colorInput.value).toBe('');
  });

  test('regenerate button generates a join code based on entered course code', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <CreateCoursePage
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    const codeInput = screen.getByPlaceholderText(/CMSC 180/i);
    const joinCodeInput = screen.getByPlaceholderText(/Auto-generated/i) as HTMLInputElement;

    expect(joinCodeInput.value).toBe('');

    // Enter a course code
    fireEvent.change(codeInput, { target: { value: 'MATH 101' } });

    // Click Regenerate
    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    expect(joinCodeInput.value).toBe('MATH 101-TEST');
  });

  test('submitting with valid inputs calls createCourse and generates join code if empty', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    const onNavigateCourse = vi.fn();

    render(
      <CreateCoursePage
        onNavigateCourse={onNavigateCourse}
        onNavigateTab={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/CMSC 180/i), { target: { value: 'MATH 101' } });
    fireEvent.change(screen.getByPlaceholderText(/4-E/i), { target: { value: 'M1' } });
    fireEvent.change(screen.getByPlaceholderText(/Artificial Intelligence/i), { target: { value: 'Calculus I' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create course shell/i }));
    });

    expect(createCourseMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MATH 101',
      section: 'M1',
      title: 'Calculus I',
      joinCode: 'MATH 101-TEST',
    }));
  });
});

