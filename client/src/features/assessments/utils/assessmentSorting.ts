import type { AssessmentSourceIndex } from '../../../shared/utils/assessmentSource';

/**
 * Extracts a sequence number from assessment titles such as:
 * - "Activity 5 (new Question Set)" -> 5
 * - "Activity 4 (No Criteria, attach already uploaded files)" -> 4
 * - "Quiz 2" -> 2
 * - "Assignment 1" -> 1
 */
export function extractTitleSequenceNumber(title?: string | null): number | null {
  if (!title) return null;
  const prefixMatch = title.match(
    /(?:^|\b)(?:activity|assignment|quiz|project|presentation|lab|task|exam|unit|week|module)\s*#?\s*(\d+)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    const n = Number(prefixMatch[1]);
    if (!isNaN(n)) return n;
  }
  const standaloneMatch = title.match(/\b(\d+)\b/);
  if (standaloneMatch && standaloneMatch[1]) {
    const n = Number(standaloneMatch[1]);
    if (!isNaN(n)) return n;
  }
  return null;
}

/**
 * Calculates a comparable recency score for an assessment item.
 * Higher scores represent newer/later items.
 *
 * Hierarchy of signals:
 * 1. Explicit creation timestamp (item.createdAt / date_created / metadata.createdAt) in ms.
 * 2. Linked module item order:
 *    - If order > 1_000_000_000, it's a Unix timestamp in seconds (multiplied by 1000).
 *    - If order > 0, it's a sequential integer (scaled to preserve ordering).
 * 3. Title sequence number (e.g. Activity 5 > Activity 4).
 * 4. Due date if available.
 */
export function getAssessmentRecencyScore(
  item: { id: string; title?: string; createdAt?: string; metadata?: any; dueDate?: string },
  sourceIndex?: AssessmentSourceIndex | null
): number {
  // 1. Explicit creation timestamp
  const rawDate =
    item.createdAt ||
    (item as any).date_created ||
    (item as any).dateCreated ||
    item.metadata?.createdAt ||
    item.metadata?.created_at;
  if (rawDate) {
    const t = new Date(rawDate).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 2. Module item order (from linked module item in course modules)
  if (sourceIndex) {
    const order =
      sourceIndex.moduleItemOrderByActivity?.get(item.id) ??
      sourceIndex.moduleItemOrderByQuiz?.get(item.id) ??
      0;
    if (order > 1_000_000_000) {
      // Unix timestamp in seconds (e.g. 1793255600 -> ms)
      return order * 1000;
    }
    if (order > 0) {
      // Sequential integer order (e.g. 1, 2, 3, 4, 5...)
      return 10_000_000 + order * 1000;
    }
  }

  // 3. Title sequence number fallback (e.g. Activity 5 > Activity 4)
  const num = extractTitleSequenceNumber(item.title);
  if (num !== null && num > 0) {
    return 100_000 + num * 1000;
  }

  // 4. Due date
  if (item.dueDate) {
    const d = new Date(item.dueDate).getTime();
    if (!isNaN(d) && d > 0) return d;
  }

  return 0;
}

/**
 * Comparator for sorting assessments in latest-first order.
 */
export function compareAssessmentsLatestFirst<
  T extends { id: string; title?: string; createdAt?: string; metadata?: any; dueDate?: string }
>(a: T, b: T, sourceIndex?: AssessmentSourceIndex | null): number {
  const scoreA = getAssessmentRecencyScore(a, sourceIndex);
  const scoreB = getAssessmentRecencyScore(b, sourceIndex);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  // Tiebreaker: title number fallback if scores matched
  const numA = extractTitleSequenceNumber(a.title);
  const numB = extractTitleSequenceNumber(b.title);
  if (numA !== null && numB !== null && numA !== numB) {
    return numB - numA;
  }

  // Final deterministic tiebreaker
  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Sorts an array of assessments latest-first.
 */
export function sortAssessmentsLatestFirst<
  T extends { id: string; title?: string; createdAt?: string; metadata?: any; dueDate?: string }
>(items: T[], sourceIndex?: AssessmentSourceIndex | null): T[] {
  return [...items].sort((a, b) => compareAssessmentsLatestFirst(a, b, sourceIndex));
}
