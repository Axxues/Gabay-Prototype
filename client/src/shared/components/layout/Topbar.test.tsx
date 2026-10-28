// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Topbar } from './Topbar';

let mockLMSContext: any = {
  activeRole: 'student',
  activeUser: {
    id: 'u-stud1',
    name: 'Student Scholar 1',
    email: 'student1@dmmmsu.edu.ph',
    role: 'student',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Program in Computer Science',
    avatar: '',
  },
  colleges: [
    { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean' },
    { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'u-dean-coe' },
  ],
  departments: [
    { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'CS' },
  ],
  theme: 'dark',
  toggleTheme: vi.fn(),
  logout: vi.fn(),
  showConfirm: vi.fn(),
  unreadNotificationCount: 0,
  recentVisits: [],
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => mockLMSContext,
}));

vi.mock('../common/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

function renderTopbar() {
  return render(
    <MemoryRouter>
      <Topbar currentTab="dashboard" onOpenSearch={vi.fn()} />
    </MemoryRouter>
  );
}

describe('Topbar Header College Code Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CCS badge for enrolled student (student1@dmmmsu.edu.ph)', () => {
    mockLMSContext.activeRole = 'student';
    mockLMSContext.activeUser = {
      id: 'u-stud1',
      name: 'Student Scholar 1',
      email: 'student1@dmmmsu.edu.ph',
      role: 'student',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Program in Computer Science',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('CCS');
    expect(badge).toHaveAttribute('title', 'College of Computer Science (CCS)');
    expect(badge).toHaveAttribute('aria-label', 'College: College of Computer Science (CCS)');
  });

  it('renders college badge for Dean (dean1@dmmmsu.edu.ph)', () => {
    mockLMSContext.activeRole = 'admin';
    mockLMSContext.activeUser = {
      id: 'u-dean',
      name: 'Dean Computer Science',
      email: 'dean1@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      title: 'Dean, College of Computer Science',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('CCS');
  });

  it('renders college badge for Chairperson (chair1@dmmmsu.edu.ph)', () => {
    mockLMSContext.activeRole = 'admin';
    mockLMSContext.activeUser = {
      id: 'u-chair',
      name: 'Chair Computer Science',
      email: 'chair1@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Computer Science',
      title: 'Department Chairperson',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('CCS');
  });

  it('renders college badge for Faculty (faculty1@dmmmsu.edu.ph)', () => {
    mockLMSContext.activeRole = 'faculty';
    mockLMSContext.activeUser = {
      id: 'u-fac1',
      name: 'Faculty Instructor 1',
      email: 'faculty1@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('CCS');
  });

  it('renders college badge for Staff (staff1@dmmmsu.edu.ph)', () => {
    mockLMSContext.activeRole = 'staff';
    mockLMSContext.activeUser = {
      id: 'u-staff1',
      name: 'Staff Registrar 1',
      email: 'staff1@dmmmsu.edu.ph',
      role: 'staff',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('CCS');
  });

  it('renders COED badge when a student is enrolled in College of Education', () => {
    mockLMSContext.activeRole = 'student';
    mockLMSContext.activeUser = {
      id: 'u-stud-coe',
      name: 'Education Student',
      email: 'edustudent@dmmmsu.edu.ph',
      role: 'student',
      collegeId: 'col-coe',
      collegeName: 'College of Education',
    };

    renderTopbar();

    const badge = screen.getByTestId('header-college-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('COED');
    expect(badge).toHaveAttribute('title', 'College of Education (COED)');
  });

  it('does NOT render college badge for University Administrator / Chancellor', () => {
    mockLMSContext.activeRole = 'admin';
    mockLMSContext.activeUser = {
      id: 'u-chancellor',
      name: 'Jayvee Admin',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
      title: 'University Chancellor',
      department: 'Office of the Chancellor',
    };

    renderTopbar();

    expect(screen.queryByTestId('header-college-badge')).toBeNull();
  });

  it('does NOT render college badge when user has no college affiliation', () => {
    mockLMSContext.activeRole = 'student';
    mockLMSContext.activeUser = {
      id: 'u-orphan',
      name: 'Orphan User',
      email: 'orphan@dmmmsu.edu.ph',
      role: 'student',
      collegeId: undefined,
      collegeName: undefined,
      department: undefined,
    };
    mockLMSContext.colleges = [];

    renderTopbar();

    expect(screen.queryByTestId('header-college-badge')).toBeNull();
  });
});
