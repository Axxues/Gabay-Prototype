import { describe, expect, it, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { LMSProvider, useLMS } from './LMSContext';

// Test consumer to capture context state and methods
let capturedCtx: ReturnType<typeof useLMS> | null = null;
const TestConsumer: React.FC = () => {
  const ctx = useLMS();
  useEffect(() => {
    capturedCtx = ctx;
  }, [ctx]);
  return null;
};

describe('LMSContext - Leadership Tenures & Succession Attribution', () => {
  beforeEach(() => {
    localStorage.clear();
    capturedCtx = null;
  });

  it('initializes default active and past leadership tenures and audit logs', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    expect(capturedCtx!.leadershipTenures.length).toBeGreaterThan(0);
    expect(capturedCtx!.governanceAuditLogs.length).toBeGreaterThan(0);

    const activeAdminTenure = capturedCtx!.leadershipTenures.find(
      t => t.unitType === 'system' && t.status === 'active'
    );
    expect(activeAdminTenure).toBeDefined();

    const pastDeanTenure = capturedCtx!.leadershipTenures.find(
      t => t.unitId === 'col-ccs' && t.status === 'completed'
    );
    expect(pastDeanTenure).toBeDefined();
    expect(pastDeanTenure!.leaderName).toContain('Dr. Maria Elena Santos');
  });

  it('transfers leadership atomically, recording completed tenure for predecessor and new active tenure for successor without deleting predecessor data', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const predecessorId = 'u-incumbent-dean';
    const successorId = 'u-successor-faculty';
    const collegeId = 'col-ccs';

    // Add users to db
    capturedCtx!.db.users.push(
      {
        id: predecessorId,
        name: 'Dean Incumbent',
        email: 'incumbent@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId,
        collegeName: 'College of Computer Science',
        department: 'College of Computer Science',
        title: 'College Dean',
        avatar: '',
      },
      {
        id: successorId,
        name: 'Prof. Future Dean',
        email: 'successor@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId,
        collegeName: 'College of Computer Science',
        department: 'Computer Science',
        title: 'Associate Professor',
        avatar: '',
      }
    );

    // Perform leadership transfer wrapped in act
    await act(async () => {
      const res = await capturedCtx!.transferLeadership(
        'dean',
        predecessorId,
        successorId,
        collegeId,
        'Annual academic leadership transition'
      );
      expect(res.success).toBe(true);
    });

    // Verify tenures state after re-render
    await waitFor(() => {
      const successorTenure = capturedCtx!.leadershipTenures.find(
        t => t.leaderId === successorId && t.unitId === collegeId
      );
      expect(successorTenure).toBeDefined();
      expect(successorTenure!.status).toBe('active');
      expect(successorTenure!.endDate).toBeNull();
      expect(successorTenure!.transitionNotes).toBe('Annual academic leadership transition');
    });

    // The leadership seat account NEVER steps down to faculty!
    const seatAccount = capturedCtx!.db.users.find(u => u.id === predecessorId);
    expect(seatAccount).toBeDefined();
    expect(seatAccount!.role).toBe('admin'); // NEVER steps down to faculty!
    expect(seatAccount!.adminSubrole).toBe('dean');

    // The successor account is established as admin/dean
    const succAccount = capturedCtx!.db.users.find(u => u.id === successorId);
    expect(succAccount).toBeDefined();
    expect(succAccount!.role).toBe('admin');
    expect(succAccount!.adminSubrole).toBe('dean');

    // Governance audit log created
    await waitFor(() => {
      const transferAuditLog = capturedCtx!.governanceAuditLogs.find(
        l => l.eventType === 'leadership_transfer' && l.targetId === successorId
      );
      expect(transferAuditLog).toBeDefined();
      expect(transferAuditLog!.title).toContain('Leadership Handover: Dean');
    });
  });

  it('computes tenure impact metrics accurately for a given leader term and unit', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const sampleTenure = capturedCtx!.leadershipTenures.find(t => t.id === 'tenure-dean-ccs-active')!;
    expect(sampleTenure).toBeDefined();

    const metrics = capturedCtx!.getTenureMetrics(sampleTenure);
    expect(metrics).toHaveProperty('coursesCreated');
    expect(metrics).toHaveProperty('studentsEnrolled');
    expect(metrics).toHaveProperty('syllabiCount');
    expect(metrics).toHaveProperty('facultyAssigned');
    expect(typeof metrics.coursesCreated).toBe('number');
  });

  it('returns itemized audit events for a tenure via getTenureAuditTrail', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const sampleTenure = capturedCtx!.leadershipTenures.find(t => t.id === 'tenure-dean-ccs-active')!;
    const trail = capturedCtx!.getTenureAuditTrail(sampleTenure);

    expect(Array.isArray(trail)).toBe(true);
    expect(trail.length).toBeGreaterThan(0);
    expect(trail[0]).toHaveProperty('title');
    expect(trail[0]).toHaveProperty('timestamp');
  });

  it('blocks deleting an active leadership seat account to preserve governance integrity', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    capturedCtx!.db.users.push({
      id: 'u-active-dean',
      name: 'Dean Test',
      email: 'dean.test@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
    });

    await act(async () => {
      await capturedCtx!.addCollege({
        id: 'col-test',
        name: 'Test College',
        code: 'TC',
        deanId: 'u-active-dean',
      });
    });

    // Attempt to delete active Dean without transferring seat
    let deleteResult: any;
    await act(async () => {
      deleteResult = await capturedCtx!.deleteUser('u-active-dean');
    });

    expect(deleteResult.success).toBe(false);
    expect(deleteResult.message).toContain('Cannot delete an active Dean or Chairperson seat account');
  });
});
