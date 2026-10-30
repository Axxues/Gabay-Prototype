/**
 * Security & URL sanitization utilities for Gabay LMS.
 * Neutralizes XSS vectors like javascript: and data:text/html URIs in dynamic links and redirects.
 */

const SAFE_URL_PATTERN = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/))/i;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i;

/**
 * Validates whether a URL or link is safe to render in an href attribute.
 */
export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '');
  if (!trimmed) return false;

  // Forbid dangerous executable protocols
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
    // Only allow benign image data URIs
    return DATA_IMAGE_PATTERN.test(trimmed);
  }

  return SAFE_URL_PATTERN.test(trimmed);
}

/**
 * Sanitizes a URL for use in href, src, or download attributes.
 * Returns a fallback (defaults to '#') if the URL fails validation.
 */
export function sanitizeUrl(url: unknown, fallback = '#'): string {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (isSafeUrl(trimmed)) {
    return trimmed;
  }
  return fallback;
}
