// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  modules: [] as any[],
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'faculty',
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' },
    db: { modules: mocks.modules, courses: [{ id: 'c1', title: 'Course 1' }] },
    isLoading: mocks.isLoading,
    isSyncing: mocks.isSyncing,
    createModule: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    deleteModuleItem: vi.fn(),
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    addModuleComment: vi.fn(),
    editModuleComment: vi.fn(),
    deleteModuleComment: vi.fn(),
    toggleLikeModuleComment: vi.fn(),
    markModuleCommentsRead: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { ModulesView } from './ModulesView';

function renderPage() {
  return render(
    <ModulesView courseId="c1" onSelectActivity={() => {}} onSelectQuiz={() => {}} />
  );
}

describe('ModulesView refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
  });

  test('shows loading skeleton (not "no modules") while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('modules-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no modules available/i)).not.toBeInTheDocument();
  });

  test('shows loading skeleton while background sync fills modules', () => {
    mocks.isSyncing = true;
    renderPage();
    expect(screen.getByTestId('modules-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no modules available/i)).not.toBeInTheDocument();
  });

  test('shows empty state only once loading fully settles', () => {
    renderPage();
    expect(screen.getByText(/no modules available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('modules-loading')).not.toBeInTheDocument();
  });

  test('displays multiple attachment chips and opens preview modal with switcher', () => {
    mocks.modules = [
      {
        id: 'm1',
        courseId: 'c1',
        title: 'Module 1: Foundations',
        order: 1,
        published: true,
        items: [
          {
            id: 'item-1',
            title: 'Week 1 Readings & Materials',
            type: 'page',
            content: 'Please review all attached reading materials.',
            published: true,
            required: false,
            completionCondition: 'view',
            attachments: [
              { name: 'syllabus_brief.pdf', size: '1.2 MB', url: '/files/syllabus_brief.pdf' },
              { name: 'architecture_diagram.png', size: '850 KB', url: '/files/architecture_diagram.png' },
              { name: 'lab_starter.zip', size: '3.4 MB', url: '/files/lab_starter.zip' }
            ]
          }
        ]
      }
    ];

    renderPage();

    // Click module header to expand it
    const moduleHeader = screen.getByText('Module 1: Foundations');
    fireEvent.click(moduleHeader);

    // All 3 attachment chips should be rendered
    expect(screen.getByText('syllabus_brief.pdf')).toBeInTheDocument();
    expect(screen.getByText('architecture_diagram.png')).toBeInTheDocument();
    expect(screen.getByText('lab_starter.zip')).toBeInTheDocument();

    // Click second chip to open preview modal for the image
    fireEvent.click(screen.getByText('architecture_diagram.png'));

    // Preview modal should display title, attachment switcher, and the image preview
    expect(screen.getAllByText('Week 1 Readings & Materials').length).toBeGreaterThan(1);
    expect(screen.getByText(/Attachments \(3\):/i)).toBeInTheDocument();
    expect(screen.getByAltText('architecture_diagram.png')).toBeInTheDocument();
  });
});
