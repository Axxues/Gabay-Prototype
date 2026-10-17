export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'csv',
]);

export function isAllowedUploadExtension(filename: string): boolean {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop() || '';
  return ALLOWED_EXTENSIONS.has(ext);
}

export function sanitizeUploadFilename(filename: string): string {
  return filename.replace(/\.{2,}/g, '.').replace(/[^a-zA-Z0-9._-]/g, '_');
}
