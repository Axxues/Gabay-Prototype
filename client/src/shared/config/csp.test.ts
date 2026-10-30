import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Content Security Policy (index.html)', () => {
  it('enforces strict CSP with object-src none, base-uri self, and scoped connect-src', () => {
    const htmlPath = path.resolve(__dirname, '../../../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    const cspMatch = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([\s\S]*?)["']\s*\/>/i);
    expect(cspMatch).not.toBeNull();

    const csp = cspMatch![1].replace(/\s+/g, ' ');

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('https://gabay.zyberlab.com');
  });
});
