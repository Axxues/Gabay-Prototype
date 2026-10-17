// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { RoleGuard } from './RoleGuard';
import * as LMSContext from '../../context/LMSContext';

describe('RoleGuard production security', () => {
  afterEach(() => {
    (import.meta.env as any).DEV = true;
    vi.restoreAllMocks();
  });

  it('renders children when user role is allowed', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeRole: 'admin',
      setIsRoleModalOpen: vi.fn(),
    } as any);

    render(
      <RoleGuard allowedRoles={['admin', 'faculty']}>
        <div>Authorized Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Authorized Content')).toBeInTheDocument();
  });

  it('does not display Switch Role button when not in dev mode', () => {
    (import.meta.env as any).DEV = false;

    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeRole: 'student',
      setIsRoleModalOpen: vi.fn(),
    } as any);

    render(
      <RoleGuard allowedRoles={['admin', 'faculty']}>
        <div>Secret Admin Content</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Secret Admin Content')).not.toBeInTheDocument();
    expect(screen.queryByText(/Switch Role to Test/i)).not.toBeInTheDocument();
  });
});
