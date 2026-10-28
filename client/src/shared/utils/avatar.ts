/**
 * Avatar helpers.
 * Users without an uploaded photo get an initial-letter avatar; legacy
 * Unsplash stock photo urls count as "no photo" so existing accounts flip
 * to initials automatically.
 */

import { LIKHA_URL, resolveLikhaAssetUrl } from '../api/likhaLmsApi';

export function getInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed[0].toUpperCase();
}

export function avatarHue(name: string): number {
  let hash = 0;
  const key = name || '';
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function avatarBackground(name: string): string {
  return `hsl(${avatarHue(name)} 55% 42%)`;
}

export function isDefaultAvatarUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true;
  return url.includes('images.unsplash.com');
}

export function hasCustomAvatar(url: string | null | undefined): boolean {
  return !isDefaultAvatarUrl(url);
}

export interface AssetTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'auto' | 'png' | 'jpg';
}

export function resolveDirectusAssetUrl(
  asset: any,
  options?: AssetTransformOptions
): string {
  if (!asset) return '';
  const assetId = typeof asset === 'string' ? asset.trim() : asset.id || asset.url || '';
  if (!assetId) return '';
  if (assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.startsWith('/') || assetId.startsWith('data:')) {
    return resolveLikhaAssetUrl(assetId);
  }

  let url = `${LIKHA_URL}/assets/${assetId}`;
  const params: string[] = [];
  if (options?.width) params.push(`width=${options.width}`);
  if (options?.height) params.push(`height=${options.height}`);
  if (options?.quality) params.push(`quality=${options.quality}`);
  if (options?.format) params.push(`format=${options.format}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  return resolveLikhaAssetUrl(url);
}

