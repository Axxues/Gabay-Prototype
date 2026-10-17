import { describe, it, expect } from 'vitest';
import { isAllowedUploadExtension, sanitizeUploadFilename } from './uploadSecurity';

describe('Upload Security Validation', () => {
  it('permits safe document and image extensions', () => {
    expect(isAllowedUploadExtension('syllabus.pdf')).toBe(true);
    expect(isAllowedUploadExtension('chart.png')).toBe(true);
    expect(isAllowedUploadExtension('data.xlsx')).toBe(true);
    expect(isAllowedUploadExtension('notes.docx')).toBe(true);
  });

  it('rejects active script and executable extensions', () => {
    expect(isAllowedUploadExtension('exploit.html')).toBe(false);
    expect(isAllowedUploadExtension('vector.svg')).toBe(false);
    expect(isAllowedUploadExtension('payload.exe')).toBe(false);
    expect(isAllowedUploadExtension('script.js')).toBe(false);
    expect(isAllowedUploadExtension('test.php')).toBe(false);
  });

  it('sanitizes filenames and strips path traversal characters', () => {
    expect(sanitizeUploadFilename('../../evil.pdf')).not.toContain('..');
    expect(sanitizeUploadFilename('doc with spaces.pdf')).toBe('doc_with_spaces.pdf');
  });
});
