import { describe, it, expect } from 'vitest';
import { isSafeUrl, sanitizeUrl } from './security';

describe('security utilities', () => {
  describe('isSafeUrl', () => {
    it('accepts valid https and http URLs', () => {
      expect(isSafeUrl('https://gabay.zyberlab.com/assets/file.pdf')).toBe(true);
      expect(isSafeUrl('http://localhost:8000/api/doc')).toBe(true);
    });

    it('accepts safe relative paths', () => {
      expect(isSafeUrl('/dashboard')).toBe(true);
      expect(isSafeUrl('/courses/crs-cmsc131')).toBe(true);
    });

    it('rejects protocol-relative URLs (open redirect)', () => {
      expect(isSafeUrl('//evil.com/phish')).toBe(false);
    });

    it('accepts mailto and tel links', () => {
      expect(isSafeUrl('mailto:admin@dmmmsu.edu.ph')).toBe(true);
      expect(isSafeUrl('tel:+639123456789')).toBe(true);
    });

    it('accepts valid benign image data URIs', () => {
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    });

    it('blocks javascript: URLs with various casings and whitespace/control characters', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
      expect(isSafeUrl('  javascript:alert(1)  ')).toBe(false);
      expect(isSafeUrl('java\0script:alert(1)')).toBe(false);
      expect(isSafeUrl('jav&#x09;ascript:alert(1)')).toBe(false);
    });

    it('blocks vbscript and executable data: text/html URIs', () => {
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
    });

    it('rejects invalid or non-string inputs', () => {
      expect(isSafeUrl(null)).toBe(false);
      expect(isSafeUrl(undefined)).toBe(false);
      expect(isSafeUrl(12345)).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('returns original safe URL', () => {
      expect(sanitizeUrl('https://dmmmsu.edu.ph')).toBe('https://dmmmsu.edu.ph');
      expect(sanitizeUrl('/courses')).toBe('/courses');
    });

    it('returns fallback for malicious or invalid URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeUrl('javascript:alert(1)', '/safe-fallback')).toBe('/safe-fallback');
      expect(sanitizeUrl(null)).toBe('#');
    });
  });
});
