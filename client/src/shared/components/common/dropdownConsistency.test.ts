import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');

/**
 * The only file allowed to render a native <select> is the shared dropdown itself
 * (it keeps one as the hidden value/semantics layer).
 */
const ALLOWED = new Set(['shared/components/common/CustomDropdown.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(tsx|jsx)$/.test(entry)) return [];
    if (/\.test\.(tsx|jsx)$/.test(entry)) return [];
    return [full];
  });
}

describe('dropdown consistency', () => {
  test('every dropdown in the app goes through the shared CustomDropdown', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter(file => !ALLOWED.has(relative(SRC_ROOT, file).split(sep).join('/')))
      .filter(file => /<select[\s>]/.test(readFileSync(file, 'utf8')))
      .map(file => relative(SRC_ROOT, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });
});
