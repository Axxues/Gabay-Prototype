import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyllabusLifecycle } from './hooks/useSyllabusLifecycle';
import type { Course } from '../../shared/types/lms';

describe('Syllabus Development Lifecycle End-to-End Pressure Test', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockCourses: Course[] = [
    {
      id: 'course-3a',
      code: 'CSPC 103',
      title: 'Information and Knowledge Management',
      section: 'BSCS 3A',
      instructorId: 'inst-santos',
      instructorName: 'Dr. Santos',
      term: 'First Semester AY 2026-2027',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-ccit',
      departmentId: 'dept-cs',
      published: true,
      enrolledCount: 35
    },
    {
      id: 'course-3b',
      code: 'CSPC 103',
      title: 'Information and Knowledge Management',
      section: 'BSCS 3B',
      instructorId: 'inst-reyes',
      instructorName: 'Prof. Reyes',
      term: 'First Semester AY 2026-2027',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-ccit',
      departmentId: 'dept-cs',
      published: true,
      enrolledCount: 32
    }
  ];

  it('navigates the entire 10-step institutional lifecycle from Chair-Sheet ingestion to Dean approval', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses, 'col-ccit'));

    // 1. Course Ingestion Verification
    expect(result.current.groups).toHaveLength(1);
    const cspc103 = result.current.groups[0];
    expect(cspc103.courseCode).toBe('CSPC 103');
    expect(cspc103.sections).toEqual(['BSCS 3A', 'BSCS 3B']);
    expect(cspc103.instructorIds).toEqual(['inst-santos', 'inst-reyes']);

    // Initial Status MUST be locked
    expect(cspc103.status).toBe('locked');
    expect(result.current.getRecord(cspc103.id)?.status).toBe('locked');

    // 2. Chair Release Authorization
    act(() => {
      result.current.releaseCourses([cspc103.id], 'chair-marzan');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('in_development');
    expect(result.current.getRecord(cspc103.id)?.releasedBy).toBe('chair-marzan');

    // 3. Multi-Instructor Consensus Step 1 (Dr. Santos agrees)
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'inst-santos');
    });
    // Gated! Prof. Reyes hasn't agreed yet -> submission_in_progress
    expect(result.current.getRecord(cspc103.id)?.status).toBe('submission_in_progress');
    expect(result.current.getRecord(cspc103.id)?.submissionAgreements).toEqual({
      'inst-santos': true,
      'inst-reyes': false
    });

    // 4. Multi-Instructor Consensus Step 2 (Prof. Reyes agrees)
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'inst-reyes');
    });
    // 100% Unanimous Agreement Achieved -> moves to ready_for_evaluation
    expect(result.current.getRecord(cspc103.id)?.status).toBe('ready_for_evaluation');

    // 5. Chairperson Assigns Multiple Evaluators
    act(() => {
      result.current.assignEvaluators(cspc103.id, [
        { id: 'eval-1', name: 'Dr. Jane Evaluator' },
        { id: 'eval-2', name: 'Prof. John Evaluator' }
      ]);
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('under_evaluation');
    expect(result.current.getRecord(cspc103.id)?.evaluators).toHaveLength(2);

    // 6. Evaluator 1 Requests Revisions (Disapproves)
    act(() => {
      result.current.submitEvaluatorReview(
        cspc103.id,
        'eval-1',
        'revisions_requested',
        'Please realign Module 4 assessment tasks with SDG 9.'
      );
    });
    // Status immediately changes to revisions_required
    const afterRevisions = result.current.getRecord(cspc103.id);
    expect(afterRevisions?.status).toBe('revisions_required');
    // Review Focus 4: Submissions agreements MUST reset so one instructor cannot bypass consensus
    expect(afterRevisions?.submissionAgreements).toEqual({
      'inst-santos': false,
      'inst-reyes': false
    });

    // 7. Instructors Revise and Re-agree Unanimously
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'inst-santos');
      result.current.confirmAgreement(cspc103.id, 'inst-reyes');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('ready_for_evaluation');

    // 8. Re-evaluation & All Evaluators Approve
    act(() => {
      result.current.assignEvaluators(cspc103.id, [
        { id: 'eval-1', name: 'Dr. Jane Evaluator' },
        { id: 'eval-2', name: 'Prof. John Evaluator' }
      ]);
      result.current.submitEvaluatorReview(cspc103.id, 'eval-1', 'approved');
    });
    // Evaluator 1 approved, but still waiting for Evaluator 2
    expect(result.current.getRecord(cspc103.id)?.status).toBe('under_evaluation');

    act(() => {
      result.current.submitEvaluatorReview(cspc103.id, 'eval-2', 'approved');
    });
    // All assigned evaluators approved -> evaluator_approved
    expect(result.current.getRecord(cspc103.id)?.status).toBe('evaluator_approved');

    // 9. Chairperson Endorsement
    act(() => {
      result.current.chairApprove(cspc103.id, 'chair-marzan');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('chair_approved');

    // 10. Dean Final Approval with Course Section Fan-out (Review Focus 5)
    const onPropagate = vi.fn();
    act(() => {
      result.current.deanApprove(cspc103.id, 'dean-admin', onPropagate);
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('approved');
    expect(onPropagate).toHaveBeenCalledWith(
      ['course-3a', 'course-3b'],
      expect.objectContaining({
        courseInfo: expect.anything()
      })
    );
  });
});
