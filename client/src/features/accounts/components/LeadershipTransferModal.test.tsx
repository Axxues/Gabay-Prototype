import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadershipTransferModal } from './LeadershipTransferModal';
import { LMSContext } from '../../../shared/context/LMSContext';
import type { User, College, Department } from '../../../shared/types/lms';

const mockCurrentDean: User = {
  id: 'u-dean-ccs',
  name: 'Dr. Jane Smith',
  email: 'dean.ccs@dmmmsu.edu.ph',
  role: 'admin',
  adminSubrole: 'dean',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
};

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean-ccs' },
];

const mockDepartments: Department[] = [
  { id: 'dept-cs', name: 'Computer Science', code: 'CS', collegeId: 'col-ccs', chairpersonId: 'u-chair-cs' },
];

describe('LeadershipTransferModal - Institutional Seat Handover', () => {
  let mockTransferLeadership: any;
  let mockShowAlert: any;
  let mockOnClose: any;
  let mockOnSuccess: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransferLeadership = vi.fn().mockResolvedValue({ success: true, message: 'Transfer successful' });
    mockShowAlert = vi.fn();
    mockOnClose = vi.fn();
    mockOnSuccess = vi.fn();
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof LeadershipTransferModal>> = {}) => {
    const lmsValue: any = {
      activeUser: mockCurrentDean,
      colleges: mockColleges,
      departments: mockDepartments,
      transferLeadership: mockTransferLeadership,
      showAlert: mockShowAlert,
    };

    return render(
      <LMSContext.Provider value={lmsValue}>
        <LeadershipTransferModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          leader={mockCurrentDean}
          {...props}
        />
      </LMSContext.Provider>
    );
  };

  it('strictly adheres to university rule: never shows a dropdown or select to pick a faculty account', () => {
    renderModal();

    // Verify there are no select elements or faculty dropdown lists
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/select faculty/i)).toBeNull();
    expect(screen.queryByText(/choose successor/i)).toBeNull();

    // Verify the rule banner is present explaining the separate account model
    expect(screen.getByText(/University Governance Rule: Separate Account Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Under institutional policy, Dean and Chair accounts are separate from personal faculty accounts/i)).toBeInTheDocument();
  });

  it('renders direct text input fields for new appointee details', () => {
    renderModal();

    expect(screen.getByLabelText(/New Appointee Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Official Title \/ Academic Designation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Appointment Order \/ Board Resolution Ref/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transition Reason \/ Notes/i)).toBeInTheDocument();
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Dean of College of Computer Science')).toBeInTheDocument();
  });

  it('validates required appointee name and navigates through review and confirmation', async () => {
    renderModal();

    const reviewBtn = screen.getByRole('button', { name: /Review Transfer/i });
    expect(reviewBtn).toBeDisabled();

    // Enter incoming leader's name
    const nameInput = screen.getByLabelText(/New Appointee Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Dr. Aris Thorne' } });
    expect(reviewBtn).toBeEnabled();

    // Enter appointment resolution ref and transition note
    const refInput = screen.getByLabelText(/Appointment Order \/ Board Resolution Ref/i);
    fireEvent.change(refInput, { target: { value: 'BOR Res. No. 2026-44' } });

    const notesInput = screen.getByLabelText(/Transition Reason \/ Notes/i);
    fireEvent.change(notesInput, { target: { value: 'Regular 3-year term turnover' } });

    // Click Review Transfer to proceed to step 2
    fireEvent.click(reviewBtn);

    // Verify confirmation view details
    expect(screen.getByText(/Confirm Leadership Seat Handover/i)).toBeInTheDocument();
    expect(screen.getByText(/Remains Admin \/ Dean \(Never Stepped Down\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Dr\. Aris Thorne/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/BOR Res\. No\. 2026-44/i)).toBeInTheDocument();

    // Confirm transfer
    const confirmBtn = screen.getByRole('button', { name: /Confirm Leadership Transfer/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTransferLeadership).toHaveBeenCalledWith(
        'dean',
        'u-dean-ccs',
        'Dr. Aris Thorne',
        'col-ccs',
        'Board/Appointment Ref: BOR Res. No. 2026-44 • Regular 3-year term turnover',
        {
          title: 'College Dean',
          resolutionNo: 'BOR Res. No. 2026-44',
        }
      );
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Leadership Seat Handover Complete',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
