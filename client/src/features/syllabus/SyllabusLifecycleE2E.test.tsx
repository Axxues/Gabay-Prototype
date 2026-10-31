import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { useSyllabusLifecycle } from './hooks/useSyllabusLifecycle';
import { useEvaluationMatrix } from './hooks/useEvaluationMatrix';
import * as matrixApi from './api/evaluationMatrixApi';
import { ConsolidatedMatrixModal } from './components/matrix/ConsolidatedMatrixModal';
import { RevisionRemarksBanner } from './components/creator/RevisionRemarksBanner';
import { DEFAULT_EVALUATION_MATRIX } from './utils/defaultMatrixTemplate';
import type { EvaluatorMatrixResponse } from './types/lifecycle';
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

  describe('evaluation matrix flow', () => {
    const allCriteria = DEFAULT_EVALUATION_MATRIX.sections.flatMap(s => s.criteria);
    const fontCriterion = allCriteria.find(c => c.id === 'fmt-2')!;
    const allYes = (): EvaluatorMatrixResponse[] =>
      allCriteria.map(c => ({ criterionId: c.id, compliant: true }));
    const withFontNo = (): EvaluatorMatrixResponse[] =>
      allCriteria.map(c =>
        c.id === fontCriterion.id
          ? { criterionId: c.id, compliant: false, comment: 'Font size is 10' }
          : { criterionId: c.id, compliant: true }
      );
    const evaluatorPair = [
      { id: 'eval-1', name: 'Dr. Jane Evaluator' },
      { id: 'eval-2', name: 'Prof. John Evaluator' }
    ];
    const rowFor = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

    const setupUnderEvaluation = () => {
      const hook = renderHook(() => useSyllabusLifecycle(mockCourses, 'col-ccit'));
      const groupId = hook.result.current.groups[0].id;
      act(() => {
        hook.result.current.releaseCourses([groupId], 'chair-marzan');
        hook.result.current.confirmAgreement(groupId, 'inst-santos');
        hook.result.current.confirmAgreement(groupId, 'inst-reyes');
      });
      act(() => {
        hook.result.current.assignEvaluators(groupId, evaluatorPair, undefined, DEFAULT_EVALUATION_MATRIX);
      });
      return { ...hook, groupId };
    };

    it('runs assign → N-wins consolidation → revision banner → re-review → evaluator_approved', () => {
      const { result, groupId } = setupUnderEvaluation();

      expect(result.current.getRecord(groupId)?.status).toBe('under_evaluation');
      expect(result.current.getRecord(groupId)?.matrixSnapshot?.version).toBe(1);

      act(() => {
        result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, {
          matrixResponses: allYes(),
          matrixVersion: 1
        });
      });
      expect(result.current.getRecord(groupId)?.status).toBe('under_evaluation');

      act(() => {
        result.current.submitEvaluatorReview(groupId, 'eval-2', 'revisions_requested', 'Please fix the formatting issues.', {
          matrixResponses: withFontNo(),
          overallComments: 'Formatting needs work',
          matrixVersion: 1
        });
      });
      const afterRevisions = result.current.getRecord(groupId)!;
      expect(afterRevisions.status).toBe('revisions_required');
      expect(afterRevisions.submissionAgreements).toEqual({ 'inst-santos': false, 'inst-reyes': false });

      // Chair's consolidated view: B's N row with attributed comment, A's Y rows intact
      const consolidated = render(
        <ConsolidatedMatrixModal
          isOpen
          courseCode="CSPC 103"
          instructorNames={['Dr. Santos', 'Prof. Reyes']}
          snapshot={afterRevisions.matrixSnapshot!}
          evaluators={afterRevisions.evaluators}
          onClose={vi.fn()}
        />
      );
      const nRow = within(rowFor(fontCriterion.text));
      expect(nRow.getByText('N')).toBeTruthy();
      expect(nRow.getByText(/Prof\. John Evaluator: Font size is 10/)).toBeTruthy();
      expect(within(rowFor('Margins (1" on all sides)')).getByText('Y')).toBeTruthy();
      consolidated.unmount();

      // Instructor studio: banner with remarks and View Evaluation Matrix
      render(
        <RevisionRemarksBanner
          evaluators={afterRevisions.evaluators}
          matrixSnapshot={afterRevisions.matrixSnapshot}
          courseCode="CSPC 103"
          instructorNames={['Dr. Santos', 'Prof. Reyes']}
        />
      );
      expect(screen.getByText('Please fix the formatting issues.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /view evaluation matrix/i }));
      expect(within(rowFor(fontCriterion.text)).getByText('N')).toBeTruthy();

      // Instructors fix and resubmit; chair re-assigns; both evaluators approve all Y
      act(() => {
        result.current.confirmAgreement(groupId, 'inst-santos');
        result.current.confirmAgreement(groupId, 'inst-reyes');
      });
      expect(result.current.getRecord(groupId)?.status).toBe('ready_for_evaluation');
      act(() => {
        result.current.assignEvaluators(groupId, evaluatorPair, undefined, afterRevisions.matrixSnapshot);
      });
      expect(result.current.getRecord(groupId)?.matrixSnapshot?.version).toBe(1);
      act(() => {
        result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
        result.current.submitEvaluatorReview(groupId, 'eval-2', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
      });
      const final = result.current.getRecord(groupId)!;
      expect(final.status).toBe('evaluator_approved');
      expect(final.evaluators.every(e => e.status === 'approved')).toBe(true);
    });

    it('double-submitting B via the WS-consensus path keeps A and B responses intact and is idempotent', () => {
      const { result, groupId } = setupUnderEvaluation();

      act(() => {
        result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
      });
      const reviewedA = result.current.getRecord(groupId)!.evaluators.find(e => e.evaluatorId === 'eval-1')!;
      const reviewedB = {
        evaluatorId: 'eval-2',
        evaluatorName: 'Prof. John Evaluator',
        status: 'revisions_requested' as const,
        remarks: 'Please fix the formatting issues.',
        reviewedAt: new Date(Date.now() + 1000).toISOString(),
        matrixResponses: withFontNo(),
        overallComments: 'Formatting needs work',
        matrixVersion: 1
      };

      // WS payloads omit matrixSnapshot and may carry only B's review
      act(() => {
        result.current.syncRemoteAgreements(groupId, {}, 'revisions_required', [reviewedB]);
        result.current.syncRemoteAgreements(groupId, {}, 'revisions_required', [reviewedB]);
      });
      const afterDouble = result.current.getRecord(groupId)!;
      expect(afterDouble.status).toBe('revisions_required');
      expect(afterDouble.matrixSnapshot?.version).toBe(1);
      expect(afterDouble.evaluators.find(e => e.evaluatorId === 'eval-1')).toEqual(reviewedA);
      expect(afterDouble.evaluators.find(e => e.evaluatorId === 'eval-2')).toEqual(reviewedB);

      // A third identical delivery must be a pure no-op (no write loop on echoed broadcasts)
      const before = result.current.records[groupId];
      act(() => {
        result.current.syncRemoteAgreements(groupId, {}, 'revisions_required', [reviewedB]);
      });
      expect(result.current.records[groupId]).toBe(before);

      // Direct double-click of the same submit is also idempotent on content
      act(() => {
        result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
        result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
      });
      const evals = result.current.getRecord(groupId)!.evaluators;
      expect(evals).toHaveLength(2);
      expect(evals.find(e => e.evaluatorId === 'eval-2')).toEqual(reviewedB);
      expect(evals.find(e => e.evaluatorId === 'eval-1')?.matrixResponses).toEqual(allYes());
    });

    describe('pressure', () => {
      let consoleError: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        vi.restoreAllMocks();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        expect(consoleError).not.toHaveBeenCalled();
        vi.restoreAllMocks();
      });

      it('concurrent evaluator submits in either order never lose a revision request or a response', () => {
        for (const order of [['eval-1', 'eval-2'], ['eval-2', 'eval-1']]) {
          localStorage.clear();
          const { result, groupId, unmount } = setupUnderEvaluation();
          act(() => {
            for (const id of order) {
              if (id === 'eval-1') {
                result.current.submitEvaluatorReview(groupId, id, 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
              } else {
                result.current.submitEvaluatorReview(groupId, id, 'revisions_requested', 'Fix font', {
                  matrixResponses: withFontNo(),
                  matrixVersion: 1
                });
              }
            }
          });
          const rec = result.current.getRecord(groupId)!;
          expect(rec.status).toBe('revisions_required');
          expect(rec.submissionAgreements).toEqual({ 'inst-santos': false, 'inst-reyes': false });
          expect(rec.evaluators.find(e => e.evaluatorId === 'eval-1')?.matrixResponses).toEqual(allYes());
          expect(rec.evaluators.find(e => e.evaluatorId === 'eval-2')?.matrixResponses).toEqual(withFontNo());
          unmount();
        }
      });

      it('a stale WS payload cannot regress a submitted evaluator back to pending', () => {
        const { result, groupId } = setupUnderEvaluation();
        act(() => {
          result.current.submitEvaluatorReview(groupId, 'eval-1', 'approved', undefined, { matrixResponses: allYes(), matrixVersion: 1 });
        });
        act(() => {
          result.current.syncRemoteAgreements(groupId, {}, 'under_evaluation', [
            { evaluatorId: 'eval-1', evaluatorName: 'Dr. Jane Evaluator', status: 'pending' },
            { evaluatorId: 'eval-2', evaluatorName: 'Prof. John Evaluator', status: 'pending' }
          ]);
        });
        const a = result.current.getRecord(groupId)!.evaluators.find(e => e.evaluatorId === 'eval-1')!;
        expect(a.status).toBe('approved');
        expect(a.matrixResponses).toEqual(allYes());
      });

      it('large matrix (600 criteria) renders and summarizes quickly', () => {
        const sections = Array.from({ length: 60 }, (_, s) => ({
          id: `s${s}`,
          title: `Section ${s}`,
          criteria: Array.from({ length: 10 }, (_, c) => ({ id: `s${s}-c${c}`, text: `Criterion ${s}.${c}` }))
        }));
        const snapshot = { ...DEFAULT_EVALUATION_MATRIX, sections };
        const responses = sections.flatMap(s => s.criteria).map((c, i) => ({
          criterionId: c.id,
          compliant: i % 7 !== 0,
          comment: i % 7 === 0 ? `Issue ${i}` : undefined
        }));
        const evaluators = ['a', 'b', 'c'].map(id => ({
          evaluatorId: id,
          evaluatorName: `Eval ${id}`,
          status: 'revisions_requested' as const,
          reviewedAt: '2026-10-25T08:00:00.000Z',
          matrixResponses: responses
        }));

        const start = performance.now();
        render(
          <ConsolidatedMatrixModal
            isOpen
            courseCode="CSPC 103"
            instructorNames={['Dr. Santos']}
            snapshot={snapshot}
            evaluators={evaluators}
            onClose={vi.fn()}
          />
        );
        const elapsed = performance.now() - start;

        expect(screen.getAllByText(/^Criterion \d+\.\d+$/)).toHaveLength(600);
        expect(screen.getAllByText('N')).toHaveLength(responses.filter(r => !r.compliant).length);
        expect(elapsed).toBeLessThan(5000);
      });

      it('localStorage disabled: template falls back to default and lifecycle still works without console errors', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(matrixApi, 'fetchMatrixTemplate').mockResolvedValue(null);

        const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'col-ccit', 'Chair'));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.template).toEqual(DEFAULT_EVALUATION_MATRIX);
        expect(await result.current.getSnapshotForAssign()).toEqual(DEFAULT_EVALUATION_MATRIX);

        const lifecycle = renderHook(() => useSyllabusLifecycle(mockCourses, 'col-ccit'));
        const groupId = lifecycle.result.current.groups[0].id;
        act(() => {
          lifecycle.result.current.releaseCourses([groupId], 'chair-marzan');
        });
        expect(lifecycle.result.current.getRecord(groupId)?.status).toBe('in_development');
      });

      it('a failed template update is reported as failed and does not bump the local version', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(matrixApi, 'fetchMatrixTemplate').mockResolvedValue({
          id: 'row-1',
          matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 2 }
        });
        vi.spyOn(matrixApi, 'updateMatrixTemplate').mockResolvedValue(null);
        const createSpy = vi.spyOn(matrixApi, 'createMatrixTemplate').mockResolvedValue(null);

        const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'col-ccit', 'Chair'));
        await waitFor(() => expect(result.current.remoteId).toBe('row-1'));

        let ok = true;
        await act(async () => { ok = await result.current.saveTemplate(DEFAULT_EVALUATION_MATRIX.sections); });
        expect(ok).toBe(false);
        expect(result.current.template.version).toBe(2);
        expect(createSpy).not.toHaveBeenCalled();
      });

      it('reload with an up-to-date cache still learns the remote row id so saves PATCH instead of POST', async () => {
        const cached = { ...DEFAULT_EVALUATION_MATRIX, version: 2 };
        vi.spyOn(matrixApi, 'readCachedMatrix').mockReturnValue(cached);
        vi.spyOn(matrixApi, 'fetchMatrixTemplate').mockResolvedValue({ id: 'row-1', matrix: cached });
        const updateSpy = vi.spyOn(matrixApi, 'updateMatrixTemplate').mockResolvedValue({ id: 'row-1', matrix: { ...cached, version: 3 } });
        const createSpy = vi.spyOn(matrixApi, 'createMatrixTemplate').mockResolvedValue(null);

        const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'col-ccit', 'Chair'));
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => { await result.current.saveTemplate(DEFAULT_EVALUATION_MATRIX.sections); });

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).not.toHaveBeenCalled();
      });

      it('a slow template fetch resolving after a save cannot roll the template back', async () => {
        vi.spyOn(matrixApi, 'readCachedMatrix').mockReturnValue(null);
        vi.spyOn(matrixApi, 'writeCachedMatrix').mockReturnValue(undefined);
        let resolveFetch!: (v: any) => void;
        vi.spyOn(matrixApi, 'fetchMatrixTemplate').mockReturnValue(new Promise(r => { resolveFetch = r; }));
        vi.spyOn(matrixApi, 'createMatrixTemplate').mockResolvedValue({
          id: 'row-1',
          matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 2 }
        });

        const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'col-ccit', 'Chair'));
        await act(async () => { await result.current.saveTemplate(DEFAULT_EVALUATION_MATRIX.sections); });
        expect(result.current.template.version).toBe(2);

        await act(async () => {
          resolveFetch({ id: 'row-1', matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 1 } });
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.template.version).toBe(2);
        expect(result.current.remoteId).toBe('row-1');
      });
    });
  });
});
