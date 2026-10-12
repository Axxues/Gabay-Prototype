import { describe, expect, it } from 'vitest';
import { getCourseModules } from '../likha/repositories/modulesRepo.js';
import {
  getActivities,
  recordSubmission,
  gradeSubmission,
  getSubmissions,
} from '../likha/repositories/assessmentsRepo.js';

describe('Likha Modules & Assessments Repositories', () => {
  it('retrieves modules for course CS 101 from Likha ERP', async () => {
    const modules = await getCourseModules('c-cs101');
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules[0].courseId).toBe('c-cs101');
    expect(modules[0].title).toContain('Module 1');
  });

  it('retrieves activities for course CS 101 from Likha ERP', async () => {
    const activities = await getActivities('c-cs101');
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThanOrEqual(1);
    const first = activities[0];
    expect(first.courseId).toBe('c-cs101');
    expect(first.title).toContain('Laboratory Activity 1');
    expect(first.totalPoints).toBe(50);
  });

  it('records student submission and allows faculty grading in Likha ERP', async () => {
    const activities = await getActivities('c-cs101');
    const actId = activities[0]?.id;
    const sub = await recordSubmission({
      courseId: 'c-cs101',
      studentId: 'usr-stud-1',
      activityId: actId,
      status: 'submitted',
      answers: { q1: 'Sparse uses lexical matching, dense uses vector embeddings.' },
    });
    expect(sub).toBeDefined();
    expect(sub.courseId).toBe('c-cs101');
    expect(sub.status).toBe('submitted');

    // Faculty grades the submission
    const graded = await gradeSubmission(sub.id, 48, { q1: 24, q2: 24 }, 'Great explanation!', 'Faculty Instructor 1');
    expect(graded).toBeDefined();
    expect(graded.status).toBe('graded');
    expect(graded.score).toBe(48);

    // Verify submission query
    const list = await getSubmissions('c-cs101', 'usr-stud-1');
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((s: any) => s.id === sub.id)).toBe(true);
  });
});
