import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadFileToLikha, getLikhaFileUrl, deleteLikhaFile } from './fileStorageService.js';

describe('Likha File Storage Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats asset URL correctly for a given file ID', async () => {
    const url = await getLikhaFileUrl('uuid-1234');
    expect(url).toBe('https://gabay.zyberlab.com/assets/uuid-1234');
  });

  it('uploads a file buffer to Likha ERP /files and returns file metadata and URL', async () => {
    const mockFileResponse = {
      data: {
        id: 'test-file-uuid',
        filename_download: 'syllabus.pdf',
        type: 'application/pdf',
        filesize: '1024',
      },
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (u.includes('/files')) {
        return {
          ok: true,
          json: async () => mockFileResponse,
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const result = await uploadFileToLikha({
      buffer: Buffer.from('dummy content'),
      filename: 'syllabus.pdf',
      mimetype: 'application/pdf',
      title: 'Course Syllabus',
    });

    expect(result.id).toBe('test-file-uuid');
    expect(result.url).toBe('https://gabay.zyberlab.com/assets/test-file-uuid');
    expect(result.filename_download).toBe('syllabus.pdf');
  });

  it('throws ApiError when Likha file upload fails', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as any;
    });

    await expect(
      uploadFileToLikha({
        buffer: Buffer.from('content'),
        filename: 'fail.pdf',
        mimetype: 'application/pdf',
      })
    ).rejects.toThrow();
  });
});
