# Gabay LMS Prototype - Agent Guidelines & Constraints

## 🚨 MANDATORY DIRECTIVE: LIKHA ERP BACKEND MODIFICATIONS

**DO NOT USE DIRECTUS REST / DDL ENDPOINTS TO MODIFY THE LIKHA ERP BACKEND — IN CODE, VIA SCRIPTS, OR VIA BROWSER CONSOLE.**

1. **Strict DOM-Only Interaction via Browser Subagent:**
   - Whenever you need to alter, configure, or inspect Likha ERP data models, collections, fields, relations, interfaces, or system settings, you **MUST use the browser subagent (`browser_subagent`)** navigating `https://gabay.zyberlab.com/admin`.
   - **DOM-ONLY INTERACTION RULE:** The browser subagent must interact **strictly and exclusively through synthetic mouse clicks (`click`), dropdown selections, and form inputs (`fill_form`) on the rendered HTML interface**.
   - **ZERO IN-BROWSER SCRIPTED API CALLS:** The browser subagent is **STRICTLY FORBIDDEN** from using `evaluate_script`, `page.evaluate()`, `window.fetch()`, `XMLHttpRequest`, or browser console scripts to issue `POST`, `PATCH`, or `DELETE` requests against `/relations`, `/fields`, `/collections`, `/schema`, or any system endpoints. Calling REST DDL from inside the browser console is just as fatal as calling it from curl.

2. **Mandatory Guardrail in Subagent Prompts:**
   - Every prompt provided to a browser subagent targeting Likha ERP MUST explicitly include this negative constraint:
     > *"CRITICAL RESTRICTION: You must ONLY configure settings by clicking DOM elements (`click`) and typing into inputs (`fill_form`). You are STRICTLY PROHIBITED from using `evaluate_script` or console execution to call `fetch()` against `/relations`, `/fields`, or `/collections`. Scripted schema calls crash the Directus server (502 Bad Gateway). If a button or setting is not clickable in the UI, STOP and report it immediately."*

3. **Reason:**
   - `https://gabay.zyberlab.com` is a live, shared production system actively used by multiple developers and teams.
   - Directus contains an unhandled exception bug in its Knex/database layer when foreign key relationship DDL (`/relations`, `/fields`) is called via REST. This crashes the server process and takes down the entire system (`HTTP 502 Bad Gateway`).
   - Using the Directus Admin UI purely through interactive mouse and keyboard events ensures Directus's internal UI validation handlers run properly without crashing the server.

4. **Client App Data Operations:**
   - Frontend and local server code may only read/write regular application items (`/items/:collection`) for normal LMS operations once authorized. No DDL or schema alterations are permitted via code or console under any circumstance.

---

## 🛡️ MANDATORY DIRECTIVE: BACKEND VS. FRONTEND RESPONSIBILITY BOUNDARIES

**NEVER PLACE BACKEND-OWNED PROCESSES, CASCADES, OR ELEVATED PRIVILEGES IN THE CLIENT / FRONTEND.**

1. **No Frontend Cascade Deletions:**
   - **Rule:** The frontend application must NEVER orchestrate multi-table relational cleanup, child record discovery, or procedural leaf deletions (e.g., querying multiple tables to delete comments, items, submissions, or files before deleting a module or course).
   - **Enforcement:** Relational integrity must be enforced on the backend. Child collections must have `ON DELETE CASCADE` configured on their foreign key relationship settings in Directus (or handled via server-side Directus Flows with `Filter (Blocking)` hooks). Client code must only issue a single `DELETE /items/:collection/:id` call.

2. **Zero Service Credentials or Elevation in the Frontend:**
   - **Rule:** Never embed superadmin, service account credentials (e.g., `getLikhaServiceToken` with hardcoded emails/passwords), or client-side elevation shims (`likhaElevatedRequest`) in the frontend bundle.
   - **Enforcement:** All operations performed by a client must authenticate strictly with the active user's session JWT. If an operation requires elevated permissions, it MUST be executed on the backend (via Directus Flows with System execution, or backend endpoints). Any permissions required for legitimate LMS user roles (e.g., faculty deleting their own module or course, students uploading their submission) must be granted through Directus role policies, NOT frontend privilege escalation.

3. **No Unhashed Sensitive Credentials in Client Storage:**
   - **Rule:** Never store user passwords, candidate passwords, or unhashed sensitive credentials in `localStorage`, `sessionStorage`, or client state.
   - **Enforcement:** Registration and password management must use secure Directus authentication flows or backend invite tokens, never plain text in client storage.

4. **Atomic Transactions Over Loose Multi-Roundtrip Mutations:**
   - **Rule:** Multi-step operations (e.g., grading with rubric criteria scores and comments, cross-section content replication) must not rely on loose, sequential client loops that leave partial database state upon network failure.
   - **Enforcement:** Where atomicity is required, leverage Directus Flows, database foreign keys, or batch endpoints.
