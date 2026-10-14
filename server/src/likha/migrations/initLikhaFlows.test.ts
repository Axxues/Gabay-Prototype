import { describe, it, expect } from 'vitest';
import { ensureLikhaAutomationFlows } from './initLikhaRelationalAndFlows.js';
import { likhaFetch } from '../client.js';

describe('Likha Automation Flows Provisioning', () => {
  it('provisions all 4 core LMS automation flows in Likha ERP', async () => {
    await ensureLikhaAutomationFlows();
    const res = await likhaFetch('/flows');
    expect(res.ok).toBe(true);
    const data = await res.json();
    const flowNames = (data.data || []).map((f: any) => f.name);
    expect(flowNames).toContain('gabay-publish-notification-flow');
    expect(flowNames).toContain('gabay-submission-spr-flow');
    expect(flowNames).toContain('gabay-enrollment-alert-flow');
    expect(flowNames).toContain('gabay-due-date-reminder-cron');
    // Verify that every flow has a connected root operation
    for (const f of data.data) {
      if (flowNames.includes(f.name)) {
        expect(f.operation).not.toBeNull();
      }
    }

    // Verify operations collection contains the operations
    const opsRes = await likhaFetch('/operations');
    const opsData = await opsRes.json();
    const opsKeys = (opsData.data || []).map((op: any) => op.key);
    expect(opsKeys).toContain('read_enrolled_students');
    expect(opsKeys).toContain('create_publish_notification');
    expect(opsKeys).toContain('read_activity_info');
    expect(opsKeys).toContain('upsert_spr_cell');
    expect(opsKeys).toContain('notify_graded_student');
    expect(opsKeys).toContain('read_course_instructor');
    expect(opsKeys).toContain('notify_faculty_enrollment');
    expect(opsKeys).toContain('find_upcoming_activities');
    expect(opsKeys).toContain('log_due_date_sweep');

    // Verify all operation types are valid Directus native types
    const validTypes = ['read', 'create', 'update', 'delete', 'log', 'request', 'notification', 'exec'];
    for (const op of opsData.data || []) {
      if (opsKeys.includes(op.key)) {
        expect(validTypes).toContain(op.type);
      }
    }
  }, 45000);
});
