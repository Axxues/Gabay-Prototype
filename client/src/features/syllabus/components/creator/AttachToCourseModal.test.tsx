import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachToCourseModal } from './AttachToCourseModal';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';
import * as LMSContext from '../../../../shared/context/LMSContext';

describe('AttachToCourseModal', () => {
  const mockUpdateCourseSyllabus = vi.fn().mockResolvedValue(undefined);
  const mockPublishSyllabusDraft = vi.fn().mockResolvedValue(undefined);
  const mockShowAlert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-1', name: 'Floribeth Cuison', role: 'faculty' },
      courses: [
        { id: 'crs-1', code: 'CSPC 112', title: 'Software Engineering 2', section: '4A', schedule: 'MWF 8-9AM', room: 'LR 203', instructorId: 'usr-1' }
      ],
      updateCourseSyllabus: mockUpdateCourseSyllabus,
      publishSyllabusDraft: mockPublishSyllabusDraft,
      showAlert: mockShowAlert,
    } as any);
  });

  it('preserves target course schedule when attaching (Review Focus 2)', async () => {
    render(<AttachToCourseModal isOpen={true} onClose={vi.fn()} syllabusData={OFFICIAL_SYLLABUS_CSPC112} />);
    const selectCourseCheckbox = screen.getByLabelText(/CSPC 112/i);
    fireEvent.click(selectCourseCheckbox);

    const attachBtn = screen.getByRole('button', { name: /Attach & Save/i });
    fireEvent.click(attachBtn);

    await waitFor(() => {
      expect(mockUpdateCourseSyllabus).toHaveBeenCalledWith(
        'crs-1',
        expect.objectContaining({
          facultyMembers: expect.arrayContaining([
            expect.objectContaining({
              sections: expect.arrayContaining([
                expect.objectContaining({ section: '4A', schedule: 'MWF 8-9AM', room: 'LR 203' })
              ])
            })
          ])
        })
      );
    });
  });
});
