import type { Module } from '../types/lms';

export type AssessmentSourceFilter = 'all' | 'module' | 'direct';

export const ASSESSMENT_SOURCE_LABELS: Record<Exclude<AssessmentSourceFilter, 'all'>, string> = {
  module: 'From Module',
  direct: 'Direct',
};

const QUESTION_SET_LINK_PREFIX = 'asg-activity-';

export interface AssessmentSourceIndex {
  classicActivityIds: Set<string>;
  activityIds: Set<string>;
  quizIds: Set<string>;
  moduleTitleByClassicActivity: Map<string, string>;
  moduleTitleByActivity: Map<string, string>;
  moduleTitleByQuiz: Map<string, string>;
  moduleItemOrderByActivity: Map<string, number>;
  moduleItemOrderByQuiz: Map<string, number>;
}

export function buildAssessmentSourceIndex(
  modules: Module[] | undefined | null,
  courseId: string
): AssessmentSourceIndex {
  const classicActivityIds = new Set<string>();
  const activityIds = new Set<string>();
  const quizIds = new Set<string>();
  const moduleTitleByClassicActivity = new Map<string, string>();
  const moduleTitleByActivity = new Map<string, string>();
  const moduleTitleByQuiz = new Map<string, string>();
  const moduleItemOrderByActivity = new Map<string, number>();
  const moduleItemOrderByQuiz = new Map<string, number>();

  for (const m of modules || []) {
    if (m.courseId !== courseId) continue;
    for (const item of m.items || []) {
      const isActivityLike =
        (item.type === 'activity' ||
          item.type === 'assignment' ||
          item.type === 'project' ||
          item.type === 'presentation') &&
        Boolean(item.activityId);

      if (isActivityLike && item.activityId) {
        const itemOrder = Number(item.order) || 0;
        if (item.activityId.startsWith(QUESTION_SET_LINK_PREFIX)) {
          const actId = item.activityId.slice(QUESTION_SET_LINK_PREFIX.length);
          activityIds.add(actId);
          if (!moduleTitleByActivity.has(actId)) moduleTitleByActivity.set(actId, m.title);
          const currentOrder = moduleItemOrderByActivity.get(actId) || 0;
          if (itemOrder > currentOrder) moduleItemOrderByActivity.set(actId, itemOrder);
        } else {
          classicActivityIds.add(item.activityId);
          if (!moduleTitleByClassicActivity.has(item.activityId))
            moduleTitleByClassicActivity.set(item.activityId, m.title);
          const currentOrder = moduleItemOrderByActivity.get(item.activityId) || 0;
          if (itemOrder > currentOrder) moduleItemOrderByActivity.set(item.activityId, itemOrder);
        }
      } else if (item.type === 'quiz' && item.quizId) {
        quizIds.add(item.quizId);
        if (!moduleTitleByQuiz.has(item.quizId)) moduleTitleByQuiz.set(item.quizId, m.title);
        const itemOrder = Number(item.order) || 0;
        const currentOrder = moduleItemOrderByQuiz.get(item.quizId) || 0;
        if (itemOrder > currentOrder) moduleItemOrderByQuiz.set(item.quizId, itemOrder);
      }
    }
  }

  return {
    classicActivityIds,
    activityIds,
    quizIds,
    moduleTitleByClassicActivity,
    moduleTitleByActivity,
    moduleTitleByQuiz,
    moduleItemOrderByActivity,
    moduleItemOrderByQuiz,
  };
}

export function matchesSourceFilter(
  isFromModule: boolean,
  sourceFilter: AssessmentSourceFilter
): boolean {
  if (sourceFilter === 'all') return true;
  if (sourceFilter === 'module') return isFromModule;
  return !isFromModule;
}
