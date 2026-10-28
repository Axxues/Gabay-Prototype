/**
 * File Uploader Utility
 * Saves uploaded files directly to Likha ERP backend (/files)
 * so that all uploaded files and images in announcements, modules, courses,
 * user avatars, and banners persist permanently on Likha ERP and survive reloads.
 */

import { likhaLmsApi } from '../api/likhaLmsApi';

export interface UploadResult {
  name: string;
  size: string;
  url: string;
  fileId?: string;
  type?: string;
  isImage?: boolean;
}

// Single source of truth for the client-side upload cap (matches the
// server multer limit in server/src/routes/files.ts).
export const FILE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export const isFileTooLarge = (sizeBytes: number): boolean =>
  sizeBytes > FILE_UPLOAD_MAX_BYTES;

// Short CourseFile/ModuleItem type union (mirrors the server detectFileType
// in server/src/routes/files.ts). NEVER store a raw MIME string here:
// office MIME types (e.g. ...wordprocessingml.document, 71 chars) exceed
// the ModuleItem.fileType NVarChar(64) column and cause a 400.
export const toShortFileType = (nameOrMime: string): string => {
  const lower = (nameOrMime || '').toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('pdf')) return 'pdf';
  if (
    lower.includes('image/') ||
    lower.startsWith('data:image/') ||
    /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(lower)
  )
    return 'image';
  if (
    lower.includes('zip') ||
    lower.includes('archive') ||
    /\.(zip|tar|gz|rar|7z)$/.test(lower)
  )
    return 'archive';
  if (
    lower.includes('presentation') ||
    lower.includes('slide') ||
    lower.endsWith('.ppt') ||
    lower.endsWith('.pptx')
  )
    return 'slide';
  if (
    lower.includes('code') ||
    /\.(ts|tsx|js|jsx|py|json|html|css|java|c|cpp)$/.test(lower)
  )
    return 'code';
  return 'document';
};

export const extractDirectusFileId = (val?: string | null): string | null => {
  if (!val || typeof val !== 'string') return null;
  const match = val.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
};

export const formatFileSize = (bytes: number | string): string => {
  const b = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (!b || isNaN(b) || b <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const parseFormattedSize = (formatted?: string | null): number => {
  if (!formatted) return 0;
  const match = formatted.trim().match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const unit = (match[2] || 'B').toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };
  return Math.round(num * (multipliers[unit] || 1));
};

export const isImageFile = (name: string, type?: string, url?: string): boolean => {
  if (type && type.startsWith('image/')) return true;
  if (url && (url.startsWith('data:image/') || /\.(png|jpg|jpeg|webp|gif|svg|bmp|avif)$/i.test(url))) return true;
  const ext = name.toLowerCase().split('.').pop() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
};

export const uploadFileToPublic = async (file: File): Promise<UploadResult> => {
  const formattedSize = formatFileSize(file.size);
  const isImg = isImageFile(file.name, file.type);

  // 1. Upload exclusively to Likha ERP native file storage
  try {
    const likhaRes = await likhaLmsApi.files.uploadFile(file);
    if (likhaRes?.url) {
      return {
        name: likhaRes.filename_download || file.name,
        size: formattedSize,
        url: likhaRes.url,
        fileId: likhaRes.id,
        type: toShortFileType(file.name),
        isImage: isImg
      };
    }
  } catch (likhaErr) {
    console.warn('[uploadFileToPublic] Likha ERP upload failed:', likhaErr);
  }

  // 2. Fallback: Data URL if network or upload is completely unavailable
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    size: formattedSize,
    url: dataUrl,
    type: toShortFileType(file.name),
    isImage: isImg
  };
};
