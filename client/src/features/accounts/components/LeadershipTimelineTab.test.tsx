import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadershipTimelineTab } from './LeadershipTimelineTab';
import type { LeadershipTenure, College, Department } from '../../../shared/types/lms';

const mockTenures: LeadershipTenure[] = [
  {
    id: 'tenure-admin-1',
    role: 'admin',
    unitId: 'system',
    unitName: 'Institutional Administration',
    unitType: 'system',
    leaderId: 'u-chancellor',
    leaderName: 'Dr. Jaime M. Manuel Jr.',
    leaderEmail: 'chancellor@dmmmsu.edu.ph',
    leaderAvatar: '',
    startDate: '2024-01-01T08:00:00.000Z',
    endDate: null,
    status: 'active',
    appointedBy: 'Board of Regents',
    transitionNotes: 'Appointed Institutional Administration Lead for Gabay LMS.',
  },
  {
    id: 'tenure-dean-ccs-active',
    role: 'dean',
    unitId: 'col-ccs',
    unitName: 'College of Computer Science',
    unitType: 'college',
    leaderId: 'u-dean-aris',
    leaderName: 'Dr. Aris Thorne',
    leaderEmail: 'dean.ccs@dmmmsu.edu.ph',
    leaderAvatar: '',
    startDate: '2024-06-01T08:00:00.000Z',
    endDate: null,
    status: 'active',
    appointedBy: 'University Chancellor',
    transitionNotes: 'Installed as Dean of College of Computer Science.',
  },
  {
    id: 'tenure-dean-ccs-past',
    role: 'dean',
    unitId: 'col-ccs',
    unitName: 'College of Computer Science',
    unitType: 'college',
    leaderId: 'u-dean-santos',
    leaderName: 'Dr. Maria Elena Santos',
    leaderEmail: 'msantos@dmmmsu.edu.ph',
    leaderAvatar: '',
    startDate: '2021-08-01T08:00:00.000Z',
    endDate: '2024-05-31T17:00:00.000Z',
    status: 'completed',
    appointedBy: 'University Chancellor',
    transitionNotes: 'Stepped down to return to full-time professorship in Computer Science.',
  },
  {
    id: 'tenure-chair-cs-active',
    role: 'chairperson',
    unitId: 'dept-cs',
    unitName: 'Computer Science',
    unitType: 'department',
    leaderId: 'u-chair-chen',
    leaderName: 'Prof. Christine Chen',
    leaderEmail: 'chair.cs@dmmmsu.edu.ph',
    leaderAvatar: '',
    startDate: '2025-01-15T08:00:00.000Z',
    endDate: null,
    status: 'active',
    appointedBy: 'College Dean',
    transitionNotes: 'Appointed Program Chairperson of Computer Science.',
  },
];

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean-aris' },
];

const mockDepartments: Department[] = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'CS', chairpersonId: 'u-chair-chen' },
];

const mockGetTenureMetrics = vi.fn().mockReturnValue({
  coursesCreated: 14,
  studentsEnrolled: 180,
  syllabiCount: 12,
  facultyAssigned: 8,
});

const mockGetTenureAuditTrail = vi.fn().mockReturnValue([
  {
    id: 'audit-1',
    timestamp: '2024-06-01T08:00:00.000Z',
    title: 'Collegiate Leadership Handover',
    description: 'Dr. Aris Thorne succeeded Dr. Maria Elena Santos as Dean.',
    eventType: 'leadership_transfer',
    actorName: 'University Chancellor',
  },
  {
    id: 'evt-crs-1',
    timestamp: '2024-06-01T08:00:00.000Z',
    title: 'Curriculum Offering: CS 101',
    description: 'Course "Intro to CS" section 1A active.',
    eventType: 'course_created',
    actorName: 'Prof. Christine Chen',
  },
]);

vi.mock('../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    leadershipTenures: mockTenures,
    colleges: mockColleges,
    departments: mockDepartments,
    getTenureMetrics: mockGetTenureMetrics,
    getTenureAuditTrail: mockGetTenureAuditTrail,
  }),
}));

describe('LeadershipTimelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the timeline header, scope switcher, and tenure cards', () => {
    render(<LeadershipTimelineTab />);

    expect(
      screen.getByText('Institutional Leadership & Governance Timeline')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'All Levels' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Institutional' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colleges (Deans)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programs (Chairs)' })).toBeInTheDocument();

    // Verify leaders appear
    expect(screen.getByText('Dr. Jaime M. Manuel Jr.')).toBeInTheDocument();
    expect(screen.getByText('Dr. Aris Thorne')).toBeInTheDocument();
    expect(screen.getByText('Dr. Maria Elena Santos')).toBeInTheDocument();
    expect(screen.getByText('Prof. Christine Chen')).toBeInTheDocument();
  });

  it('filters tenures by scope when clicking Institutional, Colleges, or Programs', () => {
    render(<LeadershipTimelineTab />);

    // Click Institutional filter
    fireEvent.click(screen.getByRole('button', { name: 'Institutional' }));

    expect(screen.getByText('Dr. Jaime M. Manuel Jr.')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Aris Thorne')).not.toBeInTheDocument();
    expect(screen.queryByText('Prof. Christine Chen')).not.toBeInTheDocument();

    // Click Colleges (Deans) filter
    fireEvent.click(screen.getByRole('button', { name: 'Colleges (Deans)' }));

    expect(screen.queryByText('Dr. Jaime M. Manuel Jr.')).not.toBeInTheDocument();
    expect(screen.getByText('Dr. Aris Thorne')).toBeInTheDocument();
    expect(screen.getByText('Dr. Maria Elena Santos')).toBeInTheDocument();
    expect(screen.queryByText('Prof. Christine Chen')).not.toBeInTheDocument();
  });

  it('filters tenures by search query input', () => {
    render(<LeadershipTimelineTab />);

    const searchInput = screen.getByPlaceholderText(/search by leader name or unit/i);
    fireEvent.change(searchInput, { target: { value: 'Santos' } });

    expect(screen.getByText('Dr. Maria Elena Santos')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Aris Thorne')).not.toBeInTheDocument();
    expect(screen.queryByText('Dr. Jaime M. Manuel Jr.')).not.toBeInTheDocument();
  });

  it('displays impact KPI metrics on tenure cards', () => {
    render(<LeadershipTimelineTab />);

    expect(mockGetTenureMetrics).toHaveBeenCalled();
    // 14 courses created rendered on metrics bars
    expect(screen.getAllByText('14').length).toBeGreaterThan(0);
    expect(screen.getAllByText('180').length).toBeGreaterThan(0);
  });

  it('opens detailed administration audit modal when clicking Inspect Administration Audit', () => {
    render(<LeadershipTimelineTab />);

    const inspectButtons = screen.getAllByRole('button', { name: /inspect administration audit/i });
    expect(inspectButtons.length).toBeGreaterThan(0);

    // Click first inspect button
    fireEvent.click(inspectButtons[0]);

    // Modal should be open
    expect(screen.getByRole('heading', { name: /administration audit:/i })).toBeInTheDocument();
    expect(screen.getByText('Collegiate Leadership Handover')).toBeInTheDocument();
    expect(screen.getByText('Curriculum Offering: CS 101')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Done Reviewing' }));
    expect(screen.queryByRole('heading', { name: /administration audit:/i })).not.toBeInTheDocument();
  });
});
