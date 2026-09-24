import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    course: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/db.js';
import { normalizeSyllabi } from './normalizeSyllabi.js';

describe('normalizeSyllabi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates valid rows, preserves unknown fields, and skips malformed rows', async () => {
    (prisma.course.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', code: 'CS101', syllabus: JSON.stringify({ courseInfo: { code: 'CS101' } }) },
      { id: 'c2', code: 'CS102', syllabus: '[]' },
      {
        id: 'c3',
        code: 'CS103',
        syllabus: JSON.stringify({ courseInfo: { code: 'CS103' }, extension: { enabled: true } }),
      },
    ]);
    (prisma.course.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await normalizeSyllabi();

    expect(result).toEqual({ scanned: 3, updated: 2, skipped: 1, conflicts: 0 });
    const update = prisma.course.updateMany as ReturnType<typeof vi.fn>;
    expect(update).toHaveBeenCalledTimes(2);
    const first = JSON.parse(update.mock.calls[0][0].data.syllabus as string);
    const third = JSON.parse(update.mock.calls[1][0].data.syllabus as string);
    expect(first.courseInfo.title).toBe('');
    expect(third.extension).toEqual({ enabled: true });
  });

  it('propagates database update failures', async () => {
    (prisma.course.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', code: 'CS101', syllabus: JSON.stringify({ courseInfo: { code: 'CS101' } }) },
    ]);
    (prisma.course.updateMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('database unavailable'));

    await expect(normalizeSyllabi()).rejects.toThrow('database unavailable');
  });

  it('does not overwrite a row changed after the scan', async () => {
    (prisma.course.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', code: 'CS101', syllabus: JSON.stringify({ courseInfo: { code: 'CS101' } }) },
    ]);
    (prisma.course.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const result = await normalizeSyllabi();

    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 0, conflicts: 1 });
  });
});
