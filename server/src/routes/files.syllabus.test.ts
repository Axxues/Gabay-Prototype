import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PrismaSyllabusRepository,
  SyllabusSourceFileError,
  validateSourceFile,
} from '../syllabi/repository.js';

type Mock = ReturnType<typeof vi.fn>;

const sourceModel = (courseFileId?: string) => ({
  sourceDocument: courseFileId ? { courseFileId } : null,
});

const stubTx = (courseId: string | null) => ({
  courseFile: {
    findUnique: vi.fn().mockResolvedValue(courseId ? { courseId } : null),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn(),
  },
});

describe('syllabus source-file linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a source-document courseFileId from another course', async () => {
    const tx = stubTx('course-other');
    await expect(
      validateSourceFile(tx as never, 'course-1', sourceModel('file-1') as never),
    ).rejects.toBeInstanceOf(SyllabusSourceFileError);
    expect(tx.courseFile.findUnique).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      select: { courseId: true },
    });
  });

  it('accepts a source-document courseFileId from the same course', async () => {
    const tx = stubTx('course-1');
    await expect(
      validateSourceFile(tx as never, 'course-1', sourceModel('file-1') as never),
    ).resolves.toBeUndefined();
  });

  it('rejects a source-document courseFileId with no matching file', async () => {
    const tx = stubTx(null);
    await expect(
      validateSourceFile(tx as never, 'course-1', sourceModel('file-gone') as never),
    ).rejects.toBeInstanceOf(SyllabusSourceFileError);
  });

  it('preserves CourseFile rows when a draft revision is deleted', async () => {
    const tx = stubTx('course-1');
    const syllabus = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const withLock = { ...tx, syllabus, $queryRaw: vi.fn().mockResolvedValue([{ id: 'revision-draft-1' }]) };
    const client = {
      ...withLock,
      $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(withLock)),
    } as unknown as PrismaClient;
    const repository = new PrismaSyllabusRepository(client, (prefix) => `${prefix}-test`);
    await repository.deleteDraft('course-1', 'revision-draft-1');
    expect(syllabus.deleteMany).toHaveBeenCalledWith({
      where: { id: 'revision-draft-1', courseId: 'course-1', status: 'draft' },
    });
    expect(tx.courseFile.deleteMany).not.toHaveBeenCalled();
    expect(tx.courseFile.delete).not.toHaveBeenCalled();
  });

  it('returns empty RAG sections when no published revision is current', async () => {
    const course = { findUnique: vi.fn().mockResolvedValue({ code: 'CS 201', title: 'Data Structures', currentSyllabus: null }) };
    const client = { course } as unknown as PrismaClient;
    const repository = new PrismaSyllabusRepository(client, (prefix) => `${prefix}-test`);
    const sections = await repository.getRagSections('course-1');
    expect(sections).toEqual({
      institution: '',
      description: '',
      faculty: '',
      institutional_statement: '',
      program_outcomes: '',
      core_values: '',
      graduate_attributes: '',
      requirements: '',
      grading: '',
      rubrics: '',
      policies: '',
      outline: '',
      learning_plan: '',
      outcomes: '',
      course_map: '',
      references: '',
    });
    (course.findUnique as Mock).mockResolvedValue({
      code: 'CS 201',
      title: 'Data Structures',
      currentSyllabus: { status: 'draft' },
    });
    await expect(repository.getRagSections('course-1')).resolves.toEqual(sections);
  });
});
