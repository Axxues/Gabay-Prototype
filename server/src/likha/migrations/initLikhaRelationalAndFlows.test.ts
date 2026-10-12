import { describe, it, expect } from 'vitest';
import { ensureLikhaRelationalSchema } from './initLikhaRelationalAndFlows.js';
import { likhaFetch } from '../client.js';

describe('Likha Relational Schema Migration', () => {
  it('registers formal O2M and M2O relations across core LMS collections', async () => {
    await ensureLikhaRelationalSchema();
    const res = await likhaFetch('/relations');
    expect(res.ok).toBe(true);
    const data = await res.json();
    const rels = (data.data || []).map((r: any) => `${r.collection}.${r.field} -> ${r.related_collection}`);
    expect(rels).toContain('activities.course_id -> courses');
    expect(rels).toContain('modules.course_id -> courses');
    expect(rels).toContain('module_items.module_id -> modules');
    expect(rels).toContain('assessment_questions.activity_id -> activities');
    expect(rels).toContain('submissions.activity_id -> activities');
  }, 30000);
});
