# Full System Security Hardening Suite Specification

**Date:** October 17, 2026  
**Status:** Approved by User  
**Target Platform:** `Gabay-Prototype` (React 19 + TypeScript + Vite client, Directus Likha ERP backend at `https://gabay.zyberlab.com`)  
**Scope Exclusions:** Item 3.1 (Unauthenticated & Unthrottled FastAPI RAG Service) is explicitly excluded from remediation per user request.

---

## 1. Intent & Context

Following an extensive multi-tier security scan across the Gabay LMS Prototype, multiple critical, high, and medium severity security vulnerabilities were identified in the client-side authentication, session persistence, role-based access control, file upload processing, markdown rendering, and iframe sandboxing layers.

This specification articulates the defense-in-depth security hardening requirements for the Gabay LMS Prototype to resolve all audited vulnerabilities in an orderly, prioritized manner.

---

## 2. Requirements & Remediations by Tier

### Tier 1: Critical Severity Vulnerabilities

#### 1.1 Strip Hardcoded Service Credentials & Automatic 403 Privilege Escalation
* **Target File:** [`client/src/shared/api/likhaLmsApi.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/api/likhaLmsApi.ts)
* **Requirements:**
  1. Remove `SERVICE_EMAIL` and `SERVICE_PASSWORD` constants (`jayveegenetareyes@gmail.com` / `qwerty12345`) from the source code.
  2. Remove `getServiceToken()` and cached service token storage.
  3. Remove the automatic 403 retry loop inside `rawLikhaFetch`. When Directus returns `403 Forbidden`, the client must treat it as a terminal authorization denial and immediately throw `ApiError(403, 'forbidden', ...)`.
  4. Ensure normal LMS operations use the authenticated user's session token (`getToken()`).

#### 1.2 Eliminate Passwordless Authentication Bypass for Local Fallback Login
* **Target File:** [`client/src/shared/context/LMSContext.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/context/LMSContext.tsx)
* **Requirements:**
  1. In the `login(emailOrId, password)` function, the local user fallback (`db.users.find(...)`) must strictly verify that the target user has a defined, non-empty password, and that the provided password matches (`!effectiveUser.password || effectiveUser.password !== password`).
  2. If the user object lacks a password, local fallback login must fail with `{ success: false, message: 'Invalid email or password.' }`.

---

### Tier 2: High Severity Vulnerabilities

#### 2.1 Eliminate Plaintext Password Storage in `localStorage`
* **Target Files:**
  - [`client/src/shared/context/LMSContext.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/context/LMSContext.tsx)
  - [`client/src/shared/types/lms.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/types/lms.ts)
* **Requirements:**
  1. The `PendingRegistration` interface must not persist passwords in browser storage.
  2. When serializing `pendingRegistrations` to `localStorage` (`STORAGE_KEY_PENDING_REGISTRATIONS`), the `password` field must be omitted, stripped, or stored in transient memory only.
  3. Existing stored registrations containing plaintext passwords must be sanitized on startup.

#### 2.2 Secure Activation Token Entropy & Gated Verification Flow
* **Target Files:**
  - [`client/src/shared/context/LMSContext.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/context/LMSContext.tsx)
  - [`client/src/features/auth/RegisterPage.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/features/auth/RegisterPage.tsx)
* **Requirements:**
  1. Replace `Math.random()` token generation with `crypto.getRandomValues()` (Web Crypto API) generating at least 32 bytes (64 hex characters) of cryptographic entropy.
  2. In `RegisterPage.tsx`, remove the instant self-activation link exposure from the success modal for production environments, or clearly mark it as a local development simulation when running under `import.meta.env.DEV`.
  3. Require passwords on registration to meet institutional complexity standards (minimum 8 characters).

