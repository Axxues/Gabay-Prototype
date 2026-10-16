// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockSwitchRole = vi.fn();
const mockSetIsRoleModalOpen = vi.fn();

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => ({
    isRoleModalOpen: true,
    setIsRoleModalOpen: mockSetIsRoleModalOpen,
    activeRole: 'student',
    switchRole: mockSwitchRole,
  }),
}));

import { RoleSwitcherModal } from './RoleSwitcherModal';

describe('RoleSwitcherModal', () => {
  it('renders all 5 roles including Chancellor (Superadmin)', () => {
    render(<RoleSwitcherModal />);

    expect(screen.getByText('Role Switcher')).toBeInTheDocument();
    expect(screen.getByText('0. Chancellor (Superadmin)')).toBeInTheDocument();
    expect(screen.getByText('1. Administrator (Dean / Chairperson)')).toBeInTheDocument();
    expect(screen.getByText('2. Faculty Member (Instructor)')).toBeInTheDocument();
    expect(screen.getByText('3. Non-Teaching Staff (Registrar)')).toBeInTheDocument();
    expect(screen.getByText('4. Enrolled Student')).toBeInTheDocument();
  });

  it('calls switchRole with "superadmin" when Chancellor option is clicked', () => {
    render(<RoleSwitcherModal />);

    const chancellorOption = screen.getByText('0. Chancellor (Superadmin)').closest('div[class*="cursor-pointer"]');
    expect(chancellorOption).not.toBeNull();
    fireEvent.click(chancellorOption!);

    expect(mockSwitchRole).toHaveBeenCalledWith('superadmin');
  });
});
