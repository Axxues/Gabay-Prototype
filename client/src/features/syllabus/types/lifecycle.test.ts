import { describe, it, expect } from 'vitest';
import {
  SYLLABUS_LIFECYCLE_STATUSES,
  type SyllabusLifecycleStatus,
  type SyllabusDevelopmentRecord,
  type SyllabusGroup,
  type EvaluatorReview
} from './lifecycle';

describe('Syllabus Lifecycle Types', () => {
  it('validates lifecycle status enum values and development record structure', () => {
    expect(SYLLABUS_LIFECYCLE_STATUSES).toEqual([
      'locked',
      'in_development',
      'submission_in_progress',
      'ready_for_evaluation',
      'under_evaluation',
      'revisions_required',
      'evaluator_approved',
      'chair_approved',
      'approved'
    ]);

    const review: EvaluatorReview = {
      evaluatorId: 'eval-1',
      evaluatorName: 'Dr. Jane Smith',
      status: 'pending'
    };
    expect(review.status).toBe('pending');

    const record: Partial<SyllabusDevelopmentRecord> = {
      id: 'SYL-CSPC103-2026',
      courseCode: 'CSPC 103',
      courseTitle: 'Information and Knowledge Management',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1',
      courseIds: ['c1', 'c2'],
      instructorIds: ['inst-1', 'inst-2'],
      sections: ['BSCS 3A', 'BSCS 3B'],
      status: 'locked',
      submissionAgreements: { 'inst-1': true, 'inst-2': false },
      evaluators: [review],
      updatedAt: new Date().toISOString()
    };
    expect(record.status).toBe('locked');
    expect(record.instructorIds).toHaveLength(2);

    const group: Partial<SyllabusGroup> = {
      id: 'SYL-CSPC103-2026',
      courseCode: 'CSPC 103',
      courseTitle: 'Information and Knowledge Management',
      instructorNames: ['Dr. Santos', 'Prof. Reyes'],
      status: 'in_development'
    };
    expect(group.instructorNames).toHaveLength(2);
  });
});
