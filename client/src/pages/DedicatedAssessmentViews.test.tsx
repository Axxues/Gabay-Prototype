// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      activities: [
        { id: '1', courseId: 'c1', title: 'General Activity', format: 'classic', published: true, assessmentType: 'activity', pointsPossible: 20, term: 'midterm' },
        { id: '2', courseId: 'c1', title: 'Research Assignment', format: 'classic', published: true, assessmentType: 'assignment', pointsPossible: 50, term: 'midterm' },
        { id: '3', courseId: 'c1', title: 'Team Project', format: 'classic', published: true, assessmentType: 'project', pointsPossible: 100, term: 'finals', metadata: { groupMode: 'group', maxGroupSize: 4 } },
        { id: '4', courseId: 'c1', title: 'Final Presentation', format: 'classic', published: true, assessmentType: 'presentation', pointsPossible: 30, term: 'finals', metadata: { presentationMode: 'in_person', durationMinutes: 15 } },
      ],
      submissions: [],
      modules: [],
    },
    activeRole: 'faculty',
    activeUser: { id: 'u-fac', name: 'Faculty', role: 'faculty' },
    effectiveTermsForCourse: () => ['midterm', 'finals'],
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    deleteActivity: vi.fn(),
    openSpeedGrader: vi.fn(),
  }),
}));

import { AssignmentsView } from './AssignmentsView';
import { ProjectsView } from './ProjectsView';
import { PresentationsView } from './PresentationsView';

describe('Dedicated Assessment Views', () => {
  test('AssignmentsView only displays assignments', () => {
    render(<AssignmentsView courseId="c1" selectedAssignmentId={null} onSelectAssignment={() => {}} />);
    expect(screen.getByText('Research Assignment')).toBeDefined();
    expect(screen.queryByText('General Activity')).toBeNull();
    expect(screen.queryByText('Team Project')).toBeNull();
    expect(screen.queryByText('Final Presentation')).toBeNull();
  });

  test('ProjectsView only displays projects and renders group badge', () => {
    render(<ProjectsView courseId="c1" selectedProjectId={null} onSelectProject={() => {}} />);
    expect(screen.getByText('Team Project')).toBeDefined();
    expect(screen.getByText('Group Project')).toBeDefined();
    expect(screen.queryByText('Research Assignment')).toBeNull();
  });

  test('PresentationsView only displays presentations and renders format badge', () => {
    render(<PresentationsView courseId="c1" selectedPresentationId={null} onSelectPresentation={() => {}} />);
    expect(screen.getByText('Final Presentation')).toBeDefined();
    expect(screen.getByText('In-Person')).toBeDefined();
    expect(screen.queryByText('Research Assignment')).toBeNull();
  });
});
