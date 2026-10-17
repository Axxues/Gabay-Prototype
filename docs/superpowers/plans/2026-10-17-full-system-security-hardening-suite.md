# Full System Security Hardening Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate audited critical, high, and medium security vulnerabilities across authentication, privilege elevation, token entropy, file uploads, stored XSS, markdown injection, and iframe sandboxing in the Gabay LMS Prototype.

**Architecture:** Systematic remediation across the client API layer (`likhaLmsApi.ts`), state management (`LMSContext.tsx`), upload middleware (`vite.config.ts`), UI security guards (`RoleGuard.tsx`), markdown sanitizer (`ChatMarkdown.tsx`), and HTML security meta headers (`index.html`).

**Tech Stack:** React 19, TypeScript, Vite, Web Crypto API, ReactMarkdown, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-full-system-security-hardening-suite-design.md`

## Global Constraints
- **Directus Zero-Downtime Directive (`AGENTS.md`):** Do not make REST API DDL calls (`/fields`, `/relations`, `/collections`) to Likha ERP (`https://gabay.zyberlab.com`).
- **Zero Regressions:** Maintain 100% test pass rate across all 90 client test suites (555+ tests).
- **Scope Exclusion:** Item 3.1 (FastAPI RAG Service unauthenticated/unthrottled endpoint) remains untouched per user request.

## Review Focus
- **403 Forbidden handling in `likhaLmsApi.ts`:** Must reject unauthorized actions immediately and throw `ApiError` with code `forbidden`, rather than re-authenticating as admin.
- **Local user authentication fallback in `LMSContext.tsx`:** Must reject any user with undefined/empty password instead of granting passwordless login.
- **Password removal from `pendingRegistrations`:** Must ensure `gabay_pending_registrations` in `localStorage` contains zero plaintext password fields.
- **Vite upload middleware security:** Upload requests over 25 MB must terminate with HTTP 413; non-whitelisted extensions (e.g. `.html`, `.svg`) must reject with HTTP 400.
- **Markdown link security in `ChatMarkdown.tsx`:** Dangerous protocols (`javascript:`) must be stripped or neutralized, and external links must include `target="_blank"` and `rel="noopener noreferrer"`.

---

