// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

afterEach(() => {
  cleanup();
});

const updateCourseMock = vi.fn().mockImplementation(async (_id: string, data: any) => ({
  id: 'c1',
  ...data,
}));

let mockLMSContext = {
  activeUser: { id: 'u1', name: 'Prof Alice', email: 'alice@example.com', role: 'faculty', department: 'Computer Science' },
  activeRole: 'faculty',
  db: {
    courses: [] as any[],
    users: [
      { id: 'u1', name: 'Prof Alice', email: 'alice@example.com', role: 'faculty', department: 'Computer Science' },
      { id: 'u-fac-bob', name: 'Prof Bob Santos', email: 'bob.santos@dmmmsu.edu.ph', role: 'faculty', department: 'Information Technology' },
      { id: 'u-admin', name: 'Charlie Seli Marzan', email: 'dean1@dmmmsu.edu.ph', role: 'admin', department: 'Dean Office' },
    ]
  },
  updateCourse: updateCourseMock,
  showAlert: vi.fn(),
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => mockLMSContext,
  generateCourseJoinCode: (_courses: any[], prefix?: string) => `${prefix || 'GBY'}-UPDATED`,
  getOrGenerateCourseJoinCode: (c: any) => c?.joinCode || c?.join_code || `${(c?.code || 'GBY').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-DETERMINISTIC`,
}));

import { EditCoursePage } from './EditCoursePage';

const mockCourse = {
  id: 'c1',
  code: 'CMSC 131',
  title: 'Data Structures & Algorithms',
  section: 'BSCS 2-1',
  term: '1st Sem AY 2026-2027',
  schoolYear: '2025-2026',
  color: '#2563eb',
  image: 'https://example.com/banner.jpg',
  instructorId: 'u1',
  instructorName: 'Prof Alice',
  published: true,
  enrolledCount: 25,
  joinCode: 'CMSC131-JOIN'
};

describe('EditCoursePage', () => {
  test('renders with initial course data populated', () => {
    render(
      <EditCoursePage
        course={mockCourse}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    const codeInput = screen.getByDisplayValue('CMSC 131');
    const titleInput = screen.getByDisplayValue('Data Structures & Algorithms');
    const sectionInput = screen.getByDisplayValue('BSCS 2-1');

    expect(codeInput).toHaveAttribute('readonly');
    expect(titleInput).toHaveAttribute('readonly');
    expect(sectionInput).toHaveAttribute('readonly');
    expect(screen.getAllByText(/AY 2025-2026/i).length).toBeGreaterThan(0);
    expect(screen.getByText('First Semester')).toBeInTheDocument();
    expect(screen.getByText('1st Sem AY 2026-2027')).toBeInTheDocument();
    expect(screen.getByText('Semester is assigned via Chairperson Assigned Courses and cannot be modified.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CMSC131-JOIN')).toBeInTheDocument();
    expect(screen.getByText('Edit course shell')).toBeInTheDocument();
    expect(screen.getByText(/Save changes/i)).toBeInTheDocument();
  });

  test('submitting form updates course and navigates', async () => {
    const onNavigateCourse = vi.fn();
    render(
      <EditCoursePage
        course={mockCourse}
        onNavigateCourse={onNavigateCourse}
        onNavigateTab={vi.fn()}
      />
    );

    const descInput = screen.getByPlaceholderText(/Provide an overview of the course syllabus/i);
    fireEvent.change(descInput, { target: { value: 'Updated overview description' } });

    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateCourseMock).toHaveBeenCalledWith('c1', expect.objectContaining({
        color: '#2563eb',
        joinCode: 'CMSC131-JOIN'
      }));
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('code');
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('title');
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('section');
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('schoolYear');
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('term');
      expect(updateCourseMock.mock.calls[0][1]).not.toHaveProperty('semester');
      expect(onNavigateCourse).toHaveBeenCalledWith('c1', 'modules');
    });
  });

  test('clicking cancel navigates back to dashboard', () => {
    const onNavigateTab = vi.fn();
    render(
      <EditCoursePage
        course={mockCourse}
        onNavigateCourse={vi.fn()}
        onNavigateTab={onNavigateTab}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onNavigateTab).toHaveBeenCalledWith('dashboard');
  });

  test('when admin edits course, assigned instructor is shown instead of admin', () => {
    mockLMSContext.activeRole = 'admin';
    mockLMSContext.activeUser = {
      id: 'u-admin',
      name: 'Charlie Seli Marzan',
      email: 'dean1@dmmmsu.edu.ph',
      role: 'admin',
      department: 'Dean Office'
    };

    const courseAssignedToBob = {
      ...mockCourse,
      instructorId: 'u-fac-bob',
      instructorName: 'Prof Bob Santos'
    };

    render(
      <EditCoursePage
        course={courseAssignedToBob}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // Should show Prof Bob Santos, NOT Charlie Seli Marzan or dean1@dmmmsu.edu.ph
    expect(screen.getAllByText('Prof Bob Santos').length).toBeGreaterThan(0);
    expect(screen.queryByText('dean1@dmmmsu.edu.ph')).not.toBeInTheDocument();
  });

  test('instructor card is read-only without reassign selector or medal badge', () => {
    mockLMSContext.activeRole = 'admin';
    mockLMSContext.activeUser = {
      id: 'u-admin',
      name: 'Charlie Seli Marzan',
      email: 'dean1@dmmmsu.edu.ph',
      role: 'admin',
      department: 'Dean Office'
    };

    const courseAssignedToBob = {
      ...mockCourse,
      instructorId: 'u-fac-bob',
      instructorName: 'Prof Bob Santos'
    };

    render(
      <EditCoursePage
        course={courseAssignedToBob}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // No reassign dropdown
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // No INSTRUCTOR medal badge
    expect(screen.queryByText('Instructor', { selector: '.uppercase' })).not.toBeInTheDocument();
    // Correct instructor info displayed
    expect(screen.getAllByText('Prof Bob Santos').length).toBeGreaterThan(0);
  });

  test('displays join code when course only has join_code from Likha ERP Directus', () => {
    const courseWithSnakeCase = {
      ...mockCourse,
      joinCode: undefined,
      join_code: 'ERP-DIRECTUS-789'
    };

    render(
      <EditCoursePage
        course={courseWithSnakeCase as any}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('ERP-DIRECTUS-789')).toBeInTheDocument();
  });

  test('renders empty join code field when course has no join code in Likha ERP', () => {
    const courseWithoutCode = {
      ...mockCourse,
      joinCode: undefined,
      join_code: undefined
    };

    render(
      <EditCoursePage
        course={courseWithoutCode}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Join code');
    expect(input).toHaveValue('');
  });

  test('clicking regenerate updates join code input value', () => {
    render(
      <EditCoursePage
        course={mockCourse}
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('CMSC131-JOIN')).toBeInTheDocument();

    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    expect(screen.getByDisplayValue('CMSC 131-UPDATED')).toBeInTheDocument();
  });
});

