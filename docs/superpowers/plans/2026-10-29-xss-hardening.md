# XSS Hardening & Defense-in-Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

This plan hardens the Gabay LMS frontend against Cross-Site Scripting (XSS) and token exfiltration threats while maintaining full cross-tab session persistence in `localStorage`.

---

## Proposed Changes

### Configuration & HTML Header
#### [`client/index.html`](file:///D:/4thesis/GabaySystem/Gabay-Prototype/client/index.html)
- Tighten Content-Security-Policy (CSP):
  - Add `object-src 'none';` to forbid legacy plugin exploits.
  - Add `base-uri 'self';` to prevent `<base>` tag injection attacks.
  - Add `form-action 'self';` to block malicious form hijacking.
  - Keep `connect-src 'self' http://localhost:8000 https://gabay.zyberlab.com ws://localhost:* http://localhost:*;` to prevent unauthorized outbound exfiltration of `localStorage` tokens.

---

### Shared Utilities
#### [`client/src/shared/utils/security.ts`](file:///D:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/utils/security.ts)
- Create `sanitizeUrl(url: string, fallback?: string): string` to prevent `javascript:` and unsafe data URI injections on dynamic anchor tags.
- Provide `isSafeUrl(url: string): boolean`.

#### [`client/src/shared/utils/security.test.ts`](file:///D:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/utils/security.test.ts)
- Unit tests for URL protocol sanitization, covering valid `https:`, `http:`, `mailto:`, relative paths, and blocking `javascript:`, `vbscript:`, and unsafe data schemes.

---

### Components & File Previews
#### [`client/src/features/assessments/components/AssessmentFilePreviewModal.tsx`](file:///D:/4thesis/GabaySystem/Gabay-Prototype/client/src/features/assessments/components/AssessmentFilePreviewModal.tsx)
- Sanitize download/external preview links using `sanitizeUrl`.
- If an HTML file preview is rendered, wrap it in an `iframe` with `sandbox="allow-scripts"` without `allow-same-origin` to isolate it from the parent window's `localStorage`.

---

## Tasks

- [ ] **Task 1: Content Security Policy Hardening**
  - [ ] Add `object-src 'none'; base-uri 'self'; form-action 'self';` to `<meta http-equiv="Content-Security-Policy">` in `client/index.html`.
  - [ ] Create test `client/src/shared/config/csp.test.ts` to assert that `client/index.html` enforces `object-src 'none'`, `base-uri 'self'`, and restricted `connect-src`.
  - [ ] Run test and verify pass.

- [ ] **Task 2: URL Sanitization Utility**
  - [ ] Create `client/src/shared/utils/security.ts` with `sanitizeUrl` and `isSafeUrl`.
  - [ ] Create `client/src/shared/utils/security.test.ts` testing safe vs adversarial URLs.
  - [ ] Run test and verify pass.

- [ ] **Task 3: Apply URL Sanitization & Preview Sandboxing**
  - [ ] In `AssessmentFilePreviewModal.tsx`, apply `sanitizeUrl` to `resolvedUrl` on all anchor links.
  - [ ] Run `AssessmentFilePreviewModal.test.tsx` and verify pass.

- [ ] **Task 4: Full Test Suite Verification**
  - [ ] Run full project test suite (`npm test`).
  - [ ] Confirm all tests pass with zero regressions.
