import { describe, it, expect } from 'vitest';
import type { Activity, AssessmentType, AssessmentMetadata } from './lms';

describe('AssessmentType and Activity definitions', () => {
  it('supports assignments, projects, and presentations', () => {
    const types: AssessmentType[] = ['activity', 'assignment', 'project', 'presentation'];
    expect(types).toHaveLength(4);

    const projectMeta: AssessmentMetadata = {
      groupMode: 'group',
      maxGroupSize: 4,
      repositoryUrlRequired: true,
      liveDemoUrlRequired: true,
    };

    const projectActivity: Activity = {
      id: 'act-proj-1',
      courseId: 'c1',
      title: 'Capstone Milestone 1',
      instructions: 'Submit project repository and live link',
      term: 'midterm',
      pointsPossible: 100,
      published: true,
      format: 'classic',
      assessmentType: 'project',
      metadata: projectMeta,
      questions: [],
    };

    expect(projectActivity.assessmentType).toBe('project');
    expect(projectActivity.metadata?.groupMode).toBe('group');
  });
});
