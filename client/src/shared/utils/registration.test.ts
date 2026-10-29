import { describe, it, expect } from 'vitest';
import { deduplicatePendingRegistrations } from './registration';
import type { PendingRegistration } from '../types/lms';

describe('deduplicatePendingRegistrations', () => {
  it('returns empty array when input is empty or invalid', () => {
    expect(deduplicatePendingRegistrations([])).toEqual([]);
    expect(deduplicatePendingRegistrations(null as any)).toEqual([]);
  });

  it('preserves unique applicants unchanged', () => {
    const list: PendingRegistration[] = [
      {
        id: 'reg-1',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '123',
        emailVerified: true,
        activationToken: 'token-1',
        registeredAt: '2026-10-28T10:00:00Z',
        expiresAt: '2026-11-28T10:00:00Z',
        status: 'pending',
      },
      {
        id: 'reg-2',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '124',
        emailVerified: false,
        activationToken: 'token-2',
        registeredAt: '2026-10-28T11:00:00Z',
        expiresAt: '2026-11-28T11:00:00Z',
        status: 'pending',
      },
    ];

    const result = deduplicatePendingRegistrations(list);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.email)).toEqual([
      'bob@student.dmmmsu.edu.ph',
      'alice@student.dmmmsu.edu.ph',
    ]);
  });

  it('deduplicates multiple registrations with same email and retains newest registration', () => {
    const list: PendingRegistration[] = [
      {
        id: 'reg-old',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: false,
        activationToken: 'token-old',
        registeredAt: '2026-10-28T15:00:00Z',
        expiresAt: '2026-11-28T15:00:00Z',
        status: 'pending',
      },
      {
        id: 'reg-new',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: false,
        activationToken: 'token-new',
        registeredAt: '2026-10-28T17:00:00Z',
        expiresAt: '2026-11-28T17:00:00Z',
        status: 'pending',
      },
    ];

    const result = deduplicatePendingRegistrations(list);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('reg-new');
    expect(result[0].activationToken).toBe('token-new');
  });

  it('marks applicant emailVerified=true if any duplicate record had verified email', () => {
    const list: PendingRegistration[] = [
      {
        id: 'reg-older-unverified',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: false,
        activationToken: 'token-1',
        registeredAt: '2026-10-28T15:00:00Z',
        expiresAt: '2026-11-28T15:00:00Z',
        status: 'pending',
      },
      {
        id: 'reg-mid-verified',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: true,
        activationToken: 'token-2',
        registeredAt: '2026-10-28T16:00:00Z',
        expiresAt: '2026-11-28T16:00:00Z',
        status: 'pending',
      },
      {
        id: 'reg-latest',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: false,
        activationToken: 'token-3',
        registeredAt: '2026-10-28T17:00:00Z',
        expiresAt: '2026-11-28T17:00:00Z',
        status: 'pending',
      },
    ];

    const result = deduplicatePendingRegistrations(list);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('reg-latest');
    expect(result[0].emailVerified).toBe(true);
  });

  it('keeps newly submitted registration pending even if an older registration existed', () => {
    const list: PendingRegistration[] = [
      {
        id: 'reg-old-approved',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes23110823@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: true,
        activationToken: 'token-1',
        registeredAt: '2026-10-28T18:32:00Z',
        expiresAt: '2026-11-28T18:32:00Z',
        status: 'verified',
      },
      {
        id: 'reg-new-pending',
        firstName: 'Jayvee',
        lastName: 'Reyes',
        email: 'jreyes23110823@student.dmmmsu.edu.ph',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        emailVerified: true,
        activationToken: 'token-2',
        registeredAt: '2026-10-28T19:45:00Z',
        expiresAt: '2026-11-28T19:45:00Z',
        status: 'pending',
      },
    ];

    const result = deduplicatePendingRegistrations(list);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('reg-new-pending');
    expect(result[0].status).toBe('pending');
  });
});
