import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';
import { assertCourseAccess, assertCourseOwner, loadCourseOr404 } from './courseAccess.js';

type Mock = ReturnType<typeof vi.fn>;

describe('courseAccess helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadCourseOr404 returns the course with a narrow select', async () => {
    (prisma.course.findUnique as Mock).mockResolvedValue({ id: 'c1', instructorId: 'u1', published: true });
    const course = await loadCourseOr404('c1');
    expect(course).toEqual({ id: 'c1', instructorId: 'u1', published: true });
    const select = (prisma.course.findUnique as Mock).mock.calls[0][0].select;
    expect(select).toBeDefined();
    expect(select.image).toBeUndefined();
    expect(select.syllabus).toBeUndefined();
  });

  it('loadCourseOr404 throws 404 not_found for an unknown course', async () => {
    (prisma.course.findUnique as Mock).mockResolvedValue(null);
    try {
      await loadCourseOr404('nope');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).code).toBe('not_found');
    }
  });

  it('assertCourseAccess lets faculty and admin through without a membership lookup', async () => {
    const course = { id: 'c1', instructorId: 'u-other', published: true };
    await assertCourseAccess(course, { sub: 'u-fac', role: 'faculty' });
    await assertCourseAccess(course, { sub: 'u-adm', role: 'admin' });
    expect(prisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
  });

  it('assertCourseAccess lets the instructor and approved members through', async () => {
    const course = { id: 'c1', instructorId: 'u1', published: true };
    await assertCourseAccess(course, { sub: 'u1', role: 'student' });
    (prisma.enrollmentRequest.findFirst as Mock).mockResolvedValue({ id: 'req-1' });
    await assertCourseAccess({ ...course, instructorId: 'u-other' }, { sub: 'u2', role: 'student' });
  });

  it('assertCourseAccess rejects non-member students with 403 forbidden', async () => {
    (prisma.enrollmentRequest.findFirst as Mock).mockResolvedValue(null);
    try {
      await assertCourseAccess(
        { id: 'c1', instructorId: 'u-other', published: true },
        { sub: 'u2', role: 'student' },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('forbidden');
      expect((err as ApiError).message).toBe('You are not a member of this course.');
    }
  });

  it('assertCourseOwner allows the owner and admins, rejects others', () => {
    expect(() =>
      assertCourseOwner({ instructorId: 'u1' }, { sub: 'u1', role: 'faculty' }),
    ).not.toThrow();
    expect(() =>
      assertCourseOwner({ instructorId: 'u1' }, { sub: 'u-adm', role: 'admin' }),
    ).not.toThrow();
    try {
      assertCourseOwner({ instructorId: 'u1' }, { sub: 'u2', role: 'faculty' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('forbidden');
      expect((err as ApiError).message).toBe('Only the course instructor can do this.');
    }
  });
});
