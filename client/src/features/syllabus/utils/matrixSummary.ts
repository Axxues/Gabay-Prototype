import type { EvaluationMatrix, EvaluatorReview } from '../types/lifecycle';

export interface ConsolidatedComment {
  evaluatorName: string;
  comment: string;
}

export interface ConsolidatedRow {
  criterionId: string;
  compliant: boolean | null;
  comments: ConsolidatedComment[];
}

export interface ConsolidatedSection {
  id: string;
  title: string;
  rows: ConsolidatedRow[];
}

export interface ConsolidatedMatrix {
  sections: ConsolidatedSection[];
  overallComments: ConsolidatedComment[];
  submittedCount: number;
  totalCount: number;
}

const addComment = (
  list: ConsolidatedComment[],
  evaluatorName: string,
  raw: string | undefined
) => {
  const comment = raw?.trim();
  if (!comment) return;
  if (list.some((c) => c.evaluatorName === evaluatorName && c.comment === comment)) return;
  list.push({ evaluatorName, comment });
};

export function summarizeMatrix(
  snapshot: EvaluationMatrix,
  evaluators: EvaluatorReview[]
): ConsolidatedMatrix {
  const submitted = evaluators.filter(
    (e) => e.status !== 'pending' && Array.isArray(e.matrixResponses) && e.matrixResponses.length > 0
  );
  const overallComments: ConsolidatedComment[] = [];
  submitted.forEach((e) => addComment(overallComments, e.evaluatorName, e.overallComments));

  const sections = snapshot.sections.map((section) => ({
    id: section.id,
    title: section.title,
    rows: section.criteria.map((criterion) => {
      const responses = submitted.flatMap((e) =>
        (e.matrixResponses ?? [])
          .filter((r) => r.criterionId === criterion.id)
          .map((r) => ({ evaluatorName: e.evaluatorName, response: r }))
      );
      const comments: ConsolidatedComment[] = [];
      responses.forEach(({ evaluatorName, response }) =>
        addComment(comments, evaluatorName, response.comment)
      );
      const compliant =
        responses.length === 0
          ? null
          : responses.every(
              ({ response }) => response.compliant && !response.comment?.trim()
            );
      return { criterionId: criterion.id, compliant, comments };
    })
  }));

  return {
    sections,
    overallComments,
    submittedCount: submitted.length,
    totalCount: evaluators.length
  };
}
