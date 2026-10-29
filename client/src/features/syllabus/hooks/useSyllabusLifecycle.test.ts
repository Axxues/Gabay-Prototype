import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyllabusLifecycle } from './useSyllabusLifecycle';

describe('useSyllabusLifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockCourses = [
    {
      id: 'c1',
      code: 'CSPC 103',
      title: 'Information and Knowledge Management',
      section: '3A',
      instructorId: 'u1',
      instructorName: 'Dr. Santos',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1'
    },
    {
      id: 'c2',
      code: 'CSPC 103',
      title: 'Information and Knowledge Management',
      section: '3B',
      instructorId: 'u2',
      instructorName: 'Prof. Reyes',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1'
    },
    {
      id: 'c3',
      code: 'CSPC 104',
      title: 'Data Structures and Algorithms',
      section: '2A',
      instructorId: 'u1',
      instructorName: 'Dr. Santos',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1'
    }
  ];

  it('aggregates individual courses into canonical syllabus groups and defaults status to locked', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));

    expect(result.current.groups).toHaveLength(2);
    const cspc103 = result.current.groups.find(g => g.courseCode === 'CSPC 103');
    expect(cspc103).toBeDefined();
    expect(cspc103?.sections).toEqual(['3A', '3B']);
    expect(cspc103?.instructorIds).toEqual(['u1', 'u2']);
    expect(cspc103?.status).toBe('locked');
  });

  it('releases course for development and tracks multi-instructor submission agreement', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    const cspc103 = result.current.groups.find(g => g.courseCode === 'CSPC 103')!;

    // 1. Chair releases course
    act(() => {
      result.current.releaseCourses([cspc103.id], 'chair-1');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('in_development');

    // 2. Instructor 1 agrees to submit -> submission_in_progress
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'u1');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('submission_in_progress');

    // 3. Instructor 2 agrees to submit -> ready_for_evaluation (unanimous agreement!)
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'u2');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('ready_for_evaluation');
  });

  it('handles single-instructor course immediate submission agreement', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    const cspc104 = result.current.groups.find(g => g.courseCode === 'CSPC 104')!;

    act(() => {
      result.current.releaseCourses([cspc104.id], 'chair-1');
    });
    expect(result.current.getRecord(cspc104.id)?.status).toBe('in_development');

    // Sole instructor agrees -> immediately ready_for_evaluation
    act(() => {
      result.current.confirmAgreement(cspc104.id, 'u1');
    });
    expect(result.current.getRecord(cspc104.id)?.status).toBe('ready_for_evaluation');
  });

  it('handles evaluator assignment and revision rejection cycle with agreement reset', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    const cspc103 = result.current.groups.find(g => g.courseCode === 'CSPC 103')!;

    // Release and reach ready_for_evaluation
    act(() => {
      result.current.releaseCourses([cspc103.id], 'chair-1');
      result.current.confirmAgreement(cspc103.id, 'u1');
      result.current.confirmAgreement(cspc103.id, 'u2');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('ready_for_evaluation');

    // Chair assigns two evaluators
    act(() => {
      result.current.assignEvaluators(cspc103.id, [
        { id: 'eval-1', name: 'Dr. Evaluator A' },
        { id: 'eval-2', name: 'Prof. Evaluator B' }
      ]);
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('under_evaluation');
    expect(result.current.getRecord(cspc103.id)?.evaluators).toHaveLength(2);

    // Evaluator 1 requests revisions -> revisions_required & resets agreements
    act(() => {
      result.current.submitEvaluatorReview(cspc103.id, 'eval-1', 'revisions_requested', 'Fix SDG 4 alignment');
    });
    const recordAfterRejection = result.current.getRecord(cspc103.id);
    expect(recordAfterRejection?.status).toBe('revisions_required');
    expect(recordAfterRejection?.submissionAgreements).toEqual({ u1: false, u2: false });

    // Instructors revise and re-agree
    act(() => {
      result.current.confirmAgreement(cspc103.id, 'u1');
      result.current.confirmAgreement(cspc103.id, 'u2');
    });
    expect(result.current.getRecord(cspc103.id)?.status).toBe('ready_for_evaluation');

    // Both evaluators approve
    act(() => {
      result.current.assignEvaluators(cspc103.id, [
        { id: 'eval-1', name: 'Dr. Evaluator A' },
        { id: 'eval-2', name: 'Prof. Evaluator B' }
      ]);
      result.current.submitEvaluatorReview(cspc103.id, 'eval-1', 'approved');
    });
    // Evaluator 1 approved, but waiting for Evaluator 2
    expect(result.current.getRecord(cspc103.id)?.status).toBe('under_evaluation');

    act(() => {
      result.current.submitEvaluatorReview(cspc103.id, 'eval-2', 'approved');
    });
    // All evaluators approved -> evaluator_approved
    expect(result.current.getRecord(cspc103.id)?.status).toBe('evaluator_approved');
  });

  it('completes Chair approval and Dean approval with course fan-out callback', () => {
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    const cspc104 = result.current.groups.find(g => g.courseCode === 'CSPC 104')!;

    act(() => {
      result.current.releaseCourses([cspc104.id], 'chair-1');
      result.current.confirmAgreement(cspc104.id, 'u1');
      result.current.assignEvaluators(cspc104.id, [{ id: 'eval-1', name: 'Dr. Eval' }]);
      result.current.submitEvaluatorReview(cspc104.id, 'eval-1', 'approved');
    });
    expect(result.current.getRecord(cspc104.id)?.status).toBe('evaluator_approved');

    // Chair approves
    act(() => {
      result.current.chairApprove(cspc104.id, 'chair-1');
    });
    expect(result.current.getRecord(cspc104.id)?.status).toBe('chair_approved');

    // Dean approves and fans out syllabus
    const onPropagate = vi.fn();
    act(() => {
      result.current.deanApprove(cspc104.id, 'dean-1', onPropagate);
    });
    expect(result.current.getRecord(cspc104.id)?.status).toBe('approved');
    expect(onPropagate).toHaveBeenCalledWith(cspc104.courseIds, expect.anything());
  });
});