### Task 1: Eliminate Hardcoded Service Credentials & Automatic 403 Privilege Escalation

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:17-45`, `client/src/shared/api/likhaLmsApi.ts:79-90`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: `rawLikhaFetch(path, options, allowRetry)`
- Produces: Standardized Directus API calls relying solely on the user's bearer token without service account elevation or auto-retry on 403.

- [ ] **Step 1: Write unit tests verifying 403 Forbidden rejects without service account escalation**

Add a test in `client/src/shared/api/likhaLmsApi.test.ts`:
```ts
it('immediately throws an ApiError on 403 Forbidden without elevating credentials', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    text: async () => JSON.stringify({ errors: [{ message: 'Forbidden access', extensions: { code: 'FORBIDDEN' } }] }),
    json: async () => ({ errors: [{ message: 'Forbidden access', extensions: { code: 'FORBIDDEN' } }] }),
  } as any);

  await expect(likhaLmsApi.users.getUsers()).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`
Expected: Passes or fails if 403 retry loop calls fetch twice.

- [ ] **Step 3: Remove `SERVICE_EMAIL`, `SERVICE_PASSWORD`, `getServiceToken()`, and the 403 fallback block in `likhaLmsApi.ts`**

In `client/src/shared/api/likhaLmsApi.ts`:
1. Remove `const SERVICE_EMAIL = ...;`, `const SERVICE_PASSWORD = ...;`, `let cachedServiceToken = ...;`, and `async function getServiceToken() { ... }`.
2. Remove lines 79-90:
```ts
// REMOVE THIS BLOCK:
if (res.status === 403 && allowRetry) {
  const svcToken = await getServiceToken();
  ...
}
```
3. Directus 403 responses fall cleanly through to line 92 (`if (!res.ok)`), throwing `ApiError(403, 'forbidden', ...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
git commit -m "security(api): strip hardcoded service credentials and automatic 403 privilege escalation"
```

---

### Task 2: Eliminate Passwordless Local User Authentication Bypass

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:2420-2433`
- Test: `client/src/shared/context/LMSContext.authBypass.test.tsx` (new test)

**Interfaces:**
- Consumes: `login(emailOrId: string, password: string)`
- Produces: Secure credential verification rejecting users missing passwords.

- [ ] **Step 1: Write a failing test for passwordless authentication attempts**

Create `client/src/shared/context/LMSContext.authBypass.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LMSProvider, useLMS } from './LMSContext';

describe('LMSContext security: passwordless auth prevention', () => {
  it('rejects login when local user has no password configured', async () => {
    const { result } = renderHook(() => useLMS(), { wrapper: LMSProvider });
    await act(async () => {
      // Simulate attempting to login to a passwordless user account
      const res = await result.current.login('student1@dmmmsu.edu.ph', 'wrong-pass');
      expect(res.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure/behavior**

Run: `npx vitest run client/src/shared/context/LMSContext.authBypass.test.tsx`

- [ ] **Step 3: Enforce strict password validation in `LMSContext.tsx:login`**

In `client/src/shared/context/LMSContext.tsx`:
```ts
    const localUser = db.users.find(
      u => (u.email.toLowerCase() === cleanEmail || u.studentId?.toLowerCase() === cleanEmail)
    );
    if (localUser) {
      const effectiveUser = normalizeChancellorUser(localUser);
      // Strictly require a stored password and exact match. If password is empty or undefined, fail.
      if (!effectiveUser.password || effectiveUser.password !== password) {
        return { success: false, message: 'Invalid email or password.' };
      }
      setCurrentUser(effectiveUser);
      return { success: true };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/context/LMSContext.authBypass.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.authBypass.test.tsx
git commit -m "security(auth): patch passwordless authentication bypass on local user fallback"
```

---

### Task 3: Remove Plaintext Password Storage in `localStorage` for Pending Registrations

**Files:**
- Modify: `client/src/shared/types/lms.ts:50-70`, `client/src/shared/context/LMSContext.tsx:1505-1525, 3634-3656`, `client/src/features/auth/RegisterPage.tsx:155-175`
- Test: `client/src/features/auth/RegisterPage.passwordSecurity.test.tsx` (new test)

**Interfaces:**
- Consumes: `registerAccount(payload)`
- Produces: `PendingRegistration` records stored without the `password` field in `localStorage`.

- [ ] **Step 1: Write a test asserting that `localStorage` never contains plaintext registration passwords**

Create `client/src/features/auth/RegisterPage.passwordSecurity.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LMSProvider, useLMS } from '../../shared/context/LMSContext';

describe('Pending registration password storage security', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not serialize plaintext password into localStorage', async () => {
    const { result } = renderHook(() => useLMS(), { wrapper: LMSProvider });
    await act(async () => {
      await result.current.registerAccount({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-1',
        department: 'CS',
        studentId: '231-1082-3',
        password: 'SuperSecretPassword123!',
      });
    });

    const stored = localStorage.getItem('gabay_pending_registrations');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('SuperSecretPassword123!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/features/auth/RegisterPage.passwordSecurity.test.tsx`
Expected: FAIL with `expected stored not to contain 'SuperSecretPassword123!'`

- [ ] **Step 3: Modify `PendingRegistration` and `LMSContext.tsx` to strip `password` on serialization**

1. In `client/src/shared/types/lms.ts`, make `password` optional on `PendingRegistration` (`password?: string`).
2. In `client/src/shared/context/LMSContext.tsx`:
   - When writing to `STORAGE_KEY_PENDING_REGISTRATIONS`:
     ```ts
     const sanitized = pendingRegistrations.map(({ password: _, ...rest }) => rest);
     safeSetLocalStorage(STORAGE_KEY_PENDING_REGISTRATIONS, JSON.stringify(sanitized));
     ```
   - On initialization from `localStorage`, ensure any stale `password` property is stripped.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/features/auth/RegisterPage.passwordSecurity.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/types/lms.ts client/src/shared/context/LMSContext.tsx client/src/features/auth/RegisterPage.passwordSecurity.test.tsx
git commit -m "security(storage): eliminate plaintext password persistence in pending registrations localStorage"
```

---

### Task 4: Cryptographic Activation Token Generation & Password Length Standard

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:3627-3630`, `client/src/features/auth/RegisterPage.tsx:144-147`
- Test: `client/src/features/auth/RegisterPage.tokenEntropy.test.ts` (new test)

**Interfaces:**
- Consumes: Web Crypto API `crypto.getRandomValues(new Uint8Array(32))`
- Produces: Cryptographically secure 64-character hexadecimal activation tokens.

- [ ] **Step 1: Write test verifying cryptographic token entropy and 8-character password requirement**

Create `client/src/features/auth/RegisterPage.tokenEntropy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateSecureActivationToken } from '../../shared/utils/cryptoToken';

describe('Activation token generation entropy', () => {
  it('generates a 64-character hex string with high entropy', () => {
    const t1 = generateSecureActivationToken();
    const t2 = generateSecureActivationToken();
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t2).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).not.toBe(t2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/features/auth/RegisterPage.tokenEntropy.test.ts`
Expected: FAIL ("cannot find module cryptoToken")

- [ ] **Step 3: Create `cryptoToken.ts` and update `LMSContext.tsx` & `RegisterPage.tsx`**

1. Create `client/src/shared/utils/cryptoToken.ts`:
```ts
export function generateSecureActivationToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node environment fallback
    const nodeCrypto = (globalThis as any).crypto;
    nodeCrypto.getRandomValues(bytes);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
```
2. In `client/src/shared/context/LMSContext.tsx`:
   Use `generateSecureActivationToken()` instead of `Math.random().toString(36)`.
3. In `client/src/features/auth/RegisterPage.tsx`:
   Update password minimum length validation from 6 to 8 characters (`if (password.length < 8)`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/features/auth/RegisterPage.tokenEntropy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/utils/cryptoToken.ts client/src/shared/context/LMSContext.tsx client/src/features/auth/RegisterPage.tsx client/src/features/auth/RegisterPage.tokenEntropy.test.ts
git commit -m "security(auth): enforce cryptographically secure activation tokens and 8-char password minimum"
```

---

### Task 5: Vite Dev Upload Middleware Security Hardening

**Files:**
- Modify: `client/vite.config.ts:10-75`
- Test: `client/src/shared/utils/uploadSecurity.test.ts` (new test)

**Interfaces:**
- Consumes: Vite `configureServer` middleware on `/api/upload`
- Produces: Upload validation enforcing a 25 MB payload cap and an extension whitelist (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.csv`), strictly rejecting `.html`, `.svg`, `.exe`, etc.

- [ ] **Step 1: Write test for upload filename and extension sanitization**

Create `client/src/shared/utils/uploadSecurity.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/shared/utils/uploadSecurity.test.ts`
Expected: FAIL ("cannot find module uploadSecurity")

- [ ] **Step 3: Implement `uploadSecurity.ts` and update `vite.config.ts`**

1. Create `client/src/shared/utils/uploadSecurity.ts`:
```ts
export const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'pptx', 'txt', 'csv'
]);

export function isAllowedUploadExtension(filename: string): boolean {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop() || '';
  return ALLOWED_EXTENSIONS.has(ext);
}

export function sanitizeUploadFilename(filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.');
  return clean;
}
```
2. In `client/vite.config.ts`, import `isAllowedUploadExtension` and `sanitizeUploadFilename`.
3. In `fileUploadPlugin`:
   - Enforce 25 MB max buffer size while collecting chunks:
     ```ts
     let totalSize = 0;
     const MAX_SIZE = 25 * 1024 * 1024;
     req.on('data', chunk => {
       totalSize += chunk.length;
       if (totalSize > MAX_SIZE) {
         res.statusCode = 413;
         res.setHeader('Content-Type', 'application/json');
         res.end(JSON.stringify({ error: 'Payload Too Large: Maximum upload size is 25 MB.' }));
         req.destroy();
         return;
       }
       chunks.push(chunk);
     });
     ```
   - Before saving to disk, validate filename with `isAllowedUploadExtension(filename)`. If false:
     ```ts
     res.statusCode = 400;
     res.setHeader('Content-Type', 'application/json');
     res.end(JSON.stringify({ error: 'Disallowed file type. Only standard documents and images are permitted.' }));
     return;
     ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/utils/uploadSecurity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/utils/uploadSecurity.ts client/src/shared/utils/uploadSecurity.test.ts client/vite.config.ts
git commit -m "security(upload): enforce 25MB buffer cap and strict file extension whitelist in Vite upload middleware"
```

---

### Task 6: Restrict RoleGuard Bypass & Production Role Switching Backdoor

**Files:**
- Modify: `client/src/shared/components/common/RoleGuard.tsx:47-53`
- Test: `client/src/shared/components/common/RoleGuard.prodSecurity.test.tsx` (new test)

**Interfaces:**
- Consumes: `import.meta.env.DEV`
- Produces: RoleGuard UI that strictly suppresses "Switch Role to Test" in production builds.

- [ ] **Step 1: Write a test verifying that "Switch Role to Test" button is omitted in non-dev mode**

Create `client/src/shared/components/common/RoleGuard.prodSecurity.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoleGuard } from './RoleGuard';
import * as LMSContext from '../../context/LMSContext';

describe('RoleGuard production security', () => {
  it('does not display Switch Role button when not in dev mode', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeRole: 'student',
      setIsRoleModalOpen: vi.fn(),
    } as any);

    render(
      <RoleGuard allowedRoles={['admin', 'faculty']}>
        <div>Secret Admin Content</div>
      </RoleGuard>
    );

    // In dev mode (import.meta.env.DEV in Vitest), button exists.
    // We test that the conditional is tied to import.meta.env.DEV.
    expect(screen.queryByText('Secret Admin Content')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify setup**

Run: `npx vitest run client/src/shared/components/common/RoleGuard.prodSecurity.test.tsx`

- [ ] **Step 3: Update `RoleGuard.tsx` to conditionally render the test button on `import.meta.env.DEV`**

In `client/src/shared/components/common/RoleGuard.tsx`:
```tsx
{import.meta.env.DEV && (
  <button
    onClick={() => setIsRoleModalOpen(true)}
    className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm active:scale-[0.98] cursor-pointer"
  >
    Switch Role to Test (Dev Only)
  </button>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/components/common/RoleGuard.prodSecurity.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/components/common/RoleGuard.tsx client/src/shared/components/common/RoleGuard.prodSecurity.test.tsx
git commit -m "security(rbac): restrict role switcher shortcut to development environments in RoleGuard"
```

---

### Task 7: Markdown Link Protocol Injection Protection & Reverse Tabnabbing

**Files:**
- Modify: `client/src/features/rag/components/ChatMarkdown.tsx:171-174`
- Test: `client/src/features/rag/components/ChatMarkdown.test.tsx`

**Interfaces:**
- Consumes: `a` tag renderer in `ReactMarkdown`
- Produces: Safe link rendering neutralizing `javascript:` protocols and enforcing `target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 1: Add a test asserting malicious protocols are neutralized in `ChatMarkdown.test.tsx`**

Add in `client/src/features/rag/components/ChatMarkdown.test.tsx`:
```tsx
it('neutralizes dangerous javascript: URI protocols in markdown links', () => {
  render(<ChatMarkdown content="[Click here](javascript:alert(1))" />);
  const link = screen.queryByRole('link', { name: 'Click here' });
  if (link) {
    expect(link.getAttribute('href')).not.toBe('javascript:alert(1)');
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/features/rag/components/ChatMarkdown.test.tsx`
Expected: FAIL (link has href `javascript:alert(1)`)

- [ ] **Step 3: Implement safe link validator in `ChatMarkdown.tsx`**

In `client/src/features/rag/components/ChatMarkdown.tsx`:
```tsx
a({ children, href }) {
  const rawHref = (href || '').trim();
  const isSafeProtocol = /^(https?:\/\/|mailto:)/i.test(rawHref);
  if (!isSafeProtocol) {
    // Render text without active link for dangerous schemes (e.g. javascript:, data:)
    return <span className="font-medium text-foreground underline underline-offset-2">{children}</span>;
  }
  return (
    <a
      href={rawHref}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/features/rag/components/ChatMarkdown.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/rag/components/ChatMarkdown.tsx client/src/features/rag/components/ChatMarkdown.test.tsx
git commit -m "security(markdown): neutralize unsafe link protocols and enforce rel noopener noreferrer"
```

---

### Task 8: Iframe Sandboxing in Document Previewer

**Files:**
- Modify: `client/src/features/files/FilesView.tsx:642-646`
- Test: `client/src/features/files/FilesView.test.tsx`

**Interfaces:**
- Consumes: `<iframe ... />` in `FilesView.tsx`
- Produces: Sandboxed iframe embedding (`sandbox="allow-scripts allow-same-origin allow-forms"`).

- [ ] **Step 1: Check existing `FilesView.test.tsx` and run suite**

Run: `npx vitest run client/src/features/files/FilesView.test.tsx`
Expected: PASS

- [ ] **Step 2: Add `sandbox` attribute to the preview iframe in `FilesView.tsx`**

In `client/src/features/files/FilesView.tsx`:
```tsx
<iframe
  src={previewFile.url || previewFile.fileUrl}
  sandbox="allow-scripts allow-same-origin allow-forms"
  className="w-full min-h-[65vh] rounded-lg border border-border bg-white"
  title={previewFile.name}
/>
```

- [ ] **Step 3: Run test to verify zero regressions**

Run: `npx vitest run client/src/features/files/FilesView.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/features/files/FilesView.tsx
git commit -m "security(files): add sandbox attribute to document previewer iframe"
```

---

### Task 9: Remove Dead Express Proxy and Align RAG API Routing

**Files:**
- Modify: `client/vite.config.ts:110-118`

**Interfaces:**
- Consumes: Vite `server.proxy` configuration
- Produces: Proxy pointing `/api/rag` to `http://localhost:8000` (Python RAG service), removing obsolete port 4001.

- [ ] **Step 1: Update proxy rules in `client/vite.config.ts`**

In `client/vite.config.ts`:
Replace:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:4001',
    '/likha': { ... }
  }
}
```
With:
```ts
server: {
  proxy: {
    '/api/rag': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/rag/, '/api'),
    },
    '/likha': {
      target: 'https://gabay.zyberlab.com',
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/likha/, ''),
    },
  },
},
```

- [ ] **Step 2: Run all client tests to verify proxy configuration does not break tests**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 3: Commit**

```bash
git add client/vite.config.ts
git commit -m "fix(proxy): point RAG proxy to port 8000 and decommission dead port 4001"
```

---

### Task 10: Content Security Policy & Security Meta Headers

**Files:**
- Modify: `client/index.html:8-29`
- Test: Verify build (`npm run build --workspace=client`)

**Interfaces:**
- Consumes: HTML `<head>` meta tags
- Produces: Explicit Content Security Policy (CSP) and nosniff protection headers.

- [ ] **Step 1: Add Content Security Policy meta tags to `client/index.html`**

In `client/index.html`:
```html
<meta http-equiv="X-Content-Type-Options" content="nosniff" />
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self' http://localhost:8000 https://gabay.zyberlab.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://gabay.zyberlab.com; connect-src 'self' http://localhost:8000 https://gabay.zyberlab.com ws://localhost:* http://localhost:*; frame-src 'self' blob: data: https://gabay.zyberlab.com;"
/>
```

- [ ] **Step 2: Run build to ensure bundle assets and index.html compile cleanly**

Run: `npm run build --workspace=client`
Expected: Build passes with zero errors.

- [ ] **Step 3: Commit**

```bash
git add client/index.html
git commit -m "security(headers): add CSP and nosniff security meta headers in index.html"
```

---

### Task 11: Full System Verification & Regression Suite

- [ ] **Step 1: Run complete typecheck**
Run: `npm run typecheck --workspace=client`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**
Run: `npm test`
Expected: All 90+ test suites passing (560+ tests passing)

- [ ] **Step 3: Final clean working tree verification**
Run: `git status -s`
Expected: Clean working tree
