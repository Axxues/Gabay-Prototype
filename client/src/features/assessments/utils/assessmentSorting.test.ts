import { describe, expect, test } from 'vitest';
import {
  extractTitleSequenceNumber,
  getAssessmentRecencyScore,
  compareAssessmentsLatestFirst,
  sortAssessmentsLatestFirst,
} from './assessmentSorting';
import type { AssessmentSourceIndex } from '../../../shared/utils/assessmentSource';

describe('assessmentSorting', () => {
  describe('extractTitleSequenceNumber', () => {
    test('extracts numbers from common assessment titles', () => {
      expect(extractTitleSequenceNumber('Activity 1 (File Upload)')).toBe(1);
      expect(extractTitleSequenceNumber('Activity 2 (Text Entry)')).toBe(2);
      expect(extractTitleSequenceNumber('Activity 3 (Both)')).toBe(3);
      expect(extractTitleSequenceNumber('Activity 4 (No Criteria, attach already uploaded files)')).toBe(4);
      expect(extractTitleSequenceNumber('Activity 5 (new Question Set)')).toBe(5);
      expect(extractTitleSequenceNumber('Quiz 10 - Advanced Topics')).toBe(10);
      expect(extractTitleSequenceNumber('Assignment #3')).toBe(3);
      expect(extractTitleSequenceNumber('Project 1')).toBe(1);
      expect(extractTitleSequenceNumber('Presentation 2')).toBe(2);
    });

    test('returns null when no number is found', () => {
      expect(extractTitleSequenceNumber('Midterm Examination')).toBeNull();
      expect(extractTitleSequenceNumber('')).toBeNull();
      expect(extractTitleSequenceNumber(undefined)).toBeNull();
    });
  });

  describe('sortAssessmentsLatestFirst', () => {
    test('orders user activities from latest (Activity 5) to oldest (Activity 1)', () => {
      const mockSourceIndex: AssessmentSourceIndex = {
        classicActivityIds: new Set(['act-1', 'act-2', 'act-3', 'act-4']),
        activityIds: new Set(['act-5']),
        quizIds: new Set(),
        moduleTitleByClassicActivity: new Map(),
        moduleTitleByActivity: new Map(),
        moduleTitleByQuiz: new Map(),
        moduleItemOrderByActivity: new Map([
          ['act-1', 3],
          ['act-2', 4],
          ['act-3', 5],
          ['act-4', 1793255351],
          ['act-5', 1793255600],
        ]),
        moduleItemOrderByQuiz: new Map(),
      };

      // Shuffled array simulating Directus response order: 3, 2, 4, 1, 5
      const activities = [
        { id: 'act-3', title: 'Activity 3 (Both)' },
        { id: 'act-2', title: 'Activity 2 (Text Entry)' },
        { id: 'act-4', title: 'Activity 4 (No Criteria, attach already uploaded files)' },
        { id: 'act-1', title: 'Activity 1 (File Upload)' },
        { id: 'act-5', title: 'Activity 5 (new Question Set)' },
      ];

      const sorted = sortAssessmentsLatestFirst(activities, mockSourceIndex);

      expect(sorted.map(a => a.id)).toEqual(['act-5', 'act-4', 'act-3', 'act-2', 'act-1']);
      expect(sorted[0].title).toBe('Activity 5 (new Question Set)');
      expect(sorted[4].title).toBe('Activity 1 (File Upload)');
    });

    test('orders by explicit createdAt when present', () => {
      const items = [
        { id: 'a', title: 'Old Item', createdAt: '2026-10-01T10:00:00.000Z' },
        { id: 'b', title: 'Newer Item', createdAt: '2026-10-20T10:00:00.000Z' },
        { id: 'c', title: 'Latest Item', createdAt: '2026-10-29T10:00:00.000Z' },
      ];

      const sorted = sortAssessmentsLatestFirst(items);
      expect(sorted.map(i => i.id)).toEqual(['c', 'b', 'a']);
    });

    test('falls back to title sequence number if no module order or timestamp exists', () => {
      const items = [
        { id: '1', title: 'Quiz 1' },
        { id: '3', title: 'Quiz 3' },
        { id: '2', title: 'Quiz 2' },
      ];

      const sorted = sortAssessmentsLatestFirst(items);
      expect(sorted.map(i => i.id)).toEqual(['3', '2', '1']);
    });
  });
});
