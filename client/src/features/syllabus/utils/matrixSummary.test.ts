import { describe, expect, it } from 'vitest';
import type { EvaluationMatrix, EvaluatorReview } from '../types/lifecycle';
import { summarizeMatrix } from './matrixSummary';

const snapshot: EvaluationMatrix = {
  version: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
  sections: [
    {
      id: 's1',
      title: 'Section One',
      criteria: [
        { id: 'c1', text: 'Criterion 1' },
        { id: 'c2', text: 'Criterion 2' }
      ]
    },
    {
      id: 's2',
      title: 'Section Two',
      criteria: [{ id: 'c3', text: 'Criterion 3' }]
    }
  ]
};

const review = (
  evaluatorName: string,
  responses: Array<{ criterionId: string; compliant: boolean; comment?: string }>,
  extra: Partial<EvaluatorReview> = {}
): EvaluatorReview => ({
  evaluatorId: `id-${evaluatorName}`,
  evaluatorName,
  status: 'approved',
  matrixResponses: responses,
  ...extra
});

const allYes = (name: string) =>
  review(name, [
    { criterionId: 'c1', compliant: true },
    { criterionId: 'c2', compliant: true },
    { criterionId: 'c3', compliant: true }
  ]);

const rowOf = (result: ReturnType<typeof summarizeMatrix>, criterionId: string) =>
  result.sections.flatMap((s) => s.rows).find((r) => r.criterionId === criterionId)!;

describe('summarizeMatrix', () => {
  it('marks a criterion N when any evaluator marks it N, others Y', () => {
    const evaluators = [
      allYes('A'),
      review('B', [
        { criterionId: 'c1', compliant: true },
        { criterionId: 'c2', compliant: false, comment: 'Missing objectives' },
        { criterionId: 'c3', compliant: true }
      ])
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c2').compliant).toBe(false);
    expect(rowOf(result, 'c1').compliant).toBe(true);
    expect(rowOf(result, 'c3').compliant).toBe(true);
  });

  it('summarizes N when a response has a comment even if compliant is true', () => {
    const evaluators = [
      review('A', [{ criterionId: 'c1', compliant: true, comment: 'Looks off' }])
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c1').compliant).toBe(false);
    expect(rowOf(result, 'c1').comments).toEqual([
      { evaluatorName: 'A', comment: 'Looks off' }
    ]);
  });

  it('keeps comments from two evaluators on the same criterion, each attributed', () => {
    const evaluators = [
      review('A', [{ criterionId: 'c1', compliant: false, comment: 'First note' }]),
      review('B', [{ criterionId: 'c1', compliant: false, comment: 'Second note' }])
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c1').comments).toEqual([
      { evaluatorName: 'A', comment: 'First note' },
      { evaluatorName: 'B', comment: 'Second note' }
    ]);
  });

  it('keeps identical comments from different evaluators, each attributed', () => {
    const evaluators = [
      review('A', [{ criterionId: 'c1', compliant: false, comment: 'Same' }]),
      review('B', [{ criterionId: 'c1', compliant: false, comment: 'Same' }]),
      review('A', [{ criterionId: 'c1', compliant: false, comment: 'Same' }])
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c1').comments).toEqual([
      { evaluatorName: 'A', comment: 'Same' },
      { evaluatorName: 'B', comment: 'Same' }
    ]);
  });

  it('sets compliant to null for criteria with no submitted responses', () => {
    const evaluators = [review('A', [{ criterionId: 'c1', compliant: true }])];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c1').compliant).toBe(true);
    expect(rowOf(result, 'c2').compliant).toBeNull();
    expect(rowOf(result, 'c3').compliant).toBeNull();
  });

  it('excludes pending evaluators from rows but counts them in totals', () => {
    const evaluators = [
      review('A', [{ criterionId: 'c1', compliant: false, comment: 'Nope' }], {
        status: 'pending'
      }),
      review('B', [{ criterionId: 'c2', compliant: true }], { status: 'pending' }),
      {
        evaluatorId: 'id-C',
        evaluatorName: 'C',
        status: 'approved' as const
      },
      allYes('D')
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(rowOf(result, 'c1').compliant).toBe(true);
    expect(rowOf(result, 'c1').comments).toEqual([]);
    expect(rowOf(result, 'c2').compliant).toBe(true);
    expect(result.submittedCount).toBe(1);
    expect(result.totalCount).toBe(4);
  });

  it('merges non-empty overall comments with attribution', () => {
    const evaluators = [
      review('A', [{ criterionId: 'c1', compliant: true }], {
        overallComments: 'Good overall'
      }),
      review('B', [{ criterionId: 'c1', compliant: true }], { overallComments: '   ' }),
      review('C', [{ criterionId: 'c1', compliant: true }], {
        overallComments: 'Needs polish'
      })
    ];
    const result = summarizeMatrix(snapshot, evaluators);
    expect(result.overallComments).toEqual([
      { evaluatorName: 'A', comment: 'Good overall' },
      { evaluatorName: 'C', comment: 'Needs polish' }
    ]);
  });

  it('returns null rows and zero submitted count for empty evaluators', () => {
    const result = summarizeMatrix(snapshot, []);
    expect(result.submittedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.overallComments).toEqual([]);
    expect(result.sections.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(result.sections.flatMap((s) => s.rows).map((r) => r.criterionId)).toEqual([
      'c1',
      'c2',
      'c3'
    ]);
    result.sections.forEach((s) => s.rows.forEach((r) => expect(r.compliant).toBeNull()));
  });
});
