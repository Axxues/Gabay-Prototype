import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import * as LMSContext from '../../shared/context/LMSContext';

describe('SyllabusCreatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-1', name: 'Floribeth Cuison', role: 'faculty' },
      activeRole: 'faculty',
      courses: [],
      showAlert: vi.fn(),
    } as any);
  });

  it('renders page header with Syllabus Development title, draft controls, and wizard steps', () => {
    render(<SyllabusCreatorPage />);
    expect(screen.getByRole('heading', { name: /Syllabus Development/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Syllabus/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Course Info/i).length).toBeGreaterThan(0);
  });

  it('navigates between wizard steps', () => {
    render(<SyllabusCreatorPage />);
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/Outcomes/i).length).toBeGreaterThan(0);
  });

  it('toggles live document preview panel', () => {
    render(<SyllabusCreatorPage />);
    const previewToggle = screen.getByRole('button', { name: /Document Preview/i });
    fireEvent.click(previewToggle);
    expect(screen.getAllByText(/Don Mariano Marcos Memorial State University/i).length).toBeGreaterThan(0);
  });

  it('redirects or denies student role if accessed (Review Focus 5)', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-2', name: 'Student John', role: 'student' },
      activeRole: 'student',
      courses: [],
      showAlert: vi.fn(),
    } as any);
    render(<SyllabusCreatorPage />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });
});