#### 2.3 Vite Dev Upload Middleware Security Hardening
* **Target File:** [`client/vite.config.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/vite.config.ts)
* **Requirements:**
  1. Enforce a hard maximum upload buffer limit of 25 MB (`FILE_UPLOAD_MAX_BYTES`). If `req.on('data')` chunks exceed 25 MB, immediately terminate the connection and return HTTP 413 Payload Too Large.
  2. Whitelist allowed file extensions strictly: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.csv`.
  3. Strictly reject executable or active script extensions (`.html`, `.htm`, `.svg`, `.js`, `.mjs`, `.exe`, `.bat`, `.sh`, `.php`) with HTTP 400 Bad Request to prevent Stored XSS.
  4. Ensure sanitized file names preserve the safe whitelisted extension while stripping path traversal sequences (`..`, `/`, `\`).

#### 2.4 Restrict Role Switching Backdoor & RoleGuard Bypass
* **Target Files:**
  - [`client/src/shared/components/common/RoleGuard.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/components/common/RoleGuard.tsx)
  - [`client/src/shared/context/LMSContext.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/shared/context/LMSContext.tsx)
* **Requirements:**
  1. In `RoleGuard.tsx`, the "Switch Role to Test" button must only render when `import.meta.env.DEV` is true. In production builds, the button must be omitted entirely.
  2. In `LMSContext.tsx`, `switchRole` must be restricted to development mode or non-production test harnesses.

---

### Tier 3: Medium Severity Vulnerabilities

#### 3.2 Markdown Link Protocol Injection Protection & Reverse Tabnabbing
* **Target File:** [`client/src/features/rag/components/ChatMarkdown.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/features/rag/components/ChatMarkdown.tsx)
* **Requirements:**
  1. Sanitize the `href` attribute in the custom `a` component renderer. Only allow URLs beginning with `http://`, `https://`, or `mailto:`.
  2. Strip or render as plain text any dangerous URI schemes (`javascript:`, `data:`, `vbscript:`).
  3. Add `target="_blank"` and `rel="noopener noreferrer"` to external links.

#### 3.3 Iframe Sandboxing in Document Previewer
* **Target File:** [`client/src/features/files/FilesView.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/features/files/FilesView.tsx)
* **Requirements:**
  1. Add `sandbox="allow-scripts allow-same-origin allow-forms"` to `<iframe src={previewFile.url || previewFile.fileUrl} ... />` to sandbox embedded document rendering.

#### 3.4 Clean Up Dead Proxy Port Configuration
* **Target File:** [`client/vite.config.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/vite.config.ts)
* **Requirements:**
  1. Replace the dead `/api: http://localhost:4001` proxy rule with `http://localhost:8000` (pointing to the Python RAG service).

---

### Tier 4: Low Severity & Defense-in-Depth

#### 4.1 Content Security Policy & Security Meta Headers
* **Target File:** [`client/index.html`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/index.html)
* **Requirements:**
  1. Add `<meta http-equiv="Content-Security-Policy" content="...">` permitting only necessary origins:
     - `default-src 'self' http://localhost:8000 https://gabay.zyberlab.com;`
     - `script-src 'self' 'unsafe-inline' 'unsafe-eval';` (development Vite compatibility)
     - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;`
     - `font-src 'self' https://fonts.gstatic.com data:;`
     - `img-src 'self' data: blob: https://gabay.zyberlab.com;`
     - `connect-src 'self' http://localhost:8000 https://gabay.zyberlab.com ws://localhost:* http://localhost:*;`
     - `frame-src 'self' blob: data: https://gabay.zyberlab.com;`
  2. Add `<meta http-equiv="X-Content-Type-Options" content="nosniff">`.

---

## 3. Constraints & Safety Rules
- **Directus Zero-Downtime Directive (`AGENTS.md`):** Do not make REST API DDL calls (`/fields`, `/relations`, `/collections`) to Likha ERP (`https://gabay.zyberlab.com`). Normal application read/write items are permitted.
- **100% Test Pass Rate:** All 90 test files and 555 client tests must continue to pass cleanly.
