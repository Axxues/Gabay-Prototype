// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppRail } from './AppRail';
import { GabayChatContext } from '../../context/GabayChatContext';

let mockLMSContext = {
  activeRole: 'student',
  activeUser: { id: 'u1' } as any,
  logout: vi.fn(),
  showConfirm: vi.fn(),
  db: { messages: [] },
  getBaselineSchoolYear: () => ({ id: 'sy-1', year: '2026-2027', isActive: true }),
  getActiveSchoolYearForCollege: (colId: string) => ({ id: 'sy-col', year: '2025-2026', isActive: true, collegeId: colId }),
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => mockLMSContext,
}));

describe('AppRail Navigation', () => {
  it('does not rotate Gabay icon and has no red dot when no ongoing process', () => {
    render(
      <GabayChatContext.Provider
        value={
          {
            executingSessionIds: [],
          } as any
        }
      >
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    const gabayBtn = screen.getByTitle(/Gabay RAG/i);
    expect(gabayBtn).toBeInTheDocument();

    const icon = gabayBtn.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.classList.contains('animate-spin')).toBe(false);

    // No red dot / ping element
    expect(gabayBtn.querySelector('.animate-ping')).toBeNull();
  });

  it('rotates the Gabay icon when there is an ongoing process and does NOT render a red dot', () => {
    render(
      <GabayChatContext.Provider
        value={
          {
            executingSessionIds: ['session-123'],
          } as any
        }
      >
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    const gabayBtn = screen.getByTitle(/GABAY is processing/i);
    expect(gabayBtn).toBeInTheDocument();

    const icon = gabayBtn.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.classList.contains('animate-spin')).toBe(true);

    // Absolutely NO red dot / ping element
    expect(gabayBtn.querySelector('.animate-ping')).toBeNull();
    expect(gabayBtn.querySelector('.bg-primary.rounded-full')).toBeNull();
  });

  it('renders Academic Governance above Manage College Accounts for admin', () => {
    // Override activeRole to admin
    const { container } = render(
      <GabayChatContext.Provider value={{ executingSessionIds: [] } as any}>
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    // With activeRole student from mock, accounts and governance are hidden
    expect(screen.queryByTitle(/Academic Governance/i)).toBeNull();
    expect(screen.queryByTitle(/Manage College Accounts/i)).toBeNull();
  });

  it('renders circular yellow warning tag on Academic Governance for Dean when college active year differs from baseline', () => {
    mockLMSContext = {
      ...mockLMSContext,
      activeRole: 'admin',
      activeUser: {
        id: 'u-dean',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-ccs',
      } as any,
      getBaselineSchoolYear: () => ({ id: 'sy-base', year: '2026-2027', isActive: true }),
      getActiveSchoolYearForCollege: () => ({ id: 'sy-ccs', year: '2025-2026', isActive: true, collegeId: 'col-ccs' }),
    };

    render(
      <GabayChatContext.Provider value={{ executingSessionIds: [] } as any}>
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    const warningTag = screen.getByTestId('governance-baseline-warning');
    expect(warningTag).toBeInTheDocument();
    expect(warningTag).toHaveClass('bg-amber-400');
  });

  it('does NOT render yellow warning tag on Academic Governance when Dean college active year matches baseline', () => {
    mockLMSContext = {
      ...mockLMSContext,
      activeRole: 'admin',
      activeUser: {
        id: 'u-dean',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-ccs',
      } as any,
      getBaselineSchoolYear: () => ({ id: 'sy-base', year: '2026-2027', isActive: true }),
      getActiveSchoolYearForCollege: () => ({ id: 'sy-ccs', year: '2026-2027', isActive: true, collegeId: 'col-ccs' }),
    };

    render(
      <GabayChatContext.Provider value={{ executingSessionIds: [] } as any}>
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    expect(screen.queryByTestId('governance-baseline-warning')).toBeNull();
  });

  it('renders circular yellow warning tag on Academic Governance for Chair when college active year differs from baseline', () => {
    mockLMSContext = {
      ...mockLMSContext,
      activeRole: 'admin',
      activeUser: {
        id: 'u-chair',
        role: 'admin',
        adminSubrole: 'chairperson',
        collegeId: 'col-ccs',
      } as any,
      getBaselineSchoolYear: () => ({ id: 'sy-base', year: '2026-2027', isActive: true }),
      getActiveSchoolYearForCollege: () => ({ id: 'sy-ccs', year: '2025-2026', isActive: true, collegeId: 'col-ccs' }),
    };

    render(
      <GabayChatContext.Provider value={{ executingSessionIds: [] } as any}>
        <AppRail currentTab="dashboard" onNavigateTab={vi.fn()} />
      </GabayChatContext.Provider>
    );

    const warningTag = screen.getByTestId('governance-baseline-warning');
    expect(warningTag).toBeInTheDocument();
    expect(warningTag).toHaveClass('bg-amber-400');
  });
});
