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
  }, 30000);
});
